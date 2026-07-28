import 'package:flutter/material.dart';
import 'package:cached_network_image/cached_network_image.dart';
import 'package:provider/provider.dart';
import '../../services/cart_service.dart';
import '../../services/api_service.dart';
import '../../config.dart';
import '../../theme/app_theme.dart';

class ProductDetailScreen extends StatefulWidget {
  const ProductDetailScreen({super.key});

  @override
  State<ProductDetailScreen> createState() => _ProductDetailScreenState();
}

class _ProductDetailScreenState extends State<ProductDetailScreen> {
  final PageController _pageCtrl = PageController();
  final ApiService _api = ApiService();
  int _activeImg = 0;
  bool _descExpanded = false;

  // Fresh product data fetched from API (may have more fields than listing data)
  Map<String, dynamic>? _fetchedProduct;
  String? _fetchedProductId;

  // Variant selection
  int? _selectedVariantIdx;
  String? _variantInitProductId;

  // Reviews state
  bool _reviewsLoaded = false;
  List<dynamic> _reviews = [];
  Map<String, dynamic> _reviewSummary = {
    'average': 0,
    'total': 0,
    'breakdown': {'1': 0, '2': 0, '3': 0, '4': 0, '5': 0},
  };
  String? _loadedProductId;

  Future<void> _fetchProduct(String productId) async {
    if (_fetchedProductId == productId) return;
    _fetchedProductId = productId;
    try {
      final res = await _api.getCached(
        '/user/products',
        auth: false,
        ttl: const Duration(minutes: 5),
        staleAfter: const Duration(minutes: 1),
        query: {'_id': productId},
        onUpdate: (fresh) {
          final list = (fresh['products'] as List?);
          if (list != null && list.isNotEmpty && mounted) {
            setState(() {
              _fetchedProduct = Map<String, dynamic>.from(list.first as Map);
              _variantInitProductId = null; // reset so variant re-initialises with fresh data
            });
          }
        },
      );
      final list = (res['products'] as List?);
      if (list != null && list.isNotEmpty && mounted) {
        setState(() {
          _fetchedProduct = Map<String, dynamic>.from(list.first as Map);
          _variantInitProductId = null;
        });
      }
    } catch (_) {}
  }

  Future<void> _loadReviews(String productId) async {
    if (_loadedProductId == productId) return;
    _loadedProductId = productId;
    try {
      final r = await _api.getCached(
        '/user/products/$productId/reviews',
        auth: false,
        ttl: const Duration(minutes: 10),
        staleAfter: const Duration(minutes: 1),
        onUpdate: (fresh) {
          if (!mounted) return;
          setState(() {
            _reviews = (fresh['reviews'] as List?) ?? [];
            _reviewSummary = Map<String, dynamic>.from(fresh['summary'] ?? _reviewSummary);
          });
        },
      );
      if (!mounted) return;
      setState(() {
        _reviews = (r['reviews'] as List?) ?? [];
        _reviewSummary = Map<String, dynamic>.from(r['summary'] ?? _reviewSummary);
        _reviewsLoaded = true;
      });
    } catch (_) {
      if (mounted) setState(() => _reviewsLoaded = true);
    }
  }

  @override
  void dispose() {
    _pageCtrl.dispose();
    super.dispose();
  }

  // ── HTML helpers (mirrors web/src/app/product/[id]/page.tsx) ──
  String _sanitize(String html) {
    return html
        .replaceAll(RegExp(r'<script[\s\S]*?</script>', caseSensitive: false), '')
        .replaceAll(RegExp(r'<iframe[\s\S]*?</iframe>', caseSensitive: false), '')
        .replaceAll(RegExp(r'<style[\s\S]*?</style>', caseSensitive: false), '')
        .replaceAll(RegExp(r'''\son\w+\s*=\s*"[^"]*"''', caseSensitive: false), '')
        .replaceAll(RegExp(r"\son\w+\s*=\s*'[^']*'", caseSensitive: false), '')
        .replaceAll(RegExp(r'javascript:', caseSensitive: false), '');
  }

  String _decodeEntities(String s) {
    return s
        .replaceAll('&nbsp;', ' ')
        .replaceAll('&amp;', '&')
        .replaceAll('&lt;', '<')
        .replaceAll('&gt;', '>')
        .replaceAll('&quot;', '"')
        .replaceAll('&#39;', "'");
  }

  /// Build TextSpans honoring <b>/<strong>, line-breaks via <br>/<p>.
  List<InlineSpan> _htmlToSpans(String html) {
    final clean = _sanitize(html);
    var s = clean
        .replaceAll(RegExp(r'</?(p|div|li|tr)\s*[^>]*>', caseSensitive: false), '\n')
        .replaceAll(RegExp(r'<br\s*/?>', caseSensitive: false), '\n');
    final boldOpen = RegExp(r'<(b|strong)\s*[^>]*>', caseSensitive: false);
    final boldClose = RegExp(r'</(b|strong)\s*>', caseSensitive: false);
    s = s.replaceAll(boldOpen, '\u0001').replaceAll(boldClose, '\u0002');
    s = s.replaceAll(RegExp(r'<[^>]+>'), '');
    s = _decodeEntities(s);
    s = s.replaceAll(RegExp(r'\n[ \t]+'), '\n').replaceAll(RegExp(r'\n{3,}'), '\n\n').trim();

    final spans = <InlineSpan>[];
    var bold = false;
    final buf = StringBuffer();
    void flush() {
      if (buf.isEmpty) return;
      spans.add(TextSpan(
        text: buf.toString(),
        style: TextStyle(
          fontSize: 14,
          height: 1.55,
          color: AppColors.textSecondary,
          fontWeight: bold ? FontWeight.w700 : FontWeight.w400,
        ),
      ));
      buf.clear();
    }

    for (final r in s.runes) {
      if (r == 1) {
        flush();
        bold = true;
      } else if (r == 2) {
        flush();
        bold = false;
      } else {
        buf.writeCharCode(r);
      }
    }
    flush();
    return spans;
  }

