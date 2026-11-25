import 'package:flutter/foundation.dart';

import '../models/service_type.dart';
import '../services/api_client.dart';

/// Catálogo de tipos de servicio (Sprint 7, US3, FR-005). El listado es solo
/// para ADMIN; el `lookup` (solo activos) lo usan los tres roles en el
/// formulario de servicio de la orden.
class ServiceTypesProvider extends ChangeNotifier {
  ServiceTypesProvider(this.api);

  final ApiClient api;

  List<ServiceType> tipos = [];
  bool cargando = false;
  String? error;

  /// Tipos activos para el selector (sin contadores).
  List<ServiceType> activos = [];

  Future<void> cargar() async {
    cargando = true;
    error = null;
    notifyListeners();
    try {
      final datos = await ApiClient.conRed(() => api.listarTiposDeServicio());
      tipos = datos
          .map((e) => ServiceType.fromJson(Map<String, dynamic>.from(e as Map)))
          .toList();
    } on ApiError catch (e) {
      error = e.message;
    } catch (_) {
      error = 'No se pudo cargar el catálogo de tipos de servicio.';
    }
    cargando = false;
    notifyListeners();
  }

  /// Tipos activos para el selector del formulario de servicio.
  Future<void> lookup() async {
    try {
      final datos = await ApiClient.conRed(() => api.lookupTiposDeServicio());
      activos = datos
          .map((e) => ServiceType.fromJson(Map<String, dynamic>.from(e as Map)))
          .toList();
      notifyListeners();
    } catch (_) {
      // Sin selector el servicio se registra sin tipo, como antes.
      activos = [];
      notifyListeners();
    }
  }

  /// Alta; devuelve el error de la API o `null`.
  Future<ApiError?> crear({
    required String nombre,
    int? dias,
    int? kilometros,
  }) async {
    try {
      await ApiClient.conRed(
        () => api.crearTipoDeServicio({
          'name': nombre,
          'intervalDays': dias,
          'intervalKm': kilometros,
        }),
      );
      await cargar();
      return null;
    } on ApiError catch (e) {
      return e;
    }
  }

  /// Edición de nombre e intervalos (`null` quita un intervalo).
  Future<ApiError?> actualizar(
    int id, {
    required String nombre,
    int? dias,
    int? kilometros,
  }) =>
      _patch(id, {
        'name': nombre,
        'intervalDays': dias,
        'intervalKm': kilometros,
      });

  /// Activa o desactiva (nunca se borra, CA-4).
  Future<ApiError?> cambiarEstado(int id, {required bool activo}) =>
      _patch(id, {'active': activo});

  Future<ApiError?> _patch(int id, Map<String, dynamic> cuerpo) async {
    try {
      await ApiClient.conRed(() => api.actualizarTipoDeServicio(id, cuerpo));
      await cargar();
      return null;
    } on ApiError catch (e) {
      return e;
    }
  }
}
