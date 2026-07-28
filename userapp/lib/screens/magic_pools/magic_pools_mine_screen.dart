import 'package:flutter/material.dart';
import 'package:cached_network_image/cached_network_image.dart';
import '../../services/api_service.dart';
import '../../theme/app_theme.dart';
import '../../config.dart';

class MagicPoolsMineScreen extends StatefulWidget {
  const MagicPoolsMineScreen({super.key});

  @override
  State<MagicPoolsMineScreen> createState() => _MagicPoolsMineScreenState();
}

class _MagicPoolsMineScreenState extends State<MagicPoolsMineScreen> {
  final _api = ApiService();
  List<dynamic> _pools = [];
  bool _loading = true;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    try {
      final r = await _api.get('/user/magic-pools/mine');
      _pools = List<dynamic>.from(r['pools'] ?? []);
    } catch (_) {}
    if (mounted) setState(() => _loading = false);
  }

  @override
  Widget build(BuildContext context) {
    final wins = _pools.where((p) => p['isWinner'] == true).toList();
    final active = _pools.where((p) {
      final s = (p['status'] ?? '').toString();
      return p['isWinner'] != true && (s == 'open' || s == 'drawing');
    }).toList();
    final past = _pools.where((p) {
      final s = (p['status'] ?? '').toString();
      return p['isWinner'] != true && (s == 'drawn' || s == 'cancelled');
    }).toList();

    return Scaffold(
      appBar: AppBar(title: const Text('My Magic Pools')),
      body: RefreshIndicator(
        onRefresh: () async => _load(),
        child: _loading
            ? const Center(child: CircularProgressIndicator())
            : ListView(
                padding: const EdgeInsets.all(12),
                children: [
                  // Stats
                  Row(
                    children: [
                      Expanded(child: _stat('Tickets', '${_pools.length}', AppColors.primary)),
                      const SizedBox(width: 8),
                      Expanded(child: _stat('Wins', '${wins.length}', const Color(0xFFD97706))),
                      const SizedBox(width: 8),
                      Expanded(child: _stat('Active', '${active.length}', AppColors.success)),
                      const SizedBox(width: 8),
                      Expanded(child: _stat('Past', '${past.length}', AppColors.textMuted)),
                    ],
                  ),
                  const SizedBox(height: 14),

                  if (_pools.isEmpty)
                    Container(
                      padding: const EdgeInsets.all(40),
                      decoration: BoxDecoration(
                        color: Colors.white,
                        borderRadius: BorderRadius.circular(14),
                        border: Border.all(color: AppColors.border),
                      ),
                      child: Column(
                        children: [
                          const Text('🎫', style: TextStyle(fontSize: 40)),
                          const SizedBox(height: 8),
                          const Text('No tickets yet',
                              style: TextStyle(fontSize: 14, fontWeight: FontWeight.w700)),
                          const SizedBox(height: 8),
                          ElevatedButton(
                            onPressed: () => Navigator.pushReplacementNamed(context, '/magic-pools'),
                            child: const Text('Browse Pools'),
                          ),
                        ],
                      ),
                    ),

                  if (wins.isNotEmpty) ...[
                    _sectionHeader('Your Wins 🏆', const Color(0xFFD97706)),
                    ...wins.map((p) => _poolCard(p, accent: const Color(0xFFD97706))),
                    const SizedBox(height: 12),
                  ],
                  if (active.isNotEmpty) ...[
                    _sectionHeader('Active Tickets', AppColors.success),
                    ...active.map(_poolCard),
                    const SizedBox(height: 12),
                  ],
                  if (past.isNotEmpty) ...[
                    _sectionHeader('Past Pools', AppColors.textMuted),
                    ...past.map((p) => _poolCard(p, faded: true)),
                  ],
                ],
              ),
      ),
    );
  }

  Widget _stat(String label, String value, Color color) {
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
              style: TextStyle(fontSize: 9, fontWeight: FontWeight.w800, color: color)),
          const SizedBox(height: 4),
          Text(value, style: const TextStyle(fontSize: 18, fontWeight: FontWeight.w900)),
        ],
      ),
    );
  }

  Widget _sectionHeader(String label, Color color) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(4, 6, 4, 8),
      child: Text(label.toUpperCase(),
          style: TextStyle(fontSize: 11, fontWeight: FontWeight.w800, color: color, letterSpacing: 0.5)),
    );
  }

  Widget _poolCard(dynamic p, {Color? accent, bool faded = false}) {
    final image = p['imageUrl']?.toString() ?? '';
    final status = (p['status'] ?? '').toString();
    final isWinner = p['isWinner'] == true;
    final joinedDate = DateTime.tryParse(p['joinedAt']?.toString() ?? '');

    return InkWell(
      onTap: () => Navigator.pushNamed(context, '/magic-pools/detail', arguments: p['_id']?.toString()),
      child: Container(
        margin: const EdgeInsets.only(bottom: 8),
        padding: const EdgeInsets.all(10),
        decoration: BoxDecoration(
          color: faded ? AppColors.divider : Colors.white,
          borderRadius: BorderRadius.circular(12),
          border: Border.all(color: accent ?? AppColors.border),
        ),
        child: Row(
          children: [
            ClipRRect(
              borderRadius: BorderRadius.circular(8),
              child: SizedBox(
                width: 64,
                height: 64,
                child: image.isNotEmpty
                    ? CachedNetworkImage(
                        imageUrl: image.startsWith('http') ? image : '${AppConfig.uploadsBase}/$image',
                        fit: BoxFit.cover,
                        errorWidget: (_, __, ___) => Container(
                          color: AppColors.divider,
                          child: const Icon(Icons.workspace_premium_rounded, color: AppColors.textMuted),
                        ),
                      )
                    : Container(
                        color: AppColors.divider,
                        child: const Icon(Icons.workspace_premium_rounded, color: AppColors.textMuted),
                      ),
              ),
            ),
            const SizedBox(width: 10),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      Expanded(
                        child: Text(p['name']?.toString() ?? '',
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                            style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w800)),
                      ),
                      if (isWinner)
                        Container(
                          padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                          decoration: BoxDecoration(color: const Color(0xFFFEF3C7), borderRadius: BorderRadius.circular(4)),
                          child: const Text('WON',
                              style: TextStyle(fontSize: 9, fontWeight: FontWeight.w800, color: Color(0xFFD97706))),
                        )
                      else
                        Text(status.toUpperCase(),
                            style: const TextStyle(fontSize: 9, color: AppColors.textMuted, fontWeight: FontWeight.w700)),
                    ],
                  ),
                  if (p['prizeDescription'] != null)
                    Padding(
                      padding: const EdgeInsets.only(top: 2),
                      child: Text(p['prizeDescription'].toString(),
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          style: const TextStyle(fontSize: 11, color: AppColors.textMuted)),
                    ),
                  if (joinedDate != null)
                    Padding(
                      padding: const EdgeInsets.only(top: 2),
                      child: Text('Joined ${joinedDate.day}/${joinedDate.month}/${joinedDate.year}',
                          style: const TextStyle(fontSize: 10, color: AppColors.textMuted)),
                    ),
                ],
              ),
            ),
            const Icon(Icons.chevron_right_rounded, color: AppColors.textMuted),
          ],
        ),
      ),
    );
  }
}
