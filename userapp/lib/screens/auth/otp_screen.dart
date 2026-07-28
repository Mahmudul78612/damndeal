import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:pin_code_fields/pin_code_fields.dart';
import '../../services/auth_service.dart';
import '../../theme/app_theme.dart';

class OtpScreen extends StatefulWidget {
  const OtpScreen({super.key});

  @override
  State<OtpScreen> createState() => _OtpScreenState();
}

class _OtpScreenState extends State<OtpScreen> {
  String _otp = '';
  String? _error;

  Future<void> _verify() async {
    final phone = ModalRoute.of(context)!.settings.arguments as String;
    if (_otp.length != 6) {
      setState(() => _error = 'Enter the 6-digit OTP');
      return;
    }
    setState(() => _error = null);
    final auth = context.read<AuthService>();
    try {
      final res = await auth.verifyOtp(phone, _otp);
      if (!mounted) return;
      if (res['success'] == true) {
        if (auth.isProfileComplete) {
          Navigator.pushNamedAndRemoveUntil(context, '/main', (_) => false);
        } else {
          Navigator.pushNamedAndRemoveUntil(
              context, '/complete-profile', (_) => false);
        }
      }
    } catch (e) {
      setState(() => _error = e.toString());
    }
  }

  Future<void> _resend() async {
    final phone = ModalRoute.of(context)!.settings.arguments as String;
    final auth = context.read<AuthService>();
    try {
      await auth.sendOtp(phone);
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
            content: Text('OTP sent again'),
            backgroundColor: AppColors.success),
      );
    } catch (e) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
            content: Text(e.toString()),
            backgroundColor: AppColors.error),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    final phone = ModalRoute.of(context)!.settings.arguments as String;
    final auth = context.watch<AuthService>();
    final bottomPad = MediaQuery.of(context).viewInsets.bottom;

    return Scaffold(
      backgroundColor: Colors.white,
      resizeToAvoidBottomInset: false,
      body: SafeArea(
        child: Column(
          children: [
            // Back button
            Align(
              alignment: Alignment.topLeft,
              child: IconButton(
                onPressed: () => Navigator.maybePop(context),
                icon: const Icon(Icons.arrow_back_ios_new_rounded,
                    size: 20, color: AppColors.textPrimary),
                padding: const EdgeInsets.fromLTRB(16, 12, 16, 4),
              ),
            ),

            Expanded(
              child: SingleChildScrollView(
                padding: const EdgeInsets.fromLTRB(28, 24, 28, 16),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Text(
                      'Verify OTP',
                      style: TextStyle(
                        fontSize: 28,
                        fontWeight: FontWeight.w800,
                        color: AppColors.textPrimary,
                      ),
                    ),
                    const SizedBox(height: 8),
                    RichText(
                      text: TextSpan(
                        style: const TextStyle(
                            fontSize: 14, color: AppColors.textMuted),
                        children: [
                          const TextSpan(text: 'Code sent to '),
                          TextSpan(
                            text: phone,
                            style: const TextStyle(
                                color: AppColors.textPrimary,
                                fontWeight: FontWeight.w600),
                          ),
                        ],
                      ),
                    ),
                    const SizedBox(height: 40),

                    // OTP boxes — underline style
                    PinCodeTextField(
                      appContext: context,
                      length: 6,
                      keyboardType: TextInputType.number,
                      animationType: AnimationType.fade,
                      pinTheme: PinTheme(
                        shape: PinCodeFieldShape.underline,
                        fieldHeight: 52,
                        fieldWidth: 42,
                        activeColor: AppColors.primary,
                        inactiveColor: Colors.grey.shade300,
                        selectedColor: AppColors.primary,
                        activeFillColor: Colors.white,
                        inactiveFillColor: Colors.white,
                        selectedFillColor: Colors.white,
                        borderWidth: 2,
                      ),
                      textStyle: const TextStyle(
                        fontSize: 22,
                        fontWeight: FontWeight.w700,
                        color: AppColors.textPrimary,
                      ),
                      enableActiveFill: true,
                      onChanged: (v) {
                        _otp = v;
                        if (_error != null) setState(() => _error = null);
                      },
                      onCompleted: (_) => _verify(),
                    ),

                    if (_error != null) ...[
                      const SizedBox(height: 8),
                      Text(_error!,
                          style: const TextStyle(
                              color: AppColors.error, fontSize: 12.5)),
                    ],

                    const SizedBox(height: 24),
                    Center(
                      child: TextButton(
                        onPressed: _resend,
                        child: const Text(
                          'Resend OTP',
                          style: TextStyle(
                              color: AppColors.primary,
                              fontWeight: FontWeight.w600,
                              fontSize: 14),
                        ),
                      ),
                    ),
                  ],
                ),
              ),
            ),

            // Sticky verify button
            Padding(
              padding: EdgeInsets.fromLTRB(
                  28, 0, 28, bottomPad > 0 ? bottomPad + 8 : 32),
              child: SizedBox(
                width: double.infinity,
                height: 52,
                child: ElevatedButton(
                  onPressed: auth.isLoading ? null : _verify,
                  style: ElevatedButton.styleFrom(
                    backgroundColor: AppColors.primary,
                    foregroundColor: Colors.white,
                    elevation: 0,
                    shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(12)),
                  ),
                  child: auth.isLoading
                      ? const SizedBox(
                          width: 22, height: 22,
                          child: CircularProgressIndicator(
                              strokeWidth: 2.5, color: Colors.white))
                      : const Text('Verify & Continue',
                          style: TextStyle(
                              fontSize: 16, fontWeight: FontWeight.w700)),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
