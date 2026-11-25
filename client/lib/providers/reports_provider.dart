import 'package:flutter/foundation.dart';

import '../models/report_result.dart';
import '../services/api_client.dart';

/// Periodos rápidos del selector de reportes.
enum AtajoPeriodo { hoy, semana, mes, libre }

/// Reportes (Sprint 7, US4 a US7, solo ADMIN). Guarda el periodo elegido, que
/// comparten todas las pestañas, y el resultado de cada reporte. Todo se calcula
/// en el backend en cada consulta (RN-10); aquí solo se representa.
class ReportsProvider extends ChangeNotifier {
  ReportsProvider(this.api, {DateTime Function()? ahora})
      : _ahora = ahora ?? DateTime.now {
    aplicarAtajo(AtajoPeriodo.mes, recargar: false);
  }

  final ApiClient api;
  final DateTime Function() _ahora;

  /// Máximo de días del periodo (el backend también lo exige).
  static const int maxDias = 366;

  AtajoPeriodo atajo = AtajoPeriodo.mes;
  late String desde;
  late String hasta;

  /// Error de validación del periodo (rango inválido o demasiado largo).
  String? errorPeriodo;

  final Map<String, ReportResult> resultados = {};
  final Map<String, bool> cargando = {};
  final Map<String, String> errores = {};

  static String formato(DateTime dia) =>
      '${dia.year.toString().padLeft(4, '0')}-${dia.month.toString().padLeft(2, '0')}-${dia.day.toString().padLeft(2, '0')}';

  /// Días del periodo contando ambos extremos; `null` si alguna fecha no es válida.
  static int? diasInclusivos(String desde, String hasta) {
    final a = DateTime.tryParse(desde);
    final b = DateTime.tryParse(hasta);
    if (a == null || b == null) return null;
    return DateTime.utc(b.year, b.month, b.day)
            .difference(DateTime.utc(a.year, a.month, a.day))
            .inDays +
        1;
  }

  /// Aplica un periodo rápido: hoy, semana (lunes a hoy) o mes (día 1 a hoy).
  void aplicarAtajo(AtajoPeriodo nuevo, {bool recargar = true}) {
    final hoy = _ahora();
    atajo = nuevo;
    errorPeriodo = null;
    switch (nuevo) {
      case AtajoPeriodo.hoy:
        desde = hasta = formato(hoy);
      case AtajoPeriodo.semana:
        desde = formato(hoy.subtract(Duration(days: hoy.weekday - 1)));
        hasta = formato(hoy);
      case AtajoPeriodo.mes:
        desde = formato(DateTime(hoy.year, hoy.month, 1));
        hasta = formato(hoy);
      case AtajoPeriodo.libre:
        break;
    }
    notifyListeners();
    if (recargar) _recargarCargados();
  }

  /// Rango libre. Devuelve `false` (y deja `errorPeriodo`) si no es válido.
  bool aplicarRango(String nuevoDesde, String nuevoHasta) {
    final dias = diasInclusivos(nuevoDesde, nuevoHasta);
    if (dias == null) {
      errorPeriodo = 'Elige fechas válidas para el periodo.';
    } else if (dias < 1) {
      errorPeriodo = 'La fecha final no puede ser anterior a la inicial.';
    } else if (dias > maxDias) {
      errorPeriodo = 'El periodo no puede pasar de $maxDias días.';
    } else {
      errorPeriodo = null;
    }
    atajo = AtajoPeriodo.libre;
    if (errorPeriodo != null) {
      notifyListeners();
      return false;
    }
    desde = nuevoDesde;
    hasta = nuevoHasta;
    notifyListeners();
    _recargarCargados();
    return true;
  }

  void _recargarCargados() {
    for (final nombre in resultados.keys.toList()) {
      cargar(nombre);
    }
  }

  /// Carga un reporte del periodo vigente.
  Future<void> cargar(String nombre) async {
    cargando[nombre] = true;
    errores.remove(nombre);
    notifyListeners();
    try {
      final datos = await ApiClient.conRed(
        () => api.obtenerReporte(nombre, desde: desde, hasta: hasta),
      );
      resultados[nombre] = ReportResult.fromJson(datos);
    } on ApiError catch (e) {
      errores[nombre] = e.message;
    } catch (_) {
      errores[nombre] = 'No se pudo cargar el reporte.';
    }
    cargando[nombre] = false;
    notifyListeners();
  }

  Future<void> cargarIngresos() => cargar('income');
}
