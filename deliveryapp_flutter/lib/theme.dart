import 'package:flutter/material.dart';

class AppTheme {
  static const Color primary = Color(0xFF5B2D8E);
  static const Color primaryLight = Color(0xFF7B4DB5);
  static const Color primaryDark = Color(0xFF3E1A6E);
  static const Color primaryBg = Color(0xFFF3EEFA);
  static const Color accent = Color(0xFFF59E0B);
  static const Color bg = Color(0xFFF5F6FA);
  static const Color textColor = Color(0xFF2D2D3A);
  static const Color textLight = Color(0xFF6B7280);
  static const Color border = Color(0xFFE5E7EB);
  static const Color success = Color(0xFF10B981);
  static const Color successBg = Color(0xFFD1FAE5);
  static const Color danger = Color(0xFFEF4444);
  static const Color dangerBg = Color(0xFFFEE2E2);
  static const Color warning = Color(0xFFF59E0B);
  static const Color warningBg = Color(0xFFFEF3C7);
  static const Color info = Color(0xFF3B82F6);
  static const Color infoBg = Color(0xFFDBEAFE);

  static ThemeData get theme => ThemeData(
        fontFamily: 'Inter',
        primaryColor: primary,
        scaffoldBackgroundColor: bg,
        colorScheme: ColorScheme.fromSeed(
          seedColor: primary,
          primary: primary,
          secondary: accent,
          surface: Colors.white,
        ),
        appBarTheme: const AppBarTheme(
          backgroundColor: primaryDark,
          foregroundColor: Colors.white,
          elevation: 2,
          centerTitle: false,
          titleTextStyle: TextStyle(
            fontFamily: 'Inter',
            fontSize: 17,
            fontWeight: FontWeight.w700,
            color: Colors.white,
          ),
        ),
        elevatedButtonTheme: ElevatedButtonThemeData(
          style: ElevatedButton.styleFrom(
            backgroundColor: primary,
            foregroundColor: Colors.white,
            padding: const EdgeInsets.symmetric(vertical: 14),
            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
            textStyle: const TextStyle(fontSize: 15, fontWeight: FontWeight.w600),
          ),
        ),
        outlinedButtonTheme: OutlinedButtonThemeData(
          style: OutlinedButton.styleFrom(
            foregroundColor: textColor,
            side: const BorderSide(color: border),
            padding: const EdgeInsets.symmetric(vertical: 14),
            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
          ),
        ),
        inputDecorationTheme: InputDecorationTheme(
          filled: true,
          fillColor: Colors.white,
          contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
          border: OutlineInputBorder(
            borderRadius: BorderRadius.circular(10),
            borderSide: const BorderSide(color: border),
          ),
          enabledBorder: OutlineInputBorder(
            borderRadius: BorderRadius.circular(10),
            borderSide: const BorderSide(color: border),
          ),
          focusedBorder: OutlineInputBorder(
            borderRadius: BorderRadius.circular(10),
            borderSide: const BorderSide(color: primary, width: 1.5),
          ),
          labelStyle: const TextStyle(fontSize: 13, color: textLight),
          hintStyle: const TextStyle(fontSize: 14, color: textLight),
        ),
        cardTheme: CardThemeData(
          color: Colors.white,
          elevation: 1,
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(12),
            side: const BorderSide(color: border, width: 0.5),
          ),
          margin: const EdgeInsets.only(bottom: 12),
        ),
      );

  // Badge helper
  static Color statusColor(String status) {
    switch (status) {
      case 'assigned':
        return info;
      case 'picked_up':
        return warning;
      case 'on_the_way':
        return primary;
      case 'delivered':
        return success;
      case 'failed':
        return danger;
      default:
        return textLight;
    }
  }

  static Color statusBgColor(String status) {
    switch (status) {
      case 'assigned':
        return infoBg;
      case 'picked_up':
        return warningBg;
      case 'on_the_way':
        return primaryBg;
      case 'delivered':
        return successBg;
      case 'failed':
        return dangerBg;
      default:
        return const Color(0xFFF3F4F6);
    }
  }
}
