import 'package:flutter/material.dart';
import 'package:pin_code_fields/pin_code_fields.dart';
import 'package:provider/provider.dart';
import '../theme.dart';
import '../services/auth_service.dart';
import '../services/api_service.dart';
import 'onboarding_screen.dart';
import 'home_screen.dart';

class LoginScreen extends StatefulWidget {
  const LoginScreen({super.key});
  @override
  State<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends State<LoginScreen> {
  final _phoneCtrl = TextEditingController();
  String _otp = '';
  int _step = 0; // 0=phone, 1=otp
  bool _loading = false;
  String? _error;
  String _phone = '';

  @override
  void dispose() {
    _phoneCtrl.dispose();
    super.dispose();
  }

  Future<void> _sendOtp() async {
    final phone = _phoneCtrl.text.trim();
    if (!RegExp(r'^\d{10}$').hasMatch(phone)) {
      setState(() => _error = 'Enter valid 10-digit number');
      return;
    }
    setState(() { _loading = true; _error = null; _phone = phone; });
    try {
      await context.read<AuthService>().sendOtp(phone);
      setState(() => _step = 1);
    } catch (e) {
      setState(() => _error = e.toString());
    }
    setState(() => _loading = false);
  }

  Future<void> _verifyOtp() async {
    if (_otp.length < 6) {
      setState(() => _error = 'Enter full 6-digit OTP');
      return;
    }
    setState(() { _loading = true; _error = null; });
    try {
      final auth = context.read<AuthService>();
      await auth.verifyOtp(_phone, _otp);

      if (!mounted) return;

      // Check if new user or profile missing
      bool needsOnboarding = auth.isNewUser;
      if (!needsOnboarding) {
        try {
          await ApiService().get('/delivery/profile');
        } catch (_) {
          needsOnboarding = true;
        }
      }

      if (needsOnboarding) {
        Navigator.pushReplacement(context, MaterialPageRoute(builder: (_) => OnboardingScreen(phone: _phone)));
      } else {
        Navigator.pushReplacement(context, MaterialPageRoute(builder: (_) => const HomeScreen()));
      }
    } catch (e) {
      setState(() => _error = e.toString());
    }
    setState(() => _loading = false);
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: Container(
        decoration: const BoxDecoration(
          gradient: LinearGradient(
            begin: Alignment.topCenter,
            end: Alignment.center,
            colors: [AppTheme.primaryDark, AppTheme.primary],
          ),
        ),
        child: SafeArea(
          child: Column(
            children: [
              const SizedBox(height: 48),
              // Logo
              RichText(
                text: const TextSpan(
                  style: TextStyle(fontSize: 30, fontWeight: FontWeight.w800),
                  children: [
                    TextSpan(text: 'Damn', style: TextStyle(color: Colors.white)),
                    TextSpan(text: 'Deal', style: TextStyle(color: AppTheme.accent)),
                  ],
                ),
              ),
              const SizedBox(height: 4),
              Text('Delivery Partner', style: TextStyle(color: Colors.white.withValues(alpha: 0.6), fontSize: 14)),
              const SizedBox(height: 40),
              // Card
              Expanded(
                child: Container(
                  width: double.infinity,
                  decoration: const BoxDecoration(
                    color: Colors.white,
                    borderRadius: BorderRadius.only(topLeft: Radius.circular(24), topRight: Radius.circular(24)),
                  ),
                  padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 28),
                  child: SingleChildScrollView(
                    child: _step == 0 ? _phoneStep() : _otpStep(),
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _phoneStep() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const Text('Login', style: TextStyle(fontSize: 20, fontWeight: FontWeight.w700)),
        const SizedBox(height: 4),
        const Text('Enter your phone number to get started', style: TextStyle(color: AppTheme.textLight, fontSize: 13)),
        const SizedBox(height: 24),
        if (_error != null) _errorBox(),
        TextField(
          controller: _phoneCtrl,
          keyboardType: TextInputType.phone,
          maxLength: 10,
          decoration: const InputDecoration(
            labelText: 'Phone Number',
            hintText: '10 digit mobile number',
            prefixText: '+91  ',
            counterText: '',
          ),
          onSubmitted: (_) => _sendOtp(),
        ),
        const SizedBox(height: 20),
        SizedBox(
          width: double.infinity,
          child: ElevatedButton(
            onPressed: _loading ? null : _sendOtp,
            child: _loading
                ? const SizedBox(height: 20, width: 20, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white))
                : const Text('Send OTP'),
          ),
        ),
      ],
    );
  }

  Widget _otpStep() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const Text('Verify OTP', style: TextStyle(fontSize: 20, fontWeight: FontWeight.w700)),
        const SizedBox(height: 4),
        Text('Enter the 6-digit code sent to +91 $_phone', style: const TextStyle(color: AppTheme.textLight, fontSize: 13)),
        const SizedBox(height: 24),
        if (_error != null) _errorBox(),
        PinCodeTextField(
          appContext: context,
          length: 6,
          keyboardType: TextInputType.number,
          animationType: AnimationType.fade,
          pinTheme: PinTheme(
            shape: PinCodeFieldShape.box,
            borderRadius: BorderRadius.circular(10),
            fieldHeight: 48,
            fieldWidth: 44,
            activeFillColor: Colors.white,
            inactiveFillColor: Colors.white,
            selectedFillColor: Colors.white,
            activeColor: AppTheme.primary,
            inactiveColor: AppTheme.border,
            selectedColor: AppTheme.primary,
          ),
          enableActiveFill: true,
          onChanged: (v) => _otp = v,
          onCompleted: (_) => _verifyOtp(),
        ),
        const SizedBox(height: 16),
        SizedBox(
          width: double.infinity,
          child: ElevatedButton(
            onPressed: _loading ? null : _verifyOtp,
            child: _loading
                ? const SizedBox(height: 20, width: 20, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white))
                : const Text('Verify & Login'),
          ),
        ),
        const SizedBox(height: 12),
        Center(
          child: TextButton(
            onPressed: _sendOtp,
            child: const Text('Resend OTP', style: TextStyle(fontSize: 13)),
          ),
        ),
        Center(
          child: TextButton(
            onPressed: () => setState(() { _step = 0; _error = null; }),
            child: const Text('← Change number', style: TextStyle(fontSize: 13, color: AppTheme.textLight)),
          ),
        ),
      ],
    );
  }

  Widget _errorBox() {
    return Container(
      width: double.infinity,
      margin: const EdgeInsets.only(bottom: 14),
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(color: AppTheme.dangerBg, borderRadius: BorderRadius.circular(8)),
      child: Text(_error!, style: const TextStyle(color: Color(0xFF991B1B), fontSize: 13), textAlign: TextAlign.center),
    );
  }
}
