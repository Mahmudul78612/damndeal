class DamnPayUser {
  final String phone;
  final String? name;
  final String? email;

  const DamnPayUser({required this.phone, this.name, this.email});

  factory DamnPayUser.fromJson(Map<String, dynamic> json) {
    return DamnPayUser(
      phone: json['phone'] as String,
      name: json['name'] as String?,
      email: json['email'] as String?,
    );
  }
}

class DamnPayService {
  final String id;
  final String name;
  final String icon;
  final String route;

  const DamnPayService({
    required this.id,
    required this.name,
    required this.icon,
    required this.route,
  });

  factory DamnPayService.fromJson(Map<String, dynamic> json) {
    return DamnPayService(
      id: json['id'] as String,
      name: json['name'] as String,
      icon: json['icon'] as String? ?? 'payment',
      route: json['route'] as String? ?? '',
    );
  }
}

class DamnPaySession {
  final String token;
  final DateTime expiresAt;
  final DamnPayUser user;
  final List<String> allowedServices;

  const DamnPaySession({
    required this.token,
    required this.expiresAt,
    required this.user,
    required this.allowedServices,
  });

  bool get isExpired => DateTime.now().isAfter(expiresAt);
}
