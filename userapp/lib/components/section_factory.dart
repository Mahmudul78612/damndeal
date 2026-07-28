import 'package:flutter/material.dart';
import 'package:cached_network_image/cached_network_image.dart';
import 'package:provider/provider.dart';
import '../services/cart_service.dart';
import '../config.dart';

/// Server-Driven UI Section Renderer
/// Reads section JSON from backend and renders appropriate widgets.
/// Admin can control: type, layout, columns, cardStyle, bgColor, itemWidth, itemHeight, showTitle, showSeeAll
class SectionFactory extends StatelessWidget {
  final Map<String, dynamic> section;
  final void Function(dynamic product) onAddToCart;
  final void Function(dynamic product) onProductTap;
  final void Function(String categoryId, String categoryName)? onSeeAllTap;
  final void Function(dynamic product, String variantLabel, double price)? onVariantAdd;

  const SectionFactory({
    super.key,
    required this.section,
    required this.onAddToCart,
    required this.onProductTap,
    this.onSeeAllTap,
    this.onVariantAdd,
  });

  // ── extract style config with defaults ──
  Map<String, dynamic> get _data => (section['data'] as Map<String, dynamic>?) ?? {};
  List get _items => (section['items'] as List?) ?? [];
  String get _title => section['title'] ?? '';
  String get _layout => _data['layout'] ?? 'horizontal';
  int get _columns => (_data['columns'] ?? 3) as int;
  String get _cardStyle => _data['cardStyle'] ?? 'default';
  Color get _bgColor {
    final hex = _data['bgColor'];
    if (hex is String && hex.startsWith('#') && hex.length == 7) {
      return Color(int.parse('FF${hex.substring(1)}', radix: 16));
    }
    return Colors.transparent;
  }
  double get _itemWidth => (_data['itemWidth'] ?? 140).toDouble();
  double get _itemHeight => (_data['itemHeight'] ?? 220).toDouble();
  bool get _showTitle => _data['showTitle'] != false;
  bool get _showSeeAll => _data['showSeeAll'] != false;
  String? get _categoryId => _data['categoryId']?.toString();
  String get _categoryName => _data['categoryName'] ?? _title;