  String _stripHtml(String html) {
    final clean = _sanitize(html)
        .replaceAll(RegExp(r'<br\s*/?>', caseSensitive: false), ' ')
        .replaceAll(RegExp(r'<[^>]+>'), '');
    return _decodeEntities(clean).replaceAll(RegExp(r'\s+'), ' ').trim();
  }

  @override
  Widget build(BuildContext context) {
    final argProduct = ModalRoute.of(context)!.settings.arguments as Map<String, dynamic>;
    // Use freshly fetched product data when available (ensures variants are included)
    final product = _fetchedProduct ?? argProduct;

    final pid = (argProduct['_id'] ?? '').toString();
    // Trigger fresh fetch once per product — fills in variant data the listing may omit
    if (pid.isNotEmpty) {
      WidgetsBinding.instance.addPostFrameCallback((_) => _fetchProduct(pid));
    }

    final images = (product['images'] as List?) ?? [];
    final name = (product['name'] ?? '').toString();
    final desc = (product['description'] ?? '').toString();
    final brand = (product['brand'] ?? '').toString();
    final basePrice = (product['sellingPrice'] ?? product['price'] ?? 0).toDouble();
    final baseMrp = (product['mrp'] ?? product['price'] ?? 0).toDouble();
    final unit = (product['unit'] ?? '').toString();
    final baseStock = (product['stock'] ?? 0) is int
        ? product['stock'] as int
        : ((product['stock'] ?? 0) as num).toInt();
    final partnerName = (product['partner'] is Map ? product['partner']['name'] : '') ?? '';
    final isReturnable = product['isReturnable'] != false;
    final returnPolicy = (product['returnPolicy'] ?? '7').toString();
    final isCOD = product['isCOD'] != false;
    final highlights = (product['highlights'] as List?) ?? const [];
    final specs = (product['specifications'] as List?) ?? const [];

    // ── Variants ────────────────────────────────────────────────
    final isCjProduct = product['source'] == 'cj';

    // CJ products use cjVariants; regular products use variants
    final List activeVariantList = isCjProduct
        ? ((product['cjVariants'] as List?) ?? const [])
            .where((v) => (v as Map)['isActive'] != false)
            .toList()
        : ((product['variants'] as List?) ?? const [])
            .where((v) => (v as Map)['isActive'] != false)
            .toList();

    final bool showVariants = activeVariantList.isNotEmpty &&
        (isCjProduct || product['hasVariants'] == true);

    // Lazy-init: auto-select first in-stock variant on first build for this product
    if (showVariants && _variantInitProductId != pid) {
      _variantInitProductId = pid;
      int firstIdx = 0;
      for (int i = 0; i < activeVariantList.length; i++) {
        final v = activeVariantList[i] as Map<String, dynamic>;
        if (((v['stock'] ?? 0) as num) > 0) {
          firstIdx = i;
          break;
        }
      }
      _selectedVariantIdx = firstIdx;
    }

    final Map<String, dynamic>? selectedVariant =
        (showVariants && _selectedVariantIdx != null && _selectedVariantIdx! < activeVariantList.length)
            ? Map<String, dynamic>.from(activeVariantList[_selectedVariantIdx!] as Map)
            : null;

    final price = (selectedVariant != null && ((selectedVariant['sellingPrice'] ?? 0) as num) > 0)
        ? (selectedVariant['sellingPrice'] as num).toDouble()
        : basePrice;
    final mrp = (selectedVariant != null && ((selectedVariant['mrp'] ?? 0) as num) > 0)
        ? (selectedVariant['mrp'] as num).toDouble()
        : baseMrp;
    final stock = selectedVariant != null
        ? ((selectedVariant['stock'] ?? 999) as num).toInt()
        : baseStock;
    final inStock = stock > 0;
    final discount = mrp > price ? ((mrp - price) / mrp * 100).round() : 0;
    final variantLabel = selectedVariant?['label']?.toString();

    final infoRows = <MapEntry<String, String>>[
      if (brand.isNotEmpty) MapEntry('Brand', brand),
      if ((product['color'] ?? '').toString().isNotEmpty) MapEntry('Color', product['color'].toString()),
      if ((product['material'] ?? '').toString().isNotEmpty) MapEntry('Material', product['material'].toString()),
      if (product['weight'] != null && product['weight'].toString().isNotEmpty)
        MapEntry('Weight', '${product['weight']} ${unit.isNotEmpty ? unit : ''}'.trim()),
      if ((product['manufacturer'] ?? '').toString().isNotEmpty)
        MapEntry('Manufacturer', product['manufacturer'].toString()),
      if ((product['countryOfOrigin'] ?? '').toString().isNotEmpty && product['source'] != 'cj')
        MapEntry('Country of Origin', product['countryOfOrigin'].toString()),
      if ((product['packageContents'] ?? '').toString().isNotEmpty)
        MapEntry('Package Contents', product['packageContents'].toString()),
      if ((product['warranty'] ?? '').toString().isNotEmpty) MapEntry('Warranty', product['warranty'].toString()),
      if ((product['hsnCode'] ?? '').toString().isNotEmpty) MapEntry('HSN Code', product['hsnCode'].toString()),
    ];

    final cart = context.watch<CartService>();
    final qty = cart.getQuantity(product['_id'] ?? '', variantLabel: variantLabel);

    // Trigger lazy reviews fetch (cached, fires only once per product)
    if (pid.isNotEmpty) {
      WidgetsBinding.instance.addPostFrameCallback((_) => _loadReviews(pid));
    }
    final reviewAvg = ((_reviewSummary['average'] ?? 0) as num).toDouble();
    final reviewTotal = ((_reviewSummary['total'] ?? 0) as num).toInt();

    final topPad = MediaQuery.of(context).padding.top;

    return Scaffold(
      backgroundColor: const Color(0xFFF5F5F8),
      body: CustomScrollView(
        slivers: [
          SliverAppBar(
            expandedHeight: 360,
            pinned: true,
            backgroundColor: Colors.white,
            foregroundColor: AppColors.textPrimary,
            elevation: 0,
            automaticallyImplyLeading: false,
            leading: _circleIconBtn(
              icon: Icons.arrow_back_ios_new_rounded,
              onTap: () => Navigator.maybePop(context),
            ),
            titleSpacing: 0,
            title: Row(
              children: [
                Expanded(
                  child: GestureDetector(
                    onTap: () => Navigator.pushNamed(context, '/search'),
                    child: Container(
                      height: 36,
                      decoration: BoxDecoration(
                        color: const Color(0xFFF2F2F2),
                        borderRadius: BorderRadius.circular(8),
                      ),
                      child: Row(
                        children: [
                          const SizedBox(width: 10),
                          Icon(Icons.search_rounded, size: 17, color: Colors.grey.shade500),
                          const SizedBox(width: 6),
                          Expanded(
                            child: Text(
                              name,
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis,
                              style: TextStyle(fontSize: 12.5, color: Colors.grey.shade600),
                            ),
                          ),
                          const SizedBox(width: 10),
                        ],
                      ),
                    ),
                  ),
                ),
                const SizedBox(width: 4),
              ],
            ),
            actions: [
              _circleIconBtn(
                icon: Icons.share_outlined,
                onTap: () {},
              ),
              const SizedBox(width: 6),
            ],
            flexibleSpace: FlexibleSpaceBar(
              background: Stack(
                fit: StackFit.expand,
                children: [
                  // White canvas with safe-area padding so the image never
                  // collides with the status bar / notch
                  Padding(
                    padding: EdgeInsets.only(top: topPad + 44, bottom: 16, left: 8, right: 8),
                    child: ColoredBox(
                      color: Colors.white,
                      child: images.isNotEmpty
                          ? PageView.builder(
                              controller: _pageCtrl,
                              itemCount: images.length,
                              onPageChanged: (i) => setState(() => _activeImg = i),
                              itemBuilder: (_, i) {
                                final raw = images[i].toString();
                                final src = raw.startsWith('http')
                                    ? raw
                                    : '${AppConfig.uploadsBase}$raw';
                                return Hero(
                                  tag: 'product-${product['_id']}-$i',
                                  child: CachedNetworkImage(
                                    imageUrl: src,
                                    fit: BoxFit.contain,
                                    fadeInDuration: Duration.zero,
                                    placeholderFadeInDuration: Duration.zero,
                                    placeholder: (_, __) => const Center(
                                        child: CircularProgressIndicator(strokeWidth: 2)),
                                    errorWidget: (_, __, ___) => const Icon(
                                        Icons.broken_image_outlined,
                                        size: 60,
                                        color: AppColors.textMuted),
                                  ),
                                );
                              },
                            )
                          : const Center(
                              child: Icon(Icons.shopping_bag_outlined,
                                  size: 80, color: AppColors.textMuted),
                            ),
                    ),
                  ),
                  // Discount ribbon
                  if (discount > 0)
                    Positioned(
                      top: topPad + 56,
                      left: 16,
                      child: Container(
                        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
                        decoration: BoxDecoration(
                          color: AppColors.error,
                          borderRadius: BorderRadius.circular(4),
                          boxShadow: [
                            BoxShadow(
                                color: Colors.black.withValues(alpha: 0.12),
                                blurRadius: 6,
                                offset: const Offset(0, 2)),
                          ],
                        ),
                        child: Text('$discount% OFF',
                            style: const TextStyle(
                                color: Colors.white,
                                fontSize: 11,
                                fontWeight: FontWeight.w800,
                                letterSpacing: 0.3)),
                      ),
                    ),
                  // Image counter chip (Flipkart style "1/4")
                  if (images.length > 1)
                    Positioned(
                      bottom: 14,
                      right: 14,
                      child: Container(
                        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                        decoration: BoxDecoration(
                          color: Colors.black.withValues(alpha: 0.55),
                          borderRadius: BorderRadius.circular(20),
                        ),
                        child: Text('${_activeImg + 1} / ${images.length}',
                            style: const TextStyle(
                                color: Colors.white,
                                fontSize: 11,
                                fontWeight: FontWeight.w600)),
                      ),
                    ),
                  // Active page dots (subtle)
                  if (images.length > 1)
                    Positioned(
                      bottom: 14,
                      left: 0,
                      right: 0,
                      child: Row(
                        mainAxisAlignment: MainAxisAlignment.center,
                        children: List.generate(images.length, (i) {
                          final active = i == _activeImg;
                          return AnimatedContainer(
                            duration: const Duration(milliseconds: 220),
                            margin: const EdgeInsets.symmetric(horizontal: 3),
                            width: active ? 16 : 5,
                            height: 5,
                            decoration: BoxDecoration(
                              color: active ? AppColors.primary : Colors.grey.shade300,
                              borderRadius: BorderRadius.circular(3),
                            ),
                          );
                        }),
                      ),
                    ),
                  // Wishlist button (top-right over image)
                  Positioned(
                    top: topPad + 6,
                    right: 8,
                    child: _circleIconBtn(
                      icon: Icons.favorite_border_rounded,
                      onTap: () {
                        ScaffoldMessenger.of(context).showSnackBar(
                          const SnackBar(
                            content: Text('Added to wishlist'),
                            duration: Duration(seconds: 1),
                          ),
                        );
                      },
                    ),
                  ),
                ],
              ),
            ),
          ),

          SliverToBoxAdapter(
            child: Container(
              color: Colors.white,
              padding: const EdgeInsets.fromLTRB(16, 14, 16, 16),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  if (partnerName.toString().isNotEmpty)
                    Text(partnerName.toString(),
                        style: const TextStyle(
                            fontSize: 12, color: AppColors.primary, fontWeight: FontWeight.w600)),
                  const SizedBox(height: 4),
                  Text(name,
                      style: const TextStyle(
                          fontSize: 20,
                          fontWeight: FontWeight.w800,
                          color: AppColors.textPrimary,
                          height: 1.25)),
                  if (brand.isNotEmpty) ...[
                    const SizedBox(height: 4),
                    Text(brand, style: const TextStyle(fontSize: 12, color: AppColors.textMuted)),
                  ],
                  if (unit.isNotEmpty && unit != 'piece') ...[
                    const SizedBox(height: 2),
                    Text(unit, style: const TextStyle(fontSize: 12, color: AppColors.textMuted)),
                  ],
                  const SizedBox(height: 10),
                  Row(
                    crossAxisAlignment: CrossAxisAlignment.end,
                    children: [
                      Text('₹${price.toStringAsFixed(0)}',
                          style: const TextStyle(
                              fontSize: 26,
                              fontWeight: FontWeight.w900,
                              color: AppColors.textPrimary)),
                      if (discount > 0) ...[
                        const SizedBox(width: 8),
                        Padding(
                          padding: const EdgeInsets.only(bottom: 4),
                          child: Text('₹${mrp.toStringAsFixed(0)}',
                              style: const TextStyle(
                                  fontSize: 14,
                                  color: AppColors.textMuted,
                                  decoration: TextDecoration.lineThrough)),
                        ),
                        const SizedBox(width: 8),
                        Padding(
                          padding: const EdgeInsets.only(bottom: 4),
                          child: Text('$discount% off',
                              style: const TextStyle(
                                  fontSize: 13,
                                  color: AppColors.success,
                                  fontWeight: FontWeight.w700)),
                        ),
                      ],
                    ],
                  ),
                  if (discount > 0) ...[
                    const SizedBox(height: 4),
                    Text('You save ₹${(mrp - price).toStringAsFixed(0)}',
                        style: const TextStyle(
                            fontSize: 12,
                            color: AppColors.success,
                            fontWeight: FontWeight.w700)),
                  ],
                  const SizedBox(height: 8),
                  Row(
                    children: [
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                        decoration: BoxDecoration(
                          color: inStock ? AppColors.success : AppColors.error,
                          borderRadius: BorderRadius.circular(4),
                        ),
                        child: Text(
                          inStock ? 'IN STOCK' : 'OUT OF STOCK',
                          style: const TextStyle(
                              color: Colors.white, fontSize: 10, fontWeight: FontWeight.w800, letterSpacing: 0.4),
                        ),
                      ),
                      if (inStock && stock <= 5) ...[
                        const SizedBox(width: 8),
                        Text('Only $stock left',
                            style: const TextStyle(
                                fontSize: 12, color: AppColors.error, fontWeight: FontWeight.w600)),
                      ],
                    ],
                  ),
                  if (reviewTotal > 0) ...[
                    const SizedBox(height: 10),
                    Row(
                      children: [
                        ...List.generate(5, (i) => Icon(
                          i < reviewAvg.round() ? Icons.star_rounded : Icons.star_border_rounded,
                          size: 14,
                          color: const Color(0xFFFF9F00),
                        )),
                        const SizedBox(width: 6),
                        Text(reviewAvg.toStringAsFixed(1),
                            style: const TextStyle(
                                fontSize: 13, fontWeight: FontWeight.w700, color: AppColors.textPrimary)),
                        const SizedBox(width: 4),
                        Text('($reviewTotal ratings)',
                            style: const TextStyle(fontSize: 12, color: AppColors.textMuted)),
                      ],
                    ),
                  ],
                ],
              ),
            ),
          ),

          // ── Variant / Size picker ──────────────────────────────
          if (showVariants)
            SliverToBoxAdapter(
              child: Container(
                margin: const EdgeInsets.only(top: 8),
                color: Colors.white,
                padding: const EdgeInsets.fromLTRB(16, 14, 16, 16),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      children: [
                        const Text('Choose Option',
                            style: TextStyle(
                                fontSize: 15,
                                fontWeight: FontWeight.w800,
                                color: AppColors.textPrimary)),
                        if (variantLabel != null) ...[
                          const SizedBox(width: 6),
                          Text(': $variantLabel',
                              style: const TextStyle(
                                  fontSize: 14,
                                  color: AppColors.primary,
                                  fontWeight: FontWeight.w700)),
                        ],
                      ],
                    ),
                    const SizedBox(height: 10),
                    Wrap(
                      spacing: 8,
                      runSpacing: 8,
                      children: List.generate(activeVariantList.length, (i) {
                        final v = Map<String, dynamic>.from(activeVariantList[i] as Map);
                        final isAvailable = ((v['stock'] ?? 999) as num) > 0;
                        final isSelected = _selectedVariantIdx == i;
                        return GestureDetector(
                          onTap: isAvailable
                              ? () => setState(() => _selectedVariantIdx = i)
                              : null,
                          child: AnimatedContainer(
                            duration: const Duration(milliseconds: 160),
                            padding: const EdgeInsets.symmetric(
                                horizontal: 16, vertical: 8),
                            decoration: BoxDecoration(
                              color: isSelected ? AppColors.primary : Colors.white,
                              border: Border.all(
                                color: isSelected
                                    ? AppColors.primary
                                    : isAvailable
                                        ? AppColors.textMuted
                                        : Colors.grey.shade200,
                                width: isSelected ? 2 : 1.2,
                              ),
                              borderRadius: BorderRadius.circular(8),
                            ),
                            child: Text(
                              (v['label'] ?? '').toString(),
                              style: TextStyle(
                                fontSize: 13,
                                fontWeight: FontWeight.w700,
                                color: isSelected
                                    ? Colors.white
                                    : isAvailable
                                        ? AppColors.textPrimary
                                        : AppColors.textMuted,
                                decoration: isAvailable
                                    ? null
                                    : TextDecoration.lineThrough,
                              ),
                            ),
                          ),
                        );
                      }),
                    ),
                  ],
                ),
              ),
            ),

          // ── Delivery & Services ───────────────────────────────
          SliverToBoxAdapter(
            child: Container(
              margin: const EdgeInsets.only(top: 8),
              color: Colors.white,
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Padding(
                    padding: EdgeInsets.fromLTRB(16, 14, 16, 10),
                    child: Text('Delivery & Services',
                        style: TextStyle(
                            fontSize: 15, fontWeight: FontWeight.w800, color: AppColors.textPrimary)),
                  ),
                  _serviceRow(Icons.local_shipping_outlined, 'Free Delivery',
                      'Free shipping on all orders'),
                  if (isReturnable)
                    _serviceRow(Icons.replay_outlined, '$returnPolicy-Day Easy Returns',
                        'No questions asked return policy'),
                  if (isCOD)
                    _serviceRow(Icons.payments_outlined, 'Cash on Delivery',
                        'Pay when your order arrives'),
                  _serviceRow(Icons.verified_user_outlined, 'Secure Payments',
                      '100% safe & encrypted checkout'),
                  const SizedBox(height: 4),
                ],
              ),
            ),
          ),

          if (desc.trim().isNotEmpty)
            SliverToBoxAdapter(
              child: _section(
                title: 'Description',
                child: _CollapsibleDescription(
                  spans: _htmlToSpans(desc),
                  expanded: _descExpanded,
                  onToggle: () => setState(() => _descExpanded = !_descExpanded),
                ),
              ),
            ),

          if (highlights.isNotEmpty)
            SliverToBoxAdapter(
              child: _section(
                title: 'Highlights',
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: highlights.map((h) {
                    return Padding(
                      padding: const EdgeInsets.only(bottom: 6),
                      child: Row(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          const Padding(
                            padding: EdgeInsets.only(top: 2, right: 8),
                            child:
                                Icon(Icons.check_circle, size: 16, color: AppColors.success),
                          ),
                          Expanded(
                            child: Text(_stripHtml(h.toString()),
                                style: const TextStyle(
                                    fontSize: 13,
                                    color: AppColors.textSecondary,
                                    height: 1.45)),
                          ),
                        ],
                      ),
                    );
                  }).toList(),
                ),
              ),
            ),

          if (specs.isNotEmpty)
            SliverToBoxAdapter(
              child: _section(
                title: 'Specifications',
                child: _zebraTable(
                  specs.map((s) {
                    final m = (s as Map?) ?? {};
                    return MapEntry((m['key'] ?? '').toString(), (m['value'] ?? '').toString());
                  }).toList(),
                ),
              ),
            ),

          if (infoRows.isNotEmpty)
            SliverToBoxAdapter(
              child: _section(
                title: 'Product Information',
                child: _zebraTable(infoRows),
              ),
            ),

          // ── Ratings & Reviews ─────────────────────────────
          SliverToBoxAdapter(
            child: _section(
              title: 'Ratings & Reviews',
              child: _RatingsBlock(
                average: reviewAvg,
                total: reviewTotal,
                breakdown: Map<String, dynamic>.from(_reviewSummary['breakdown'] ?? {}),
                reviews: _reviews,
                loaded: _reviewsLoaded,
                onRate: () => _openRateSheet(context, pid),
              ),
            ),
          ),

          const SliverToBoxAdapter(child: SizedBox(height: 110)),
        ],
      ),
      bottomSheet: Container(
        decoration: BoxDecoration(
          color: Colors.white,
          border: Border(top: BorderSide(color: Colors.grey.shade200)),
        ),
        child: SafeArea(
          top: false,
          child: Padding(
            padding: const EdgeInsets.fromLTRB(16, 10, 16, 10),
            child: !inStock
                ? SizedBox(
                    width: double.infinity,
                    height: 48,
                    child: OutlinedButton(
                      onPressed: null,
                      style: OutlinedButton.styleFrom(
                        side: BorderSide(color: Colors.grey.shade300),
                        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
                      ),
                      child: const Text('Out of Stock',
                          style: TextStyle(fontSize: 14, fontWeight: FontWeight.w600, color: AppColors.textMuted)),
                    ),
                  )
                : qty == 0
                    ? Row(
                        children: [
                          // Add to Cart — outlined, no fill
                          Expanded(
                            child: SizedBox(
                              height: 48,
                              child: OutlinedButton(
                                onPressed: () => _addToCart(context, product,
                                    effectivePrice: price, variantLabel: variantLabel),
                                style: OutlinedButton.styleFrom(
                                  side: const BorderSide(color: AppColors.primary, width: 1.5),
                                  foregroundColor: AppColors.primary,
                                  shape: RoundedRectangleBorder(
                                      borderRadius: BorderRadius.circular(8)),
                                ),
                                child: const Text('Add to Cart',
                                    style: TextStyle(
                                        fontSize: 14, fontWeight: FontWeight.w700)),
                              ),
                            ),
                          ),
                          const SizedBox(width: 10),
                          // Buy Now — filled primary
                          Expanded(
                            child: SizedBox(
                              height: 48,
                              child: ElevatedButton(
                                onPressed: () {
                                  _addToCart(context, product,
                                      effectivePrice: price, variantLabel: variantLabel);
                                  Navigator.pushNamed(context, '/cart');
                                },
                                style: ElevatedButton.styleFrom(
                                  backgroundColor: AppColors.primary,
                                  foregroundColor: Colors.white,
                                  elevation: 0,
                                  shape: RoundedRectangleBorder(
                                      borderRadius: BorderRadius.circular(8)),
                                ),
                                child: const Text('Buy Now',
                                    style: TextStyle(
                                        fontSize: 14, fontWeight: FontWeight.w700)),
                              ),
                            ),
                          ),
                        ],
                      )
                    : Row(
                        children: [
                          // Quantity stepper
                          Container(
                            height: 48,
                            decoration: BoxDecoration(
                              border: Border.all(color: AppColors.primary, width: 1.5),
                              borderRadius: BorderRadius.circular(8),
                            ),
                            child: Row(
                              mainAxisSize: MainAxisSize.min,
                              children: [
                                _stepBtn(Icons.remove_rounded, () =>
                                    cart.updateQuantity(product['_id'], qty - 1, variantLabel: variantLabel)),
                                SizedBox(
                                  width: 36,
                                  child: Text('$qty',
                                      textAlign: TextAlign.center,
                                      style: const TextStyle(
                                          fontSize: 15,
                                          fontWeight: FontWeight.w800,
                                          color: AppColors.primary)),
                                ),
                                _stepBtn(Icons.add_rounded, () =>
                                    cart.updateQuantity(product['_id'], qty + 1, variantLabel: variantLabel)),
                              ],
                            ),
                          ),
                          const SizedBox(width: 10),
                          // Go to Cart — filled
                          Expanded(
                            child: SizedBox(
                              height: 48,
                              child: ElevatedButton(
                                onPressed: () => Navigator.pushNamed(context, '/cart'),
                                style: ElevatedButton.styleFrom(
                                  backgroundColor: AppColors.primary,
                                  foregroundColor: Colors.white,
                                  elevation: 0,
                                  shape: RoundedRectangleBorder(
                                      borderRadius: BorderRadius.circular(8)),
                                ),
                                child: const Text('Go to Cart',
                                    style: TextStyle(
                                        fontSize: 14, fontWeight: FontWeight.w700)),
                              ),
                            ),
                          ),
                        ],
                      ),
          ),
        ),
      ),
    );
  }

  Widget _stepBtn(IconData icon, VoidCallback onTap) {
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(8),
      child: Container(
        width: 42,
        height: 50,
        alignment: Alignment.center,
        child: Icon(icon, color: AppColors.primary, size: 20),
      ),
    );
  }

  Widget _circleIconBtn({required IconData icon, required VoidCallback onTap}) {
    return Material(
      color: Colors.white,
      shape: const CircleBorder(),
      elevation: 2,
      shadowColor: Colors.black26,
      child: InkWell(
        customBorder: const CircleBorder(),
        onTap: onTap,
        child: SizedBox(
          width: 38,
          height: 38,
          child: Icon(icon, size: 18, color: AppColors.textPrimary),
        ),
      ),
    );
  }

  Widget _section({required String title, required Widget child}) {
    return Container(
      margin: const EdgeInsets.only(top: 8),
      padding: const EdgeInsets.fromLTRB(16, 14, 16, 16),
      color: Colors.white,
      width: double.infinity,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(title,
              style: const TextStyle(
                  fontSize: 15, fontWeight: FontWeight.w800, color: AppColors.textPrimary)),
          const SizedBox(height: 10),
          child,
        ],
      ),
    );
  }

  Widget _zebraTable(List<MapEntry<String, String>> rows) {
    return ClipRRect(
      borderRadius: BorderRadius.circular(10),
      child: Container(
        decoration: BoxDecoration(border: Border.all(color: AppColors.divider)),
        child: Column(
          children: List.generate(rows.length, (i) {
            final r = rows[i];
            return Container(
              color: i.isEven ? const Color(0xFFFAFAFA) : Colors.white,
              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  SizedBox(
                    width: 130,
                    child: Text(r.key,
                        style: const TextStyle(
                            fontSize: 12,
                            color: AppColors.textMuted,
                            fontWeight: FontWeight.w600)),
                  ),
                  Expanded(
                    child: Text(r.value,
                        style: const TextStyle(
                            fontSize: 12.5,
                            color: AppColors.textPrimary,
                            fontWeight: FontWeight.w500)),
                  ),
                ],
              ),
            );
          }),
        ),
      ),
    );
  }

  Widget _serviceRow(IconData icon, String title, String subtitle) {
    return Column(
      children: [
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
          child: Row(
            children: [
              Container(
                width: 36,
                height: 36,
                decoration: BoxDecoration(
                  color: const Color(0xFFF0F4FF),
                  borderRadius: BorderRadius.circular(8),
                ),
                child: Icon(icon, size: 18, color: AppColors.primary),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(title,
                        style: const TextStyle(
                            fontSize: 13, fontWeight: FontWeight.w700, color: AppColors.textPrimary)),
                    const SizedBox(height: 1),
                    Text(subtitle,
                        style: const TextStyle(fontSize: 11.5, color: AppColors.textMuted)),
                  ],
                ),
              ),
            ],
          ),
        ),
        const Divider(height: 1, indent: 64),
      ],
    );
  }

  void _addToCart(
    BuildContext context,
    Map<String, dynamic> p, {
    double? effectivePrice,
    String? variantLabel,
  }) {
    context.read<CartService>().addItem(CartItem(
          productId: p['_id'] ?? '',
          name: p['name'] ?? '',
          image: (p['images'] is List && (p['images'] as List).isNotEmpty)
              ? p['images'][0]
              : null,
          price: effectivePrice ?? (p['sellingPrice'] ?? p['price'] ?? 0).toDouble(),
          unit: p['unit'] ?? '',
          partnerId: p['partner']?['_id'] ?? p['partner'] ?? '',
          partnerName: p['partner']?['name'] ?? '',
          platform: p['platform'] ?? 'damndeal',
          variantLabel: variantLabel,
        ));
  }

  Future<void> _openRateSheet(BuildContext context, String productId) async {
    int rating = 5;
    final commentCtrl = TextEditingController();
    bool submitting = false;

    await showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.white,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(18)),
      ),
      builder: (ctx) {
        return StatefulBuilder(builder: (ctx, setSt) {
          return Padding(
            padding: EdgeInsets.only(
              left: 16,
              right: 16,
              top: 16,
              bottom: MediaQuery.of(ctx).viewInsets.bottom + 16,
            ),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Center(
                  child: Container(
                    width: 38,
                    height: 4,
                    decoration: BoxDecoration(
                      color: Colors.grey.shade300,
                      borderRadius: BorderRadius.circular(2),
                    ),
                  ),
                ),
                const SizedBox(height: 14),
                const Text('Rate this product',
                    style: TextStyle(fontSize: 16, fontWeight: FontWeight.w800)),
                const SizedBox(height: 12),
                Row(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: List.generate(5, (i) {
                    final idx = i + 1;
                    return IconButton(
                      onPressed: () => setSt(() => rating = idx),
                      icon: Icon(
                        idx <= rating ? Icons.star_rounded : Icons.star_border_rounded,
                        size: 38,
                        color: idx <= rating ? AppColors.accent : Colors.grey.shade400,
                      ),
                    );
                  }),
                ),
                const SizedBox(height: 8),
                TextField(
                  controller: commentCtrl,
                  maxLines: 4,
                  maxLength: 500,
                  decoration: InputDecoration(
                    hintText: 'Share your experience (optional)',
                    border: OutlineInputBorder(borderRadius: BorderRadius.circular(10)),
                    contentPadding: const EdgeInsets.all(12),
                  ),
                ),
                const SizedBox(height: 8),
                SizedBox(
                  width: double.infinity,
                  height: 48,
                  child: ElevatedButton(
                    onPressed: submitting
                        ? null
                        : () async {
                            setSt(() => submitting = true);
                            try {
                              await _api.post(
                                '/user/products/$productId/reviews',
                                {
                                  'rating': rating,
                                  'comment': commentCtrl.text.trim(),
                                },
                              );
                              if (!ctx.mounted) return;
                              Navigator.pop(ctx);
                              ScaffoldMessenger.of(context).showSnackBar(
                                const SnackBar(
                                  content: Text('Thanks! Your review is pending approval.'),
                                ),
                              );
                            } catch (e) {
                              if (!ctx.mounted) return;
                              setSt(() => submitting = false);
                              ScaffoldMessenger.of(ctx).showSnackBar(
                                SnackBar(content: Text(e.toString())),
                              );
                            }
                          },
                    style: ElevatedButton.styleFrom(
                      backgroundColor: AppColors.primary,
                      foregroundColor: Colors.white,
                      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                    ),
                    child: submitting
                        ? const SizedBox(
                            width: 20,
                            height: 20,
                            child: CircularProgressIndicator(
                                strokeWidth: 2, color: Colors.white))
                        : const Text('Submit Review',
                            style: TextStyle(fontSize: 14.5, fontWeight: FontWeight.w800)),
                  ),
                ),
              ],
            ),
          );
        });
      },
    );
  }
}

