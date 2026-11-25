import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:provider/provider.dart';

import 'package:motorix_client/main.dart';
import 'package:motorix_client/models/user.dart';
import 'package:motorix_client/providers/notifications_provider.dart';
import 'package:motorix_client/providers/session_provider.dart';
import 'package:motorix_client/providers/terms_provider.dart';
import 'package:motorix_client/providers/ui_provider.dart';
import 'package:motorix_client/screens/login/login_screen.dart';
import 'package:motorix_client/services/api_client.dart';
import 'package:motorix_client/widgets/app_shell.dart';
import 'package:motorix_client/widgets/inactivity_detector.dart';

// T083 (Sprint 7, US10, CA-23): cierre por inactividad. El detector cierra la
// sesión local a los 30 minutos sin actividad y avisa; la actividad reinicia el
// reloj; un 401 SESSION_IDLE del backend cierra la sesión con el mismo aviso.

class _ApiFalsa extends ApiClient {
  @override
  Future<dynamic> get(String path, {Map<String, String>? query}) async {
    if (path.contains('notifications')) {
      return {'unreadCount': 0, 'groups': <dynamic>[]};
    }
    return {'users': <Map<String, dynamic>>[]};
  }

  @override
  Future<dynamic> post(String path, Object cuerpo) async {
    return {
      'token': 'abc.def.ghi',
      'expiresIn': 28800,
      'termsAccepted': true,
      'user': {
        'id': 1,
        'username': 'admin',
        'name': 'Administrador',
        'email': 'admin@motorix.local',
        'role': 'ADMIN',
      },
    };
  }
}

Widget _app(_ApiFalsa api, SessionProvider sesion) => MultiProvider(
      providers: [
        ChangeNotifierProvider<SessionProvider>.value(value: sesion),
        ChangeNotifierProvider<UiProvider>(create: (_) => UiProvider()),
        ChangeNotifierProvider<TermsProvider>(create: (_) => TermsProvider(api)),
        ChangeNotifierProvider<NotificationsProvider>(
          create: (_) => NotificationsProvider(api),
        ),
      ],
      child: const MaterialApp(home: RaizApp()),
    );

