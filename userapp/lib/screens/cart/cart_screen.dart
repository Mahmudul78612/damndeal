import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:cached_network_image/cached_network_image.dart';
import '../../services/cart_service.dart';
import '../../config.dart';
import '../../theme/app_theme.dart';

class CartScreen extends StatelessWidget {
  const CartScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final cart = context.watch<CartService>();

    return Scaffold(
      backgroundColor: const Color(0xFFF1F3F6),
      appBar: AppBar(
        elevation: 0.5,
        backgroundColor: Colors.white,
        foregroundColor: AppColors.textPrimary,
        titleSpacing: 0,
        title: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            const Text('My Cart',
                style: TextStyle(fontSize: 16, fontWeight: FontWeight.w700)),
            if (!cart.isEmpty)
              Text(
                '${cart.items.length} ${cart.items.length == 1 ? "item" : "items"}',
                style: const TextStyle(
                    fontSize: 11.5,
                    fontWeight: FontWeight.w500,
                    color: AppColors.textMuted),
              ),
          ],
        ),
      ),
      body: cart.isEmpty ? _empty(context) : _filled(context, cart),
    );
  }

  Widget _empty(BuildContext context) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(24),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Container(
              width: 96,
              height: 96,
              decoration: BoxDecoration(
                color: Colors.white,
                shape: BoxShape.circle,
                border: Border.all(color: AppColors.divider),
              ),
              child: const Icon(Icons.shopping_cart_outlined,
                  size: 44, color: AppColors.textMuted),
            ),
            const SizedBox(height: 18),
            const Text('Your cart is empty',
                style: TextStyle(
                    fontSize: 16,
                    fontWeight: FontWeight.w700,
                    color: AppColors.textPrimary)),
            const SizedBox(height: 6),
            const Text('Add products to start shopping',
                style: TextStyle(fontSize: 13, color: AppColors.textMuted)),
            const SizedBox(height: 22),
            SizedBox(
              height: 44,
              child: ElevatedButton(
                onPressed: () => Navigator.pushNamedAndRemoveUntil(
                    context, '/main', (_) => false),
                style: ElevatedButton.styleFrom(
                  backgroundColor: AppColors.primary,
                  foregroundColor: Colors.white,
                  elevation: 0,
                  padding: const EdgeInsets.symmetric(horizontal: 28),
                  shape:
                      RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
                ),
                child: const Text('Continue Shopping',
                    style: TextStyle(fontSize: 13.5, fontWeight: FontWeight.w700)),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _filled(BuildContext context, CartService cart) {
    final itemTotal = cart.subtotal;

    return Column(
      children: [
        Expanded(
          child: ListView(
            padding: const EdgeInsets.fromLTRB(0, 8, 0, 16),
            children: [
              Container(
                color: Colors.white,
                child: Column(
                  children: [
                    for (int i = 0; i < cart.items.length; i++) ...[
                      _CartItemRow(item: cart.items[i]),
                      if (i != cart.items.length - 1)
                        const Divider(height: 1, color: Color(0xFFEFEFEF)),
                    ],
                  ],
                ),
              ),
              const SizedBox(height: 8),
              _priceDetails(itemTotal),
              const SizedBox(height: 8),
              Container(
                color: Colors.white,
                padding:
                    const EdgeInsets.symmetric(horizontal: 14, vertical: 14),
                child: Row(
                  children: [
                    const Icon(Icons.lock_outline_rounded,
                        size: 16, color: AppColors.textMuted),
                    const SizedBox(width: 8),
                    Expanded(
                      child: Text(
                        'Safe and Secure Payments. Easy returns. 100% Authentic.',
                        style: TextStyle(
                            fontSize: 11.5,
                            color: Colors.grey.shade600,
                            fontWeight: FontWeight.w500),
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ),
        ),
        _checkoutBar(context, itemTotal),
      ],
    );
  }

  Widget _priceDetails(double itemTotal) {
    return Container(
      color: Colors.white,
      padding: const EdgeInsets.fromLTRB(14, 14, 14, 14),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text('PRICE DETAILS',
              style: TextStyle(
                  fontSize: 12,
                  fontWeight: FontWeight.w800,
                  color: Colors.grey.shade700,
                  letterSpacing: 0.6)),
          const SizedBox(height: 12),
          _row('Item Total', '₹${itemTotal.toStringAsFixed(0)}'),
          _row('Delivery Charges', 'Calculated at checkout',
              valueColor: AppColors.textMuted, valueSize: 12),
          const Padding(
            padding: EdgeInsets.symmetric(vertical: 10),
            child: DashedDivider(),
          ),
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              const Text('Total Amount',
                  style: TextStyle(fontSize: 14, fontWeight: FontWeight.w800)),
              Text('₹${itemTotal.toStringAsFixed(0)}',
                  style: const TextStyle(
                      fontSize: 14, fontWeight: FontWeight.w800)),
            ],
          ),
        ],
      ),
    );
  }

  Widget _row(String l, String v, {Color? valueColor, double valueSize = 13}) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 5),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Text(l,
              style: const TextStyle(
                  fontSize: 13,
                  color: AppColors.textSecondary,
                  fontWeight: FontWeight.w500)),
          Text(v,
              style: TextStyle(
                  fontSize: valueSize,
                  fontWeight: FontWeight.w600,
                  color: valueColor ?? AppColors.textPrimary)),
        ],
      ),
    );
  }

  Widget _checkoutBar(BuildContext context, double total) {
    return Container(
      decoration: const BoxDecoration(
        color: Colors.white,
        border: Border(top: BorderSide(color: Color(0xFFE6E6E6))),
      ),
      child: SafeArea(
        top: false,
        child: Padding(
          padding: const EdgeInsets.fromLTRB(14, 8, 14, 8),
          child: Row(
            children: [
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Text('₹${total.toStringAsFixed(0)}',
                        style: const TextStyle(
                            fontSize: 18,
                            fontWeight: FontWeight.w800,
                            color: AppColors.textPrimary)),
                    Text('VIEW PRICE DETAILS',
                        style: TextStyle(
                            fontSize: 10,
                            fontWeight: FontWeight.w700,
                            color: Colors.grey.shade600,
                            letterSpacing: 0.4)),
                  ],
                ),
              ),
              SizedBox(
                height: 48,
                child: ElevatedButton.icon(
                  onPressed: () => Navigator.pushNamed(context, '/checkout'),
                  style: ElevatedButton.styleFrom(
                    backgroundColor: AppColors.accent,
                    foregroundColor: Colors.white,
                    elevation: 0,
                    padding: const EdgeInsets.symmetric(horizontal: 24),
                    shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(6)),
                  ),
                  icon: const Icon(Icons.shopping_bag_rounded, size: 18),
                  label: const Text('Place Order',
                      style: TextStyle(
                          fontSize: 14,
                          fontWeight: FontWeight.w800,
                          letterSpacing: 0.4)),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _CartItemRow extends StatelessWidget {
  final CartItem item;
  const _CartItemRow({required this.item});

  @override
  Widget build(BuildContext context) {
    final cart = context.read<CartService>();
    final imgSrc = item.image != null
        ? (item.image!.startsWith('http')
            ? item.image!
            : '${AppConfig.uploadsBase}${item.image}')
        : '';

    return Padding(
      padding: const EdgeInsets.fromLTRB(14, 14, 14, 14),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Container(
                width: 86,
                height: 86,
                decoration: BoxDecoration(
                  color: const Color(0xFFFAFAFA),
                  borderRadius: BorderRadius.circular(6),
                  border: Border.all(color: const Color(0xFFEFEFEF)),
                ),
                child: ClipRRect(
                  borderRadius: BorderRadius.circular(6),
                  child: imgSrc.isNotEmpty
                      ? CachedNetworkImage(
                          imageUrl: imgSrc,
                          fit: BoxFit.contain,
                          fadeInDuration: Duration.zero,
                          placeholderFadeInDuration: Duration.zero,
                          errorWidget: (_, __, ___) => const Icon(
                              Icons.image_not_supported_outlined,
                              color: AppColors.textMuted),
                        )
                      : const Icon(Icons.shopping_bag_outlined,
                          color: AppColors.textMuted),
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(item.name,
                        maxLines: 2,
                        overflow: TextOverflow.ellipsis,
                        style: const TextStyle(
                            fontSize: 13.5,
                            fontWeight: FontWeight.w600,
                            height: 1.35,
                            color: AppColors.textPrimary)),
                    if (item.unit.isNotEmpty && item.unit != 'piece') ...[
                      const SizedBox(height: 4),
                      Text(item.unit,
                          style: const TextStyle(
                              fontSize: 11.5, color: AppColors.textMuted)),
                    ],
                    const SizedBox(height: 8),
                    Row(
                      crossAxisAlignment: CrossAxisAlignment.end,
                      children: [
                        Text('₹${item.price.toStringAsFixed(0)}',
                            style: const TextStyle(
                                fontSize: 16,
                                fontWeight: FontWeight.w800,
                                color: AppColors.textPrimary)),
                        const SizedBox(width: 8),
                        Text('Free Delivery',
                            style: TextStyle(
                                fontSize: 11,
                                fontWeight: FontWeight.w700,
                                color: Colors.grey.shade600)),
                      ],
                    ),
                  ],
                ),
              ),
            ],
          ),
          const SizedBox(height: 12),
          Row(
            children: [
              Container(
                decoration: BoxDecoration(
                  borderRadius: BorderRadius.circular(20),
                  border: Border.all(color: const Color(0xFFD8D8D8)),
                ),
                child: Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    _stepIcon(
                      icon: item.quantity == 1
                          ? Icons.delete_outline_rounded
                          : Icons.remove,
                      onTap: () => cart.updateQuantity(
                          item.productId, item.quantity - 1),
                    ),
                    Container(
                      width: 32,
                      alignment: Alignment.center,
                      child: Text('${item.quantity}',
                          style: const TextStyle(
                              fontSize: 13.5, fontWeight: FontWeight.w800)),
                    ),
                    _stepIcon(
                      icon: Icons.add,
                      onTap: () => cart.updateQuantity(
                          item.productId, item.quantity + 1),
                    ),
                  ],
                ),
              ),
              const SizedBox(width: 16),
              _textBtn('REMOVE', () => cart.removeItem(item.productId)),
            ],
          ),
        ],
      ),
    );
  }

  Widget _stepIcon({required IconData icon, required VoidCallback onTap}) {
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(20),
      child: SizedBox(
        width: 30,
        height: 30,
        child: Icon(icon, size: 16, color: AppColors.textPrimary),
      ),
    );
  }

  Widget _textBtn(String label, VoidCallback onTap) {
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(4),
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 4, vertical: 6),
        child: Text(label,
            style: TextStyle(
                fontSize: 11.5,
                fontWeight: FontWeight.w800,
                letterSpacing: 0.5,
                color: Colors.grey.shade700)),
      ),
    );
  }
}

class DashedDivider extends StatelessWidget {
  const DashedDivider({super.key});

  @override
  Widget build(BuildContext context) {
    return LayoutBuilder(builder: (ctx, c) {
      const dash = 4.0;
      const gap = 3.0;
      final n = (c.maxWidth / (dash + gap)).floor();
      return Row(
        children: List.generate(n, (i) {
          return Padding(
            padding: const EdgeInsets.only(right: gap),
            child: Container(
              width: dash,
              height: 1,
              color: const Color(0xFFD9D9D9),
            ),
          );
        }),
      );
    });
  }
}