// ─── Collapsible description with "See more / less" ──────────
class _CollapsibleDescription extends StatelessWidget {
  final List<InlineSpan> spans;
  final bool expanded;
  final VoidCallback onToggle;
  const _CollapsibleDescription({
    required this.spans,
    required this.expanded,
    required this.onToggle,
  });

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        AnimatedSize(
          duration: const Duration(milliseconds: 260),
          curve: Curves.easeInOut,
          alignment: Alignment.topCenter,
          child: RichText(
            text: TextSpan(children: spans),
            maxLines: expanded ? null : 5,
            overflow: expanded ? TextOverflow.visible : TextOverflow.fade,
          ),
        ),
        const SizedBox(height: 12),
        GestureDetector(
          onTap: onToggle,
          child: Container(
            padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
            decoration: BoxDecoration(
              border: Border.all(color: AppColors.primary.withValues(alpha: 0.35), width: 1),
              borderRadius: BorderRadius.circular(20),
            ),
            child: Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                Text(
                  expanded ? 'Read less' : 'Read more',
                  style: const TextStyle(
                      fontSize: 12.5,
                      fontWeight: FontWeight.w600,
                      color: AppColors.primary),
                ),
                const SizedBox(width: 4),
                Icon(
                  expanded ? Icons.keyboard_arrow_up_rounded : Icons.keyboard_arrow_down_rounded,
                  size: 16,
                  color: AppColors.primary,
                ),
              ],
            ),
          ),
        ),
      ],
    );
  }
}

