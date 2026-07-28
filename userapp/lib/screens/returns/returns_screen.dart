import 'package:flutter/material.dart';
import '../../services/api_service.dart';
import '../../theme/app_theme.dart';

class ReturnsScreen extends StatefulWidget {
  const ReturnsScreen({super.key});

  @override
  State<ReturnsScreen> createState() => _ReturnsScreenState();
}

class _ReturnsScreenState extends State<ReturnsScreen> {
  final _api = ApiService();
  List<dynamic> _returns = [];
  bool _loading = true;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    try {
      final r = await _api.get('/user/returns');
      _returns = List<dynamic>.from(r['returns'] ?? []);
    } catch (_) {}
    if (mounted) setState(() => _loading = false);
  }

  Color _statusColor(String s) {
    switch (s) {
      case 'approved': return const Color(0xFF2563EB);
      case 'refunded': return AppColors.success;
      case 'rejected': return AppColors.error;
      case 'requested':
      default: return const Color(0xFFD97706);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('My Returns'),
        actions: [
          TextButton(
            onPressed: () => Navigator.pushNamed(context, '/orders'),
            child: const Text('My Orders'),
          ),
        ],
      ),
      body: RefreshIndicator(
        onRefresh: () async => _load(),
        child: _loading
            ? const Center(child: CircularProgressIndicator())
            : _returns.isEmpty
                ? ListView(
                    children: [
                      const SizedBox(height: 80),
                      const Center(child: Text('📦', style: TextStyle(fontSize: 48))),
                      const SizedBox(height: 12),
                      const Center(
                        child: Text('No return requests yet',
                            style: TextStyle(fontSize: 14, fontWeight: FontWeight.w700)),
                      ),
                      const SizedBox(height: 4),
                      const Center(
                        child: Text('Returns you raise will appear here',
                            style: TextStyle(fontSize: 12, color: AppColors.textMuted)),
                      ),
                      const SizedBox(height: 16),
                      Center(
                        child: ElevatedButton(
                          onPressed: () => Navigator.pushNamed(context, '/orders'),
                          child: const Text('View My Orders'),
                        ),
                      ),
                    ],
                  )
                : ListView.builder(
                    padding: const EdgeInsets.all(12),
                    itemCount: _returns.length,
                    itemBuilder: (_, i) => _card(_returns[i]),
                  ),
      ),
    );
  }

  Widget _card(dynamic r) {
    final status = (r['status'] ?? 'requested').toString();
    final color = _statusColor(status);
    final order = r['order'] is Map ? Map<String, dynamic>.from(r['order']) : null;
    final orderNum = order?['orderNumber']?.toString() ?? r['order']?.toString() ?? '';
    final items = List<dynamic>.from(r['items'] ?? []);
    final amount = (r['totalRefundAmount'] ?? r['refundAmount'] ?? 0) as num;

    return Container(
      margin: const EdgeInsets.only(bottom: 10),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: AppColors.border),
      ),
      clipBehavior: Clip.hardEdge,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Header strip
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
            color: color.withValues(alpha: 0.08),
            child: Row(
              children: [
                Expanded(
                  child: Text('Return for #$orderNum',
                      style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w800)),
                ),
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                  decoration: BoxDecoration(color: color, borderRadius: BorderRadius.circular(20)),
                  child: Text(status.toUpperCase(),
                      style: const TextStyle(color: Colors.white, fontSize: 9, fontWeight: FontWeight.w800)),
                ),
              ],
            ),
          ),
          // Body
          Padding(
            padding: const EdgeInsets.all(12),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                if (items.isNotEmpty)
                  ...items.take(3).map((it) => Padding(
                        padding: const EdgeInsets.only(bottom: 4),
                        child: Row(
                          children: [
                            const Icon(Icons.inventory_2_outlined, size: 14, color: AppColors.textMuted),
                            const SizedBox(width: 6),
                            Expanded(
                              child: Text('${it['name'] ?? ''} × ${it['quantity'] ?? 1}',
                                  style: const TextStyle(fontSize: 12)),
                            ),
                          ],
                        ),
                      )),
                if (r['reason'] != null) ...[
                  const SizedBox(height: 6),
                  Text('Reason: ${r['reason']}',
                      style: const TextStyle(fontSize: 11, color: AppColors.textMuted)),
                ],
                if (r['reviewNote'] != null && r['reviewNote'].toString().isNotEmpty) ...[
                  const SizedBox(height: 6),
                  Container(
                    padding: const EdgeInsets.all(8),
                    decoration: BoxDecoration(
                      color: AppColors.divider,
                      borderRadius: BorderRadius.circular(8),
                    ),
                    child: Text('Note: ${r['reviewNote']}', style: const TextStyle(fontSize: 11)),
                  ),
                ],
                const SizedBox(height: 10),
                Row(
                  children: [
                    Text('Refund: ₹${amount.toStringAsFixed(2)}',
                        style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w800, color: AppColors.success)),
                    const Spacer(),
                  ],
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}
