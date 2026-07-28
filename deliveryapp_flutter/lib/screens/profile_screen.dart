import 'package:flutter/material.dart';
import 'package:image_picker/image_picker.dart';
import 'package:provider/provider.dart';
import 'dart:io';
import '../theme.dart';
import '../config.dart';
import '../services/api_service.dart';
import '../services/auth_service.dart';
import '../services/location_service.dart';
import '../widgets/permission_dialog.dart';
import 'login_screen.dart';

class ProfileScreen extends StatefulWidget {
  const ProfileScreen({super.key});
  @override
  State<ProfileScreen> createState() => _ProfileScreenState();
}

class _ProfileScreenState extends State<ProfileScreen> {
  final _api = ApiService();
  Map<String, dynamic>? _profile;
  bool _loading = true;
  bool _editMode = false;

  final _nameCtrl = TextEditingController();
  final _emailCtrl = TextEditingController();
  final _vehicleNoCtrl = TextEditingController();
  final _aadhaarCtrl = TextEditingController();
  String _vehicleType = 'bike';
  File? _newPhoto;

  @override
  void initState() {
    super.initState();
    _load();
  }

  @override
  void dispose() {
    _nameCtrl.dispose();
    _emailCtrl.dispose();
    _vehicleNoCtrl.dispose();
    _aadhaarCtrl.dispose();
    super.dispose();
  }

  Future<void> _load() async {
    setState(() => _loading = true);
    try {
      final p = await _api.get('/delivery/profile');
      setState(() { _profile = p; _loading = false; });
    } catch (e) {
      setState(() => _loading = false);
    }
  }

  void _startEdit() {
    _nameCtrl.text = _profile?['name'] ?? '';
    _emailCtrl.text = _profile?['email'] ?? '';
    _vehicleNoCtrl.text = _profile?['vehicleNumber'] ?? '';
    _aadhaarCtrl.text = _profile?['aadhaarNumber'] ?? '';
    _vehicleType = _profile?['vehicleType'] ?? 'bike';
    _newPhoto = null;
    setState(() => _editMode = true);
  }

  Future<void> _pickPhoto() async {
    final allowed = await PermissionDialog.showPhoto(context);
    if (!allowed) return;
    final picker = ImagePicker();
    final img = await picker.pickImage(source: ImageSource.gallery, maxWidth: 800, imageQuality: 80);
    if (img != null) setState(() => _newPhoto = File(img.path));
  }

  Future<void> _save() async {
    final name = _nameCtrl.text.trim();
    if (name.isEmpty) {
      _snack('Name is required', isError: true);
      return;
    }
    try {
      final fields = <String, String>{
        'name': name,
        'phone': context.read<AuthService>().user?['phone'] ?? _profile?['phone'] ?? '',
        'vehicleType': _vehicleType,
      };
      final email = _emailCtrl.text.trim();
      if (email.isNotEmpty) fields['email'] = email;
      final vn = _vehicleNoCtrl.text.trim();
      if (vn.isNotEmpty) fields['vehicleNumber'] = vn;
      final aadhaar = _aadhaarCtrl.text.replaceAll(' ', '');
      if (aadhaar.isNotEmpty) fields['aadhaarNumber'] = aadhaar;

      await _api.upload('/delivery/profile', fields, filePath: _newPhoto?.path);
      _snack('Profile updated!');
      setState(() => _editMode = false);
      _load();
    } catch (e) {
      _snack(e.toString(), isError: true);
    }
  }

  Future<void> _logout() async {
    LocationService.stopTracking();
    await context.read<AuthService>().logout();
    if (!mounted) return;
    Navigator.pushAndRemoveUntil(context, MaterialPageRoute(builder: (_) => const LoginScreen()), (_) => false);
  }

