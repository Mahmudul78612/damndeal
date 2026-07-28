import 'dart:async';
import 'package:flutter/material.dart';
import '../services/api_service.dart';
import '../theme/app_theme.dart';

class LiveTrackingWidget extends StatefulWidget {
  final String orderId;
  final VoidCallback? onTap;
  final VoidCallback? onDismiss;

  const LiveTrackingWidget({
    super.key,
    required this.orderId,
    this.onTap,
    this.onDismiss,
  });

  @override
  State<LiveTrackingWidget> createState() => _LiveTrackingWidgetState();
}

class _LiveTrackingWidgetState extends State<LiveTrackingWidget>
    with SingleTickerProviderStateMixin {
  final _api = ApiService();
  Map<String, dynamic>? _order;
  Timer? _timer;
  late final AnimationController _pulseCtrl;

  @override
  void initState() {
    super.initState();
    _pulseCtrl = AnimationController(
      vsync: this,
      duration: const Duration(seconds: 2),
    )..repeat(reverse: true);
    _load();
    _timer = Timer.periodic(const Duration(seconds: 15), (_) => _load());
  }

  @override
  void dispose() {
    _timer?.cancel();
    _pulseCtrl.dispose();
    super.dispose();
  }

  Future<void> _load() async {
    try {
      final res = await _api.get('/user/orders/${widget.orderId}');
      if (mounted) setState(() => _order = res['order']);

      final status = _order?['status'] ?? '';
      if (status == 'delivered' || status == 'cancelled') {
        _timer?.cancel();
      }
    } catch (_) {}
  }

  @override
  Widget build(BuildContext context) {
    if (_order == null) return const SizedBox.shrink();

    final status = _order!['status'] ?? '';
    if (status == 'delivered' || status == 'cancelled') {
      return const SizedBox.shrink();
    }

    final info = _statusInfo(status);

    return Positioned(
      left: 16,
      right: 16,
      bottom: 80,
      child: GestureDetector(
        onTap: widget.onTap ??
            () => Navigator.pushNamed(context, '/tracking',
                arguments: widget.orderId),
        child: AnimatedBuilder(
          animation: _pulseCtrl,
          builder: (context, child) {
            return Container(
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
              decoration: BoxDecoration(
                color: Colors.white,
                borderRadius: BorderRadius.circular(16),
                border: Border.all(
                  color: info.color.withValues(alpha: 0.3 + _pulseCtrl.value * 0.2),
                  width: 1.5,
                ),
                boxShadow: [
                  BoxShadow(
                    color: info.color.withValues(alpha: 0.12),
                    blurRadius: 16,
                    offset: const Offset(0, 4),
                  ),
                ],
              ),
              child: child,
            );
          },
          child: Row(
            children: [
              // Animated status icon
              Container(
                width: 44,
                height: 44,
                decoration: BoxDecoration(
                  color: info.color.withValues(alpha: 0.12),
                  borderRadius: BorderRadius.circular(12),
                ),
                child: Icon(info.icon, color: info.color, size: 24),
              ),
              const SizedBox(width: 12),
              // Status text
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Text(
                      info.title,
                      style: TextStyle(
                        fontSize: 14,
                        fontWeight: FontWeight.w700,
                        color: info.color,
                      ),
                    ),
                    const SizedBox(height: 2),
                    Text(
                      info.subtitle,
                      style: const TextStyle(
                        fontSize: 12,
                        color: AppColors.textSecondary,
                      ),
                    ),
                  ],
                ),
              ),
              // Order number & arrow
              Column(
                crossAxisAlignment: CrossAxisAlignment.end,
                mainAxisSize: MainAxisSize.min,
                children: [
                  Text(
                    '#${_order!['orderNumber'] ?? ''}',
                    style: const TextStyle(
                      fontSize: 11,
                      fontWeight: FontWeight.w600,
                      color: AppColors.textMuted,
                    ),
                  ),
                  const SizedBox(height: 2),
                  Icon(Icons.arrow_forward_ios_rounded,
                      size: 14, color: info.color),
                ],
              ),
            ],
          ),
        ),
      ),
    );
  }

  _TrackingInfo _statusInfo(String status) {
    switch (status) {
      case 'placed':
        return _TrackingInfo(
          title: 'Order Placed',
          subtitle: 'Waiting for confirmation...',
          icon: Icons.receipt_long_rounded,
          color: AppColors.accent,
        );
      case 'confirmed':
        return _TrackingInfo(
          title: 'Order Confirmed',
          subtitle: 'Getting your order ready',
          icon: Icons.thumb_up_rounded,
          color: const Color(0xFF3B82F6),
        );
      case 'preparing':
        return _TrackingInfo(
          title: 'Preparing Your Order',
          subtitle: 'Packing your items...',
          icon: Icons.inventory_2_rounded,
          color: AppColors.primary,
        );
      case 'out_for_delivery':
        return _TrackingInfo(
          title: 'On the Way! 🚀',
          subtitle: 'Your order is out for delivery',
          icon: Icons.delivery_dining_rounded,
          color: AppColors.success,
        );
      default:
        return _TrackingInfo(
          title: 'Processing',
          subtitle: 'We\'re working on your order',
          icon: Icons.hourglass_top_rounded,
          color: AppColors.textSecondary,
        );
    }
  }
}

class _TrackingInfo {
  final String title;
  final String subtitle;
  final IconData icon;
  final Color color;

  _TrackingInfo({
    required this.title,
    required this.subtitle,
    required this.icon,
    required this.color,
  });
}
