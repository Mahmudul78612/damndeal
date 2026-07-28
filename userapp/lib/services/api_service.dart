import 'dart:convert';
import 'package:http/http.dart' as http;
import 'package:shared_preferences/shared_preferences.dart';
import '../config.dart';

class ApiService {
  static final ApiService _instance = ApiService._();
  factory ApiService() => _instance;
  ApiService._();

  Future<Map<String, String>> _headers({bool auth = true}) async {
    final h = <String, String>{
      'Content-Type': 'application/json',
      'x-client-type': AppConfig.clientType,
    };
    if (auth) {
      final prefs = await SharedPreferences.getInstance();
      final token = prefs.getString(AppConfig.tokenKey);
      if (token != null) h['Authorization'] = 'Bearer $token';
    }
    return h;
  }

  Future<Map<String, String>> _multipartHeaders() async {
    final h = <String, String>{
      'x-client-type': AppConfig.clientType,
    };
    final prefs = await SharedPreferences.getInstance();
    final token = prefs.getString(AppConfig.tokenKey);
    if (token != null) h['Authorization'] = 'Bearer $token';
    return h;
  }

  Future<Map<String, dynamic>> _handleResponse(http.Response res) async {
    final data = jsonDecode(res.body) as Map<String, dynamic>;

    if (res.statusCode == 401) {
      final refreshed = await _refreshToken();
      if (!refreshed) {
        throw ApiException('Session expired. Please login again.', 401);
      }
      throw ApiRetryException();
    }

    if (res.statusCode >= 400) {
      throw ApiException(
        data['message'] ?? 'Something went wrong',
        res.statusCode,
      );
    }
    return data;
  }

  Future<bool> _refreshToken() async {
    final prefs = await SharedPreferences.getInstance();
    final refreshToken = prefs.getString(AppConfig.refreshKey);
    if (refreshToken == null) return false;

    try {
      final res = await http.post(
        Uri.parse('${AppConfig.apiBase}/auth/refresh-token'),
        headers: {'Content-Type': 'application/json'},
        body: jsonEncode({'refreshToken': refreshToken}),
      );
      final data = jsonDecode(res.body);
      if (data['success'] == true && data['accessToken'] != null) {
        await prefs.setString(AppConfig.tokenKey, data['accessToken']);
        if (data['refreshToken'] != null) {
          await prefs.setString(AppConfig.refreshKey, data['refreshToken']);
        }
        return true;
      }
    } catch (_) {}
    return false;
  }

  Future<Map<String, dynamic>> get(String endpoint, {bool auth = true, Map<String, String>? query}) async {
    final uri = Uri.parse('${AppConfig.apiBase}$endpoint').replace(queryParameters: query);
    try {
      final res = await http.get(uri, headers: await _headers(auth: auth));
      return await _handleResponse(res);
    } on ApiRetryException {
      final res = await http.get(uri, headers: await _headers(auth: auth));
      return await _handleResponse(res);
    }
  }

  Future<Map<String, dynamic>> post(String endpoint, Map<String, dynamic> body, {bool auth = true}) async {
    final uri = Uri.parse('${AppConfig.apiBase}$endpoint');
    try {
      final res = await http.post(uri, headers: await _headers(auth: auth), body: jsonEncode(body));
      return await _handleResponse(res);
    } on ApiRetryException {
      final res = await http.post(uri, headers: await _headers(auth: auth), body: jsonEncode(body));
      return await _handleResponse(res);
    }
  }

  Future<Map<String, dynamic>> put(String endpoint, Map<String, dynamic> body, {bool auth = true}) async {
    final uri = Uri.parse('${AppConfig.apiBase}$endpoint');
    try {
      final res = await http.put(uri, headers: await _headers(auth: auth), body: jsonEncode(body));
      return await _handleResponse(res);
    } on ApiRetryException {
      final res = await http.put(uri, headers: await _headers(auth: auth), body: jsonEncode(body));
      return await _handleResponse(res);
    }
  }

  Future<Map<String, dynamic>> delete(String endpoint, {bool auth = true}) async {
    final uri = Uri.parse('${AppConfig.apiBase}$endpoint');
    try {
      final res = await http.delete(uri, headers: await _headers(auth: auth));
      return await _handleResponse(res);
    } on ApiRetryException {
      final res = await http.delete(uri, headers: await _headers(auth: auth));
      return await _handleResponse(res);
    }
  }

