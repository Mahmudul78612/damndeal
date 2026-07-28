import 'package:flutter/material.dart';
import '../../services/api_service.dart';
import '../../theme/app_theme.dart';

class MagicClubAllScreen extends StatefulWidget {
  const MagicClubAllScreen({super.key});

  @override
  State<MagicClubAllScreen> createState() => _MagicClubAllScreenState();
}

class _MagicClubAllScreenState extends State<MagicClubAllScreen> {
  final _api = ApiService();
  List<dynamic> _clubs = [];
  bool _loading = true;
  String _preset = 'all';
  DateTime? _from, _to;
  String _query = '';

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    try {
      final r = await _api.get('/user/magic-club');
      _clubs = List<dynamic>.from(r['clubs'] ?? []);
    } catch (_) {}
    if (mounted) setState(() => _loading = false);
  }

  num _pointsOf(dynamic c) =>
      (c['totalRewards'] ?? c['rewardPoints'] ?? c['points'] ?? c['rewardAmount'] ?? c['amount'] ?? 0) as num;

  ({DateTime? from, DateTime? to}) _range() {
    final now = DateTime.now();
    if (_preset == 'all') return (from: null, to: null);
    if (_preset == 'custom') return (from: _from, to: _to);
    final days = _preset == '7d' ? 7 : _preset == '30d' ? 30 : 90;
    return (from: now.subtract(Duration(days: days)), to: null);
  }

  List<dynamic> get _filtered {
    final r = _range();
    final q = _query.trim().toLowerCase();
    final out = _clubs.where((c) {
      final ts = DateTime.tryParse(c['createdAt']?.toString() ?? '');
      if (ts != null) {
        if (r.from != null && ts.isBefore(r.from!)) return false;
        if (r.to != null && ts.isAfter(r.to!)) return false;
      }
      if (q.isNotEmpty) {
        final id = (c['_id'] ?? c['id'] ?? c['referenceId'] ?? '').toString().toLowerCase();
        if (!id.contains(q)) return false;
      }
      return true;
    }).toList();
    out.sort((a, b) =>
        (DateTime.tryParse(b['createdAt']?.toString() ?? '') ?? DateTime(0))
            .compareTo(DateTime.tryParse(a['createdAt']?.toString() ?? '') ?? DateTime(0)));
    return out;
  }

  @override
  Widget build(BuildContext context) {
    final filtered = _filtered;
    final totalPts = filtered.fold<num>(0, (s, c) => s + _pointsOf(c));
    final activeCount = filtered.where((c) => (c['status'] ?? 'active').toString() == 'active').length;

    return Scaffold(
      appBar: AppBar(title: const Text('All Reward Clubs')),
      body: _loading
          ? const Center(child: CircularProgressIndicator())
          : ListView(
              padding: const EdgeInsets.all(12),
              children: [
                // Filter
                Container(
                  padding: const EdgeInsets.all(12),
                  decoration: BoxDecoration(
                    color: Colors.white,
                    borderRadius: BorderRadius.circular(14),
                    border: Border.all(color: AppColors.border),
                  ),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(
                        children: const [
                          Icon(Icons.calendar_today_rounded, size: 14, color: AppColors.textMuted),
                          SizedBox(width: 6),
                          Text('DATE FILTER',
                              style: TextStyle(fontSize: 10, fontWeight: FontWeight.w800, color: AppColors.textMuted, letterSpacing: 0.5)),
                        ],
                      ),
                      const SizedBox(height: 10),
                      Wrap(
                        spacing: 6,
                        runSpacing: 6,
                        children: [
                          for (final p in const [
                            ['all', 'All time'],
                            ['7d', 'Last 7 days'],
                            ['30d', 'Last 30 days'],
                            ['90d', 'Last 90 days'],
                            ['custom', 'Custom'],
                          ])
                            _chip(p[0], p[1]),
                        ],
                      ),
                      if (_preset == 'custom') ...[
                        const SizedBox(height: 10),
                        Row(
                          children: [
                            Expanded(child: _dateField('From', _from, (d) => setState(() => _from = d))),
                            const SizedBox(width: 8),
                            Expanded(child: _dateField('To', _to, (d) => setState(() => _to = d))),
                          ],
                        ),
                      ],
                      const SizedBox(height: 10),
                      TextField(
                        decoration: InputDecoration(
                          hintText: 'Search by club ID…',
                          prefixIcon: const Icon(Icons.search, size: 18),
                          contentPadding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                          isDense: true,
                          border: OutlineInputBorder(borderRadius: BorderRadius.circular(10)),
                        ),
                        onChanged: (v) => setState(() => _query = v),
                      ),
                    ],
                  ),
                ),
                const SizedBox(height: 10),

                // Stats
                Row(
                  children: [
                    Expanded(child: _smallStat('Showing', '${filtered.length}', AppColors.textPrimary)),
                    const SizedBox(width: 8),
                    Expanded(child: _smallStat('Active', '$activeCount', AppColors.success)),
                    const SizedBox(width: 8),
                    Expanded(child: _smallStat('Points', '$totalPts', const Color(0xFFD97706))),
                  ],
                ),
                const SizedBox(height: 10),

                if (filtered.isEmpty)
                  Container(
                    padding: const EdgeInsets.all(24),
                    decoration: BoxDecoration(
                      color: Colors.white,
                      borderRadius: BorderRadius.circular(14),
                      border: Border.all(color: AppColors.border),
                    ),
                    child: const Column(
                      children: [
                        Text('📭', style: TextStyle(fontSize: 32)),
                        SizedBox(height: 6),
                        Text('No clubs match this filter',
                            style: TextStyle(fontSize: 13, fontWeight: FontWeight.w700)),
                      ],
                    ),
                  )
                else
                  ...filtered.map(_card),
              ],
            ),
    );
  }

  Widget _chip(String key, String label) {
    final selected = _preset == key;
    return GestureDetector(
      onTap: () => setState(() => _preset = key),
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
        decoration: BoxDecoration(
          color: selected ? const Color(0xFFFB923C) : AppColors.divider,
          borderRadius: BorderRadius.circular(8),
        ),
        child: Text(label,
            style: TextStyle(
                fontSize: 11,
                fontWeight: FontWeight.w700,
                color: selected ? Colors.white : AppColors.textPrimary)),
      ),
    );
  }

  Widget _dateField(String label, DateTime? value, ValueChanged<DateTime?> onPick) {
    return InkWell(
      onTap: () async {
        final d = await showDatePicker(
          context: context,
          initialDate: value ?? DateTime.now(),
          firstDate: DateTime(2020),
          lastDate: DateTime.now().add(const Duration(days: 1)),
        );
        if (d != null) onPick(d);
      },
      child: InputDecorator(
        decoration: InputDecoration(
          labelText: label,
          isDense: true,
          contentPadding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
          border: OutlineInputBorder(borderRadius: BorderRadius.circular(10)),
        ),
        child: Text(value != null ? '${value.day}/${value.month}/${value.year}' : 'Select',
            style: const TextStyle(fontSize: 13)),
      ),
    );
  }

  Widget _smallStat(String label, String value, Color color) {
    return Container(
      padding: const EdgeInsets.all(10),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: AppColors.border),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(label.toUpperCase(),
              style: TextStyle(fontSize: 9, fontWeight: FontWeight.w800, color: color, letterSpacing: 0.5)),
          const SizedBox(height: 4),
          Text(value, style: const TextStyle(fontSize: 18, fontWeight: FontWeight.w900)),
        ],
      ),
    );
  }

  Widget _card(dynamic c) {
    final pts = _pointsOf(c);
    final status = (c['status'] ?? 'active').toString().toLowerCase();
    final isActive = status == 'active';
    final id = (c['_id'] ?? c['id'] ?? c['referenceId'] ?? '').toString();
    final d = DateTime.tryParse(c['createdAt']?.toString() ?? '');

    return Container(
      margin: const EdgeInsets.only(bottom: 8),
      padding: const EdgeInsets.all(10),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: AppColors.border),
      ),
      child: Row(
        children: [
          Container(
            width: 38,
            height: 38,
            decoration: BoxDecoration(
              gradient: LinearGradient(
                colors: isActive
                    ? [const Color(0xFFFCD34D), const Color(0xFFFB923C)]
                    : [Colors.grey.shade300, Colors.grey.shade400],
              ),
              borderRadius: BorderRadius.circular(10),
            ),
            child: Icon(isActive ? Icons.workspace_premium_rounded : Icons.access_time_rounded,
                color: Colors.white, size: 18),
          ),
          const SizedBox(width: 10),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text('Club #${id.length >= 6 ? id.substring(id.length - 6).toUpperCase() : id.toUpperCase()}',
                    style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w800)),
                if (d != null)
                  Text('${d.day}/${d.month}/${d.year}',
                      style: const TextStyle(fontSize: 10, color: AppColors.textMuted)),
              ],
            ),
          ),
          Column(
            crossAxisAlignment: CrossAxisAlignment.end,
            children: [
              Text('+$pts', style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w900, color: Color(0xFFD97706))),
              const Text('pts', style: TextStyle(fontSize: 9, color: AppColors.textMuted, fontWeight: FontWeight.w700)),
            ],
          ),
        ],
      ),
    );
  }
}
