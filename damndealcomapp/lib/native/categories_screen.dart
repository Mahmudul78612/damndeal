import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:http/http.dart' as http;

/// Native "Categories" tab — fully server-driven:
/// admin banner (placement "category_page") → plain category grid (image +
/// name only) → Recent Products → Recommended. Taps hand web URLs back to the
/// shell via [onOpenLink].
class CategoriesScreen extends StatefulWidget {
  const CategoriesScreen({
    super.key,
    required this.baseUrl,
    required this.region,
    required this.accent,
    required this.onOpenLink,
  });

  /// Site origin without trailing slash, e.g. https://damndeal.in
  final String baseUrl;

  /// Region header value: IN or US.
  final String region;

  final Color accent;

  final ValueChanged<String> onOpenLink;

  @override
  State<CategoriesScreen> createState() => _CategoriesScreenState();
}

class _Category {
  const _Category({required this.id, required this.name, required this.icon});

  final String id;
  final String name;
  final String icon;
}

class _PageBanner {
  const _PageBanner({required this.image, required this.link});

  final String image;
  final String link;
}

class _ProductCard {
  const _ProductCard({
    required this.id,
    required this.name,
    required this.image,
    required this.price,
    this.mrp,
  });

  final String id;
  final String name;
  final String image;
  final String price;
  final String? mrp;
}

class _CategoriesScreenState extends State<CategoriesScreen> {
  bool _loading = true;
  String? _error;
  List<_PageBanner> _banners = const [];
  List<_Category> _categories = const [];
  List<_ProductCard> _recent = const [];
  List<_ProductCard> _recommended = const [];

  @override
  void initState() {
    super.initState();
    _fetch();
  }

  String _absolutize(String pathOrUrl) {
    if (pathOrUrl.startsWith('http://') || pathOrUrl.startsWith('https://')) {
      return pathOrUrl;
    }
    if (pathOrUrl.startsWith('/')) {
      return '${widget.baseUrl}$pathOrUrl';
    }
    return '${widget.baseUrl}/$pathOrUrl';
  }

  String _formatPrice(num value, String currency) {
    final symbol = currency == 'USD' ? '\$' : '₹';
    final rounded = value == value.roundToDouble()
        ? value.toInt().toString()
        : value.toStringAsFixed(2);
    return '$symbol$rounded';
  }

  Future<void> _fetch() async {
    if (mounted) {
      setState(() {
        _loading = true;
        _error = null;
      });
    }
    try {
      final res = await http.get(
        Uri.parse(
          '${widget.baseUrl}/proxy-api/user/app-categories-page?platform=damndeal',
        ),
        headers: {'x-region': widget.region},
      ).timeout(const Duration(seconds: 15));
      if (res.statusCode != 200) {
        throw Exception('HTTP ${res.statusCode}');
      }
      final decoded = jsonDecode(res.body) as Map<String, dynamic>;
      if (decoded['success'] != true) {
        throw Exception('unavailable');
      }
      final currency = (decoded['currency'] ?? '').toString();

      final banners = <_PageBanner>[];
      for (final raw in (decoded['banners'] as List?) ?? const []) {
        if (raw is! Map) continue;
        final image = (raw['image'] ?? '').toString();
        if (image.isEmpty) continue;
        final link = (raw['link'] ?? '').toString();
        banners.add(_PageBanner(
          image: _absolutize(image),
          link: link.isEmpty ? '' : _absolutize(link),
        ));
      }

      final categories = <_Category>[];
      for (final raw in (decoded['categories'] as List?) ?? const []) {
        if (raw is! Map) continue;
        final id = (raw['id'] ?? '').toString();
        final name = (raw['name'] ?? '').toString();
        if (id.isEmpty || name.isEmpty) continue;
        final icon = (raw['icon'] ?? '').toString();
        categories.add(_Category(
          id: id,
          name: name,
          icon: icon.isEmpty ? '' : _absolutize(icon),
        ));
      }

      List<_ProductCard> parseProducts(String key) {
        final out = <_ProductCard>[];
        for (final raw in (decoded[key] as List?) ?? const []) {
          if (raw is! Map) continue;
          final id = (raw['id'] ?? '').toString();
          final image = (raw['image'] ?? '').toString();
          final price = raw['price'];
          if (id.isEmpty || image.isEmpty || price is! num) continue;
          final mrp = raw['mrp'];
          out.add(_ProductCard(
            id: id,
            name: (raw['name'] ?? '').toString(),
            image: _absolutize(image),
            price: _formatPrice(price, currency),
            mrp: mrp is num ? _formatPrice(mrp, currency) : null,
          ));
        }
        return out;
      }

      if (!mounted) return;
      setState(() {
        _banners = banners;
        _categories = categories;
        _recent = parseProducts('recent');
        _recommended = parseProducts('recommended');
        _loading = false;
      });
    } catch (_) {
      if (!mounted) return;
      setState(() {
        _error =
            'Could not load categories. Check your connection and try again.';
        _loading = false;
      });
    }
  }