  @override
  Widget build(BuildContext context) {
    if (_items.isEmpty) return const SizedBox.shrink();

    return Container(
      color: _bgColor,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          if (_showTitle && _title.isNotEmpty) _buildTitle(),
          if (_layout == 'grid')
            _buildGrid(context)
          else
            _buildHorizontal(context),
          if (_showSeeAll && _categoryId != null && _categoryId!.isNotEmpty)
            Center(child: _buildSeeAllBar(context)),
        ],
      ),
    );
  }

  Widget _buildTitle() {
    return Padding(
      padding: const EdgeInsets.fromLTRB(16, 12, 16, 6),
      child: Text(
        _title,
        style: const TextStyle(fontSize: 18, fontWeight: FontWeight.w700, color: Color(0xFF1A1A1A)),
      ),
    );
  }

  // ── HORIZONTAL SCROLL ──
  Widget _buildHorizontal(BuildContext context) {
    return SizedBox(
      height: _itemHeight,
      child: ListView.builder(
        scrollDirection: Axis.horizontal,
        padding: const EdgeInsets.symmetric(horizontal: 12),
        itemCount: _items.length,
        itemBuilder: (ctx, i) => Container(
          width: _itemWidth,
          margin: const EdgeInsets.only(right: 10),
          child: _buildCard(ctx, _items[i]),
        ),
      ),
    );
  }

  // ── GRID ──
  Widget _buildGrid(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 12),
      child: GridView.builder(
        shrinkWrap: true,
        physics: const NeverScrollableScrollPhysics(),
        gridDelegate: SliverGridDelegateWithFixedCrossAxisCount(
          crossAxisCount: _columns,
          mainAxisSpacing: 10,
          crossAxisSpacing: 10,
          childAspectRatio: _cardStyle == 'compact' ? 0.68 : 0.54,
        ),
        itemCount: _items.length,
        itemBuilder: (ctx, i) => _buildCard(ctx, _items[i]),
      ),
    );
  }

  // ── CARD RENDERER — dispatches to card style ──
  Widget _buildCard(BuildContext context, dynamic item) {
    final p = item is Map ? Map<String, dynamic>.from(item) : <String, dynamic>{};
    switch (_cardStyle) {
      case 'compact':
        return _CompactCard(product: p, onTap: () => onProductTap(p));
      case 'minimal':
        return _MinimalCard(product: p, onTap: () => onProductTap(p));
      case 'big_image':
        return _BigImageCard(product: p, onTap: () => onProductTap(p));
      default:
        return _DefaultCard(product: p, onTap: () => onProductTap(p));
    }
  }

  // ── SEE ALL BAR ──
  Widget _buildSeeAllBar(BuildContext context) {
    final thumbCount = _items.length > 4 ? 4 : _items.length;
    final stackWidth = thumbCount > 1 ? (thumbCount - 1) * 18.0 + 30 : 30.0;

    return GestureDetector(
      onTap: () => onSeeAllTap?.call(_categoryId!, _categoryName),
      child: Container(
        width: double.infinity,
        height: 44,
        margin: const EdgeInsets.fromLTRB(12, 10, 12, 14),
        padding: const EdgeInsets.symmetric(horizontal: 14),
        decoration: BoxDecoration(
          color: const Color(0xFFF5F7FB),
          borderRadius: BorderRadius.circular(12),
          border: Border.all(color: const Color(0xFFE5E7EB), width: 1),
        ),
        child: Row(
          children: [
            SizedBox(
              width: stackWidth,
              height: 28,
              child: Stack(
                clipBehavior: Clip.none,
                children: [
                  for (int i = 0; i < thumbCount; i++)
                    Positioned(
                      left: i * 16.0,
                      child: Container(
                        width: 28,
                        height: 28,
                        decoration: BoxDecoration(
                          shape: BoxShape.circle,
                          color: Colors.white,
                          border: Border.all(color: Colors.white, width: 1.5),
                          boxShadow: [
                            BoxShadow(color: Colors.black.withValues(alpha: 0.08), blurRadius: 3),
                          ],
                        ),
                        child: ClipOval(child: _thumb(_items[i])),
                      ),
                    ),
                ],
              ),
            ),
            const Spacer(),
            Text(
              'View All${_categoryName.isNotEmpty ? ' $_categoryName' : ''}',
              style: TextStyle(fontSize: 13, fontWeight: FontWeight.w800, color: Colors.grey.shade800),
            ),
            const SizedBox(width: 4),
            Icon(Icons.arrow_forward_rounded, size: 16, color: Colors.grey.shade700),
          ],
        ),
      ),
    );
  }

  Widget _thumb(dynamic item) {
    final images = item is Map ? (item['images'] as List? ?? []) : [];
    final img = images.isNotEmpty ? images[0] : null;
    final src = img != null ? (img.toString().startsWith('http') ? img : '${AppConfig.uploadsBase}$img') : '';
    if (src.isEmpty) return Container(color: Colors.grey.shade200, child: const Icon(Icons.shopping_bag_outlined, size: 14, color: Colors.grey));
    return CachedNetworkImage(imageUrl: src, fit: BoxFit.cover, fadeInDuration: Duration.zero, placeholderFadeInDuration: Duration.zero, errorWidget: (_, __, ___) => Container(color: Colors.grey.shade200));
  }
}

// ═══════════════════════════════════════════
//  CARD STYLES
// ═══════════════════════════════════════════

String _imgSrc(Map<String, dynamic> p) {
  final images = p['images'] as List? ?? [];
  final img = images.isNotEmpty ? images[0] : null;
  if (img == null) return '';
  return img.toString().startsWith('http') ? img : '${AppConfig.uploadsBase}$img';
}

