import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:provider/provider.dart';
import 'theme.dart';
import 'services/auth_service.dart';
import 'screens/login_screen.dart';
import 'screens/home_screen.dart';

void main() {
  WidgetsFlutterBinding.ensureInitialized();
  SystemChrome.setPreferredOrientations([DeviceOrientation.portraitUp]);
  SystemChrome.setSystemUIOverlayStyle(const SystemUiOverlayStyle(
    statusBarColor: AppTheme.primaryDark,
    statusBarIconBrightness: Brightness.light,
  ));
  runApp(const DamnDealDeliveryApp());
}

class DamnDealDeliveryApp extends StatelessWidget {
  const DamnDealDeliveryApp({super.key});

  @override
  Widget build(BuildContext context) {
    return ChangeNotifierProvider(
      create: (_) => AuthService()..init(),
      child: MaterialApp(
        title: 'DamnDeal Delivery',
        debugShowCheckedModeBanner: false,
        theme: AppTheme.theme,
        home: Consumer<AuthService>(
          builder: (context, auth, _) {
            if (auth.isLoggedIn) return const HomeScreen();
            return const LoginScreen();
          },
        ),
      ),
    );
  }
}
