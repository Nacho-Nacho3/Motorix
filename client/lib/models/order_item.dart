/// Servicio realizado en una orden
/// (contrato: POST .../services → data.service; detalle → data.services[]).
class ServiceOrderItem {
  const ServiceOrderItem({
    required this.id,
    required this.orderId,
    required this.description,
    this.unitPrice = 0,
    this.createdAt,
    this.serviceTypeId,
    this.serviceTypeName,
  });

  final int id;
  final int orderId;
  final String description;
  final double unitPrice;
  final String? createdAt;

  /// Sprint 7 (D-04): tipo del catálogo; null en las líneas sin tipo.
  final int? serviceTypeId;
  final String? serviceTypeName;

  factory ServiceOrderItem.fromJson(Map<String, dynamic> json) =>
      ServiceOrderItem(
        id: (json['id'] as num).toInt(),
        orderId: (json['orderId'] as num).toInt(),
        description: json['description'] as String? ?? '',
        unitPrice: (json['unitPrice'] as num?)?.toDouble() ?? 0,
        createdAt: json['createdAt'] as String?,
        serviceTypeId: (json['serviceTypeId'] as num?)?.toInt(),
        serviceTypeName: json['serviceTypeName'] as String?,
      );

  Map<String, dynamic> toJson() => {
        'id': id,
        'orderId': orderId,
        'description': description,
        'unitPrice': unitPrice,
        if (createdAt != null) 'createdAt': createdAt,
        if (serviceTypeId != null) 'serviceTypeId': serviceTypeId,
      };
}

/// Mano de obra registrada en una orden
/// (contrato: POST .../labor → data.labor; detalle → data.labor[]).
class LaborOrderItem {
  const LaborOrderItem({
    required this.id,
    required this.orderId,
    required this.concept,
    required this.hours,
    this.hourlyRate = 0,
    this.createdAt,
  });

  final int id;
  final int orderId;
  final String concept;
  final double hours;
  final double hourlyRate;
  final String? createdAt;

  factory LaborOrderItem.fromJson(Map<String, dynamic> json) =>
      LaborOrderItem(
        id: (json['id'] as num).toInt(),
        orderId: (json['orderId'] as num).toInt(),
        concept: json['concept'] as String? ?? '',
        hours: (json['hours'] as num?)?.toDouble() ?? 0,
        hourlyRate: (json['hourlyRate'] as num?)?.toDouble() ?? 0,
        createdAt: json['createdAt'] as String?,
      );

  Map<String, dynamic> toJson() => {
        'id': id,
        'orderId': orderId,
        'concept': concept,
        'hours': hours,
        'hourlyRate': hourlyRate,
        if (createdAt != null) 'createdAt': createdAt,
      };
}
