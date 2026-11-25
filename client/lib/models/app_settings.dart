/// T028 (Sprint 7, US1): configuración del taller que devuelve
/// `GET /api/settings` (contracts/settings.md): datos del taller, márgenes de
/// «Próximo» del mantenimiento y los valores de respaldo para «Restablecer».
class ShopSettings {
  const ShopSettings({required this.name, this.address, this.phone});

  final String name;
  final String? address;
  final String? phone;

  factory ShopSettings.fromJson(Map<String, dynamic> json) => ShopSettings(
        name: json['name'] as String? ?? '',
        address: json['address'] as String?,
        phone: json['phone'] as String?,
      );
}

class MaintenanceMargins {
  const MaintenanceMargins({required this.warnDays, required this.warnKm});

  final int warnDays;
  final int warnKm;

  factory MaintenanceMargins.fromJson(Map<String, dynamic> json) =>
      MaintenanceMargins(
        warnDays: (json['warnDays'] as num?)?.toInt() ?? 30,
        warnKm: (json['warnKm'] as num?)?.toInt() ?? 500,
      );
}

class AppSettings {
  const AppSettings({
    required this.shop,
    required this.maintenance,
    required this.defaultShop,
    required this.defaultMaintenance,
  });

  final ShopSettings shop;
  final MaintenanceMargins maintenance;

  /// Valores de respaldo vigentes (para «Restablecer»).
  final ShopSettings defaultShop;
  final MaintenanceMargins defaultMaintenance;

  factory AppSettings.fromJson(Map<String, dynamic> json) {
    final defaults = (json['defaults'] as Map?)?.cast<String, dynamic>() ?? {};
    return AppSettings(
      shop: ShopSettings.fromJson(
        (json['shop'] as Map).cast<String, dynamic>(),
      ),
      maintenance: MaintenanceMargins.fromJson(
        (json['maintenance'] as Map).cast<String, dynamic>(),
      ),
      defaultShop: ShopSettings.fromJson(
        (defaults['shop'] as Map?)?.cast<String, dynamic>() ??
            {'name': 'Motorix'},
      ),
      defaultMaintenance: MaintenanceMargins.fromJson(
        (defaults['maintenance'] as Map?)?.cast<String, dynamic>() ?? {},
      ),
    );
  }
}
