import 'dart:io' show Platform;

import 'package:firebase_core/firebase_core.dart';
import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:flutter/foundation.dart' show kIsWeb;
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import 'app/damndeal_app.dart';

// Firebase is configured for Android only (no iOS GoogleService-Info.plist).
bool get firebaseSupported => !kIsWeb && Platform.isAndroid;

@pragma('vm:entry-point')
Future<void> _backgroundMessageHandler(RemoteMessage message) async {
  await Firebase.initializeApp(
    options: const FirebaseOptions(
      apiKey: 'AIzaSyBjEFY6BAai7HwTEShuk1tDWRSRFT5K6sU',
      appId: '1:865851260105:android:76d1e20df98d4f75f56118',
      messagingSenderId: '865851260105',
      projectId: 'damnpay',
      storageBucket: 'damnpay.firebasestorage.app',
    ),
  );
}

void main() async {
  WidgetsFlutterBinding.ensureInitialized();
  if (firebaseSupported) {
    await Firebase.initializeApp(
      options: const FirebaseOptions(
        apiKey: 'AIzaSyBjEFY6BAai7HwTEShuk1tDWRSRFT5K6sU',
        appId: '1:865851260105:android:76d1e20df98d4f75f56118',
        messagingSenderId: '865851260105',
        projectId: 'damnpay',
        storageBucket: 'damnpay.firebasestorage.app',
      ),
    );
    FirebaseMessaging.onBackgroundMessage(_backgroundMessageHandler);
  }
  SystemChrome.setEnabledSystemUIMode(SystemUiMode.edgeToEdge);
  runApp(const DamndealApp());
}