// ─── Ratings & reviews block ─────────────────────────────────
class _RatingsBlock extends StatelessWidget {
  final double average;
  final int total;
  final Map<String, dynamic> breakdown;
  final List<dynamic> reviews;
  final bool loaded;
  final VoidCallback onRate;

  const _RatingsBlock({
    required this.average,
    required this.total,
    required this.breakdown,
    required this.reviews,
    required this.loaded,
    required this.onRate,
  });

  int _b(int i) => ((breakdown['$i'] ?? 0) as num).toInt();

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          crossAxisAlignment: CrossAxisAlignment.center,
          children: [
            Column(
              children: [
                Row(
                  crossAxisAlignment: CrossAxisAlignment.end,
                  children: [
                    Text(average.toStringAsFixed(1),
                        style: const TextStyle(
                            fontSize: 32,
                            fontWeight: FontWeight.w900,
                            color: AppColors.textPrimary,
                            height: 1)),
                    const SizedBox(width: 4),
                    const Padding(
                      padding: EdgeInsets.only(bottom: 4),
                      child: Icon(Icons.star_rounded, color: AppColors.accent, size: 22),
                    ),
                  ],
                ),
                const SizedBox(height: 4),
                Text('$total ${total == 1 ? "review" : "reviews"}',
                    style: const TextStyle(fontSize: 11, color: AppColors.textMuted)),
              ],
            ),
            const SizedBox(width: 16),
            Expanded(
              child: Column(
                children: List.generate(5, (i) {
                  final star = 5 - i;
                  final c = _b(star);
                  final pct = total == 0 ? 0.0 : c / total;
                  return Padding(
                    padding: const EdgeInsets.symmetric(vertical: 1.5),
                    child: Row(
                      children: [
                        Text('$star',
                            style: const TextStyle(fontSize: 11, color: AppColors.textMuted)),
                        const SizedBox(width: 4),
                        const Icon(Icons.star_rounded, size: 11, color: AppColors.textMuted),
                        const SizedBox(width: 6),
                        Expanded(
                          child: ClipRRect(
                            borderRadius: BorderRadius.circular(3),
                            child: LinearProgressIndicator(
                              value: pct,
                              minHeight: 6,
                              backgroundColor: const Color(0xFFEFEFEF),
                              valueColor: AlwaysStoppedAnimation(
                                star >= 4
                                    ? AppColors.success
                                    : star == 3
                                        ? AppColors.accent
                                        : AppColors.error,
                              ),
                            ),
                          ),
                        ),
                        const SizedBox(width: 8),
                        SizedBox(
                          width: 28,
                          child: Text('$c',
                              textAlign: TextAlign.right,
                              style: const TextStyle(fontSize: 11, color: AppColors.textMuted)),
                        ),
                      ],
                    ),
                  );
                }),
              ),
            ),
          ],
        ),
        const SizedBox(height: 12),
        SizedBox(
          width: double.infinity,
          child: OutlinedButton.icon(
            onPressed: onRate,
            icon: const Icon(Icons.rate_review_outlined, size: 18),
            label: const Text('Rate this product'),
            style: OutlinedButton.styleFrom(
              foregroundColor: AppColors.primary,
              side: const BorderSide(color: AppColors.primary, width: 1.2),
              padding: const EdgeInsets.symmetric(vertical: 12),
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
              textStyle: const TextStyle(fontSize: 13.5, fontWeight: FontWeight.w700),
            ),
          ),
        ),
        if (!loaded) ...[
          const SizedBox(height: 14),
          const Center(child: CircularProgressIndicator(strokeWidth: 2)),
        ] else if (reviews.isEmpty) ...[
          const SizedBox(height: 14),
          Container(
            width: double.infinity,
            padding: const EdgeInsets.symmetric(vertical: 18),
            decoration: BoxDecoration(
              color: const Color(0xFFFAFAFA),
              borderRadius: BorderRadius.circular(10),
            ),
            child: const Column(
              children: [
                Icon(Icons.reviews_outlined, color: AppColors.textMuted, size: 28),
                SizedBox(height: 6),
                Text('No reviews yet',
                    style: TextStyle(
                        fontSize: 13, color: AppColors.textMuted, fontWeight: FontWeight.w600)),
                SizedBox(height: 2),
                Text('Be the first to review',
                    style: TextStyle(fontSize: 11, color: AppColors.textMuted)),
              ],
            ),
          ),
        ] else ...[
          const SizedBox(height: 14),
          ...reviews.take(3).map((r) => _ReviewTile(review: r is Map ? Map<String, dynamic>.from(r) : {})),
        ],
      ],
    );
  }
}