  void _snack(String msg, {bool isError = false}) {
    if (!mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(SnackBar(
      content: Text(msg),
      backgroundColor: isError ? AppTheme.danger : AppTheme.success,
      behavior: SnackBarBehavior.floating,
    ));
  }

  @override
  Widget build(BuildContext context) {
    if (_loading) return const Center(child: CircularProgressIndicator());
    if (_profile == null) return const Center(child: Text('Failed to load profile'));
    return _editMode ? _editView() : _viewMode();
  }

  Widget _viewMode() {
    final p = _profile!;
    final photoUrl = p['photo'] != null ? '${AppConfig.apiBase.replaceAll('/api', '')}/${p['photo']}' : null;
    final user = context.read<AuthService>().user ?? {};
    final vehicleIcons = {'bike': '🏍️', 'scooter': '🛵', 'bicycle': '🚲', 'car': '🚗', 'walk': '🚶'};

    return RefreshIndicator(
      onRefresh: _load,
      child: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          // Avatar
          Center(
            child: Column(
              children: [
                CircleAvatar(
                  radius: 44,
                  backgroundColor: AppTheme.primaryBg,
                  backgroundImage: photoUrl != null ? NetworkImage(photoUrl) : null,
                  child: photoUrl == null ? const Icon(Icons.person, size: 40, color: AppTheme.primary) : null,
                ),
                const SizedBox(height: 10),
                Text(p['name'] ?? user['name'] ?? 'Delivery Partner',
                    style: const TextStyle(fontSize: 18, fontWeight: FontWeight.w700)),
                Text(user['phone'] ?? p['phone'] ?? '', style: const TextStyle(color: AppTheme.textLight, fontSize: 13)),
                const SizedBox(height: 6),
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                  decoration: BoxDecoration(
                    color: p['isVerified'] == true ? AppTheme.successBg : AppTheme.warningBg,
                    borderRadius: BorderRadius.circular(12),
                  ),
                  child: Text(
                    p['isVerified'] == true ? '✅ Verified' : '⏳ Verification Pending',
                    style: TextStyle(
                        fontSize: 12,
                        fontWeight: FontWeight.w600,
                        color: p['isVerified'] == true ? AppTheme.success : AppTheme.warning),
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: 18),

          // Stats
          Row(
            children: [
              _statBox('Deliveries', '${p['totalDeliveries'] ?? 0}'),
              const SizedBox(width: 8),
              _statBox('Earnings', '₹${p['totalEarnings'] ?? 0}'),
              const SizedBox(width: 8),
              _statBox('Rating', p['rating'] != null ? '${(p['rating'] as num).toStringAsFixed(1)}' : '—',
                  sub: '${p['ratingCount'] ?? 0} reviews'),
            ],
          ),
          const SizedBox(height: 14),

          // Details card
          Card(
            child: Padding(
              padding: const EdgeInsets.all(14),
              child: Column(
                children: [
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      const Text('Details', style: TextStyle(fontSize: 15, fontWeight: FontWeight.w700)),
                      TextButton.icon(
                        onPressed: _startEdit,
                        icon: const Icon(Icons.edit, size: 16),
                        label: const Text('Edit', style: TextStyle(fontSize: 13)),
                      ),
                    ],
                  ),
                  const Divider(),
                  _infoRow('Email', p['email'] ?? '—'),
                  _infoRow('Vehicle', '${vehicleIcons[p['vehicleType']] ?? ''} ${p['vehicleType'] ?? '—'} ${p['vehicleNumber'] != null ? '· ${p['vehicleNumber']}' : ''}'),
                  _infoRow('Aadhaar', p['aadhaarNumber'] ?? '—'),
                ],
              ),
            ),
          ),
          const SizedBox(height: 16),

          // Logout
          SizedBox(
            width: double.infinity,
            child: OutlinedButton.icon(
              onPressed: _logout,
              icon: const Icon(Icons.logout, size: 18),
              label: const Text('Logout'),
              style: OutlinedButton.styleFrom(
                foregroundColor: AppTheme.danger,
                side: const BorderSide(color: AppTheme.danger),
                padding: const EdgeInsets.symmetric(vertical: 14),
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _editView() {
    final photoUrl = _profile?['photo'] != null ? '${AppConfig.apiBase.replaceAll('/api', '')}/${_profile!['photo']}' : null;

    return ListView(
      padding: const EdgeInsets.all(16),
      children: [
        Card(
          child: Padding(
            padding: const EdgeInsets.all(14),
            child: Column(
              children: [
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    const Text('Edit Profile', style: TextStyle(fontSize: 15, fontWeight: FontWeight.w700)),
                    TextButton(onPressed: () => setState(() => _editMode = false), child: const Text('✕ Cancel')),
                  ],
                ),
                const SizedBox(height: 10),
                GestureDetector(
                  onTap: _pickPhoto,
                  child: CircleAvatar(
                    radius: 40,
                    backgroundColor: AppTheme.primaryBg,
                    backgroundImage: _newPhoto != null
                        ? FileImage(_newPhoto!)
                        : (photoUrl != null ? NetworkImage(photoUrl) : null),
                    child: (_newPhoto == null && photoUrl == null)
                        ? const Icon(Icons.camera_alt, size: 28, color: AppTheme.primary)
                        : null,
                  ),
                ),
                const Text('Tap to change photo', style: TextStyle(fontSize: 11, color: AppTheme.textLight)),
                const SizedBox(height: 14),
                TextField(controller: _nameCtrl, decoration: const InputDecoration(labelText: 'Full Name *')),
                const SizedBox(height: 12),
                TextField(controller: _emailCtrl, keyboardType: TextInputType.emailAddress, decoration: const InputDecoration(labelText: 'Email')),
                const SizedBox(height: 12),
                Row(
                  children: [
                    Expanded(
                      child: DropdownButtonFormField<String>(
                        initialValue: _vehicleType,
                        decoration: const InputDecoration(labelText: 'Vehicle'),
                        items: const [
                          DropdownMenuItem(value: 'bike', child: Text('Bike')),
                          DropdownMenuItem(value: 'scooter', child: Text('Scooter')),
                          DropdownMenuItem(value: 'bicycle', child: Text('Bicycle')),
                          DropdownMenuItem(value: 'car', child: Text('Car')),
                          DropdownMenuItem(value: 'walk', child: Text('Walk')),
                        ],
                        onChanged: (v) => setState(() => _vehicleType = v!),
                      ),
                    ),
                    const SizedBox(width: 10),
                    Expanded(child: TextField(controller: _vehicleNoCtrl, decoration: const InputDecoration(labelText: 'Vehicle No.'))),
                  ],
                ),
                const SizedBox(height: 12),
                TextField(controller: _aadhaarCtrl, keyboardType: TextInputType.number,
                    maxLength: 14, decoration: const InputDecoration(labelText: 'Aadhaar', counterText: '')),
                const SizedBox(height: 16),
                SizedBox(width: double.infinity, child: ElevatedButton.icon(
                  onPressed: _save, icon: const Icon(Icons.save, size: 18), label: const Text('Save Changes'))),
              ],
            ),
          ),
        ),
      ],
    );
  }

  Widget _statBox(String label, String value, {String? sub}) {
    return Expanded(
      child: Container(
        padding: const EdgeInsets.all(14),
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(10),
          border: Border.all(color: AppTheme.border),
        ),
        child: Column(
          children: [
            Text(label, style: const TextStyle(fontSize: 11, color: AppTheme.textLight)),
            const SizedBox(height: 4),
            Text(value, style: const TextStyle(fontSize: 18, fontWeight: FontWeight.w700, color: AppTheme.primary)),
            if (sub != null) Text(sub, style: const TextStyle(fontSize: 10, color: AppTheme.textLight)),
          ],
        ),
      ),
    );
  }

  Widget _infoRow(String label, String value) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 8),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(label, style: const TextStyle(fontSize: 12, color: AppTheme.textLight)),
          const SizedBox(height: 2),
          Text(value, style: const TextStyle(fontSize: 14)),
        ],
      ),
    );
  }
}
