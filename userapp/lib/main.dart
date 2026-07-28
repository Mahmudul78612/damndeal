import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:damnpay_sdk/damnpay_sdk.dart';
import 'config/secrets.dart';

import 'theme/app_theme.dart';
import 'services/auth_service.dart';
import 'services/cart_service.dart';
import 'services/app_config_service.dart';

import 'screens/splash/splash_screen.dart';
import 'screens/maintenance/maintenance_screen.dart';
import 'screens/force_update/force_update_screen.dart';
import 'screens/auth/onboarding_screen.dart';
import 'screens/auth/login_screen.dart';
import 'screens/auth/otp_screen.dart';
import 'screens/auth/complete_profile_screen.dart';
import 'screens/main_shell.dart';
import 'screens/subcategory/subcategory_screen.dart';
import 'screens/products/products_screen.dart';
import 'screens/products/product_detail_screen.dart';
import 'screens/search/search_screen.dart';
import 'screens/cart/cart_screen.dart';
import 'screens/checkout/checkout_screen.dart';
import 'screens/checkout/order_success_screen.dart';
import 'screens/checkout/order_failed_screen.dart';
import 'screens/tracking/tracking_screen.dart';
import 'screens/orders/orders_screen.dart';
import 'screens/wallet/wallet_screen.dart';
import 'screens/address/add_address_screen.dart';
import 'screens/settings/settings_screen.dart';
import 'screens/account/account_screen.dart';
import 'screens/magic_club/magic_club_screen.dart';
import 'screens/magic_club/magic_club_all_screen.dart';
import 'screens/magic_pools/magic_pools_screen.dart';
import 'screens/magic_pools/magic_pool_detail_screen.dart';
import 'screens/magic_pools/magic_pools_mine_screen.dart';
import 'screens/returns/returns_screen.dart';
import 'screens/returns/returns_new_screen.dart';
import 'screens/legal/legal_screen.dart';

void main() {
  WidgetsFlutterBinding.ensureInitialized();
  DamnPay.init(
    apiKey: damnPayApiKey,
    secretKey: damnPaySecretKey,
  );
  runApp(const DamnDealApp());
}

class DamnDealApp extends StatelessWidget {
  const DamnDealApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MultiProvider(
      providers: [
        ChangeNotifierProvider(create: (_) => AuthService()..init()),
        ChangeNotifierProvider(create: (_) => CartService()),
        ChangeNotifierProvider(create: (_) => AppConfigService()),
      ],
      child: MaterialApp(
        title: 'DamnDeal',
        debugShowCheckedModeBanner: false,
        theme: AppTheme.lightTheme,
        initialRoute: '/',
        routes: {
          '/': (_) => const SplashScreen(),
          '/onboarding': (_) => const OnboardingScreen(),
          '/login': (_) => const LoginScreen(),
          '/otp': (_) => const OtpScreen(),
          '/complete-profile': (_) => const CompleteProfileScreen(),
          '/main': (_) => const MainShell(),
          '/subcategory': (_) => const SubCategoryScreen(),
          '/products': (_) => const ProductsScreen(),
          '/product': (_) => const ProductDetailScreen(),
          '/search': (_) => const SearchScreen(),
          '/cart': (_) => const CartScreen(),
          '/checkout': (_) => const CheckoutScreen(),
          '/order-success': (_) => const OrderSuccessScreen(),
          '/order-failed': (_) => const OrderFailedScreen(),
          '/tracking': (_) => const TrackingScreen(),
          '/orders': (_) => const OrdersScreen(),
          '/wallet': (_) => const WalletScreen(),
          '/add-address': (_) => const AddAddressScreen(),
          '/settings': (_) => const SettingsScreen(),
          '/account': (_) => const AccountScreen(),
          '/magic-club': (_) => const MagicClubScreen(),
          '/magic-club/all': (_) => const MagicClubAllScreen(),
          '/magic-pools': (_) => const MagicPoolsScreen(),
          '/magic-pools/detail': (_) => const MagicPoolDetailScreen(),
          '/magic-pools/mine': (_) => const MagicPoolsMineScreen(),
          '/returns': (_) => const ReturnsScreen(),
          '/returns/new': (_) => const ReturnsNewScreen(),
          '/legal': (_) => const LegalScreen(),
          '/maintenance': (_) => const MaintenanceScreen(),
          '/force-update': (_) => const ForceUpdateScreen(),
        },
      ),
    );
  }
}
