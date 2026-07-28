import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:cached_network_image/cached_network_image.dart';
// import 'package:damnpay_sdk/damnpay_sdk.dart'; // (BillPay moved to its own bottom-nav tab)
import '../../services/api_service.dart';
// import '../../services/auth_service.dart'; // (used only by old in-page BillPay tab)
import '../../services/cart_service.dart';
import '../../services/app_config_service.dart';
import '../../theme/app_theme.dart';
import '../../config.dart';
import '../../components/banner_carousel.dart';
import '../../components/section_factory.dart';
import '../../components/shimmer_loader.dart';
import '../banner/banner_products_screen.dart';
import '../main_shell.dart' show AppBarCartAction;

class HomeScreen extends StatefulWidget {
  const HomeScreen({super.key});

  @override
  State<HomeScreen> createState() => _HomeScreenState();
}

class _HomeScreenState extends State<HomeScreen> {
  final _api = ApiService();
  List<dynamic> _ddSections = [];
  final List<dynamic> _ddgoSections = [];
  List<dynamic> _ddCategories = [];
  final List<dynamic> _ddgoCategories = [];
  bool _loading = true;
  String? _error;

  @override
  void initState() {
    super.initState();
    _loadData();
  }

  @override
  void dispose() {
    super.dispose();
  }

  Future<void> _loadData({bool forceRefresh = false}) async {
    if (_ddSections.isEmpty) setState(() { _loading = true; _error = null; });
    try {
      // Stale-while-revalidate: returns cached payload instantly,
      // refreshes silently in the background and re-renders.
      final results = await Future.wait([
        _api.getCached(
          '/user/home?platform=damndeal',
          auth: false,
          ttl: const Duration(minutes: 30),
          staleAfter: forceRefresh ? Duration.zero : const Duration(minutes: 2),
          onUpdate: (fresh) {
            if (!mounted) return;
            final list = List<dynamic>.from(fresh['sections'] ?? [])
              ..sort((a, b) => ((a['sortOrder'] ?? 0) as num)
                  .compareTo((b['sortOrder'] ?? 0) as num));
            setState(() => _ddSections = list);
          },
        ),
        _api.getCached(
          '/categories?platform=damndeal',
          auth: false,
          ttl: const Duration(hours: 6),
          staleAfter: forceRefresh ? Duration.zero : const Duration(minutes: 30),
          onUpdate: (fresh) {
            if (!mounted) return;
            setState(() => _ddCategories = fresh['categories'] ?? []);
          },
        ),
      ]);
      _ddSections = List<dynamic>.from(results[0]['sections'] ?? []);
      _ddSections.sort((a, b) => ((a['sortOrder'] ?? 0) as num).compareTo((b['sortOrder'] ?? 0) as num));
      _ddCategories = results[1]['categories'] ?? [];
    } catch (e) {
      _error = e.toString();
    }
    if (mounted) setState(() => _loading = false);
  }


