import 'package:flutter/material.dart';
import 'package:image_picker/image_picker.dart';
import 'package:provider/provider.dart';
import 'dart:io';
import '../theme.dart';
import '../services/auth_service.dart';
import '../services/api_service.dart';
import '../widgets/permission_dialog.dart';
import 'home_screen.dart';

class OnboardingScreen extends StatefulWidget {
  final String phone;
  const OnboardingScreen({super.key, required this.phone});
  @override
  State<OnboardingScreen> createState() => _OnboardingScreenState();
}

class _OnboardingScreenState extends State<OnboardingScreen> {
  final _nameCtrl = TextEditingController();
  final _emailCtrl = TextEditingController();
  final _vehicleNoCtrl = TextEditingController();
  final _aadhaarCtrl = TextEditingController();
  String _vehicleType = 'bike';
  File? _photo;
  bool _loading = false;
  String? _error;

  @override
  void dispose() {
    _nameCtrl.dispose();
    _emailCtrl.dispose();
    _vehicleNoCtrl.dispose();
    _aadhaarCtrl.dispose();
    super.dispose();
  }

  Future<void> _pickPhoto() async {
    final allowed = await PermissionDialog.showPhoto(context);
    if (!allowed) return;
    final picker = ImagePicker();
    final img = await picker.pickImage(source: ImageSource.gallery, maxWidth: 800, maxHeight: 800, imageQuality: 80);
    if (img != null) setState(() => _photo = File(img.path));
  }

  Future<void> _submit() async {
    final name = _nameCtrl.text.trim();
    if (name.isEmpty) {
      setState(() => _error = 'Name is required');
      return;
    }
    setState(() { _loading = true; _error = null; });
    try {
      final auth = context.read<AuthService>();
      // 1. Complete user profile
      await auth.completeProfile(name, _emailCtrl.text.trim());

      // 2. Create delivery profile
      final fields = <String, String>{
        'name': name,
        'phone': '+91${widget.phone}',
        'vehicleType': _vehicleType,
      };
      final email = _emailCtrl.text.trim();
      if (email.isNotEmpty) fields['email'] = email;
      final vn = _vehicleNoCtrl.text.trim();
      if (vn.isNotEmpty) fields['vehicleNumber'] = vn;
      final aadhaar = _aadhaarCtrl.text.replaceAll(' ', '');
      if (aadhaar.isNotEmpty) fields['aadhaarNumber'] = aadhaar;

      await ApiService().upload('/delivery/profile', fields, filePath: _photo?.path);

      // 3. Refresh user data
      await auth.refreshUser();

      if (!mounted) return;
      Navigator.pushReplacement(context, MaterialPageRoute(builder: (_) => const HomeScreen()));
    } catch (e) {
      setState(() => _error = e.toString());
    }
    setState(() => _loading = false);
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppTheme.bg,
      appBar: AppBar(title: const Text('Complete Profile')),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(20),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text('Set up your delivery profile', style: TextStyle(fontSize: 18, fontWeight: FontWeight.w700)),
            const SizedBox(height: 4),
            const Text('to start receiving orders', style: TextStyle(color: AppTheme.textLight, fontSize: 13)),
            const SizedBox(height: 24),
            if (_error != null)
              Container(
                width: double.infinity,
                margin: const EdgeInsets.only(bottom: 14),
                padding: const EdgeInsets.all(12),
                decoration: BoxDecoration(color: AppTheme.dangerBg, borderRadius: BorderRadius.circular(8)),
                child: Text(_error!, style: const TextStyle(color: Color(0xFF991B1B), fontSize: 13)),
              ),
            // Photo
            Center(
              child: GestureDetector(
                onTap: _pickPhoto,
                child: Column(
                  children: [
                    CircleAvatar(
                      radius: 44,
                      backgroundColor: AppTheme.primaryBg,
                      backgroundImage: _photo != null ? FileImage(_photo!) : null,
                      child: _photo == null ? const Icon(Icons.camera_alt, size: 32, color: AppTheme.primary) : null,
                    ),
                    const SizedBox(height: 6),
                    const Text('Tap to add photo', style: TextStyle(fontSize: 12, color: AppTheme.textLight)),
                  ],
                ),
              ),
            ),
            const SizedBox(height: 20),
            // Name
            TextField(controller: _nameCtrl, decoration: const InputDecoration(labelText: 'Full Name *')),
            const SizedBox(height: 14),
            // Email
            TextField(controller: _emailCtrl, keyboardType: TextInputType.emailAddress, decoration: const InputDecoration(labelText: 'Email')),
            const SizedBox(height: 14),
            // Vehicle
            Row(
              children: [
                Expanded(
                  child: DropdownButtonFormField<String>(
                    initialValue: _vehicleType,
                    decoration: const InputDecoration(labelText: 'Vehicle Type'),
                    items: const [
                      DropdownMenuItem(value: 'bike', child: Text('🏍️ Bike')),
                      DropdownMenuItem(value: 'scooter', child: Text('🛵 Scooter')),
                      DropdownMenuItem(value: 'bicycle', child: Text('🚲 Bicycle')),
                      DropdownMenuItem(value: 'car', child: Text('🚗 Car')),
                      DropdownMenuItem(value: 'walk', child: Text('🚶 Walk')),
                    ],
                    onChanged: (v) => setState(() => _vehicleType = v!),
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: TextField(controller: _vehicleNoCtrl, decoration: const InputDecoration(labelText: 'Vehicle Number', hintText: 'MH 01 AB 1234')),
                ),
              ],
            ),
            const SizedBox(height: 14),
            // Aadhaar
            TextField(controller: _aadhaarCtrl, keyboardType: TextInputType.number, maxLength: 14, decoration: const InputDecoration(labelText: 'Aadhaar Number', counterText: '')),
            const SizedBox(height: 24),
            SizedBox(
              width: double.infinity,
              child: ElevatedButton(
                onPressed: _loading ? null : _submit,
                child: _loading
                    ? const SizedBox(height: 20, width: 20, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white))
                    : const Text('Start Delivering →'),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
