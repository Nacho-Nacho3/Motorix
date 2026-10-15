/// Modelo de cliente (contrato: contracts/clients.md → data.client).
class Client {
  const Client({
    required this.id,
    required this.name,
    required this.phone,
    required this.email,
    required this.active,
    this.createdAt,
    this.vehicleCount,
  });

  final int id;
  final String name;
  final String phone;
  final String email;
  final bool active;
  final String? createdAt;
  final int? vehicleCount;

  factory Client.fromJson(Map<String, dynamic> json) => Client(
        id: (json['id'] as num).toInt(),
        name: json['name'] as String,
        phone: json['phone'] as String,
        email: json['email'] as String,
        active: json['active'] as bool? ?? true,
        createdAt: json['createdAt'] as String?,
        vehicleCount: (json['vehicleCount'] as num?)?.toInt(),
      );

  Map<String, dynamic> toJson() => {
        'id': id,
        'name': name,
        'phone': phone,
        'email': email,
        'active': active,
        if (createdAt != null) 'createdAt': createdAt,
        if (vehicleCount != null) 'vehicleCount': vehicleCount,
      };
}
