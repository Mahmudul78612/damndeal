import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:url_launcher/url_launcher.dart';
import 'package:webview_flutter/webview_flutter.dart';

/// WebView that opens damnpay.in with auto-login
/// User gets full access to recharge, bill pay, etc.
class DamnPayWebView extends StatefulWidget {
  final String url;

  const DamnPayWebView({
    super.key,
    required this.url,
  });

  @override
  State<DamnPayWebView> createState() => _DamnPayWebViewState();
}

class _DamnPayWebViewState extends State<DamnPayWebView> {
  late final WebViewController _controller;
  bool _loading = true;
  int _progress = 0;
  Color _statusBarColor = const Color(0xFF4A1A6B);

  @override
  void initState() {
    super.initState();
    _controller = WebViewController()
      ..setJavaScriptMode(JavaScriptMode.unrestricted)
      ..setNavigationDelegate(
        NavigationDelegate(
          onPageStarted: (url) {
            debugPrint('[DamnPay WebView] Page started: $url');
            if (mounted) setState(() => _loading = true);
          },
          onPageFinished: (url) {
            debugPrint('[DamnPay WebView] Page finished: $url');
            if (mounted) setState(() => _loading = false);
            _extractTopColor();
          },
          onProgress: (progress) {
            if (mounted) setState(() => _progress = progress);
          },
          onNavigationRequest: (request) {
            debugPrint('[DamnPay WebView] Nav request: ${request.url}');
            final url = request.url;

            // Handle UPI intent URLs — launch externally
            if (url.startsWith('upi://') ||
                url.startsWith('tez://') ||
                url.startsWith('phonepe://') ||
                url.startsWith('paytmmp://') ||
                url.startsWith('gpay://') ||
                url.startsWith('bhim://')) {
              debugPrint('[DamnPay WebView] Launching UPI: $url');
              launchUrl(Uri.parse(url), mode: LaunchMode.externalApplication);
              return NavigationDecision.prevent;
            }

            // Handle intent:// URLs (Android payment intents)
            if (url.startsWith('intent://')) {
              debugPrint('[DamnPay WebView] Launching intent: $url');
              // Extract fallback URL from intent if available
              final fallbackMatch = RegExp(r'S\.browser_fallback_url=([^;]+)').firstMatch(url);
              if (fallbackMatch != null) {
                final fallbackUrl = Uri.decodeFull(fallbackMatch.group(1)!);
                launchUrl(Uri.parse(fallbackUrl), mode: LaunchMode.externalApplication);
              } else {
                launchUrl(Uri.parse(url), mode: LaunchMode.externalApplication);
              }
              return NavigationDecision.prevent;
            }

            final uri = Uri.tryParse(url);
            if (uri != null) {
              // Allow whitelisted domains
              final host = uri.host.toLowerCase();
              if (host.contains('damnpay') ||
                  host.contains('razorpay') ||
                  host.contains('billdesk') ||
                  host.contains('zaakpay') ||
                  host.contains('paytm') ||
                  host.contains('phonepe') ||
                  host.contains('upi') ||
                  host.contains('googleapis') ||
                  host.contains('firebaseapp') ||
                  host.contains('run.app') ||
                  host.isEmpty) {
                return NavigationDecision.navigate;
              }
            }
            debugPrint('[DamnPay WebView] BLOCKED: $url');
            return NavigationDecision.prevent;
          },
        ),
      )
      ..loadRequest(Uri.parse(widget.url));
  }

  Future<void> _extractTopColor() async {
    try {
      final result = await _controller.runJavaScriptReturningResult('''
        (function() {
          // Try meta theme-color first
          var meta = document.querySelector('meta[name="theme-color"]');
          if (meta && meta.content) return meta.content;
          // Try top-most visible element's background
          var el = document.elementFromPoint(window.innerWidth / 2, 0);
          while (el) {
            var bg = window.getComputedStyle(el).backgroundColor;
            if (bg && bg !== 'rgba(0, 0, 0, 0)' && bg !== 'transparent') return bg;
            el = el.parentElement;
          }
          // Fallback: body background
          return window.getComputedStyle(document.body).backgroundColor;
        })()
      ''');
      final colorStr = result.toString().replaceAll('"', '').replaceAll("'", '');
      final parsed = _parseColor(colorStr);
      if (parsed != null && mounted) {
        setState(() => _statusBarColor = parsed);
      }
    } catch (e) {
      debugPrint('[DamnPay WebView] Color extract error: $e');
    }
  }

  Color? _parseColor(String str) {
    // Hex format: #RRGGBB or #RGB
    if (str.startsWith('#')) {
      var hex = str.substring(1);
      if (hex.length == 3) hex = '${hex[0]}${hex[0]}${hex[1]}${hex[1]}${hex[2]}${hex[2]}';
      if (hex.length == 6) return Color(0xFF000000 | int.parse(hex, radix: 16));
    }
    // rgb(r, g, b) or rgba(r, g, b, a)
    final rgbMatch = RegExp(r'rgba?\((\d+),\s*(\d+),\s*(\d+)').firstMatch(str);
    if (rgbMatch != null) {
      final r = int.parse(rgbMatch.group(1)!);
      final g = int.parse(rgbMatch.group(2)!);
      final b = int.parse(rgbMatch.group(3)!);
      if (r == 0 && g == 0 && b == 0) return null; // Skip transparent/black
      return Color.fromARGB(255, r, g, b);
    }
    return null;
  }

  @override
  Widget build(BuildContext context) {
    final brightness = ThemeData.estimateBrightnessForColor(_statusBarColor);
    return AnnotatedRegion<SystemUiOverlayStyle>(
      value: SystemUiOverlayStyle(
        statusBarColor: _statusBarColor,
        statusBarIconBrightness: brightness == Brightness.dark ? Brightness.light : Brightness.dark,
        statusBarBrightness: brightness,
      ),
      child: PopScope(
        canPop: false,
        onPopInvokedWithResult: (didPop, _) async {
          if (didPop) return;
          if (await _controller.canGoBack()) {
            await _controller.goBack();
            _extractTopColor();
          } else {
            if (context.mounted) Navigator.of(context).pop();
          }
        },
        child: Scaffold(
          body: Column(
            children: [
              Container(
                color: _statusBarColor,
                height: MediaQuery.of(context).padding.top,
              ),
              Expanded(child: WebViewWidget(controller: _controller)),
            ],
          ),
        ),
      ),
    );
  }
}
