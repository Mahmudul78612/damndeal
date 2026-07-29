import 'dart:convert';

import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:http/http.dart' as http;
import 'package:quick_actions/quick_actions.dart';
import 'package:share_plus/share_plus.dart';
import 'package:url_launcher/url_launcher.dart';
import 'package:webview_flutter/webview_flutter.dart';

import '../main.dart' show firebaseSupported;
import '../native/categories_screen.dart';
import '../native/offers_screen.dart';

const String kHomeUrl = 'https://damndeal.in/';
const String kSiteOrigin = 'https://damndeal.in';
const String kRegion = 'IN';
const Color _homeStatusBarColor = Color(0xFF8B2E82);
const Color _innerStatusBarColor = Colors.white;
const double _scrollbarMaskWidth = 4;
const String _mobileUserAgent =
  'Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 '
  '(KHTML, like Gecko) Chrome/125.0.0.0 Mobile Safari/537.36';
const String _locationObserverScript = r"""
(function() {
  if (window.__ddLocationObserver) {
    if (window.__ddEmitLocation) {
      window.__ddEmitLocation();
    }
    return;
  }

  function emitLocation() {
    if (window.LocationBridge && window.LocationBridge.postMessage) {
      window.LocationBridge.postMessage(window.location.href);
    }
  }

  window.__ddEmitLocation = emitLocation;
  window.__ddLocationObserver = true;
  emitLocation();

  var pushState = history.pushState;
  var replaceState = history.replaceState;

  history.pushState = function() {
    pushState.apply(this, arguments);
    emitLocation();
  };

  history.replaceState = function() {
    replaceState.apply(this, arguments);
    emitLocation();
  };

  window.addEventListener('popstate', emitLocation);
  window.addEventListener('hashchange', emitLocation);
})();
""";
const String _shareBridgeScript = r"""
(function() {
  if (window.__ddShareBridge) {
    return;
  }
  function sharePayload(data) {
    var payload = {
      title: (data && data.title) ? data.title : '',
      text: (data && data.text) ? data.text : '',
      url: (data && data.url) ? data.url : window.location.href
    };
    if (window.ShareBridge && window.ShareBridge.postMessage) {
      window.ShareBridge.postMessage(JSON.stringify(payload));
      return Promise.resolve();
    }
    return Promise.reject(new Error('ShareBridge unavailable'));
  }

  if (navigator.share) {
    navigator.share = sharePayload;
  } else {
    navigator.share = sharePayload;
  }

  if (!navigator.canShare) {
    navigator.canShare = function() { return true; };
  }

  window.__ddShareBridge = true;
})();
""";
const String _suppressCopyAlertScript = r"""
(function() {
  if (window.__ddAlertPatched) {
    return;
  }
  var originalAlert = window.alert;
  window.alert = function(message) {
    var text = (message || '').toString().toLowerCase();
    if (text.indexOf('copied') !== -1 || text.indexOf('clipboard') !== -1) {
      return;
    }
    return originalAlert.call(window, message);
  };
  window.__ddAlertPatched = true;
})();
""";
const String _hideScrollbarsScript = r"""
(function() {
  if (window.__ddHideScroll) {
    return;
  }
  var style = document.createElement('style');
  style.setAttribute('data-dd-scrollbar', '1');
  style.textContent = `
    ::-webkit-scrollbar { width: 0 !important; height: 0 !important; }
    ::-webkit-scrollbar-thumb { background: transparent !important; }
    html, body { scrollbar-width: none !important; -ms-overflow-style: none !important; }
  `;
  (document.head || document.documentElement).appendChild(style);
  document.documentElement.style.scrollbarWidth = 'none';
  document.documentElement.style.msOverflowStyle = 'none';
  if (document.body) {
    document.body.style.scrollbarWidth = 'none';
    document.body.style.msOverflowStyle = 'none';
  }
  window.__ddHideScroll = true;
})();
""";
const String _hideWebNavScript = r"""
(function() {
  if (window.__ddHideWebNav) {
    return;
  }
  var style = document.createElement('style');
  style.setAttribute('data-dd-hide-nav', '1');
  style.textContent = 'nav.fixed.bottom-0 { display: none !important; }';
  (document.head || document.documentElement).appendChild(style);
  window.__ddHideWebNav = true;
})();
""";
const String _pullToRefreshScript = r"""
(function() {
  if (window.__ddPullRefresh) {
    return;
  }
  window.__ddPullRefresh = true;

  function atTop() {
    var y = window.scrollY || document.documentElement.scrollTop || 0;
    return y <= 0;
  }

  var startY = null;
  var pulled = 0;
  var active = false;

  document.addEventListener('touchstart', function(e) {
    if (e.touches.length === 1 && atTop()) {
      startY = e.touches[0].clientY;
      pulled = 0;
      active = true;
    } else {
      active = false;
      startY = null;
    }
  }, { passive: true });

  document.addEventListener('touchmove', function(e) {
    if (!active || startY === null) {
      return;
    }
    pulled = e.touches[0].clientY - startY;
  }, { passive: true });

  document.addEventListener('touchend', function() {
    if (active && pulled > 140 && atTop() &&
        window.PullBridge && window.PullBridge.postMessage) {
      window.PullBridge.postMessage('refresh');
    }
    active = false;
    startY = null;
    pulled = 0;
  }, { passive: true });
})();
""";

