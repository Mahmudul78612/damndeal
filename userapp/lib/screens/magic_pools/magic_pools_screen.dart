import 'package:flutter/material.dart';
import 'package:cached_network_image/cached_network_image.dart';
import '../../services/api_service.dart';
import '../../theme/app_theme.dart';
import '../../config.dart';

class MagicPoolsScreen extends StatefulWidget {
  const MagicPoolsScreen({super.key});

  @override
  State<MagicPoolsScreen> createState() => _MagicPoolsScreenState();
}

class _MagicPoolsScreenState extends State<MagicPoolsScreen> {
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
      final r = await _api.get('/user/magic-pools');
      _pools = List<dynamic>.from(r['pools'] ?? []);
    } catch (_) {}
    if (mounted) setState(() => _loading = false);
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Magic Pools'),
        actions: [
          IconButton(
            icon: const Icon(Icons.confirmation_num_outlined),
            tooltip: 'My Tickets',
            onPressed: () => Navigator.pushNamed(context, '/magic-pools/mine'),
          ),
        ],
      ),
      body: RefreshIndicator(
        onRefresh: () async => _load(),
        child: _loading
            ? const Center(child: CircularProgressIndicator())
            : ListView(
                padding: const EdgeInsets.all(12),
                children: [
                  // Hero
                  Container(
                    padding: const EdgeInsets.all(14),
                    decoration: BoxDecoration(
                      gradient: const LinearGradient(
                        colors: [Color(0xFF7C3AED), Color(0xFFEC4899), Color(0xFFFB923C)],
                      ),
                      borderRadius: BorderRadius.circular(16),
                    ),
                    child: Row(
                      children: const [
                        Icon(Icons.workspace_premium_rounded, color: Colors.white, size: 28),
                        SizedBox(width: 10),
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text('Magic Pools',
                                  style: TextStyle(color: Colors.white, fontSize: 16, fontWeight: FontWeight.w900)),
                              SizedBox(height: 2),
                              Text('Join with delivered order · Pool fills · Wheel spins · Winner takes all',
                                  style: TextStyle(color: Colors.white70, fontSize: 11)),
                            ],
                          ),
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(height: 12),

                  if (_pools.isEmpty)
                    Container(
                      padding: const EdgeInsets.all(40),
                      decoration: BoxDecoration(
                        color: Colors.white,
                        borderRadius: BorderRadius.circular(14),
                        border: Border.all(color: AppColors.border),
                      ),
                      child: const Column(
                        children: [
                          Text('🎰', style: TextStyle(fontSize: 40)),
                          SizedBox(height: 8),
                          Text('No pools open right now',
                              style: TextStyle(fontSize: 14, fontWeight: FontWeight.w700)),
                          Text('Check back soon!', style: TextStyle(fontSize: 11, color: AppColors.textMuted)),
                        ],
                      ),
                    )
                  else
                    ..._pools.map(_poolCard),
                ],
              ),
      ),
    );
  }

  Widget _poolCard(dynamic p) {
    final capacity = (p['capacity'] ?? 0) as num;
    final count = (p['participantsCount'] ?? 0) as num;
    final pct = capacity > 0 ? (count / capacity * 100).clamp(0, 100) : 0;
    final status = (p['status'] ?? 'open').toString();
    final joined = p['joined'] == true;
    final isFull = p['isFull'] == true;
    final tagline = p['tagline']?.toString();
    final image = p['imageUrl']?.toString() ?? '';
    final theme = (p['theme'] ?? 'fuchsia').toString();
    final colors = _themeColors(theme);

    return InkWell(
      onTap: () => Navigator.pushNamed(context, '/magic-pools/detail', arguments: p['_id']?.toString()),
      child: Container(
        margin: const EdgeInsets.only(bottom: 10),
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(14),
          border: Border.all(color: AppColors.border),
        ),
        clipBehavior: Clip.hardEdge,
        child: Row(
          children: [
            // Image
            SizedBox(
              width: 130,
              height: 100,
              child: Stack(
                fit: StackFit.expand,
                children: [
                  if (image.isNotEmpty)
                    CachedNetworkImage(
                      imageUrl: image.startsWith('http') ? image : '${AppConfig.uploadsBase}/$image',
                      fit: BoxFit.cover,
                      errorWidget: (_, __, ___) => Container(
                        decoration: BoxDecoration(gradient: LinearGradient(colors: colors)),
                        child: const Icon(Icons.workspace_premium_rounded, color: Colors.white, size: 36),
                      ),
                    )
                  else
                    Container(
                      decoration: BoxDecoration(gradient: LinearGradient(colors: colors)),
                      child: const Icon(Icons.workspace_premium_rounded, color: Colors.white, size: 36),
                    ),
                  if (tagline != null && tagline.isNotEmpty)
                    Positioned(
                      top: 6,
                      left: 6,
                      child: Container(
                        padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                        decoration: BoxDecoration(color: Colors.black54, borderRadius: BorderRadius.circular(4)),
                        child: Text(tagline,
                            style: const TextStyle(color: Colors.white, fontSize: 9, fontWeight: FontWeight.w800)),
                      ),
                    ),
                  if (joined)
                    Positioned(
                      bottom: 6,
                      left: 6,
                      child: Container(
                        padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                        decoration: BoxDecoration(color: Colors.green.shade600, borderRadius: BorderRadius.circular(4)),
                        child: const Text('JOINED',
                            style: TextStyle(color: Colors.white, fontSize: 9, fontWeight: FontWeight.w800)),
                      ),
                    )
                  else if (status == 'drawing')
                    Positioned(
                      bottom: 6,
                      left: 6,
                      child: Container(
                        padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                        decoration: BoxDecoration(color: Colors.purple.shade600, borderRadius: BorderRadius.circular(4)),
                        child: const Text('SPINNING',
                            style: TextStyle(color: Colors.white, fontSize: 9, fontWeight: FontWeight.w800)),
                      ),
                    )
                  else if (pct >= 70 && status == 'open')
                    Positioned(
                      bottom: 6,
                      left: 6,
                      child: Container(
                        padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                        decoration: BoxDecoration(color: Colors.red.shade600, borderRadius: BorderRadius.circular(4)),
                        child: const Row(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            Icon(Icons.local_fire_department, color: Colors.white, size: 10),
                            SizedBox(width: 2),
                            Text('HOT', style: TextStyle(color: Colors.white, fontSize: 9, fontWeight: FontWeight.w800)),
                          ],
                        ),
                      ),
                    ),
                ],
              ),
            ),
            // Body
            Expanded(
              child: Padding(
                padding: const EdgeInsets.all(10),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Text(p['name']?.toString() ?? '',
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w800)),
                    const SizedBox(height: 2),
                    Text(p['prizeDescription']?.toString() ?? '',
                        maxLines: 2,
                        overflow: TextOverflow.ellipsis,
                        style: const TextStyle(fontSize: 11, color: AppColors.textMuted)),
                    const SizedBox(height: 8),
                    Row(
                      children: [
                        Icon(Icons.people_alt_rounded, size: 12, color: colors.first),
                        const SizedBox(width: 3),
                        Text('$count / $capacity',
                            style: TextStyle(fontSize: 11, fontWeight: FontWeight.w700, color: colors.first)),
                        const Spacer(),
                        Text(isFull ? 'Full' : '${capacity - count} left',
                            style: const TextStyle(fontSize: 10, color: AppColors.textMuted, fontWeight: FontWeight.w600)),
                      ],
                    ),
                    const SizedBox(height: 4),
                    ClipRRect(
                      borderRadius: BorderRadius.circular(20),
                      child: LinearProgressIndicator(
                        value: pct / 100,
                        minHeight: 4,
                        backgroundColor: Colors.grey.shade200,
                        valueColor: AlwaysStoppedAnimation(colors.first),
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  List<Color> _themeColors(String theme) {
    switch (theme) {
      case 'amber': return [const Color(0xFFFB923C), const Color(0xFFF59E0B)];
      case 'emerald': return [const Color(0xFF10B981), const Color(0xFF059669)];
      case 'sky': return [const Color(0xFF0EA5E9), const Color(0xFF0284C7)];
      case 'violet': return [const Color(0xFF7C3AED), const Color(0xFF6D28D9)];
      case 'rose': return [const Color(0xFFF43F5E), const Color(0xFFE11D48)];
      case 'cosmic': return [const Color(0xFF6366F1), const Color(0xFFEC4899)];
      case 'gold': return [const Color(0xFFFBBF24), const Color(0xFFF59E0B)];
      case 'fuchsia':
      default: return [const Color(0xFFEC4899), const Color(0xFFD946EF)];
    }
  }
}