  void _open(String link) {
    if (link.isEmpty) return;
    HapticFeedback.selectionClick();
    widget.onOpenLink(link);
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFFF8F6F2),
      appBar: AppBar(
        backgroundColor: widget.accent,
        foregroundColor: Colors.white,
        automaticallyImplyLeading: false,
        title: const Text(
          'Categories',
          style: TextStyle(fontWeight: FontWeight.w700),
        ),
        elevation: 0,
      ),
      body: _buildBody(context),
    );
  }

  Widget _buildBody(BuildContext context) {
    if (_loading) {
      return const Center(child: CircularProgressIndicator());
    }
    if (_error != null || _categories.isEmpty) {
      return LayoutBuilder(
        builder: (context, constraints) => RefreshIndicator(
          color: widget.accent,
          onRefresh: _fetch,
          child: SingleChildScrollView(
            physics: const AlwaysScrollableScrollPhysics(),
            child: ConstrainedBox(
              constraints: BoxConstraints(minHeight: constraints.maxHeight),
              child: Column(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  Icon(
                    _error != null ? Icons.wifi_off : Icons.category_outlined,
                    size: 48,
                    color: const Color(0xFF8D8A85),
                  ),
                  const SizedBox(height: 12),
                  Padding(
                    padding: const EdgeInsets.symmetric(horizontal: 32),
                    child: Text(
                      _error ?? 'No categories yet — check back soon!',
                      textAlign: TextAlign.center,
                      style: Theme.of(context).textTheme.bodyMedium,
                    ),
                  ),
                  const SizedBox(height: 16),
                  ElevatedButton(
                    style: ElevatedButton.styleFrom(
                      backgroundColor: widget.accent,
                      foregroundColor: Colors.white,
                    ),
                    onPressed: _fetch,
                    child: const Text('Retry'),
                  ),
                ],
              ),
            ),
          ),
        ),
      );
    }
    return RefreshIndicator(
      color: widget.accent,
      onRefresh: _fetch,
      child: ListView(
        physics: const AlwaysScrollableScrollPhysics(),
        padding: const EdgeInsets.fromLTRB(14, 14, 14, 24),
        children: [
          if (_banners.isNotEmpty) ...[
            _buildBanners(context),
            const SizedBox(height: 16),
          ],
          _buildCategoryGrid(context),
          if (_recent.isNotEmpty) ...[
            const SizedBox(height: 20),
            _buildHeading('Recent Products'),
            const SizedBox(height: 10),
            SizedBox(
              height: 198,
              child: ListView.separated(
                scrollDirection: Axis.horizontal,
                itemCount: _recent.length,
                separatorBuilder: (_, _) => const SizedBox(width: 10),
                itemBuilder: (context, index) => SizedBox(
                  width: 132,
                  child: _buildProductCard(context, _recent[index]),
                ),
              ),
            ),
          ],
          if (_recommended.isNotEmpty) ...[
            const SizedBox(height: 20),
            _buildHeading('Recommended For You'),
            const SizedBox(height: 10),
            GridView.builder(
              shrinkWrap: true,
              physics: const NeverScrollableScrollPhysics(),
              gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
                crossAxisCount: 2,
                mainAxisSpacing: 10,
                crossAxisSpacing: 10,
                childAspectRatio: 0.74,
              ),
              itemCount: _recommended.length,
              itemBuilder: (context, index) =>
                  _buildProductCard(context, _recommended[index]),
            ),
          ],
        ],
      ),
    );
  }

  Widget _buildHeading(String text) {
    return Text(
      text,
      style: const TextStyle(
        fontWeight: FontWeight.w800,
        fontSize: 15.5,
        color: Color(0xFF2B2B2B),
      ),
    );
  }

  Widget _buildBanners(BuildContext context) {
    final width = MediaQuery.of(context).size.width - 28;
    final height = width * 0.42;
    if (_banners.length == 1) {
      return _buildBannerImage(_banners.first, height);
    }
    return SizedBox(
      height: height,
      child: PageView.builder(
        itemCount: _banners.length,
        controller: PageController(viewportFraction: 0.94),
        itemBuilder: (context, index) => Padding(
          padding: const EdgeInsets.symmetric(horizontal: 3),
          child: _buildBannerImage(_banners[index], height),
        ),
      ),
    );
  }

  Widget _buildBannerImage(_PageBanner banner, double height) {
    return GestureDetector(
      onTap: () => _open(banner.link),
      child: ClipRRect(
        borderRadius: BorderRadius.circular(14),
        child: Image.network(
          banner.image,
          height: height,
          width: double.infinity,
          fit: BoxFit.cover,
          errorBuilder: (_, _, _) => const SizedBox.shrink(),
        ),
      ),
    );
  }

  /// Plain grid — just image + name, no card chrome.
  Widget _buildCategoryGrid(BuildContext context) {
    return GridView.builder(
      shrinkWrap: true,
      physics: const NeverScrollableScrollPhysics(),
      gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
        crossAxisCount: 4,
        mainAxisSpacing: 14,
        crossAxisSpacing: 8,
        childAspectRatio: 0.78,
      ),
      itemCount: _categories.length,
      itemBuilder: (context, index) {
        final category = _categories[index];
        return GestureDetector(
          onTap: () =>
              _open('${widget.baseUrl}/categories/${category.id}'),
          child: Column(
            children: [
              Container(
                width: 58,
                height: 58,
                decoration: const BoxDecoration(
                  color: Color(0xFFF1EDF4),
                  shape: BoxShape.circle,
                ),
                clipBehavior: Clip.antiAlias,
                child: category.icon.isEmpty
                    ? Icon(Icons.category_outlined, color: widget.accent)
                    : Image.network(
                        category.icon,
                        fit: BoxFit.cover,
                        errorBuilder: (_, _, _) => Icon(
                          Icons.category_outlined,
                          color: widget.accent,
                        ),
                      ),
              ),
              const SizedBox(height: 6),
              Expanded(
                child: Text(
                  category.name,
                  maxLines: 2,
                  overflow: TextOverflow.ellipsis,
                  textAlign: TextAlign.center,
                  style: const TextStyle(
                    fontWeight: FontWeight.w600,
                    fontSize: 11,
                    height: 1.15,
                  ),
                ),
              ),
            ],
          ),
        );
      },
    );
  }

  Widget _buildProductCard(BuildContext context, _ProductCard product) {
    return GestureDetector(
      onTap: () => _open('${widget.baseUrl}/product/${product.id}'),
      child: Container(
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(12),
          border: Border.all(color: const Color(0xFFEDEAE4)),
        ),
        clipBehavior: Clip.antiAlias,
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Expanded(
              child: SizedBox(
                width: double.infinity,
                child: Image.network(
                  product.image,
                  fit: BoxFit.cover,
                  errorBuilder: (_, _, _) => Container(
                    color: const Color(0xFFEFECE6),
                    alignment: Alignment.center,
                    child: const Icon(
                      Icons.shopping_bag_outlined,
                      color: Color(0xFF8D8A85),
                    ),
                  ),
                ),
              ),
            ),
            Padding(
              padding: const EdgeInsets.fromLTRB(8, 6, 8, 8),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    product.name,
                    maxLines: 2,
                    overflow: TextOverflow.ellipsis,
                    style: const TextStyle(
                      fontSize: 11.5,
                      fontWeight: FontWeight.w600,
                      height: 1.2,
                    ),
                  ),
                  const SizedBox(height: 3),
                  Row(
                    crossAxisAlignment: CrossAxisAlignment.baseline,
                    textBaseline: TextBaseline.alphabetic,
                    children: [
                      Text(
                        product.price,
                        style: TextStyle(
                          fontWeight: FontWeight.w800,
                          fontSize: 13,
                          color: widget.accent,
                        ),
                      ),
                      if (product.mrp != null) ...[
                        const SizedBox(width: 5),
                        Text(
                          product.mrp!,
                          style: TextStyle(
                            fontSize: 10.5,
                            color: Colors.grey.shade500,
                            decoration: TextDecoration.lineThrough,
                          ),
                        ),
                      ],
                    ],
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}
