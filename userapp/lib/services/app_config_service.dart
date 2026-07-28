import 'package:flutter/material.dart';
import 'api_service.dart';

class AppConfigService extends ChangeNotifier {
  final ApiService _api = ApiService();

  bool _loaded = false;
  Map<String, dynamic> _config = {};

  bool get loaded => _loaded;
  Map<String, dynamic> get config => _config;

  // App Control
  bool get isMaintenance => _config['app_maintenance'] == true;
  String get maintenanceMessage =>
      _config['maintenance_message']?.toString() ??
      'We\'re upgrading! Back shortly.';
  bool get isForceUpdateEnabled => _config['force_update_enabled'] == true;
  String get minVersionAndroid =>
      _config['app_min_version_android']?.toString() ?? '1.0.0';
  String get minVersionIos =>
      _config['app_min_version_ios']?.toString() ?? '1.0.0';
  String get appStoreUrl => _config['app_store_url']?.toString() ?? '';
  String get playStoreUrl => _config['play_store_url']?.toString() ?? '';

  // Branding
  Color get primaryColor => _parseColor(_config['brand_primary_color'], const Color(0xFF7C3AED));
  Color get accentColor => _parseColor(_config['brand_accent_color'], const Color(0xFFF59E0B));
  Color get ddgoColor => _parseColor(_config['ddgo_brand_color'], const Color(0xFF0D7A30));
  Color get appBarColorLight => _parseColor(_config['app_bar_color_light'], Colors.white);
  Color get appBarColorDark => _parseColor(_config['app_bar_color_dark'], const Color(0xFF1F2937));
  Color get categoryHeadingColor => _parseColor(_config['category_heading_color'], const Color(0xFF1F2937));
  Color get categoryTextColor => _parseColor(_config['category_text_color'], const Color(0xFF1F2937));
  Color get categoryBgColor => _parseColor(_config['category_bg_color'], const Color(0xFFF3E8FF));
  bool get darkModeEnabled => _config['dark_mode_enabled'] == true;

  // Features
  bool get codEnabled => _config['cod_enabled'] != false;
  bool get walletEnabled => _config['wallet_enabled'] != false;
  bool get referralEnabled => _config['referral_enabled'] == true;
  bool get newSignupEnabled => _config['new_user_signup_enabled'] != false;

  // Support
  String get supportPhone => _config['support_phone']?.toString() ?? '';
  String get supportEmail => _config['support_email']?.toString() ?? '';
  String get supportWhatsapp => _config['support_whatsapp']?.toString() ?? '';
  String get aboutUsUrl => _config['about_us_url']?.toString() ?? '';
  String get privacyPolicyUrl => _config['privacy_policy_url']?.toString() ?? '';
  String get termsUrl => _config['terms_url']?.toString() ?? '';
  String get instagramUrl => _config['instagram_url']?.toString() ?? '';

  Future<void> load() async {
    try {
      final res = await _api.get('/app-config', auth: false);
      if (res['success'] == true && res['config'] != null) {
        _config = Map<String, dynamic>.from(res['config']);
      }
    } catch (_) {
      // Silently fail — use defaults
    }
    _loaded = true;
    notifyListeners();
  }

  Color _parseColor(dynamic value, Color fallback) {
    if (value == null) return fallback;
    final hex = value.toString().replaceAll('#', '');
    if (hex.length == 6) {
      final parsed = int.tryParse('FF$hex', radix: 16);
      if (parsed != null) return Color(parsed);
    }
    return fallback;
  }

  /// Compare version strings like "1.2.3"
  /// Returns true if current < required (needs update)
  static bool needsUpdate(String currentVersion, String minVersion) {
    final current = currentVersion.split('.').map((e) => int.tryParse(e) ?? 0).toList();
    final required = minVersion.split('.').map((e) => int.tryParse(e) ?? 0).toList();

    while (current.length < 3) current.add(0);
    while (required.length < 3) required.add(0);

    for (int i = 0; i < 3; i++) {
      if (current[i] < required[i]) return true;
      if (current[i] > required[i]) return false;
    }
    return false;
  }
}