  @override
  Widget build(BuildContext context) {
    final cfg = context.watch<AppConfigService>();
    final ddColor = cfg.primaryColor;
    // final goColor = cfg.ddgoColor; // (DD Go disabled for now)
    final appBarColor = ddColor;
    final appBarBgImage = cfg.config['app_bar_bg_image']?.toString() ?? '';

    return Scaffold(
      extendBodyBehindAppBar: true,
      appBar: AppBar(
        titleSpacing: 0,
        toolbarHeight: 64,
        backgroundColor: Colors.transparent,
        elevation: 0,
        title: Padding(
          padding: const EdgeInsets.only(left: 16),
          child: Image.asset('assets/logo.webp', height: 48),
        ),
        actions: const [
          AppBarCartAction(color: Colors.black),
          SizedBox(width: 6),
        ],
        // ── DD Go + Bill Pay top tabs commented out (moved to bottom nav / disabled) ──
        // title: Padding(
        //   padding: const EdgeInsets.symmetric(horizontal: 16),
        //   child: Row(
        //     children: [
        //       Expanded(child: _buildLogoTab('assets/logo.webp', 0, ddColor, height: 30)),
        //       const SizedBox(width: 8),
        //       Expanded(child: _buildLogoTab('assets/dealgo.png', 1, goColor)),
        //       const SizedBox(width: 8),
        //       Expanded(child: _buildTab('Bill Pay', '💳', 2, billColor)),
        //     ],
        //   ),
        // ),
        bottom: PreferredSize(
          preferredSize: const Size.fromHeight(50),
          child: Padding(
            padding: const EdgeInsets.fromLTRB(16, 0, 16, 10),
            child: GestureDetector(
              onTap: () => Navigator.pushNamed(context, '/search'),
              child: Container(
                height: 40,
                decoration: BoxDecoration(
                  color: Colors.white.withValues(alpha: 0.9),
                  borderRadius: BorderRadius.circular(10),
                ),
                padding: const EdgeInsets.symmetric(horizontal: 12),
                child: Row(
                  children: [
                    Icon(Icons.search_rounded, size: 20, color: Colors.grey[500]),
                    const SizedBox(width: 8),
                    Text('Search products...',
                        style: TextStyle(fontSize: 14, color: Colors.grey[400])),
                  ],
                ),
              ),
            ),
          ),
        ),
      ),
      body: Stack(
        children: [
          Positioned(
            top: 0,
            left: 0,
            right: 0,
            height: MediaQuery.of(context).padding.top + kToolbarHeight + 250,
            child: appBarBgImage.isNotEmpty
                ? CachedNetworkImage(
                    imageUrl: appBarBgImage.startsWith('http')
                        ? appBarBgImage
                        : '${AppConfig.uploadsBase}$appBarBgImage',
                    width: double.infinity,
                    height: MediaQuery.of(context).padding.top + kToolbarHeight + 250,
                    fit: BoxFit.cover,
                    alignment: Alignment.topCenter,
                    errorWidget: (_, __, ___) => const SizedBox.shrink(),
                  )
                : Container(
                    decoration: BoxDecoration(
                      gradient: LinearGradient(
                        begin: Alignment.topCenter,
                        end: Alignment.bottomCenter,
                        colors: [
                          appBarColor.withValues(alpha: 0.35),
                          appBarColor.withValues(alpha: 0.0),
                        ],
                      ),
                    ),
                  ),
          ),
          SafeArea(child: _buildPageContent(0)),
        ],
      ),
    );
  }

