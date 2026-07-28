import 'package:flutter/material.dart';
import 'package:cached_network_image/cached_network_image.dart';
import '../../config.dart';
import '../../theme/app_theme.dart';

class ProductCard extends StatelessWidget {
  final Map<String, dynamic> product;
  final int cartQty;
  final VoidCallback onAdd;
  final VoidCallback onIncrement;
  final VoidCallback onDecrement;
  final VoidCallback? onTap;
  // Called after variant selection (variantLabel, price) — null means no variants
  final void Function(String variantLabel, double price)? onVariantAdd;

  const ProductCard({
    super.key,
    required this.product,
    this.cartQty = 0,
    required this.onAdd,
    required this.onIncrement,
    required this.onDecrement,
    this.onTap,
    this.onVariantAdd,
  });

  // ── Variant helpers ──────────────────────────────────────────
  bool get _hasVariants {
    final isCj = product['source'] == 'cj';
    if (isCj) {
      final list = (product['cjVariants'] as List?) ?? [];
      return list.any((v) => (v as Map)['isActive'] != false);
    }
    if (product['hasVariants'] != true) return false;
    final list = (product['variants'] as List?) ?? [];
    return list.any((v) => (v as Map)['isActive'] != false);
  }

  List<Map<String, dynamic>> get _variantList {
    final isCj = product['source'] == 'cj';
    final raw = isCj
        ? (product['cjVariants'] as List?) ?? []
        : (product['variants'] as List?) ?? [];
    return raw
        .where((v) => (v as Map)['isActive'] != false)
        .map((v) => Map<String, dynamic>.from(v as Map))
        .toList();
  }

