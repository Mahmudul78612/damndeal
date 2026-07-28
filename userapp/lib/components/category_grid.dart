import 'package:flutter/material.dart';
import 'package:cached_network_image/cached_network_image.dart';
import '../../config.dart';
import '../../theme/app_theme.dart';

class CategoryGrid extends StatelessWidget {
  final List<dynamic> categories;
  final void Function(dynamic category) onTap;

  const CategoryGrid({super.key, required this.categories, required this.onTap});

  @override
  Widget build(BuildContext context) {
    if (categories.isEmpty) return const SizedBox.shrink();

    return GridView.builder(
      shrinkWrap: true,
      physics: const NeverScrollableScrollPhysics(),
      padding: const EdgeInsets.symmetric(horizontal: 16),
      gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
        crossAxisCount: 4,
        childAspectRatio: 3 / 4,
        crossAxisSpacing: 6,
        mainAxisSpacing: 10,
      ),
      itemCount: categories.length,
      itemBuilder: (context, index) {
        final cat = categories[index];
        final icon = cat['icon'];
        final hasImage = icon != null && icon.toString().isNotEmpty;
        final src = hasImage
            ? (icon.toString().startsWith('http') ? icon : '${AppConfig.uploadsBase}$icon')
            : '';

        return LayoutBuilder(
          builder: (context, constraints) {
            final cardSize = constraints.maxWidth;
            return GestureDetector(
              onTap: () => onTap(cat),
              child: Column(
                children: [
                  SizedBox(
                    width: cardSize,
                    height: cardSize,
                    child: Container(
                      decoration: BoxDecoration(
                        color: AppColors.primaryLight,
                        borderRadius: BorderRadius.circular(10),
                        border: Border.all(color: AppColors.border, width: 0.5),
                      ),
                      clipBehavior: Clip.antiAlias,
                      padding: const EdgeInsets.all(10),
                      child: hasImage
                          ? CachedNetworkImage(
                              imageUrl: src,
                              fit: BoxFit.contain,
                              placeholder: (_, __) => const Center(
                                child: SizedBox(width: 16, height: 16, child: CircularProgressIndicator(strokeWidth: 1.5)),
                              ),
                              errorWidget: (_, __, ___) =>
                                  const Icon(Icons.category_rounded, size: 28, color: AppColors.primary),
                            )
                          : const Center(child: Icon(Icons.category_rounded, size: 28, color: AppColors.primary)),
                    ),
                  ),
                  const SizedBox(height: 4),
                  Expanded(
                    child: Text(
                      cat['name'] ?? '',
                      maxLines: 2,
                      overflow: TextOverflow.ellipsis,
                      textAlign: TextAlign.center,
                      style: const TextStyle(
                        fontSize: 10,
                        fontWeight: FontWeight.w600,
                        color: Colors.black,
                      ),
                    ),
                  ),
                ],
              ),
            );
          },
        );
      },
    );
  }
}
