import 'package:flutter/foundation.dart';

import '../models/maintenance.dart';
import '../services/api_client.dart';

/// Estado del listado de mantenimientos (US3/US4, FR-004, FR-005, FR-018).
class MaintenancesProvider extends ChangeNotifier {
  MaintenancesProvider(this.api);

  final ApiClient api;

  /// Orden por urgencia exigido por SC-004 (Vencido → Próximo → Normal).
  static const _ordenEstados = {'OVERDUE': 0, 'UPCOMING': 1, 'NORMAL': 2};

  List<Maintenance> mantenimientos = [];
  int total = 0;
  bool cargando = true;
  String? error;

  /// Filtro por estado activo ('' = todos); viaja como ?state (SC-003).
  String filtroEstado = '';

  /// Carga el listado con los estados ya calculados por el backend.
  Future<void> cargar() async {
    cargando = true;
    error = null;
    notifyListeners();

    try {
      final datos = await ApiClient.conRed(
        () => api.get(
          '/maintenances',
          query: filtroEstado.isEmpty ? null : {'state': filtroEstado},
        ),
      );
      mantenimientos = [
        for (final item in (datos['maintenances'] as List<dynamic>? ?? []))
          Maintenance.fromJson(item as Map<String, dynamic>),
      ];
      total = (datos['total'] as num?)?.toInt() ?? mantenimientos.length;
      _ordenarPorUrgencia();
      cargando = false;
      notifyListeners();
    } catch (excepcion) {
      cargando = false;
      error = excepcion is ApiError
          ? excepcion.message
          : 'No se pudieron cargar los mantenimientos.';
      notifyListeners();
    }
  }

  /// Filtra por estado eligiendo un chip (SC-003): el backend recibe ?state.
  Future<void> filtrarPorEstado(String estado) async {
    filtroEstado = estado;
    await cargar();
  }

  /// Ordena por urgencia (OVERDUE → UPCOMING → NORMAL) y por fecha objetivo
  /// ascendente dentro de cada estado, dejando los registros sin fecha al final.
  void _ordenarPorUrgencia() {
    mantenimientos.sort((a, b) {
      final porEstado =
          (_ordenEstados[a.state] ?? 9) - (_ordenEstados[b.state] ?? 9);
      if (porEstado != 0) return porEstado;

      final fechaA = a.nextDueDate;
      final fechaB = b.nextDueDate;
      if (fechaA == null && fechaB == null) return a.id - b.id;
      if (fechaA == null) return 1;
      if (fechaB == null) return -1;
      return fechaA.compareTo(fechaB);
    });
  }

  /// Registra o reemplaza el mantenimiento del vehículo (RN-11, CA-2).
  /// Devuelve el error de la API o `null` si todo salió bien.
  Future<ApiError?> crear({
    required int vehicleId,
    String? nextDueDate,
    int? nextDueMileage,
    int? warnDays,
    int? warnKm,
    String? recommendations,
  }) async {
    try {
      await ApiClient.conRed(
        () => api.post('/maintenances', {
          'vehicleId': vehicleId,
          'nextDueDate': nextDueDate,
          'nextDueMileage': nextDueMileage,
          'warnDays': ?warnDays,
          'warnKm': ?warnKm,
          if (recommendations != null && recommendations.isNotEmpty)
            'recommendations': recommendations,
        }),
      );
      await cargar();
      return null;
    } on ApiError catch (excepcion) {
      return excepcion;
    }
  }

  /// Reintenta la carga tras un error.
  Future<void> reintentar() => cargar();
}
