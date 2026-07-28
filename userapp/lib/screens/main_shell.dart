import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:badges/badges.dart' as badges;
import '../services/cart_service.dart';
import '../theme/app_theme.dart';
import 'home/home_screen.dart';
import 'category/category_screen.dart';
import 'magic/magic_screen.dart';
import 'billpay/billpay_screen.dart';
import 'account/account_screen.dart';

class MainShell extends StatefulWidget {
  const MainShell({super.key});

  @override
  State<MainShell> createState() => _MainShellState();
}

class _MainShellState extends State<MainShell> {
  int _currentIndex = 0;
  final Set<int> _visited = {0};

  Widget _pageFor(int i) {
    switch (i) {
      case 0:
        return const HomeScreen();
      case 1:
        return const CategoryScreen();
      case 2:
        return const MagicScreen();
      case 3:
        return const BillPayScreen();
      case 4:
      default:
        return const AccountScreen();
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: IndexedStack(
        index: _currentIndex,
        children: List.generate(5, (i) {
          // Lazily build each tab the first time it's visited so that
          // BillPay's DamnPay SDK doesn't auto-open on app launch.
          if (!_visited.contains(i)) return const SizedBox.shrink();
          return _pageFor(i);
        }),
      ),
      bottomNavigationBar: BottomNavigationBar(
        currentIndex: _currentIndex,
        onTap: (i) => setState(() {
          _currentIndex = i;
          _visited.add(i);
        }),
        type: BottomNavigationBarType.fixed,
        selectedItemColor: AppColors.primary,
        unselectedItemColor: AppColors.textMuted,
        showUnselectedLabels: true,
        items: const [
          BottomNavigationBarItem(icon: Icon(Icons.home_rounded), label: 'Home'),
          BottomNavigationBarItem(icon: Icon(Icons.grid_view_rounded), label: 'Categories'),
          BottomNavigationBarItem(icon: Icon(Icons.auto_awesome_rounded), label: 'Magic'),
          BottomNavigationBarItem(icon: Icon(Icons.receipt_long_rounded), label: 'Bill Pay'),
          BottomNavigationBarItem(icon: Icon(Icons.person_outline_rounded), label: 'Account'),
        ],
      ),
    );
  }
}

/// Reusable cart icon for AppBar — used by Home/Category/etc.
class AppBarCartAction extends StatelessWidget {
  final Color? color;
  const AppBarCartAction({super.key, this.color});

  @override
  Widget build(BuildContext context) {
    final count = context.watch<CartService>().itemCount;
    return IconButton(
      tooltip: 'Cart',
      onPressed: () => Navigator.pushNamed(context, '/cart'),
      icon: count > 0
          ? badges.Badge(
              badgeContent: Text('$count',
                  style: const TextStyle(color: Colors.white, fontSize: 10)),
              badgeStyle: const badges.BadgeStyle(badgeColor: AppColors.primary),
              child: Icon(Icons.shopping_cart_outlined, color: color),
            )
          : Icon(Icons.shopping_cart_outlined, color: color),
    );
  }
}
