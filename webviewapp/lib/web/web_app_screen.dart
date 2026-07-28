import 'dart:convert';

import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:http/http.dart' as http;
import 'package:share_plus/share_plus.dart';
import 'package:url_launcher/url_launcher.dart';
import 'package:webview_flutter/webview_flutter.dart';

import '../main.dart' show firebaseSupported;

const String kHomeUrl = 'https://damndeal.in/';
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
    if (nextInset == _useTopInset) {
      return;
    }
    setState(() {
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

  Future<bool> _handleBack() async {
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
    return WillPopScope(
      onWillPop: _handleBack,
      child: Scaffold(
        backgroundColor: _innerStatusBarColor,
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
                  ],
                ),
              ),
            ],
          ),
        ),
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
