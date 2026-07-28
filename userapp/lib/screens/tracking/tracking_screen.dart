import 'dart:async';
import 'package:flutter/material.dart';
import 'package:url_launcher/url_launcher.dart';
import '../../services/api_service.dart';
import '../../theme/app_theme.dart';

class TrackingScreen extends StatefulWidget {
  const TrackingScreen({super.key});

  @override
  State<TrackingScreen> createState() => _TrackingScreenState();
}

class _TrackingScreenState extends State<TrackingScreen> {
  final _api = ApiService();
  Map<String, dynamic>? _order;
  bool _loading = true;
  Timer? _timer;

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    if (_order == null) _load();
  }

  Future<void> _load() async {
    final orderId = ModalRoute.of(context)!.settings.arguments as String;
    try {
      final res = await _api.get('/user/orders/$orderId');
      _order = res['order'];
    } catch (_) {}
    if (mounted) setState(() => _loading = false);

    // Auto-refresh every 30 seconds
    _timer?.cancel();
    if (_order != null && !['delivered', 'cancelled'].contains(_order!['status'])) {
      _timer = Timer.periodic(const Duration(seconds: 30), (_) => _load());
    }
  }

  @override
  void dispose() {
    _timer?.cancel();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Track Order')),
      body: _loading
          ? const Center(child: CircularProgressIndicator())
          : _order == null
              ? const Center(child: Text('Order not found'))
              : SingleChildScrollView(
                  padding: const EdgeInsets.all(16),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      // Order header
                      Card(
                        child: Padding(
                          padding: const EdgeInsets.all(16),
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Row(
                                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                                children: [
                                  Text('Order #${_order!['orderNumber'] ?? ''}',
                                      style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w700)),
                                  _statusChip(_order!['status'] ?? ''),
                                ],
                              ),
                              const SizedBox(height: 8),
                              Text('₹${(_order!['grandTotal'] ?? 0).toStringAsFixed(0)}',
                                  style: const TextStyle(fontSize: 22, fontWeight: FontWeight.w800, color: AppColors.primary)),
                            ],
                          ),
                        ),
                      ),
                      const SizedBox(height: 20),

                      // Tracking timeline
                      const Text('Order Status', style: TextStyle(fontSize: 16, fontWeight: FontWeight.w700)),
                      const SizedBox(height: 12),
                      ..._buildTimeline(),

                      const SizedBox(height: 20),

                      // Delivery boy info
                      if (_order!['deliveryBoy'] != null) ...[
                        const Text('Delivery Partner', style: TextStyle(fontSize: 16, fontWeight: FontWeight.w700)),
                        const SizedBox(height: 10),
                        Card(
                          child: ListTile(
                            leading: CircleAvatar(
                              backgroundColor: AppColors.primaryLight,
                              child: const Icon(Icons.delivery_dining_rounded, color: AppColors.primary),
                            ),
                            title: Text(_order!['deliveryBoy']?['name'] ?? 'Delivery Partner',
                                style: const TextStyle(fontWeight: FontWeight.w600)),
                            subtitle: Text(_order!['deliveryBoy']?['phone'] ?? ''),
                          ),
                        ),
                      ],

                      // Courier shipping info
                      if (_order!['shipping'] != null && _order!['shipping']['awb'] != null) ...[
                        const SizedBox(height: 20),
                        const Text('Courier Tracking', style: TextStyle(fontSize: 16, fontWeight: FontWeight.w700)),
                        const SizedBox(height: 10),
                        _buildCourierCard(),
                        const SizedBox(height: 12),
                        _buildCourierTimeline(),
                      ],

                      // Items
                      const SizedBox(height: 20),
                      const Text('Items', style: TextStyle(fontSize: 16, fontWeight: FontWeight.w700)),
                      const SizedBox(height: 10),
                      Card(
                        child: Padding(
                          padding: const EdgeInsets.all(12),
                          child: Column(
                            children: (_order!['items'] as List? ?? []).map<Widget>((item) {
                              return Padding(
                                padding: const EdgeInsets.symmetric(vertical: 6),
                                child: Row(
                                  children: [
                                    Expanded(child: Text('${item['name']} × ${item['quantity']}',
                                        style: const TextStyle(fontSize: 14))),
                                    Text('₹${(item['total'] ?? 0).toStringAsFixed(0)}',
                                        style: const TextStyle(fontWeight: FontWeight.w600)),
                                  ],
                                ),
                              );
                            }).toList(),
                          ),
                        ),
                      ),
                    ],
                  ),
                ),
    );
  }

  Widget _buildCourierCard() {
    final ship = _order!['shipping'] as Map<String, dynamic>;
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(14),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                const Icon(Icons.local_shipping_rounded, color: AppColors.primary, size: 22),
                const SizedBox(width: 8),
                Expanded(
                  child: Text(
                    ship['courierName'] ?? ship['provider'] ?? 'Courier',
                    style: const TextStyle(fontSize: 15, fontWeight: FontWeight.w700),
                  ),
                ),
                _statusChip(ship['status'] ?? 'pending'),
              ],
            ),
            const SizedBox(height: 10),
            Row(
              children: [
                const Text('AWB: ', style: TextStyle(fontSize: 13, color: AppColors.textMuted)),
                Text(ship['awb'] ?? '', style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w600)),
              ],
            ),
            if (ship['estimatedDelivery'] != null) ...[
              const SizedBox(height: 4),
              Row(
                children: [
                  const Icon(Icons.schedule, size: 14, color: AppColors.textMuted),
                  const SizedBox(width: 4),
                  Text('ETA: ${_formatDate(ship['estimatedDelivery'])}',
                      style: const TextStyle(fontSize: 12, color: AppColors.textMuted)),
                ],
              ),
            ],
            if (ship['trackingUrl'] != null && (ship['trackingUrl'] as String).isNotEmpty) ...[
              const SizedBox(height: 10),
              SizedBox(
                width: double.infinity,
                child: OutlinedButton.icon(
                  onPressed: () => _openUrl(ship['trackingUrl']),
                  icon: const Icon(Icons.open_in_new, size: 16),
                  label: const Text('Track on Courier Website'),
                  style: OutlinedButton.styleFrom(
                    foregroundColor: AppColors.primary,
                    side: const BorderSide(color: AppColors.primary),
                    padding: const EdgeInsets.symmetric(vertical: 10),
                  ),
                ),
              ),
            ],
          ],
        ),
      ),
    );
  }

  Widget _buildCourierTimeline() {
    final events = (_order!['shipping']?['events'] as List?) ?? [];
    if (events.isEmpty) return const SizedBox.shrink();

    final reversed = events.reversed.toList();
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(14),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text('Shipment Updates', style: TextStyle(fontSize: 14, fontWeight: FontWeight.w700)),
            const SizedBox(height: 12),
            ...List.generate(reversed.length, (i) {
              final e = reversed[i] is Map ? Map<String, dynamic>.from(reversed[i]) : <String, dynamic>{};
              final isFirst = i == 0;
              final isLast = i == reversed.length - 1;
              return Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Column(
                    children: [
                      Container(
                        width: 12, height: 12,
                        decoration: BoxDecoration(
                          shape: BoxShape.circle,
                          color: isFirst ? AppColors.primary : AppColors.border,
                        ),
                      ),
                      if (!isLast) Container(width: 2, height: 40, color: AppColors.border),
                    ],
                  ),
                  const SizedBox(width: 10),
                  Expanded(
                    child: Padding(
                      padding: const EdgeInsets.only(bottom: 8),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(e['status'] ?? '', style: TextStyle(
                            fontSize: 13,
                            fontWeight: isFirst ? FontWeight.w700 : FontWeight.w500,
                            color: isFirst ? AppColors.textPrimary : AppColors.textSecondary,
                          )),
                          if ((e['description'] ?? '').isNotEmpty)
                            Text(e['description'], style: const TextStyle(fontSize: 12, color: AppColors.textMuted)),
                          Row(
                            children: [
                              if ((e['location'] ?? '').isNotEmpty)
                                Text('${e['location']} • ', style: const TextStyle(fontSize: 11, color: AppColors.textMuted)),
                              Text(_formatDate(e['timestamp']),
                                  style: const TextStyle(fontSize: 11, color: AppColors.textMuted)),
                            ],
                          ),
                        ],
                      ),
                    ),
                  ),
                ],
              );
            }),
          ],
        ),
      ),
    );
  }

  String _formatDate(dynamic date) {
    if (date == null) return '';
    try {
      final d = DateTime.parse(date.toString()).toLocal();
      return '${d.day}/${d.month}/${d.year} ${d.hour}:${d.minute.toString().padLeft(2, '0')}';
    } catch (_) {
      return date.toString();
    }
  }

  void _openUrl(String url) async {
    final uri = Uri.parse(url);
    if (await canLaunchUrl(uri)) {
      await launchUrl(uri, mode: LaunchMode.externalApplication);
    }
  }

  List<Widget> _buildTimeline() {
    final statuses = ['placed', 'confirmed', 'preparing', 'out_for_delivery', 'delivered'];
    final labels = ['Order Placed', 'Confirmed', 'Preparing', 'Out for Delivery', 'Delivered'];
    final currentStatus = _order!['status'] ?? '';
    final currentIdx = statuses.indexOf(currentStatus);

    if (currentStatus == 'cancelled') {
      return [
        _timelineItem('Order Cancelled', true, isLast: true, color: AppColors.error),
      ];
    }

    return List.generate(statuses.length, (i) {
      final done = i <= currentIdx;
      return _timelineItem(labels[i], done, isLast: i == statuses.length - 1);
    });
  }

  Widget _timelineItem(String label, bool done, {bool isLast = false, Color? color}) {
    final c = color ?? (done ? AppColors.success : AppColors.border);
    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Column(
          children: [
            Container(
              width: 24, height: 24,
              decoration: BoxDecoration(shape: BoxShape.circle, color: c),
              child: done ? const Icon(Icons.check, size: 14, color: Colors.white) : null,
            ),
            if (!isLast)
              Container(width: 2, height: 36, color: c),
          ],
        ),
        const SizedBox(width: 12),
        Padding(
          padding: const EdgeInsets.only(top: 2),
          child: Text(label, style: TextStyle(
            fontSize: 14,
            fontWeight: done ? FontWeight.w600 : FontWeight.w400,
            color: done ? AppColors.textPrimary : AppColors.textMuted,
          )),
        ),
      ],
    );
  }

  Widget _statusChip(String status) {
    Color bg;
    switch (status) {
      case 'delivered':
        bg = AppColors.success;
        break;
      case 'cancelled':
        bg = AppColors.error;
        break;
      case 'out_for_delivery':
        bg = AppColors.primary;
        break;
      default:
        bg = AppColors.accent;
    }
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
      decoration: BoxDecoration(
        color: bg.withValues(alpha: 0.15),
        borderRadius: BorderRadius.circular(8),
      ),
      child: Text(
        status.replaceAll('_', ' ').toUpperCase(),
        style: TextStyle(fontSize: 11, fontWeight: FontWeight.w700, color: bg),
      ),
    );
  }
}
