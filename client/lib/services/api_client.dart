import 'dart:convert';

import 'package:http/http.dart' as http;

/// Error de la API según el sobre {"ok":false,"error":{...}}.
class ApiError implements Exception {
  ApiError({
    required this.status,
    required this.code,
    required this.message,
    this.details = const [],
  });

  final int status;
  final String code;
  final String message;
  final List<Map<String, String>> details;

  /// Devuelve el primer mensaje de validación de un campo específico.
  String mensajeDeCampo(String campo) {
    for (final detalle in details) {
      if (detalle['field'] == campo) return detalle['message'] ?? message;
    }
    return message;
  }

  @override
  String toString() => message;
}

/// T015: cliente HTTP base con el sobre de respuesta único y token Bearer.
class ApiClient {
  ApiClient({this.baseUrl = 'http://localhost:3000/api'});

  final String baseUrl;
  String? token;

  /// Sprint 7 (US9, CA-19): se invoca cuando cualquier llamada responde
  /// `403 TERMS_NOT_ACCEPTED` (p. ej. se publicó una versión nueva a mitad de la
  /// sesión). La sesión la usa para mostrar la pantalla de aceptación sin
  /// cerrarse.
  void Function()? alTerminosNoAceptados;
  static const Duration _tiempoEspera = Duration(seconds: 15);

  Map<String, String> _encabezados({bool incluirJson = true}) {
    return {
      if (incluirJson) 'Content-Type': 'application/json',
      if (token != null && token!.isNotEmpty) 'Authorization': 'Bearer $token',
    };
  }

  Uri _uri(String path, [Map<String, String>? query]) {
    final base = Uri.parse(baseUrl);
    final ruta = path.startsWith('/') ? path.substring(1) : path;
    // El prefijo base termina sin barras: se añade el separador explícito
    // (sin él, /api + auth/login se convertía en /apiauth/login → 404).
    final baseSinBarra = base.path.endsWith('/')
        ? base.path.substring(0, base.path.length - 1)
        : base.path;
    return base.replace(path: '$baseSinBarra/$ruta', queryParameters: query);
  }

  Future<dynamic> get(String path, {Map<String, String>? query}) async {
    final respuesta = await http
        .get(_uri(path, query), headers: _encabezados(incluirJson: false))
        .timeout(_tiempoEspera);
    return _procesar(respuesta);
  }

  Future<dynamic> post(String path, Object cuerpo) async {
    final respuesta = await http
        .post(_uri(path), headers: _encabezados(), body: jsonEncode(cuerpo))
        .timeout(_tiempoEspera);
    return _procesar(respuesta);
  }

  Future<dynamic> patch(String path, Object cuerpo) async {
    final respuesta = await http
        .patch(_uri(path), headers: _encabezados(), body: jsonEncode(cuerpo))
        .timeout(_tiempoEspera);
    return _procesar(respuesta);
  }

  /// T061: DELETE sin cuerpo (bajas de servicios y mano de obra).
  Future<dynamic> delete(String path) async {
    final respuesta = await http
        .delete(_uri(path), headers: _encabezados(incluirJson: false))
        .timeout(_tiempoEspera);
    return _procesar(respuesta);
  }

  /// T016 (Sprint 6): contador y avisos agrupados del centro de
  /// notificaciones (contrato notifications.md); el sobre {ok,data} lo
  /// procesa `get`.
  Future<Map<String, dynamic>> listarNotificaciones() async {
    final datos = await get('/notifications');
    return Map<String, dynamic>.from(datos as Map);
  }

  /// T028 (US6): marca un aviso como leído (contrato notifications.md);
  /// devuelve `read` y el `unreadCount` recalculado por el backend.
  Future<Map<String, dynamic>> leerAviso(String key) async {
    final datos = await post('/notifications/read', {'key': key});
    return Map<String, dynamic>.from(datos as Map);
  }

  /// T056 (US7): clientes por avisar (contrato client-notices.md); `data`
  /// es una lista de pendientes, uno por (cliente, hecho).
  Future<List<dynamic>> listarClientesPorAvisar() async {
    final datos = await get('/client-notices');
    return List<dynamic>.from(datos as List);
  }

  /// T056 (US7): registra que se avisó al cliente por un hecho. La nota es
  /// opcional (D-07) y solo viaja cuando tiene contenido.
  Future<Map<String, dynamic>> registrarAvisoCliente({
    required int clientId,
    required String type,
    required int sourceId,
    String? note,
  }) async {
    final datos = await post('/client-notices', {
      'clientId': clientId,
      'type': type,
      'sourceId': sourceId,
      if (note != null && note.isNotEmpty) 'note': note,
    });
    return Map<String, dynamic>.from(datos as Map);
  }

  /// T029 (Sprint 7, US1): configuración del taller (contracts/settings.md).
  Future<Map<String, dynamic>> obtenerConfiguracion() async {
    final datos = await get('/settings');
    return Map<String, dynamic>.from(datos as Map);
  }

