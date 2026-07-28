import 'package:flutter/material.dart';
import 'package:cached_network_image/cached_network_image.dart';
import '../../services/api_service.dart';
import '../../theme/app_theme.dart';
import '../../config.dart';

class ReturnsNewScreen extends StatefulWidget {
  const ReturnsNewScreen({super.key});

  @override
  State<ReturnsNewScreen> createState() => _ReturnsNewScreenState();
}

class _ReturnsNewScreenState extends State<ReturnsNewScreen> {
  final _api = ApiService();
  String? _orderId;
  Map<String, dynamic>? _order;
  bool _loading = true;
  bool _submitting = false;
  String? _error;
  bool _existing = false;

  final Map<String, int> _selected = {}; // productId -> qty
  String _reason = 'defective';
  final _noteCtl = TextEditingController();

  static const reasons = [
    ['defective', 'Item arrived defective / damaged'],
    ['wrong_item', 'Wrong item delivered'],
    ['not_as_described', 'Item not as described'],
    ['size_issue', 'Size / fit issue'],
    ['quality_issue', 'Quality not as expected'],
    ['changed_mind', 'Changed my mind'],
    ['other', 'Other'],
  ];

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    final id = ModalRoute.of(context)?.settings.arguments as String?;
    if (id != null && _orderId != id) {
      _orderId = id;
      _load();
    }
  }

  @override
  void dispose() {
    _noteCtl.dispose();
    super.dispose();
  }

  Future<void> _load() async {
    setState(() { _loading = true; _error = null; });
    try {
      // Existing return check
      try {
        final ex = await _api.get('/user/returns/order/$_orderId');
        if (ex['returnRequest'] != null) _existing = true;
      } catch (_) {}

      // Fetch order
      final r = await _api.get('/user/orders/$_orderId');
      _order = Map<String, dynamic>.from(r['order'] ?? r);
    } catch (e) {
      _error = e.toString();
    }
    if (mounted) setState(() => _loading = false);
  }

  int _windowDaysLeft() {
    final ts = _order?['deliveredAt']?.toString() ?? _order?['updatedAt']?.toString();
    if (ts == null) return 7;
    final delivered = DateTime.tryParse(ts);
    if (delivered == null) return 7;
    final daysSince = DateTime.now().difference(delivered).inDays;
    return (7 - daysSince).clamp(-1, 7);
  }

  num _refundEstimate() {
    final items = List<dynamic>.from(_order?['items'] ?? []);
    num total = 0;
    for (final it in items) {
      final pid = (it['product'] is Map ? it['product']['_id'] : it['product'])?.toString() ?? '';
      final qty = _selected[pid] ?? 0;
      if (qty > 0) {
        final price = (it['price'] ?? 0) as num;
        total += price * qty;
      }
    }
    return total;
  }

  Future<void> _submit() async {
    final items = <Map<String, dynamic>>[];
    for (final entry in _selected.entries) {
      if (entry.value > 0) items.add({'product': entry.key, 'quantity': entry.value});
    }
    if (items.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Select at least one item')));
      return;
    }
    setState(() => _submitting = true);
    try {
      await _api.post('/user/returns', {
        'orderId': _orderId,
        'reason': _reason,
        'note': _noteCtl.text.trim(),
        'items': items,
      });
      if (!mounted) return;
      Navigator.pushReplacementNamed(context, '/returns');
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Return request submitted'), backgroundColor: AppColors.success),
      );
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(e.toString())));
      }
    } finally {
      if (mounted) setState(() => _submitting = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    if (_loading) {
      return Scaffold(
        appBar: AppBar(title: const Text('Return Items')),
        body: const Center(child: CircularProgressIndicator()),
      );
    }
    if (_error != null || _order == null) {
      return Scaffold(
        appBar: AppBar(title: const Text('Return Items')),
        body: Center(child: Padding(
          padding: const EdgeInsets.all(20),
          child: Text(_error ?? 'Order not found', textAlign: TextAlign.center),
        )),
      );
    }
    if (_existing) {
      return Scaffold(
        appBar: AppBar(title: const Text('Return Items')),
        body: Center(child: Padding(
          padding: const EdgeInsets.all(20),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              const Text('A return is already in progress for this order.',
                  textAlign: TextAlign.center, style: TextStyle(fontSize: 14, fontWeight: FontWeight.w700)),
              const SizedBox(height: 12),
              ElevatedButton(
                onPressed: () => Navigator.pushReplacementNamed(context, '/returns'),
                child: const Text('View My Returns'),
              ),
            ],
          ),
        )),
      );
    }

    final daysLeft = _windowDaysLeft();
    if (daysLeft < 0) {
      return Scaffold(
        appBar: AppBar(title: const Text('Return Items')),
        body: const Center(child: Padding(
          padding: EdgeInsets.all(20),
          child: Text('The 7-day return window has expired for this order.',
              textAlign: TextAlign.center, style: TextStyle(fontSize: 14, fontWeight: FontWeight.w700)),
        )),
      );
    }

    final orderNum = _order!['orderNumber']?.toString() ?? '';
    final items = List<dynamic>.from(_order!['items'] ?? []);

    return Scaffold(
      appBar: AppBar(title: Text('Return · #$orderNum')),
      body: Column(
        children: [
          // Window banner
          Container(
            width: double.infinity,
            padding: const EdgeInsets.all(10),
            color: const Color(0xFFFEF3C7),
            child: Text(
              daysLeft == 0 ? '⏰ Last day to raise a return' : '$daysLeft days left in your return window',
              style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w700, color: Color(0xFF92400E)),
            ),
          ),
          Expanded(
            child: ListView(
              padding: const EdgeInsets.all(12),
              children: [
                // Step 1: items
                _stepHeader('1', 'Select items to return'),
                Container(
                  decoration: BoxDecoration(
                    color: Colors.white,
                    borderRadius: BorderRadius.circular(12),
                    border: Border.all(color: AppColors.border),
                  ),
                  child: Column(
                    children: items.map((it) => _itemRow(it)).toList(),
                  ),
                ),
                const SizedBox(height: 16),

                // Step 2: reason
                _stepHeader('2', 'Why are you returning?'),
                Container(
                  decoration: BoxDecoration(
                    color: Colors.white,
                    borderRadius: BorderRadius.circular(12),
                    border: Border.all(color: AppColors.border),
                  ),
                  child: Column(
                    children: reasons.map((r) {
                      return RadioListTile<String>(
                        value: r[0],
                        groupValue: _reason,
                        onChanged: (v) => setState(() => _reason = v ?? _reason),
                        title: Text(r[1], style: const TextStyle(fontSize: 13)),
                        dense: true,
                      );
                    }).toList(),
                  ),
                ),
                const SizedBox(height: 12),
                TextField(
                  controller: _noteCtl,
                  maxLength: 300,
                  maxLines: 3,
                  decoration: const InputDecoration(
                    hintText: 'Add a note (optional)',
                  ),
                ),
                const SizedBox(height: 12),

                // Step 3: refund
                _stepHeader('3', 'Refund'),
                Container(
                  padding: const EdgeInsets.all(12),
                  decoration: BoxDecoration(
                    color: Colors.green.shade50,
                    borderRadius: BorderRadius.circular(12),
                    border: Border.all(color: Colors.green.shade200),
                  ),
                  child: Row(
                    children: [
                      const Icon(Icons.account_balance_wallet_rounded, color: AppColors.success),
                      const SizedBox(width: 10),
                      const Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text('Refund to DamnDeal Wallet',
                                style: TextStyle(fontSize: 13, fontWeight: FontWeight.w800)),
                            Text('Credited instantly after pickup & approval',
                                style: TextStyle(fontSize: 11, color: AppColors.textMuted)),
                          ],
                        ),
                      ),
                      Text('₹${_refundEstimate().toStringAsFixed(2)}',
                          style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w900, color: AppColors.success)),
                    ],
                  ),
                ),
                const SizedBox(height: 80),
              ],
            ),
          ),
        ],
      ),
      bottomNavigationBar: SafeArea(
        child: Padding(
          padding: const EdgeInsets.all(12),
          child: SizedBox(
            height: 50,
            child: ElevatedButton(
              onPressed: _submitting || _selected.values.every((v) => v == 0) ? null : _submit,
              child: _submitting
                  ? const SizedBox(width: 18, height: 18, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white))
                  : const Text('Request Return', style: TextStyle(fontSize: 15, fontWeight: FontWeight.w900)),
            ),
          ),
        ),
      ),
    );
  }

  Widget _stepHeader(String n, String title) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 8, left: 2),
      child: Row(
        children: [
          Container(
            width: 22, height: 22,
            decoration: const BoxDecoration(color: AppColors.primary, shape: BoxShape.circle),
            child: Center(
              child: Text(n,
                  style: const TextStyle(color: Colors.white, fontSize: 11, fontWeight: FontWeight.w800)),
            ),
          ),
          const SizedBox(width: 8),
          Text(title, style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w800)),
        ],
      ),
    );
  }

  Widget _itemRow(dynamic it) {
    final pid = (it['product'] is Map ? it['product']['_id'] : it['product'])?.toString() ?? '';
    final ordered = (it['quantity'] ?? 1) as num;
    final selected = _selected[pid] ?? 0;
    final isSelected = selected > 0;
    final price = (it['price'] ?? 0) as num;
    final image = (it['image'] ?? (it['product'] is Map ? (it['product']['images'] as List?)?.first : null))?.toString() ?? '';

    return Padding(
      padding: const EdgeInsets.all(10),
      child: Row(
        children: [
          Checkbox(
            value: isSelected,
            onChanged: (v) {
              setState(() {
                if (v == true) {
                  _selected[pid] = ordered.toInt();
                } else {
                  _selected.remove(pid);
                }
              });
            },
          ),
          ClipRRect(
            borderRadius: BorderRadius.circular(8),
            child: SizedBox(
              width: 50, height: 50,
              child: image.isNotEmpty
                  ? CachedNetworkImage(
                      imageUrl: image.startsWith('http') ? image : '${AppConfig.uploadsBase}/$image',
                      fit: BoxFit.cover,
                      errorWidget: (_, __, ___) => Container(color: AppColors.divider),
                    )
                  : Container(color: AppColors.divider),
            ),
          ),
          const SizedBox(width: 10),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(it['name']?.toString() ?? '',
                    maxLines: 2,
                    overflow: TextOverflow.ellipsis,
                    style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w700)),
                Text('₹${price.toStringAsFixed(0)} × $ordered',
                    style: const TextStyle(fontSize: 11, color: AppColors.textMuted)),
              ],
            ),
          ),
          if (isSelected)
            Row(
              children: [
                IconButton(
                  visualDensity: VisualDensity.compact,
                  icon: const Icon(Icons.remove_circle_outline, size: 22),
                  onPressed: selected > 1 ? () => setState(() => _selected[pid] = selected - 1) : null,
                ),
                Text('$selected', style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w800)),
                IconButton(
                  visualDensity: VisualDensity.compact,
                  icon: const Icon(Icons.add_circle_outline, size: 22),
                  onPressed: selected < ordered ? () => setState(() => _selected[pid] = selected + 1) : null,
                ),
              ],
            ),
        ],
      ),
    );
  }
}
