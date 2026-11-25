import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:provider/provider.dart';

import 'package:motorix_client/main.dart';
import 'package:motorix_client/providers/notifications_provider.dart';
import 'package:motorix_client/providers/session_provider.dart';
import 'package:motorix_client/providers/terms_provider.dart';
import 'package:motorix_client/providers/ui_provider.dart';
import 'package:motorix_client/screens/login/login_screen.dart';
import 'package:motorix_client/screens/settings/terms_section.dart';
import 'package:motorix_client/screens/terms/terms_acceptance_screen.dart';
import 'package:motorix_client/services/api_client.dart';
import 'package:motorix_client/widgets/app_shell.dart';

// T067 (Sprint 7, US9, CA-16, CA-19): puerta de términos y condiciones. Tras
// iniciar sesión con `termsAccepted` falso se muestra la pantalla de
// aceptación antes del shell; aceptar entra; rechazar cierra la sesión; si la
// versión cambió mientras se leía se recarga; un 403 TERMS_NOT_ACCEPTED a mitad
// de la sesión la muestra sin cerrarla; la sección de Configuración publica y
// lista aceptaciones.

class _ApiFalsa extends ApiClient {
  _ApiFalsa({this.termsAccepted = false});

  final bool termsAccepted;
  int versionVigente = 1;
  int aceptaciones = 0;
  int cierres = 0;
  final List<int> aceptadas = [];
  final List<Map<String, dynamic>> publicaciones = [];
  final List<int> paginasPedidas = [];

  Map<String, dynamic> _vigente() => {
        'version': versionVigente,
        'termsText': 'TÉRMINOS v$versionVigente: uso permitido del sistema.',
        'privacyText': 'AVISO DE PRIVACIDAD v$versionVigente.',
        'publishedAt': '2026-11-25T10:00:00',
        'accepted': aceptadas.contains(versionVigente),
      };

  @override
  Future<dynamic> get(String path, {Map<String, String>? query}) async {
    if (path == '/terms/current') return _vigente();
    if (path == '/terms/acceptances') {
      final pagina = int.parse(query?['page'] ?? '1');
      paginasPedidas.add(pagina);
      return {
        'version': versionVigente,
        'page': pagina,
        'pageSize': 1,
        'total': 3,
        'items': [
          {
            'userId': pagina,
            'username': 'usuario$pagina',
            'name': 'Usuario $pagina',
            'acceptedAt': '2026-11-25T10:05:00',
          },
        ],
        'pendingUsers': [
          {'userId': 9, 'username': 'recepcion', 'name': 'Recepción'},
        ],
      };
    }
    if (path.contains('notifications')) {
      return {'unreadCount': 0, 'groups': <dynamic>[]};
    }
    return {'users': <Map<String, dynamic>>[]};
  }

