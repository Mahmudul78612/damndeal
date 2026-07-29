import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:http/http.dart' as http;

/// Native "Offers & Updates" screen.
///
/// Fetches the live homepage banners/offers from the DamnDeal API and renders
/// them natively (pull-to-refresh, haptics, native navigation). Tapping a card
/// pops back with the target URL so the main WebView can open it.
class OffersScreen extends StatefulWidget {
  const OffersScreen({
    super.key,
    required this.baseUrl,
    required this.region,
    required this.accent,
    this.embedded = false,
    this.onOpenLink,
  });

  /// Site origin without trailing slash, e.g. https://damndeal.in
  final String baseUrl;

  /// Region header value: IN or US.
  final String region;

  final Color accent;

  /// True when shown as a tab inside the main shell (no back button, and
  /// taps go through [onOpenLink] instead of popping the route).
  final bool embedded;

  final ValueChanged<String>? onOpenLink;

  @override
  State<OffersScreen> createState() => _OffersScreenState();
}

class _OfferItem {
  const _OfferItem({
    required this.title,
    required this.section,
    required this.image,
    required this.link,
    this.price,
  });

  final String title;
  final String section;
  final String image;
  final String link;

  /// Formatted price — non-null makes this render as a compact product row.
  final String? price;
}

class _OffersScreenState extends State<OffersScreen> {
  bool _loading = true;
  String? _error;
  List<_OfferItem> _items = const [];

