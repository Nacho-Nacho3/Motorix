/// Cliente por avisar (Sprint 6, US7, contrato:
/// specs/006-notificaciones-internas/contracts/client-notices.md).
/// El sistema no envía mensajes: la lista solo muestra a quién hay que
/// llamar y por qué hecho (CA-7).
class ClientNotice {
  const ClientNotice({
    required this.id,
    required this.clientId,
    required this.clientName,
    required this.phone,
    required this.motive,
    required this.motiveLabel,
    required this.sourceId,
    required this.detail,
    required this.note,
    required this.createdAt,
  });

  final int id;
  final int clientId;
  final String clientName;
  final String phone;

  /// `ORDER_READY`, `APPOINTMENT_TOMORROW`, `MAINTENANCE_UPCOMING` o
  /// `MAINTENANCE_OVERDUE`.
  final String motive;
  final String motiveLabel;

  /// Id del hecho (orden, cita o mantenimiento).
  final int sourceId;
  final String detail;
  final String? note;
  final String createdAt;

  /// Identidad del aviso pendiente: un cliente puede tener varios motivos.
  String get clave => '$clientId:$motive:$sourceId';

  factory ClientNotice.fromJson(Map<String, dynamic> json) => ClientNotice(
        id: (json['id'] as num?)?.toInt() ?? 0,
        clientId: (json['clientId'] as num?)?.toInt() ?? 0,
        clientName: json['clientName'] as String? ?? '',
        phone: json['phone'] as String? ?? '',
        motive: json['motive'] as String? ?? '',
        motiveLabel: json['motiveLabel'] as String? ?? '',
        sourceId: (json['sourceId'] as num?)?.toInt() ?? 0,
        detail: json['detail'] as String? ?? '',
        note: json['note'] as String?,
        createdAt: json['createdAt'] as String? ?? '',
      );
}
