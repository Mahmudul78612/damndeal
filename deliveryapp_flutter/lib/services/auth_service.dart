import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:shared_preferences/shared_preferences.dart';
import '../config.dart';
import 'api_service.dart';

class AuthService extends ChangeNotifier {
  final _api = ApiService();
  Map<String, dynamic>? _user;
  bool _isLoggedIn = false;

  Map<String, dynamic>? get user => _user;
  bool get isLoggedIn => _isLoggedIn;

  Future<void> init() async {
    final prefs = await SharedPreferences.getInstance();
    final token = prefs.getString(AppConfig.tokenKey);
    final userStr = prefs.getString(AppConfig.userKey);
    if (token != null && userStr != null) {
      _user = jsonDecode(userStr);
      if (_user?['role'] == 'delivery') {
        _isLoggedIn = true;
      }
    }
    notifyListeners();
  }

  Future<void> sendOtp(String phone) async {
    await _api.post('/auth/send-otp', {'phone': '+91$phone'});
  }

  Future<Map<String, dynamic>> verifyOtp(String phone, String otp) async {
    final data = await _api.post('/auth/verify-otp', {'phone': '+91$phone', 'otp': otp});
    await _saveAuth(data);
    return data;
  }

  Future<void> completeProfile(String name, String? email) async {
    final body = <String, dynamic>{'name': name};
    if (email != null && email.isNotEmpty) body['email'] = email;
    await _api.put('/auth/complete-profile', body);
  }

  Future<void> _saveAuth(Map<String, dynamic> data) async {
    final prefs = await SharedPreferences.getInstance();
    if (data['accessToken'] != null) await prefs.setString(AppConfig.tokenKey, data['accessToken']);
    if (data['refreshToken'] != null) await prefs.setString(AppConfig.refreshKey, data['refreshToken']);
    if (data['user'] != null) {
      await prefs.setString(AppConfig.userKey, jsonEncode(data['user']));
      _user = data['user'];
    }
    _isLoggedIn = true;
    notifyListeners();
  }

  Future<void> refreshUser() async {
    try {
      final data = await _api.get('/auth/me');
      if (data['user'] != null) {
        final prefs = await SharedPreferences.getInstance();
        await prefs.setString(AppConfig.userKey, jsonEncode(data['user']));
        _user = data['user'];
        notifyListeners();
      }
    } catch (_) {}
  }

  Future<void> logout() async {
    try {
      await _api.post('/auth/logout');
    } catch (_) {}
    final prefs = await SharedPreferences.getInstance();
    await prefs.remove(AppConfig.tokenKey);
    await prefs.remove(AppConfig.refreshKey);
    await prefs.remove(AppConfig.userKey);
    await prefs.remove(AppConfig.profileKey);
    _user = null;
    _isLoggedIn = false;
    notifyListeners();
  }

  bool get isNewUser => _user?['name'] == null || _user?['isNewUser'] == true;
}