  // ───────────────────────────────────────────────
  //  Stale-while-revalidate GET cache
  // ───────────────────────────────────────────────
  // In-memory cache (fast, survives within process lifetime).
  static final Map<String, _CacheEntry> _memCache = {};
  // De-dupe inflight identical requests so 5 widgets asking the same
  // endpoint at the same moment make 1 network call.
  static final Map<String, Future<Map<String, dynamic>>> _inflight = {};

  /// Returns a cached payload (if not expired) and concurrently triggers a
  /// background refresh when the cache is older than [staleAfter]. The
  /// optional [onUpdate] callback is invoked with the fresh response after
  /// the background refresh completes.
  ///
  /// If no usable cache exists, performs a normal network fetch.
  Future<Map<String, dynamic>> getCached(
    String endpoint, {
    Duration ttl = const Duration(minutes: 10),
    Duration staleAfter = const Duration(minutes: 1),
    bool auth = true,
    Map<String, String>? query,
    void Function(Map<String, dynamic> fresh)? onUpdate,
  }) async {
    final key = '$endpoint?${query == null ? '' : query.entries.map((e) => '${e.key}=${e.value}').join('&')}';

    // 1. Memory cache — instant
    final mem = _memCache[key];
    if (mem != null && !mem.isExpired(ttl)) {
      if (mem.isStale(staleAfter)) {
        _backgroundRefresh(key, endpoint, auth, query, onUpdate);
      }
      return mem.data;
    }

    // 2. Disk cache (SharedPreferences)
    final prefs = await SharedPreferences.getInstance();
    final raw = prefs.getString('cache:$key');
    final ts = prefs.getInt('cache_ts:$key') ?? 0;
    final age = DateTime.now().millisecondsSinceEpoch - ts;
    if (raw != null && age < ttl.inMilliseconds) {
      try {
        final data = jsonDecode(raw) as Map<String, dynamic>;
        _memCache[key] = _CacheEntry(data, ts);
        if (age > staleAfter.inMilliseconds) {
          _backgroundRefresh(key, endpoint, auth, query, onUpdate);
        }
        return data;
      } catch (_) {/* fall through to network */}
    }

    // 3. Network fetch (de-duped)
    return _fetchAndCache(key, endpoint, auth, query);
  }

  void _backgroundRefresh(
    String key,
    String endpoint,
    bool auth,
    Map<String, String>? query,
    void Function(Map<String, dynamic>)? onUpdate,
  ) {
    if (_inflight.containsKey(key)) return;
    _fetchAndCache(key, endpoint, auth, query).then((fresh) {
      if (onUpdate != null) onUpdate(fresh);
    }).catchError((_) {});
  }

  Future<Map<String, dynamic>> _fetchAndCache(
    String key,
    String endpoint,
    bool auth,
    Map<String, String>? query,
  ) {
    final existing = _inflight[key];
    if (existing != null) return existing;
    final fut = () async {
      try {
        final data = await get(endpoint, auth: auth, query: query);
        _memCache[key] = _CacheEntry(data, DateTime.now().millisecondsSinceEpoch);
        try {
          final prefs = await SharedPreferences.getInstance();
          await prefs.setString('cache:$key', jsonEncode(data));
          await prefs.setInt('cache_ts:$key', DateTime.now().millisecondsSinceEpoch);
        } catch (_) {}
        return data;
      } finally {
        _inflight.remove(key);
      }
    }();
    _inflight[key] = fut;
    return fut;
  }
}

class _CacheEntry {
  final Map<String, dynamic> data;
  final int ts;
  _CacheEntry(this.data, this.ts);
  bool isExpired(Duration ttl) =>
      DateTime.now().millisecondsSinceEpoch - ts > ttl.inMilliseconds;
  bool isStale(Duration staleAfter) =>
      DateTime.now().millisecondsSinceEpoch - ts > staleAfter.inMilliseconds;
}

class ApiException implements Exception {
  final String message;
  final int statusCode;
  ApiException(this.message, this.statusCode);

  @override
  String toString() => message;
}

class ApiRetryException implements Exception {}
