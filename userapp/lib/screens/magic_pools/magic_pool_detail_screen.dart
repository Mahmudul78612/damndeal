import 'package:flutter/material.dart';
import 'package:cached_network_image/cached_network_image.dart';
import '../../services/api_service.dart';
import '../../theme/app_theme.dart';
import '../../config.dart';

class MagicPoolDetailScreen extends StatefulWidget {
  const MagicPoolDetailScreen({super.key});

  @override
  State<MagicPoolDetailScreen> createState() => _MagicPoolDetailScreenState();
}

class _MagicPoolDetailScreenState extends State<MagicPoolDetailScreen> with SingleTickerProviderStateMixin {
  final _api = ApiService();
  Map<String, dynamic>? _pool;
  bool _loading = true;
  bool _joining = false;
  String? _poolId;
  late AnimationController _wheelCtl;

  @override
  void initState() {
    super.initState();
    _wheelCtl = AnimationController(vsync: this, duration: const Duration(seconds: 3))..repeat();
  }

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    final id = ModalRoute.of(context)?.settings.arguments as String?;
    if (id != null && _poolId != id) {
      _poolId = id;
      _load();
    }
  }

  @override
  void dispose() {
    _wheelCtl.dispose();
    super.dispose();
  }

  Future<void> _load() async {
    setState(() => _loading = true);
    try {
      final r = await _api.get('/user/magic-pools/$_poolId');
      _pool = Map<String, dynamic>.from(r['pool'] ?? r);
    } catch (_) {}
    if (mounted) setState(() => _loading = false);
  }

  Future<List<dynamic>> _fetchEligibleOrders() async {
    try {
      final r = await _api.get('/user/orders');
      final orders = List<dynamic>.from(r['orders'] ?? []);
      return orders.where((o) => (o['status'] ?? '').toString().toLowerCase() == 'delivered').toList();
    } catch (_) {
      return [];
    }
  }

  Future<void> _showJoinSheet() async {
    final orders = await _fetchEligibleOrders();
    if (!mounted) return;
    if (orders.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('No delivered orders available to join')),
      );
      return;
    }
    String? selectedId = orders.first['_id']?.toString();

    await showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      shape: const RoundedRectangleBorder(borderRadius: BorderRadius.vertical(top: Radius.circular(20))),
      builder: (ctx) {
        return StatefulBuilder(
          builder: (ctx, setSheet) => Padding(
            padding: EdgeInsets.only(
              left: 16, right: 16, top: 16,
              bottom: 16 + MediaQuery.of(ctx).viewInsets.bottom,
            ),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Text('Grab My Ticket', style: TextStyle(fontSize: 16, fontWeight: FontWeight.w900)),
                const SizedBox(height: 4),
                const Text('Pick which delivered order to use as your ticket.',
                    style: TextStyle(fontSize: 12, color: AppColors.textMuted)),
                const SizedBox(height: 12),
                ConstrainedBox(
                  constraints: const BoxConstraints(maxHeight: 260),
                  child: ListView(
                    shrinkWrap: true,
                    children: orders.map((o) {
                      final id = o['_id']?.toString();
                      final num = o['orderNumber']?.toString() ?? id?.substring((id.length - 6).clamp(0, id.length)) ?? '';
                      return RadioListTile<String>(
                        value: id ?? '',
                        groupValue: selectedId,
                        onChanged: (v) => setSheet(() => selectedId = v),
                        title: Text('Order #$num', style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w700)),
                        subtitle: Text('₹${(o['grandTotal'] ?? 0).toString()} · ${(o['items'] as List?)?.length ?? 0} items',
                            style: const TextStyle(fontSize: 11)),
                        dense: true,
                      );
                    }).toList(),
                  ),
                ),
                const SizedBox(height: 12),
                SizedBox(
                  width: double.infinity,
                  child: ElevatedButton(
                    onPressed: _joining || selectedId == null
                        ? null
                        : () async {
                            Navigator.pop(ctx);
                            await _join(selectedId!);
                          },
                    child: _joining
                        ? const SizedBox(width: 18, height: 18, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white))
                        : const Text('Confirm Ticket'),
                  ),
                ),
              ],
            ),
          ),
        );
      },
    );
  }

  Future<void> _join(String orderId) async {
    setState(() => _joining = true);
    try {
      await _api.post('/user/magic-pools/$_poolId/join', {'orderId': orderId});
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('🎉 You\'re in!')));
      await _load();
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(e.toString())));
    } finally {
      if (mounted) setState(() => _joining = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    if (_loading || _pool == null) {
      return Scaffold(
        appBar: AppBar(title: const Text('Magic Pool')),
        body: const Center(child: CircularProgressIndicator()),
      );
    }
    final p = _pool!;
    final capacity = (p['capacity'] ?? 0) as num;
    final count = (p['participantsCount'] ?? 0) as num;
    final pct = capacity > 0 ? (count / capacity * 100).clamp(0, 100) : 0;
    final status = (p['status'] ?? 'open').toString();
    final joined = p['joined'] == true;
    final isFull = p['isFull'] == true;
    final canJoin = status == 'open' && !joined && !isFull;
    final theme = (p['theme'] ?? 'fuchsia').toString();
    final colors = _themeColors(theme);
    final image = p['imageUrl']?.toString() ?? '';

    return Scaffold(
      appBar: AppBar(title: Text(p['name']?.toString() ?? 'Magic Pool', overflow: TextOverflow.ellipsis)),
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          // Image / wheel
          AspectRatio(
            aspectRatio: 16 / 9,
            child: ClipRRect(
              borderRadius: BorderRadius.circular(16),
              child: Stack(
                fit: StackFit.expand,
                children: [
                  if (image.isNotEmpty)
                    CachedNetworkImage(
                      imageUrl: image.startsWith('http') ? image : '${AppConfig.uploadsBase}/$image',
                      fit: BoxFit.cover,
                      errorWidget: (_, __, ___) => Container(
                        decoration: BoxDecoration(gradient: LinearGradient(colors: colors)),
                        child: const Icon(Icons.workspace_premium_rounded, color: Colors.white, size: 60),
                      ),
                    )
                  else
                    Container(
                      decoration: BoxDecoration(gradient: LinearGradient(colors: colors)),
                      child: const Icon(Icons.workspace_premium_rounded, color: Colors.white, size: 60),
                    ),
                  if (status == 'drawing')
                    Container(
                      color: Colors.black54,
                      alignment: Alignment.center,
                      child: RotationTransition(
                        turns: _wheelCtl,
                        child: const Icon(Icons.refresh_rounded, color: Colors.white, size: 60),
                      ),
                    ),
                ],
              ),
            ),
          ),
          const SizedBox(height: 14),
          if (joined)
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
              margin: const EdgeInsets.only(bottom: 8),
              decoration: BoxDecoration(color: Colors.green.shade50, borderRadius: BorderRadius.circular(20)),
              child: Text('✓ You\'re In',
                  style: TextStyle(color: Colors.green.shade700, fontSize: 11, fontWeight: FontWeight.w800)),
            ),
          Text(p['name']?.toString() ?? '',
              style: const TextStyle(fontSize: 22, fontWeight: FontWeight.w900)),
          const SizedBox(height: 6),
          Text(p['description']?.toString() ?? '',
              style: const TextStyle(fontSize: 13, color: AppColors.textSecondary, height: 1.4)),
          const SizedBox(height: 14),

          // Prize block
          Container(
            padding: const EdgeInsets.all(14),
            decoration: BoxDecoration(
              gradient: LinearGradient(colors: colors.map((c) => c.withValues(alpha: 0.12)).toList()),
              borderRadius: BorderRadius.circular(14),
              border: Border.all(color: colors.first.withValues(alpha: 0.3)),
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text('THE PRIZE',
                    style: TextStyle(fontSize: 10, fontWeight: FontWeight.w800, color: colors.first, letterSpacing: 0.5)),
                const SizedBox(height: 6),
                Text(p['prizeDescription']?.toString() ?? '',
                    style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w900)),
                if ((p['prizePoints'] ?? 0) > 0)
                  Padding(
                    padding: const EdgeInsets.only(top: 4),
                    child: Text('+ ${p['prizePoints']} bonus points',
                        style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w700, color: AppColors.textMuted)),
                  ),
              ],
            ),
          ),

          const SizedBox(height: 14),

          // Progress
          Row(
            children: [
              Text('$count of $capacity joined',
                  style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w700)),
              const Spacer(),
              Text('${pct.toInt()}%',
                  style: TextStyle(fontSize: 13, fontWeight: FontWeight.w800, color: colors.first)),
            ],
          ),
          const SizedBox(height: 6),
          ClipRRect(
            borderRadius: BorderRadius.circular(20),
            child: LinearProgressIndicator(
              value: pct / 100,
              minHeight: 8,
              backgroundColor: Colors.grey.shade200,
              valueColor: AlwaysStoppedAnimation(colors.first),
            ),
          ),

          const SizedBox(height: 24),

          // CTA
          SizedBox(
            width: double.infinity,
            height: 50,
            child: ElevatedButton(
              onPressed: canJoin ? _showJoinSheet : null,
              style: ElevatedButton.styleFrom(
                backgroundColor: colors.first,
                disabledBackgroundColor: Colors.grey.shade300,
              ),
              child: Text(
                joined
                    ? 'Ticket Booked'
                    : isFull
                        ? 'Pool Full'
                        : status == 'drawing'
                            ? 'Spinning…'
                            : status == 'drawn'
                                ? 'Pool Drawn'
                                : status == 'cancelled'
                                    ? 'Cancelled'
                                    : 'Grab My Ticket',
                style: const TextStyle(fontSize: 15, fontWeight: FontWeight.w900),
              ),
            ),
          ),
          const SizedBox(height: 16),
        ],
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
