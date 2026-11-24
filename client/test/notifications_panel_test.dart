import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:provider/provider.dart';

import 'package:motorix_client/models/user.dart';
import 'package:motorix_client/providers/clients_provider.dart';
import 'package:motorix_client/providers/maintenances_provider.dart';
import 'package:motorix_client/providers/notifications_provider.dart';
import 'package:motorix_client/providers/session_provider.dart';
import 'package:motorix_client/providers/ui_provider.dart';
import 'package:motorix_client/screens/maintenances/maintenance_list_screen.dart';
import 'package:motorix_client/screens/notifications/notifications_panel.dart';
import 'package:motorix_client/services/api_client.dart';
import 'package:motorix_client/utils/app_route.dart';
import 'package:motorix_client/widgets/app_shell.dart';
import 'package:motorix_client/widgets/states_view.dart';

// T013: campana con el total de no leídos, panel de avisos agrupado por
// tipo con su detalle en español y estados de carga/vacío/error con
// states_view.dart (CA-9, FR-009, CA-1).

class _ApiFalsa extends ApiClient {
  _ApiFalsa({this.respuesta});

  final Map<String, dynamic>? respuesta;
  final Set<String> leidas = {};
  int llamadasNotificaciones = 0;
  int posteosLectura = 0;

  /// GET con las lecturas aplicadas (recálculo en cada consulta, CA-2): los
  /// ítems leídos quedan `read: true` y el contador baja en la respuesta.
  Map<String, dynamic> _respuestaConLecturas() {
    final base = respuesta ?? {'unreadCount': 0, 'groups': <dynamic>[]};
    var noLeidos = 0;
    final grupos = <dynamic>[];
    for (final grupoCrudo in base['groups'] as List<dynamic>) {
      final grupo = Map<String, dynamic>.from(grupoCrudo as Map);
      final items = <dynamic>[];
      for (final itemCrudo in grupo['items'] as List<dynamic>) {
        final item = Map<String, dynamic>.from(itemCrudo as Map);
        final leida = item['read'] == true || leidas.contains(item['key']);
        item['read'] = leida;
        if (!leida) noLeidos += 1;
        items.add(item);
      }
      grupo['items'] = items;
      grupos.add(grupo);
    }
    return {'unreadCount': noLeidos, 'groups': grupos};
  }

  @override
  Future<dynamic> get(String path, {Map<String, String>? query}) async {
    if (path.contains('notifications')) {
      llamadasNotificaciones += 1;
      return _respuestaConLecturas();
    }
    // Las demás pantallas del shell reciben listas vacías parseables.
    if (path.contains('clients')) return {'clients': <dynamic>[], 'total': 0};
    return <String, dynamic>{};
  }

  @override
  Future<dynamic> post(String path, Object cuerpo) async {
    if (path.contains('notifications')) {
      leidas.add((cuerpo as Map)['key'] as String);
      posteosLectura += 1;
      return {
        'read': true,
        'unreadCount': _respuestaConLecturas()['unreadCount'],
      };
    }
    throw ApiError(
      status: 404,
      code: 'NOT_FOUND',
      message: 'Ruta no disponible.',
    );
  }
}

/// Escena con avisos de los 4 grupos (2 leídos → 4 no leídos).
const Map<String, dynamic> _respuestaCompleta = {
  'unreadCount': 4,
  'groups': [
    {
      'type': 'MAINTENANCE',
      'label': 'Mantenimientos',
      'items': [
        {
          'key': 'MAINTENANCE:12:OVERDUE',
          'read': false,
          'title': 'Mantenimiento vencido — Toyota Corolla ABC1234',
          'detail': 'Venció el 2026-10-30',
          'severity': 'OVERDUE',
          'navigation': {'route': '/maintenance', 'entityId': 12},
        },
      ],
    },
    {
      'type': 'APPOINTMENT',
      'label': 'Citas de hoy',
      'items': [
        {
          'key': 'APPOINTMENT:7:TODAY',
          'read': true,
          'title': 'Cita de hoy — Nissan Versa DEF5678',
          'detail': '10:00 · Revisión general',
          'severity': 'TODAY',
          'navigation': {'route': '/appointments', 'entityId': 7},
        },
      ],
    },
    {
      'type': 'STOCK',
      'label': 'Stock',
      'items': [
        {
          'key': 'STOCK:3:LOW',
          'read': false,
          'title': 'Stock bajo — Balatas traseras',
          'detail': 'Quedan 4 piezas (mínimo 5)',
          'severity': 'LOW',
          'navigation': {'route': '/inventory', 'entityId': 3},
        },
        {
          'key': 'STOCK:4:OUT',
          'read': false,
          'title': 'Stock agotado — Fusible 10A',
          'detail': 'Sin existencias (mínimo 2)',
          'severity': 'OUT',
          'navigation': {'route': '/inventory', 'entityId': 4},
        },
      ],
    },
    {
      'type': 'ORDER_STOPPED',
      'label': 'Órdenes detenidas',
      'items': [
        {
          'key': 'ORDER_STOPPED:42:RECEIVED',
          'read': false,
          'title': 'Orden detenida — Toyota Corolla ABC1234',
          'detail': 'Sin cambios desde hace 3 días (recibida)',
          'severity': 'RECEIVED',
          'navigation': {'route': '/orders', 'entityId': 42},
        },
      ],
    },
  ],
};

