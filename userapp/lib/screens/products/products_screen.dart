import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../services/api_service.dart';
import '../../services/cart_service.dart';
import '../../theme/app_theme.dart';
import '../../components/product_card.dart';
import '../../components/shimmer_loader.dart';

class ProductsScreen extends StatefulWidget {
  const ProductsScreen({super.key});

  @override
  State<ProductsScreen> createState() => _ProductsScreenState();
}

class _ProductsScreenState extends State<ProductsScreen> {
  final _api = ApiService();
  List<dynamic> _products = [];
  bool _loading = true;
  int _page = 1;
  bool _hasMore = true;
  final _scrollController = ScrollController();

  @override
  void initState() {
    super.initState();
    _scrollController.addListener(_onScroll);
  }

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    if (_products.isEmpty) _load();
  }

  void _onScroll() {
    if (_scrollController.position.pixels >= _scrollController.position.maxScrollExtent - 200 && !_loading && _hasMore) {
      _load(loadMore: true);
    }
  }

  Future<void> _load({bool loadMore = false}) async {
    if (loadMore) _page++;
    else { _page = 1; _products.clear(); }

    setState(() => _loading = true);
    try {
      final args = ModalRoute.of(context)!.settings.arguments as Map<String, dynamic>;
      final query = <String, String>{'page': '$_page', 'limit': '20'};

      // Could be search results, shop-based, or category/subcategory browse
      final String endpoint;
      if (args.containsKey('shopId')) {
        endpoint = '/user/shops/${args['shopId']}/products';
        if (args['category'] != null) query['category'] = args['category'];
        if (args['subCategory'] != null) query['subCategory'] = args['subCategory'];
      } else if (args.containsKey('subCategory') || (args.containsKey('category') && !args.containsKey('search'))) {
        endpoint = '/user/products';
        if (args['category'] != null) query['category'] = args['category'];
        if (args['subCategory'] != null) query['subCategory'] = args['subCategory'];
      } else {
        endpoint = '/user/search';
        query['q'] = args['search'] ?? args['title'] ?? '';
        if (args['category'] != null) query['category'] = args['category'];
      }

      final res = await _api.get(endpoint, auth: false, query: query);
      final list = res['products'] ?? [];
      _products.addAll(list);
      _hasMore = list.length >= 20;
    } catch (_) {}
    if (mounted) setState(() => _loading = false);
  }

  @override
  void dispose() {
    _scrollController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final args = ModalRoute.of(context)!.settings.arguments as Map<String, dynamic>;
    final title = args['title'] ?? 'Products';
    final cart = context.watch<CartService>();

    return Scaffold(
      appBar: AppBar(title: Text(title)),
      body: _loading && _products.isEmpty
          ? const ShimmerGrid(count: 6)
          : _products.isEmpty
              ? const Center(child: Text('No products found', style: TextStyle(color: AppColors.textSecondary)))
              : GridView.builder(
                  controller: _scrollController,
                  padding: const EdgeInsets.all(12),
                  gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
                    crossAxisCount: 2,
                    childAspectRatio: 0.62,
                    crossAxisSpacing: 12,
                    mainAxisSpacing: 12,
                  ),
                  itemCount: _products.length + (_hasMore ? 1 : 0),
                  itemBuilder: (context, i) {
                    if (i >= _products.length) {
                      return const Center(child: CircularProgressIndicator(strokeWidth: 2));
                    }
                    final p = Map<String, dynamic>.from(_products[i]);
                    return ProductCard(
                      product: p,
                      cartQty: cart.getQuantity(p['_id'] ?? ''),
                      onAdd: () => _addToCart(p),
                      onVariantAdd: (label, price) => _addToCartWithVariant(p, label, price),
                      onIncrement: () => cart.updateQuantity(p['_id'], cart.getQuantity(p['_id']) + 1),
                      onDecrement: () => cart.updateQuantity(p['_id'], cart.getQuantity(p['_id']) - 1),
                      onTap: () => Navigator.pushNamed(context, '/product', arguments: p),
                    );
                  },
                ),
    );
  }

  void _addToCart(Map<String, dynamic> p) {
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

  void _addToCartWithVariant(Map<String, dynamic> p, String variantLabel, double price) {
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
}
