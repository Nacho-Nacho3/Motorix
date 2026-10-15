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
        'warnDays': warnDays,
        'warnKm': warnKm,
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
