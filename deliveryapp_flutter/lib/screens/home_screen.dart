import 'package:flutter/material.dart';
import '../theme.dart';
import '../services/api_service.dart';
import '../services/location_service.dart';
import '../widgets/order_card.dart';
import '../widgets/stat_card.dart';
import 'order_detail_screen.dart';
import 'earnings_screen.dart';
import 'profile_screen.dart';
import '../widgets/permission_dialog.dart';

class HomeScreen extends StatefulWidget {
  const HomeScreen({super.key});
  @override
  State<HomeScreen> createState() => _HomeScreenState();
}

class _HomeScreenState extends State<HomeScreen> {
  final _api = ApiService();
  int _navIndex = 0;
  bool _isOnline = false;
  List<dynamic> _orders = [];
  String _filter = 'active';
  bool _loadingOrders = true;
  int _todayDeliveries = 0;
  String _todayEarnings = '₹0';

  @override
  void initState() {
    super.initState();
    _init();
  }

  Future<void> _init() async {
    final allowed = await PermissionDialog.showLocation(context);
    if (allowed) await LocationService.requestPermission();
    await _loadProfile();
    _loadStats();
    _loadOrders();
  }

  Future<void> _loadProfile() async {
    try {
      final p = await _api.get('/delivery/profile');
      setState(() => _isOnline = p['isOnline'] == true);
      if (_isOnline) LocationService.startTracking();
    } catch (_) {}
  }

  Future<void> _loadStats() async {
    try {
      final d = await _api.get('/delivery/earnings');
      if (!mounted) return;
      setState(() {
        _todayDeliveries = d['period']?['deliveries'] ?? d['totalDeliveries'] ?? 0;
        final amt = d['period']?['totalCollected'] ?? d['totalEarnings'] ?? 0;
        _todayEarnings = '₹$amt';
      });
    } catch (_) {}
  }

  Future<void> _loadOrders() async {
    setState(() => _loadingOrders = true);
    try {
      String status = '';
      if (_filter == 'active') status = 'assigned,picked_up,on_the_way';
      if (_filter == 'delivered') status = 'delivered';
      if (_filter == 'failed') status = 'failed';
      final d = await _api.get('/delivery/assignments?limit=50&status=$status');
      if (!mounted) return;
      setState(() {
        _orders = d['orders'] ?? d['data'] ?? [];
        _loadingOrders = false;
      });
    } catch (e) {
      setState(() { _orders = []; _loadingOrders = false; });
    }
  }

  Future<void> _toggleOnline() async {
    try {
      final d = await _api.put('/delivery/toggle-online');
      setState(() => _isOnline = d['isOnline'] == true);
      if (_isOnline) {
        LocationService.startTracking();
      } else {
        LocationService.stopTracking();
      }
      _showSnack(_isOnline ? 'You are Online! 🟢' : 'You are Offline');
    } catch (e) {
      _showSnack(e.toString(), isError: true);
    }
  }

