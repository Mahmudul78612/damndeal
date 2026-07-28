import 'dart:io';
import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:shared_preferences/shared_preferences.dart';
import '../../services/auth_service.dart';
import '../../services/app_config_service.dart';

class SplashScreen extends StatefulWidget {
  const SplashScreen({super.key});

  @override
  State<SplashScreen> createState() => _SplashScreenState();
}

class _SplashScreenState extends State<SplashScreen>
    with TickerProviderStateMixin {
  // Logo 1 (DamnDeal) bounce
  late AnimationController _logo1Controller;
  late Animation<double> _logo1Scale;
  late Animation<double> _logo1Opacity;

  // Logo 2 (DealGo) bounce
  late AnimationController _logo2Controller;
  late Animation<double> _logo2Scale;
  late Animation<double> _logo2Opacity;

  // Loading bar
  late AnimationController _loadingController;

  bool _showLogo1 = true;
  bool _showLogo2 = false;
  bool _isLogo1 = true;

  @override
  void initState() {
    super.initState();

    // Logo 1 — bounce in
    _logo1Controller = AnimationController(
      duration: const Duration(milliseconds: 700),
      vsync: this,
    );
    _logo1Scale = TweenSequence<double>([
      TweenSequenceItem(tween: Tween(begin: 0.0, end: 1.2).chain(CurveTween(curve: Curves.easeOut)), weight: 50),
      TweenSequenceItem(tween: Tween(begin: 1.2, end: 0.9).chain(CurveTween(curve: Curves.easeInOut)), weight: 25),
      TweenSequenceItem(tween: Tween(begin: 0.9, end: 1.0).chain(CurveTween(curve: Curves.easeOut)), weight: 25),
    ]).animate(_logo1Controller);
    _logo1Opacity = Tween(begin: 0.0, end: 1.0).animate(
      CurvedAnimation(parent: _logo1Controller, curve: const Interval(0.0, 0.3, curve: Curves.easeIn)),
    );

    // Logo 2 — bounce in
    _logo2Controller = AnimationController(
      duration: const Duration(milliseconds: 700),
      vsync: this,
    );
    _logo2Scale = TweenSequence<double>([
      TweenSequenceItem(tween: Tween(begin: 0.0, end: 1.2).chain(CurveTween(curve: Curves.easeOut)), weight: 50),
      TweenSequenceItem(tween: Tween(begin: 1.2, end: 0.9).chain(CurveTween(curve: Curves.easeInOut)), weight: 25),
      TweenSequenceItem(tween: Tween(begin: 0.9, end: 1.0).chain(CurveTween(curve: Curves.easeOut)), weight: 25),
    ]).animate(_logo2Controller);
    _logo2Opacity = Tween(begin: 0.0, end: 1.0).animate(
      CurvedAnimation(parent: _logo2Controller, curve: const Interval(0.0, 0.3, curve: Curves.easeIn)),
    );

    // Loading bar — 3.6 seconds total (4 transitions × 900ms)
    _loadingController = AnimationController(
      duration: const Duration(milliseconds: 3600),
      vsync: this,
    );

    _startSequence();
  }

  void _startSequence() async {
    _loadingController.forward();

    // 1st: DamnDeal (already showing)
    _logo1Controller.forward();
    await Future.delayed(const Duration(milliseconds: 900));
    if (!mounted) return;

    // 2nd: DealGo
    setState(() { _showLogo1 = false; _showLogo2 = true; _isLogo1 = false; });
    _logo2Controller.forward();
    await Future.delayed(const Duration(milliseconds: 900));
    if (!mounted) return;

    // 3rd: DamnDeal again
    _logo1Controller.reset();
    setState(() { _showLogo1 = true; _showLogo2 = false; _isLogo1 = true; });
    _logo1Controller.forward();
    await Future.delayed(const Duration(milliseconds: 900));
    if (!mounted) return;

    // 4th: DealGo again
    _logo2Controller.reset();
    setState(() { _showLogo1 = false; _showLogo2 = true; _isLogo1 = false; });
    _logo2Controller.forward();
    await Future.delayed(const Duration(milliseconds: 900));
    if (!mounted) return;

    _navigateNext();
  }

  @override
  void dispose() {
    _logo1Controller.dispose();
    _logo2Controller.dispose();
    _loadingController.dispose();
    super.dispose();
  }

  Future<void> _navigateNext() async {
    if (!mounted) return;

    // Load remote app config
    final appConfig = context.read<AppConfigService>();
    await appConfig.load();
    if (!mounted) return;

    // Check maintenance mode
    if (appConfig.isMaintenance) {
      Navigator.pushReplacementNamed(context, '/maintenance', arguments: {
        'message': appConfig.maintenanceMessage,
      });
      return;
    }

    // Check force update
    if (appConfig.isForceUpdateEnabled) {
      const currentVersion = '1.0.0';
      final minVersion = Platform.isIOS
          ? appConfig.minVersionIos
          : appConfig.minVersionAndroid;

      if (AppConfigService.needsUpdate(currentVersion, minVersion)) {
        final storeUrl = Platform.isIOS
            ? appConfig.appStoreUrl
            : appConfig.playStoreUrl;
        Navigator.pushReplacementNamed(context, '/force-update', arguments: {
          'storeUrl': storeUrl,
        });
        return;
      }
    }

    final auth = context.read<AuthService>();
    await auth.init();
    if (!mounted) return;

    if (auth.isLoggedIn) {
      if (auth.isProfileComplete) {
        Navigator.pushReplacementNamed(context, '/main');
      } else {
        Navigator.pushReplacementNamed(context, '/complete-profile');
      }
    } else {
      // Show onboarding only on first ever launch
      final prefs = await SharedPreferences.getInstance();
      final onboardingDone = prefs.getBool('onboarding_done') ?? false;
      if (!mounted) return;
      Navigator.pushReplacementNamed(
          context, onboardingDone ? '/login' : '/onboarding');
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Colors.white,
      body: Center(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            const Spacer(flex: 3),

            // Logo area
            SizedBox(
              height: 120,
              width: 260,
              child: Stack(
                alignment: Alignment.center,
                children: [
                  // Logo 1 — DamnDeal
                  if (_showLogo1)
                    AnimatedBuilder(
                      listenable: _logo1Controller,
                      builder: (context, _) {
                        return Opacity(
                          opacity: _logo1Opacity.value,
                          child: Transform.scale(
                            scale: _logo1Scale.value,
                            child: Image.asset(
                              'assets/logo.webp',
                              height: 100,
                              fit: BoxFit.contain,
                            ),
                          ),
                        );
                      },
                    ),

                  // Logo 2 — DealGo
                  if (_showLogo2)
                    AnimatedBuilder(
                      listenable: _logo2Controller,
                      builder: (context, _) {
                        return Opacity(
                          opacity: _logo2Opacity.value,
                          child: Transform.scale(
                            scale: _logo2Scale.value,
                            child: Image.asset(
                              'assets/dealgo.png',
                              height: 100,
                              fit: BoxFit.contain,
                            ),
                          ),
                        );
                      },
                    ),
                ],
              ),
            ),

            const SizedBox(height: 48),

            // Loading bar
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 80),
              child: AnimatedBuilder(
                listenable: _loadingController,
                builder: (context, _) {
                  return Column(
                    children: [
                      ClipRRect(
                        borderRadius: BorderRadius.circular(4),
                        child: LinearProgressIndicator(
                          value: _loadingController.value,
                          minHeight: 4,
                          backgroundColor: Colors.grey.shade200,
                          valueColor: AlwaysStoppedAnimation<Color>(
                            _isLogo1
                                ? const Color(0xFF7C3AED) // DamnDeal purple
                                : const Color(0xFF0D7A30), // DealGo green
                          ),
                        ),
                      ),
                      const SizedBox(height: 12),
                      Text(
                        'Loading...',
                        style: TextStyle(
                          fontSize: 12,
                          color: Colors.grey.shade500,
                          letterSpacing: 1,
                        ),
                      ),
                    ],
                  );
                },
              ),
            ),

            const Spacer(flex: 3),

            // Bottom company name
            Text(
              'Damndeal India Private Limited',
              style: TextStyle(
                fontSize: 11,
                color: Colors.grey.shade500,
                letterSpacing: 0.5,
              ),
            ),
            const SizedBox(height: 32),
          ],
        ),
      ),
    );
  }
}

class AnimatedBuilder extends AnimatedWidget {
  final Widget Function(BuildContext, Widget?) builder;
  const AnimatedBuilder({super.key, required super.listenable, required this.builder});

  @override
  Widget build(BuildContext context) => builder(context, null);
}
