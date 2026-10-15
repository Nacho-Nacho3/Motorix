import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:provider/provider.dart';

import 'package:motorix_client/models/user.dart';
import 'package:motorix_client/providers/dashboard_provider.dart';
import 'package:motorix_client/providers/session_provider.dart';
import 'package:motorix_client/providers/ui_provider.dart';
import 'package:motorix_client/screens/dashboard/dashboard_screen.dart';
import 'package:motorix_client/services/api_client.dart';
import 'package:motorix_client/widgets/app_shell.dart';

/// ApiClient falso del panel (US5/US6): devuelve el resumen y, opcionalmente,
/// el detalle de las 4 secciones. Para el rail se usa igual que en
/// `app_shell_test.dart` (respuesta plana).
class _ApiPanelFalsa extends ApiClient {
  _ApiPanelFalsa({this.conDetalle = false});

  /// true → las 4 secciones con registros; false → secciones vacías.
  final bool conDetalle;

  int cargas = 0;

  static const Map<String, dynamic> _resumen = {
    'summary': {
      'vehiclesAttended': 12,
      'vehiclesInRepair': 3,
      'ordersPending': 4,
      'ordersFinished': 18,
      'nextAppointments': 7,
      'upcomingMaintenances': 5,
      'overdueMaintenances': 1,
      'lowStockCount': 2,
    },
    'recentOrders': <Map<String, dynamic>>[],
    'nextAppointments': <Map<String, dynamic>>[],
    'maintenances': {
      'upcoming': <Map<String, dynamic>>[],
      'overdue': <Map<String, dynamic>>[],
    },
    'lowStockParts': <Map<String, dynamic>>[],
  };

  static const Map<String, dynamic> _orden = {
    'id': 12,
    'clientName': 'María López',
    'vehicleLabel': 'Nissan Versa 2020',
    'status': 'FINISHED',
    'total': '3150.00',
    'updatedAt': '2026-10-14T12:00:00',
  };

  static const Map<String, dynamic> _cita = {
    'id': 7,
    'clientName': 'María López',
    'vehicleLabel': 'Nissan Versa 2020',
    'appointmentDate': '2026-10-16',
    'appointmentTime': '10:00:00',
    'reason': 'Revisión de frenos',
    'status': 'CONFIRMED',
  };

  static const Map<String, dynamic> _mttoPorVencer = {
    'id': 3,
    'vehicleLabel': 'Nissan Versa 2020',
    'clientName': 'María López',
    'nextDueDate': '2026-10-20',
    'nextDueMileage': 46000,
    'daysRemaining': 6,
    'mileageRemaining': 1000,
  };

  static const Map<String, dynamic> _mttoVencido = {
    'id': 1,
    'vehicleLabel': 'Mazda 3 2018',
    'clientName': 'Juan Pérez',
    'nextDueDate': '2026-09-30',
    'nextDueMileage': null,
    'daysRemaining': -14,
    'mileageRemaining': null,
  };

  static const Map<String, dynamic> _refaccion = {
    'id': 1,
    'partCode': 'BAL-001',
    'name': 'Balatas traseras',
    'stockCurrent': 2,
    'stockMin': 5,
  };

  @override
  Future<dynamic> get(String path, {Map<String, String>? query}) async {
    if (path.endsWith('/dashboard')) {
      cargas += 1;
      return {
        ..._resumen,
        'recentOrders': conDetalle
            ? <Map<String, dynamic>>[_orden]
            : <Map<String, dynamic>>[],
        'nextAppointments': conDetalle
            ? <Map<String, dynamic>>[_cita]
            : <Map<String, dynamic>>[],
        'maintenances': {
          'upcoming': conDetalle
              ? <Map<String, dynamic>>[_mttoPorVencer]
              : <Map<String, dynamic>>[],
          'overdue': conDetalle
              ? <Map<String, dynamic>>[_mttoVencido]
              : <Map<String, dynamic>>[],
        },
        'lowStockParts': conDetalle
            ? <Map<String, dynamic>>[_refaccion]
            : <Map<String, dynamic>>[],
      };
    }
    // El shell y su portada consultan otras rutas; respuesta plana.
    return {'users': <Map<String, dynamic>>[]};
  }
}

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

const _mecanico = User(
  id: 3,
  username: 'mecanico',
  name: 'Mecánico',
  email: 'mecanico@motorix.local',
  role: 'MECHANIC',
);

Widget _shell(User usuario) {
  final sesion = SessionProvider(_ApiPanelFalsa());
  sesion.usuario = usuario; // estado de prueba, sin notificar
  return MultiProvider(
    providers: [
      ChangeNotifierProvider<SessionProvider>.value(value: sesion),
      ChangeNotifierProvider<UiProvider>(create: (_) => UiProvider()),
    ],
    child: MaterialApp(
      theme: ThemeData(useMaterial3: true),
      home: const AppShell(),
    ),
  );
}

Widget _panel(ApiClient api) {
  return ChangeNotifierProvider<DashboardProvider>(
    create: (_) => DashboardProvider(api),
    child: MaterialApp(
      theme: ThemeData(useMaterial3: true),
      home: const DashboardScreen(),
    ),
  );
}

