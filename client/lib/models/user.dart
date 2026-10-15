/// Modelo de usuario del dominio (contrato: contracts/auth.md → data.user).
class User {
  const User({
    required this.id,
    required this.username,
    required this.name,
    required this.email,
    required this.role,
    this.active = true,
    this.createdAt,
  });

  final int id;
  final String username;
  final String name;
  final String email;
  final String role;
  final bool active;
  final String? createdAt;

  bool get esAdmin => role == 'ADMIN';

  /// Nombre del rol en español para mostrar en la interfaz.
  String get nombreRol {
    switch (role) {
      case 'ADMIN':
        return 'Administrador';
      case 'RECEPTIONIST':
        return 'Recepción';
      case 'MECHANIC':
        return 'Mecánico';
      default:
        return role;
    }
  }

  factory User.fromJson(Map<String, dynamic> json) => User(
    id: (json['id'] as num).toInt(),
    username: json['username'] as String,
    name: json['name'] as String,
    email: json['email'] as String,
    role: json['role'] as String,
    active: json['active'] as bool? ?? true,
    createdAt: json['createdAt'] as String?,
  );

  Map<String, dynamic> toJson() => {
    'id': id,
    'username': username,
    'name': name,
    'email': email,
    'role': role,
    'active': active,
    if (createdAt != null) 'createdAt': createdAt,
  };
}
