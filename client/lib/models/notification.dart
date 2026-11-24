/// Aviso del centro de notificaciones internas (Sprint 6, contrato:
/// specs/006-notificaciones-internas/contracts/notifications.md).
class NotificationItem {
  const NotificationItem({
    required this.key,
    required this.read,
    required this.title,
    required this.detail,
    required this.severity,
    required this.navigation,
  });

  /// Identidad `TIPO:id:ESTADO` (D-04) que usa POST /notifications/read.
  final String key;

  /// true si el usuario ya lo leyó; el ítem sigue visible hasta que el
  /// hecho desaparezca (CA-6).
  final bool read;

  final String title;
  final String detail;
  final String severity;
  final NotificationNavigation navigation;

  factory NotificationItem.fromJson(Map<String, dynamic> json) =>
      NotificationItem(
        key: json['key'] as String? ?? '',
        read: json['read'] as bool? ?? false,
        title: json['title'] as String? ?? '',
        detail: json['detail'] as String? ?? '',
        severity: json['severity'] as String? ?? '',
        navigation: NotificationNavigation.fromJson(
          json['navigation'] as Map<String, dynamic>? ?? const {},
        ),
      );
}

/// Pantalla relacionada que abre el aviso al seleccionarlo (FR-007).
class NotificationNavigation {
  const NotificationNavigation({required this.route, required this.entityId});

  final String route;
  final int entityId;

  factory NotificationNavigation.fromJson(Map<String, dynamic> json) =>
      NotificationNavigation(
        route: json['route'] as String? ?? '',
        entityId: (json['entityId'] as num?)?.toInt() ?? 0,
      );
}

/// Grupo de avisos por tipo; siempre están los 4 aunque estén vacíos
/// para que la estructura no cambie por rol (FR-002).
class NotificationGroup {
  const NotificationGroup({
    required this.type,
    required this.label,
    required this.items,
  });

  final String type;
  final String label;
  final List<NotificationItem> items;

  int get totalAvisos => items.length;

  factory NotificationGroup.fromJson(Map<String, dynamic> json) =>
      NotificationGroup(
        type: json['type'] as String? ?? '',
        label: json['label'] as String? ?? '',
        items: [
          for (final item in (json['items'] as List<dynamic>? ?? const []))
            NotificationItem.fromJson(item as Map<String, dynamic>),
        ],
      );
}
