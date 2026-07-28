import 'dart:async';
import 'package:geolocator/geolocator.dart';
import 'api_service.dart';

class LocationService {
  static StreamSubscription<Position>? _sub;

  static Future<bool> requestPermission() async {
    bool enabled = await Geolocator.isLocationServiceEnabled();
    if (!enabled) return false;

    LocationPermission perm = await Geolocator.checkPermission();
    if (perm == LocationPermission.denied) {
      perm = await Geolocator.requestPermission();
      if (perm == LocationPermission.denied) return false;
    }
    if (perm == LocationPermission.deniedForever) return false;
    return true;
  }

  static void startTracking() {
    stopTracking();
    final settings = LocationSettings(accuracy: LocationAccuracy.high, distanceFilter: 50);
    _sub = Geolocator.getPositionStream(locationSettings: settings).listen((pos) {
      ApiService().put('/delivery/location', {'lat': pos.latitude, 'lng': pos.longitude}).catchError((_) => <String, dynamic>{});
    });
  }

  static void stopTracking() {
    _sub?.cancel();
    _sub = null;
  }
}
