/// Movimiento del libro de inventario
/// (contrato: specs/003-historial-mantenimiento-inventario/contracts/inventory.md).
class InventoryMovement {
  const InventoryMovement({
    required this.id,
    required this.partId,
    required this.movementType,
    required this.quantity,
    this.orderId,
    this.reason,
    required this.createdBy,
    this.createdAt,
  });

  final int id;
  final int partId;

  /// `IN` | `OUT` | `ADJUSTMENT` (catálogo cerrado, Q2).
  final String movementType;

  /// Con signo: en `ADJUSTMENT` + suma y − resta.
  final int quantity;

  /// Solo se llena en el `OUT` por uso en una orden (RN-7).
  final int? orderId;
  final String? reason;
  final int createdBy;
  final String? createdAt;

  /// Etiquetas en español de los tipos de movimiento (T058).
  static const Map<String, String> etiquetas = {
    'IN': 'Entrada',
    'OUT': 'Salida',
    'ADJUSTMENT': 'Ajuste',
  };

  String get etiquetaTipo => etiquetas[movementType] ?? movementType;

  factory InventoryMovement.fromJson(Map<String, dynamic> json) =>
      InventoryMovement(
        id: (json['id'] as num).toInt(),
        partId: (json['partId'] as num).toInt(),
        movementType: json['movementType'] as String? ?? '',
        quantity: (json['quantity'] as num?)?.toInt() ?? 0,
        orderId: (json['orderId'] as num?)?.toInt(),
        reason: json['reason'] as String?,
        createdBy: (json['createdBy'] as num?)?.toInt() ?? 0,
        createdAt: json['createdAt'] as String?,
      );
}
