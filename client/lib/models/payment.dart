/// Modelo de pago de una orden (contrato: specs/004-pagos-tickets-dashboard/
/// contracts/payments.md). Importes como cadena decimal con 2 decimales.
class Payment {
  const Payment({
    required this.id,
    required this.orderId,
    required this.amount,
    required this.method,
    required this.status,
    this.externalReference,
    required this.createdBy,
    required this.createdByName,
    this.createdAt,
    this.updatedAt,
  });

  final int id;
  final int orderId;

  /// Importe como cadena decimal con 2 decimales (contrato).
  final String amount;

  /// CASH | CARD | TRANSFER | MERCADO_PAGO.
  final String method;

  /// PENDING | PAID | REJECTED | CANCELLED.
  final String status;

  /// Referencia de Mercado Pago; null en métodos manuales (RN-14: nunca hay
  /// datos de tarjeta en esta respuesta).
  final String? externalReference;

  final int createdBy;
  final String createdByName;
  final String? createdAt;
  final String? updatedAt;

  /// Etiquetas en español de los métodos del negocio (FR-002, CA-2).
  static const Map<String, String> etiquetasMetodo = {
    'CASH': 'Efectivo',
    'CARD': 'Tarjeta',
    'TRANSFER': 'Transferencia',
    'MERCADO_PAGO': 'Mercado Pago',
  };

  /// Etiquetas en español de los estados (FR-003).
  static const Map<String, String> etiquetasEstado = {
    'PENDING': 'Pendiente',
    'PAID': 'Pagado',
    'REJECTED': 'Rechazado',
    'CANCELLED': 'Cancelado',
  };

  String get etiquetaMetodo => etiquetasMetodo[method] ?? method;
  String get etiquetaEstado => etiquetasEstado[status] ?? status;

  factory Payment.fromJson(Map<String, dynamic> json) => Payment(
        id: (json['id'] as num).toInt(),
        orderId: (json['orderId'] as num?)?.toInt() ?? 0,
        amount: _decimales(json['amount']),
        method: json['method'] as String? ?? '',
        status: json['status'] as String? ?? '',
        externalReference: json['externalReference'] as String?,
        createdBy: (json['createdBy'] as num?)?.toInt() ?? 0,
        createdByName: json['createdByName'] as String? ?? '',
        createdAt: json['createdAt'] as String?,
        updatedAt: json['updatedAt'] as String?,
      );

  static String _decimales(dynamic valor) {
    if (valor == null) return '0.00';
    final numero = num.tryParse(valor.toString());
    return numero == null ? '0.00' : numero.toStringAsFixed(2);
  }
}
