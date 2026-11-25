/// Registro de la bitácora de acciones sensibles (Sprint 7, US10,
/// contracts/audit-log.md). Solo lectura: nada se edita ni se borra.
class AuditEntry {
  const AuditEntry({
    required this.id,
    this.createdAt,
    this.userId,
    required this.actor,
    required this.action,
    this.entityType,
    this.entityId,
    this.detail,
  });

  final int id;
  final String? createdAt;
  final int? userId;
  final String actor;
  final String action;
  final String? entityType;
  final int? entityId;
  final String? detail;

  factory AuditEntry.fromJson(Map<String, dynamic> json) => AuditEntry(
        id: (json['id'] as num).toInt(),
        createdAt: json['createdAt'] as String?,
        userId: (json['userId'] as num?)?.toInt(),
        actor: json['actor'] as String? ?? '',
        action: json['action'] as String? ?? '',
        entityType: json['entityType'] as String?,
        entityId: (json['entityId'] as num?)?.toInt(),
        detail: json['detail'] as String?,
      );

  /// Fecha y hora legibles: `dd/mm/aaaa hh:mm`.
  String get fechaLegible {
    final texto = createdAt;
    if (texto == null || texto.length < 16) return texto ?? '';
    return '${texto.substring(8, 10)}/${texto.substring(5, 7)}/${texto.substring(0, 4)} ${texto.substring(11, 16)}';
  }

  /// Etiqueta en español de la acción (catálogo cerrado del contrato).
  String get etiquetaAccion => etiquetasDeAccion[action] ?? action;

  /// Entidad afectada, p. ej. «Refacción #3».
  String get etiquetaEntidad {
    final tipo = switch (entityType) {
      'USER' => 'Usuario',
      'SETTINGS' => 'Configuración',
      'PART' => 'Refacción',
      'ORDER_PART' => 'Línea de refacción',
      'PAYMENT' => 'Pago',
      'TERMS' => 'Términos',
      'SESSION' => 'Sesión',
      null => '',
      final otro => otro,
    };
    if (tipo.isEmpty) return '—';
    return entityId == null ? tipo : '$tipo #$entityId';
  }

  /// Catálogo cerrado de acciones con su etiqueta en español.
  static const Map<String, String> etiquetasDeAccion = {
    'LOGIN_FAILED': 'Inicio de sesión fallido',
    'ACCOUNT_LOCKED': 'Cuenta bloqueada',
    'USER_CREATED': 'Usuario creado',
    'USER_UPDATED': 'Usuario modificado',
    'SETTINGS_UPDATED': 'Configuración modificada',
    'PART_PRICE_CHANGED': 'Precio de refacción cambiado',
    'ORDER_PART_PRICE_CORRECTED': 'Precio de línea corregido',
    'PAYMENT_CANCELLED': 'Pago cancelado',
    'TERMS_PUBLISHED': 'Términos publicados',
  };
}

/// Página de la bitácora.
class AuditPage {
  const AuditPage({
    required this.page,
    required this.pageSize,
    required this.total,
    required this.items,
  });

  final int page;
  final int pageSize;
  final int total;
  final List<AuditEntry> items;

  int get totalPaginas => total == 0 ? 1 : ((total + pageSize - 1) ~/ pageSize);

  factory AuditPage.fromJson(Map<String, dynamic> json) => AuditPage(
        page: (json['page'] as num?)?.toInt() ?? 1,
        pageSize: (json['pageSize'] as num?)?.toInt() ?? 50,
        total: (json['total'] as num?)?.toInt() ?? 0,
        items: [
          for (final e in (json['items'] as List? ?? const []))
            AuditEntry.fromJson(Map<String, dynamic>.from(e as Map)),
        ],
      );
}
