import 'package:flutter/foundation.dart';

import '../models/user.dart';
import '../services/api_client.dart';

/// Sesión de la aplicación: login, token Bearer y usuario actual.
class SessionProvider extends ChangeNotifier {
  SessionProvider(this.api);

  final ApiClient api;

  User? usuario;
  bool cargando = false;
  String? error;
  DateTime? expiraEn;

  /// T017: recarga del centro de avisos al iniciar sesión (D-03, US1).
  /// Lo conecta main.dart al crear los providers; sin este disparo, la
  /// campana solo se enteraría al abrir el panel o cambiar de sección.
  void Function()? alIniciarSesion;

  bool get autenticado => usuario != null;

  bool get sesionExpirada =>
      expiraEn != null && DateTime.now().isAfter(expiraEn!);

  Future<bool> iniciarSesion(String identifier, String password) async {
    cargando = true;
    error = null;
    notifyListeners();

    try {
      final datos = await ApiClient.conRed(
        () => api.post('/auth/login', {
          'identifier': identifier,
          'password': password,
        }),
      ) as Map<String, dynamic>;

      api.token = datos['token'] as String?;
      usuario = User.fromJson(datos['user'] as Map<String, dynamic>);
      final segundos = (datos['expiresIn'] as num?)?.toInt() ?? 28800;
      expiraEn = DateTime.now().add(Duration(seconds: segundos));
      // D-03: la campana se recarga en el mismo viaje del inicio de sesión.
      alIniciarSesion?.call();
      return true;
    } on ApiError catch (e) {
      error = e.message;
      return false;
    } finally {
      cargando = false;
      notifyListeners();
    }
  }

  Future<void> cerrarSesion() async {
    api.token = null;
    usuario = null;
    expiraEn = null;
    error = null;
    notifyListeners();
  }

  /// Cambia la contraseña del usuario de la sesión.
  /// Devuelve `null` si todo fue bien o el mensaje de error en español.
  Future<String?> cambiarPassword({
    required String currentPassword,
    required String newPassword,
  }) async {
    try {
      await ApiClient.conRed(
        () => api.post('/auth/change-password', {
          'currentPassword': currentPassword,
          'newPassword': newPassword,
        }),
      );
      return null;
    } on ApiError catch (e) {
      // Guard de expiración: un 401 en cualquier acción cierra la sesión.
      if (e.status == 401) await cerrarSesion();
      return e.message;
    }
  }

  /// Llamar cuando una pantalla reciba un error de la API:
  /// devuelve `true` si la sesión estaba caducada y se cerró.
  Future<bool> procesarErrorSesion(ApiError e) async {
    if (e.status == 401) {
      await cerrarSesion();
      return true;
    }
    return false;
  }
}
