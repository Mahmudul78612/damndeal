import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:shared_preferences/shared_preferences.dart';
import '../config.dart';
import 'api_service.dart';

class AuthService extends ChangeNotifier {
  final ApiService _api = ApiService();

  bool _isLoading = false;
  bool _isLoggedIn = false;
  bool _isProfileComplete = false;
  Map<String, dynamic>? _user;

  bool get isLoading => _isLoading;
  bool get isLoggedIn => _isLoggedIn;
  bool get isProfileComplete => _isProfileComplete;
  Map<String, dynamic>? get user => _user;
  String get userName => _user?['name'] ?? '';
  String get userPhone => _user?['phone'] ?? '';

  Future<void> init() async {
    final prefs = await SharedPreferences.getInstance();
    final token = prefs.getString(AppConfig.tokenKey);
    final userData = prefs.getString(AppConfig.userKey);
    if (token != null && userData != null) {
      _user = jsonDecode(userData);
      _isLoggedIn = true;
      _isProfileComplete = _user?['isProfileComplete'] ?? false;
      notifyListeners();
      // Refresh profile from server in background
      try {
        final res = await _api.get('/auth/me');
        if (res['success'] == true && res['user'] != null) {
          _user = Map<String, dynamic>.from(res['user']);
          _isProfileComplete = _user?['isProfileComplete'] ?? false;
          await prefs.setString(AppConfig.userKey, jsonEncode(_user));
          notifyListeners();
        }
      } catch (_) {}
    }
  }

  Future<Map<String, dynamic>> sendOtp(String phone) async {
    _isLoading = true;
    notifyListeners();
    try {
      final res = await _api.post('/auth/send-otp', {'phone': phone}, auth: false);
      return res;
    } finally {
      _isLoading = false;
      notifyListeners();
    }
  }

  Future<Map<String, dynamic>> verifyOtp(String phone, String otp) async {
    _isLoading = true;
    notifyListeners();
    try {
      final res = await _api.post('/auth/verify-otp', {'phone': phone, 'otp': otp}, auth: false);
      if (res['success'] == true) {
        final prefs = await SharedPreferences.getInstance();
        await prefs.setString(AppConfig.tokenKey, res['accessToken']);
        await prefs.setString(AppConfig.refreshKey, res['refreshToken']);
        _user = Map<String, dynamic>.from(res['user'] ?? {});
        _user!['isProfileComplete'] = res['isProfileComplete'] ?? false;
        await prefs.setString(AppConfig.userKey, jsonEncode(_user));
        _isLoggedIn = true;
        _isProfileComplete = res['isProfileComplete'] ?? false;
        notifyListeners();
      }
      return res;
    } finally {
      _isLoading = false;
      notifyListeners();
    }
  }

  Future<Map<String, dynamic>> completeProfile(String name, String email) async {
    _isLoading = true;
    notifyListeners();
    try {
      final res = await _api.put('/auth/complete-profile', {'name': name, 'email': email});
      if (res['success'] == true) {
        _user = Map<String, dynamic>.from(res['user'] ?? {});
        _user!['isProfileComplete'] = true;
        _isProfileComplete = true;
        final prefs = await SharedPreferences.getInstance();
        await prefs.setString(AppConfig.userKey, jsonEncode(_user));
        notifyListeners();
      }
      return res;
    } finally {
      _isLoading = false;
      notifyListeners();
    }
  }

  Future<void> logout() async {
    try {
      await _api.post('/auth/logout', {});
    } catch (_) {}
    final prefs = await SharedPreferences.getInstance();
    await prefs.remove(AppConfig.tokenKey);
    await prefs.remove(AppConfig.refreshKey);
    await prefs.remove(AppConfig.userKey);
    _isLoggedIn = false;
    _isProfileComplete = false;
    _user = null;
    notifyListeners();
  }
}