void main() {
  group('InactivityDetector', () {
    testWidgets('avisa al cumplirse la duración sin actividad', (tester) async {
      var avisos = 0;
      await tester.pumpWidget(
        MaterialApp(
          home: InactivityDetector(
            duracion: const Duration(minutes: 30),
            alInactividad: () => avisos++,
            child: const Scaffold(body: Text('contenido')),
          ),
        ),
      );

      await tester.pump(const Duration(minutes: 29, seconds: 59));
      expect(avisos, 0);
      await tester.pump(const Duration(seconds: 2));
      expect(avisos, 1);
    });

    testWidgets('el puntero reinicia el reloj', (tester) async {
      var avisos = 0;
      await tester.pumpWidget(
        MaterialApp(
          home: InactivityDetector(
            duracion: const Duration(minutes: 30),
            alInactividad: () => avisos++,
            child: const Scaffold(body: Center(child: Text('contenido'))),
          ),
        ),
      );

      await tester.pump(const Duration(minutes: 20));
      await tester.tap(find.text('contenido'));
      await tester.pump(const Duration(minutes: 20));
      expect(avisos, 0, reason: 'la actividad reinició el reloj');

      await tester.pump(const Duration(minutes: 11));
      expect(avisos, 1);
    });

    testWidgets('el teclado reinicia el reloj', (tester) async {
      var avisos = 0;
      await tester.pumpWidget(
        MaterialApp(
          home: InactivityDetector(
            duracion: const Duration(minutes: 30),
            alInactividad: () => avisos++,
            child: const Scaffold(body: Text('contenido')),
          ),
        ),
      );

      await tester.pump(const Duration(minutes: 25));
      await tester.sendKeyEvent(LogicalKeyboardKey.keyA);
      await tester.pump(const Duration(minutes: 25));

      expect(avisos, 0);
    });

    testWidgets('al desmontarse cancela el reloj y no avisa', (tester) async {
      var avisos = 0;
      await tester.pumpWidget(
        MaterialApp(
          home: InactivityDetector(
            duracion: const Duration(minutes: 30),
            alInactividad: () => avisos++,
            child: const Scaffold(body: Text('contenido')),
          ),
        ),
      );
      await tester.pumpWidget(const MaterialApp(home: Scaffold(body: Text('otra'))));

      await tester.pump(const Duration(minutes: 40));

      expect(avisos, 0);
    });
  });

  group('Cierre de sesión por inactividad', () {
    testWidgets('a los 30 minutos sin actividad cierra la sesión y avisa en el login', (tester) async {
      tester.view.devicePixelRatio = 1;
      tester.view.physicalSize = const Size(1400, 1000);
      addTearDown(tester.view.resetPhysicalSize);
      addTearDown(tester.view.resetDevicePixelRatio);
      final api = _ApiFalsa();
      final sesion = SessionProvider(api);
      await tester.pumpWidget(_app(api, sesion));
      await sesion.iniciarSesion('admin', 'Prueba2026!');
      await tester.pumpAndSettle();
      expect(find.byType(AppShell), findsOneWidget);

      await tester.pump(const Duration(minutes: 31));
      await tester.pumpAndSettle();

      expect(sesion.autenticado, isFalse);
      expect(find.byType(LoginScreen), findsOneWidget);
      expect(find.text('Tu sesión se cerró por inactividad'), findsOneWidget);
    });

    testWidgets('el aviso desaparece al iniciar sesión de nuevo', (tester) async {
      tester.view.devicePixelRatio = 1;
      tester.view.physicalSize = const Size(1400, 1000);
      addTearDown(tester.view.resetPhysicalSize);
      addTearDown(tester.view.resetDevicePixelRatio);
      final api = _ApiFalsa();
      final sesion = SessionProvider(api);
      await tester.pumpWidget(_app(api, sesion));
      await sesion.iniciarSesion('admin', 'Prueba2026!');
      await tester.pumpAndSettle();
      await tester.pump(const Duration(minutes: 31));
      await tester.pumpAndSettle();
      expect(sesion.aviso, isNotNull);

      await sesion.iniciarSesion('admin', 'Prueba2026!');
      await tester.pumpAndSettle();

      expect(sesion.aviso, isNull);
      expect(find.byType(AppShell), findsOneWidget);
    });

    test('un 401 SESSION_IDLE del backend cierra la sesión con el aviso', () async {
      final api = _ApiFalsa();
      final sesion = SessionProvider(api);
      await sesion.iniciarSesion('admin', 'Prueba2026!');
      expect(sesion.autenticado, isTrue);

      final cerrada = await sesion.procesarErrorSesion(
        ApiError(
          status: 401,
          code: 'SESSION_IDLE',
          message: 'Tu sesión se cerró por inactividad. Inicia sesión de nuevo.',
        ),
      );

      expect(cerrada, isTrue);
      expect(sesion.autenticado, isFalse);
      expect(sesion.aviso, 'Tu sesión se cerró por inactividad');
    });

    test('un 401 común cierra la sesión sin el aviso de inactividad', () async {
      final api = _ApiFalsa();
      final sesion = SessionProvider(api);
      await sesion.iniciarSesion('admin', 'Prueba2026!');

      await sesion.procesarErrorSesion(
        ApiError(status: 401, code: 'UNAUTHORIZED', message: 'Sesión no válida.'),
      );

      expect(sesion.autenticado, isFalse);
      expect(sesion.aviso, isNull);
    });

    test('el hook de ApiClient para SESSION_IDLE cierra la sesión activa', () async {
      final api = _ApiFalsa();
      final sesion = SessionProvider(api);
      sesion.usuario = const User(
        id: 1,
        username: 'admin',
        name: 'Administrador',
        email: 'admin@motorix.local',
        role: 'ADMIN',
      );

      api.alSesionInactiva!.call();
      await Future<void>.delayed(Duration.zero);

      expect(sesion.autenticado, isFalse);
      expect(sesion.aviso, SessionProvider.mensajeInactividad);
    });
  });
}
