import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import 'app/damndeal_app.dart';

void main() async {
  WidgetsFlutterBinding.ensureInitialized();
  SystemChrome.setEnabledSystemUIMode(SystemUiMode.edgeToEdge);
  runApp(const DamndealApp());
}