  void _showSnack(String msg, {bool isError = false}) {
    if (!mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(SnackBar(
      content: Text(msg),
      backgroundColor: isError ? AppTheme.danger : AppTheme.success,
      behavior: SnackBarBehavior.floating,
      duration: const Duration(seconds: 2),
    ));
  }

  @override
  void dispose() {
    LocationService.stopTracking();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: RichText(
          text: const TextSpan(style: TextStyle(fontSize: 17, fontWeight: FontWeight.w700), children: [
            TextSpan(text: 'Damn', style: TextStyle(color: Colors.white)),
            TextSpan(text: 'Deal', style: TextStyle(color: AppTheme.accent)),
            TextSpan(text: '  Delivery', style: TextStyle(color: Colors.white70, fontSize: 12, fontWeight: FontWeight.w400)),
          ]),
        ),
        actions: [
          Container(
            margin: const EdgeInsets.only(right: 12),
            child: TextButton.icon(
              onPressed: _toggleOnline,
              icon: Container(
                width: 10, height: 10,
                decoration: BoxDecoration(
                  shape: BoxShape.circle,
                  color: _isOnline ? AppTheme.success : AppTheme.danger,
                ),
              ),
              label: Text(_isOnline ? 'Online' : 'Offline',
                  style: const TextStyle(color: Colors.white, fontSize: 12, fontWeight: FontWeight.w600)),
              style: TextButton.styleFrom(
                backgroundColor: Colors.white.withValues(alpha: 0.15),
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
                padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
              ),
            ),
          ),
        ],
      ),
      body: IndexedStack(
        index: _navIndex,
        children: [
          _homePage(),
          const EarningsScreen(),
          const ProfileScreen(),
        ],
      ),
      bottomNavigationBar: BottomNavigationBar(
        currentIndex: _navIndex,
        onTap: (i) => setState(() => _navIndex = i),
        selectedItemColor: AppTheme.primary,
        unselectedItemColor: AppTheme.textLight,
        items: const [
          BottomNavigationBarItem(icon: Icon(Icons.home_rounded), label: 'Home'),
          BottomNavigationBarItem(icon: Icon(Icons.account_balance_wallet), label: 'Earnings'),
          BottomNavigationBarItem(icon: Icon(Icons.person), label: 'Profile'),
        ],
      ),
    );
  }

  Widget _homePage() {
    return RefreshIndicator(
      onRefresh: () async { await _loadStats(); await _loadOrders(); },
      child: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          // Stats row
          Row(
            children: [
              Expanded(child: StatCard(label: "Today's Deliveries", value: '$_todayDeliveries', icon: Icons.local_shipping)),
              const SizedBox(width: 10),
              Expanded(child: StatCard(label: "Today's Earnings", value: _todayEarnings, icon: Icons.currency_rupee)),
            ],
          ),
          const SizedBox(height: 16),
          // Filter + title
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              const Text('My Orders', style: TextStyle(fontSize: 16, fontWeight: FontWeight.w700)),
              Row(
                children: [
                  _filterBtn('Active', 'active'),
                  const SizedBox(width: 6),
                  _filterBtn('Done', 'delivered'),
                  const SizedBox(width: 6),
                  _filterBtn('Failed', 'failed'),
                ],
              ),
            ],
          ),
          const SizedBox(height: 12),
          // Orders list
          if (_loadingOrders)
            const Center(child: Padding(padding: EdgeInsets.all(32), child: CircularProgressIndicator()))
          else if (_orders.isEmpty)
            Center(
              child: Padding(
                padding: const EdgeInsets.all(40),
                child: Column(
                  children: [
                    const Icon(Icons.inbox_rounded, size: 48, color: AppTheme.textLight),
                    const SizedBox(height: 8),
                    Text(_filter == 'active' ? 'No active orders right now' : 'No orders found',
                        style: const TextStyle(color: AppTheme.textLight)),
                  ],
                ),
              ),
            )
          else
            ..._orders.map((o) => OrderCard(
                  order: o,
                  onTap: () async {
                    await Navigator.push(context, MaterialPageRoute(builder: (_) => OrderDetailScreen(orderId: o['_id'])));
                    _loadOrders();
                    _loadStats();
                  },
                )),
        ],
      ),
    );
  }

  Widget _filterBtn(String label, String value) {
    final active = _filter == value;
    return GestureDetector(
      onTap: () { setState(() => _filter = value); _loadOrders(); },
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
        decoration: BoxDecoration(
          color: active ? AppTheme.primary : Colors.white,
          borderRadius: BorderRadius.circular(8),
          border: Border.all(color: active ? AppTheme.primary : AppTheme.border),
        ),
        child: Text(label, style: TextStyle(fontSize: 12, fontWeight: FontWeight.w600, color: active ? Colors.white : AppTheme.textColor)),
      ),
    );
  }
}
