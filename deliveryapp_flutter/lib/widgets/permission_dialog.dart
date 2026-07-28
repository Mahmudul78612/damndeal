import 'package:flutter/material.dart';
import '../theme.dart';

class PermissionDialog {
  /// Show a consent dialog before requesting a permission.
  /// Returns `true` if user tapped "Allow", `false` if "Not Now".
  static Future<bool> show(
    BuildContext context, {
    required IconData icon,
    required String title,
    required String description,
    String allowText = 'Allow',
    String denyText = 'Not Now',
  }) async {
    final result = await showDialog<bool>(
      context: context,
      barrierDismissible: false,
      builder: (ctx) => Dialog(
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
        child: Padding(
          padding: const EdgeInsets.all(24),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Container(
                padding: const EdgeInsets.all(16),
                decoration: BoxDecoration(
                  color: AppTheme.primary.withValues(alpha: 0.1),
                  shape: BoxShape.circle,
                ),
                child: Icon(icon, size: 40, color: AppTheme.primary),
              ),
              const SizedBox(height: 16),
              Text(
                title,
                style: const TextStyle(fontSize: 18, fontWeight: FontWeight.w700, color: AppTheme.textColor),
                textAlign: TextAlign.center,
              ),
              const SizedBox(height: 10),
              Text(
                description,
                style: const TextStyle(fontSize: 14, color: AppTheme.textLight, height: 1.5),
                textAlign: TextAlign.center,
              ),
              const SizedBox(height: 24),
              SizedBox(
                width: double.infinity,
                child: ElevatedButton(
                  onPressed: () => Navigator.pop(ctx, true),
                  style: ElevatedButton.styleFrom(
                    backgroundColor: AppTheme.primary,
                    foregroundColor: Colors.white,
                    padding: const EdgeInsets.symmetric(vertical: 14),
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                  ),
                  child: Text(allowText, style: const TextStyle(fontSize: 15, fontWeight: FontWeight.w600)),
                ),
              ),
              const SizedBox(height: 8),
              TextButton(
                onPressed: () => Navigator.pop(ctx, false),
                child: Text(denyText, style: const TextStyle(color: AppTheme.textLight, fontSize: 14)),
              ),
            ],
          ),
        ),
      ),
    );
    return result ?? false;
  }

  static Future<bool> showLocation(BuildContext context) {
    return show(
      context,
      icon: Icons.location_on_rounded,
      title: 'Location Access Required',
      description: 'We need your location to show nearby deliveries, track your route, and update customers with live delivery status.',
    );
  }

  static Future<bool> showPhoto(BuildContext context) {
    return show(
      context,
      icon: Icons.photo_library_rounded,
      title: 'Photo Access Required',
      description: 'We need access to your gallery to upload your profile photo and ID documents for verification.',
    );
  }

  static Future<bool> showCamera(BuildContext context) {
    return show(
      context,
      icon: Icons.camera_alt_rounded,
      title: 'Camera Access Required',
      description: 'We need camera access to take photos for delivery proof and profile picture.',
    );
  }
}
