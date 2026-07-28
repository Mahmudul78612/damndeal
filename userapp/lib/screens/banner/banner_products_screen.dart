import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../services/api_service.dart';
import '../../services/cart_service.dart';
import '../../theme/app_theme.dart';
import '../../components/product_card.dart';
import '../../components/shimmer_loader.dart';

class BannerProductsScreen extends StatefulWidget {
  final String bannerId;
  final String title;

  const BannerProductsScreen({super.key, required this.bannerId, required this.title});

  @override
  State<BannerProductsScreen> createState() => _BannerProductsScreenState();
}

class _BannerProductsScreenState extends State<BannerProductsScreen> {
  final _api = ApiService();
  List<dynamic> _products = [];
  List<dynamic> _filtered = [];
  bool _loading = true;
  String? _error;
  String _searchQuery = '';

  @override
  void initState() {
    super.initState();
    _loadProducts();
  }

  Future<void> _loadProducts() async {
    setState(() { _loading = true; _error = null; });
    try {
      final res = await _api.get('/user/banners/${widget.bannerId}/products', auth: false);
      _products = res['products'] ?? [];
      _applySearch();
    } catch (e) {
      _error = e.toString();
    }
    if (mounted) setState(() => _loading = false);
  }

  void _applySearch() {
    if (_searchQuery.isEmpty) {
      _filtered = _products;
    } else {
      final q = _searchQuery.toLowerCase();
      _filtered = _products.where((p) {
        final name = (p['name'] ?? '').toString().toLowerCase();
        return name.contains(q);
      }).toList();
    }
  }

  void _addToCart(dynamic p) {
    context.read<CartService>().addItem(CartItem(
      productId: p['_id'] ?? '',
      name: p['name'] ?? '',
      image: (p['images'] is List && (p['images'] as List).isNotEmpty) ? p['images'][0] : null,
      price: (p['sellingPrice'] ?? p['price'] ?? 0).toDouble(),
      unit: p['unit'] ?? '',
      partnerId: p['partner']?['_id'] ?? p['partner'] ?? '',
      partnerName: p['partner']?['name'] ?? '',
      platform: p['platform'] ?? 'damndeal',
    ));
  }

  void _addToCartWithVariant(dynamic p, String variantLabel, double price) {
    context.read<CartService>().addItem(CartItem(
      productId: p['_id'] ?? '',
      name: p['name'] ?? '',
      image: (p['images'] is List && (p['images'] as List).isNotEmpty) ? p['images'][0] : null,
      price: price,
      unit: p['unit'] ?? '',
      partnerId: p['partner']?['_id'] ?? p['partner'] ?? '',
      partnerName: p['partner']?['name'] ?? '',
      platform: p['platform'] ?? 'damndeal',
      variantLabel: variantLabel,
    ));
  }

  @override
  Widget build(BuildContext context) {
    const themeColor = Color(0xFF0D7A30);
    return Scaffold(
      extendBodyBehindAppBar: true,
      appBar: AppBar(
        backgroundColor: Colors.transparent,
        elevation: 0,
        foregroundColor: Colors.white,
        title: Text(widget.title, style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 18)),
        bottom: PreferredSize(
          preferredSize: const Size.fromHeight(50),
          child: Padding(
            padding: const EdgeInsets.fromLTRB(16, 0, 16, 10),
            child: Container(
              height: 40,
              decoration: BoxDecoration(
                color: Colors.white.withValues(alpha: 0.92),
                borderRadius: BorderRadius.circular(10),
              ),
              child: TextField(
                onChanged: (v) => setState(() { _searchQuery = v; _applySearch(); }),
                style: const TextStyle(fontSize: 14),
                decoration: InputDecoration(
                  hintText: 'Search in ${widget.title}...',
                  hintStyle: TextStyle(fontSize: 14, color: Colors.grey[400]),
                  prefixIcon: Icon(Icons.search_rounded, size: 20, color: Colors.grey[500]),
                  border: InputBorder.none,
                  contentPadding: const EdgeInsets.symmetric(vertical: 10),
                ),
              ),
            ),
          ),
        ),
      ),
      body: Stack(
        children: [
          // Faded gradient background
          Positioned(
            top: 0, left: 0, right: 0,
            height: MediaQuery.of(context).size.height * 0.28,
            child: Container(
              decoration: BoxDecoration(
                gradient: LinearGradient(
                  begin: Alignment.topCenter,
                  end: Alignment.bottomCenter,
                  colors: [
                    themeColor.withValues(alpha: 0.85),
                    themeColor.withValues(alpha: 0.0),
                  ],
                ),
              ),
            ),
          ),
          SafeArea(
            child: _loading
                ? const SingleChildScrollView(
                    child: Column(
                      children: [
                        SizedBox(height: 16),
                        ShimmerGrid(count: 8),
                      ],
                    ),
                  )
                : _error != null
                    ? Center(
                        child: Column(
                          mainAxisAlignment: MainAxisAlignment.center,
                          children: [
                            const Icon(Icons.error_outline, size: 48, color: AppColors.textMuted),
                            const SizedBox(height: 12),
                            Text(_error!, style: const TextStyle(color: AppColors.textSecondary)),
                            const SizedBox(height: 16),
                            ElevatedButton(onPressed: _loadProducts, child: const Text('Retry')),
                          ],
                        ),
                      )
                    : _filtered.isEmpty
                        ? Center(
                            child: Column(
                              mainAxisAlignment: MainAxisAlignment.center,
                              children: [
                                const Icon(Icons.inventory_2_outlined, size: 64, color: AppColors.textMuted),
                                const SizedBox(height: 12),
                                Text(
                                  _searchQuery.isNotEmpty ? 'No matching products' : 'No products found',
                                  style: const TextStyle(color: AppColors.textSecondary, fontSize: 16),
                                ),
                              ],
                            ),
                          )
                        : RefreshIndicator(
                            onRefresh: _loadProducts,
                            child: GridView.builder(
                              padding: const EdgeInsets.all(12),
                              gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
                                crossAxisCount: 2,
                                mainAxisSpacing: 10,
                                crossAxisSpacing: 10,
                                childAspectRatio: 0.65,
                              ),
                              itemCount: _filtered.length,
                              itemBuilder: (context, i) {
                                final p = _filtered[i] is Map ? _filtered[i] : {};
                                final cart = context.watch<CartService>();
                                return ProductCard(
                                  product: Map<String, dynamic>.from(p),
                                  cartQty: cart.getQuantity(p['_id'] ?? ''),
                                  onAdd: () => _addToCart(p),
                                  onVariantAdd: (label, price) => _addToCartWithVariant(p, label, price),
                                  onIncrement: () => cart.updateQuantity(p['_id'], cart.getQuantity(p['_id']) + 1),
                                  onDecrement: () => cart.updateQuantity(p['_id'], cart.getQuantity(p['_id']) - 1),
                                  onTap: () => Navigator.pushNamed(context, '/product', arguments: p),
                                );
                              },
                            ),
                          ),
          ),
        ],
      ),
    );
  }
}
