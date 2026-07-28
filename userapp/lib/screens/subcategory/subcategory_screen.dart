import 'package:flutter/material.dart';
import 'package:cached_network_image/cached_network_image.dart';
import 'package:provider/provider.dart';
import '../../services/api_service.dart';
import '../../services/cart_service.dart';
import '../../config.dart';
import '../../theme/app_theme.dart';
import '../../components/product_card.dart';
import '../../components/shimmer_loader.dart';

class SubCategoryScreen extends StatefulWidget {
  const SubCategoryScreen({super.key});

  @override
  State<SubCategoryScreen> createState() => _SubCategoryScreenState();
}

class _SubCategoryScreenState extends State<SubCategoryScreen> {
  final _api = ApiService();
  static const String _allSubId = '__all__';
  List<dynamic> _subCategories = [];
  List<dynamic> _allProducts = [];
  List<dynamic> _products = [];
  bool _loadingSubs = true;
  bool _loadingProducts = false;
  int _selectedIndex = 0;
  bool _initialized = false;

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    if (!_initialized) {
      _initialized = true;
      _loadSubCategories();
    }
  }

  Map<String, dynamic> get _cat =>
      ModalRoute.of(context)!.settings.arguments as Map<String, dynamic>;

  Future<void> _loadSubCategories() async {
    setState(() => _loadingSubs = true);
    try {
      final res = await _api.get('/subcategories', auth: false, query: {'category': _cat['_id']});
      final fetched = List<dynamic>.from(res['subCategories'] ?? []);
      _subCategories = [
        {
          '_id': _allSubId,
          'name': 'All',
          'image': null,
        },
        ...fetched,
      ];
      _loadProducts(0);
    } catch (_) {}
    if (mounted) setState(() => _loadingSubs = false);
  }

  Future<void> _loadProducts(int index) async {
    setState(() {
      _selectedIndex = index;
      _loadingProducts = true;
      _products = [];
    });
    try {
      final sub = _subCategories[index];
      final isAll = sub['_id'] == _allSubId;
      final query = <String, String>{
        'limit': '50',
        'category': '${_cat['_id']}',
      };
      if (!isAll) query['subCategory'] = '${sub['_id']}';

      final res = await _api.get('/user/products', auth: false, query: query);
      _allProducts = res['products'] ?? [];
      _applyFilters();
    } catch (_) {}
    if (mounted) setState(() => _loadingProducts = false);
  }

  // ── Filter & Sort Logic ──
  String _sortBy = 'relevance';
  String? _selectedQuantity;
  String? _selectedPriceRange;

  final List<String> _priceRanges = [
    'Under ₹50',
    '₹50 – ₹100',
    '₹100 – ₹200',
    '₹200 – ₹500',
    '₹500 – ₹1000',
    'Above ₹1000',
  ];

  List<String> get _availableQuantities {
    final Set<String> units = {};
    for (final p in _allProducts) {
      final w = p['weight'];
      final u = p['unit'] ?? 'piece';
      if (w != null && w > 0) {
        if (u == 'kg' || u == 'g') {
          units.add(w >= 1000 ? '${(w / 1000).toStringAsFixed(w % 1000 == 0 ? 0 : 1)} kg' : '${w.toInt()} g');
        } else if (u == 'litre' || u == 'ml' || u == 'l') {
          units.add(w >= 1000 ? '${(w / 1000).toStringAsFixed(w % 1000 == 0 ? 0 : 1)} L' : '${w.toInt()} ml');
        } else if (u == 'piece') {
          units.add('${w.toInt()} pc');
        } else {
          units.add('$w $u');
        }
      } else {
        final s = p['size']?.toString();
        if (s != null && s.isNotEmpty) units.add(s);
      }
    }
    final list = units.toList()..sort();
    return list;
  }

  void _applyFilters() {
    List<dynamic> filtered = List.from(_allProducts);

    // Quantity filter
    if (_selectedQuantity != null) {
      filtered = filtered.where((p) {
        final w = p['weight'];
        final u = p['unit'] ?? 'piece';
        String label = '';
        if (w != null && w > 0) {
          if (u == 'kg' || u == 'g') {
            label = w >= 1000 ? '${(w / 1000).toStringAsFixed(w % 1000 == 0 ? 0 : 1)} kg' : '${w.toInt()} g';
          } else if (u == 'litre' || u == 'ml' || u == 'l') {
            label = w >= 1000 ? '${(w / 1000).toStringAsFixed(w % 1000 == 0 ? 0 : 1)} L' : '${w.toInt()} ml';
          } else if (u == 'piece') {
            label = '${w.toInt()} pc';
          } else {
            label = '$w $u';
          }
        } else {
          label = p['size']?.toString() ?? '';
        }
        return label == _selectedQuantity;
      }).toList();
    }

    // Price filter
    if (_selectedPriceRange != null) {
      filtered = filtered.where((p) {
        final price = (p['sellingPrice'] ?? p['price'] ?? 0).toDouble();
        switch (_selectedPriceRange) {
          case 'Under ₹50': return price < 50;
          case '₹50 – ₹100': return price >= 50 && price <= 100;
          case '₹100 – ₹200': return price > 100 && price <= 200;
          case '₹200 – ₹500': return price > 200 && price <= 500;
          case '₹500 – ₹1000': return price > 500 && price <= 1000;
          case 'Above ₹1000': return price > 1000;
          default: return true;
        }
      }).toList();
    }

    // Sort
    switch (_sortBy) {
      case 'price: low to high':
        filtered.sort((a, b) => ((a['sellingPrice'] ?? 0) as num).compareTo((b['sellingPrice'] ?? 0) as num));
        break;
      case 'price: high to low':
        filtered.sort((a, b) => ((b['sellingPrice'] ?? 0) as num).compareTo((a['sellingPrice'] ?? 0) as num));
        break;
      case 'name: a-z':
        filtered.sort((a, b) => (a['name'] ?? '').toString().toLowerCase().compareTo((b['name'] ?? '').toString().toLowerCase()));
        break;
    }

    setState(() => _products = filtered);
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

  int get _activeFilterCount {
    int c = 0;
    if (_sortBy != 'relevance') c++;
    if (_selectedQuantity != null) c++;
    if (_selectedPriceRange != null) c++;
    return c;
  }

  void _clearAllFilters() {
    setState(() {
      _sortBy = 'relevance';
      _selectedQuantity = null;
      _selectedPriceRange = null;
    });
    _applyFilters();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Colors.white,
      appBar: AppBar(
        backgroundColor: Colors.white,
        surfaceTintColor: Colors.white,
        elevation: 0.5,
        foregroundColor: Colors.black,
        titleSpacing: 0,
        title: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(_cat['name'] ?? 'Sub-Categories',
                style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 17, color: Colors.black)),
            const Text('Delivering to Home',
                style: TextStyle(fontSize: 11, color: Colors.grey, fontWeight: FontWeight.w400)),
          ],
        ),
        actions: [
          IconButton(
            icon: const Icon(Icons.search, size: 24),
            onPressed: () => Navigator.pushNamed(context, '/search'),
          ),
          IconButton(
            icon: const Icon(Icons.share_outlined, size: 22),
            onPressed: () {},
          ),
        ],
        bottom: PreferredSize(
          preferredSize: const Size.fromHeight(46),
          child: Container(
            height: 46,
            decoration: BoxDecoration(
              color: Colors.white,
              border: Border(bottom: BorderSide(color: Colors.grey.shade200)),
            ),
            child: ListView(
              scrollDirection: Axis.horizontal,
              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
              children: [
                _buildFilterChip(
                  _activeFilterCount > 0 ? 'Filters ($_activeFilterCount)' : 'Filters',
                  Icons.tune,
                  isActive: _activeFilterCount > 0,
                  onTap: () => _showFiltersSheet(),
                ),
                const SizedBox(width: 8),
                _buildFilterChip(
                  _sortBy == 'relevance' ? 'Sort' : _sortBy.split(':').first.trim(),
                  Icons.swap_vert,
                  isActive: _sortBy != 'relevance',
                  onTap: () => _showSortSheet(),
                ),
                const SizedBox(width: 8),
                _buildFilterChip(
                  _selectedQuantity ?? 'Quantity',
                  null,
                  isActive: _selectedQuantity != null,
                  onTap: () => _showQuantitySheet(),
                ),
                const SizedBox(width: 8),
                _buildFilterChip(
                  _selectedPriceRange ?? 'Price',
                  null,
                  hasDropdown: true,
                  isActive: _selectedPriceRange != null,
                  onTap: () => _showPriceSheet(),
                ),
              ],
            ),
          ),
        ),
      ),
      body: _loadingSubs
                ? const ShimmerLoader(count: 6, height: 70, padding: EdgeInsets.all(16))
                : Row(
                        children: [
                          // Left sidebar — subcategories
                          SizedBox(
                            width: 82,
                            child: Container(
                              color: const Color(0xFFF5F5F5),
                              child: ListView.builder(
                                padding: const EdgeInsets.only(top: 4),
                                itemCount: _subCategories.length,
                                itemBuilder: (context, i) => _buildSidebarItem(i),
                              ),
                            ),
                          ),
                          // Right side — products
                          Expanded(
                            child: _loadingProducts
                                ? const ShimmerGrid(count: 6)
                                : _products.isEmpty
                                    ? const Center(
                                        child: Text('No products found',
                                            style: TextStyle(color: AppColors.textSecondary)))
                                    : GridView.builder(
                                        padding: const EdgeInsets.all(8),
                                        gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
                                          crossAxisCount: 2,
                                          childAspectRatio: 0.62,
                                          crossAxisSpacing: 8,
                                          mainAxisSpacing: 8,
                                        ),
                                        itemCount: _products.length,
                                        itemBuilder: (context, i) {
                                          final p = Map<String, dynamic>.from(_products[i]);
                                          final cart = context.watch<CartService>();
                                          return ProductCard(
                                            product: p,
                                            cartQty: cart.getQuantity(p['_id'] ?? ''),
                                            onAdd: () => _addToCart(p),
                                            onVariantAdd: (label, price) =>
                                                _addToCartWithVariant(p, label, price),
                                            onIncrement: () => cart.updateQuantity(
                                                p['_id'], cart.getQuantity(p['_id']) + 1),
                                            onDecrement: () => cart.updateQuantity(
                                                p['_id'], cart.getQuantity(p['_id']) - 1),
                                            onTap: () => Navigator.pushNamed(context, '/product',
                                                arguments: p),
                                          );
                                        },
                                      ),
                          ),
                        ],
                      ),
    );
  }

  Widget _buildSidebarItem(int index) {
    final sub = _subCategories[index];
    final isSelected = index == _selectedIndex;
    final isAll = sub['_id'] == _allSubId;
    final img = sub['image']?.toString();
    final hasImage = !isAll && img != null && img.isNotEmpty;
    final src = hasImage
        ? (img.startsWith('http') ? img : '${AppConfig.uploadsBase}$img')
        : '';

    return GestureDetector(
      onTap: () => _loadProducts(index),
      child: Container(
        decoration: BoxDecoration(
          color: isSelected ? Colors.white : Colors.transparent,
          border: Border(
            left: BorderSide(
              color: isSelected ? const Color(0xFF0D7A30) : Colors.transparent,
              width: 3,
            ),
          ),
        ),
        padding: const EdgeInsets.symmetric(vertical: 10, horizontal: 4),
        child: Column(
          children: [
            Container(
              width: 48,
              height: 48,
              decoration: BoxDecoration(
                color: isSelected
                    ? const Color(0xFF0D7A30).withValues(alpha: 0.1)
                    : const Color(0xFFE8E8E8),
                borderRadius: BorderRadius.circular(12),
              ),
              child: hasImage
                  ? ClipRRect(
                      borderRadius: BorderRadius.circular(12),
                      child: CachedNetworkImage(
                        imageUrl: src,
                        fit: BoxFit.cover,
                        width: 48,
                        height: 48,
                        placeholder: (_, __) => const Center(
                            child: CircularProgressIndicator(strokeWidth: 1.5)),
                        errorWidget: (_, __, ___) => Icon(Icons.category_rounded,
                            color: isSelected
                                ? const Color(0xFF0D7A30)
                                : AppColors.textMuted,
                            size: 22),
                      ),
                    )
                  : Icon(isAll ? Icons.grid_view_rounded : Icons.category_rounded,
                      color: isSelected
                          ? const Color(0xFF0D7A30)
                          : AppColors.textMuted,
                      size: 22),
            ),
            const SizedBox(height: 4),
            Text(
              sub['name'] ?? '',
              style: TextStyle(
                fontSize: 10,
                fontWeight: isSelected ? FontWeight.w700 : FontWeight.w500,
                color: isSelected ? const Color(0xFF0D7A30) : AppColors.textPrimary,
              ),
              maxLines: 2,
              overflow: TextOverflow.ellipsis,
              textAlign: TextAlign.center,
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildFilterChip(String label, IconData? icon, {bool hasDropdown = false, bool isActive = false, required VoidCallback onTap}) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
        decoration: BoxDecoration(
          border: Border.all(color: isActive ? const Color(0xFF0D7A30) : Colors.grey.shade300),
          borderRadius: BorderRadius.circular(20),
          color: isActive ? const Color(0xFF0D7A30).withValues(alpha: 0.08) : Colors.white,
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            if (icon != null) ...[
              Icon(icon, size: 15, color: isActive ? const Color(0xFF0D7A30) : Colors.black87),
              const SizedBox(width: 4),
            ],
            Text(label, style: TextStyle(fontSize: 12, fontWeight: FontWeight.w500, color: isActive ? const Color(0xFF0D7A30) : Colors.black87)),
            if (hasDropdown) ...[
              const SizedBox(width: 2),
              Icon(Icons.keyboard_arrow_down, size: 16, color: isActive ? const Color(0xFF0D7A30) : Colors.black54),
            ],
            if (isActive) ...[
              const SizedBox(width: 4),
              GestureDetector(
                onTap: () {
                  // Clear this specific filter
                  if (label.startsWith('Filters')) { _clearAllFilters(); }
                  else if (_selectedQuantity != null && label == _selectedQuantity) { setState(() => _selectedQuantity = null); _applyFilters(); }
                  else if (_selectedPriceRange != null && label == _selectedPriceRange) { setState(() => _selectedPriceRange = null); _applyFilters(); }
                  else { setState(() => _sortBy = 'relevance'); _applyFilters(); }
                },
                child: const Icon(Icons.close, size: 14, color: Color(0xFF0D7A30)),
              ),
            ],
          ],
        ),
      ),
    );
  }

  void _showSortSheet() {
    final options = ['Relevance', 'Price: Low to High', 'Price: High to Low', 'Name: A-Z'];
    showModalBottomSheet(
      context: context,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(16)),
      ),
      builder: (_) => Padding(
        padding: const EdgeInsets.symmetric(vertical: 16),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Padding(
              padding: EdgeInsets.symmetric(horizontal: 16),
              child: Text('Sort by', style: TextStyle(fontSize: 16, fontWeight: FontWeight.w700)),
            ),
            const SizedBox(height: 8),
            ...options.map((o) => ListTile(
              title: Text(o, style: const TextStyle(fontSize: 14)),
              trailing: _sortBy == o.toLowerCase() ? const Icon(Icons.check, color: Color(0xFF0D7A30)) : null,
              onTap: () {
                setState(() => _sortBy = o.toLowerCase());
                _applyFilters();
                Navigator.pop(context);
              },
            )),
          ],
        ),
      ),
    );
  }

  void _showQuantitySheet() {
    final quantities = _availableQuantities;
    if (quantities.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('No quantity variants available'), duration: Duration(seconds: 2)),
      );
      return;
    }
    showModalBottomSheet(
      context: context,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(16)),
      ),
      builder: (_) => Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                const Text('Filter by Quantity', style: TextStyle(fontSize: 16, fontWeight: FontWeight.w700)),
                if (_selectedQuantity != null)
                  GestureDetector(
                    onTap: () { setState(() => _selectedQuantity = null); _applyFilters(); Navigator.pop(context); },
                    child: const Text('Clear', style: TextStyle(fontSize: 13, color: Color(0xFF0D7A30), fontWeight: FontWeight.w600)),
                  ),
              ],
            ),
            const SizedBox(height: 14),
            Wrap(
              spacing: 8,
              runSpacing: 8,
              children: quantities.map((q) {
                final selected = _selectedQuantity == q;
                return GestureDetector(
                  onTap: () {
                    setState(() => _selectedQuantity = selected ? null : q);
                    _applyFilters();
                    Navigator.pop(context);
                  },
                  child: Container(
                    padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
                    decoration: BoxDecoration(
                      color: selected ? const Color(0xFF0D7A30).withValues(alpha: 0.1) : Colors.white,
                      border: Border.all(color: selected ? const Color(0xFF0D7A30) : Colors.grey.shade300),
                      borderRadius: BorderRadius.circular(20),
                    ),
                    child: Text(q, style: TextStyle(
                      fontSize: 13,
                      fontWeight: selected ? FontWeight.w600 : FontWeight.w400,
                      color: selected ? const Color(0xFF0D7A30) : Colors.black87,
                    )),
                  ),
                );
              }).toList(),
            ),
            const SizedBox(height: 10),
          ],
        ),
      ),
    );
  }

  void _showPriceSheet() {
    showModalBottomSheet(
      context: context,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(16)),
      ),
      builder: (_) => Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                const Text('Filter by Price', style: TextStyle(fontSize: 16, fontWeight: FontWeight.w700)),
                if (_selectedPriceRange != null)
                  GestureDetector(
                    onTap: () { setState(() => _selectedPriceRange = null); _applyFilters(); Navigator.pop(context); },
                    child: const Text('Clear', style: TextStyle(fontSize: 13, color: Color(0xFF0D7A30), fontWeight: FontWeight.w600)),
                  ),
              ],
            ),
            const SizedBox(height: 14),
            Wrap(
              spacing: 8,
              runSpacing: 8,
              children: _priceRanges.map((r) {
                final selected = _selectedPriceRange == r;
                return GestureDetector(
                  onTap: () {
                    setState(() => _selectedPriceRange = selected ? null : r);
                    _applyFilters();
                    Navigator.pop(context);
                  },
                  child: Container(
                    padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
                    decoration: BoxDecoration(
                      color: selected ? const Color(0xFF0D7A30).withValues(alpha: 0.1) : Colors.white,
                      border: Border.all(color: selected ? const Color(0xFF0D7A30) : Colors.grey.shade300),
                      borderRadius: BorderRadius.circular(20),
                    ),
                    child: Text(r, style: TextStyle(
                      fontSize: 13,
                      fontWeight: selected ? FontWeight.w600 : FontWeight.w400,
                      color: selected ? const Color(0xFF0D7A30) : Colors.black87,
                    )),
                  ),
                );
              }).toList(),
            ),
            const SizedBox(height: 10),
          ],
        ),
      ),
    );
  }

  void _showFiltersSheet() {
    showModalBottomSheet(
      context: context,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(16)),
      ),
      isScrollControlled: true,
      builder: (_) => DraggableScrollableSheet(
        initialChildSize: 0.55,
        minChildSize: 0.3,
        maxChildSize: 0.8,
        expand: false,
        builder: (ctx, scrollCtrl) => StatefulBuilder(
          builder: (ctx, setSheetState) {
            return Padding(
              padding: const EdgeInsets.all(16),
              child: ListView(
                controller: scrollCtrl,
                children: [
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      const Text('All Filters', style: TextStyle(fontSize: 18, fontWeight: FontWeight.w700)),
                      if (_activeFilterCount > 0)
                        GestureDetector(
                          onTap: () { _clearAllFilters(); Navigator.pop(context); },
                          child: const Text('Clear All', style: TextStyle(fontSize: 13, color: Color(0xFF0D7A30), fontWeight: FontWeight.w600)),
                        ),
                    ],
                  ),
                  const SizedBox(height: 18),
                  // Sort section
                  const Text('Sort', style: TextStyle(fontSize: 14, fontWeight: FontWeight.w600)),
                  const SizedBox(height: 8),
                  Wrap(
                    spacing: 8, runSpacing: 8,
                    children: ['Relevance', 'Price: Low to High', 'Price: High to Low', 'Name: A-Z'].map((o) {
                      final sel = _sortBy == o.toLowerCase();
                      return GestureDetector(
                        onTap: () { setState(() => _sortBy = o.toLowerCase()); setSheetState(() {}); _applyFilters(); },
                        child: Container(
                          padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
                          decoration: BoxDecoration(
                            color: sel ? const Color(0xFF0D7A30).withValues(alpha: 0.1) : Colors.white,
                            border: Border.all(color: sel ? const Color(0xFF0D7A30) : Colors.grey.shade300),
                            borderRadius: BorderRadius.circular(20),
                          ),
                          child: Text(o, style: TextStyle(fontSize: 12, fontWeight: sel ? FontWeight.w600 : FontWeight.w400, color: sel ? const Color(0xFF0D7A30) : Colors.black87)),
                        ),
                      );
                    }).toList(),
                  ),
                  const SizedBox(height: 18),
                  // Price section
                  const Text('Price Range', style: TextStyle(fontSize: 14, fontWeight: FontWeight.w600)),
                  const SizedBox(height: 8),
                  Wrap(
                    spacing: 8, runSpacing: 8,
                    children: _priceRanges.map((r) {
                      final sel = _selectedPriceRange == r;
                      return GestureDetector(
                        onTap: () { setState(() => _selectedPriceRange = sel ? null : r); setSheetState(() {}); _applyFilters(); },
                        child: Container(
                          padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
                          decoration: BoxDecoration(
                            color: sel ? const Color(0xFF0D7A30).withValues(alpha: 0.1) : Colors.white,
                            border: Border.all(color: sel ? const Color(0xFF0D7A30) : Colors.grey.shade300),
                            borderRadius: BorderRadius.circular(20),
                          ),
                          child: Text(r, style: TextStyle(fontSize: 12, fontWeight: sel ? FontWeight.w600 : FontWeight.w400, color: sel ? const Color(0xFF0D7A30) : Colors.black87)),
                        ),
                      );
                    }).toList(),
                  ),
                  if (_availableQuantities.isNotEmpty) ...[
                    const SizedBox(height: 18),
                    const Text('Quantity', style: TextStyle(fontSize: 14, fontWeight: FontWeight.w600)),
                    const SizedBox(height: 8),
                    Wrap(
                      spacing: 8, runSpacing: 8,
                      children: _availableQuantities.map((q) {
                        final sel = _selectedQuantity == q;
                        return GestureDetector(
                          onTap: () { setState(() => _selectedQuantity = sel ? null : q); setSheetState(() {}); _applyFilters(); },
                          child: Container(
                            padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
                            decoration: BoxDecoration(
                              color: sel ? const Color(0xFF0D7A30).withValues(alpha: 0.1) : Colors.white,
                              border: Border.all(color: sel ? const Color(0xFF0D7A30) : Colors.grey.shade300),
                              borderRadius: BorderRadius.circular(20),
                            ),
                            child: Text(q, style: TextStyle(fontSize: 12, fontWeight: sel ? FontWeight.w600 : FontWeight.w400, color: sel ? const Color(0xFF0D7A30) : Colors.black87)),
                          ),
                        );
                      }).toList(),
                    ),
                  ],
                  const SizedBox(height: 20),
                  SizedBox(
                    width: double.infinity,
                    child: ElevatedButton(
                      style: ElevatedButton.styleFrom(
                        backgroundColor: const Color(0xFF0D7A30),
                        foregroundColor: Colors.white,
                        padding: const EdgeInsets.symmetric(vertical: 14),
                        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                      ),
                      onPressed: () => Navigator.pop(context),
                      child: Text('Show ${_products.length} products', style: const TextStyle(fontWeight: FontWeight.w600)),
                    ),
                  ),
                ],
              ),
            );
          },
        ),
      ),
    );
  }
}
