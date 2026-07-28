import 'package:flutter/material.dart';
import '../../services/api_service.dart';
import '../../theme/app_theme.dart';

class SearchScreen extends StatefulWidget {
  const SearchScreen({super.key});

  @override
  State<SearchScreen> createState() => _SearchScreenState();
}

class _SearchScreenState extends State<SearchScreen> {
  final _api = ApiService();
  final _controller = TextEditingController();
  List<dynamic> _results = [];
  bool _loading = false;
  bool _searched = false;

  Future<void> _search() async {
    final q = _controller.text.trim();
    if (q.length < 2) return;

    setState(() { _loading = true; _searched = true; });
    try {
      final res = await _api.get('/user/search', auth: false, query: {'q': q});
      _results = res['products'] ?? [];
    } catch (_) {}
    if (mounted) setState(() => _loading = false);
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: TextField(
          controller: _controller,
          autofocus: true,
          decoration: InputDecoration(
            hintText: 'Search products, shops…',
            border: InputBorder.none,
            suffixIcon: IconButton(
              icon: const Icon(Icons.search),
              onPressed: _search,
            ),
          ),
          onSubmitted: (_) => _search(),
        ),
      ),
      body: _loading
          ? const Center(child: CircularProgressIndicator())
          : !_searched
              ? Center(
                  child: Column(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      Icon(Icons.search_rounded, size: 64, color: AppColors.textMuted),
                      const SizedBox(height: 12),
                      Text('Search for products or shops', style: TextStyle(color: AppColors.textSecondary)),
                    ],
                  ),
                )
              : _results.isEmpty
                  ? const Center(child: Text('No results found', style: TextStyle(color: AppColors.textSecondary)))
                  : ListView.builder(
                      padding: const EdgeInsets.all(12),
                      itemCount: _results.length,
                      itemBuilder: (context, i) {
                        final p = _results[i];
                        final price = (p['sellingPrice'] ?? p['price'] ?? 0).toDouble();
                        return Card(
                          margin: const EdgeInsets.only(bottom: 8),
                          child: ListTile(
                            title: Text(p['name'] ?? '', style: const TextStyle(fontWeight: FontWeight.w500)),
                            subtitle: Text('₹${price.toStringAsFixed(0)}', style: const TextStyle(color: AppColors.primary, fontWeight: FontWeight.w700)),
                            trailing: const Icon(Icons.chevron_right, color: AppColors.textMuted),
                            onTap: () => Navigator.pushNamed(context, '/product', arguments: p),
                          ),
                        );
                      },
                    ),
    );
  }
}