class WebAppScreen extends StatefulWidget {
  const WebAppScreen({super.key});

  @override
  State<WebAppScreen> createState() => _WebAppScreenState();
}

class _WebAppScreenState extends State<WebAppScreen>
  with SingleTickerProviderStateMixin {
  static const Set<String> _internalSchemes = <String>{
    'http',
    'https',
    'about',
    'data',
    'blob',
    'file',
  };

  late final WebViewController _controller;
  bool _isNavigating = true;
  bool _hasError = false;
  String? _errorDescription;
  double _progress = 0;
  bool _useTopInset = false;
  bool _showSplash = true;
  bool _hasLoadedOnce = false;
  String _currentUrl = kHomeUrl;

  /// Native tab index currently shown over the WebView
  /// (1 = Categories, 2 = Offers); null = WebView visible.
  int? _nativeTab;
  final DateTime _splashStart = DateTime.now();
  static const Duration _minSplashDuration = Duration(seconds: 2);
  late final AnimationController _splashController;
  late final Animation<double> _splashScale;
  String? _fcmToken;

  @override
  void initState() {
    super.initState();
    _splashController = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 1200),
    )..repeat(reverse: true);
    _splashScale = Tween<double>(begin: 0.96, end: 1.02).animate(
      CurvedAnimation(parent: _splashController, curve: Curves.easeInOut),
    );
    _useTopInset = _shouldInsetForUrl(kHomeUrl);
    _applyStatusBarStyle(_useTopInset);
    _initFcm();
    _initQuickActions();

    _controller = WebViewController()
      ..setUserAgent(_mobileUserAgent)
      ..setJavaScriptMode(JavaScriptMode.unrestricted)
      ..setBackgroundColor(const Color(0x00000000))
      ..addJavaScriptChannel(
        'LocationBridge',
        onMessageReceived: (message) {
          _handleLocationUpdate(message.message);
        },
      )
      ..addJavaScriptChannel(
        'ShareBridge',
        onMessageReceived: (message) {
          _handleShareMessage(message.message);
        },
      )
      ..addJavaScriptChannel(
        'FcmTokenBridge',
        onMessageReceived: (message) {
          _saveFcmToken(message.message);
        },
      )
      ..addJavaScriptChannel(
        'PullBridge',
        onMessageReceived: (_) {
          _handlePullRefresh();
        },
      )
      ..setNavigationDelegate(
        NavigationDelegate(
          onNavigationRequest: _handleNavigationRequest,
          onPageStarted: (url) {
            if (!mounted) {
              return;
            }
            setState(() {
              _isNavigating = true;
              _hasError = false;
              _errorDescription = null;
              _progress = 0;
              _currentUrl = url;
              _useTopInset = _shouldInsetForUrl(url);
            });
            _applyStatusBarStyle(_useTopInset);
          },
          onProgress: (progress) {
            if (!mounted || !_isNavigating) {
              return;
            }
            setState(() {
              _progress = progress / 100.0;
            });
          },
          onPageFinished: (_) {
            if (!mounted) {
              return;
            }
            setState(() {
              _isNavigating = false;
              _progress = 1.0;
              if (!_hasLoadedOnce) {
                _hasLoadedOnce = true;
                _scheduleSplashHide();
              }
            });
            _injectScrollbarStyle();
            _injectLocationObserver();
            _injectAlertSuppressor();
            _injectShareBridge();
            _injectFcmBridge();
            _injectPullToRefresh();
            _injectHideWebNav();
          },
          onWebResourceError: (error) {
            if (!mounted) {
              return;
            }
            if (_shouldIgnoreError(error)) {
              return;
            }
            setState(() {
              _hasError = true;
              _isNavigating = false;
              _errorDescription = error.description;
              _progress = 1.0;
            });
            if (!_hasLoadedOnce) {
              _hasLoadedOnce = true;
              _scheduleSplashHide();
            }
          },
        ),
      )
      ..loadRequest(Uri.parse(kHomeUrl));
  }

  Future<void> _injectScrollbarStyle() async {
    try {
      await _controller.runJavaScript(_hideScrollbarsScript);
    } catch (_) {
      // Ignore injection failures on pages that block scripts.
    }
  }

  Future<void> _injectLocationObserver() async {
    try {
      await _controller.runJavaScript(_locationObserverScript);
    } catch (_) {
      // Ignore injection failures on pages that block scripts.
    }
  }

  Future<void> _injectAlertSuppressor() async {
    try {
      await _controller.runJavaScript(_suppressCopyAlertScript);
    } catch (_) {
      // Ignore injection failures on pages that block scripts.
    }
  }

  Future<void> _injectShareBridge() async {
    try {
      await _controller.runJavaScript(_shareBridgeScript);
    } catch (_) {
      // Ignore injection failures on pages that block scripts.
    }
  }

  Future<void> _injectPullToRefresh() async {
    try {
      await _controller.runJavaScript(_pullToRefreshScript);
    } catch (_) {
      // Ignore injection failures on pages that block scripts.
    }
  }

  Future<void> _injectHideWebNav() async {
    try {
      await _controller.runJavaScript(_hideWebNavScript);
    } catch (_) {
      // Ignore injection failures on pages that block scripts.
    }
  }

  void _handlePullRefresh() {
    if (!mounted || _isNavigating) {
      return;
    }
    HapticFeedback.mediumImpact();
    _controller.reload();
  }

  bool _shouldIgnoreError(WebResourceError error) {
    if (error.isForMainFrame != true) {
      return true;
    }
    final description = error.description.toLowerCase();
    if (description.contains('err_cleartext_not_permitted')) {
      return true;
    }
    if (description.contains('err_unknown_url_scheme')) {
      return true;
    }
    return false;
  }

  bool _shouldInsetForUrl(String url) {
    final uri = Uri.tryParse(url);
    if (uri == null) {
      return false;
    }
    if (uri.fragment.isNotEmpty && uri.fragment != '/') {
      return true;
    }
    final path = uri.path;
    if (path.isEmpty || path == '/') {
      return false;
    }
    return true;
  }

  void _handleLocationUpdate(String url) {
    if (!mounted) {
      return;
    }
    final nextInset = _shouldInsetForUrl(url);
    if (nextInset == _useTopInset && url == _currentUrl) {
      return;
    }
    setState(() {
      _currentUrl = url;
      _useTopInset = nextInset;
    });
    _applyStatusBarStyle(nextInset);
  }

  Future<void> _handleShareMessage(String rawMessage) async {
    String title = '';
    String text = '';
    String url = '';

    try {
      final decoded = jsonDecode(rawMessage) as Map<String, dynamic>;
      title = (decoded['title'] ?? '').toString();
      text = (decoded['text'] ?? '').toString();
      url = (decoded['url'] ?? '').toString();
    } catch (_) {
      url = rawMessage.trim();
    }

    final parts = [text, url].where((value) => value.isNotEmpty).toList();
    if (parts.isEmpty) {
      return;
    }
    await Share.share(
      parts.join('\n'),
      subject: title.isNotEmpty ? title : null,
    );
  }

  void _applyStatusBarStyle(bool useTopInset) {
    final color = useTopInset ? _innerStatusBarColor : _homeStatusBarColor;
    final iconBrightness = useTopInset ? Brightness.dark : Brightness.light;
    final statusBarBrightness = useTopInset ? Brightness.light : Brightness.dark;
    SystemChrome.setSystemUIOverlayStyle(
      SystemUiOverlayStyle(
        statusBarColor: color,
        statusBarIconBrightness: iconBrightness,
        statusBarBrightness: statusBarBrightness,
        systemNavigationBarColor: _innerStatusBarColor,
        systemNavigationBarIconBrightness: Brightness.dark,
        systemNavigationBarDividerColor: _innerStatusBarColor,
      ),
    );
  }

  Future<NavigationDecision> _handleNavigationRequest(
    NavigationRequest request,
  ) async {
    final uri = Uri.parse(request.url);
    if (_shouldOpenExternally(uri)) {
      await _openExternally(uri, request.url);
      return NavigationDecision.prevent;
    }

    return NavigationDecision.navigate;
  }

  bool _shouldOpenExternally(Uri uri) {
    final scheme = uri.scheme.toLowerCase();
    if (scheme.isEmpty) {
      return false;
    }

    return !_internalSchemes.contains(scheme);
  }

  Future<void> _openExternally(Uri uri, String rawUrl) async {
    final launchMode = _forceNonBrowser(uri)
        ? LaunchMode.externalNonBrowserApplication
        : LaunchMode.externalApplication;
    try {
      final launched = await launchUrl(
        uri,
        mode: launchMode,
      );
      if (!launched) {
        final fallback = _extractIntentFallback(rawUrl);
        if (fallback != null) {
          await _controller.loadRequest(Uri.parse(fallback));
        }
      }
    } catch (_) {
      final fallback = _extractIntentFallback(rawUrl);
      if (fallback != null) {
        await _controller.loadRequest(Uri.parse(fallback));
      }
    }
  }

  bool _forceNonBrowser(Uri uri) {
    const schemes = <String>{
      'upi',
      'phonepe',
      'paytmmp',
      'gpay',
      'tez',
      'bhim',
      'amazonpay',
      'payzapp',
      'bharatpe',
      'intent',
    };
    return schemes.contains(uri.scheme.toLowerCase());
  }

  String? _extractIntentFallback(String url) {
    const marker = 'S.browser_fallback_url=';
    final start = url.indexOf(marker);
    if (start == -1) {
      return null;
    }

    final end = url.indexOf(';', start);
    final encoded = end == -1
        ? url.substring(start + marker.length)
        : url.substring(start + marker.length, end);
    return Uri.decodeComponent(encoded);
  }

  void _initQuickActions() {
    const quickActions = QuickActions();
    quickActions.initialize((type) {
      HapticFeedback.mediumImpact();
      switch (type) {
        case 'orders':
          _controller.loadRequest(Uri.parse('$kSiteOrigin/orders'));
        case 'cart':
          _controller.loadRequest(Uri.parse('$kSiteOrigin/cart'));
        case 'offers':
          _openOffers();
      }
    });
    quickActions.setShortcutItems(const [
      ShortcutItem(type: 'offers', localizedTitle: 'Offers & Updates'),
      ShortcutItem(type: 'orders', localizedTitle: 'My Orders'),
      ShortcutItem(type: 'cart', localizedTitle: 'My Cart'),
    ]);
  }

  void _openOffers() {
    HapticFeedback.mediumImpact();
    if (!mounted) {
      return;
    }
    setState(() {
      _nativeTab = 2;
    });
  }

  int? _tabForUrl(String url) {
    final uri = Uri.tryParse(url);
    if (uri == null) {
      return null;
    }
    final path = uri.path;
    if (path.isEmpty || path == '/') {
      return 0;
    }
    if (path.startsWith('/categories') || path.startsWith('/subcategory')) {
      return 1;
    }
    if (path.startsWith('/cart')) {
      return 3;
    }
    if (path.startsWith('/account') || path.startsWith('/orders')) {
      return 4;
    }
    return null;
  }

  void _onTabTap(int index) {
    HapticFeedback.selectionClick();
    if (index == 1 || index == 2) {
      setState(() {
        _nativeTab = index;
      });
      return;
    }
    setState(() {
      _nativeTab = null;
    });
    const paths = <int, String>{3: '/cart', 4: '/account'};
    final target = index == 0 ? kHomeUrl : '$kSiteOrigin${paths[index]}';
    _controller.loadRequest(Uri.parse(target));
  }

  void _openOfferLink(String link) {
    setState(() {
      _nativeTab = null;
    });
    _controller.loadRequest(Uri.parse(link));
  }

  Future<bool> _handleBack() async {
    if (_nativeTab != null) {
      setState(() {
        _nativeTab = null;
      });
      return false;
    }
    if (await _controller.canGoBack()) {
      await _controller.goBack();
      return false;
    }
    return true;
  }

  void _retryLoad() {
    setState(() {
      _hasError = false;
      _errorDescription = null;
      _isNavigating = true;
      _progress = 0;
      _showSplash = false;
    });
    _controller.loadRequest(Uri.parse(kHomeUrl));
  }

  Future<void> _scheduleSplashHide() async {
    final elapsed = DateTime.now().difference(_splashStart);
    final remaining = _minSplashDuration - elapsed;
    if (remaining > Duration.zero) {
      await Future.delayed(remaining);
    }
    if (!mounted) {
      return;
    }
    setState(() {
      _showSplash = false;
    });
    _splashController.stop();
  }

  Future<void> _initFcm() async {
    if (!firebaseSupported) return;
    final messaging = FirebaseMessaging.instance;
    await messaging.requestPermission(alert: true, badge: true, sound: true);
    _fcmToken = await messaging.getToken();
    messaging.onTokenRefresh.listen((token) { _fcmToken = token; });
    FirebaseMessaging.onMessageOpenedApp.listen((message) {
      final url = message.data['url'] as String?;
      if (url != null && mounted) _controller.loadRequest(Uri.parse(url));
    });
  }

  Future<void> _injectFcmBridge() async {
    try {
      await _controller.runJavaScript('''
(function() {
  var t = localStorage.getItem('dd_token');
  if (t && window.FcmTokenBridge) { window.FcmTokenBridge.postMessage(t); }
})();
''');
    } catch (_) {}
  }

  Future<void> _saveFcmToken(String authToken) async {
    if (_fcmToken == null || authToken.isEmpty) return;
    try {
      await http.post(
        Uri.parse('https://damndeal.in/api/user/fcm-token'),
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer $authToken',
        },
        body: jsonEncode({'fcmToken': _fcmToken}),
      );
    } catch (_) {}
  }

  @override
  void dispose() {
    _splashController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final activeTab = _nativeTab ?? _tabForUrl(_currentUrl);
    return WillPopScope(
      onWillPop: _handleBack,
      child: Scaffold(
        backgroundColor: _innerStatusBarColor,
        bottomNavigationBar: !_showSplash && activeTab != null
            ? _buildBottomNav(activeTab)
            : null,
        body: SafeArea(
          top: false,
          child: Column(
            children: [
              if (_useTopInset)
                Container(
                  height: MediaQuery.of(context).padding.top,
                  color: _innerStatusBarColor,
                ),
              Expanded(
                child: Stack(
                  children: [
                    LayoutBuilder(
                      builder: (context, constraints) {
                        return ClipRect(
                          child: OverflowBox(
                            maxWidth:
                                constraints.maxWidth + _scrollbarMaskWidth,
                            maxHeight: constraints.maxHeight,
                            alignment: Alignment.centerLeft,
                            child: SizedBox(
                              width: constraints.maxWidth + _scrollbarMaskWidth,
                              height: constraints.maxHeight,
                              child: WebViewWidget(controller: _controller),
                            ),
                          ),
                        );
                      },
                    ),
                    if (!_showSplash && _isNavigating && !_hasError && _progress < 1.0)
                      Positioned(
                        left: 0,
                        right: 0,
                        top: 0,
                        child: LinearProgressIndicator(value: _progress),
                      ),
                    if (!_showSplash && _isNavigating && !_hasError)
                      const Positioned.fill(
                        child: IgnorePointer(
                          child: ColoredBox(
                            color: Color(0x11FFFFFF),
                            child: Center(child: CircularProgressIndicator()),
                          ),
                        ),
                      ),
                    if (_showSplash)
                      Positioned.fill(
                        child: Container(
                          color: Colors.white,
                          alignment: Alignment.center,
                          child: ScaleTransition(
                            scale: _splashScale,
                            child: Image.asset(
                              'assets/logo.webp',
                              width: 140,
                              fit: BoxFit.contain,
                            ),
                          ),
                        ),
                      ),
                    if (_hasError) _buildErrorOverlay(context),
                    if (_nativeTab == 1)
                      Positioned.fill(
                        child: CategoriesScreen(
                          baseUrl: kSiteOrigin,
                          region: kRegion,
                          accent: _homeStatusBarColor,
                          onOpenLink: _openOfferLink,
                        ),
                      ),
                    if (_nativeTab == 2)
                      Positioned.fill(
                        child: OffersScreen(
                          baseUrl: kSiteOrigin,
                          region: kRegion,
                          accent: _homeStatusBarColor,
                          embedded: true,
                          onOpenLink: _openOfferLink,
                        ),
                      ),
                  ],
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildBottomNav(int activeIndex) {
    return Container(
      decoration: const BoxDecoration(
        color: Colors.white,
        border: Border(top: BorderSide(color: Color(0xFFE5E7EB))),
      ),
      child: BottomNavigationBar(
        currentIndex: activeIndex,
        onTap: _onTabTap,
        type: BottomNavigationBarType.fixed,
        backgroundColor: Colors.white,
        elevation: 0,
        selectedItemColor: _homeStatusBarColor,
        unselectedItemColor: const Color(0xFF9CA3AF),
        selectedFontSize: 10.5,
        unselectedFontSize: 10.5,
        iconSize: 22,
        items: const [
          BottomNavigationBarItem(
            icon: Icon(Icons.home_outlined),
            activeIcon: Icon(Icons.home),
            label: 'Home',
          ),
          BottomNavigationBarItem(
            icon: Icon(Icons.grid_view_outlined),
            activeIcon: Icon(Icons.grid_view_rounded),
            label: 'Categories',
          ),
          BottomNavigationBarItem(
            icon: Icon(Icons.local_offer_outlined),
            activeIcon: Icon(Icons.local_offer),
            label: 'Offers',
          ),
          BottomNavigationBarItem(
            icon: Icon(Icons.shopping_cart_outlined),
            activeIcon: Icon(Icons.shopping_cart),
            label: 'Cart',
          ),
          BottomNavigationBarItem(
            icon: Icon(Icons.person_outline),
            activeIcon: Icon(Icons.person),
            label: 'Account',
          ),
        ],
      ),
    );
  }

  Widget _buildErrorOverlay(BuildContext context) {
    return Positioned.fill(
      child: Container(
        color: const Color(0xFFF8F6F2),
        alignment: Alignment.center,
        padding: const EdgeInsets.symmetric(horizontal: 32),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const Icon(
              Icons.wifi_off,
              size: 48,
              color: Color(0xFF8D8A85),
            ),
            const SizedBox(height: 12),
            Text(
              'Unable to load Damndeal',
              style: Theme.of(context).textTheme.titleMedium,
              textAlign: TextAlign.center,
            ),
            if (_errorDescription != null) ...[
              const SizedBox(height: 8),
              Text(
                _errorDescription!,
                style: Theme.of(context).textTheme.bodySmall,
                textAlign: TextAlign.center,
              ),
            ],
            const SizedBox(height: 16),
            ElevatedButton(
              onPressed: _retryLoad,
              child: const Text('Retry'),
            ),
          ],
        ),
      ),
    );
  }
}
