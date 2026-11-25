import 'package:flutter/foundation.dart';

import '../models/audit_entry.dart';
import '../services/api_client.dart';

/// Consulta de la bitácora (Sprint 7, US10, CA-20): filtros de fecha, usuario y
/// acción, paginación y estados de carga, vacío y error. Solo lectura.
class AuditProvider extends ChangeNotifier {
  AuditProvider(this.api);

  final ApiClient api;

  AuditPage? pagina;
  bool cargando = false;
  String? error;

  // Filtros vigentes (`YYYY-MM-DD` para las fechas).
  String? desde;
  String? hasta;
  int? usuarioId;
  String? accion;

  static const int tamanoPagina = 20;

  /// Error de validación de los filtros (p. ej. fecha final anterior a la inicial).
  String? errorFiltros;

  /// Aplica los filtros y vuelve a la primera página.
  Future<void> filtrar({
    String? desde,
    String? hasta,
    int? usuarioId,
    String? accion,
  }) async {
    if (desde != null && hasta != null && hasta.compareTo(desde) < 0) {
      errorFiltros = 'La fecha final no puede ser anterior a la inicial.';
      notifyListeners();
      return;
    }
    errorFiltros = null;
    this.desde = desde;
    this.hasta = hasta;
    this.usuarioId = usuarioId;
    this.accion = accion;
    await cargar(page: 1);
  }

  Future<void> limpiarFiltros() => filtrar();

  Future<void> cargar({int page = 1}) async {
    cargando = true;
    error = null;
    notifyListeners();
    try {
      final datos = await ApiClient.conRed(
        () => api.listarBitacora(
          from: desde,
          to: hasta,
          userId: usuarioId,
          action: accion,
          page: page,
          pageSize: tamanoPagina,
        ),
      );
      pagina = AuditPage.fromJson(datos);
    } on ApiError catch (e) {
      error = e.message;
    } catch (_) {
      error = 'No se pudo cargar la bitácora.';
    }
    cargando = false;
    notifyListeners();
  }
}