double _price(Map<String, dynamic> p) => (p['sellingPrice'] ?? p['price'] ?? 0).toDouble();
double _mrp(Map<String, dynamic> p) => (p['price'] ?? 0).toDouble();
int _discount(Map<String, dynamic> p) {
  final pr = _price(p), mr = _mrp(p);
  return mr > pr ? ((mr - pr) / mr * 100).round() : 0;
}
bool _inStock(Map<String, dynamic> p) => (p['stock'] ?? 0) > 0;

/// ── DEFAULT CARD: Image + ADD overlay + Name + Price + Discount ──
class _DefaultCard extends StatelessWidget {
  final Map<String, dynamic> product;
  final VoidCallback onTap;


  const _DefaultCard({required this.product, required this.onTap});

  @override
  Widget build(BuildContext context) {
    final src = _imgSrc(product);
    final name = product['name'] ?? '';
    final price = _price(product);
    final disc = _discount(product);
    final inStock = _inStock(product);
    final cart = context.watch<CartService>();
    final qty = cart.getQuantity(product['_id'] ?? '');

    return GestureDetector(
      onTap: onTap,
      child: Container(
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(12),
          boxShadow: [BoxShadow(color: Colors.black.withValues(alpha: 0.05), blurRadius: 8, offset: const Offset(0, 2))],
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // Image area
            Expanded(
              flex: 3,
              child: Container(
                width: double.infinity,
                decoration: const BoxDecoration(
                  color: Color(0xFFF5F5F5),
                  borderRadius: BorderRadius.vertical(top: Radius.circular(12)),
                ),
                child: Stack(
                  children: [
                    Padding(
                      padding: const EdgeInsets.all(10),
                      child: Center(
                        child: src.isNotEmpty
                            ? CachedNetworkImage(imageUrl: src, fit: BoxFit.contain,
                                fadeInDuration: Duration.zero,
                                placeholderFadeInDuration: Duration.zero,
                                placeholder: (_, __) => const SizedBox(width: 20, height: 20, child: CircularProgressIndicator(strokeWidth: 1.5)),
                                errorWidget: (_, __, ___) => Icon(Icons.image_not_supported_outlined, color: Colors.grey.shade400, size: 28))
                            : Icon(Icons.shopping_bag_outlined, size: 28, color: Colors.grey.shade400),
                      ),
                    ),
                    if (disc > 0)
                      Positioned(top: 6, left: 6, child: _discountBadge(disc)),
                    if (!inStock) _outOfStockOverlay(),
                  ],
                ),
              ),
            ),
            // Info area — fixed height to prevent overflow
            SizedBox(
              height: 62,
              child: Padding(
                padding: const EdgeInsets.fromLTRB(8, 5, 8, 6),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Text(name, maxLines: 2, overflow: TextOverflow.ellipsis,
                      style: const TextStyle(fontSize: 11, fontWeight: FontWeight.w600, color: Color(0xFF1A1A1A), height: 1.2)),
                    Row(
                      crossAxisAlignment: CrossAxisAlignment.center,
                      children: [
                        Flexible(
                          child: Text('₹${price.toStringAsFixed(0)}',
                            overflow: TextOverflow.ellipsis,
                            style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w800, color: Color(0xFF1A1A1A))),
                        ),
                        if (disc > 0) ...[
                          const SizedBox(width: 4),
                          Text('$disc% off', style: const TextStyle(fontSize: 9, fontWeight: FontWeight.w700, color: Color(0xFF0D7A30))),
                        ],
                      ],
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
}

/// ── COMPACT CARD: Smaller, tighter spacing ──
class _CompactCard extends StatelessWidget {
  final Map<String, dynamic> product;
  final VoidCallback onTap;


  const _CompactCard({required this.product, required this.onTap});

  @override
  Widget build(BuildContext context) {
    final src = _imgSrc(product);
    final name = product['name'] ?? '';
    final price = _price(product);
    final disc = _discount(product);
    final inStock = _inStock(product);
    final cart = context.watch<CartService>();
    final qty = cart.getQuantity(product['_id'] ?? '');

    return GestureDetector(
      onTap: onTap,
      child: Container(
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(10),
          border: Border.all(color: Colors.grey.shade200),
        ),
        child: Column(
          children: [
            Expanded(
              child: Container(
                width: double.infinity,
                decoration: const BoxDecoration(
                  color: Color(0xFFF8F8F8),
                  borderRadius: BorderRadius.vertical(top: Radius.circular(10)),
                ),
                child: Stack(
                  children: [
                    Padding(
                      padding: const EdgeInsets.all(8),
                      child: Center(
                        child: src.isNotEmpty
                            ? CachedNetworkImage(imageUrl: src, fit: BoxFit.contain,
                                fadeInDuration: Duration.zero,
                                placeholderFadeInDuration: Duration.zero,
                                errorWidget: (_, __, ___) => Icon(Icons.image_not_supported_outlined, color: Colors.grey.shade300, size: 24))
                            : Icon(Icons.shopping_bag_outlined, size: 24, color: Colors.grey.shade300),
                      ),
                    ),
                    if (!inStock) _outOfStockOverlay(radius: 10),
                  ],
                ),
              ),
            ),
            SizedBox(
              height: 46,
              child: Padding(
                padding: const EdgeInsets.fromLTRB(6, 4, 6, 4),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Text(name, maxLines: 2, overflow: TextOverflow.ellipsis,
                      style: const TextStyle(fontSize: 10, fontWeight: FontWeight.w600, color: Color(0xFF1A1A1A), height: 1.2)),
                    Row(children: [
                      Flexible(
                        child: Text('₹${price.toStringAsFixed(0)}',
                          overflow: TextOverflow.ellipsis,
                          style: const TextStyle(fontSize: 11, fontWeight: FontWeight.w800)),
                      ),
                      if (disc > 0) ...[
                        const SizedBox(width: 2),
                        Text('$disc%off', style: const TextStyle(fontSize: 8, fontWeight: FontWeight.w600, color: Color(0xFF0D7A30))),
                      ],
                    ]),
                  ],
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

/// ── MINIMAL CARD: Just image + price overlay ──
class _MinimalCard extends StatelessWidget {
  final Map<String, dynamic> product;
  final VoidCallback onTap;


  const _MinimalCard({required this.product, required this.onTap});

  @override
  Widget build(BuildContext context) {
    final src = _imgSrc(product);
    final price = _price(product);
    final inStock = _inStock(product);
    final cart = context.watch<CartService>();
    final qty = cart.getQuantity(product['_id'] ?? '');

    return GestureDetector(
      onTap: onTap,
      child: Container(
        decoration: BoxDecoration(
          color: const Color(0xFFF5F5F5),
          borderRadius: BorderRadius.circular(12),
        ),
        child: Stack(
          children: [
            Positioned.fill(
              child: Padding(
                padding: const EdgeInsets.all(12),
                child: src.isNotEmpty
                    ? CachedNetworkImage(imageUrl: src, fit: BoxFit.contain,
                        fadeInDuration: Duration.zero,
                        placeholderFadeInDuration: Duration.zero,
                        errorWidget: (_, __, ___) => Icon(Icons.shopping_bag_outlined, size: 28, color: Colors.grey.shade400))
                    : Icon(Icons.shopping_bag_outlined, size: 28, color: Colors.grey.shade400),
              ),
            ),
            // Price pill bottom-left
            Positioned(
              bottom: 6, left: 6,
              child: Container(
                padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 3),
                decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(6),
                  boxShadow: [BoxShadow(color: Colors.black.withValues(alpha: 0.1), blurRadius: 4)]),
                child: Text('₹${price.toStringAsFixed(0)}', style: const TextStyle(fontSize: 11, fontWeight: FontWeight.w800)),
              ),
            ),
            if (!inStock) _outOfStockOverlay(),
          ],
        ),
      ),
    );
  }
}

/// ── BIG IMAGE CARD: Large image, floating info ──
class _BigImageCard extends StatelessWidget {
  final Map<String, dynamic> product;
  final VoidCallback onTap;


  const _BigImageCard({required this.product, required this.onTap});

  @override
  Widget build(BuildContext context) {
    final src = _imgSrc(product);
    final name = product['name'] ?? '';
    final price = _price(product);
    final disc = _discount(product);
    final inStock = _inStock(product);
    final cart = context.watch<CartService>();
    final qty = cart.getQuantity(product['_id'] ?? '');

    return GestureDetector(
      onTap: onTap,
      child: Container(
        decoration: BoxDecoration(
          borderRadius: BorderRadius.circular(14),
          color: const Color(0xFFF5F5F5),
        ),
        child: Stack(
          children: [
            // Big image fills
            Positioned.fill(
              child: ClipRRect(
                borderRadius: BorderRadius.circular(14),
                child: src.isNotEmpty
                    ? CachedNetworkImage(imageUrl: src, fit: BoxFit.cover,
                        fadeInDuration: Duration.zero,
                        placeholderFadeInDuration: Duration.zero,
                        errorWidget: (_, __, ___) => Container(color: Colors.grey.shade200))
                    : Container(color: Colors.grey.shade200),
              ),
            ),
            // Gradient overlay at bottom
            Positioned(
              left: 0, right: 0, bottom: 0,
              child: Container(
                padding: const EdgeInsets.fromLTRB(10, 20, 10, 10),
                decoration: BoxDecoration(
                  borderRadius: const BorderRadius.vertical(bottom: Radius.circular(14)),
                  gradient: LinearGradient(
                    begin: Alignment.topCenter, end: Alignment.bottomCenter,
                    colors: [Colors.transparent, Colors.black.withValues(alpha: 0.7)],
                  ),
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Text(name, maxLines: 2, overflow: TextOverflow.ellipsis,
                      style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w700, color: Colors.white)),
                    const SizedBox(height: 2),
                    Row(children: [
                      Text('₹${price.toStringAsFixed(0)}', style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w800, color: Colors.white)),
                      if (disc > 0) ...[
                        const SizedBox(width: 4),
                        Container(
                          padding: const EdgeInsets.symmetric(horizontal: 4, vertical: 1),
                          decoration: BoxDecoration(color: const Color(0xFF0D7A30), borderRadius: BorderRadius.circular(3)),
                          child: Text('$disc%', style: const TextStyle(fontSize: 8, fontWeight: FontWeight.w700, color: Colors.white)),
                        ),
                      ],
                    ]),
                  ],
                ),
              ),
            ),
            // Discount badge top-left
            if (disc > 0)
              Positioned(top: 6, left: 6, child: _discountBadge(disc)),
            if (!inStock) _outOfStockOverlay(radius: 14),
          ],
        ),
      ),
    );
  }
}

// ═══════════════════════════════════════════
//  SHARED WIDGETS
// ═══════════════════════════════════════════

Widget _discountBadge(int disc) {
  return Container(
    padding: const EdgeInsets.symmetric(horizontal: 5, vertical: 2),
    decoration: BoxDecoration(color: const Color(0xFF0D7A30), borderRadius: BorderRadius.circular(4)),
    child: Text('$disc%', style: const TextStyle(color: Colors.white, fontSize: 8, fontWeight: FontWeight.w700)),
  );
}


Widget _outOfStockOverlay({double radius = 12}) {
  return Positioned.fill(
    child: Container(
      decoration: BoxDecoration(
        color: Colors.white.withValues(alpha: 0.75),
        borderRadius: BorderRadius.all(Radius.circular(radius)),
      ),
      child: const Center(
        child: Text('Out of Stock', style: TextStyle(color: Colors.red, fontWeight: FontWeight.w700, fontSize: 10)),
      ),
    ),
  );
}

// ═══════════════════════════════════════════
//  PROMO SECTION — 3:4 bg image + overlay card images
// ═══════════════════════════════════════════
class PromoSection extends StatelessWidget {
  final Map<String, dynamic> section;
  final void Function(String? categoryId, String? categoryName)? onCardTap;

  const PromoSection({super.key, required this.section, this.onCardTap});

  @override
  Widget build(BuildContext context) {
    final data = (section['data'] as Map<String, dynamic>?) ?? {};
    final cards = (data['cards'] as List?) ?? [];

    final bgImage = data['bgImage'] as String?;
    final bgColorHex = data['bgColor'] as String?;

    Color bgColor = const Color(0xFFE3F2FD);
    if (bgColorHex is String && bgColorHex.startsWith('#') && bgColorHex.length == 7) {
      bgColor = Color(int.parse('FF${bgColorHex.substring(1)}', radix: 16));
    }

    final bgSrc = bgImage != null && bgImage.isNotEmpty
        ? (bgImage.startsWith('http') ? bgImage : '${AppConfig.uploadsBase}$bgImage')
        : null;

    return Container(
      margin: const EdgeInsets.symmetric(vertical: 4),
      child: Stack(
        children: [
          // Background
          if (bgSrc != null)
            CachedNetworkImage(
              imageUrl: bgSrc,
              width: double.infinity,
              fit: BoxFit.cover,
              fadeInDuration: Duration.zero,
              placeholderFadeInDuration: Duration.zero,
              placeholder: (_, __) => Container(height: 220, color: bgColor),
              errorWidget: (_, __, ___) => Container(height: 220, color: bgColor),
            )
          else
            Container(height: 220, color: bgColor),

          // 4 cards overlay on top of banner
          if (cards.isNotEmpty)
            Positioned.fill(
              child: Align(
                alignment: Alignment.bottomCenter,
                child: Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                  child: Row(
                    children: cards.take(4).map<Widget>((c) {
                      final card = c is Map ? Map<String, dynamic>.from(c) : <String, dynamic>{};
                      return Expanded(
                        child: Padding(
                          padding: const EdgeInsets.symmetric(horizontal: 4),
                          child: _PromoCard(card: card, onTap: onCardTap),
                        ),
                      );
                    }).toList(),
                  ),
                ),
              ),
            ),
        ],
      ),
    );
  }
}

class _PromoCard extends StatelessWidget {
  final Map<String, dynamic> card;
  final void Function(String? categoryId, String? categoryName)? onTap;

  const _PromoCard({required this.card, this.onTap});

  @override
  Widget build(BuildContext context) {
    final image = card['image'] as String?;
    final categoryId = card['categoryId'] as String?;
    final categoryName = card['categoryName'] ?? '';

    final imgSrc = image != null && image.isNotEmpty
        ? (image.startsWith('http') ? image : '${AppConfig.uploadsBase}$image')
        : null;

    return GestureDetector(
      onTap: () => onTap?.call(categoryId, categoryName),
      child: AspectRatio(
        aspectRatio: 3 / 4,
        child: Container(
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(14),
            boxShadow: [
              BoxShadow(color: Colors.black.withValues(alpha: 0.12), blurRadius: 8, offset: const Offset(0, 3)),
            ],
          ),
          child: ClipRRect(
            borderRadius: BorderRadius.circular(14),
            child: imgSrc != null
                ? CachedNetworkImage(
                    imageUrl: imgSrc,
                    width: double.infinity,
                    height: double.infinity,
                    fit: BoxFit.cover,
                    fadeInDuration: Duration.zero,
                    placeholderFadeInDuration: Duration.zero,
                    placeholder: (_, __) => Container(color: const Color(0xFFF5F5F5)),
                    errorWidget: (_, __, ___) => Container(
                      color: const Color(0xFFF5F5F5),
                      child: const Icon(Icons.image_outlined, color: Colors.grey),
                    ),
                  )
                : Container(
                    color: const Color(0xFFF5F5F5),
                    child: const Icon(Icons.image_outlined, size: 30, color: Colors.grey),
                  ),
          ),
        ),
      ),
    );
  }
}
