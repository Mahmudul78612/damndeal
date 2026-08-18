import 'dart:io' show Platform;

import 'package:flutter/foundation.dart' show kIsWeb;
import 'package:image_picker/image_picker.dart';
import 'package:permission_handler/permission_handler.dart';
import 'package:webview_flutter/webview_flutter.dart';
import 'package:webview_flutter_android/webview_flutter_android.dart';

/// Native capabilities the website may ever ask for — camera and microphone
/// (getUserMedia, e.g. the coupon QR scanner), the geolocation prompt, and
/// `<input type="file">` photo uploads.
///
/// The point of wiring all of it now: the site ships new features weekly, the
/// app ships rarely. With these handlers in place a future web feature that
/// needs the camera or an upload simply works, instead of waiting months for
/// the next APK. Nothing asks for a permission up front — every OS sheet
/// appears only at the moment the page requests that capability.

/// Pass as `WebViewController(onPermissionRequest: ...)`.
///
/// Android WebView silently denies getUserMedia unless the app answers; this
/// raises the matching OS permission sheet and grants only what was allowed.
Future<void> handleWebPermissionRequest(WebViewPermissionRequest request) async {
  final wantsCamera =
      request.types.contains(WebViewPermissionResourceType.camera);
  final wantsMic =
      request.types.contains(WebViewPermissionResourceType.microphone);

  var allowed = true;
  if (wantsCamera) {
    allowed = allowed && (await Permission.camera.request()).isGranted;
  }
  if (wantsMic) {
    allowed = allowed && (await Permission.microphone.request()).isGranted;
  }

  if (allowed) {
    await request.grant();
  } else {
    await request.deny();
  }
}

/// Android-only wiring that has to happen after the controller exists:
/// geolocation prompts, the file picker, and two feel-native tweaks.
Future<void> setupAndroidWebCapabilities(WebViewController controller) async {
  if (kIsWeb || !Platform.isAndroid) {
    return;
  }
  final platform = controller.platform;
  if (platform is! AndroidWebViewController) {
    return;
  }

  // ── navigator.geolocation ──
  // Android WebView never shows its own prompt; without this handler the
  // site's "use my current location" fails with no visible reason.
  await platform.setGeolocationPermissionsPromptCallbacks(
    onShowPrompt: (request) async {
      final status = await Permission.location.request();
      final allowed = status.isGranted || status.isLimited;
      return GeolocationPermissionsResponse(allow: allowed, retain: allowed);
    },
  );

  // ── <input type="file"> ──
  // Android WebView ignores the tap entirely unless the app supplies a
  // picker. The camera opens when the page asked for a live capture,
  // otherwise the photo picker (which needs no storage permission).
  await platform.setOnShowFileSelector((params) async {
    final picker = ImagePicker();
    if (params.isCaptureEnabled) {
      final shot = await picker.pickImage(
        source: ImageSource.camera,
        imageQuality: 85,
      );
      return shot == null ? <String>[] : [Uri.file(shot.path).toString()];
    }
    if (params.mode == FileSelectorMode.openMultiple) {
      final many = await picker.pickMultiImage(imageQuality: 85);
      return many.map((f) => Uri.file(f.path).toString()).toList();
    }
    final one = await picker.pickImage(
      source: ImageSource.gallery,
      imageQuality: 85,
    );
    return one == null ? <String>[] : [Uri.file(one.path).toString()];
  });

  // ── Feel-native tweaks ──
  // Media may start without a tap-first rule (product videos, QR preview),
  // and the text zoom is pinned so a system font-size setting cannot break
  // the site's layout the way it visibly does on stock WebView.
  await platform.setMediaPlaybackRequiresUserGesture(false);
  await platform.setTextZoom(100);
}
