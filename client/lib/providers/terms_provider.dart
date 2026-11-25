import 'package:flutter/foundation.dart';

import '../models/terms.dart';
import '../services/api_client.dart';

/// Términos y condiciones y aviso de privacidad (Sprint 7, US9, FR-018 a
/// FR-021). Sirve a la pantalla de aceptación (cualquier usuario) y a la
/// sección de Configuración (publicar y ver aceptaciones, solo ADMIN).
class TermsProvider extends ChangeNotifier {
  TermsProvider(this.api);

  final ApiClient api;

  TermsVersion? vigente;
  bool cargando = false;
  String? error;

  bool aceptando = false;

  /// Error del último intento de aceptar o publicar.
  String? errorAccion;

  TermsAcceptancesPage? aceptaciones;
  bool cargandoAceptaciones = false;
  String? errorAceptaciones;

  Future<void> cargarVigente() async {
    cargando = true;
    error = null;
    notifyListeners();
    try {
      final datos = await ApiClient.conRed(() => api.obtenerTerminosVigentes());
      vigente = TermsVersion.fromJson(datos);
    } on ApiError catch (e) {
      error = e.message;
    } catch (_) {
      error = 'No se pudieron cargar los términos y condiciones.';
    }
    cargando = false;
    notifyListeners();
  }

  /// Acepta la versión mostrada. Devuelve `true` si quedó aceptada. Si se
  /// publicó otra mientras el usuario leía, recarga la vigente y devuelve
  /// `false` con [versionCambio] verdadero.
  bool versionCambio = false;

  Future<bool> aceptar() async {
    final mostrada = vigente;
    if (mostrada == null) return false;
    aceptando = true;
    errorAccion = null;
    versionCambio = false;
    notifyListeners();
    var aceptada = false;
    try {
      await ApiClient.conRed(() => api.aceptarTerminos(mostrada.version));
      aceptada = true;
    } on ApiError catch (e) {
      if (e.code == 'VALIDATION_ERROR') {
        // Se publicó otra versión mientras se leía: se recarga la vigente.
        versionCambio = true;
        errorAccion =
            'Se publicó una versión nueva de los términos. Léela y vuelve a aceptar.';
        aceptando = false;
        await cargarVigente();
        return false;
      }
      errorAccion = e.message;
    } catch (_) {
      errorAccion = 'No se pudo registrar la aceptación.';
    }
    aceptando = false;
    notifyListeners();
    return aceptada;
  }

  /// «No acepto»: avisa al backend (ruta exenta) y deja que la sesión se cierre.
  Future<void> rechazar() async {
    try {
      await ApiClient.conRed(() => api.cerrarSesionApi());
    } catch (_) {
      // El cierre local ocurre igual aunque el aviso no llegue.
    }
  }

  /// Publica una versión nueva (ADMIN). Devuelve `true` si se publicó.
  Future<bool> publicar({
    required String termsText,
    required String privacyText,
  }) async {
    errorAccion = null;
    notifyListeners();
    try {
      await ApiClient.conRed(
        () => api.publicarTerminos({
          'termsText': termsText,
          'privacyText': privacyText,
        }),
      );
      return true;
    } on ApiError catch (e) {
      errorAccion = e.message;
    } catch (_) {
      errorAccion = 'No se pudo publicar la versión.';
    }
    notifyListeners();
    return false;
  }

  Future<void> cargarAceptaciones({int page = 1, int pageSize = 20}) async {
    cargandoAceptaciones = true;
    errorAceptaciones = null;
    notifyListeners();
    try {
      final datos = await ApiClient.conRed(
        () => api.listarAceptacionesDeTerminos(page: page, pageSize: pageSize),
      );
      aceptaciones = TermsAcceptancesPage.fromJson(datos);
    } on ApiError catch (e) {
      errorAceptaciones = e.message;
    } catch (_) {
      errorAceptaciones = 'No se pudieron cargar las aceptaciones.';
    }
    cargandoAceptaciones = false;
    notifyListeners();
  }
}
