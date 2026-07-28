import 'package:flutter/material.dart';
import 'package:geolocator/geolocator.dart';
import 'package:geocoding/geocoding.dart';
import '../../services/api_service.dart';
import '../../theme/app_theme.dart';

class AddAddressScreen extends StatefulWidget {
  const AddAddressScreen({super.key});

  @override
  State<AddAddressScreen> createState() => _AddAddressScreenState();
}

class _AddAddressScreenState extends State<AddAddressScreen> {
  final _api = ApiService();
  final _labelCtrl = TextEditingController();
  final _addressCtrl = TextEditingController();
  final _houseCtrl = TextEditingController();
  final _cityCtrl = TextEditingController();
  final _stateCtrl = TextEditingController();
  final _pincodeCtrl = TextEditingController();
  final _landmarkCtrl = TextEditingController();
  bool _isDefault = false;
  bool _saving = false;
  bool _fetchingLocation = false;
  String? _error;
  double _lat = 0.0;
  double _lng = 0.0;
  String _selectedLabel = 'Home';

  final _labels = ['Home', 'Office', 'Other'];

  @override
  void initState() {
    super.initState();
    _labelCtrl.text = 'Home';
    _fetchCurrentLocation();
  }

  @override
  void dispose() {
    _labelCtrl.dispose();
    _addressCtrl.dispose();
    _houseCtrl.dispose();
    _cityCtrl.dispose();
    _stateCtrl.dispose();
    _pincodeCtrl.dispose();
    _landmarkCtrl.dispose();
    super.dispose();
  }

  Future<void> _fetchCurrentLocation() async {
    setState(() { _fetchingLocation = true; _error = null; });
    try {
      bool serviceEnabled = await Geolocator.isLocationServiceEnabled();
      if (!serviceEnabled) {
        if (mounted) {
          setState(() {
            _fetchingLocation = false;
            _error = 'Location services are disabled. Please enable GPS.';
          });
          await showDialog(
            context: context,
            builder: (ctx) => AlertDialog(
              title: const Text('Location Required'),
              content: const Text('Please enable location services (GPS) to continue.'),
              actions: [
                TextButton(onPressed: () => Navigator.pop(ctx), child: const Text('Cancel')),
                TextButton(
                  onPressed: () { Navigator.pop(ctx); Geolocator.openLocationSettings(); },
                  child: const Text('Open Settings'),
                ),
              ],
            ),
          );
        }
        return;
      }

      LocationPermission perm = await Geolocator.checkPermission();
      if (perm == LocationPermission.denied) {
        perm = await Geolocator.requestPermission();
      }
      if (perm == LocationPermission.deniedForever) {
        if (mounted) {
          setState(() {
            _fetchingLocation = false;
            _error = 'Location permission permanently denied. Please allow from app settings.';
          });
          await showDialog(
            context: context,
            builder: (ctx) => AlertDialog(
              title: const Text('Location Permission Required'),
              content: const Text('Location permission is permanently denied. Please enable it from app settings.'),
              actions: [
                TextButton(onPressed: () => Navigator.pop(ctx), child: const Text('Cancel')),
                TextButton(
                  onPressed: () { Navigator.pop(ctx); Geolocator.openAppSettings(); },
                  child: const Text('Open Settings'),
                ),
              ],
            ),
          );
        }
        return;
      }
      if (perm == LocationPermission.denied) {
        setState(() {
          _fetchingLocation = false;
          _error = 'Location permission denied. Tap "Use current location" to try again.';
        });
        return;
      }

      final pos = await Geolocator.getCurrentPosition(
        locationSettings: const LocationSettings(accuracy: LocationAccuracy.high),
      );
      _lat = pos.latitude;
      _lng = pos.longitude;

      final placemarks = await placemarkFromCoordinates(pos.latitude, pos.longitude);
      if (placemarks.isNotEmpty) {
        final p = placemarks.first;
        final parts = <String>[
          if (p.street != null && p.street!.isNotEmpty) p.street!,
          if (p.subLocality != null && p.subLocality!.isNotEmpty) p.subLocality!,
          if (p.locality != null && p.locality!.isNotEmpty) p.locality!,
        ];
        _addressCtrl.text = parts.join(', ');
        _cityCtrl.text = p.locality ?? '';
        _stateCtrl.text = p.administrativeArea ?? '';
        _pincodeCtrl.text = p.postalCode ?? '';
      }
    } catch (e) {
      if (mounted) {
        setState(() => _error = 'Failed to get location: ${e.toString()}');
      }
    }
    if (mounted) setState(() => _fetchingLocation = false);
  }