/// Provider con estado de prueba inyectado (sin notificar, como en
/// app_shell_test): los tests de estados no dependen de la API.
NotificationsProvider _provider(
  ApiClient api, {
  bool cargando = false,
  String? error,
}) {
  final provider = NotificationsProvider(api);
  provider.cargando = cargando;
  provider.error = error;
  return provider;
}

Widget _shell(
  _ApiFalsa api,
  NotificationsProvider notificaciones, {
  String rol = 'ADMIN',
}) {
  final sesion = SessionProvider(api);
  sesion.usuario = User(
    id: 1,
    username: 'admin',
    name: 'Administrador',
    email: 'admin@motorix.local',
    role: rol,
  );
  return MultiProvider(
    providers: [
      ChangeNotifierProvider<SessionProvider>.value(value: sesion),
      ChangeNotifierProvider<UiProvider>(create: (_) => UiProvider()),
      // La sección Clientes se construye al cambiar de sección (CA-1).
      ChangeNotifierProvider<ClientsProvider>(
        create: (_) => ClientsProvider(api),
      ),
      // La sección Mantenimientos se abre desde un aviso (FR-007, T029).
      ChangeNotifierProvider<MaintenancesProvider>(
        create: (_) => MaintenancesProvider(api),
      ),
      ChangeNotifierProvider<NotificationsProvider>.value(
        value: notificaciones,
      ),
    ],
    child: MaterialApp(
      theme: ThemeData(useMaterial3: true),
      home: const AppShell(),
    ),
  );
}

Widget _panel(NotificationsProvider notificaciones) {
  return ChangeNotifierProvider<NotificationsProvider>.value(
    value: notificaciones,
    child: MaterialApp(
      theme: ThemeData(useMaterial3: true),
      home: const Scaffold(body: NotificationsPanel()),
    ),
  );
}

