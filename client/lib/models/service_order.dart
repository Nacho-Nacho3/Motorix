/// Modelo de orden de servicio
/// (contrato: contracts/service-orders.md → data.order / data.orders[]).
class ServiceOrder {
  const ServiceOrder({
    required this.id,
    required this.clientId,
    required this.clientName,
    required this.vehicleId,
    required this.vehicleLabel,
    required this.mechanicId,
    required this.mechanicName,
    required this.status,
    required this.entryMileage,
    required this.reportedProblem,
    this.diagnosis,
    this.observations,
    this.recommendations,
    this.mileageCorrectionReason,
    this.waitingOrigin,
    this.createdAt,
    this.updatedAt,
  });

  final int id;
  final int clientId;
  final String clientName;
  final int vehicleId;
  final String vehicleLabel;
  final int mechanicId;
  final String mechanicName;
  final String status;
  final int entryMileage;
  final String reportedProblem;
  final String? diagnosis;
  final String? observations;
  final String? recommendations;
  final String? mileageCorrectionReason;

  /// Estado de origen al entrar a WAITING_PART (solo en el detalle, US6).
  final String? waitingOrigin;
  final String? createdAt;
  final String? updatedAt;

  factory ServiceOrder.fromJson(Map<String, dynamic> json) => ServiceOrder(
        id: (json['id'] as num).toInt(),
        clientId: (json['clientId'] as num).toInt(),
        clientName: json['clientName'] as String? ?? '',
        vehicleId: (json['vehicleId'] as num).toInt(),
        vehicleLabel: json['vehicleLabel'] as String? ?? '',
        mechanicId: (json['mechanicId'] as num).toInt(),
        mechanicName: json['mechanicName'] as String? ?? '',
        status: json['status'] as String,
        entryMileage: (json['entryMileage'] as num).toInt(),
        reportedProblem: json['reportedProblem'] as String? ?? '',
        diagnosis: json['diagnosis'] as String?,
        observations: json['observations'] as String?,
        recommendations: json['recommendations'] as String?,
        mileageCorrectionReason: json['mileageCorrectionReason'] as String?,
        waitingOrigin: json['waitingOrigin'] as String?,
        createdAt: json['createdAt'] as String?,
        updatedAt: json['updatedAt'] as String?,
      );

  Map<String, dynamic> toJson() => {
        'id': id,
        'clientId': clientId,
        'clientName': clientName,
        'vehicleId': vehicleId,
        'vehicleLabel': vehicleLabel,
        'mechanicId': mechanicId,
        'mechanicName': mechanicName,
        'status': status,
        'entryMileage': entryMileage,
        'reportedProblem': reportedProblem,
        'diagnosis': diagnosis,
        'observations': observations,
        'recommendations': recommendations,
        'mileageCorrectionReason': mileageCorrectionReason,
        if (waitingOrigin != null) 'waitingOrigin': waitingOrigin,
        if (createdAt != null) 'createdAt': createdAt,
        if (updatedAt != null) 'updatedAt': updatedAt,
      };

  /// Etiquetas en español de los estados (contrato service-orders.md).
  static const Map<String, String> etiquetas = {
    'RECEIVED': 'Recibido',
    'DIAGNOSIS': 'Diagnóstico',
    'IN_REPAIR': 'En reparación',
    'WAITING_PART': 'Esperando refacción',
    'FINISHED': 'Terminado',
    'DELIVERED': 'Entregado',
  };

  String get etiquetaEstado => etiquetas[status] ?? status;
}

/// Mecánico activo para el selector de asignación (Q2, GET .../mechanics).
class Mechanic {
  const Mechanic({
    required this.id,
    required this.name,
    required this.username,
  });

  final int id;
  final String name;
  final String username;

  factory Mechanic.fromJson(Map<String, dynamic> json) => Mechanic(
        id: (json['id'] as num).toInt(),
        name: json['name'] as String? ?? '',
        username: json['username'] as String? ?? '',
      );
}
