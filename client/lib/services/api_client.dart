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
