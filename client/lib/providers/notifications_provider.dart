import 'package:flutter/foundation.dart';

import '../models/notification.dart';
import '../services/api_client.dart';

/// Estado del centro de avisos (US1, FR-001, FR-002, FR-005, D-03).
/// Los avisos se recalculan en cada consulta: no hay caché (CA-2), solo
/// el contador y los grupos que devuelve el backend.
class NotificationsProvider extends ChangeNotifier {
  NotificationsProvider(this.api);

  final ApiClient api;

  int unreadCount = 0;
  List<NotificationGroup> groups = const [];
  bool cargando = false;
  String? error;

  /// Avisos actuales (suma de los ítems de todos los grupos).
  int get totalAvisos =>
      groups.fold(0, (total, grupo) => total + grupo.totalAvisos);

  /// Carga el contador y los avisos agrupados. Sin polling: se llama en los
  /// tres puntos de D-03 (inicio de sesión, apertura del panel y cambio de
  /// sección).
  Future<void> cargar() async {
    cargando = true;
    error = null;
    notifyListeners();

    try {
      final datos = await ApiClient.conRed(api.listarNotificaciones);
      unreadCount = (datos['unreadCount'] as num?)?.toInt() ?? 0;
      groups = [
        for (final item in (datos['groups'] as List<dynamic>? ?? const []))
          NotificationGroup.fromJson(item as Map<String, dynamic>),
      ];
      cargando = false;
      notifyListeners();
    } catch (excepcion) {
      cargando = false;
      error = excepcion is ApiError
          ? excepcion.message
          : 'No se pudieron cargar los avisos.';
      notifyListeners();
    }
  }

  /// Reintenta la carga tras un error.
  Future<void> reintentar() => cargar();
}