void main() {
  testWidgets('la entrada Dashboard es visible solo para ADMIN (FR-012)',
      (tester) async {
    await tester.pumpWidget(_shell(_administrador));
    await tester.pump();

    expect(
      find.text('Dashboard'),
      findsWidgets,
      reason: 'ADMIN ve el panel en el rail (RN-15, CA-6)',
    );

    await tester.pumpWidget(_shell(_recepcionista));
    await tester.pump();

    expect(
      find.text('Dashboard'),
      findsNothing,
      reason: 'RECEPTIONIST no tiene acceso al panel (403 en el backend)',
    );
  });

  testWidgets('el rol MECHANIC tampoco ve la entrada Dashboard', (tester) async {
    await tester.pumpWidget(_shell(_mecanico));
    await tester.pump();

    expect(find.text('Dashboard'), findsNothing);
  });

  testWidgets('las 8 tarjetas muestran su etiqueta en español y su valor',
      (tester) async {
    final api = _ApiPanelFalsa();
    await tester.pumpWidget(_panel(api));
    await tester.pumpAndSettle();

    const indicadores = {
      'Vehículos atendidos': '12',
      'Vehículos en reparación': '3',
      'Órdenes pendientes': '4',
      'Órdenes terminadas': '18',
      'Próximas citas': '7',
      'Mantenimientos próximos': '5',
      'Mantenimientos vencidos': '1',
      'Refacciones con stock bajo': '2',
    };

    for (final indicador in indicadores.entries) {
      expect(
        find.text(indicador.key),
        // «Próximas citas» es a la vez etiqueta del contador (US5) y título
        // de la sección de detalle (US6): aparece en ambos lugares.
        indicador.key == 'Próximas citas' ? findsWidgets : findsOneWidget,
        reason: 'falta la etiqueta «${indicador.key}» (CA-6, FR-012)',
      );
      expect(
        find.text(indicador.value),
        findsOneWidget,
        reason: 'falta el valor de «${indicador.key}»',
      );
    }
    expect(api.cargas, greaterThanOrEqualTo(1));
  });

  // ── US6, T060: detalle de las 4 secciones ──

  testWidgets('las 4 secciones de detalle renderizan sus registros', (
    tester,
  ) async {
    final api = _ApiPanelFalsa(conDetalle: true);
    await tester.pumpWidget(_panel(api));
    await tester.pumpAndSettle();

    // Títulos de sección (US6: del resumen a la acción).
    expect(find.text('Últimas órdenes'), findsOneWidget);
    // «Próximas citas» también es etiqueta del contador del resumen.
    expect(find.text('Próximas citas'), findsWidgets);
    expect(find.text('Mantenimientos'), findsOneWidget);
    expect(find.text('Alertas de inventario'), findsOneWidget);

    // Últimas órdenes: cliente, vehículo, estado en español y total calculado.
    expect(find.text('María López'), findsWidgets);
    expect(find.text('Nissan Versa 2020'), findsWidgets);
    expect(find.text('Terminado'), findsOneWidget);
    expect(find.text('Total: \$3150.00'), findsOneWidget);

    // Próximas citas: motivo y fecha/hora de la más cercana.
    expect(find.text('Revisión de frenos'), findsOneWidget);
    expect(find.text('2026-10-16 · 10:00'), findsOneWidget);
    expect(find.text('Confirmada'), findsOneWidget);

    // Mantenimientos: próximos y vencidos con sus días restantes.
    expect(find.text('Faltan 6 días'), findsOneWidget);
    expect(find.text('Vencido hace 14 días'), findsOneWidget);
    expect(find.text('Mazda 3 2018'), findsOneWidget);

    // Alertas de inventario: código, nombre y existencias/mínimo.
    expect(find.text('BAL-001'), findsOneWidget);
    expect(find.text('Balatas traseras'), findsOneWidget);
    expect(find.text('2 / 5'), findsOneWidget);
  });

  testWidgets('cada sección vacía muestra su estado vacío en español', (
    tester,
  ) async {
    await tester.pumpWidget(_panel(_ApiPanelFalsa()));
    await tester.pumpAndSettle();

    expect(find.text('Últimas órdenes'), findsOneWidget);
    expect(find.text('Aún no hay órdenes recientes.'), findsOneWidget);

    expect(find.text('Próximas citas'), findsWidgets);
    expect(find.text('No hay citas próximas.'), findsOneWidget);

    expect(find.text('Mantenimientos'), findsOneWidget);
    expect(
      find.text('Sin mantenimientos por vencer ni vencidos.'),
      findsOneWidget,
    );

    expect(find.text('Alertas de inventario'), findsOneWidget);
    expect(find.text('No hay refacciones con stock bajo.'), findsOneWidget);
  });

  testWidgets('el botón «Actualizar» recarga el panel (RN-10)', (
    tester,
  ) async {
    final api = _ApiPanelFalsa(conDetalle: true);
    await tester.pumpWidget(_panel(api));
    await tester.pumpAndSettle();
    expect(api.cargas, 1, reason: 'la primera carga es al abrir el panel');

    await tester.tap(find.byTooltip('Actualizar'));
    await tester.pumpAndSettle();

    expect(
      api.cargas,
      2,
      reason: 'RN-10/SC-007: cada consulta recalcula todo sin caché',
    );
  });
}
