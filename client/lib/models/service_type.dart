/// Tipo de servicio del catálogo (Sprint 7, US3, contracts/service-types.md).
class ServiceType {
  const ServiceType({
    required this.id,
    required this.name,
    this.intervalDays,
    this.intervalKm,
    this.active = true,
    this.usedInServices = 0,
  });

  final int id;
  final String name;
  final int? intervalDays;
  final int? intervalKm;
  final bool active;

  /// Líneas de servicio de órdenes que usan este tipo (solo en el listado de
  /// ADMIN; el `lookup` no lo trae).
  final int usedInServices;

  factory ServiceType.fromJson(Map<String, dynamic> json) => ServiceType(
        id: (json['id'] as num).toInt(),
        name: json['name'] as String? ?? '',
        intervalDays: (json['intervalDays'] as num?)?.toInt(),
        intervalKm: (json['intervalKm'] as num?)?.toInt(),
        active: json['active'] as bool? ?? true,
        usedInServices: (json['usedInServices'] as num?)?.toInt() ?? 0,
      );

  /// Texto de los intervalos para la lista, p. ej. «180 días · 5,000 km».
  String get etiquetaIntervalos {
    final partes = <String>[
      if (intervalDays != null) '$intervalDays días',
      if (intervalKm != null) '${_miles(intervalKm!)} km',
    ];
    return partes.join(' · ');
  }

  static String _miles(int valor) {
    final texto = valor.toString();
    final buffer = StringBuffer();
    for (var i = 0; i < texto.length; i++) {
      if (i > 0 && (texto.length - i) % 3 == 0) buffer.write(',');
      buffer.write(texto[i]);
    }
    return buffer.toString();
  }
}