  @override
  Widget build(BuildContext context) {
    final images = product['images'] as List? ?? [];
    final img = images.isNotEmpty ? images[0] : null;
    final src = img != null
        ? (img.toString().startsWith('http') ? img : '${AppConfig.uploadsBase}$img')
        : '';
    final name = product['name'] ?? '';
    final price = (product['sellingPrice'] ?? product['price'] ?? 0).toDouble();
    final mrp = (product['mrp'] ?? product['price'] ?? 0).toDouble();
    final unit = product['unit'] ?? '';
    final baseStock = (product['stock'] ?? 0) as num;
    final inStock = baseStock > 0 ||
        _variantList.any((v) => ((v['stock'] ?? 0) as num) > 0);
    final discount = mrp > price ? ((mrp - price) / mrp * 100).round() : 0;
    final hasVariants = _hasVariants;

    return GestureDetector(
      onTap: onTap,
      child: Container(
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(12),
          border: Border.all(color: Colors.grey.shade200, width: 1),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // ── Image area ──
            Expanded(
              child: Container(
                width: double.infinity,
                decoration: BoxDecoration(
                  color: const Color(0xFFF5F5F5),
                  borderRadius: const BorderRadius.vertical(top: Radius.circular(12)),
                ),
                child: Stack(
                  children: [
                    Padding(
                      padding: const EdgeInsets.all(12),
                      child: Center(
                        child: src.isNotEmpty
                            ? CachedNetworkImage(
                                imageUrl: src,
                                fit: BoxFit.contain,
                                placeholder: (_, __) => const SizedBox(
                                  width: 24, height: 24,
                                  child: CircularProgressIndicator(strokeWidth: 1.5),
                                ),
                                errorWidget: (_, __, ___) => const Icon(
                                  Icons.image_not_supported_outlined,
                                  color: AppColors.textMuted, size: 32,
                                ),
                              )
                            : const Icon(Icons.shopping_bag_outlined, size: 36, color: AppColors.textMuted),
                      ),
                    ),
                    if (discount > 0)
                      Positioned(
                        top: 6, left: 6,
                        child: Container(
                          padding: const EdgeInsets.symmetric(horizontal: 5, vertical: 2),
                          decoration: BoxDecoration(
                            color: const Color(0xFF0D7A30),
                            borderRadius: BorderRadius.circular(4),
                          ),
                          child: Text('$discount% OFF',
                            style: const TextStyle(color: Colors.white, fontSize: 9, fontWeight: FontWeight.w700),
                          ),
                        ),
                      ),
                    // Variant indicator badge
                    if (hasVariants)
                      Positioned(
                        top: 6, right: 6,
                        child: Container(
                          padding: const EdgeInsets.symmetric(horizontal: 5, vertical: 2),
                          decoration: BoxDecoration(
                            color: Colors.black.withValues(alpha: 0.55),
                            borderRadius: BorderRadius.circular(4),
                          ),
                          child: const Text('Options',
                            style: TextStyle(color: Colors.white, fontSize: 9, fontWeight: FontWeight.w600),
                          ),
                        ),
                      ),
                    if (!inStock)
                      Positioned.fill(
                        child: Container(
                          decoration: BoxDecoration(
                            color: Colors.white.withValues(alpha: 0.75),
                            borderRadius: const BorderRadius.vertical(top: Radius.circular(12)),
                          ),
                          child: const Center(
                            child: Text('Out of Stock',
                              style: TextStyle(color: AppColors.error, fontWeight: FontWeight.w700, fontSize: 12),
                            ),
                          ),
                        ),
                      ),
                  ],
                ),
              ),
            ),

            // ── Unit + ADD/QTY row ──
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 6),
              decoration: BoxDecoration(
                border: Border(top: BorderSide(color: Colors.grey.shade200, width: 0.5)),
              ),
              child: Row(
                children: [
                  if (unit.isNotEmpty)
                    Expanded(
                      child: Text(unit,
                        style: TextStyle(fontSize: 11, color: Colors.grey.shade600),
                        overflow: TextOverflow.ellipsis,
                      ),
                    )
                  else
                    const Spacer(),
                  if (inStock)
                    // For variant products always show ADD (quantity per-variant managed in detail/cart)
                    hasVariants
                        ? _addButton(context, isVariant: true)
                        : cartQty == 0
                            ? _addButton(context, isVariant: false)
                            : _qtySelector(),
                ],
              ),
            ),

            // ── Price + Name ──
            Padding(
              padding: const EdgeInsets.fromLTRB(8, 4, 8, 8),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                mainAxisSize: MainAxisSize.min,
                children: [
                  Row(
                    crossAxisAlignment: CrossAxisAlignment.end,
                    children: [
                      Text('₹${price.toStringAsFixed(0)}',
                        style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w800, color: Colors.black),
                      ),
                      if (discount > 0) ...[
                        const SizedBox(width: 4),
                        Padding(
                          padding: const EdgeInsets.only(bottom: 1),
                          child: Text('₹${mrp.toStringAsFixed(0)}',
                            style: TextStyle(fontSize: 11, color: Colors.grey.shade500, decoration: TextDecoration.lineThrough),
                          ),
                        ),
                      ],
                    ],
                  ),
                  const SizedBox(height: 3),
                  Text(name,
                    maxLines: 2,
                    overflow: TextOverflow.ellipsis,
                    style: TextStyle(fontSize: 12, fontWeight: FontWeight.w500, color: Colors.grey.shade800, height: 1.25),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _addButton(BuildContext context, {required bool isVariant}) {
    return SizedBox(
      height: 28,
      child: OutlinedButton(
        onPressed: () {
          if (isVariant && onVariantAdd != null) {
            _showVariantSheet(context);
          } else {
            onAdd();
          }
        },
        style: OutlinedButton.styleFrom(
          padding: const EdgeInsets.symmetric(horizontal: 12),
          side: const BorderSide(color: Color(0xFF0D7A30), width: 1.5),
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(6)),
          minimumSize: Size.zero,
        ),
        child: const Text('ADD',
          style: TextStyle(fontSize: 12, fontWeight: FontWeight.w700, color: Color(0xFF0D7A30)),
        ),
      ),
    );
  }

  Widget _qtySelector() {
    return Container(
      height: 28,
      decoration: BoxDecoration(
        color: const Color(0xFF0D7A30),
        borderRadius: BorderRadius.circular(6),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          InkWell(
            onTap: onDecrement,
            child: const Padding(
              padding: EdgeInsets.symmetric(horizontal: 8),
              child: Icon(Icons.remove, size: 14, color: Colors.white),
            ),
          ),
          Text('$cartQty', style: const TextStyle(color: Colors.white, fontWeight: FontWeight.w700, fontSize: 13)),
          InkWell(
            onTap: onIncrement,
            child: const Padding(
              padding: EdgeInsets.symmetric(horizontal: 8),
              child: Icon(Icons.add, size: 14, color: Colors.white),
            ),
          ),
        ],
      ),
    );
  }

  void _showVariantSheet(BuildContext context) {
    final variants = _variantList;
    final basePrice = (product['sellingPrice'] ?? product['price'] ?? 0).toDouble();
    final baseMrp = (product['mrp'] ?? product['price'] ?? 0).toDouble();
    final images = product['images'] as List? ?? [];
    final img = images.isNotEmpty ? images[0].toString() : null;
    final imgSrc = img != null
        ? (img.startsWith('http') ? img : '${AppConfig.uploadsBase}$img')
        : null;

    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (ctx) => VariantPickerSheet(
        productName: (product['name'] ?? '').toString(),
        imgSrc: imgSrc,
        variants: variants,
        basePrice: basePrice,
        baseMrp: baseMrp,
        onConfirm: (label, price) {
          Navigator.pop(ctx);
          onVariantAdd?.call(label, price);
        },
      ),
    );
  }
}

// Public so section_factory can reuse it
class VariantPickerSheet extends StatefulWidget {
  final String productName;
  final String? imgSrc;
  final List<Map<String, dynamic>> variants;
  final double basePrice;
  final double baseMrp;
  final void Function(String label, double price) onConfirm;

  const VariantPickerSheet({
    super.key,
    required this.productName,
    this.imgSrc,
    required this.variants,
    required this.basePrice,
    required this.baseMrp,
    required this.onConfirm,
  });

  @override
  State<VariantPickerSheet> createState() => _VariantPickerSheetState();
}

class _VariantPickerSheetState extends State<VariantPickerSheet> {
  late int _selectedIdx;

