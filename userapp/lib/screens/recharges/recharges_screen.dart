import 'package:flutter/material.dart';
import 'package:webview_flutter/webview_flutter.dart';

class RechargesScreen extends StatefulWidget {
  final bool embedded;
  const RechargesScreen({super.key, this.embedded = false});

  @override
  State<RechargesScreen> createState() => _RechargesScreenState();
}

class _RechargesScreenState extends State<RechargesScreen> {
  late final WebViewController _controller;
  bool _loading = true;

  @override
  void initState() {
    super.initState();
    _controller = WebViewController()
      ..setJavaScriptMode(JavaScriptMode.unrestricted)
      ..setNavigationDelegate(NavigationDelegate(
        onPageFinished: (_) {
          if (mounted) setState(() => _loading = false);
        },
        onPageStarted: (_) {
          if (mounted) setState(() => _loading = true);
        },
      ))
      ..loadRequest(Uri.parse('https://damnpay.in'));
  }

  @override
  Widget build(BuildContext context) {
    final body = Stack(
      children: [
        WebViewWidget(controller: _controller),
        if (_loading)
          const Center(child: CircularProgressIndicator(color: Color(0xFFE91E63))),
      ],
    );

    if (widget.embedded) return body;

    return Scaffold(
      appBar: AppBar(
        title: const Text(
          'Recharges & Bills',
          style: TextStyle(fontWeight: FontWeight.w700, fontSize: 18),
        ),
        backgroundColor: const Color(0xFFE91E63),
        foregroundColor: Colors.white,
        elevation: 0,
      ),
      body: body,
    );
  }
}
