import 'package:flutter/foundation.dart';

import '../models/appointment.dart';
import '../services/api_client.dart';

/// Estado de la agenda de citas (US1).
class AppointmentsProvider extends ChangeNotifier {
  AppointmentsProvider(this.api);

  final ApiClient api;

  List<Appointment> citas = [];
  int total = 0;
  bool cargando = true;
  String? error;
  String busqueda = '';
  String? filtroFecha;
  String? filtroEstado;

  /// Carga la agenda con los filtros activos (fecha del día, estado, texto).
  Future<void> cargar({String? q, String? fecha, String? estado}) async {
    if (q != null) busqueda = q;
    if (fecha != null) filtroFecha = fecha;
    if (estado != null) filtroEstado = estado;
    cargando = true;
    error = null;
    notifyListeners();

    try {
      final datos = await ApiClient.conRed(
        () => api.get('/appointments', query: {
          if (busqueda.isNotEmpty) 'q': busqueda,
          if (filtroFecha != null && filtroFecha!.isNotEmpty)
            'date': filtroFecha!,
          if (filtroEstado != null && filtroEstado!.isNotEmpty)
            'status': filtroEstado!,
        }),
      ) as Map<String, dynamic>;

      citas = (datos['appointments'] as List)
          .map((item) => Appointment.fromJson(item as Map<String, dynamic>))
          .toList();
      total = (datos['total'] as num?)?.toInt() ?? citas.length;
    } on ApiError catch (e) {
      error = e.message;
    } finally {
      cargando = false;
      notifyListeners();
    }
  }

  /// Limpia el filtro de fecha (vuelve a la agenda completa).
  Future<void> limpiarFecha() => cargar(fecha: '');

  /// Limpia el filtro de estado.
  Future<void> limpiarEstado() => cargar(estado: '');

  /// Da de alta una cita. Devuelve `null` si salió bien o el error de la API
  /// (el formulario decide qué hacer).
  Future<ApiError?> registrar({
    required int clientId,
    required int vehicleId,
    required String date,
    required String time,
    required String reason,
    String? notes,
  }) async {
    try {
      await ApiClient.conRed(
        () => api.post('/appointments', {
          'clientId': clientId,
          'vehicleId': vehicleId,
          'date': date,
          'time': time,
          'reason': reason,
          if (notes != null && notes.isNotEmpty) 'notes': notes,
        }),
      );
      await cargar();
      return null;
    } on ApiError catch (e) {
      return e;
    }
  }

  /// Edita fecha, hora, motivo u observaciones de una cita activa (FR-003).
  Future<ApiError?> editar({
    required int id,
    required String date,
    required String time,
    required String reason,
    String? notes,
  }) async {
    try {
      await ApiClient.conRed(
        () => api.patch('/appointments/$id', {
          'date': date,
          'time': time,
          'reason': reason,
          'notes': notes,
        }),
      );
      await cargar();
      return null;
    } on ApiError catch (e) {
      return e;
    }
  }

  /// Cancela una cita con confirmación previa en la interfaz (FR-004).
  Future<ApiError?> cancelar(int id) async {
    try {
      await ApiClient.conRed(
        () => api.patch('/appointments/$id', {'status': 'CANCELED'}),
      );
      await cargar();
      return null;
    } on ApiError catch (e) {
      return e;
    }
  }
}
