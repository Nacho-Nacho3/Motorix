/// Modelo de mantenimiento del vehículo
/// (contrato: specs/003-historial-mantenimiento-inventario/contracts/maintenances.md).
class Maintenance {
  const Maintenance({
    required this.id,
    required this.vehicleId,
    required this.vehicleLabel,
    required this.clientName,
    this.nextDueDate,
    this.nextDueMileage,
    required this.warnDays,
    required this.warnKm,
    this.warnDaysCustom = false,
    this.warnKmCustom = false,
    this.recommendations,
    required this.state,
    this.daysRemaining,
    this.mileageRemaining,
    required this.registeredBy,
    this.updatedAt,
  });

  final int id;
  final int vehicleId;
  final String vehicleLabel;
  final String clientName;
  final String? nextDueDate;
  final int? nextDueMileage;
  final int warnDays;
  final int warnKm;

  /// Sprint 7 (D-16): true si la antelación fue capturada a mano en este
  /// registro; false si rige el valor del taller (`warnDays`/`warnKm` son los
  /// efectivos en ambos casos).
  final bool warnDaysCustom;
  final bool warnKmCustom;
  final String? recommendations;

  /// Estado calculado en el backend: NORMAL, UPCOMING u OVERDUE (VM-06).
  final String state;
  final int? daysRemaining;
  final int? mileageRemaining;
  final int registeredBy;
  final String? updatedAt;

  factory Maintenance.fromJson(Map<String, dynamic> json) => Maintenance(
        id: (json['id'] as num).toInt(),
        vehicleId: (json['vehicleId'] as num).toInt(),
        vehicleLabel: json['vehicleLabel'] as String? ?? '',
        clientName: json['clientName'] as String? ?? '',
        nextDueDate: json['nextDueDate'] as String?,
        nextDueMileage: (json['nextDueMileage'] as num?)?.toInt(),
        warnDays: (json['warnDays'] as num?)?.toInt() ?? 30,
        warnKm: (json['warnKm'] as num?)?.toInt() ?? 500,
        warnDaysCustom: json['warnDaysCustom'] as bool? ?? false,
        warnKmCustom: json['warnKmCustom'] as bool? ?? false,
        recommendations: json['recommendations'] as String?,
        state: json['state'] as String? ?? '',
        daysRemaining: (json['daysRemaining'] as num?)?.toInt(),
        mileageRemaining: (json['mileageRemaining'] as num?)?.toInt(),
        registeredBy: (json['registeredBy'] as num?)?.toInt() ?? 0,
        updatedAt: json['updatedAt'] as String?,
      );

  /// Cuerpo del alta/reemplazo según el contrato (sin campos de estado).
  Map<String, dynamic> toJson() => {
        'vehicleId': vehicleId,
        'nextDueDate': nextDueDate,
        'nextDueMileage': nextDueMileage,
        // Solo viaja lo capturado a mano; null = usar el valor del taller.
        'warnDays': warnDaysCustom ? warnDays : null,
        'warnKm': warnKmCustom ? warnKm : null,
        if (recommendations != null && recommendations!.isNotEmpty)
          'recommendations': recommendations,
      };

  /// Etiqueta en español del estado (contrato maintainments.md).
  String get etiquetaEstado => switch (state) {
        'UPCOMING' => 'Próximo',
        'OVERDUE' => 'Vencido',
        'NORMAL' => 'Normal',
        _ => state.isEmpty ? 'Normal' : state,
      };
}

/// Propuesta de próximo mantenimiento (Sprint 7, US8, CA-5): fecha y/o
/// kilometraje calculados desde la última orden terminada del vehículo con
/// tipos de servicio con intervalo. Siempre editable.
class PropuestaMantenimiento {
  const PropuestaMantenimiento({
    this.nextDueDate,
    this.nextDueMileage,
    required this.basedOnOrderId,
    this.serviceTypes = const [],
  });

  final String? nextDueDate;
  final int? nextDueMileage;
  final int basedOnOrderId;
  final List<String> serviceTypes;

  factory PropuestaMantenimiento.fromJson(Map<String, dynamic> json) =>
      PropuestaMantenimiento(
        nextDueDate: json['nextDueDate'] as String?,
        nextDueMileage: (json['nextDueMileage'] as num?)?.toInt(),
        basedOnOrderId: (json['basedOnOrderId'] as num?)?.toInt() ?? 0,
        serviceTypes: [
          for (final tipo in (json['serviceTypes'] as List? ?? const []))
            tipo.toString(),
        ],
      );

  /// Nota para el formulario: «Propuesto desde el servicio Cambio de aceite».
  String get nota => serviceTypes.isEmpty
      ? 'Propuesto desde la última orden terminada'
      : 'Propuesto desde el servicio ${serviceTypes.join(', ')}';
}
