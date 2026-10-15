import 'package:flutter_test/flutter_test.dart';

import 'package:motorix_client/providers/session_provider.dart';
import 'package:motorix_client/services/api_client.dart';

/// ApiClient falso: devuelve datos o errores sin tocar la red.
class _ApiFalsa extends ApiClient {
  _ApiFalsa({this.datosLogin, this.fallo});

  final Map<String, dynamic>? datosLogin;
  final Object? fallo;

  @override
  Future<dynamic> post(String path, Object cuerpo) async {
    if (fallo != null) throw fallo!;
    return datosLogin;
  }
}

Map<String, dynamic> _datosDeEjemplo() => {
      'token': 'abc.def.ghi',
      'expiresIn': 28800,
      'user': {
        'id': 1,
        'username': 'admin',
        'name': 'Administrador',
        'email': 'admin@motorix.local',
        'role': 'ADMIN',
      },
    };

void main() {
  group('SessionProvider', () {
    test('iniciar sesión guarda token, usuario y expiración', () async {
      final api = _ApiFalsa(datosLogin: _datosDeEjemplo());
      final sesion = SessionProvider(api);

      final exito = await sesion.iniciarSesion('admin', 'Admin2026!');

      expect(exito, isTrue, reason: 'el login debería tener éxito');
      expect(sesion.usuario?.username, 'admin');
      expect(sesion.usuario?.esAdmin, isTrue);
      expect(api.token, 'abc.def.ghi');
      expect(sesion.cargando, isFalse);
      expect(sesion.error, isNull);
      expect(sesion.sesionExpirada, isFalse,
          reason: 'la sesión recién iniciada no está expirada');
    });

    test('iniciar sesión con credenciales inválidas muestra el mensaje en español',
        () async {
      final api = _ApiFalsa(
        fallo: ApiError(
          status: 401,
          code: 'INVALID_CREDENTIALS',
          message: 'Usuario o contraseña incorrectos.',
        ),
      );
      final sesion = SessionProvider(api);

      final exito = await sesion.iniciarSesion('admin', 'mala');

      expect(exito, isFalse);
      expect(sesion.usuario, isNull);
      expect(api.token, isNull, reason: 'no debe guardarse token');
      expect(sesion.error, 'Usuario o contraseña incorrectos.');
    });

    test('un error de red se traduce a mensaje amigable en español', () async {
      final sesion = SessionProvider(_ApiFalsa(fallo: Exception('sin red')));

      final exito = await sesion.iniciarSesion('admin', 'Admin2026!');

      expect(exito, isFalse);
      expect(sesion.error, contains('No se pudo conectar'));
    });

    test('cerrar sesión limpia token, usuario y expiración', () async {
      final api = _ApiFalsa(datosLogin: _datosDeEjemplo());
      final sesion = SessionProvider(api);
      await sesion.iniciarSesion('admin', 'Admin2026!');

      await sesion.cerrarSesion();

      expect(sesion.usuario, isNull);
      expect(api.token, isNull);
      expect(sesion.expiraEn, isNull);
      expect(sesion.autenticado, isFalse);
    });

    test('procesarErrorSesion cierra la sesión solo ante un 401', () async {
      final api = _ApiFalsa(datosLogin: _datosDeEjemplo());
      final sesion = SessionProvider(api);
      await sesion.iniciarSesion('admin', 'Admin2026!');

      final fueCaducada = await sesion.procesarErrorSesion(
        ApiError(status: 500, code: 'INTERNAL_ERROR', message: 'Error interno.'),
      );
      expect(fueCaducada, isFalse);
      expect(sesion.autenticado, isTrue,
          reason: 'un 500 no debe cerrar la sesión');

      final caducada = await sesion.procesarErrorSesion(
        ApiError(
          status: 401,
          code: 'UNAUTHORIZED',
          message: 'Tu sesión no es válida o ha expirado.',
        ),
      );
      expect(caducada, isTrue);
      expect(sesion.autenticado, isFalse);
    });
  });
}
