/// Modelos del historial de servicios de un vehículo
/// (contrato: specs/003-historial-mantenimiento-inventario/contracts/vehicle-history.md).
library;

/// Cabecera del historial: datos del vehículo (contrato: data.vehicle).
class HistoryVehicle {
  const HistoryVehicle({
    required this.id,
    required this.label,
    required this.clientName,
    required this.currentMileage,
  });

  final int id;
  final String label;
  final String clientName;
  final int currentMileage;

  factory HistoryVehicle.fromJson(Map<String, dynamic> json) => HistoryVehicle(
        id: (json['id'] as num).toInt(),
        label: json['label'] as String? ?? '',
        clientName: json['clientName'] as String? ?? '',
        currentMileage: (json['currentMileage'] as num?)?.toInt() ?? 0,
      );
}

/// Servicio ejecutado en la orden (contrato: data.entries[].services[]).
class HistoryService {
  const HistoryService({required this.description, required this.unitPrice});

  final String description;
  final String unitPrice;

  factory HistoryService.fromJson(Map<String, dynamic> json) => HistoryService(
        description: json['description'] as String? ?? '',
        unitPrice: json['unitPrice'] as String? ?? '0.00',
      );
}

/// Concepto de mano de obra de la orden (contrato: data.entries[].labor[]).
class HistoryLabor {
  const HistoryLabor({
    required this.concept,
    required this.hours,
    required this.hourlyRate,
  });

  final String concept;
  final String hours;
  final String hourlyRate;

  factory HistoryLabor.fromJson(Map<String, dynamic> json) => HistoryLabor(
        concept: json['concept'] as String? ?? '',
        hours: json['hours'] as String? ?? '0.00',
        hourlyRate: json['hourlyRate'] as String? ?? '0.00',
      );
}

/// Refacción usada en la orden (contrato: data.entries[].parts[]).
class HistoryPart {
  const HistoryPart({
    required this.partCode,
    required this.name,
    required this.quantity,
  });

  final String partCode;
  final String name;
  final int quantity;

  factory HistoryPart.fromJson(Map<String, dynamic> json) => HistoryPart(
        partCode: json['partCode'] as String? ?? '',
        name: json['name'] as String? ?? '',
        quantity: (json['quantity'] as num?)?.toInt() ?? 0,
      );
}

/// Entrada del historial: una orden terminada o entregada con sus ítems
/// (contrato: data.entries[]).
class HistoryEntry {
  const HistoryEntry({
    required this.orderId,
    required this.date,
    required this.status,
    required this.entryMileage,
    this.reportedProblem,
    this.diagnosis,
    this.services = const [],
    this.labor = const [],
    this.parts = const [],
    this.observations,
    this.recommendations,
    this.mechanicName,
  });

  final int orderId;
  final String date;
  final String status;
  final int entryMileage;
  final String? reportedProblem;
  final String? diagnosis;
  final List<HistoryService> services;
  final List<HistoryLabor> labor;
  final List<HistoryPart> parts;
  final String? observations;
  final String? recommendations;
  final String? mechanicName;

  factory HistoryEntry.fromJson(Map<String, dynamic> json) => HistoryEntry(
        orderId: (json['orderId'] as num).toInt(),
        date: json['date'] as String? ?? '',
        status: json['status'] as String? ?? '',
        entryMileage: (json['entryMileage'] as num?)?.toInt() ?? 0,
        reportedProblem: json['reportedProblem'] as String?,
        diagnosis: json['diagnosis'] as String?,
        services: (json['services'] as List<dynamic>? ?? [])
            .map((item) => HistoryService.fromJson(item as Map<String, dynamic>))
            .toList(),
        labor: (json['labor'] as List<dynamic>? ?? [])
            .map((item) => HistoryLabor.fromJson(item as Map<String, dynamic>))
            .toList(),
        parts: (json['parts'] as List<dynamic>? ?? [])
            .map((item) => HistoryPart.fromJson(item as Map<String, dynamic>))
            .toList(),
        observations: json['observations'] as String?,
        recommendations: json['recommendations'] as String?,
        mechanicName: json['mechanicName'] as String?,
      );

  /// Etiqueta en español del estado de la orden (contrato vehicle-history.md).
  String get etiquetaEstado => switch (status) {
        'DELIVERED' => 'Entregado',
        'FINISHED' => 'Terminado',
        _ => status,
      };

  /// Fecha del servicio en formato dd/MM/yyyy para la interfaz.
  String get fechaFormateada {
    final partes = date.split('-');
    if (partes.length != 3) return date;
    return '${partes[2]}/${partes[1]}/${partes[0]}';
  }
}