  /// T029: actualización parcial; devuelve la configuración completa.
  Future<Map<String, dynamic>> actualizarConfiguracion(
    Map<String, dynamic> cambios,
  ) async {
    final datos = await patch('/settings', cambios);
    return Map<String, dynamic>.from(datos as Map);
  }

  /// T074 (Sprint 7, US9): términos y aviso de privacidad
  /// (contracts/terms.md). `vigente` y `aceptar` están exentos del bloqueo.
  Future<Map<String, dynamic>> obtenerTerminosVigentes() async {
    final datos = await get('/terms/current');
    return Map<String, dynamic>.from(datos as Map);
  }

  Future<Map<String, dynamic>> aceptarTerminos(int version) async {
    final datos = await post('/terms/accept', {'version': version});
    return Map<String, dynamic>.from(datos as Map);
  }

  Future<Map<String, dynamic>> publicarTerminos(
    Map<String, dynamic> cuerpo,
  ) async {
    final datos = await post('/terms', cuerpo);
    return Map<String, dynamic>.from(datos as Map);
  }

  Future<Map<String, dynamic>> listarAceptacionesDeTerminos({
    int page = 1,
    int pageSize = 20,
  }) async {
    final datos = await get(
      '/terms/acceptances',
      query: {'page': '$page', 'pageSize': '$pageSize'},
    );
    return Map<String, dynamic>.from(datos as Map);
  }

  /// Aviso de cierre de sesión (ruta exenta del bloqueo por términos).
  Future<void> cerrarSesionApi() async {
    await post('/auth/logout', <String, dynamic>{});
  }

  /// T062 (Sprint 7, US8): propuesta de fecha y kilometraje del próximo
  /// mantenimiento a partir de la última orden terminada del vehículo; `null`
  /// cuando no hay propuesta (contracts/changes-to-existing.md).
  Future<Map<String, dynamic>?> proponerMantenimiento(int vehicleId) async {
    final datos = await get(
      '/maintenances/suggestion',
      query: {'vehicleId': '$vehicleId'},
    );
    final sugerencia = (datos as Map)['suggestion'];
    return sugerencia == null ? null : Map<String, dynamic>.from(sugerencia as Map);
  }

  /// T051 (Sprint 7, US3): catálogo de tipos de servicio
  /// (contracts/service-types.md). El listado es solo ADMIN.
  Future<List<dynamic>> listarTiposDeServicio() async {
    final datos = await get('/service-types');
    return List<dynamic>.from(datos as List);
  }

  /// Solo tipos activos, para el selector del formulario de servicio.
  Future<List<dynamic>> lookupTiposDeServicio() async {
    final datos = await get('/service-types/lookup');
    return List<dynamic>.from(datos as List);
  }

  Future<Map<String, dynamic>> crearTipoDeServicio(
    Map<String, dynamic> cuerpo,
  ) async {
    final datos = await post('/service-types', cuerpo);
    return Map<String, dynamic>.from(datos as Map);
  }

  Future<Map<String, dynamic>> actualizarTipoDeServicio(
    int id,
    Map<String, dynamic> cuerpo,
  ) async {
    final datos = await patch('/service-types/$id', cuerpo);
    return Map<String, dynamic>.from(datos as Map);
  }

  dynamic _procesar(http.Response respuesta) {
    Map<String, dynamic>? cuerpo;
    try {
      cuerpo = jsonDecode(respuesta.body) as Map<String, dynamic>;
    } catch (_) {
      cuerpo = null;
    }

    if (respuesta.statusCode >= 200 && respuesta.statusCode < 300) {
      if (cuerpo != null && cuerpo['ok'] == true) return cuerpo['data'];
      throw ApiError(
        status: respuesta.statusCode,
        code: 'BAD_RESPONSE',
        message: 'Respuesta inesperada del servidor.',
      );
    }

    final error = cuerpo != null && cuerpo['ok'] == false
        ? cuerpo['error'] as Map<String, dynamic>?
        : null;

    if (respuesta.statusCode == 403 && error?['code'] == 'TERMS_NOT_ACCEPTED') {
      alTerminosNoAceptados?.call();
    }

    return Future.error(
      ApiError(
        status: respuesta.statusCode,
        code: error?['code'] ?? 'UNKNOWN',
        message: error?['message'] ?? 'Ocurrió un error. Intenta de nuevo.',
        details: [
          if (error?['details'] is List)
            ...((error!['details'] as List).map(
              (item) => Map<String, String>.from(item as Map),
            )),
        ],
      ),
    );
  }

  /// Envuelve errores de red en ApiError con mensaje amigable en español.
  static Future<T> conRed<T>(Future<T> Function() operacion) async {
    try {
      return await operacion();
    } on ApiError {
      rethrow;
    } catch (_) {
      throw ApiError(
        status: 0,
        code: 'NETWORK_ERROR',
        message: 'No se pudo conectar con el servidor. Verifica que esté en ejecución.',
      );
    }
  }
}