class _ReviewTile extends StatelessWidget {
  final Map<String, dynamic> review;
  const _ReviewTile({required this.review});

  @override
  Widget build(BuildContext context) {
    final r = ((review['rating'] ?? 0) as num).toInt();
    final name = (review['userName'] ?? 'User').toString();
    final comment = (review['comment'] ?? '').toString();
    final created = (review['createdAt'] ?? '').toString();
    String when = '';
    try {
      final d = DateTime.parse(created).toLocal();
      when = '${d.day}/${d.month}/${d.year}';
    } catch (_) {}

    return Container(
      margin: const EdgeInsets.only(bottom: 10),
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: const Color(0xFFFAFAFA),
        borderRadius: BorderRadius.circular(10),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                decoration: BoxDecoration(
                  color: r >= 4
                      ? AppColors.success
                      : r == 3
                          ? AppColors.accent
                          : AppColors.error,
                  borderRadius: BorderRadius.circular(4),
                ),
                child: Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Text('$r',
                        style: const TextStyle(
                            color: Colors.white, fontSize: 11, fontWeight: FontWeight.w800)),
                    const SizedBox(width: 2),
                    const Icon(Icons.star_rounded, color: Colors.white, size: 11),
                  ],
                ),
              ),
              const SizedBox(width: 8),
              Expanded(
                child: Text(name,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: const TextStyle(
                        fontSize: 13, fontWeight: FontWeight.w700, color: AppColors.textPrimary)),
              ),
              if (when.isNotEmpty)
                Text(when,
                    style: const TextStyle(fontSize: 10.5, color: AppColors.textMuted)),
            ],
          ),
          if (comment.isNotEmpty) ...[
            const SizedBox(height: 6),
            Text(comment,
                style: const TextStyle(
                    fontSize: 12.5, height: 1.45, color: AppColors.textSecondary)),
          ],
        ],
      ),
    );
  }
}
