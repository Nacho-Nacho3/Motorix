import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:provider/provider.dart';

import 'package:motorix_client/models/user.dart';
import 'package:motorix_client/providers/notifications_provider.dart';
import 'package:motorix_client/providers/session_provider.dart';
import 'package:motorix_client/providers/settings_provider.dart';
import 'package:motorix_client/providers/ui_provider.dart';
import 'package:motorix_client/screens/settings/settings_screen.dart';
import 'package:motorix_client/services/api_client.dart';
import 'package:motorix_client/widgets/app_shell.dart';
import 'package:motorix_client/widgets/states_view.dart';

// T023 (Sprint 7, US1, FR-001, FR-017): sección «Taller» de Configuración:
// carga, estados con states_view.dart, validación, guardado con mensaje de
// éxito, «Restablecer», confirmación de cambios sin guardar y visibilidad
// solo para ADMIN.

Map<String, dynamic> _config({
  String nombre = 'Motorix',
  String? direccion,
  String? telefono,
}) =>
    {
      'shop': {'name': nombre, 'address': direccion, 'phone': telefono},
      'maintenance': {'warnDays': 30, 'warnKm': 500},
      'defaults': {
        'shop': {'name': 'Motorix', 'address': null, 'phone': null},
        'maintenance': {'warnDays': 30, 'warnKm': 500},
      },
    };

class _ApiFalsa extends ApiClient {
  _ApiFalsa({this.falla = false, this.rechazaGuardado = false});

  final bool falla;
  final bool rechazaGuardado;
  Map<String, dynamic> actual = _config(
    nombre: 'Taller Pérez',
    direccion: 'Av. Juárez 120',
    telefono: '3511234567',
  );
  final List<Map<String, dynamic>> envios = [];

  @override
  Future<dynamic> get(String path, {Map<String, String>? query}) async {
    if (path.contains('settings')) {
      if (falla) {
        throw ApiError(
          status: 500,
          code: 'INTERNAL_ERROR',
          message: 'No se pudo consultar la configuración.',
        );
      }
      return actual;
    }
    if (path.contains('notifications')) {
      return {'unreadCount': 0, 'groups': <dynamic>[]};
    }
    return <String, dynamic>{};
  }

  @override
  Future<dynamic> patch(String path, Object cuerpo) async {
    final datos = Map<String, dynamic>.from(cuerpo as Map);
    envios.add(datos);
    if (rechazaGuardado) {
      throw ApiError(
        status: 400,
        code: 'VALIDATION_ERROR',
        message: 'Datos inválidos. Revisa los campos indicados.',
      );
    }
    final shop = Map<String, dynamic>.from(datos['shop'] as Map);
    actual = _config(
      nombre: shop['name'] as String,
      direccion: (shop['address'] as String).isEmpty
          ? null
          : shop['address'] as String,
      telefono: (shop['phone'] as String).isEmpty
          ? null
          : shop['phone'] as String,
    );
    return actual;
  }
}

Widget _pantalla(_ApiFalsa api) => MultiProvider(
      providers: [
        ChangeNotifierProvider<SettingsProvider>(
          create: (_) => SettingsProvider(api),
        ),
      ],
      child: MaterialApp(
        theme: ThemeData(useMaterial3: true),
        home: const SettingsScreen(),
      ),
    );

const _administrador = User(
  id: 1,
  username: 'admin',
  name: 'Administrador',
  email: 'admin@motorix.local',
  role: 'ADMIN',
);

const _recepcionista = User(
  id: 2,
  username: 'recepcion',
  name: 'Recepción',
  email: 'recepcion@motorix.local',
  role: 'RECEPTIONIST',
);

Widget _shell(User usuario) {
  final api = _ApiFalsa();
  final sesion = SessionProvider(api);
  sesion.usuario = usuario;
  return MultiProvider(
    providers: [
      ChangeNotifierProvider<SessionProvider>.value(value: sesion),
      ChangeNotifierProvider<UiProvider>(create: (_) => UiProvider()),
      ChangeNotifierProvider<NotificationsProvider>(
        create: (_) => NotificationsProvider(api),
      ),
      ChangeNotifierProvider<SettingsProvider>(
        create: (_) => SettingsProvider(api),
      ),
    ],
    child: MaterialApp(
      theme: ThemeData(useMaterial3: true),
      home: const AppShell(),
    ),
  );
}

