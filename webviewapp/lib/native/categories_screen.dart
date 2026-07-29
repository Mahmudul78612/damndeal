import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:http/http.dart' as http;

/// Native "Categories" tab.
///
/// Fetches the live category list from the DamnDeal API and renders a native
/// grid. Tapping a category hands the web category URL back to the shell via
/// [onOpenLink].
class CategoriesScreen extends StatefulWidget {
  const CategoriesScreen({
    super.key,
    required this.baseUrl,
    required this.region,
    required this.accent,
    required this.onOpenLink,
  });

  /// Site origin without trailing slash, e.g. https://damndeal.in
  final String baseUrl;

  /// Region header value: IN or US.
  final String region;

  final Color accent;

  final ValueChanged<String> onOpenLink;

  @override
  State<CategoriesScreen> createState() => _CategoriesScreenState();
}

class _Category {
  const _Category({required this.id, required this.name, required this.icon});

  final String id;
  final String name;
  final String icon;
}

class _CategoriesScreenState extends State<CategoriesScreen> {
  bool _loading = true;
  String? _error;
  List<_Category> _categories = const [];

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
        Uri.parse('${widget.baseUrl}/proxy-api/categories?platform=damndeal'),
        headers: {'x-region': widget.region},
      ).timeout(const Duration(seconds: 15));
      if (res.statusCode != 200) {
        throw Exception('HTTP ${res.statusCode}');
      }
      final decoded = jsonDecode(res.body) as Map<String, dynamic>;
      final raw = (decoded['categories'] as List?) ?? const [];
      final categories = <_Category>[];
      for (final item in raw) {
        if (item is! Map) continue;
        if (item['isActive'] == false) continue;
        final id = (item['_id'] ?? '').toString();
        final name = (item['name'] ?? '').toString();
        if (id.isEmpty || name.isEmpty) continue;
        var icon = (item['icon'] ?? item['image'] ?? '').toString();
        if (icon.isNotEmpty && !icon.startsWith('http')) {
          icon = '${widget.baseUrl}$icon';
        }
        categories.add(_Category(id: id, name: name, icon: icon));
      }
      if (!mounted) return;
      setState(() {
        _categories = categories;
        _loading = false;
      });
    } catch (_) {
      if (!mounted) return;
      setState(() {
        _error =
            'Could not load categories. Check your connection and try again.';
        _loading = false;
      });
    }
  }

  void _openCategory(_Category category) {
    HapticFeedback.selectionClick();
    widget.onOpenLink('${widget.baseUrl}/categories/${category.id}');
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFFF8F6F2),
      appBar: AppBar(
        backgroundColor: widget.accent,
        foregroundColor: Colors.white,
        automaticallyImplyLeading: false,
        title: const Text(
          'Categories',
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
    if (_error != null || _categories.isEmpty) {
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
                  Icon(
                    _error != null ? Icons.wifi_off : Icons.category_outlined,
                    size: 48,
                    color: const Color(0xFF8D8A85),
                  ),
                  const SizedBox(height: 12),
                  Padding(
                    padding: const EdgeInsets.symmetric(horizontal: 32),
                    child: Text(
                      _error ?? 'No categories yet — check back soon!',
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
                    child: const Text('Retry'),
                  ),
                ],
              ),
            ),
          ),
        ),
      );
    }
    return RefreshIndicator(
      color: widget.accent,
      onRefresh: _fetch,
      child: GridView.builder(
        physics: const AlwaysScrollableScrollPhysics(),
        padding: const EdgeInsets.all(14),
        gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
          crossAxisCount: 3,
          mainAxisSpacing: 12,
          crossAxisSpacing: 12,
          childAspectRatio: 0.86,
        ),
        itemCount: _categories.length,
        itemBuilder: (context, index) =>
            _buildTile(context, _categories[index]),
      ),
    );
  }

  Widget _buildTile(BuildContext context, _Category category) {
    return Material(
      color: Colors.white,
      borderRadius: BorderRadius.circular(14),
      elevation: 1.5,
      shadowColor: Colors.black26,
      child: InkWell(
        borderRadius: BorderRadius.circular(14),
        onTap: () => _openCategory(category),
        child: Padding(
          padding: const EdgeInsets.all(10),
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Container(
                width: 58,
                height: 58,
                decoration: BoxDecoration(
                  color: const Color(0xFFF3EFF6),
                  shape: BoxShape.circle,
                ),
                clipBehavior: Clip.antiAlias,
                child: category.icon.isEmpty
                    ? Icon(Icons.category_outlined, color: widget.accent)
                    : Image.network(
                        category.icon,
                        fit: BoxFit.cover,
                        errorBuilder: (_, _, _) => Icon(
                          Icons.category_outlined,
                          color: widget.accent,
                        ),
                      ),
              ),
              const SizedBox(height: 8),
              Text(
                category.name,
                maxLines: 2,
                overflow: TextOverflow.ellipsis,
                textAlign: TextAlign.center,
                style: const TextStyle(
                  fontWeight: FontWeight.w600,
                  fontSize: 12,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
