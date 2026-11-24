import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:provider/provider.dart';

import 'package:motorix_client/models/user.dart';
import 'package:motorix_client/providers/client_notices_provider.dart';
import 'package:motorix_client/providers/clients_provider.dart';
import 'package:motorix_client/providers/maintenances_provider.dart';
import 'package:motorix_client/providers/notifications_provider.dart';
import 'package:motorix_client/providers/session_provider.dart';
import 'package:motorix_client/providers/ui_provider.dart';
import 'package:motorix_client/screens/clients/client_notice_screen.dart';
import 'package:motorix_client/services/api_client.dart';
import 'package:motorix_client/widgets/app_shell.dart';
import 'package:motorix_client/widgets/states_view.dart';

// T051: pantalla de clientes por avisar (Sprint 6, US7, CA-7, CA-10, FR-010):
// lista con teléfono, motivo y contexto; «Ya lo hablé» registra el aviso con
// nota opcional y quita la fila; estados con states_view.dart; la sección
// solo existe para ADMIN y recepción.

class _ApiFalsa extends ApiClient {
  _ApiFalsa({List<Map<String, dynamic>>? pendientes, this.fallaLista = false})
      : pendientes = pendientes ?? [];

  final List<Map<String, dynamic>> pendientes;
  final bool fallaLista;
  final List<Map<String, dynamic>> registros = [];

  @override
  Future<dynamic> get(String path, {Map<String, String>? query}) async {
    if (path.contains('client-notices')) {
      if (fallaLista) {
        throw ApiError(
          status: 500,
          code: 'INTERNAL_ERROR',
          message: 'No se pudo consultar la lista.',
        );
      }
      return List<Map<String, dynamic>>.from(pendientes);
    }
    if (path.contains('notifications')) {
      return {'unreadCount': 0, 'groups': <dynamic>[]};
    }
    if (path.contains('clients')) return {'clients': <dynamic>[], 'total': 0};
    return <String, dynamic>{};
  }

  @override
  Future<dynamic> post(String path, Object cuerpo) async {
    if (path.contains('client-notices')) {
      final datos = Map<String, dynamic>.from(cuerpo as Map);
      registros.add(datos);
      return {
        'id': registros.length,
        ...datos,
        'notifiedBy': 1,
        'notifiedByName': 'Administrador',
        'notifiedAt': '2026-11-24T10:00:00',
      };
    }
    throw ApiError(
      status: 404,
      code: 'NOT_FOUND',
      message: 'Ruta no disponible.',
    );
  }
}

Map<String, dynamic> _fila(
  int id,
  String motivo,
  String etiqueta,
  int fuente,
  String contexto, {
  int clienteId = 3,
  String nombre = 'María Gómez',
  String telefono = '3511234567',
}) =>
    {
      'id': id,
      'clientId': clienteId,
      'clientName': nombre,
      'phone': telefono,
      'motive': motivo,
      'motiveLabel': etiqueta,
      'sourceId': fuente,
      'detail': contexto,
      'note': null,
      'createdAt': '2026-11-24T09:00:00',
    };

final _pendientes = [
  _fila(
    1,
    'ORDER_READY',
    'Orden terminada sin entregar',
    42,
    'Orden #42 — Toyota Corolla 2015 (ABC1234)',
  ),
  _fila(
    2,
    'APPOINTMENT_TOMORROW',
    'Cita de mañana',
    7,
    'Cita de mañana a las 10:00 — Toyota Corolla (ABC1234)',
  ),
];

Widget _pantalla(_ApiFalsa api) {
  return ChangeNotifierProvider<ClientNoticesProvider>(
    create: (_) => ClientNoticesProvider(api),
    child: MaterialApp(
      theme: ThemeData(useMaterial3: true),
      home: const Scaffold(body: ClientNoticeScreen()),
    ),
  );
}

Widget _shell(_ApiFalsa api, String rol) {
  final sesion = SessionProvider(api);
  sesion.usuario = User(
    id: 1,
    username: 'usuario',
    name: 'Usuario',
    email: 'usuario@motorix.local',
    role: rol,
  );
  return MultiProvider(
    providers: [
      ChangeNotifierProvider<SessionProvider>.value(value: sesion),
      ChangeNotifierProvider<UiProvider>(create: (_) => UiProvider()),
      ChangeNotifierProvider<ClientsProvider>(
        create: (_) => ClientsProvider(api),
      ),
      ChangeNotifierProvider<MaintenancesProvider>(
        create: (_) => MaintenancesProvider(api),
      ),
      ChangeNotifierProvider<NotificationsProvider>(
        create: (_) => NotificationsProvider(api),
      ),
      ChangeNotifierProvider<ClientNoticesProvider>(
        create: (_) => ClientNoticesProvider(api),
      ),
    ],
    child: MaterialApp(
      theme: ThemeData(useMaterial3: true),
      home: const AppShell(),
    ),
  );
}

