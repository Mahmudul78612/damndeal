import 'package:flutter/material.dart';
import 'package:cached_network_image/cached_network_image.dart';
import 'dart:async';
import '../../config.dart';
import '../../theme/app_theme.dart';

class BannerCarousel extends StatefulWidget {
  final List<dynamic> banners;
  const BannerCarousel({super.key, required this.banners});

  @override
  State<BannerCarousel> createState() => _BannerCarouselState();
}

class _BannerCarouselState extends State<BannerCarousel> {
  late final PageController _controller;
  int _current = 0;
  Timer? _timer;

  @override
  void initState() {
    super.initState();
    _controller = PageController();
    if (widget.banners.length > 1) {
      _timer = Timer.periodic(const Duration(seconds: 4), (_) {
        if (!mounted || !_controller.hasClients) return;
        final next = (_current + 1) % widget.banners.length;
        _controller.animateToPage(next, duration: const Duration(milliseconds: 350), curve: Curves.easeInOut);
      });
    }
  }

  @override
  void dispose() {
    _timer?.cancel();
    _controller.dispose();
    super.dispose();
  }

  String _imgUrl(String? raw) {
    if (raw == null || raw.isEmpty) return '';
    return raw.startsWith('http') ? raw : '${AppConfig.uploadsBase}$raw';
  }

  @override
  Widget build(BuildContext context) {
    if (widget.banners.isEmpty) return const SizedBox.shrink();

    return Column(
      children: [
        SizedBox(
          height: 170,
          child: PageView.builder(
            controller: _controller,
            itemCount: widget.banners.length,
            onPageChanged: (i) => setState(() => _current = i),
            itemBuilder: (context, index) {
              final banner = widget.banners[index];
        final src = _imgUrl(banner['image']?.toString());
        final List subs = (banner['subCategories'] as List?) ?? [];

              return Padding(
                padding: const EdgeInsets.fromLTRB(12, 0, 12, 8),
          child: Stack(
            clipBehavior: Clip.none,
            children: [
              // Banner image
              ClipRRect(
                    borderRadius: BorderRadius.circular(12),
                child: AspectRatio(
                  aspectRatio: 1920 / 800,
                  child: CachedNetworkImage(
                    imageUrl: src,
                    fit: BoxFit.cover,
                    width: double.infinity,
                    fadeInDuration: Duration.zero,
                    placeholderFadeInDuration: Duration.zero,
                    placeholder: (_, __) => Container(
                      color: AppColors.primaryLight,
                      child: const Center(child: CircularProgressIndicator(strokeWidth: 2)),
                    ),
                    errorWidget: (_, __, ___) => Container(
                      color: AppColors.primaryLight,
                      child: const Icon(Icons.image_not_supported_outlined, size: 40, color: AppColors.textMuted),
                    ),
                  ),
                ),
              ),
              // Subcategory overlay – positioned at bottom, overlapping 40%
              if (subs.isNotEmpty)
                Positioned(
                  left: 8,
                  right: 8,
                  bottom: -40,
                  child: Row(
                    mainAxisAlignment: MainAxisAlignment.spaceEvenly,
                    children: subs.take(4).map<Widget>((sub) {
                      final subImg = _imgUrl(sub['image']?.toString());
                      final subName = sub['name']?.toString() ?? '';
                      return Expanded(
                        child: GestureDetector(
                          onTap: () {
                            Navigator.pushNamed(context, '/products', arguments: {
                              'subCategory': sub['_id'],
                              'title': sub['name'],
                            });
                          },
                          child: Padding(
                            padding: const EdgeInsets.symmetric(horizontal: 4),
                          child: Column(
                            mainAxisSize: MainAxisSize.min,
                            children: [
                              Container(
                                decoration: BoxDecoration(
                                  color: Colors.white,
                                  borderRadius: BorderRadius.circular(12),
                                  boxShadow: [
                                    BoxShadow(
                                      color: Colors.black.withValues(alpha: 0.15),
                                      blurRadius: 6,
                                      offset: const Offset(0, 2),
                                    ),
                                  ],
                                ),
                                child: ClipRRect(
                                  borderRadius: BorderRadius.circular(12),
                                  child: AspectRatio(
                                    aspectRatio: 1,
                                    child: CachedNetworkImage(
                                      imageUrl: subImg,
                                      fit: BoxFit.cover,
                                      fadeInDuration: Duration.zero,
                                      placeholderFadeInDuration: Duration.zero,
                                      placeholder: (_, __) => Container(
                                        color: Colors.grey.shade100,
                                        child: const Center(child: CircularProgressIndicator(strokeWidth: 2)),
                                      ),
                                      errorWidget: (_, __, ___) => Container(
                                        color: Colors.grey.shade100,
                                        child: const Icon(Icons.category, size: 24, color: Colors.grey),
                                      ),
                                    ),
                                  ),
                                ),
                              ),
                              const SizedBox(height: 4),
                              Text(
                                subName,
                                maxLines: 1,
                                overflow: TextOverflow.ellipsis,
                                textAlign: TextAlign.center,
                                style: const TextStyle(fontSize: 11, fontWeight: FontWeight.w600),
                              ),
                            ],
                          ),
                        ),
                        ),
                      );
                    }).toList(),
                  ),
                ),
            ],
          ),
              );
            },
          ),
        ),
        if (widget.banners.length > 1)
          Padding(
            padding: const EdgeInsets.only(bottom: 8),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.center,
              children: List.generate(widget.banners.length, (i) {
                final active = i == _current;
                return AnimatedContainer(
                  duration: const Duration(milliseconds: 180),
                  margin: const EdgeInsets.symmetric(horizontal: 2),
                  width: active ? 14 : 6,
                  height: 6,
                  decoration: BoxDecoration(
                    color: active ? AppColors.primary : Colors.grey.shade300,
                    borderRadius: BorderRadius.circular(4),
                  ),
                );
              }),
            ),
          ),
      ],
    );
  }
}
