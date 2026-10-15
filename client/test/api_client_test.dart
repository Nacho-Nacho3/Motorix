// Pruebas de integración del ApiClient contra un servidor HTTP local real.
// Detectan el bug de concatenación de rutas (/apiauth/login en lugar de
// /api/auth/login) que las pruebas con ApiClient simulado no podían cubrir.
import 'dart:convert';
import 'dart:io';

import 'package:flutter_test/flutter_test.dart';
import 'package:motorix_client/services/api_client.dart';

void main() {
  late HttpServer servidor;
  late List<String> rutasRecibidas;

  setUp(() async {
    servidor = await HttpServer.bind(InternetAddress.loopbackIPv4, 0);
    rutasRecibidas = [];
    servidor.listen((solicitud) async {
      rutasRecibidas.add('${solicitud.method} ${solicitud.uri.path}');
      solicitud.response
        ..statusCode = 201
        ..headers.contentType = ContentType.json
        ..write(jsonEncode({'ok': true, 'data': {'ok': true}}));
      await solicitud.response.close();
    });
  });

  tearDown(() async {
    await servidor.close(force: true);
  });

  test('get construye la ruta bajo /api con su separador', () async {
    final api = ApiClient(baseUrl: 'http://127.0.0.1:${servidor.port}/api');

    await api.get('/dashboard');

    expect(
      rutasRecibidas,
      contains('GET /api/dashboard'),
      reason: 'la ruta debe conservar el prefijo /api (fallaba como '
          '/apidashboard y devolvía "Recurso no encontrado.")',
    );
  });

  test('post construye el login bajo /api/auth/login', () async {
    final api = ApiClient(baseUrl: 'http://127.0.0.1:${servidor.port}/api');

    await api.post('/auth/login', {'identifier': 'admin', 'password': 'x'});

    expect(
      rutasRecibidas,
      contains('POST /api/auth/login'),
      reason: 'el login debía llamar a /api/auth/login (fallaba como '
          '/apiauth/login y ningún usuario podía entrar)',
    );
  });
}
