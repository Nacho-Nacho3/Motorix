/// Uso de una refacción en una orden de servicio
/// (contrato: specs/003-historial-mantenimiento-inventario/contracts/order-parts.md).
///
/// Cada fila es un evento inmutable: repetir la misma refacción crea otro
/// registro con su propia salida de inventario (R-06, sin edición ni borrado).
class OrderPart {
  const OrderPart({
    required this.id,
    required this.orderId,
    required this.partId,
    required this.partCode,
    required this.name,
    required this.quantity,
    this.createdBy,
    this.createdAt,
  });

  final int id;
  final int orderId;
  final int partId;

  /// Datos de la refacción servidos con la fila (join con `parts`).
  final String partCode;
  final String name;

  /// Cantidad utilizada (> 0, VO-02).
  final int quantity;

  final int? createdBy;
  final String? createdAt;

  factory OrderPart.fromJson(Map<String, dynamic> json) => OrderPart(
        id: (json['id'] as num).toInt(),
        orderId: (json['orderId'] as num).toInt(),
        partId: (json['partId'] as num).toInt(),
        partCode: json['partCode'] as String? ?? '',
        name: json['name'] as String? ?? '',
        quantity: (json['quantity'] as num?)?.toInt() ?? 0,
        createdBy: (json['createdBy'] as num?)?.toInt(),
        createdAt: json['createdAt'] as String?,
      );
}
