import 'dart:math';
import 'package:flutter/material.dart';
import '../../theme/app_theme.dart';

class OrderSuccessScreen extends StatefulWidget {
  const OrderSuccessScreen({super.key});

  @override
  State<OrderSuccessScreen> createState() => _OrderSuccessScreenState();
}

class _OrderSuccessScreenState extends State<OrderSuccessScreen>
    with TickerProviderStateMixin {
  late final AnimationController _checkCtrl;
  late final AnimationController _scaleCtrl;
  late final AnimationController _confettiCtrl;
  late final Animation<double> _checkAnim;
  late final Animation<double> _scaleAnim;
  late final Animation<double> _fadeAnim;

  @override
  void initState() {
    super.initState();

    _scaleCtrl = AnimationController(
      duration: const Duration(milliseconds: 600),
      vsync: this,
    );
    _scaleAnim = CurvedAnimation(parent: _scaleCtrl, curve: Curves.elasticOut);

    _checkCtrl = AnimationController(
      duration: const Duration(milliseconds: 800),
      vsync: this,
    );
    _checkAnim = CurvedAnimation(parent: _checkCtrl, curve: Curves.easeInOut);

    _confettiCtrl = AnimationController(
      duration: const Duration(milliseconds: 1500),
      vsync: this,
    );
    _fadeAnim = Tween<double>(begin: 0.0, end: 1.0).animate(
      CurvedAnimation(parent: _confettiCtrl, curve: const Interval(0.0, 0.3)),
    );

    // Sequence: scale circle → draw tick → show confetti & text
    _scaleCtrl.forward().then((_) {
      _checkCtrl.forward().then((_) {
        _confettiCtrl.forward();
      });
    });
  }

  @override
  void dispose() {
    _checkCtrl.dispose();
    _scaleCtrl.dispose();
    _confettiCtrl.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final order =
        ModalRoute.of(context)?.settings.arguments as Map<String, dynamic>?;

    return Scaffold(
      backgroundColor: Colors.white,
      body: SafeArea(
        child: Stack(
          children: [
            // Confetti particles
            AnimatedBuilder(
              animation: _confettiCtrl,
              builder: (context, _) {
                return CustomPaint(
                  size: MediaQuery.of(context).size,
                  painter: _ConfettiPainter(_confettiCtrl.value),
                );
              },
            ),
            // Main content
            Padding(
              padding: const EdgeInsets.all(24),
              child: Column(
                children: [
                  const Spacer(flex: 2),
                  // Animated checkmark circle
                  ScaleTransition(
                    scale: _scaleAnim,
                    child: Container(
                      width: 120,
                      height: 120,
                      decoration: BoxDecoration(
                        shape: BoxShape.circle,
                        gradient: LinearGradient(
                          begin: Alignment.topLeft,
                          end: Alignment.bottomRight,
                          colors: [
                            AppColors.success,
                            AppColors.success.withValues(alpha: 0.8),
                          ],
                        ),
                        boxShadow: [
                          BoxShadow(
                            color: AppColors.success.withValues(alpha: 0.3),
                            blurRadius: 24,
                            spreadRadius: 4,
                          ),
                        ],
                      ),
                      child: AnimatedBuilder(
                        animation: _checkAnim,
                        builder: (context, _) {
                          return CustomPaint(
                            painter: _CheckPainter(_checkAnim.value),
                          );
                        },
                      ),
                    ),
                  ),
                  const SizedBox(height: 32),
                  // Title
                  FadeTransition(
                    opacity: _fadeAnim,
                    child: const Text(
                      'Order Placed! 🎉',
                      style: TextStyle(
                        fontSize: 28,
                        fontWeight: FontWeight.w800,
                        color: AppColors.textPrimary,
                      ),
                    ),
                  ),
                  const SizedBox(height: 8),
                  FadeTransition(
                    opacity: _fadeAnim,
                    child: const Text(
                      'Your order has been placed successfully.\nSit tight, we\'re on it!',
                      textAlign: TextAlign.center,
                      style: TextStyle(
                        fontSize: 15,
                        color: AppColors.textSecondary,
                        height: 1.5,
                      ),
                    ),
                  ),
                  const SizedBox(height: 24),
                  // Order details card
                  if (order != null)
                    FadeTransition(
                      opacity: _fadeAnim,
                      child: Container(
                        width: double.infinity,
                        padding: const EdgeInsets.all(20),
                        decoration: BoxDecoration(
                          color: AppColors.bg,
                          borderRadius: BorderRadius.circular(16),
                          border: Border.all(color: AppColors.border),
                        ),
                        child: Column(
                          children: [
                            if (order['orderNumber'] != null) ...[
                              const Text(
                                'ORDER NUMBER',
                                style: TextStyle(
                                  fontSize: 11,
                                  fontWeight: FontWeight.w600,
                                  color: AppColors.textMuted,
                                  letterSpacing: 1.2,
                                ),
                              ),
                              const SizedBox(height: 6),
                              Text(
                                '#${order['orderNumber']}',
                                style: const TextStyle(
                                  fontSize: 22,
                                  fontWeight: FontWeight.w800,
                                  color: AppColors.primary,
                                ),
                              ),
                            ],
                            if (order['grandTotal'] != null) ...[
                              const SizedBox(height: 12),
                              Container(
                                padding: const EdgeInsets.symmetric(
                                    horizontal: 16, vertical: 8),
                                decoration: BoxDecoration(
                                  color: AppColors.primaryLight,
                                  borderRadius: BorderRadius.circular(10),
                                ),
                                child: Text(
                                  '₹${(order['grandTotal'] as num).toStringAsFixed(0)}',
                                  style: const TextStyle(
                                    fontSize: 20,
                                    fontWeight: FontWeight.w800,
                                    color: AppColors.primaryDark,
                                  ),
                                ),
                              ),
                            ],
                            if (order['estimatedDelivery'] != null) ...[
                              const SizedBox(height: 12),
                              Row(
                                mainAxisAlignment: MainAxisAlignment.center,
                                children: [
                                  const Icon(Icons.timer_outlined,
                                      size: 16, color: AppColors.success),
                                  const SizedBox(width: 6),
                                  Text(
                                    'Est. delivery: ${order['estimatedDelivery']}',
                                    style: const TextStyle(
                                      fontSize: 13,
                                      fontWeight: FontWeight.w600,
                                      color: AppColors.success,
                                    ),
                                  ),
                                ],
                              ),
                            ],
                          ],
                        ),
                      ),
                    ),
                  const Spacer(flex: 3),
                  // Action buttons
                  SizedBox(
                    width: double.infinity,
                    child: ElevatedButton.icon(
                      onPressed: () {
                        if (order?['_id'] != null) {
                          Navigator.pushReplacementNamed(
                              context, '/tracking',
                              arguments: order!['_id']);
                        } else {
                          Navigator.pushNamedAndRemoveUntil(
                              context, '/main', (_) => false);
                        }
                      },
                      icon: const Icon(Icons.local_shipping_rounded, size: 20),
                      label: const Text('Track Order'),
                      style: ElevatedButton.styleFrom(
                        padding: const EdgeInsets.symmetric(vertical: 16),
                      ),
                    ),
                  ),
                  const SizedBox(height: 12),
                  SizedBox(
                    width: double.infinity,
                    child: OutlinedButton(
                      onPressed: () => Navigator.pushNamedAndRemoveUntil(
                          context, '/main', (_) => false),
                      style: OutlinedButton.styleFrom(
                        padding: const EdgeInsets.symmetric(vertical: 16),
                      ),
                      child: const Text('Continue Shopping'),
                    ),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

// Custom painter for animated checkmark
class _CheckPainter extends CustomPainter {
  final double progress;
  _CheckPainter(this.progress);

  @override
  void paint(Canvas canvas, Size size) {
    if (progress == 0) return;
    final paint = Paint()
      ..color = Colors.white
      ..strokeWidth = 5
      ..strokeCap = StrokeCap.round
      ..style = PaintingStyle.stroke;

    final cx = size.width / 2;
    final cy = size.height / 2;

    // Checkmark points relative to center
    final p1 = Offset(cx - 18, cy + 2);
    final p2 = Offset(cx - 4, cy + 16);
    final p3 = Offset(cx + 20, cy - 14);

    final path = Path();
    if (progress <= 0.5) {
      // First half: draw from p1 to p2
      final t = progress * 2;
      path.moveTo(p1.dx, p1.dy);
      path.lineTo(
        p1.dx + (p2.dx - p1.dx) * t,
        p1.dy + (p2.dy - p1.dy) * t,
      );
    } else {
      // Second half: p1 to p2 complete, draw p2 to p3
      final t = (progress - 0.5) * 2;
      path.moveTo(p1.dx, p1.dy);
      path.lineTo(p2.dx, p2.dy);
      path.lineTo(
        p2.dx + (p3.dx - p2.dx) * t,
        p2.dy + (p3.dy - p2.dy) * t,
      );
    }

    canvas.drawPath(path, paint);
  }

  @override
  bool shouldRepaint(_CheckPainter old) => old.progress != progress;
}

// Custom painter for confetti bursts
class _ConfettiPainter extends CustomPainter {
  final double progress;
  final _rng = Random(42);
  _ConfettiPainter(this.progress);

  @override
  void paint(Canvas canvas, Size size) {
    if (progress == 0) return;
    final cx = size.width / 2;
    final startY = size.height * 0.3;

    final colors = [
      AppColors.primary,
      AppColors.success,
      AppColors.accent,
      const Color(0xFFEC4899),
      const Color(0xFF3B82F6),
      const Color(0xFFF97316),
    ];

    for (int i = 0; i < 30; i++) {
      final angle = _rng.nextDouble() * 2 * pi;
      final dist = 40 + _rng.nextDouble() * 160;
      final x = cx + cos(angle) * dist * progress;
      final y = startY + sin(angle) * dist * progress + 50 * progress * progress;
      final opacity = (1.0 - progress).clamp(0.0, 1.0);
      final r = 3.0 + _rng.nextDouble() * 4;

      final paint = Paint()
        ..color = colors[i % colors.length].withValues(alpha: opacity);

      if (i % 3 == 0) {
        // Rectangle confetti
        canvas.save();
        canvas.translate(x, y);
        canvas.rotate(progress * pi * 2 * (i.isEven ? 1 : -1));
        canvas.drawRect(Rect.fromCenter(center: Offset.zero, width: r * 2, height: r), paint);
        canvas.restore();
      } else {
        canvas.drawCircle(Offset(x, y), r, paint);
      }
    }
  }

  @override
  bool shouldRepaint(_ConfettiPainter old) => old.progress != progress;
}