void main() {
  testWidgets('muestra teléfono, motivo y contexto de cada cliente por avisar',
      (tester) async {
    final api = _ApiFalsa(pendientes: _pendientes);
    await tester.pumpWidget(_pantalla(api));
    await tester.pumpAndSettle();

    expect(find.text('María Gómez'), findsNWidgets(2));
    expect(find.text('3511234567'), findsNWidgets(2));
    expect(find.text('Orden terminada sin entregar'), findsOneWidget);
    expect(find.text('Cita de mañana'), findsOneWidget);
    expect(
      find.text('Orden #42 — Toyota Corolla 2015 (ABC1234)'),
      findsOneWidget,
    );
    expect(find.text('Ya lo hablé'), findsNWidgets(2));
  });

  testWidgets(
      'marcar «Ya lo hablé» registra el aviso con la nota y quita solo esa fila (CA-11)',
      (tester) async {
    final api = _ApiFalsa(pendientes: _pendientes);
    await tester.pumpWidget(_pantalla(api));
    await tester.pumpAndSettle();

    await tester.tap(find.text('Ya lo hablé').first);
    await tester.pumpAndSettle();

    // Diálogo con nota opcional.
    expect(find.byType(TextField), findsOneWidget);
    await tester.enterText(find.byType(TextField), 'Pasa el viernes.');
    await tester.tap(find.text('Registrar aviso'));
    await tester.pumpAndSettle();

    expect(api.registros, hasLength(1));
    expect(api.registros.first, {
      'clientId': 3,
      'type': 'ORDER_READY',
      'sourceId': 42,
      'note': 'Pasa el viernes.',
    });
    // La fila avisada se va; la otra del mismo cliente sigue pendiente.
    expect(find.text('Orden terminada sin entregar'), findsNothing);
    expect(find.text('Cita de mañana'), findsOneWidget);
    expect(find.text('Ya lo hablé'), findsOneWidget);
  });

  testWidgets('la nota es opcional: sin escribir nada se registra sin nota',
      (tester) async {
    final api = _ApiFalsa(pendientes: _pendientes);
    await tester.pumpWidget(_pantalla(api));
    await tester.pumpAndSettle();

    await tester.tap(find.text('Ya lo hablé').last);
    await tester.pumpAndSettle();
    await tester.tap(find.text('Registrar aviso'));
    await tester.pumpAndSettle();

    expect(api.registros, hasLength(1));
    expect(api.registros.first['type'], 'APPOINTMENT_TOMORROW');
    expect(api.registros.first.containsKey('note'), isFalse);
  });

  testWidgets('cancelar el diálogo no registra nada ni quita la fila',
      (tester) async {
    final api = _ApiFalsa(pendientes: _pendientes);
    await tester.pumpWidget(_pantalla(api));
    await tester.pumpAndSettle();

    await tester.tap(find.text('Ya lo hablé').first);
    await tester.pumpAndSettle();
    await tester.tap(find.text('Cancelar'));
    await tester.pumpAndSettle();

    expect(api.registros, isEmpty);
    expect(find.text('Ya lo hablé'), findsNWidgets(2));
  });

  testWidgets('sin pendientes usa EmptyView', (tester) async {
    await tester.pumpWidget(_pantalla(_ApiFalsa()));
    await tester.pumpAndSettle();

    expect(find.byType(EmptyView), findsOneWidget);
    expect(find.text('No hay clientes por avisar.'), findsOneWidget);
  });

  testWidgets('con la carga en curso usa LoadingView', (tester) async {
    await tester.pumpWidget(_pantalla(_ApiFalsa(pendientes: _pendientes)));
    // Primer frame: la carga arrancó y aún no responde.
    expect(find.byType(LoadingView), findsOneWidget);
    await tester.pumpAndSettle();
  });

  testWidgets('con error usa ErrorView con Reintentar', (tester) async {
    await tester.pumpWidget(_pantalla(_ApiFalsa(fallaLista: true)));
    await tester.pumpAndSettle();

    expect(find.byType(ErrorView), findsOneWidget);
    expect(find.text('No se pudo consultar la lista.'), findsOneWidget);
    expect(find.text('Reintentar'), findsOneWidget);
  });

  testWidgets('la sección «Por avisar» solo aparece para administrador y recepción (FR-010)',
      (tester) async {
    for (final (rol, visible) in [
      ('ADMIN', true),
      ('RECEPTIONIST', true),
      ('MECHANIC', false),
    ]) {
      await tester.pumpWidget(_shell(_ApiFalsa(), rol));
      await tester.pump();

      expect(
        find.descendant(
          of: find.byType(NavigationRail),
          matching: find.text('Por avisar'),
        ),
        visible ? findsOneWidget : findsNothing,
        reason: 'rol $rol',
      );
    }
  });
}
