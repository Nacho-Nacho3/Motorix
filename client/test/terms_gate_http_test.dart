// T067 (Sprint 7, US9, CA-19): prueba del ApiClient contra un servidor HTTP
// local real, sin TestWidgetsFlutterBinding (que bloquea las peticiones de red).
// Comprueba que un 403 TERMS_NOT_ACCEPTED avisa a la sesión sin cerrarla.
import 'dart:convert';
import 'dart:io';

import 'package:flutter_test/flutter_test.dart';

import 'package:motorix_client/models/user.dart';
import 'package:motorix_client/providers/session_provider.dart';
import 'package:motorix_client/services/api_client.dart';

void main() {
  late HttpServer servidor;

  setUp(() async {
    servidor = await HttpServer.bind(InternetAddress.loopbackIPv4, 0);
    servidor.listen((solicitud) async {
      solicitud.response
        ..statusCode = 403
        ..headers.contentType = ContentType.json
        ..write(jsonEncode({
          'ok': false,
          'error': {
            'code': 'TERMS_NOT_ACCEPTED',
            'message': 'Debes aceptar los términos y condiciones.',
          },
        }));
      await solicitud.response.close();
    });
  });

  tearDown(() async {
    await servidor.close(force: true);
  });

  const usuario = User(
    id: 1,
    username: 'admin',
    name: 'Administrador',
    email: 'admin@motorix.local',
    role: 'ADMIN',
  );

  test('un 403 TERMS_NOT_ACCEPTED marca la sesión sin cerrarla', () async {
    final api = ApiClient(baseUrl: 'http://127.0.0.1:${servidor.port}/api');
    final sesion = SessionProvider(api)..usuario = usuario;
    api.token = 'abc.def.ghi';
    expect(sesion.termsAccepted, isTrue);

    await expectLater(api.get('/clients'), throwsA(isA<ApiError>()));

    expect(sesion.termsAccepted, isFalse);
    expect(sesion.autenticado, isTrue);
    expect(api.token, 'abc.def.ghi');
  });

  test('sin sesión iniciada el aviso no cambia nada', () async {
    final api = ApiClient(baseUrl: 'http://127.0.0.1:${servidor.port}/api');
    final sesion = SessionProvider(api);

    await expectLater(api.get('/clients'), throwsA(isA<ApiError>()));

    expect(sesion.autenticado, isFalse);
    expect(sesion.termsAccepted, isTrue);
  });

  test('otro 403 distinto no muestra la pantalla de términos', () async {
    await servidor.close(force: true);
    servidor = await HttpServer.bind(InternetAddress.loopbackIPv4, 0);
    servidor.listen((solicitud) async {
      solicitud.response
        ..statusCode = 403
        ..headers.contentType = ContentType.json
        ..write(jsonEncode({
          'ok': false,
          'error': {'code': 'FORBIDDEN', 'message': 'Sin permisos.'},
        }));
      await solicitud.response.close();
    });
    final api = ApiClient(baseUrl: 'http://127.0.0.1:${servidor.port}/api');
    final sesion = SessionProvider(api)..usuario = usuario;

    await expectLater(api.get('/settings'), throwsA(isA<ApiError>()));

    expect(sesion.termsAccepted, isTrue);
  });
}