  Future<void> _save() async {
    if (_addressCtrl.text.trim().isEmpty ||
        _cityCtrl.text.trim().isEmpty || _pincodeCtrl.text.trim().isEmpty) {
      setState(() => _error = 'Please fill all required fields');
      return;
    }

    // Location is compulsory — lat/lng must be captured
    if (_lat == 0.0 && _lng == 0.0) {
      setState(() => _error = 'Current location is required. Please tap "Use current location" and allow GPS access.');
      return;
    }

    setState(() { _saving = true; _error = null; });
    try {
      final fullAddress = [
        if (_houseCtrl.text.trim().isNotEmpty) _houseCtrl.text.trim(),
        _addressCtrl.text.trim(),
      ].join(', ');

      // Map UI labels to backend enum values
      String apiLabel;
      if (_selectedLabel == 'Home') {
        apiLabel = 'home';
      } else if (_selectedLabel == 'Office') {
        apiLabel = 'work';
      } else {
        apiLabel = 'other';
      }

      await _api.post('/user/addresses', {
        'label': apiLabel,
        'address': fullAddress,
        'houseNo': _houseCtrl.text.trim(),
        'city': _cityCtrl.text.trim(),
        'state': _stateCtrl.text.trim(),
        'pincode': _pincodeCtrl.text.trim(),
        'landmark': _landmarkCtrl.text.trim(),
        'lat': _lat,
        'lng': _lng,
        'isDefault': _isDefault,
      });
      if (mounted) Navigator.pop(context, true);
    } catch (e) {
      setState(() => _error = e.toString());
    }
    if (mounted) setState(() => _saving = false);
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Add Address')),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // GPS Location fetch bar
            GestureDetector(
              onTap: _fetchingLocation ? null : _fetchCurrentLocation,
              child: Container(
                padding: const EdgeInsets.all(14),
                decoration: BoxDecoration(
                  color: AppColors.primaryLight,
                  borderRadius: BorderRadius.circular(12),
                  border: Border.all(color: AppColors.primary.withValues(alpha: 0.3)),
                ),
                child: Row(
                  children: [
                    Icon(
                      _fetchingLocation ? Icons.gps_not_fixed : Icons.my_location_rounded,
                      color: AppColors.primary,
                      size: 22,
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            _fetchingLocation ? 'Fetching your location...' : 'Use current location',
                            style: const TextStyle(fontWeight: FontWeight.w600, color: AppColors.primary, fontSize: 14),
                          ),
                          if (!_fetchingLocation && _addressCtrl.text.isNotEmpty)
                            Text(
                              _addressCtrl.text,
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis,
                              style: const TextStyle(fontSize: 12, color: AppColors.textSecondary),
                            ),
                          if (!_fetchingLocation && _lat != 0.0 && _lng != 0.0)
                            const Text(
                              '✅ Location captured',
                              style: TextStyle(fontSize: 11, color: Colors.green, fontWeight: FontWeight.w500),
                            ),
                        ],
                      ),
                    ),
                    if (_fetchingLocation)
                      const SizedBox(
                        width: 18,
                        height: 18,
                        child: CircularProgressIndicator(strokeWidth: 2, color: AppColors.primary),
                      ),
                  ],
                ),
              ),
            ),
            const SizedBox(height: 20),

            // House No / Flat / Floor
            _field('House No / Flat / Floor *', _houseCtrl, hint: 'e.g. B-204, 2nd Floor'),
            _field('Street / Area *', _addressCtrl, hint: 'Full street address', maxLines: 2),
            _field('Landmark', _landmarkCtrl, hint: 'Near temple, park, etc.'),
            Row(
              children: [
                Expanded(child: _field('City *', _cityCtrl)),
                const SizedBox(width: 12),
                Expanded(child: _field('State', _stateCtrl)),
              ],
            ),
            _field('Pincode *', _pincodeCtrl, keyboard: TextInputType.number),

            // Label chips
            const Text('Save as', style: TextStyle(fontSize: 14, fontWeight: FontWeight.w600)),
            const SizedBox(height: 8),
            Row(
              children: _labels.map((label) {
                final selected = _selectedLabel == label;
                final icon = label == 'Home'
                    ? Icons.home_rounded
                    : label == 'Office'
                        ? Icons.work_rounded
                        : Icons.location_on_rounded;
                return Padding(
                  padding: const EdgeInsets.only(right: 10),
                  child: ChoiceChip(
                    label: Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Icon(icon, size: 16, color: selected ? Colors.white : AppColors.textSecondary),
                        const SizedBox(width: 6),
                        Text(label),
                      ],
                    ),
                    selected: selected,
                    onSelected: (_) => setState(() {
                      _selectedLabel = label;
                      if (label != 'Other') _labelCtrl.text = label;
                    }),
                    selectedColor: AppColors.primary,
                    labelStyle: TextStyle(
                      color: selected ? Colors.white : AppColors.textPrimary,
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                );
              }).toList(),
            ),
            if (_selectedLabel == 'Other') ...[
              const SizedBox(height: 12),
              _field('Custom label', _labelCtrl, hint: "e.g. Mom's house"),
            ],
            const SizedBox(height: 8),

            SwitchListTile(
              title: const Text('Set as default address', style: TextStyle(fontSize: 14)),
              value: _isDefault,
              onChanged: (v) => setState(() => _isDefault = v),
              activeColor: AppColors.primary,
              contentPadding: EdgeInsets.zero,
            ),
            if (_error != null) ...[
              const SizedBox(height: 8),
              Text(_error!, style: const TextStyle(color: AppColors.error, fontSize: 13)),
            ],
            const SizedBox(height: 20),
            SizedBox(
              width: double.infinity,
              child: ElevatedButton(
                onPressed: _saving ? null : _save,
                child: _saving
                    ? const SizedBox(height: 20, width: 20, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white))
                    : const Text('Save Address'),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _field(String label, TextEditingController ctrl, {String? hint, int maxLines = 1, TextInputType? keyboard}) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(label, style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w600)),
          const SizedBox(height: 6),
          TextField(
            controller: ctrl,
            maxLines: maxLines,
            keyboardType: keyboard,
            decoration: InputDecoration(hintText: hint),
          ),
        ],
      ),
    );
  }
}