  @override
  Future<dynamic> post(String path, Object cuerpo) async {
    if (path == '/auth/login') {
      return {
        'token': 'abc.def.ghi',
        'expiresIn': 28800,
        'termsAccepted': termsAccepted,
        'user': {
          'id': 1,
          'username': 'admin',
          'name': 'Administrador',
          'email': 'admin@motorix.local',
          'role': 'ADMIN',
        },
      };
    }
    if (path == '/terms/accept') {
      final version = (cuerpo as Map)['version'] as int;
      if (version != versionVigente) {
        throw ApiError(
          status: 400,
          code: 'VALIDATION_ERROR',
          message: 'Datos inválidos.',
        );
      }
      aceptadas.add(version);
      return {'version': version, 'acceptedAt': '2026-11-25T10:06:00'};
    }
    if (path == '/auth/logout') {
      cierres += 1;
      return {'message': 'Sesión cerrada'};
    }
    if (path == '/terms') {
      publicaciones.add(Map<String, dynamic>.from(cuerpo as Map));
      versionVigente += 1;
      return {'version': versionVigente, 'publishedAt': '2026-11-25T11:00:00'};
    }
    throw ApiError(status: 404, code: 'NOT_FOUND', message: 'No existe.');
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

Future<void> _iniciarSesion(WidgetTester tester, SessionProvider sesion) async {
  await sesion.iniciarSesion('admin', 'Prueba2026!');
  await tester.pumpAndSettle();
}

void main() {
  group('Puerta de términos', () {
    testWidgets('con termsAccepted falso muestra la aceptación antes del shell', (tester) async {
      tester.view.devicePixelRatio = 1;
      tester.view.physicalSize = const Size(1400, 1000);
      addTearDown(tester.view.resetPhysicalSize);
      addTearDown(tester.view.resetDevicePixelRatio);
      final api = _ApiFalsa();
      final sesion = SessionProvider(api);
      await tester.pumpWidget(_app(api, sesion));
      expect(find.byType(LoginScreen), findsOneWidget);

      await _iniciarSesion(tester, sesion);

      expect(find.byType(TermsAcceptanceScreen), findsOneWidget);
      expect(find.byType(AppShell), findsNothing);
      expect(find.byKey(const Key('version-terminos')), findsOneWidget);
      expect(find.textContaining('TÉRMINOS v1'), findsOneWidget);
      expect(find.textContaining('AVISO DE PRIVACIDAD v1'), findsOneWidget);
    });

    testWidgets('con termsAccepted verdadero entra directo al shell', (tester) async {
      tester.view.devicePixelRatio = 1;
      tester.view.physicalSize = const Size(1400, 1000);
      addTearDown(tester.view.resetPhysicalSize);
      addTearDown(tester.view.resetDevicePixelRatio);
      final api = _ApiFalsa(termsAccepted: true);
      final sesion = SessionProvider(api);
      await tester.pumpWidget(_app(api, sesion));

      await _iniciarSesion(tester, sesion);

      expect(find.byType(AppShell), findsOneWidget);
      expect(find.byType(TermsAcceptanceScreen), findsNothing);
    });

    testWidgets('«Acepto» cierra la pantalla y entra al shell', (tester) async {
      tester.view.devicePixelRatio = 1;
      tester.view.physicalSize = const Size(1400, 1000);
      addTearDown(tester.view.resetPhysicalSize);
      addTearDown(tester.view.resetDevicePixelRatio);
      final api = _ApiFalsa();
      final sesion = SessionProvider(api);
      await tester.pumpWidget(_app(api, sesion));
      await _iniciarSesion(tester, sesion);

      await tester.tap(find.byKey(const Key('boton-acepto')));
      await tester.pumpAndSettle();

      expect(api.aceptadas, [1]);
      expect(sesion.termsAccepted, isTrue);
      expect(find.byType(AppShell), findsOneWidget);
      expect(find.byType(TermsAcceptanceScreen), findsNothing);
    });

    testWidgets('«No acepto» pide confirmación y cierra la sesión', (tester) async {
      tester.view.devicePixelRatio = 1;
      tester.view.physicalSize = const Size(1400, 1000);
      addTearDown(tester.view.resetPhysicalSize);
      addTearDown(tester.view.resetDevicePixelRatio);
      final api = _ApiFalsa();
      final sesion = SessionProvider(api);
      await tester.pumpWidget(_app(api, sesion));
      await _iniciarSesion(tester, sesion);

      await tester.tap(find.byKey(const Key('boton-no-acepto')));
      await tester.pumpAndSettle();
      expect(find.text('No aceptar los términos'), findsOneWidget);
      await tester.tap(find.text('Cancelar'));
      await tester.pumpAndSettle();
      expect(sesion.autenticado, isTrue);

      await tester.tap(find.byKey(const Key('boton-no-acepto')));
      await tester.pumpAndSettle();
      await tester.tap(find.widgetWithText(FilledButton, 'Cerrar sesión'));
      await tester.pumpAndSettle();

      expect(sesion.autenticado, isFalse);
      expect(api.cierres, 1);
      expect(find.byType(LoginScreen), findsOneWidget);
    });

    testWidgets('si la versión cambió mientras se leía se recarga la nueva', (tester) async {
      tester.view.devicePixelRatio = 1;
      tester.view.physicalSize = const Size(1400, 1000);
      addTearDown(tester.view.resetPhysicalSize);
      addTearDown(tester.view.resetDevicePixelRatio);
      final api = _ApiFalsa();
      final sesion = SessionProvider(api);
      await tester.pumpWidget(_app(api, sesion));
      await _iniciarSesion(tester, sesion);
      expect(find.textContaining('TÉRMINOS v1'), findsOneWidget);

      api.versionVigente = 2; // el administrador publicó otra mientras se leía

      await tester.tap(find.byKey(const Key('boton-acepto')));
      await tester.pumpAndSettle();

      expect(find.textContaining('TÉRMINOS v2'), findsOneWidget);
      expect(find.byKey(const Key('error-aceptar-terminos')), findsOneWidget);
      expect(sesion.termsAccepted, isFalse);
      expect(find.byType(AppShell), findsNothing);

      await tester.tap(find.byKey(const Key('boton-acepto')));
      await tester.pumpAndSettle();
      expect(api.aceptadas, [2]);
      expect(find.byType(AppShell), findsOneWidget);
    });
  });

  group('403 TERMS_NOT_ACCEPTED a mitad de la sesión (CA-19)', () {
    testWidgets('muestra la pantalla y, al aceptar, continúa', (tester) async {
      tester.view.devicePixelRatio = 1;
      tester.view.physicalSize = const Size(1400, 1000);
      addTearDown(tester.view.resetPhysicalSize);
      addTearDown(tester.view.resetDevicePixelRatio);
      final api = _ApiFalsa(termsAccepted: true);
      final sesion = SessionProvider(api);
      await tester.pumpWidget(_app(api, sesion));
      await _iniciarSesion(tester, sesion);
      expect(find.byType(AppShell), findsOneWidget);

      api.versionVigente = 2;
      api.alTerminosNoAceptados!.call();
      await tester.pumpAndSettle();

      expect(find.byType(TermsAcceptanceScreen), findsOneWidget);
      expect(sesion.autenticado, isTrue);
      expect(find.textContaining('TÉRMINOS v2'), findsOneWidget);

      await tester.tap(find.byKey(const Key('boton-acepto')));
      await tester.pumpAndSettle();

      expect(find.byType(AppShell), findsOneWidget);
    });
  });

  group('Sección «Términos y condiciones» de Configuración (ADMIN)', () {
    Widget seccion(_ApiFalsa api, List<bool> cambios) => MultiProvider(
          providers: [
            ChangeNotifierProvider<TermsProvider>(create: (_) => TermsProvider(api)),
          ],
          child: MaterialApp(
            home: Scaffold(
              body: SingleChildScrollView(
                child: TermsSection(onCambios: cambios.add),
              ),
            ),
          ),
        );

    Future<void> grande(WidgetTester tester) async {
      tester.view.devicePixelRatio = 1;
      tester.view.physicalSize = const Size(1200, 3000);
      addTearDown(tester.view.resetPhysicalSize);
      addTearDown(tester.view.resetDevicePixelRatio);
    }

    testWidgets('muestra la versión vigente, las aceptaciones y los pendientes', (tester) async {
      await grande(tester);
      final api = _ApiFalsa(termsAccepted: true);
      await tester.pumpWidget(seccion(api, []));
      await tester.pumpAndSettle();

      expect(find.textContaining('Versión vigente: 1'), findsOneWidget);
      expect(find.text('Usuario 1'), findsOneWidget);
      expect(find.text('Recepción'), findsOneWidget);
      expect(find.byKey(const Key('resumen-aceptaciones')), findsOneWidget);
    });

    testWidgets('pagina las aceptaciones', (tester) async {
      await grande(tester);
      final api = _ApiFalsa(termsAccepted: true);
      await tester.pumpWidget(seccion(api, []));
      await tester.pumpAndSettle();

      await tester.tap(find.byKey(const Key('aceptaciones-siguiente')));
      await tester.pumpAndSettle();

      expect(api.paginasPedidas.last, 2);
      expect(find.text('Usuario 2'), findsOneWidget);
    });

    testWidgets('publicar pide confirmación y envía ambos textos; editar marca cambios', (tester) async {
      await grande(tester);
      final api = _ApiFalsa(termsAccepted: true);
      final cambios = <bool>[];
      await tester.pumpWidget(seccion(api, cambios));
      await tester.pumpAndSettle();

      final boton = find.byKey(const Key('boton-publicar-terminos'));
      expect(tester.widget<FilledButton>(boton).onPressed, isNull);

      await tester.enterText(find.byKey(const Key('campo-terminos')), 'Términos corregidos');
      await tester.pump();
      expect(cambios.last, isTrue);
      expect(tester.widget<FilledButton>(boton).onPressed, isNotNull);

      await tester.tap(boton);
      await tester.pumpAndSettle();
      expect(find.text('Publicar versión nueva'), findsWidgets);
      await tester.tap(find.text('Cancelar'));
      await tester.pumpAndSettle();
      expect(api.publicaciones, isEmpty);

      await tester.tap(boton);
      await tester.pumpAndSettle();
      await tester.tap(find.widgetWithText(FilledButton, 'Publicar'));
      await tester.pumpAndSettle();

      expect(api.publicaciones, hasLength(1));
      expect(api.publicaciones.single['termsText'], 'Términos corregidos');
      expect(api.publicaciones.single['privacyText'], contains('AVISO DE PRIVACIDAD v1'));
      expect(find.textContaining('Versión vigente: 2'), findsOneWidget);
      expect(cambios.last, isFalse);
    });
  });
}