void main() {
  group('Sección «Taller»', () {
    testWidgets('carga y muestra los datos del taller', (tester) async {
      await tester.pumpWidget(_pantalla(_ApiFalsa()));
      expect(find.byType(LoadingView), findsOneWidget);
      await tester.pumpAndSettle();

      expect(find.widgetWithText(TextFormField, 'Taller Pérez'), findsOneWidget);
      expect(find.widgetWithText(TextFormField, 'Av. Juárez 120'), findsOneWidget);
      expect(find.widgetWithText(TextFormField, '3511234567'), findsOneWidget);
    });

    testWidgets('si falla la carga muestra el estado de error con reintento',
        (tester) async {
      await tester.pumpWidget(_pantalla(_ApiFalsa(falla: true)));
      await tester.pumpAndSettle();

      expect(find.byType(ErrorView), findsOneWidget);
      expect(find.text('No se pudo consultar la configuración.'), findsOneWidget);
      expect(find.text('Reintentar'), findsOneWidget);
    });

    testWidgets('el nombre es obligatorio y respeta la longitud', (tester) async {
      final api = _ApiFalsa();
      await tester.pumpWidget(_pantalla(api));
      await tester.pumpAndSettle();

      await tester.enterText(find.byKey(const Key('campo-nombre-taller')), '   ');
      await tester.tap(find.byKey(const Key('boton-guardar-taller')));
      await tester.pumpAndSettle();

      expect(find.text('El nombre del taller es obligatorio.'), findsOneWidget);
      expect(api.envios, isEmpty);
    });

    testWidgets('guarda y muestra el mensaje de éxito', (tester) async {
      final api = _ApiFalsa();
      await tester.pumpWidget(_pantalla(api));
      await tester.pumpAndSettle();

      await tester.enterText(
        find.byKey(const Key('campo-nombre-taller')),
        'Taller Nuevo',
      );
      await tester.tap(find.byKey(const Key('boton-guardar-taller')));
      await tester.pumpAndSettle();

      expect(api.envios, hasLength(1));
      expect((api.envios.single['shop'] as Map)['name'], 'Taller Nuevo');
      expect(find.text('Datos del taller guardados.'), findsOneWidget);
    });

    testWidgets('muestra el error del servidor al rechazar el guardado',
        (tester) async {
      await tester.pumpWidget(_pantalla(_ApiFalsa(rechazaGuardado: true)));
      await tester.pumpAndSettle();

      await tester.enterText(find.byKey(const Key('campo-nombre-taller')), 'X');
      await tester.tap(find.byKey(const Key('boton-guardar-taller')));
      await tester.pumpAndSettle();

      expect(find.byKey(const Key('error-guardado-taller')), findsOneWidget);
      expect(find.text('Datos del taller guardados.'), findsNothing);
    });

    testWidgets('«Restablecer» vuelve a los valores de respaldo', (tester) async {
      await tester.pumpWidget(_pantalla(_ApiFalsa()));
      await tester.pumpAndSettle();

      await tester.tap(find.byKey(const Key('boton-restablecer-taller')));
      await tester.pumpAndSettle();

      expect(find.widgetWithText(TextFormField, 'Motorix'), findsOneWidget);
      expect(find.widgetWithText(TextFormField, 'Av. Juárez 120'), findsNothing);
    });

    testWidgets('pide confirmación «Cambios sin guardar» al salir con cambios',
        (tester) async {
      final api = _ApiFalsa();
      await tester.pumpWidget(
        MultiProvider(
          providers: [
            ChangeNotifierProvider<SettingsProvider>(
              create: (_) => SettingsProvider(api),
            ),
          ],
          child: MaterialApp(
            theme: ThemeData(useMaterial3: true),
            home: Builder(
              builder: (context) => Scaffold(
                body: Center(
                  child: TextButton(
                    onPressed: () => Navigator.of(context).push(
                      MaterialPageRoute<void>(
                        builder: (_) => const SettingsScreen(),
                      ),
                    ),
                    child: const Text('Abrir'),
                  ),
                ),
              ),
            ),
          ),
        ),
      );
      await tester.tap(find.text('Abrir'));
      await tester.pumpAndSettle();

      await tester.enterText(
        find.byKey(const Key('campo-nombre-taller')),
        'Cambiado',
      );
      await tester.pump();
      final navegador = tester.state<NavigatorState>(find.byType(Navigator).last);
      navegador.maybePop();
      await tester.pumpAndSettle();

      expect(find.text('Cambios sin guardar'), findsOneWidget);
      await tester.tap(find.text('Cancelar'));
      await tester.pumpAndSettle();
      expect(find.byType(SettingsScreen), findsOneWidget);

      navegador.maybePop();
      await tester.pumpAndSettle();
      await tester.tap(find.text('Confirmar'));
      await tester.pumpAndSettle();
      expect(find.byType(SettingsScreen), findsNothing);
    });

    testWidgets('sin cambios sale sin pedir confirmación', (tester) async {
      final api = _ApiFalsa();
      await tester.pumpWidget(
        MultiProvider(
          providers: [
            ChangeNotifierProvider<SettingsProvider>(
              create: (_) => SettingsProvider(api),
            ),
          ],
          child: MaterialApp(
            theme: ThemeData(useMaterial3: true),
            home: Builder(
              builder: (context) => Scaffold(
                body: Center(
                  child: TextButton(
                    onPressed: () => Navigator.of(context).push(
                      MaterialPageRoute<void>(
                        builder: (_) => const SettingsScreen(),
                      ),
                    ),
                    child: const Text('Abrir'),
                  ),
                ),
              ),
            ),
          ),
        ),
      );
      await tester.tap(find.text('Abrir'));
      await tester.pumpAndSettle();

      tester.state<NavigatorState>(find.byType(Navigator).last).maybePop();
      await tester.pumpAndSettle();

      expect(find.text('Cambios sin guardar'), findsNothing);
      expect(find.byType(SettingsScreen), findsNothing);
    });
  });

  group('Menú de Configuración (FR-001, CA-10)', () {
    testWidgets('el administrador ve la sección Configuración', (tester) async {
      tester.view.devicePixelRatio = 1;
      tester.view.physicalSize = const Size(1600, 1200);
      addTearDown(tester.view.resetPhysicalSize);
      await tester.pumpWidget(_shell(_administrador));
      await tester.pumpAndSettle();

      expect(find.text('Configuración'), findsWidgets);
    });

    testWidgets('el recepcionista no la ve', (tester) async {
      tester.view.devicePixelRatio = 1;
      tester.view.physicalSize = const Size(1600, 1200);
      addTearDown(tester.view.resetPhysicalSize);
      await tester.pumpWidget(_shell(_recepcionista));
      await tester.pumpAndSettle();

      expect(find.text('Configuración'), findsNothing);
    });
  });
}
