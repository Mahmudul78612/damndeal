import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:cached_network_image/cached_network_image.dart';
import '../services/cart_service.dart';
import '../config.dart';

class FloatingCartWidget extends StatelessWidget {
  final VoidCallback? onTap;

  const FloatingCartWidget({super.key, this.onTap});

  static const _ddgoGreen = Color(0xFF0D7A30);

  @override
  Widget build(BuildContext context) {
    final cart = context.watch<CartService>();
    if (!cart.hasDdgoItems) return const SizedBox.shrink();

    final ddgoItems = cart.ddgoItems;
    final firstItem = ddgoItems.first;
    final img = firstItem.image;
    final imgUrl = img != null
        ? (img.startsWith('http') ? img : '${AppConfig.uploadsBase}$img')
        : '';

    return Positioned(
      left: 16,
      right: 16,
      bottom: 12,
      child: GestureDetector(
        onTap: onTap ?? () => Navigator.pushNamed(context, '/cart'),
        child: Stack(
          clipBehavior: Clip.none,
          children: [
            // Main bar
            Container(
              height: 60,
              decoration: BoxDecoration(
                color: _ddgoGreen,
                borderRadius: BorderRadius.circular(16),
                boxShadow: [
                  BoxShadow(
                    color: _ddgoGreen.withValues(alpha: 0.35),
                    blurRadius: 16,
                    offset: const Offset(0, 6),
                  ),
                ],
              ),
              padding: const EdgeInsets.only(left: 64, right: 16),
              child: Row(
                children: [
                  // Item count & partner name
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        Text(
                          '${cart.ddgoItemCount} item${cart.ddgoItemCount > 1 ? 's' : ''}'
                          '${cart.partnerName != null ? ' • ${cart.partnerName}' : ''}',
                          style: const TextStyle(
                            color: Colors.white70,
                            fontSize: 12,
                            fontWeight: FontWeight.w500,
                          ),
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                        ),
                        const SizedBox(height: 2),
                        Text(
                          '₹${cart.ddgoSubtotal.toStringAsFixed(0)}',
                          style: const TextStyle(
                            color: Colors.white,
                            fontSize: 18,
                            fontWeight: FontWeight.w800,
                          ),
                        ),
                      ],
                    ),
                  ),
                  // View Cart button
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
                    decoration: BoxDecoration(
                      color: Colors.white.withValues(alpha: 0.2),
                      borderRadius: BorderRadius.circular(10),
                    ),
                    child: const Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Text(
                          'View Cart',
                          style: TextStyle(
                            color: Colors.white,
                            fontSize: 14,
                            fontWeight: FontWeight.w700,
                          ),
                        ),
                        SizedBox(width: 4),
                        Icon(Icons.arrow_forward_ios_rounded, size: 12, color: Colors.white),
                      ],
                    ),
                  ),
                ],
              ),
            ),
            // Overlapping round image - left side
            Positioned(
              left: 8,
              top: -12,
              child: Container(
                width: 52,
                height: 52,
                decoration: BoxDecoration(
                  shape: BoxShape.circle,
                  color: Colors.white,
                  border: Border.all(color: Colors.white, width: 3),
                  boxShadow: [
                    BoxShadow(
                      color: Colors.black.withValues(alpha: 0.15),
                      blurRadius: 8,
                      offset: const Offset(0, 2),
                    ),
                  ],
                ),
                child: ClipOval(
                  child: imgUrl.isNotEmpty
                      ? CachedNetworkImage(
                          imageUrl: imgUrl,
                          fit: BoxFit.cover,
                          placeholder: (_, __) => Container(
                            color: const Color(0xFFE8F5E9),
                            child: const Icon(Icons.shopping_bag_rounded, color: _ddgoGreen, size: 20),
                          ),
                          errorWidget: (_, __, ___) => Container(
                            color: const Color(0xFFE8F5E9),
                            child: const Icon(Icons.shopping_bag_rounded, color: _ddgoGreen, size: 20),
                          ),
                        )
                      : Container(
                          color: const Color(0xFFE8F5E9),
                          child: const Icon(Icons.shopping_bag_rounded, color: _ddgoGreen, size: 20),
                        ),
                ),
              ),
            ),
            // Item count badge on image
            if (cart.ddgoItemCount > 1)
              Positioned(
                left: 40,
                top: -16,
                child: Container(
                  padding: const EdgeInsets.all(4),
                  decoration: const BoxDecoration(
                    color: Color(0xFFF59E0B),
                    shape: BoxShape.circle,
                  ),
                  child: Text(
                    '${cart.ddgoItemCount}',
                    style: const TextStyle(
                      color: Colors.white,
                      fontSize: 10,
                      fontWeight: FontWeight.w800,
                    ),
                  ),
                ),
              ),
          ],
        ),
      ),
    );
  }
}
