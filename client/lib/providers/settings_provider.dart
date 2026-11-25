import 'package:flutter/foundation.dart';

import '../models/app_settings.dart';
import '../services/api_client.dart';

/// Configuración del taller (Sprint 7, US1, T028, FR-001, FR-017).
///
/// Consulta y actualiza `/api/settings` (solo ADMIN). Los estados de carga,
/// error y éxito los muestra la pantalla con `states_view.dart`.
class SettingsProvider extends ChangeNotifier {
  SettingsProvider(this.api);

  final ApiClient api;

  /// Configuración vigente; null hasta la primera carga.
  AppSettings? config;
  bool cargando = false;
  bool guardando = false;
  String? error;

  /// Error del último intento de guardado (se muestra junto al formulario).
  String? errorGuardado;

  /// Mensaje de éxito del último guardado.
  String? exito;

  /// Sección del último guardado ('taller' o 'margenes'): cada formulario
  /// muestra solo su propio error.
  String? seccionGuardada;

  Future<void> cargar() async {
    cargando = true;
    error = null;
    notifyListeners();
    try {
      final datos = await ApiClient.conRed(() => api.obtenerConfiguracion());
      config = AppSettings.fromJson(datos);
    } on ApiError catch (e) {
      error = e.message;
    } catch (_) {
      error = 'No se pudo cargar la configuración.';
    }
    cargando = false;
    notifyListeners();
  }

  /// Guarda los datos del taller. Devuelve `true` si el backend lo aceptó.
  Future<bool> guardarTaller({
    required String nombre,
    required String direccion,
    required String telefono,
  }) {
    return _guardar({
      'shop': {
        'name': nombre.trim(),
        'address': direccion.trim(),
        'phone': telefono.trim(),
      },
    }, 'Datos del taller guardados.', 'taller');
  }

  /// Guarda los márgenes de «Próximo» del mantenimiento (US2, FR-003).
  Future<bool> guardarMargenes({required int dias, required int kilometros}) {
    return _guardar({
      'maintenance': {'warnDays': dias, 'warnKm': kilometros},
    }, 'Márgenes de mantenimiento guardados.', 'margenes');
  }

  Future<bool> _guardar(
    Map<String, dynamic> cuerpo,
    String mensaje,
    String seccion,
  ) async {
    seccionGuardada = seccion;
    guardando = true;
    errorGuardado = null;
    exito = null;
    notifyListeners();
    var correcto = false;
    try {
      final datos =
          await ApiClient.conRed(() => api.actualizarConfiguracion(cuerpo));
      config = AppSettings.fromJson(datos);
      exito = mensaje;
      correcto = true;
    } on ApiError catch (e) {
      errorGuardado = e.message;
    } catch (_) {
      errorGuardado = 'No se pudo guardar la configuración.';
    }
    guardando = false;
    notifyListeners();
    return correcto;
  }

  /// Limpia los mensajes de éxito y de error al volver a editar.
  void limpiarMensajes() {
    if (exito == null && errorGuardado == null) return;
    exito = null;
    errorGuardado = null;
    notifyListeners();
  }
}
