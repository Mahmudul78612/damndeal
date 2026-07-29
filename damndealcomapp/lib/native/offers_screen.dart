import 'dart:async';
import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:http/http.dart' as http;

/// Native "Offers & Updates" screen — fully server/admin-driven.
///
/// Renders the structured feed from GET /user/app-feed:
/// banner carousel (admin "App — Offers Tab" placement, else home banners),
/// live deals, featured products and fresh arrivals. Every element is
/// clickable and hands its web URL back to the shell.
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

class _FeedBanner {
  const _FeedBanner({required this.image, required this.link});

  final String image;
  final String link;
}

class _FeedProduct {
  const _FeedProduct({
    required this.title,
    required this.image,
    required this.link,
    this.subtitle = '',
    this.price,
    this.mrp,
  });

  final String title;
  final String subtitle;
  final String image;
  final String link;
  final String? price;
  final String? mrp;
}

class _OffersScreenState extends State<OffersScreen> {
  bool _loading = true;
  String? _error;
  List<_FeedBanner> _banners = const [];
  List<_FeedProduct> _deals = const [];
  List<_FeedProduct> _featured = const [];
  List<_FeedProduct> _fresh = const [];

  final PageController _bannerController =
      PageController(viewportFraction: 0.94);
  Timer? _bannerTimer;
  int _bannerPage = 0;

  @override
  void initState() {
    super.initState();
    _fetch();
  }

  @override
  void dispose() {
    _bannerTimer?.cancel();
    _bannerController.dispose();
    super.dispose();
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
        Uri.parse('${widget.baseUrl}/proxy-api/user/app-feed?platform=damndeal'),
        headers: {'x-region': widget.region},
      ).timeout(const Duration(seconds: 15));
      if (res.statusCode != 200) {
        throw Exception('HTTP ${res.statusCode}');
      }
      final decoded = jsonDecode(res.body) as Map<String, dynamic>;
      if (decoded['success'] != true) {
        throw Exception('feed unavailable');
      }
      final currency = (decoded['currency'] ?? '').toString();

      final banners = <_FeedBanner>[];
      for (final raw in (decoded['banners'] as List?) ?? const []) {
        if (raw is! Map) continue;
        final image = (raw['image'] ?? '').toString();
        if (image.isEmpty) continue;
        final link = (raw['link'] ?? '').toString();
        banners.add(_FeedBanner(
          image: _absolutize(image),
          link: link.isEmpty ? '' : _absolutize(link),
        ));
      }

      List<_FeedProduct> parseProducts(String key, {String titleKey = 'name'}) {
        final out = <_FeedProduct>[];
        for (final raw in (decoded[key] as List?) ?? const []) {
          if (raw is! Map) continue;
          final image = (raw['image'] ?? '').toString();
          if (image.isEmpty) continue;
          final link = (raw['link'] ?? '').toString();
          final price = raw['price'];
          final mrp = raw['mrp'];
          out.add(_FeedProduct(
            title: (raw[titleKey] ?? raw['title'] ?? '').toString(),
            subtitle: (raw['subtitle'] ?? '').toString(),
            image: _absolutize(image),
            link: link.isEmpty ? '' : _absolutize(link),
            price: price is num ? _formatPrice(price, currency) : null,
            mrp: mrp is num ? _formatPrice(mrp, currency) : null,
          ));
        }
        return out;
      }

