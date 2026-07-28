import 'package:flutter/material.dart';
import '../../services/api_service.dart';
import '../../theme/app_theme.dart';

class MagicClubScreen extends StatefulWidget {
  const MagicClubScreen({super.key});

  @override
  State<MagicClubScreen> createState() => _MagicClubScreenState();
}

class _MagicClubScreenState extends State<MagicClubScreen> {
  final _api = ApiService();
  Map<String, dynamic>? _wallet;
  List<dynamic> _clubs = [];
  bool _loading = true;
  bool _enabled = true;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() => _loading = true);
    try {
      final results = await Future.wait([
        _api.get('/user/magic-club/wallet'),
        _api.get('/user/magic-club'),
      ]);
      _wallet = results[0]['wallet'] != null
          ? Map<String, dynamic>.from(results[0])
          : Map<String, dynamic>.from(results[0]);
      _enabled = results[0]['enabled'] != false && results[1]['enabled'] != false;
      _clubs = List<dynamic>.from(results[1]['clubs'] ?? []);
      _clubs.sort((a, b) => DateTime.tryParse(b['createdAt']?.toString() ?? '')
              ?.compareTo(DateTime.tryParse(a['createdAt']?.toString() ?? '') ?? DateTime(0)) ??
          0);
    } catch (_) {}
    if (mounted) setState(() => _loading = false);
  }

  num _pointsOf(dynamic c) =>
      (c['totalRewards'] ?? c['rewardPoints'] ?? c['points'] ?? c['rewardAmount'] ?? c['amount'] ?? 0) as num;

  @override
  Widget build(BuildContext context) {
    final balance = (_wallet?['balance'] ?? 0) as num;
    final redeemable = (_wallet?['redeemable'] ?? (balance / 100)) as num;
    final lifetime = _clubs.fold<num>(0, (s, c) => s + _pointsOf(c));
    final activeCount = _clubs.where((c) => (c['status'] ?? 'active').toString() == 'active').length;

    return Scaffold(
      appBar: AppBar(title: const Text('Magic Club')),
      body: RefreshIndicator(
        onRefresh: _load,
        child: _loading
            ? ListView(children: const [SizedBox(height: 200, child: Center(child: CircularProgressIndicator()))])
            : ListView(
                padding: const EdgeInsets.all(16),
                children: [
                  if (!_enabled)
                    Container(
                      padding: const EdgeInsets.all(12),
                      margin: const EdgeInsets.only(bottom: 12),
                      decoration: BoxDecoration(
                        color: Colors.amber.shade50,
                        borderRadius: BorderRadius.circular(12),
                        border: Border.all(color: Colors.amber.shade200),
                      ),
                      child: const Text('Magic Club is currently disabled. Check back later.',
                          style: TextStyle(fontSize: 13, color: Color(0xFF92400E))),
                    ),

                  // Hero
                  Container(
                    padding: const EdgeInsets.all(20),
                    decoration: BoxDecoration(
                      gradient: const LinearGradient(
                        colors: [Color(0xFFFBBF24), Color(0xFFFB923C), Color(0xFFEC4899)],
                        begin: Alignment.topLeft,
                        end: Alignment.bottomRight,
                      ),
                      borderRadius: BorderRadius.circular(20),
                    ),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Row(
                          children: [
                            Container(
                              padding: const EdgeInsets.all(8),
                              decoration: BoxDecoration(
                                color: Colors.white.withValues(alpha: 0.25),
                                borderRadius: BorderRadius.circular(12),
                              ),
                              child: const Icon(Icons.workspace_premium_rounded, color: Colors.white, size: 22),
                            ),
                            const SizedBox(width: 10),
                            const Text('Magic Club Member',
                                style: TextStyle(color: Colors.white, fontSize: 13, fontWeight: FontWeight.w700)),
                          ],
                        ),
                        const SizedBox(height: 16),
                        Row(
                          crossAxisAlignment: CrossAxisAlignment.end,
                          children: [
                            Text('$balance',
                                style: const TextStyle(color: Colors.white, fontSize: 40, fontWeight: FontWeight.w900, height: 1)),
                            const SizedBox(width: 6),
                            const Padding(
                              padding: EdgeInsets.only(bottom: 6),
                              child: Text('pts',
                                  style: TextStyle(color: Colors.white, fontSize: 16, fontWeight: FontWeight.w700)),
                            ),
                          ],
                        ),
                        const SizedBox(height: 8),
                        Container(
                          padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                          decoration: BoxDecoration(
                            color: Colors.white.withValues(alpha: 0.25),
                            borderRadius: BorderRadius.circular(20),
                          ),
                          child: Text('Worth ₹${redeemable.toStringAsFixed(2)}',
                              style: const TextStyle(color: Colors.white, fontSize: 12, fontWeight: FontWeight.w700)),
                        ),
                        const SizedBox(height: 12),
                        Row(
                          children: [
                            const Icon(Icons.info_outline, color: Colors.white70, size: 13),
                            const SizedBox(width: 4),
                            Text('100 points = ₹1',
                                style: TextStyle(color: Colors.white.withValues(alpha: 0.85), fontSize: 11)),
                          ],
                        ),
                      ],
                    ),
                  ),

                  const SizedBox(height: 12),

                  // Stats
                  Row(
                    children: [
                      Expanded(child: _statCard('Lifetime Earned', '$lifetime pts', Icons.trending_up_rounded, AppColors.success)),
                      const SizedBox(width: 10),
                      Expanded(child: _statCard('Active Clubs', '$activeCount', Icons.star_rounded, AppColors.accent)),
                    ],
                  ),

                  const SizedBox(height: 12),

                  // Try Magic Pools CTA
                  InkWell(
                    onTap: () => Navigator.pushNamed(context, '/magic-pools'),
                    borderRadius: BorderRadius.circular(16),
                    child: Container(
                      padding: const EdgeInsets.all(14),
                      decoration: BoxDecoration(
                        gradient: const LinearGradient(colors: [Color(0xFF7C3AED), Color(0xFFEC4899)]),
                        borderRadius: BorderRadius.circular(16),
                      ),
                      child: Row(
                        children: [
                          const Icon(Icons.casino_rounded, color: Colors.white, size: 22),
                          const SizedBox(width: 10),
                          const Expanded(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text('Try Magic Pools',
                                    style: TextStyle(color: Colors.white, fontSize: 14, fontWeight: FontWeight.w800)),
                                Text('Spin to win bonus points',
                                    style: TextStyle(color: Colors.white70, fontSize: 11)),
                              ],
                            ),
                          ),
                          const Icon(Icons.arrow_forward_rounded, color: Colors.white, size: 18),
                        ],
                      ),
                    ),
                  ),

                  const SizedBox(height: 18),

                  // Clubs section header
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      const Text('YOUR REWARD CLUBS',
                          style: TextStyle(fontSize: 11, fontWeight: FontWeight.w800, color: AppColors.textMuted, letterSpacing: 0.5)),
                      if (_clubs.length > 2)
                        TextButton(
                          onPressed: () => Navigator.pushNamed(context, '/magic-club/all'),
                          style: TextButton.styleFrom(padding: EdgeInsets.zero, minimumSize: const Size(40, 28)),
                          child: const Row(
                            children: [
                              Text('View all', style: TextStyle(fontSize: 11, fontWeight: FontWeight.w800, color: Color(0xFFD97706))),
                              Icon(Icons.chevron_right, size: 14, color: Color(0xFFD97706)),
                            ],
                          ),
                        ),
                    ],
                  ),
                  const SizedBox(height: 8),

                  if (_clubs.isEmpty)
                    Container(
                      padding: const EdgeInsets.all(24),
                      decoration: BoxDecoration(
                        color: Colors.white,
                        borderRadius: BorderRadius.circular(16),
                        border: Border.all(color: AppColors.border, style: BorderStyle.solid),
                      ),
                      child: Column(
                        children: [
                          const Text('🎁', style: TextStyle(fontSize: 40)),
                          const SizedBox(height: 8),
                          const Text('No reward clubs yet',
                              style: TextStyle(fontSize: 14, fontWeight: FontWeight.w700)),
                          const SizedBox(height: 4),
                          const Text('Place an order — when delivered, earn a Magic Club!',
                              textAlign: TextAlign.center,
                              style: TextStyle(fontSize: 11, color: AppColors.textMuted)),
                          const SizedBox(height: 12),
                          ElevatedButton(
                            onPressed: () => Navigator.pushNamedAndRemoveUntil(context, '/main', (_) => false),
                            style: ElevatedButton.styleFrom(
                              backgroundColor: const Color(0xFFFB923C),
                              padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 10),
                            ),
                            child: const Text('Start Shopping', style: TextStyle(fontSize: 12, fontWeight: FontWeight.w800)),
                          ),
                        ],
                      ),
                    )
                  else ...[
                    ..._clubs.take(2).map(_clubCard),
                    if (_clubs.length > 2)
                      Padding(
                        padding: const EdgeInsets.only(top: 8),
                        child: OutlinedButton(
                          onPressed: () => Navigator.pushNamed(context, '/magic-club/all'),
                          style: OutlinedButton.styleFrom(
                            foregroundColor: const Color(0xFFD97706),
                            side: const BorderSide(color: Color(0xFFFCD34D)),
                            minimumSize: const Size(double.infinity, 44),
                          ),
                          child: Text('View all ${_clubs.length} clubs →',
                              style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w800)),
                        ),
                      ),
                  ],

                  const SizedBox(height: 18),

                  // How it works
                  Container(
                    padding: const EdgeInsets.all(14),
                    decoration: BoxDecoration(
                      color: Colors.white,
                      borderRadius: BorderRadius.circular(16),
                      border: Border.all(color: AppColors.border),
                    ),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        const Text('How Magic Club works',
                            style: TextStyle(fontSize: 13, fontWeight: FontWeight.w800)),
                        const SizedBox(height: 10),
                        _howStep(1, 'Place an order on DamnDeal'),
                        _howStep(2, 'When delivered, you earn a Magic Club'),
                        _howStep(3, 'Use points at checkout — 100 pts = ₹1'),
                      ],
                    ),
                  ),
                ],
              ),
      ),
    );
  }

  Widget _statCard(String label, String value, IconData icon, Color color) {
    return Container(
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
            children: [
              Icon(icon, size: 14, color: color),
              const SizedBox(width: 4),
              Text(label.toUpperCase(),
                  style: const TextStyle(fontSize: 9, fontWeight: FontWeight.w800, color: AppColors.textMuted, letterSpacing: 0.5)),
            ],
          ),
          const SizedBox(height: 6),
          Text(value, style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w900)),
        ],
      ),
    );
  }

  Widget _clubCard(dynamic c) {
    final pts = _pointsOf(c);
    final status = (c['status'] ?? 'active').toString().toLowerCase();
    final isActive = status == 'active';
    final id = (c['_id'] ?? c['id'] ?? c['referenceId'] ?? '').toString();
    final dateStr = c['createdAt']?.toString();
    DateTime? d;
    if (dateStr != null) d = DateTime.tryParse(dateStr);

    return Container(
      margin: const EdgeInsets.only(bottom: 8),
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: AppColors.border),
      ),
      child: Row(
        children: [
          Container(
            width: 44,
            height: 44,
            decoration: BoxDecoration(
              gradient: LinearGradient(
                colors: isActive
                    ? [const Color(0xFFFBBF24), const Color(0xFFFB923C)]
                    : [Colors.grey.shade300, Colors.grey.shade400],
                begin: Alignment.topLeft,
                end: Alignment.bottomRight,
              ),
              borderRadius: BorderRadius.circular(12),
            ),
            child: const Icon(Icons.workspace_premium_rounded, color: Colors.white, size: 22),
          ),
          const SizedBox(width: 10),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    Text('Club #${id.length >= 6 ? id.substring(id.length - 6).toUpperCase() : id.toUpperCase()}',
                        style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w800)),
                    const SizedBox(width: 6),
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                      decoration: BoxDecoration(
                        color: isActive ? Colors.green.shade50 : Colors.grey.shade200,
                        borderRadius: BorderRadius.circular(20),
                      ),
                      child: Text(isActive ? 'Active' : status.toUpperCase(),
                          style: TextStyle(
                              fontSize: 9,
                              fontWeight: FontWeight.w800,
                              color: isActive ? Colors.green.shade700 : Colors.grey.shade600)),
                    ),
                  ],
                ),
                if (c['referenceId'] != null)
                  Padding(
                    padding: const EdgeInsets.only(top: 2),
                    child: Text('Order ${c['referenceId'].toString().substring((c['referenceId'].toString().length - 8).clamp(0, c['referenceId'].toString().length))}',
                        style: const TextStyle(fontSize: 10, color: AppColors.textMuted)),
                  ),
                if (d != null)
                  Padding(
                    padding: const EdgeInsets.only(top: 2),
                    child: Text('Earned ${d.day}/${d.month}/${d.year}',
                        style: const TextStyle(fontSize: 10, color: AppColors.textMuted)),
                  ),
              ],
            ),
          ),
          Column(
            crossAxisAlignment: CrossAxisAlignment.end,
            children: [
              Text('+$pts',
                  style: const TextStyle(fontSize: 17, fontWeight: FontWeight.w900, color: Color(0xFFD97706))),
              const Text('points', style: TextStyle(fontSize: 9, fontWeight: FontWeight.w700, color: AppColors.textMuted)),
            ],
          ),
        ],
      ),
    );
  }

  Widget _howStep(int n, String text) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 6),
      child: Row(
        children: [
          Container(
            width: 22,
            height: 22,
            decoration: BoxDecoration(
              color: const Color(0xFFFEF3C7),
              borderRadius: BorderRadius.circular(11),
            ),
            child: Center(
              child: Text('$n',
                  style: const TextStyle(fontSize: 11, fontWeight: FontWeight.w800, color: Color(0xFFD97706))),
            ),
          ),
          const SizedBox(width: 8),
          Expanded(child: Text(text, style: const TextStyle(fontSize: 12))),
        ],
      ),
    );
  }
}
