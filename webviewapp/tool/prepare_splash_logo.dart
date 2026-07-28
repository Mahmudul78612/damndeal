import 'dart:io';

import 'package:image/image.dart' as img;

void main() {
  const logoPath = 'assets/logo.webp';
  final logoFile = File(logoPath);
  if (!logoFile.existsSync()) {
    stderr.writeln('Missing logo file at $logoPath');
    exit(1);
  }

  final bytes = logoFile.readAsBytesSync();
  final decoded = img.decodeImage(bytes);
  if (decoded == null) {
    stderr.writeln('Unable to decode logo.webp');
    exit(1);
  }

  final iosDir = Directory(
    'ios/Runner/Assets.xcassets/LaunchImage.imageset',
  )..createSync(recursive: true);

  _writePng(decoded, '${iosDir.path}/LaunchImage.png');
  _writePng(_resize(decoded, 2), '${iosDir.path}/LaunchImage@2x.png');
  _writePng(_resize(decoded, 3), '${iosDir.path}/LaunchImage@3x.png');

  final androidOut = File(
    'android/app/src/main/res/drawable/launch_logo.webp',
  );
  androidOut.parent.createSync(recursive: true);
  androidOut.writeAsBytesSync(bytes);

  stdout.writeln('Splash logo prepared for iOS and Android.');
}

img.Image _resize(img.Image image, int scale) {
  return img.copyResize(
    image,
    width: image.width * scale,
    height: image.height * scale,
    interpolation: img.Interpolation.cubic,
  );
}

void _writePng(img.Image image, String path) {
  final file = File(path);
  file.writeAsBytesSync(img.encodePng(image));
}