      if (!mounted) return;
      setState(() {
        _banners = banners;
        _deals = parseProducts('deals', titleKey: 'title');
        _featured = parseProducts('featured');
        _fresh = parseProducts('fresh');
        _loading = false;
      });
      _startBannerAutoScroll();
    } catch (_) {
      if (!mounted) return;
      setState(() {
        _error = 'Could not load offers. Check your connection and try again.';
        _loading = false;
      });
    }
  }

  void _startBannerAutoScroll() {
    _bannerTimer?.cancel();
    if (_banners.length < 2) return;
    _bannerTimer = Timer.periodic(const Duration(seconds: 4), (_) {
      if (!mounted || !_bannerController.hasClients) return;
      _bannerPage = (_bannerPage + 1) % _banners.length;
      _bannerController.animateToPage(
        _bannerPage,
        duration: const Duration(milliseconds: 450),
        curve: Curves.easeOut,
      );
    });
  }

  void _open(String link) {
    if (link.isEmpty) return;
    HapticFeedback.selectionClick();
    if (widget.onOpenLink != null) {
      widget.onOpenLink!(link);
      return;
    }
    Navigator.of(context).pop(link);
  }

  bool get _isEmpty =>
      _banners.isEmpty && _deals.isEmpty && _featured.isEmpty && _fresh.isEmpty;

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
    if (_error != null || _isEmpty) {
      return _buildMessage(
        context,
        icon: _error != null ? Icons.wifi_off : Icons.notifications_none,
        message: _error ??
            'No offers right now.\nPull down to refresh or check back soon!',
        actionLabel: _error != null ? 'Retry' : 'Refresh',
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
            _buildBannerCarousel(context),
            const SizedBox(height: 18),
          ],
          if (_deals.isNotEmpty) ...[
            _buildHeading('⚡ Live Deals'),
            const SizedBox(height: 10),
            ..._deals.map((d) => Padding(
                  padding: const EdgeInsets.only(bottom: 12),
                  child: _buildDealCard(context, d),
                )),
            const SizedBox(height: 6),
          ],
          if (_featured.isNotEmpty) ...[
            _buildHeading('★ Featured'),
            const SizedBox(height: 10),
            SizedBox(
              height: 198,
              child: ListView.separated(
                scrollDirection: Axis.horizontal,
                itemCount: _featured.length,
                separatorBuilder: (_, _) => const SizedBox(width: 10),
                itemBuilder: (context, index) => SizedBox(
                  width: 132,
                  child: _buildProductCard(context, _featured[index]),
                ),
              ),
            ),
            const SizedBox(height: 18),
          ],
          if (_fresh.isNotEmpty) ...[
            _buildHeading('New Arrivals'),
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
              itemCount: _fresh.length,
              itemBuilder: (context, index) =>
                  _buildProductCard(context, _fresh[index]),
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

  Widget _buildBannerCarousel(BuildContext context) {
    final width = MediaQuery.of(context).size.width - 28;
    final height = width * 0.42;
    if (_banners.length == 1) {
      return _buildBannerImage(_banners.first, height);
    }
    return Column(
      children: [
        SizedBox(
          height: height,
          child: PageView.builder(
            controller: _bannerController,
            itemCount: _banners.length,
            onPageChanged: (page) {
              _bannerPage = page;
              if (mounted) setState(() {});
            },
            itemBuilder: (context, index) => Padding(
              padding: const EdgeInsets.symmetric(horizontal: 3),
              child: _buildBannerImage(_banners[index], height),
            ),
          ),
        ),
        const SizedBox(height: 8),
        Row(
          mainAxisAlignment: MainAxisAlignment.center,
          children: List.generate(
            _banners.length,
            (index) => AnimatedContainer(
              duration: const Duration(milliseconds: 200),
              margin: const EdgeInsets.symmetric(horizontal: 3),
              width: index == _bannerPage ? 16 : 6,
              height: 6,
              decoration: BoxDecoration(
                color: index == _bannerPage
                    ? widget.accent
                    : Colors.grey.shade400,
                borderRadius: BorderRadius.circular(3),
              ),
            ),
          ),
        ),
      ],
    );
  }

  Widget _buildBannerImage(_FeedBanner banner, double height) {
    return GestureDetector(
      onTap: () => _open(banner.link),
      child: ClipRRect(
        borderRadius: BorderRadius.circular(14),
        child: Image.network(
          banner.image,
          height: height,
          width: double.infinity,
          fit: BoxFit.cover,
          loadingBuilder: (context, child, progress) {
            if (progress == null) return child;
            return Container(
              height: height,
              color: const Color(0xFFEFECE6),
              alignment: Alignment.center,
              child: const SizedBox(
                width: 22,
                height: 22,
                child: CircularProgressIndicator(strokeWidth: 2),
              ),
            );
          },
          errorBuilder: (_, _, _) => const SizedBox.shrink(),
        ),
      ),
    );
  }

  Widget _buildDealCard(BuildContext context, _FeedProduct deal) {
    return GestureDetector(
      onTap: () => _open(deal.link),
      child: Container(
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(14),
          border: Border.all(color: const Color(0xFFEDEAE4)),
        ),
        clipBehavior: Clip.antiAlias,
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            AspectRatio(
              aspectRatio: 16 / 7,
              child: Image.network(
                deal.image,
                fit: BoxFit.cover,
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
            Padding(
              padding: const EdgeInsets.fromLTRB(12, 10, 12, 12),
              child: Row(
                children: [
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          deal.title,
                          maxLines: 2,
                          overflow: TextOverflow.ellipsis,
                          style: const TextStyle(
                            fontWeight: FontWeight.w700,
                            fontSize: 14,
                          ),
                        ),
                        if (deal.subtitle.isNotEmpty) ...[
                          const SizedBox(height: 3),
                          Text(
                            deal.subtitle,
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
                  if (deal.price != null) ...[
                    const SizedBox(width: 10),
                    Container(
                      padding: const EdgeInsets.symmetric(
                        horizontal: 10,
                        vertical: 5,
                      ),
                      decoration: BoxDecoration(
                        color: widget.accent,
                        borderRadius: BorderRadius.circular(20),
                      ),
                      child: Text(
                        deal.price!,
                        style: const TextStyle(
                          color: Colors.white,
                          fontWeight: FontWeight.w800,
                          fontSize: 13,
                        ),
                      ),
                    ),
                  ],
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildProductCard(BuildContext context, _FeedProduct product) {
    return GestureDetector(
      onTap: () => _open(product.link),
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
                    product.title,
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
                      if (product.price != null)
                        Text(
                          product.price!,
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
}