  Widget _buildPageContent(int tab) {
    if (_loading) {
      return const SingleChildScrollView(
        child: Column(
          children: [
            SizedBox(height: 16),
            ShimmerLoader(count: 1, height: 170, padding: EdgeInsets.symmetric(horizontal: 16)),
            SizedBox(height: 16),
            ShimmerGrid(count: 4),
          ],
        ),
      );
    }
    if (_error != null) {
      return Center(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            const Icon(Icons.error_outline, size: 48, color: AppColors.textMuted),
            const SizedBox(height: 12),
            Text(_error!, style: const TextStyle(color: AppColors.textSecondary)),
            const SizedBox(height: 16),
            ElevatedButton(onPressed: _loadData, child: const Text('Retry')),
          ],
        ),
      );
    }
    final sections = tab == 0 ? _ddSections : _ddgoSections;
    return RefreshIndicator(
      onRefresh: () => _loadData(forceRefresh: true),
      child: ListView(
        padding: EdgeInsets.zero,
        children: [
          if (tab == 0 && _ddCategories.isNotEmpty)
            _buildDDCategories(),
          if (tab == 1 && _ddgoCategories.isNotEmpty)
            _buildDDGoCategoryGrid(),
          ..._buildOrderedSections(sections),
          const SizedBox(height: 80),
        ],
      ),
    );
  }

  List<Widget> _buildOrderedSections(List<dynamic> sections) {
    final productTypes = {'popular_products', 'deal_of_day', 'category_section', 'horizontal_products', 'grid_products', 'product_grid'};
    final widgets = <Widget>[];

    for (final s in sections) {
      final type = s['type']?.toString() ?? '';

      if (type == 'square_banners') {
        final items = (s['items'] as List?) ?? [];
        if (items.isEmpty) continue;
        for (int i = 0; i < items.length; i += 2) {
          widgets.add(
            Padding(
              padding: const EdgeInsets.fromLTRB(12, 0, 12, 10),
              child: Row(
                children: [
                  Expanded(child: _squareBannerTile(items[i])),
                  const SizedBox(width: 10),
                  Expanded(
                    child: i + 1 < items.length
                        ? _squareBannerTile(items[i + 1])
                        : const SizedBox.shrink(),
                  ),
                ],
              ),
            ),
          );
        }
        continue;
      }

      if (type == 'banner_carousel' || type == 'custom_banner') {
        final items = (s['items'] as List?) ?? [];
        if (items.isEmpty) continue;
        widgets.add(
          Padding(
            padding: const EdgeInsets.only(bottom: 12),
            child: BannerCarousel(banners: items),
          ),
        );
        continue;
      }

      if (type == 'promo_section') {
        widgets.add(
          PromoSection(
            section: Map<String, dynamic>.from(s),
            onCardTap: (catId, catName) {
              if (catId != null && catId.toString().isNotEmpty) {
                Navigator.pushNamed(context, '/subcategory', arguments: {'_id': catId, 'name': catName});
              }
            },
          ),
        );
        continue;
      }

      if (productTypes.contains(type)) {
        widgets.add(
          SectionFactory(
            section: Map<String, dynamic>.from(s),
            onAddToCart: _addToCart,
            onVariantAdd: (p, label, price) => _addToCartWithVariant(p, label, price),
            onProductTap: (p) => Navigator.pushNamed(context, '/product', arguments: p),
            onSeeAllTap: (catId, catName) {
              Navigator.pushNamed(context, '/subcategory', arguments: {'_id': catId, 'name': catName});
            },
          ),
        );
      }
    }

    return widgets;
  }

  Widget _squareBannerTile(dynamic banner) {
    final img = banner['image']?.toString() ?? '';
    final src = img.startsWith('http') ? img : '${AppConfig.uploadsBase}$img';
    final bannerId = banner['_id']?.toString() ?? '';
    final bannerTitle = banner['title']?.toString() ?? 'Products';
    return GestureDetector(
      onTap: () {
        if (bannerId.isNotEmpty) {
          Navigator.push(context, MaterialPageRoute(
            builder: (_) => BannerProductsScreen(bannerId: bannerId, title: bannerTitle),
          ));
        }
      },
      child: ClipRRect(
        borderRadius: BorderRadius.circular(12),
        child: AspectRatio(
          aspectRatio: 1,
          child: CachedNetworkImage(
            imageUrl: src,
            fit: BoxFit.cover,
            placeholder: (_, __) => Container(
              color: Colors.grey.shade100,
              child: const Center(child: CircularProgressIndicator(strokeWidth: 2)),
            ),
            errorWidget: (_, __, ___) => Container(
              color: Colors.grey.shade100,
              child: const Icon(Icons.image_not_supported_outlined, size: 32, color: Colors.grey),
            ),
          ),
        ),
      ),
    );
  }

  void _addToCart(dynamic p) {
    context.read<CartService>().addItem(CartItem(
      productId: p['_id'] ?? '',
      name: p['name'] ?? '',
      image: (p['images'] is List && (p['images'] as List).isNotEmpty) ? p['images'][0] : null,
      price: (p['sellingPrice'] ?? p['price'] ?? 0).toDouble(),
      unit: p['unit'] ?? '',
      partnerId: p['partner']?['_id'] ?? p['partner'] ?? '',
      partnerName: p['partner']?['name'] ?? '',
      platform: 'damndeal',
    ));
  }

  void _addToCartWithVariant(dynamic p, String variantLabel, double price) {
    context.read<CartService>().addItem(CartItem(
      productId: p['_id'] ?? '',
      name: p['name'] ?? '',
      image: (p['images'] is List && (p['images'] as List).isNotEmpty) ? p['images'][0] : null,
      price: price,
      unit: p['unit'] ?? '',
      partnerId: p['partner']?['_id'] ?? p['partner'] ?? '',
      partnerName: p['partner']?['name'] ?? '',
      platform: 'damndeal',
      variantLabel: variantLabel,
    ));
  }

  Widget _buildDDGoCategoryGrid() {
    final cfg = context.read<AppConfigService>();
    final displayItems = _ddgoCategories.take(9).toList();
    final totalItems = displayItems.length + 1; // +1 for View All tile
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 12),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Padding(
            padding: const EdgeInsets.only(left: 4, bottom: 10),
            child: Text('Shop by Category', style: TextStyle(fontSize: 16, fontWeight: FontWeight.w700, color: cfg.categoryHeadingColor)),
          ),
          GridView.builder(
            shrinkWrap: true,
            physics: const NeverScrollableScrollPhysics(),
            gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
              crossAxisCount: 5,
              mainAxisSpacing: 10,
              crossAxisSpacing: 10,
              childAspectRatio: 0.72,
            ),
            itemCount: totalItems,
            itemBuilder: (context, i) {
              // Last item = View All tile
              if (i == displayItems.length) {
                return GestureDetector(
                  onTap: () => Navigator.pushNamed(context, '/categories', arguments: {'initialTab': 1}),
                  child: Column(
                    children: [
                      Expanded(
                        child: Container(
                          decoration: BoxDecoration(
                            color: const Color(0xFF0D7A30).withValues(alpha: 0.1),
                            borderRadius: BorderRadius.circular(14),
                            border: Border.all(color: const Color(0xFF0D7A30), width: 1.5),
                          ),
                          child: const Center(
                            child: Icon(Icons.arrow_forward_rounded, color: Color(0xFF0D7A30), size: 26),
                          ),
                        ),
                      ),
                      const SizedBox(height: 4),
                      const Text(
                        'View All',
                        style: TextStyle(fontSize: 10, fontWeight: FontWeight.w700, color: Color(0xFF0D7A30)),
                        textAlign: TextAlign.center,
                      ),
                    ],
                  ),
                );
              }
              final cat = displayItems[i];
              final icon = cat['icon']?.toString();
              final imgUrl = icon != null && icon.isNotEmpty
                  ? (icon.startsWith('http') ? icon : '${AppConfig.uploadsBase}$icon')
                  : null;
              return GestureDetector(
                onTap: () => Navigator.pushNamed(context, '/subcategory', arguments: cat),
                child: Column(
                  children: [
                    Expanded(
                      child: Container(
                        decoration: BoxDecoration(
                          color: cfg.categoryBgColor,
                          borderRadius: BorderRadius.circular(14),
                        ),
                        child: imgUrl != null
                            ? ClipRRect(
                                borderRadius: BorderRadius.circular(14),
                                child: CachedNetworkImage(
                                  imageUrl: imgUrl,
                                  fit: BoxFit.cover,
                                  width: double.infinity,
                                  placeholder: (_, __) => const Center(child: CircularProgressIndicator(strokeWidth: 2)),
                                  errorWidget: (_, __, ___) => const Icon(Icons.category_rounded, color: Color(0xFF0D7A30), size: 24),
                                ),
                              )
                            : const Center(child: Icon(Icons.category_rounded, color: Color(0xFF0D7A30), size: 24)),
                      ),
                    ),
                    const SizedBox(height: 4),
                    Text(
                      cat['name'] ?? '',
                      style: TextStyle(fontSize: 10, fontWeight: FontWeight.w600, color: cfg.categoryTextColor),
                      maxLines: 2,
                      overflow: TextOverflow.ellipsis,
                      textAlign: TextAlign.center,
                    ),
                  ],
                ),
              );
            },
          ),
          const SizedBox(height: 12),
        ],
      ),
    );
  }

  Widget _buildDDCategories() {
    final cfg = context.read<AppConfigService>();
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 4),
          child: Text('Shop by Category', style: TextStyle(fontSize: 16, fontWeight: FontWeight.w700, color: cfg.categoryHeadingColor)),
        ),
        const SizedBox(height: 8),
        SizedBox(
          height: 100,
          child: ListView.builder(
            scrollDirection: Axis.horizontal,
            padding: const EdgeInsets.symmetric(horizontal: 12),
            itemCount: _ddCategories.length,
            itemBuilder: (context, i) {
              final cat = _ddCategories[i];
              final icon = cat['icon'];
              final imgUrl = icon != null
                  ? (icon.toString().startsWith('http') ? icon : '${AppConfig.uploadsBase}$icon')
                  : null;
              return GestureDetector(
                onTap: () => Navigator.pushNamed(context, '/subcategory', arguments: cat),
                child: Container(
                  width: 80,
                  margin: const EdgeInsets.only(right: 10),
                  child: Column(
                    children: [
                      Container(
                        width: 60,
                        height: 60,
                        decoration: BoxDecoration(
                          color: cfg.categoryBgColor,
                          borderRadius: BorderRadius.circular(14),
                        ),
                        child: imgUrl != null
                            ? ClipRRect(
                                borderRadius: BorderRadius.circular(14),
                                child: CachedNetworkImage(
                                  imageUrl: imgUrl,
                                  fit: BoxFit.contain,
                                  width: 60,
                                  height: 60,
                                  fadeInDuration: Duration.zero,
                                  placeholderFadeInDuration: Duration.zero,
                                  errorWidget: (_, __, ___) => const Icon(
                                      Icons.category_rounded,
                                      color: Color(0xFF7C3AED),
                                      size: 28),
                                ),
                              )
                            : const Icon(Icons.category_rounded, color: Color(0xFF7C3AED), size: 28),
                      ),
                      const SizedBox(height: 6),
                      Text(
                        cat['name'] ?? '',
                        style: TextStyle(fontSize: 11, fontWeight: FontWeight.w600, color: cfg.categoryTextColor),
                        maxLines: 2,
                        overflow: TextOverflow.ellipsis,
                        textAlign: TextAlign.center,
                      ),
                    ],
                  ),
                ),
              );
            },
          ),
        ),
        const SizedBox(height: 8),
      ],
    );
  }
}
