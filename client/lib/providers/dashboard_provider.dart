import 'package:flutter/foundation.dart';

import '../models/dashboard_data.dart';
import '../services/api_client.dart';

/// Panel de control (US5, T056, CA-6, FR-012).
///
/// Consulta `GET /api/dashboard` (exclusivo de ADMIN) y guarda el resumen de
/// los 8 indicadores. El backend recalcula todo en cada consulta (RN-10), así
/// que `cargar()` es también la recarga manual del panel.
class DashboardProvider extends ChangeNotifier {
  DashboardProvider(this.api);

  final ApiClient api;

  /// Resumen de los 8 indicadores; null hasta la primera carga.
  ResumenPanel? resumen;

  /// Detalle de las 4 secciones; viaja en la MISMA respuesta que el resumen
  /// (SC-007, US6 T063) y se vuelve a pedir en cada `cargar()`.
  DetallePanel? detalle;
  bool cargando = false;
  String? error;

  /// Carga (o recarga) el panel. Los estados en español los muestra la
  /// pantalla con `LoadingView`/`ErrorView`.
  Future<void> cargar() async {
    cargando = true;
    error = null;
    notifyListeners();

    try {
      final datos = await ApiClient.conRed(() => api.get('/dashboard'));
      final mapa = datos as Map<String, dynamic>;
      final resumenJson = (mapa['summary'] as Map?)?.cast<String, dynamic>();
      resumen = resumenJson == null
          ? null
          : ResumenPanel.fromJson(resumenJson);
      detalle = DetallePanel.fromJson(mapa);
      cargando = false;
    } on ApiError catch (e) {
      cargando = false;
      error = e.message;
    } catch (_) {
      cargando = false;
      error = 'No se pudo cargar el panel.';
    }
    notifyListeners();
  }
}
