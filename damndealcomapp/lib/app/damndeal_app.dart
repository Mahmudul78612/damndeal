import 'package:flutter/material.dart';

import '../web/web_app_screen.dart';

class DamndealApp extends StatelessWidget {
  const DamndealApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'Damndeal',
      debugShowCheckedModeBanner: false,
      theme: ThemeData(useMaterial3: true),
      home: const WebAppScreen(),
    );
  }
}