void main() {
  testWidgets('la campana muestra el total de no leídos en todas las secciones',
      (tester) async {
    final api = _ApiFalsa(respuesta: _respuestaCompleta);
    final notificaciones = _provider(api);
    notificaciones.unreadCount = 4; // estado de prueba, sin notificar
    await tester.pumpWidget(_shell(api, notificaciones));
    await tester.pump();

    expect(find.byTooltip('Notificaciones'), findsOneWidget);
    expect(find.text('4'), findsOneWidget, reason: 'contador de la campana');

    // CA-1: la campana sigue visible al cambiar de sección.
    await tester.tap(
      find.descendant(
        of: find.byType(NavigationRail),
        matching: find.text('Clientes'),
      ),
    );
    await tester.pumpAndSettle();
    expect(find.byTooltip('Notificaciones'), findsOneWidget);
    expect(find.text('4'), findsOneWidget);
  });

  testWidgets('tocar la campana abre el panel con los avisos agrupados en español',
      (tester) async {
    final api = _ApiFalsa(respuesta: _respuestaCompleta);
    final notificaciones = _provider(api);
    await tester.pumpWidget(_shell(api, notificaciones));
    await tester.pump();

    await tester.tap(find.byTooltip('Notificaciones'));
    await tester.pumpAndSettle();

    // Agrupación por tipo con sus rótulos (FR-002).
    expect(find.text('Mantenimientos'), findsWidgets);
    expect(find.text('Citas de hoy'), findsWidgets);
    expect(find.text('Stock'), findsWidgets);
    expect(find.text('Órdenes detenidas'), findsWidgets);

    // Detalle en español de los ítems (FR-003, CA-9).
    expect(
      find.text('Mantenimiento vencido — Toyota Corolla ABC1234'),
      findsOneWidget,
    );
    expect(find.text('Venció el 2026-10-30'), findsOneWidget);
    expect(find.text('Cita de hoy — Nissan Versa DEF5678'), findsOneWidget);
    expect(find.text('Quedan 4 piezas (mínimo 5)'), findsOneWidget);

    // El último grupo queda bajo el pliegue del sheet: se desplaza el panel.
    await tester.drag(find.byType(ListView), const Offset(0, -300));
    await tester.pumpAndSettle();
    expect(find.text('Sin cambios desde hace 3 días (recibida)'), findsOneWidget);

    // D-03: abrir el panel recarga los avisos.
    expect(api.llamadasNotificaciones, greaterThanOrEqualTo(1));
  });

  testWidgets('sin avisos el panel muestra el estado vacío (CA-9)',
      (tester) async {
    final notificaciones = _provider(
      _ApiFalsa(respuesta: {'unreadCount': 0, 'groups': <dynamic>[]}),
    );
    await tester.pumpWidget(_panel(notificaciones));
    await tester.pump();

    expect(find.byType(EmptyView), findsOneWidget);
    expect(find.text('No hay avisos por ahora.'), findsOneWidget);
    expect(find.byType(CircularProgressIndicator), findsNothing);
  });

  testWidgets('con la carga en curso el panel usa LoadingView (CA-9)',
      (tester) async {
    final notificaciones = _provider(_ApiFalsa(), cargando: true);
    await tester.pumpWidget(_panel(notificaciones));
    await tester.pump();

    expect(find.byType(LoadingView), findsOneWidget);
    expect(find.byType(CircularProgressIndicator), findsOneWidget);
    expect(find.byType(EmptyView), findsNothing);
  });

  testWidgets('con error el panel usa ErrorView con reintentar (CA-9, FR-009)',
      (tester) async {
    final notificaciones = _provider(
      _ApiFalsa(),
      error: 'No se pudieron cargar los avisos.',
    );
    await tester.pumpWidget(_panel(notificaciones));
    await tester.pump();

    expect(find.byType(ErrorView), findsOneWidget);
    expect(find.text('No se pudieron cargar los avisos.'), findsOneWidget);
    expect(find.text('Reintentar'), findsOneWidget);
  });

  testWidgets(
      'marcar leído decrementa la campana, persiste al reabrir y abre la pantalla relacionada (FR-006/FR-007)',
      (tester) async {
    final api = _ApiFalsa(respuesta: _respuestaCompleta);
    final notificaciones = _provider(api);
    await tester.pumpWidget(_shell(api, notificaciones));
    await tester.pump();

    // Tocar la campana recarga los avisos (D-03) y abre el panel.
    await tester.tap(find.byTooltip('Notificaciones'));
    await tester.pumpAndSettle();
    expect(find.text('4'), findsOneWidget, reason: 'contador antes de leer');

    // Tocar el aviso: marca la lectura y abre su sección relacionada (T029).
    await tester.tap(
      find.text('Mantenimiento vencido — Toyota Corolla ABC1234'),
    );
    await tester.pumpAndSettle();

    expect(api.posteosLectura, 1);
    expect(
      find.byType(MaintenanceListScreen),
      findsOneWidget,
      reason: 'pantalla relacionada del aviso (FR-007)',
    );
    expect(
      find.text('3'),
      findsOneWidget,
      reason: 'contador tras leer (optimista y re-sync)',
    );

    // Volver al inicio y reabrir la campana: la lectura persistió (SC-004).
    await tester.tap(
      find.descendant(
        of: find.byType(NavigationRail),
        matching: find.text('Inicio'),
      ),
    );
    await tester.pumpAndSettle();
    await tester.tap(find.byTooltip('Notificaciones'));
    await tester.pumpAndSettle();

    expect(find.text('3'), findsOneWidget, reason: 'contador persistido');
    // El aviso leído sigue visible (CA-6) y ya muestra su check.
    expect(
      find.text('Mantenimiento vencido — Toyota Corolla ABC1234'),
      findsOneWidget,
    );
    expect(find.byIcon(Icons.check_circle_outline), findsWidgets);
    expect(notificaciones.unreadCount, 3);
  });

  // T046 (US5, D-08, CA-4): con sesión de mecánico el servidor solo entrega
  // sus órdenes detenidas; la campana no cuenta avisos ajenos y, sin
  // órdenes, el panel queda en estado vacío.
  testWidgets(
      'mecánico con una orden propia: la campana cuenta solo ese aviso y el panel no muestra otros grupos',
      (tester) async {
    final api = _ApiFalsa(
      respuesta: {
        'unreadCount': 1,
        'groups': [
          {'type': 'MAINTENANCE', 'label': 'Mantenimientos', 'items': []},
          {'type': 'APPOINTMENT', 'label': 'Citas de hoy', 'items': []},
          {'type': 'STOCK', 'label': 'Stock', 'items': []},
          {
            'type': 'ORDER_STOPPED',
            'label': 'Órdenes detenidas',
            'items': [
              {
                'key': 'ORDER_STOPPED:42:RECEIVED',
                'read': false,
                'title': 'Orden detenida — Toyota Corolla ABC1234',
                'detail': 'Sin cambios desde hace 3 días (recibida)',
                'severity': 'RECEIVED',
                'navigation': {'route': '/orders', 'entityId': 42},
              },
            ],
          },
        ],
      },
    );
    final notificaciones = _provider(api);
    notificaciones.unreadCount = 1;
    await tester.pumpWidget(_shell(api, notificaciones, rol: 'MECHANIC'));
    await tester.pump();

    expect(find.text('1'), findsOneWidget, reason: 'solo su aviso');

    await tester.tap(find.byTooltip('Notificaciones'));
    await tester.pumpAndSettle();

    expect(find.text('Órdenes detenidas'), findsWidgets);
    expect(
      find.text('Orden detenida — Toyota Corolla ABC1234'),
      findsOneWidget,
    );
    // Se acota al panel: «Mantenimientos» también es una sección del menú.
    for (final rotulo in ['Mantenimientos', 'Citas de hoy', 'Stock']) {
      expect(
        find.descendant(
          of: find.byType(NotificationsPanel),
          matching: find.text(rotulo),
        ),
        findsNothing,
        reason: 'el mecánico no recibe el grupo $rotulo',
      );
    }
  });

  testWidgets('mecánico sin órdenes: sin contador en la campana y panel vacío',
      (tester) async {
    final api = _ApiFalsa(
      respuesta: {
        'unreadCount': 0,
        'groups': [
          {'type': 'MAINTENANCE', 'label': 'Mantenimientos', 'items': []},
          {'type': 'APPOINTMENT', 'label': 'Citas de hoy', 'items': []},
          {'type': 'STOCK', 'label': 'Stock', 'items': []},
          {'type': 'ORDER_STOPPED', 'label': 'Órdenes detenidas', 'items': []},
        ],
      },
    );
    final notificaciones = _provider(api);
    await tester.pumpWidget(_shell(api, notificaciones, rol: 'MECHANIC'));
    await tester.pump();

    expect(find.byTooltip('Notificaciones'), findsOneWidget);
    expect(find.text('0'), findsNothing, reason: 'sin insignia con 0 avisos');

    await tester.tap(find.byTooltip('Notificaciones'));
    await tester.pumpAndSettle();

    expect(find.byType(EmptyView), findsOneWidget);
    expect(find.text('No hay avisos por ahora.'), findsOneWidget);
  });

  // T042 (US4, aceptación 3): cada ruta de aviso abre su sección del shell;
  // la orden detenida (`/orders`) lleva a la sección de Órdenes (índice 4).
  test('las rutas de los avisos abren su sección del shell (T042)', () {
    expect(AppRutas.seccionDeRuta(AppRutas.orden), 4);
    expect(AppRutas.seccionDeRuta(AppRutas.mantenimiento), 7);
    expect(AppRutas.seccionDeRuta(AppRutas.cita), 3);
    expect(AppRutas.seccionDeRuta(AppRutas.inventario), 8);
    // Una ruta desconocida no navega (entityId queda reservado).
    expect(AppRutas.seccionDeRuta('/clientes'), isNull);
  });
}
