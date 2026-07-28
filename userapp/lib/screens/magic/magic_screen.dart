import 'package:flutter/material.dart';
import 'package:cached_network_image/cached_network_image.dart';
import '../../services/api_service.dart';
import '../../theme/app_theme.dart';
import '../../config.dart';

/// Magic tab — bottom-nav entry combining Magic Club + Magic Pools entry tiles
/// and a live list of active Magic Pools below.
class MagicScreen extends StatefulWidget {
  const MagicScreen({super.key});

  @override
  State<MagicScreen> createState() => _MagicScreenState();
}

class _MagicScreenState extends State<MagicScreen> {
  final _api = ApiService();
  List<dynamic> _pools = [];
  bool _loading = true;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load({bool forceRefresh = false}) async {
    if (_pools.isEmpty) setState(() => _loading = true);
    try {
      final r = await _api.getCached(
        '/user/magic-pools',
        ttl: const Duration(minutes: 10),
        staleAfter: forceRefresh ? Duration.zero : const Duration(seconds: 30),
        onUpdate: (fresh) {
          if (!mounted) return;
          setState(() => _pools = List<dynamic>.from(fresh['pools'] ?? []));
        },
      );
      _pools = List<dynamic>.from(r['pools'] ?? []);
    } catch (_) {}
    if (mounted) setState(() => _loading = false);
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFFF5F5F8),
      appBar: AppBar(
        title: const Text('Magic',
            style: TextStyle(fontWeight: FontWeight.w800, color: AppColors.textPrimary)),
        backgroundColor: Colors.white,
        elevation: 0.5,
        foregroundColor: AppColors.textPrimary,
        actions: [
          IconButton(
            icon: const Icon(Icons.confirmation_num_outlined),
            tooltip: 'My Tickets',
            onPressed: () => Navigator.pushNamed(context, '/magic-pools/mine'),
          ),
        ],
      ),
      body: RefreshIndicator(
        onRefresh: () => _load(forceRefresh: true),
        child: ListView(
          padding: const EdgeInsets.fromLTRB(12, 12, 12, 90),
          children: [
            // Hero gradient
            Container(
              padding: const EdgeInsets.all(16),
              decoration: BoxDecoration(
                gradient: const LinearGradient(
                  colors: [Color(0xFF7C3AED), Color(0xFFEC4899), Color(0xFFFB923C)],
                ),
                borderRadius: BorderRadius.circular(18),
              ),
              child: Row(
                children: const [
                  Icon(Icons.auto_awesome, color: Colors.white, size: 30),
                  SizedBox(width: 10),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text('Welcome to Magic',
                            style: TextStyle(
                                color: Colors.white, fontSize: 17, fontWeight: FontWeight.w900)),
                        SizedBox(height: 3),
                        Text('Earn rewards from clubs · Win prizes from pools',
                            style: TextStyle(color: Colors.white70, fontSize: 11)),
                      ],
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 14),

            // Two entry tiles
            Row(
              children: [
                Expanded(
                  child: _entryTile(
                    color: const Color(0xFF7C3AED),
                    icon: Icons.workspace_premium_rounded,
                    title: 'Magic Club',
                    subtitle: 'Reward clubs',
                    onTap: () => Navigator.pushNamed(context, '/magic-club'),
                  ),
                ),
                const SizedBox(width: 10),
                Expanded(
                  child: _entryTile(
                    color: const Color(0xFFEC4899),
                    icon: Icons.casino_rounded,
                    title: 'Magic Pool',
                    subtitle: 'Win prizes',
                    onTap: () => Navigator.pushNamed(context, '/magic-pools'),
                  ),
                ),
              ],
            ),

            const SizedBox(height: 18),
            const Padding(
              padding: EdgeInsets.symmetric(horizontal: 4),
              child: Row(
                children: [
                  Icon(Icons.local_fire_department_rounded, color: Color(0xFFFB923C), size: 20),
                  SizedBox(width: 6),
                  Text('Live Magic Pools',
                      style: TextStyle(
                          fontSize: 16, fontWeight: FontWeight.w800, color: AppColors.textPrimary)),
                ],
              ),
            ),
            const SizedBox(height: 10),

            if (_loading)
              const Padding(
                padding: EdgeInsets.symmetric(vertical: 30),
                child: Center(child: CircularProgressIndicator()),
              )
            else if (_pools.isEmpty)
              Container(
                padding: const EdgeInsets.symmetric(vertical: 32),
                decoration: BoxDecoration(
                  color: Colors.white,
                  borderRadius: BorderRadius.circular(12),
                ),
                child: const Center(
                  child: Column(
                    children: [
                      Icon(Icons.casino_outlined, size: 44, color: AppColors.textMuted),
                      SizedBox(height: 8),
                      Text('No active pools right now',
                          style: TextStyle(color: AppColors.textMuted, fontSize: 13)),
                    ],
                  ),
                ),
              )
            else
              ..._pools.map(_poolCard),
          ],
        ),
      ),
    );
  }

  Widget _entryTile({
    required Color color,
    required IconData icon,
    required String title,
    required String subtitle,
    required VoidCallback onTap,
  }) {
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(14),
      child: Container(
        padding: const EdgeInsets.all(14),
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(14),
          border: Border.all(color: color.withValues(alpha: 0.2)),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Container(
              padding: const EdgeInsets.all(8),
              decoration: BoxDecoration(
                color: color.withValues(alpha: 0.12),
                borderRadius: BorderRadius.circular(10),
              ),
              child: Icon(icon, color: color, size: 22),
            ),
            const SizedBox(height: 10),
            Text(title,
                style: const TextStyle(
                    fontSize: 14, fontWeight: FontWeight.w800, color: AppColors.textPrimary)),
            Text(subtitle,
                style: const TextStyle(fontSize: 11, color: AppColors.textMuted)),
          ],
        ),
      ),
    );
  }

  Widget _poolCard(dynamic p) {
    final pool = p as Map<String, dynamic>;
    final img = (pool['image'] ?? '').toString();
    final src = img.startsWith('http') ? img : '${AppConfig.uploadsBase}$img';
    final title = (pool['title'] ?? 'Magic Pool').toString();
    final prize = (pool['prizeName'] ?? '').toString();
    final filled = ((pool['filled'] ?? pool['ticketsSold'] ?? 0) as num).toInt();
    final total = ((pool['capacity'] ?? pool['totalTickets'] ?? 0) as num).toInt();
    final pct = total > 0 ? (filled / total).clamp(0.0, 1.0) : 0.0;
    final status = (pool['status'] ?? 'open').toString();

    Color badgeColor = const Color(0xFF7C3AED);
    String badgeText = 'OPEN';
    if (status == 'spinning') {
      badgeColor = const Color(0xFFFB923C);
      badgeText = 'SPINNING';
    } else if (filled >= total && total > 0) {
      badgeColor = const Color(0xFFEF4444);
      badgeText = 'HOT';
    }

    return GestureDetector(
      onTap: () =>
          Navigator.pushNamed(context, '/magic-pools/detail', arguments: pool['_id']?.toString()),
      child: Container(
        margin: const EdgeInsets.only(bottom: 10),
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(14),
          boxShadow: [
            BoxShadow(
                color: Colors.black.withValues(alpha: 0.04),
                blurRadius: 6,
                offset: const Offset(0, 2)),
          ],
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Stack(
              children: [
                ClipRRect(
                  borderRadius:
                      const BorderRadius.vertical(top: Radius.circular(14)),
                  child: AspectRatio(
                    aspectRatio: 16 / 9,
                    child: img.isNotEmpty
                        ? CachedNetworkImage(
                            imageUrl: src,
                            fit: BoxFit.cover,
                            fadeInDuration: Duration.zero,
                            placeholderFadeInDuration: Duration.zero,
                            errorWidget: (_, __, ___) =>
                                Container(color: Colors.grey.shade200),
                          )
                        : Container(
                            color: Colors.grey.shade200,
                            child: const Center(
                                child: Icon(Icons.casino_rounded,
                                    size: 50, color: AppColors.textMuted)),
                          ),
                  ),
                ),
                Positioned(
                  top: 8,
                  left: 8,
                  child: Container(
                    padding:
                        const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                    decoration: BoxDecoration(
                      color: badgeColor,
                      borderRadius: BorderRadius.circular(6),
                    ),
                    child: Text(badgeText,
                        style: const TextStyle(
                            color: Colors.white,
                            fontSize: 10,
                            fontWeight: FontWeight.w800)),
                  ),
                ),
              ],
            ),
            Padding(
              padding: const EdgeInsets.all(12),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(title,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: const TextStyle(
                          fontSize: 14,
                          fontWeight: FontWeight.w800,
                          color: AppColors.textPrimary)),
                  if (prize.isNotEmpty) ...[
                    const SizedBox(height: 2),
                    Text('Prize: $prize',
                        style: const TextStyle(
                            fontSize: 12, color: AppColors.textSecondary)),
                  ],
                  const SizedBox(height: 8),
                  ClipRRect(
                    borderRadius: BorderRadius.circular(4),
                    child: LinearProgressIndicator(
                      value: pct,
                      minHeight: 6,
                      backgroundColor: Colors.grey.shade200,
                      valueColor: const AlwaysStoppedAnimation(
                          Color(0xFF7C3AED)),
                    ),
                  ),
                  const SizedBox(height: 4),
                  Text('$filled / $total tickets',
                      style: const TextStyle(
                          fontSize: 11, color: AppColors.textMuted)),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}
