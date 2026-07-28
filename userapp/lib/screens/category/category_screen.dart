import 'package:flutter/material.dart';
import 'package:cached_network_image/cached_network_image.dart';
import '../../services/api_service.dart';
import '../../theme/app_theme.dart';
import '../../components/category_grid.dart';
import '../../components/shimmer_loader.dart';
import '../../config.dart';

class CategoryScreen extends StatefulWidget {
  const CategoryScreen({super.key});

  @override
  State<CategoryScreen> createState() => _CategoryScreenState();
}

class _CategoryScreenState extends State<CategoryScreen> {
  final _api = ApiService();
  List<dynamic> _categories = [];
  List<dynamic> _filtered = [];
  Map<String, dynamic>? _featuredCard;
  bool _loading = true;
  final _searchController = TextEditingController();

  @override
  void initState() {
    super.initState();
    _load();
  }

  @override
  void dispose() {
    _searchController.dispose();
    super.dispose();
  }

  Future<void> _load() async {
    setState(() => _loading = true);
    try {
      final results = await Future.wait([
        _api.get('/categories?platform=damndeal', auth: false),
        _api.get('/app-customization', auth: false),
      ]);
      _categories = results[0]['categories'] ?? [];
      _filtered = List.from(_categories);
      _featuredCard = results[1]['featuredCard'];
    } catch (_) {}
    if (mounted) setState(() => _loading = false);
  }

  void _onSearch(String query) {
    final q = query.trim().toLowerCase();
    setState(() {
      _filtered = q.isEmpty
          ? List.from(_categories)
          : _categories.where((c) =>
              (c['name'] ?? '').toString().toLowerCase().contains(q)).toList();
    });
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      extendBodyBehindAppBar: true,
      backgroundColor: const Color(0xFFF5F5F8),
      appBar: AppBar(
        title: const Text('Categories',
            style: TextStyle(color: Colors.black, fontWeight: FontWeight.w700, fontSize: 18)),
        backgroundColor: Colors.transparent,
        iconTheme: const IconThemeData(color: Colors.black),
        elevation: 0,
        bottom: PreferredSize(
          preferredSize: const Size.fromHeight(56),
          child: Padding(
            padding: const EdgeInsets.fromLTRB(16, 0, 16, 10),
            child: TextField(
              controller: _searchController,
              onChanged: _onSearch,
              style: const TextStyle(fontSize: 14),
              decoration: InputDecoration(
                hintText: 'Search categories...',
                hintStyle: TextStyle(color: Colors.grey[400], fontSize: 14),
                prefixIcon: const Icon(Icons.search, size: 20, color: AppColors.textMuted),
                suffixIcon: _searchController.text.isNotEmpty
                    ? IconButton(
                        icon: const Icon(Icons.close, size: 18),
                        onPressed: () {
                          _searchController.clear();
                          _onSearch('');
                        },
                      )
                    : null,
                filled: true,
                fillColor: Colors.white.withValues(alpha: 0.85),
                contentPadding: const EdgeInsets.symmetric(vertical: 10),
                border: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(10),
                  borderSide: BorderSide.none,
                ),
                enabledBorder: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(10),
                  borderSide: BorderSide.none,
                ),
                focusedBorder: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(10),
                  borderSide: const BorderSide(color: AppColors.primary, width: 1.2),
                ),
              ),
            ),
          ),
        ),
      ),
      body: Stack(
        children: [
          // Faded gradient — starts behind AppBar, fades to transparent
          Positioned(
            top: 0, left: 0, right: 0,
            height: MediaQuery.of(context).size.height * 0.28,
            child: Container(
              decoration: BoxDecoration(
                gradient: LinearGradient(
                  begin: Alignment.topCenter,
                  end: Alignment.bottomCenter,
                  colors: [
                    AppColors.primary.withValues(alpha: 0.30),
                    AppColors.primary.withValues(alpha: 0),
                  ],
                ),
              ),
            ),
          ),
          _loading
              ? const ShimmerGrid(count: 8)
              : _filtered.isEmpty
                  ? const Center(
                      child: Text('No categories found',
                          style: TextStyle(color: AppColors.textMuted)))
                  : RefreshIndicator(
                      onRefresh: _load,
                      child: SingleChildScrollView(
                        physics: const AlwaysScrollableScrollPhysics(),
                        padding: EdgeInsets.only(
                          top: MediaQuery.of(context).padding.top + kToolbarHeight + 56 + 8,
                          bottom: 24,
                        ),
                        child: Column(
                          children: [
                            CategoryGrid(
                              categories: _filtered,
                              onTap: (cat) => Navigator.pushNamed(
                                  context, '/subcategory', arguments: cat),
                            ),
                            if (_featuredCard != null) _buildFeaturedCard(),
                          ],
                        ),
                      ),
                    ),
        ],
      ),
    );
  }

  Widget _buildFeaturedCard() {
    final card = _featuredCard!;
    final bgImage = card['image'];
    final hasBg = bgImage != null && bgImage.toString().isNotEmpty;
    final bgSrc = hasBg
        ? (bgImage.toString().startsWith('http')
            ? bgImage
            : '${AppConfig.uploadsBase}$bgImage')
        : '';
    final sub = card['subcategory'] as Map<String, dynamic>?;
    final name = sub?['name'] ?? '';
    final catName = sub?['category']?['name'] ?? '';

    return GestureDetector(
      onTap: () {
        Navigator.pushNamed(context, '/subcategory', arguments: {
          '_id': sub?['category']?['_id'] ?? '',
          'name': catName,
          'preselectedSubcategory': sub?['_id'],
        });
      },
      child: Container(
        margin: const EdgeInsets.fromLTRB(16, 12, 16, 0),
        decoration: BoxDecoration(
          borderRadius: BorderRadius.circular(14),
          boxShadow: [
            BoxShadow(
              color: Colors.black.withValues(alpha: 0.08),
              blurRadius: 10,
              offset: const Offset(0, 4),
            ),
          ],
        ),
        child: ClipRRect(
          borderRadius: BorderRadius.circular(14),
          child: AspectRatio(
            aspectRatio: 16 / 9,
            child: Stack(
              fit: StackFit.expand,
              children: [
                hasBg
                    ? CachedNetworkImage(
                        imageUrl: bgSrc,
                        fit: BoxFit.cover,
                        placeholder: (_, __) => Container(
                          color: AppColors.primaryLight,
                          child: const Center(
                              child: CircularProgressIndicator(strokeWidth: 2)),
                        ),
                        errorWidget: (_, __, ___) => Container(
                          color: AppColors.primaryLight,
                          child: const Icon(Icons.category_rounded,
                              size: 48, color: AppColors.primary),
                        ),
                      )
                    : Container(
                        color: AppColors.primaryLight,
                        child: const Icon(Icons.category_rounded,
                            size: 48, color: AppColors.primary),
                      ),
                Container(
                  decoration: BoxDecoration(
                    gradient: LinearGradient(
                      begin: Alignment.topCenter,
                      end: Alignment.bottomCenter,
                      colors: [
                        Colors.transparent,
                        Colors.black.withValues(alpha: 0.7),
                      ],
                    ),
                  ),
                ),
                Positioned(
                  left: 16,
                  right: 16,
                  bottom: 14,
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(name,
                          style: const TextStyle(
                              color: Colors.white,
                              fontSize: 18,
                              fontWeight: FontWeight.w700)),
                      if (catName.isNotEmpty)
                        Text(catName,
                            style: TextStyle(
                                color: Colors.white.withValues(alpha: 0.8),
                                fontSize: 13)),
                    ],
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
