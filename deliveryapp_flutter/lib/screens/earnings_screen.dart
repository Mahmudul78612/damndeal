import 'package:flutter/material.dart';
import '../theme.dart';
import '../services/api_service.dart';

class EarningsScreen extends StatefulWidget {
  const EarningsScreen({super.key});
  @override
  State<EarningsScreen> createState() => _EarningsScreenState();
}

class _EarningsScreenState extends State<EarningsScreen> {
  final _api = ApiService();
  String _period = 'week';
  Map<String, dynamic>? _data;
  bool _loading = true;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() => _loading = true);
    try {
      String qs = '';
      if (_period == 'week') {
        final d = DateTime.now().subtract(const Duration(days: 7));
        qs = '?from=${d.toIso8601String().substring(0, 10)}';
      } else if (_period == 'month') {
        final d = DateTime.now().subtract(const Duration(days: 30));
        qs = '?from=${d.toIso8601String().substring(0, 10)}';
      }
      final data = await _api.get('/delivery/earnings$qs');
      if (!mounted) return;
      setState(() { _data = data; _loading = false; });
    } catch (e) {
      setState(() => _loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    if (_loading) return const Center(child: CircularProgressIndicator());
    if (_data == null) return const Center(child: Text('Failed to load earnings'));

    final d = _data!;
    final rating = d['rating'] != null ? (d['rating'] as num).toDouble() : 0.0;

    return RefreshIndicator(
      onRefresh: _load,
      child: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          // Period tabs
          Row(
            children: [
              _periodBtn('This Week', 'week'),
              const SizedBox(width: 6),
              _periodBtn('This Month', 'month'),
              const SizedBox(width: 6),
              _periodBtn('All Time', 'all'),
            ],
          ),
          const SizedBox(height: 14),

          // Total earnings card
          Container(
            width: double.infinity,
            padding: const EdgeInsets.all(24),
            decoration: BoxDecoration(
              gradient: const LinearGradient(colors: [AppTheme.primaryDark, AppTheme.primary]),
              borderRadius: BorderRadius.circular(14),
            ),
            child: Column(
              children: [
                Text('Total Earnings', style: TextStyle(color: Colors.white.withValues(alpha: 0.7), fontSize: 12)),
                const SizedBox(height: 4),
                Text('₹${d['totalEarnings'] ?? 0}',
                    style: const TextStyle(color: Colors.white, fontSize: 34, fontWeight: FontWeight.w800)),
                const SizedBox(height: 6),
                Text('${d['totalDeliveries'] ?? 0} Total Deliveries',
                    style: TextStyle(color: Colors.white.withValues(alpha: 0.8), fontSize: 13)),
              ],
            ),
          ),
          const SizedBox(height: 14),

          // Stats grid
          Row(
            children: [
              _miniStat('Deliveries', '${d['period']?['deliveries'] ?? d['totalDeliveries'] ?? 0}'),
              const SizedBox(width: 8),
              _miniStat('COD Collected', '₹${d['period']?['codCollected'] ?? 0}'),
              const SizedBox(width: 8),
              _miniStat('Rating', rating > 0 ? '${rating.toStringAsFixed(1)} ⭐' : '—',
                  sub: '${d['ratingCount'] ?? 0} reviews'),
            ],
          ),
          const SizedBox(height: 14),

          // Daily breakdown
          Card(
            child: Padding(
              padding: const EdgeInsets.all(14),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Text('Daily Breakdown', style: TextStyle(fontSize: 14, fontWeight: FontWeight.w700)),
                  const Divider(),
                  if ((d['daily'] as List?)?.isEmpty ?? true)
                    const Padding(
                      padding: EdgeInsets.all(20),
                      child: Center(child: Text('No data yet', style: TextStyle(color: AppTheme.textLight))),
                    )
                  else
                    ...(d['daily'] as List).map((day) {
                      final dateStr = day['_id'] ?? day['date'] ?? '';
                      final dt = DateTime.tryParse(dateStr);
                      final formatted = dt != null
                          ? '${['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'][dt.weekday - 1]}, ${dt.day} ${_months[dt.month - 1]}'
                          : dateStr;
                      return Padding(
                        padding: const EdgeInsets.symmetric(vertical: 8),
                        child: Row(
                          mainAxisAlignment: MainAxisAlignment.spaceBetween,
                          children: [
                            Text(formatted, style: const TextStyle(fontSize: 13, color: AppTheme.textLight)),
                            Row(
                              children: [
                                Text('${day['deliveries'] ?? 0} deliveries',
                                    style: const TextStyle(fontSize: 12, color: AppTheme.textLight)),
                                if (day['earnings'] != null) ...[
                                  const SizedBox(width: 8),
                                  Text('₹${day['earnings']}',
                                      style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w700, color: AppTheme.primary)),
                                ],
                              ],
                            ),
                          ],
                        ),
                      );
                    }),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _periodBtn(String label, String value) {
    final active = _period == value;
    return Expanded(
      child: GestureDetector(
        onTap: () { setState(() => _period = value); _load(); },
        child: Container(
          padding: const EdgeInsets.symmetric(vertical: 8),
          decoration: BoxDecoration(
            color: active ? AppTheme.primary : Colors.white,
            borderRadius: BorderRadius.circular(8),
            border: Border.all(color: active ? AppTheme.primary : AppTheme.border),
          ),
          child: Center(
            child: Text(label,
                style: TextStyle(fontSize: 12, fontWeight: FontWeight.w600, color: active ? Colors.white : AppTheme.textColor)),
          ),
        ),
      ),
    );
  }

  Widget _miniStat(String label, String value, {String? sub}) {
    return Expanded(
      child: Container(
        padding: const EdgeInsets.all(14),
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(10),
          border: Border.all(color: AppTheme.border),
        ),
        child: Column(
          children: [
            Text(label, style: const TextStyle(fontSize: 11, color: AppTheme.textLight)),
            const SizedBox(height: 4),
            Text(value, style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w700, color: AppTheme.primary)),
            if (sub != null) ...[
              const SizedBox(height: 2),
              Text(sub, style: const TextStyle(fontSize: 10, color: AppTheme.textLight)),
            ],
          ],
        ),
      ),
    );
  }

  static const _months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
}
