import 'package:flutter/material.dart';
import 'damnpay.dart';

/// Ready-made "Pay Bills" button — drop into any app
///
/// ```dart
/// DamnPayButton(
///   phone: '9876543210', // logged-in user's phone
/// )
/// ```
class DamnPayButton extends StatefulWidget {
  /// The logged-in user's phone number (10 digits)
  final String phone;

  /// Custom label (default: "Pay Bills")
  final String label;

  /// Custom icon
  final IconData icon;

  /// Called when login/auth fails
  final void Function(Object error)? onError;

  const DamnPayButton({
    super.key,
    required this.phone,
    this.label = 'Pay Bills',
    this.icon = Icons.receipt_long,
    this.onError,
  });

  @override
  State<DamnPayButton> createState() => _DamnPayButtonState();
}

class _DamnPayButtonState extends State<DamnPayButton> {
  bool _loading = false;

  Future<void> _handleTap() async {
    if (_loading) return;

    setState(() => _loading = true);

    try {
      // Auto-login if not already logged in
      if (!DamnPay.isLoggedIn) {
        await DamnPay.login(phone: widget.phone);
      }

      if (!mounted) return;
      DamnPay.openBillPay(context);
    } catch (e) {
      if (widget.onError != null) {
        widget.onError!(e);
      } else if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('DamnPay: ${e.toString()}')),
        );
      }
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return FilledButton.icon(
      onPressed: _loading ? null : _handleTap,
      style: FilledButton.styleFrom(
        backgroundColor: const Color(0xFF7C3AED),
        foregroundColor: Colors.white,
        padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 14),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
      ),
      icon: _loading
          ? const SizedBox(
              width: 18,
              height: 18,
              child: CircularProgressIndicator(
                strokeWidth: 2,
                color: Colors.white,
              ),
            )
          : Icon(widget.icon),
      label: Text(
        _loading ? 'Loading...' : widget.label,
        style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 15),
      ),
    );
  }
}