  @override
  void initState() {
    super.initState();
    _selectedIdx = 0;
    for (int i = 0; i < widget.variants.length; i++) {
      if (((widget.variants[i]['stock'] ?? 999) as num) > 0) {
        _selectedIdx = i;
        break;
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final v = widget.variants[_selectedIdx];
    final selectedPrice = ((v['sellingPrice'] ?? 0) as num) > 0
        ? (v['sellingPrice'] as num).toDouble()
        : widget.basePrice;
    final selectedMrp = ((v['mrp'] ?? 0) as num) > 0
        ? (v['mrp'] as num).toDouble()
        : widget.baseMrp;
    final discount = selectedMrp > selectedPrice
        ? ((selectedMrp - selectedPrice) / selectedMrp * 100).round()
        : 0;
    final inStock = ((v['stock'] ?? 999) as num) > 0;

    return Container(
      decoration: const BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      padding: EdgeInsets.only(bottom: MediaQuery.of(context).viewInsets.bottom),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          // Handle
          const SizedBox(height: 12),
          Container(
            width: 40, height: 4,
            decoration: BoxDecoration(
              color: Colors.grey.shade300,
              borderRadius: BorderRadius.circular(2),
            ),
          ),
          const SizedBox(height: 16),

          // Product header row
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 16),
            child: Row(
              children: [
                if (widget.imgSrc != null)
                  ClipRRect(
                    borderRadius: BorderRadius.circular(8),
                    child: Image.network(
                      widget.imgSrc!,
                      width: 60, height: 60,
                      fit: BoxFit.cover,
                      errorBuilder: (_, __, ___) => const SizedBox(width: 60, height: 60),
                    ),
                  ),
                if (widget.imgSrc != null) const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(widget.productName,
                          maxLines: 2,
                          overflow: TextOverflow.ellipsis,
                          style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w700, color: AppColors.textPrimary)),
                      const SizedBox(height: 4),
                      Row(
                        children: [
                          Text('₹${selectedPrice.toStringAsFixed(0)}',
                              style: const TextStyle(fontSize: 18, fontWeight: FontWeight.w900, color: AppColors.textPrimary)),
                          if (discount > 0) ...[
                            const SizedBox(width: 6),
                            Text('₹${selectedMrp.toStringAsFixed(0)}',
                                style: const TextStyle(fontSize: 12, color: AppColors.textMuted, decoration: TextDecoration.lineThrough)),
                            const SizedBox(width: 4),
                            Text('$discount% off',
                                style: const TextStyle(fontSize: 12, color: Color(0xFF0D7A30), fontWeight: FontWeight.w700)),
                          ],
                        ],
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ),

          const SizedBox(height: 16),
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 16),
            child: Row(
              children: [
                const Text('Select Option',
                    style: TextStyle(fontSize: 13, fontWeight: FontWeight.w700, color: AppColors.textPrimary)),
                const SizedBox(width: 8),
                Text('· ${v['label'] ?? ''}',
                    style: const TextStyle(fontSize: 13, color: AppColors.primary, fontWeight: FontWeight.w600)),
              ],
            ),
          ),
          const SizedBox(height: 10),

          // Variant chips
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 16),
            child: Wrap(
              spacing: 8,
              runSpacing: 8,
              children: List.generate(widget.variants.length, (i) {
                final vi = widget.variants[i];
                final available = ((vi['stock'] ?? 999) as num) > 0;
                final selected = _selectedIdx == i;
                return GestureDetector(
                  onTap: available ? () => setState(() => _selectedIdx = i) : null,
                  child: AnimatedContainer(
                    duration: const Duration(milliseconds: 150),
                    padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
                    decoration: BoxDecoration(
                      color: selected ? AppColors.primary : Colors.white,
                      border: Border.all(
                        color: selected
                            ? AppColors.primary
                            : available
                                ? Colors.grey.shade400
                                : Colors.grey.shade200,
                        width: selected ? 2 : 1.2,
                      ),
                      borderRadius: BorderRadius.circular(8),
                    ),
                    child: Text(
                      (vi['label'] ?? '').toString(),
                      style: TextStyle(
                        fontSize: 13,
                        fontWeight: FontWeight.w700,
                        color: selected
                            ? Colors.white
                            : available
                                ? AppColors.textPrimary
                                : AppColors.textMuted,
                        decoration: available ? null : TextDecoration.lineThrough,
                      ),
                    ),
                  ),
                );
              }),
            ),
          ),

          const SizedBox(height: 20),

          // Add to Cart button
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 0, 16, 16),
            child: SizedBox(
              width: double.infinity,
              height: 50,
              child: ElevatedButton(
                onPressed: inStock
                    ? () => widget.onConfirm((v['label'] ?? '').toString(), selectedPrice)
                    : null,
                style: ElevatedButton.styleFrom(
                  backgroundColor: AppColors.primary,
                  disabledBackgroundColor: Colors.grey.shade300,
                  foregroundColor: Colors.white,
                  elevation: 0,
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                ),
                child: Text(
                  inStock ? 'Add to Cart' : 'Out of Stock',
                  style: const TextStyle(fontSize: 15, fontWeight: FontWeight.w700),
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }
}
