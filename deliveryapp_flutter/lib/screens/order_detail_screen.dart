import 'package:flutter/material.dart';
import 'package:url_launcher/url_launcher.dart';
import '../theme.dart';
import '../config.dart';
import '../services/api_service.dart';
import '../widgets/swipe_button.dart';

class OrderDetailScreen extends StatefulWidget {
  final String orderId;
  const OrderDetailScreen({super.key, required this.orderId});
  @override
  State<OrderDetailScreen> createState() => _OrderDetailScreenState();
}

class _OrderDetailScreenState extends State<OrderDetailScreen> {
  final _api = ApiService();
  Map<String, dynamic>? _order;
  bool _loading = true;
  String? _error;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() { _loading = true; _error = null; });
    try {
      var data = await _api.get('/delivery/assignments/${widget.orderId}');
      if (data.containsKey('order')) data = data['order'];
      setState(() { _order = data; _loading = false; });
    } catch (e) {
      setState(() { _error = e.toString(); _loading = false; });
    }
  }

  void _snack(String msg, {bool isError = false}) {
    if (!mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(SnackBar(
      content: Text(msg),
      backgroundColor: isError ? AppTheme.danger : AppTheme.success,
      behavior: SnackBarBehavior.floating,
    ));
  }

  Future<void> _pickup() async {
    try {
      await _api.put('/delivery/assignments/${widget.orderId}/pickup');
      _snack('Order picked up! 🛍️');
      _load();
    } catch (e) { _snack(e.toString(), isError: true); }
  }

  Future<void> _onTheWay() async {
    try {
      await _api.put('/delivery/assignments/${widget.orderId}/on-the-way');
      _snack('On the way! 🚀');
      _load();
    } catch (e) { _snack(e.toString(), isError: true); }
  }

  Future<void> _deliver(String otp) async {
    try {
      await _api.put('/delivery/assignments/${widget.orderId}/deliver', {'otp': otp});
      _snack('Delivered successfully! 🎉');
      _load();
    } catch (e) { _snack(e.toString(), isError: true); }
  }

  Future<void> _fail(String reason) async {
    try {
      await _api.put('/delivery/assignments/${widget.orderId}/fail', {'reason': reason});
      _snack('Marked as failed');
      _load();
    } catch (e) { _snack(e.toString(), isError: true); }
  }

  void _openDirections(double? lat, double? lng) {
    if (lat == null || lng == null) return;
    final url = 'https://www.google.com/maps/dir/?api=1&destination=$lat,$lng&travelmode=driving';
    launchUrl(Uri.parse(url), mode: LaunchMode.externalApplication);
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Order Details')),
      body: _loading
          ? const Center(child: CircularProgressIndicator())
          : _error != null
              ? Center(child: Text(_error!, style: const TextStyle(color: AppTheme.danger)))
              : _buildContent(),
    );
  }

  Widget _buildContent() {
    final o = _order!;
    final ds = (o['deliveryStatus'] ?? 'assigned') as String;
    final isDone = ds == 'delivered' || ds == 'failed';
    final addr = o['deliveryAddress'] ?? o['address'] ?? {};
    final partner = o['partner'] ?? {};
    final partnerAddr = o['partnerAddress'] ?? o['pickupAddress'] ?? partner['address'] ?? {};
    final user = o['user'] ?? o['customer'] ?? {};
    final items = (o['items'] as List?) ?? [];

    return RefreshIndicator(
      onRefresh: _load,
      child: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          // Step tracker
          _stepTracker(ds),
          const SizedBox(height: 14),

          // Order info card
          Card(
            child: Padding(
              padding: const EdgeInsets.all(14),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Text('#${o['orderNumber'] ?? widget.orderId.substring(widget.orderId.length - 6)}',
                          style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w700)),
                      Text('₹${o['totalAmount'] ?? o['grandTotal'] ?? 0}',
                          style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w700, color: AppTheme.primary)),
                    ],
                  ),
                  const SizedBox(height: 6),
                  Text('${_fmtDateTime(o['createdAt'])}', style: const TextStyle(fontSize: 12, color: AppTheme.textLight)),
                  const SizedBox(height: 6),
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Text('Payment: ${o['paymentMethod'] ?? '—'}', style: const TextStyle(fontSize: 13)),
                      _badge(o['paymentStatus'] ?? 'pending'),
                    ],
                  ),
                  if (o['deliveryOtp'] != null && !isDone) ...[
                    const SizedBox(height: 10),
                    Row(
                      children: [
                        const Text('Delivery OTP: ', style: TextStyle(fontSize: 13, fontWeight: FontWeight.w600)),
                        Text('${o['deliveryOtp']}',
                            style: const TextStyle(fontSize: 20, fontWeight: FontWeight.w800, color: AppTheme.primary, letterSpacing: 3)),
                      ],
                    ),
                  ],
                ],
              ),
            ),
          ),

          // Items
          Card(
            child: Padding(
              padding: const EdgeInsets.all(14),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text('Items (${items.length})', style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w700)),
                  const Divider(),
                  ...items.map((it) {
                    final prod = it['product'] ?? {};
                    final img = (prod['images'] as List?)?.isNotEmpty == true ? prod['images'][0] : null;
                    return Padding(
                      padding: const EdgeInsets.symmetric(vertical: 6),
                      child: Row(
                        children: [
                          if (img != null)
                            ClipRRect(
                              borderRadius: BorderRadius.circular(6),
                              child: Image.network(
                                '${AppConfig.apiBase.replaceAll('/api', '')}/$img',
                                width: 40, height: 40, fit: BoxFit.cover,
                                errorBuilder: (_, __, ___) => _itemPlaceholder(),
                              ),
                            )
                          else
                            _itemPlaceholder(),
                          const SizedBox(width: 10),
                          Expanded(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text(prod['name'] ?? it['name'] ?? 'Product', style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w600)),
                                Text('Qty: ${it['quantity'] ?? 1}', style: const TextStyle(fontSize: 11, color: AppTheme.textLight)),
                              ],
                            ),
                          ),
                          Text('₹${it['price'] ?? 0}', style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 13)),
                        ],
                      ),
                    );
                  }),
                ],
              ),
            ),
          ),

          // Pickup location
          _directionCard(
            icon: Icons.store,
            label: 'PICKUP FROM',
            name: partner['businessName'] ?? partner['name'] ?? 'Shop',
            address: partnerAddr['street'] ?? partnerAddr['fullAddress'] ?? partnerAddr['addressLine'] ?? '',
            lat: _getLat(partnerAddr),
            lng: _getLng(partnerAddr),
            color: AppTheme.primary,
          ),

          // Delivery location
          _directionCard(
            icon: Icons.person_pin_circle,
            label: 'DELIVER TO',
            name: '${user['name'] ?? 'Customer'}${user['phone'] != null ? ' · ${user['phone']}' : ''}',
            address: addr['street'] ?? addr['fullAddress'] ?? addr['addressLine'] ?? '',
            lat: _getLat(addr),
            lng: _getLng(addr),
            color: AppTheme.success,
          ),

          const SizedBox(height: 8),

          // Action buttons
          _buildActions(ds),
        ],
      ),
    );
  }

  Widget _stepTracker(String ds) {
    final steps = [
      {'key': 'assigned', 'label': 'Assigned', 'icon': Icons.assignment},
      {'key': 'picked_up', 'label': 'Picked Up', 'icon': Icons.shopping_bag},
      {'key': 'on_the_way', 'label': 'On Way', 'icon': Icons.rocket_launch},
      {'key': 'delivered', 'label': 'Delivered', 'icon': Icons.check_circle},
    ];
    final currentIdx = steps.indexWhere((s) => s['key'] == ds);

    return Card(
      child: Padding(
        padding: const EdgeInsets.symmetric(vertical: 16, horizontal: 8),
        child: Row(
          children: List.generate(steps.length * 2 - 1, (i) {
            if (i.isOdd) {
              final stepI = i ~/ 2;
              return Expanded(
                child: Container(
                  height: 2,
                  color: stepI < currentIdx ? AppTheme.success : AppTheme.border,
                ),
              );
            }
            final stepI = i ~/ 2;
            final isDone = stepI < currentIdx;
            final isActive = stepI == currentIdx;
            return Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                Container(
                  width: 32, height: 32,
                  decoration: BoxDecoration(
                    shape: BoxShape.circle,
                    color: isDone ? AppTheme.success : isActive ? AppTheme.primary : AppTheme.border,
                  ),
                  child: Icon(
                    isDone ? Icons.check : steps[stepI]['icon'] as IconData,
                    size: 16, color: Colors.white,
                  ),
                ),
                const SizedBox(height: 4),
                Text(steps[stepI]['label'] as String,
                    style: TextStyle(
                        fontSize: 10,
                        fontWeight: (isDone || isActive) ? FontWeight.w600 : FontWeight.w400,
                        color: (isDone || isActive) ? AppTheme.textColor : AppTheme.textLight)),
              ],
            );
          }),
        ),
      ),
    );
  }

  Widget _directionCard({
    required IconData icon, required String label, required String name,
    required String address, double? lat, double? lng, required Color color,
  }) {
    return Container(
      margin: const EdgeInsets.only(bottom: 12),
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        gradient: LinearGradient(colors: [color, color.withValues(alpha: 0.8)]),
        borderRadius: BorderRadius.circular(12),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(label, style: TextStyle(fontSize: 11, color: Colors.white.withValues(alpha: 0.7))),
          const SizedBox(height: 4),
          Row(
            children: [
              Icon(icon, color: Colors.white, size: 18),
              const SizedBox(width: 8),
              Expanded(child: Text(name, style: const TextStyle(color: Colors.white, fontSize: 15, fontWeight: FontWeight.w600))),
            ],
          ),
          if (address.isNotEmpty) ...[
            const SizedBox(height: 4),
            Text(address, style: TextStyle(color: Colors.white.withValues(alpha: 0.8), fontSize: 13)),
          ],
          if (lat != null && lng != null) ...[
            const SizedBox(height: 10),
            OutlinedButton.icon(
              onPressed: () => _openDirections(lat, lng),
              icon: const Icon(Icons.directions, size: 16),
              label: const Text('Get Directions'),
              style: OutlinedButton.styleFrom(
                foregroundColor: Colors.white,
                side: BorderSide(color: Colors.white.withValues(alpha: 0.4)),
                padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
                textStyle: const TextStyle(fontSize: 13, fontWeight: FontWeight.w600),
              ),
            ),
          ],
        ],
      ),
    );
  }

  Widget _buildActions(String ds) {
    if (ds == 'delivered') {
      return Container(
        padding: const EdgeInsets.all(16),
        decoration: BoxDecoration(color: AppTheme.successBg, borderRadius: BorderRadius.circular(12)),
        child: const Row(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(Icons.check_circle, color: AppTheme.success),
            SizedBox(width: 8),
            Text('Delivered Successfully', style: TextStyle(fontWeight: FontWeight.w700, color: AppTheme.success, fontSize: 15)),
          ],
        ),
      );
    }
    if (ds == 'failed') {
      return Container(
        padding: const EdgeInsets.all(16),
        decoration: BoxDecoration(color: AppTheme.dangerBg, borderRadius: BorderRadius.circular(12)),
        child: Column(
          children: [
            const Row(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                Icon(Icons.cancel, color: AppTheme.danger),
                SizedBox(width: 8),
                Text('Delivery Failed', style: TextStyle(fontWeight: FontWeight.w700, color: AppTheme.danger, fontSize: 15)),
              ],
            ),
            if (_order?['note'] != null) ...[
              const SizedBox(height: 6),
              Text(_order!['note'], style: const TextStyle(fontSize: 13, color: AppTheme.textLight)),
            ],
          ],
        ),
      );
    }

    return Column(
      children: [
        if (ds == 'assigned')
          SwipeButton(
            text: 'Swipe to Pick Up →',
            icon: Icons.shopping_bag,
            color: AppTheme.primary,
            onComplete: _pickup,
          ),
        if (ds == 'picked_up')
          SwipeButton(
            text: 'Swipe — On The Way →',
            icon: Icons.rocket_launch,
            color: AppTheme.primary,
            onComplete: _onTheWay,
          ),
        if (ds == 'on_the_way') ...[
          _otpDeliverSection(),
        ],
        const SizedBox(height: 8),
        SizedBox(
          width: double.infinity,
          child: OutlinedButton.icon(
            onPressed: _showFailDialog,
            icon: const Icon(Icons.cancel, size: 18),
            label: const Text('Mark as Failed'),
            style: OutlinedButton.styleFrom(
              foregroundColor: AppTheme.danger,
              side: const BorderSide(color: AppTheme.danger),
              padding: const EdgeInsets.symmetric(vertical: 14),
            ),
          ),
        ),
      ],
    );
  }

  Widget _otpDeliverSection() {
    final otpCtrl = TextEditingController();
    return Column(
      children: [
        TextField(
          controller: otpCtrl,
          keyboardType: TextInputType.number,
          maxLength: 4,
          decoration: const InputDecoration(
            labelText: 'Customer OTP (ask the customer)',
            counterText: '',
          ),
        ),
        const SizedBox(height: 8),
        SwipeButton(
          text: 'Swipe to Deliver →',
          icon: Icons.check_circle,
          color: AppTheme.success,
          onComplete: () => _deliver(otpCtrl.text.trim()),
        ),
      ],
    );
  }

  void _showFailDialog() {
    String reason = 'Customer not available';
    final reasons = ['Customer not available', 'Wrong address', 'Customer refused', 'Customer unreachable', 'Other'];
    final otherCtrl = TextEditingController();

    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      shape: const RoundedRectangleBorder(borderRadius: BorderRadius.vertical(top: Radius.circular(20))),
      builder: (ctx) => StatefulBuilder(builder: (ctx, setSheetState) {
        return Padding(
          padding: EdgeInsets.only(left: 20, right: 20, top: 16, bottom: MediaQuery.of(ctx).viewInsets.bottom + 20),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Center(child: Container(width: 36, height: 4, decoration: BoxDecoration(color: AppTheme.border, borderRadius: BorderRadius.circular(2)))),
              const SizedBox(height: 16),
              const Text('Mark Delivery Failed', style: TextStyle(fontSize: 17, fontWeight: FontWeight.w700)),
              const SizedBox(height: 14),
              DropdownButtonFormField<String>(
                initialValue: reason,
                decoration: const InputDecoration(labelText: 'Reason'),
                items: reasons.map((r) => DropdownMenuItem(value: r, child: Text(r))).toList(),
                onChanged: (v) => setSheetState(() => reason = v!),
              ),
              if (reason == 'Other') ...[
                const SizedBox(height: 12),
                TextField(controller: otherCtrl, decoration: const InputDecoration(hintText: 'Describe reason...')),
              ],
              const SizedBox(height: 16),
              SwipeButton(
                text: 'Swipe to Confirm Fail →',
                icon: Icons.cancel,
                color: AppTheme.danger,
                onComplete: () {
                  Navigator.pop(ctx);
                  _fail(reason == 'Other' ? (otherCtrl.text.trim().isEmpty ? 'Other' : otherCtrl.text.trim()) : reason);
                },
              ),
              const SizedBox(height: 8),
              SizedBox(
                width: double.infinity,
                child: OutlinedButton(onPressed: () => Navigator.pop(ctx), child: const Text('Cancel')),
              ),
            ],
          ),
        );
      }),
    );
  }

  Widget _badge(String status) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
      decoration: BoxDecoration(
        color: AppTheme.statusBgColor(status),
        borderRadius: BorderRadius.circular(12),
      ),
      child: Text(status.replaceAll('_', ' '),
          style: TextStyle(fontSize: 11, fontWeight: FontWeight.w600, color: AppTheme.statusColor(status))),
    );
  }

  Widget _itemPlaceholder() => Container(
        width: 40, height: 40,
        decoration: BoxDecoration(color: AppTheme.bg, borderRadius: BorderRadius.circular(6)),
        child: const Icon(Icons.inventory_2, size: 20, color: AppTheme.textLight),
      );

  double? _getLat(Map<String, dynamic> addr) {
    if (addr['lat'] != null) return (addr['lat'] as num).toDouble();
    final coords = addr['location']?['coordinates'];
    if (coords is List && coords.length >= 2) return (coords[1] as num).toDouble();
    return null;
  }

  double? _getLng(Map<String, dynamic> addr) {
    if (addr['lng'] != null) return (addr['lng'] as num).toDouble();
    final coords = addr['location']?['coordinates'];
    if (coords is List && coords.length >= 2) return (coords[0] as num).toDouble();
    return null;
  }

  String _fmtDateTime(String? d) {
    if (d == null) return '—';
    final dt = DateTime.tryParse(d);
    if (dt == null) return d;
    return '${dt.day.toString().padLeft(2, '0')} ${_months[dt.month - 1]} ${dt.year}, ${dt.hour.toString().padLeft(2, '0')}:${dt.minute.toString().padLeft(2, '0')}';
  }

  static const _months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
}