  @override
  void initState() {
    super.initState();
    _fetch();
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
        Uri.parse('${widget.baseUrl}/proxy-api/user/home?platform=damndeal'),
        headers: {'x-region': widget.region},
      ).timeout(const Duration(seconds: 15));
      if (res.statusCode != 200) {
        throw Exception('HTTP ${res.statusCode}');
      }
      final decoded = jsonDecode(res.body) as Map<String, dynamic>;
      final sections = (decoded['sections'] as List?) ?? const [];
      final seen = <String>{};
      final items = <_OfferItem>[];
      for (final rawSection in sections) {
        if (rawSection is! Map) continue;
        final sectionTitle = (rawSection['title'] ?? '').toString();
        final rawItems = (rawSection['items'] as List?) ?? const [];
        var productsFromSection = 0;
        for (final rawItem in rawItems) {
          if (rawItem is! Map) continue;
          var image = (rawItem['image'] ?? '').toString();
          var title = (rawItem['title'] ?? '').toString();
          var link = '';
          String? price;
          if (image.isNotEmpty) {
            // Banner-style item.
            link = _resolveLink(rawItem);
          } else {
            // Product-style item (name + images list + region price).
            final images = rawItem['images'];
            if (images is! List || images.isEmpty) continue;
            if (productsFromSection >= 4) continue;
            image = images.first.toString();
            if (image.isEmpty) continue;
            title = (rawItem['name'] ?? '').toString();
            final id = (rawItem['_id'] ?? '').toString();
            if (id.isNotEmpty) link = _absolutize('/product/$id');
            final sp = rawItem['sellingPrice'];
            if (sp is num) price = _formatPrice(sp);
            productsFromSection++;
          }
          final absImage = _absolutize(image);
          if (!seen.add(absImage)) continue;
          items.add(_OfferItem(
            title: title.isNotEmpty ? title : sectionTitle,
            section: sectionTitle,
            image: absImage,
            link: link,
            price: price,
          ));
          if (items.length >= 30) break;
        }
        if (items.length >= 30) break;
      }
      if (!mounted) return;
      setState(() {
        _items = items;
        _loading = false;
      });
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _error = 'Could not load offers. Check your connection and try again.';
        _loading = false;
      });
    }
  }

  String _formatPrice(num value) {
    final symbol = widget.region == 'IN' ? '₹' : '\$';
    final rounded = value == value.roundToDouble()
        ? value.toInt().toString()
        : value.toStringAsFixed(2);
    return '$symbol$rounded';
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

  /// Mirrors the web storefront's banner link resolution.
  String _resolveLink(Map<dynamic, dynamic> item) {
    final linkType = (item['linkType'] ?? '').toString();
    final linkValue = (item['linkValue'] ??
            item['categoryId'] ??
            item['subCategoryId'] ??
            item['productId'] ??
            item['link'] ??
            '')
        .toString();
    if (linkValue.isEmpty) return '';
    switch (linkType) {
      case 'category':
        return _absolutize('/categories/$linkValue');
      case 'subcategory':
        return _absolutize('/subcategory/$linkValue');
      case 'product':
        return _absolutize('/product/$linkValue');
      case 'url':
        return _absolutize(linkValue);
    }
    if (linkValue.startsWith('/') ||
        linkValue.startsWith('http://') ||
        linkValue.startsWith('https://')) {
      return _absolutize(linkValue);
    }
    return '';
  }

  void _openItem(_OfferItem item) {
    HapticFeedback.selectionClick();
    if (widget.onOpenLink != null) {
      if (item.link.isNotEmpty) {
        widget.onOpenLink!(item.link);
      }
      return;
    }
    Navigator.of(context).pop(item.link.isNotEmpty ? item.link : null);
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFFF8F6F2),
      appBar: AppBar(
        backgroundColor: widget.accent,
        foregroundColor: Colors.white,
        automaticallyImplyLeading: !widget.embedded,
        title: const Text(
          'Offers & Updates',
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
    if (_error != null) {
      return _buildMessage(
        context,
        icon: Icons.wifi_off,
        message: _error!,
        actionLabel: 'Retry',
      );
    }
    if (_items.isEmpty) {
      return _buildMessage(
        context,
        icon: Icons.notifications_none,
        message: 'No offers right now.\nPull down to refresh or check back soon!',
        actionLabel: 'Refresh',
      );
    }
    return RefreshIndicator(
      color: widget.accent,
      onRefresh: _fetch,
      child: ListView.separated(
        physics: const AlwaysScrollableScrollPhysics(),
        padding: const EdgeInsets.all(14),
        itemCount: _items.length,
        separatorBuilder: (_, _) => const SizedBox(height: 12),
        itemBuilder: (context, index) => _buildCard(context, _items[index]),
      ),
    );
  }

  Widget _buildMessage(
    BuildContext context, {
    required IconData icon,
    required String message,
    required String actionLabel,
  }) {
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
                Icon(icon, size: 48, color: const Color(0xFF8D8A85)),
                const SizedBox(height: 12),
                Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 32),
                  child: Text(
                    message,
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
                  child: Text(actionLabel),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }

  Widget _buildProductRow(BuildContext context, _OfferItem item) {
    return Material(
      color: Colors.white,
      borderRadius: BorderRadius.circular(14),
      elevation: 1.5,
      shadowColor: Colors.black26,
      child: InkWell(
        borderRadius: BorderRadius.circular(14),
        onTap: () => _openItem(item),
        child: Padding(
          padding: const EdgeInsets.all(10),
          child: Row(
            children: [
              ClipRRect(
                borderRadius: BorderRadius.circular(10),
                child: SizedBox(
                  width: 68,
                  height: 68,
                  child: Image.network(
                    item.image,
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
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      item.title,
                      maxLines: 2,
                      overflow: TextOverflow.ellipsis,
                      style: const TextStyle(
                        fontWeight: FontWeight.w600,
                        fontSize: 13.5,
                      ),
                    ),
                    const SizedBox(height: 4),
                    Row(
                      children: [
                        Text(
                          item.price!,
                          style: TextStyle(
                            fontWeight: FontWeight.w800,
                            fontSize: 14.5,
                            color: widget.accent,
                          ),
                        ),
                        if (item.section.isNotEmpty) ...[
                          const SizedBox(width: 8),
                          Expanded(
                            child: Text(
                              item.section,
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis,
                              style: TextStyle(
                                fontSize: 11.5,
                                color: Colors.grey.shade600,
                              ),
                            ),
                          ),
                        ],
                      ],
                    ),
                  ],
                ),
              ),
              const SizedBox(width: 6),
              Icon(Icons.arrow_forward_ios, size: 14, color: widget.accent),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildCard(BuildContext context, _OfferItem item) {
    if (item.price != null) {
      return _buildProductRow(context, item);
    }
    return Material(
      color: Colors.white,
      borderRadius: BorderRadius.circular(14),
      elevation: 1.5,
      shadowColor: Colors.black26,
      child: InkWell(
        borderRadius: BorderRadius.circular(14),
        onTap: () => _openItem(item),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            ClipRRect(
              borderRadius:
                  const BorderRadius.vertical(top: Radius.circular(14)),
              child: AspectRatio(
                aspectRatio: 16 / 7,
                child: Image.network(
                  item.image,
                  fit: BoxFit.cover,
                  loadingBuilder: (context, child, progress) {
                    if (progress == null) return child;
                    return Container(
                      color: const Color(0xFFEFECE6),
                      alignment: Alignment.center,
                      child: const SizedBox(
                        width: 22,
                        height: 22,
                        child: CircularProgressIndicator(strokeWidth: 2),
                      ),
                    );
                  },
                  errorBuilder: (_, _, _) => Container(
                    color: const Color(0xFFEFECE6),
                    alignment: Alignment.center,
                    child: const Icon(
                      Icons.local_offer_outlined,
                      color: Color(0xFF8D8A85),
                      size: 32,
                    ),
                  ),
                ),
              ),
            ),
            Padding(
              padding: const EdgeInsets.fromLTRB(12, 10, 12, 12),
              child: Row(
                children: [
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          item.title.isNotEmpty ? item.title : 'Special offer',
                          maxLines: 2,
                          overflow: TextOverflow.ellipsis,
                          style: const TextStyle(
                            fontWeight: FontWeight.w700,
                            fontSize: 14.5,
                          ),
                        ),
                        if (item.section.isNotEmpty &&
                            item.section != item.title) ...[
                          const SizedBox(height: 3),
                          Text(
                            item.section,
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                            style: TextStyle(
                              fontSize: 12,
                              color: Colors.grey.shade600,
                            ),
                          ),
                        ],
                      ],
                    ),
                  ),
                  const SizedBox(width: 8),
                  Icon(
                    Icons.arrow_forward_ios,
                    size: 14,
                    color: widget.accent,
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
