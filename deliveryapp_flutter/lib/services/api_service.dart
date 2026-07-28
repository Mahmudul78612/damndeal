import 'dart:convert';
import 'package:http/http.dart' as http;
import 'package:shared_preferences/shared_preferences.dart';
import '../config.dart';

class ApiService {
  static final ApiService _instance = ApiService._();
  factory ApiService() => _instance;
  ApiService._();

  Future<String?> get _token async {
    final prefs = await SharedPreferences.getInstance();
    return prefs.getString(AppConfig.tokenKey);
  }

  Future<String?> get _refreshToken async {
    final prefs = await SharedPreferences.getInstance();
    return prefs.getString(AppConfig.refreshKey);
  }

  Map<String, String> _headers(String? token, {bool isJson = true}) {
    final h = <String, String>{
      'x-client-type': AppConfig.clientType,
    };
    if (token != null) h['Authorization'] = 'Bearer $token';
    if (isJson) h['Content-Type'] = 'application/json';
    return h;
  }

  Future<Map<String, dynamic>> get(String endpoint) async {
    return _request('GET', endpoint);
  }

  Future<Map<String, dynamic>> post(String endpoint, [Map<String, dynamic>? body]) async {
    return _request('POST', endpoint, body: body);
  }

  Future<Map<String, dynamic>> put(String endpoint, [Map<String, dynamic>? body]) async {
    return _request('PUT', endpoint, body: body);
  }

  Future<Map<String, dynamic>> delete(String endpoint) async {
    return _request('DELETE', endpoint);
  }

  Future<Map<String, dynamic>> upload(String endpoint, Map<String, String> fields, {String? filePath, String fileField = 'photo'}) async {
    final token = await _token;
    final uri = Uri.parse('${AppConfig.apiBase}$endpoint');
    final req = http.MultipartRequest('POST', uri);
    req.headers.addAll(_headers(token, isJson: false));
    req.fields.addAll(fields);
    if (filePath != null) {
      req.files.add(await http.MultipartFile.fromPath(fileField, filePath));
    }

    final streamedRes = await req.send();
    final res = await http.Response.fromStream(streamedRes);

    if (res.statusCode == 401) {
      final refreshed = await _tryRefresh();
      if (refreshed) {
        final newToken = await _token;
        req.headers['Authorization'] = 'Bearer $newToken';
        final retryRes = await req.send();
        final retryBody = await http.Response.fromStream(retryRes);
        return _parseResponse(retryBody);
      }
      throw ApiException('Session expired');
    }
    return _parseResponse(res);
  }

  Future<Map<String, dynamic>> _request(String method, String endpoint, {Map<String, dynamic>? body}) async {
    final token = await _token;
    final uri = Uri.parse('${AppConfig.apiBase}$endpoint');
    http.Response res;

    switch (method) {
      case 'POST':
        res = await http.post(uri, headers: _headers(token), body: body != null ? jsonEncode(body) : null);
        break;
      case 'PUT':
        res = await http.put(uri, headers: _headers(token), body: body != null ? jsonEncode(body) : null);
        break;
      case 'DELETE':
        res = await http.delete(uri, headers: _headers(token));
        break;
      default:
        res = await http.get(uri, headers: _headers(token));
    }

    if (res.statusCode == 401) {
      final refreshed = await _tryRefresh();
      if (refreshed) return _request(method, endpoint, body: body);
      throw ApiException('Session expired');
    }

    return _parseResponse(res);
  }

  Map<String, dynamic> _parseResponse(http.Response res) {
    final data = jsonDecode(res.body);
    if (res.statusCode >= 400) {
      throw ApiException(data['message'] ?? 'Request failed');
    }
    return data is Map<String, dynamic> ? data : {'data': data};
  }

  Future<bool> _tryRefresh() async {
    final rt = await _refreshToken;
    if (rt == null) return false;
    try {
      final res = await http.post(
        Uri.parse('${AppConfig.apiBase}/auth/refresh-token'),
        headers: {'Content-Type': 'application/json'},
        body: jsonEncode({'refreshToken': rt}),
      );
      if (res.statusCode != 200) return false;
      final data = jsonDecode(res.body);
      final prefs = await SharedPreferences.getInstance();
      if (data['accessToken'] != null) await prefs.setString(AppConfig.tokenKey, data['accessToken']);
      if (data['refreshToken'] != null) await prefs.setString(AppConfig.refreshKey, data['refreshToken']);
      return true;
    } catch (_) {
      return false;
    }
  }
}

class ApiException implements Exception {
  final String message;
  ApiException(this.message);
  @override
  String toString() => message;
}
