import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:damnpay_sdk/damnpay_sdk.dart';
import '../../services/auth_service.dart';
import '../../theme/app_theme.dart';

/// BillPay tab — opens DamnPay SDK as a WebView.
class BillPayScreen extends StatefulWidget {
  const BillPayScreen({super.key});

  @override
  State<BillPayScreen> createState() => _BillPayScreenState();
}

class _BillPayScreenState extends State<BillPayScreen> {
  bool _opening = false;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) => _openSDK());
  }

  Future<void> _openSDK() async {
    if (_opening) return;
    _opening = true;
    try {
      final phone = context.read<AuthService>().userPhone;
      if (!DamnPay.isLoggedIn && phone.isNotEmpty) {
        await DamnPay.login(phone: phone);
      }
      final url = await DamnPay.getWebUrl();
      if (!mounted) return;
      await Navigator.of(context).push(
        MaterialPageRoute(builder: (_) => DamnPayWebView(url: url)),
      );
    } catch (e) {
      debugPrint('[DamnPay] openSDK error: $e');
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
              content: Text(
                  'BillPay: ${e.toString().replaceAll('Exception: ', '')}')),
        );
      }
    }
    _opening = false;
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Colors.white,
      appBar: AppBar(
        title: const Text('Bill Pay',
            style: TextStyle(fontWeight: FontWeight.w800, color: AppColors.textPrimary)),
        backgroundColor: Colors.white,
        elevation: 0.5,
        foregroundColor: AppColors.textPrimary,
        actions: [
          IconButton(
            icon: const Icon(Icons.refresh_rounded),
            tooltip: 'Reopen',
            onPressed: _openSDK,
          ),
        ],
      ),
      body: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          children: [
            Container(
                height: 60,
                width: double.infinity,
                decoration: BoxDecoration(
                    color: Colors.grey[200],
                    borderRadius: BorderRadius.circular(16))),
            const SizedBox(height: 24),
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceEvenly,
              children: List.generate(
                  3,
                  (_) => Column(children: [
                        Container(
                            width: 52,
                            height: 52,
                            decoration: BoxDecoration(
                                color: Colors.grey[200],
                                borderRadius: BorderRadius.circular(16))),
                        const SizedBox(height: 8),
                        Container(
                            width: 50,
                            height: 10,
                            decoration: BoxDecoration(
                                color: Colors.grey[200],
                                borderRadius: BorderRadius.circular(4))),
                      ])),
            ),
            const SizedBox(height: 28),
            Align(
              alignment: Alignment.centerLeft,
              child: Container(
                  width: 120,
                  height: 14,
                  decoration: BoxDecoration(
                      color: Colors.grey[200],
                      borderRadius: BorderRadius.circular(4))),
            ),
            const SizedBox(height: 14),
            GridView.count(
              crossAxisCount: 4,
              shrinkWrap: true,
              physics: const NeverScrollableScrollPhysics(),
              mainAxisSpacing: 14,
              crossAxisSpacing: 14,
              childAspectRatio: 0.8,
              children: List.generate(
                  8,
                  (_) => Column(children: [
                        Container(
                            width: 52,
                            height: 52,
                            decoration: BoxDecoration(
                                color: Colors.grey[200],
                                borderRadius: BorderRadius.circular(16))),
                        const SizedBox(height: 8),
                        Container(
                            width: 44,
                            height: 10,
                            decoration: BoxDecoration(
                                color: Colors.grey[200],
                                borderRadius: BorderRadius.circular(4))),
                      ])),
            ),
          ],
        ),
      ),
    );
  }
}
