import 'dart:convert';
import 'package:crypto/crypto.dart';
import 'package:http/http.dart' as http;
import 'models.dart';
import 'bill_pay_webview.dart';
import 'package:flutter/material.dart';

/// DamnPay SDK — Main entry point
///
/// Usage:
/// ```dart
/// // 1. Initialize
/// DamnPay.init(apiKey: 'dp_xxx', secretKey: 'dps_xxx');
///
/// // 2. Login with phone (same phone as your app)
/// await DamnPay.login(phone: '9876543210');
///
/// // 3. Open bill pay
/// DamnPay.openBillPay(context);
/// ```
class DamnPay {
  static String? _apiKey;
  static String? _secretKey;
  static String _baseUrl = 'https://damnpay-payments-865851260105.asia-south1.run.app';
  static DamnPaySession? _session;

  DamnPay._();

  /// Initialize the SDK with your partner credentials
  static void init({
    required String apiKey,
    required String secretKey,
    String? baseUrl,
  }) {
    _apiKey = apiKey;
    _secretKey = secretKey;
    if (baseUrl != null) _baseUrl = baseUrl;
  }

  /// Check if SDK is initialized
  static bool get isInitialized => _apiKey != null && _secretKey != null;

  /// Check if user is logged in with a valid session
  static bool get isLoggedIn => _session != null && !_session!.isExpired;

  /// Current session
  static DamnPaySession? get session => _session;

  /// Create HMAC-SHA256 signature: sign(secretKey, "apiKey|phone|timestamp")
  static String _createSignature(String phone, int timestamp) {
    final payload = '$_apiKey|$phone|$timestamp';
    final key = utf8.encode(_secretKey!);
    final bytes = utf8.encode(payload);
    final hmacSha256 = Hmac(sha256, key);
    final digest = hmacSha256.convert(bytes);
    return digest.toString();
  }

  /// Login with phone number — if user exists with this phone, auto-login
  /// No OTP needed — partner app is trusted via API key + HMAC signature
  static Future<DamnPaySession> login({required String phone}) async {
    if (!isInitialized) {
      throw StateError('DamnPay SDK not initialized. Call DamnPay.init() first.');
    }

    final cleanPhone = phone.replaceAll(RegExp(r'\D'), '');
    final phone10 = cleanPhone.length > 10
        ? cleanPhone.substring(cleanPhone.length - 10)
        : cleanPhone;

    if (phone10.length != 10) {
      throw ArgumentError('Invalid phone number. Must be 10 digits.');
    }

    final timestamp = DateTime.now().millisecondsSinceEpoch;
    final signature = _createSignature(phone10, timestamp);

    final response = await http.post(
      Uri.parse('$_baseUrl/sdk/auth'),
      headers: {'Content-Type': 'application/json'},
      body: jsonEncode({
        'apiKey': _apiKey,
        'signature': signature,
        'phone': phone10,
        'timestamp': timestamp.toString(),
      }),
    );

    if (response.statusCode != 200) {
      final body = jsonDecode(response.body);
      throw Exception(body['error'] ?? 'Authentication failed');
    }

    final data = jsonDecode(response.body);
    _session = DamnPaySession(
      token: data['token'],
      expiresAt: DateTime.parse(data['expiresAt']),
      user: DamnPayUser.fromJson(data['user']),
      allowedServices: List<String>.from(data['allowedServices'] ?? []),
    );

    return _session!;
  }

  /// Logout — clear the SDK session
  static void logout() {
    _session = null;
  }

  /// Get the web URL for bill pay (without opening a screen)
  static Future<String> getWebUrl() async {
    if (!isLoggedIn) {
      throw StateError('User not logged in. Call DamnPay.login() first.');
    }

    final response = await http.post(
      Uri.parse('$_baseUrl/sdk/web-token'),
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ${_session!.token}',
      },
    );

    if (response.statusCode != 200) {
      throw Exception('Failed to generate web login token');
    }

    final data = jsonDecode(response.body);
    final rawUrl = data['webUrl'] as String;
    final uri = Uri.parse(rawUrl);
    return '${uri.scheme}://${uri.host}/#${uri.path}${uri.query.isNotEmpty ? '?${uri.query}' : ''}';
  }

  /// Open the Bill Pay / All Services screen via damnpay.in WebView
  /// Gets a one-time web login token → opens damnpay.in with auto-login
  static Future<void> openBillPay(BuildContext context) async {
    if (!isLoggedIn) {
      throw StateError('User not logged in. Call DamnPay.login() first.');
    }

    // Get one-time web login token from backend
    final response = await http.post(
      Uri.parse('$_baseUrl/sdk/web-token'),
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ${_session!.token}',
      },
    );

    if (response.statusCode != 200) {
      throw Exception('Failed to generate web login token');
    }

    final data = jsonDecode(response.body);
    final rawUrl = data['webUrl'] as String;

    // damnpay.in uses hash URL strategy — convert path-based URL to hash format
    // e.g. https://damnpay.in/sdk-login?token=xxx → https://damnpay.in/#/sdk-login?token=xxx
    final uri = Uri.parse(rawUrl);
    final webUrl = '${uri.scheme}://${uri.host}/#${uri.path}${uri.query.isNotEmpty ? '?${uri.query}' : ''}';

    debugPrint('[DamnPay] Opening WebView: $webUrl');

    if (!context.mounted) return;

    Navigator.of(context).push(
      MaterialPageRoute(
        builder: (_) => DamnPayWebView(
          url: webUrl,
        ),
      ),
    );
  }

  /// Get available services for this partner
  static Future<Map<String, List<DamnPayService>>> getServices() async {
    if (!isLoggedIn) {
      throw StateError('User not logged in. Call DamnPay.login() first.');
    }

    final response = await http.get(
      Uri.parse('$_baseUrl/sdk/services'),
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ${_session!.token}',
      },
    );

    if (response.statusCode != 200) {
      throw Exception('Failed to load services');
    }

    final data = jsonDecode(response.body);
    final services = <String, List<DamnPayService>>{};
    final raw = data['services'] as Map<String, dynamic>;
    for (final entry in raw.entries) {
      services[entry.key] = (entry.value as List)
          .map((item) => DamnPayService.fromJson(item))
          .toList();
    }
    return services;
  }

  /// Make an authenticated API call (for advanced usage)
  static Future<Map<String, dynamic>> apiCall({
    required String method,
    required String path,
    Map<String, dynamic>? body,
  }) async {
    if (!isLoggedIn) {
      throw StateError('User not logged in. Call DamnPay.login() first.');
    }

    final uri = Uri.parse('$_baseUrl$path');
    final headers = {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer ${_session!.token}',
    };

    http.Response response;
    switch (method.toUpperCase()) {
      case 'GET':
        response = await http.get(uri, headers: headers);
        break;
      case 'POST':
        response = await http.post(uri, headers: headers, body: jsonEncode(body ?? {}));
        break;
      default:
        throw ArgumentError('Unsupported method: $method');
    }

    return jsonDecode(response.body) as Map<String, dynamic>;
  }
}
