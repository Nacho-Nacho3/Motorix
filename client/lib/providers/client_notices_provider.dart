import 'package:flutter/foundation.dart';

import '../models/client_notice.dart';
import '../services/api_client.dart';

/// Estado de la lista de clientes por avisar (Sprint 6, US7, FR-010, CA-11).
/// Solo ADMIN y recepción llegan aquí; el backend responde 403 al mecánico.
class ClientNoticesProvider extends ChangeNotifier {
  ClientNoticesProvider(this.api);

  final ApiClient api;

  List<ClientNotice> avisos = const [];
  bool cargando = true;
  String? error;

  /// Mensaje del último intento fallido de registrar un aviso.
  String? errorAccion;

  Future<void> cargar() async {
    cargando = true;
    error = null;
    notifyListeners();

    try {
      final datos = await ApiClient.conRed(api.listarClientesPorAvisar);
      avisos = [
        for (final item in datos)
          ClientNotice.fromJson(Map<String, dynamic>.from(item as Map)),
      ];
      cargando = false;
      notifyListeners();
    } catch (excepcion) {
      cargando = false;
      error = excepcion is ApiError
          ? excepcion.message
          : 'No se pudo cargar la lista de clientes por avisar.';
      notifyListeners();
    }
  }

  Future<void> reintentar() => cargar();

  /// «Ya lo hablé» (CA-11): registra quién avisó y cuándo (lo guarda el
  /// backend) y quita solo esa fila; el mismo cliente conserva sus otros
  /// motivos. Devuelve true si se registró.
  Future<bool> marcarAvisado(ClientNotice aviso, {String? nota}) async {
    errorAccion = null;
    try {
      await ApiClient.conRed(
        () => api.registrarAvisoCliente(
          clientId: aviso.clientId,
          type: aviso.motive,
          sourceId: aviso.sourceId,
          note: nota,
        ),
      );
      avisos = [
        for (final item in avisos)
          if (item.clave != aviso.clave) item,
      ];
      notifyListeners();
      return true;
    } catch (excepcion) {
      errorAccion = excepcion is ApiError
          ? excepcion.message
          : 'No se pudo registrar el aviso.';
      notifyListeners();
      return false;
    }
  }
}
