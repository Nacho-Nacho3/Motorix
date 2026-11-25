import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:provider/provider.dart';

import 'package:motorix_client/models/report_result.dart';
import 'package:motorix_client/models/user.dart';
import 'package:motorix_client/providers/notifications_provider.dart';
import 'package:motorix_client/providers/reports_provider.dart';
import 'package:motorix_client/providers/session_provider.dart';
import 'package:motorix_client/providers/ui_provider.dart';
import 'package:motorix_client/screens/reports/reports_screen.dart';
import 'package:motorix_client/services/api_client.dart';
import 'package:motorix_client/widgets/app_shell.dart';
import 'package:motorix_client/widgets/states_view.dart';

// T095 (Sprint 7, US4, FR-010 a FR-012, FR-015, FR-016): pantalla Reportes con
// selector de periodo (hoy, semana, mes y rango libre) y pestaña de ingresos con
// tabla y totales; estados de carga, vacío y error; sección solo para ADMIN.

class _ApiFalsa extends ApiClient {
  _ApiFalsa({this.vacio = false, this.falla = false, this.aproximadas = 0, this.sinCosto = 4});

  final bool vacio;
  final bool falla;
  final int aproximadas;
  final int sinCosto;
  final List<Map<String, String>> consultas = [];
  final List<String> rutas = [];

  @override
  Future<dynamic> get(String path, {Map<String, String>? query}) async {
    if (path.startsWith('/reports/')) rutas.add(path);
    if (path == '/reports/services') {
      if (falla) {
        throw ApiError(status: 500, code: 'INTERNAL_ERROR', message: 'No se pudo calcular el reporte.');
      }
      return {
        'from': query?['from'],
        'to': query?['to'],
        'rows': vacio
            ? <dynamic>[]
            : [
                {'serviceTypeId': 1, 'serviceType': 'Cambio de aceite', 'count': 12, 'amount': '7200.00'},
                {'serviceTypeId': null, 'serviceType': 'Sin tipo de servicio', 'count': 30, 'amount': '9100.00'},
              ],
        'totals': {'count': vacio ? 0 : 42, 'amount': vacio ? '0.00' : '16300.00'},
        'truncated': false,
      };
    }
    if (path == '/reports/productivity') {
      if (falla) {
        throw ApiError(status: 500, code: 'INTERNAL_ERROR', message: 'No se pudo calcular el reporte.');
      }
      return {
        'from': query?['from'],
        'to': query?['to'],
        'rows': vacio
            ? <dynamic>[]
            : [
                {'mechanicId': 3, 'mechanicName': 'Mecánico Uno', 'ordersFinished': 5, 'laborAmount': '2400.00'},
                {'mechanicId': 4, 'mechanicName': 'Mecánico Dos', 'ordersFinished': 4, 'laborAmount': '1750.00'},
              ],
        'totals': {'ordersFinished': vacio ? 0 : 9, 'laborAmount': vacio ? '0.00' : '4150.00'},
        'approximateDates': aproximadas,
        'truncated': false,
      };
    }
    if (path == '/reports/parts-margin') {
      if (falla) {
        throw ApiError(status: 500, code: 'INTERNAL_ERROR', message: 'No se pudo calcular el reporte.');
      }
      return {
        'from': query?['from'],
        'to': query?['to'],
        'rows': vacio
            ? <dynamic>[]
            : [
                {
                  'partId': 2,
                  'partCode': 'FIL-002',
                  'name': 'Filtro de aceite',
                  'units': 6,
                  'salesAmount': '900.00',
                  'costAmount': '360.00',
                  'marginAmount': '540.00',
                  'unitsWithoutCost': 0,
                  'salesWithoutCost': '0.00',
                },
                {
                  'partId': 7,
                  'partCode': 'ADT-007',
                  'name': 'Aditivo para radiador',
                  'units': 4,
                  'salesAmount': '720.00',
                  'costAmount': '0.00',
                  'marginAmount': '0.00',
                  'unitsWithoutCost': 4,
                  'salesWithoutCost': '720.00',
                },
              ],
        'totals': {
          'units': vacio ? 0 : 10,
          'salesAmount': vacio ? '0.00' : '1620.00',
          'costAmount': vacio ? '0.00' : '360.00',
          'marginAmount': vacio ? '0.00' : '540.00',
          'unitsWithoutCost': vacio ? 0 : sinCosto,
          'salesWithoutCost': vacio ? '0.00' : '720.00',
        },
        'truncated': false,
      };
    }
    if (path == '/reports/inventory-rotation') {
      if (falla) {
        throw ApiError(status: 500, code: 'INTERNAL_ERROR', message: 'No se pudo calcular el reporte.');
      }
      return {
        'from': query?['from'],
        'to': query?['to'],
        'rows': vacio
            ? <dynamic>[]
            : [
                {
                  'partId': 2,
                  'partCode': 'FIL-002',
                  'name': 'Filtro de aceite',
                  'unitsOut': 6,
                  'averageStock': '8.50',
                  'rotation': '0.71',
                },
                {
                  'partId': 9,
                  'partCode': 'AGO-009',
                  'name': 'Pieza agotada',
                  'unitsOut': 0,
                  'averageStock': '0.00',
                  'rotation': null,
                },
              ],
        'totals': {'unitsOut': vacio ? 0 : 6},
        'truncated': false,
      };
    }
    if (path == '/reports/income') {
      consultas.add(Map<String, String>.from(query ?? {}));
      if (falla) {
        throw ApiError(
          status: 500,
          code: 'INTERNAL_ERROR',
          message: 'No se pudo calcular el reporte.',
        );
      }
      return {
        'from': query?['from'],
        'to': query?['to'],
        'rows': vacio
            ? <dynamic>[]
            : [
                {'date': '2026-11-03', 'method': 'CASH', 'count': 2, 'total': '1850.00'},
                {'date': '2026-11-04', 'method': 'CARD', 'count': 1, 'total': '890.50'},
              ],
        'totals': {
          'count': vacio ? 0 : 3,
          'total': vacio ? '0.00' : '2740.50',
          'byMethod': vacio
              ? <dynamic>[]
              : [
                  {'method': 'CARD', 'count': 1, 'total': '890.50'},
                  {'method': 'CASH', 'count': 2, 'total': '1850.00'},
                ],
        },
        'truncated': false,
      };
    }
    if (path.contains('notifications')) {
      return {'unreadCount': 0, 'groups': <dynamic>[]};
    }
    return {'users': <Map<String, dynamic>>[]};
  }
}

DateTime _hoy() => DateTime(2026, 11, 25); // miércoles

Widget _pantalla(_ApiFalsa api) => MultiProvider(
      providers: [
        ChangeNotifierProvider<ReportsProvider>(
          create: (_) => ReportsProvider(api, ahora: _hoy),
        ),
      ],
      child: MaterialApp(
        theme: ThemeData(useMaterial3: true),
        home: const ReportsScreen(),
      ),
    );

Future<void> _grande(WidgetTester tester) async {
  tester.view.devicePixelRatio = 1;
  tester.view.physicalSize = const Size(1400, 1400);
  addTearDown(tester.view.resetPhysicalSize);
  addTearDown(tester.view.resetDevicePixelRatio);
}

void main() {
  group('Periodo del proveedor', () {
    test('por omisión es el mes en curso, del día 1 a hoy', () {
      final proveedor = ReportsProvider(_ApiFalsa(), ahora: _hoy);

      expect(proveedor.atajo, AtajoPeriodo.mes);
      expect(proveedor.desde, '2026-11-01');
      expect(proveedor.hasta, '2026-11-25');
    });

    test('los atajos hoy, semana y mes calculan sus fechas', () {
      final proveedor = ReportsProvider(_ApiFalsa(), ahora: _hoy);

      proveedor.aplicarAtajo(AtajoPeriodo.hoy);
      expect([proveedor.desde, proveedor.hasta], ['2026-11-25', '2026-11-25']);

      proveedor.aplicarAtajo(AtajoPeriodo.semana);
      expect([proveedor.desde, proveedor.hasta], ['2026-11-23', '2026-11-25']);

      proveedor.aplicarAtajo(AtajoPeriodo.mes);
      expect([proveedor.desde, proveedor.hasta], ['2026-11-01', '2026-11-25']);
    });

    test('el rango libre valida orden y máximo de 366 días', () {
      final proveedor = ReportsProvider(_ApiFalsa(), ahora: _hoy);

      expect(proveedor.aplicarRango('2026-11-10', '2026-11-01'), isFalse);
      expect(proveedor.errorPeriodo, 'La fecha final no puede ser anterior a la inicial.');

      expect(proveedor.aplicarRango('2025-01-01', '2026-03-01'), isFalse);
      expect(proveedor.errorPeriodo, 'El periodo no puede pasar de 366 días.');

      expect(proveedor.aplicarRango('texto', '2026-03-01'), isFalse);
      expect(proveedor.errorPeriodo, 'Elige fechas válidas para el periodo.');

      expect(proveedor.aplicarRango('2026-01-01', '2027-01-01'), isTrue);
      expect(proveedor.errorPeriodo, isNull);
      expect(proveedor.desde, '2026-01-01');
    });

    test('un rango inválido no cambia el periodo vigente', () {
      final proveedor = ReportsProvider(_ApiFalsa(), ahora: _hoy);

      proveedor.aplicarRango('2026-11-10', '2026-11-01');

      expect(proveedor.desde, '2026-11-01');
      expect(proveedor.hasta, '2026-11-25');
    });
  });

  group('Pestaña de ingresos', () {
    testWidgets('muestra el total, los métodos y la tabla por fecha y método', (tester) async {
      await _grande(tester);
      final api = _ApiFalsa();
      await tester.pumpWidget(_pantalla(api));
      expect(find.byType(LoadingView), findsOneWidget);
      await tester.pumpAndSettle();

      expect(find.text('\$2740.50'), findsOneWidget);
      expect(find.text('3 pagos'), findsOneWidget);
      expect(find.textContaining('Efectivo: \$1850.00 (2)'), findsOneWidget);
      expect(find.byKey(const Key('tabla-ingresos')), findsOneWidget);
      expect(find.text('03/11/2026'), findsOneWidget);
      expect(find.text('Tarjeta'), findsWidgets);
      expect(api.consultas.single, {'from': '2026-11-01', 'to': '2026-11-25'});
      expect(find.textContaining('Del 01/11/2026 al 25/11/2026'), findsOneWidget);
    });

    testWidgets('sin pagos muestra el estado vacío', (tester) async {
      await _grande(tester);
      await tester.pumpWidget(_pantalla(_ApiFalsa(vacio: true)));
      await tester.pumpAndSettle();

      expect(find.byType(EmptyView), findsOneWidget);
      expect(find.text('No hay pagos cobrados en este periodo.'), findsOneWidget);
    });

    testWidgets('si falla muestra el error con reintento', (tester) async {
      await _grande(tester);
      await tester.pumpWidget(_pantalla(_ApiFalsa(falla: true)));
      await tester.pumpAndSettle();

      expect(find.byType(ErrorView), findsOneWidget);
      expect(find.text('No se pudo calcular el reporte.'), findsOneWidget);
      expect(find.text('Reintentar'), findsOneWidget);
    });

    testWidgets('cambiar el atajo recarga el reporte con el periodo nuevo', (tester) async {
      await _grande(tester);
      final api = _ApiFalsa();
      await tester.pumpWidget(_pantalla(api));
      await tester.pumpAndSettle();

      await tester.tap(find.byKey(const Key('periodo-hoy')));
      await tester.pumpAndSettle();

      expect(api.consultas.last, {'from': '2026-11-25', 'to': '2026-11-25'});

      await tester.tap(find.byKey(const Key('periodo-semana')));
      await tester.pumpAndSettle();
      expect(api.consultas.last, {'from': '2026-11-23', 'to': '2026-11-25'});
    });

    testWidgets('el rango libre muestra fechas y valida los 366 días', (tester) async {
      await _grande(tester);
      final api = _ApiFalsa();
      await tester.pumpWidget(_pantalla(api));
      await tester.pumpAndSettle();
      final consultasAntes = api.consultas.length;

      await tester.tap(find.byKey(const Key('periodo-libre')));
      await tester.pumpAndSettle();
      expect(find.byKey(const Key('rango-desde')), findsOneWidget);
      expect(find.byKey(const Key('rango-hasta')), findsOneWidget);

      // Sin cambiar el rango: el periodo vigente es válido y se aplica.
      await tester.tap(find.byKey(const Key('boton-aplicar-rango')));
      await tester.pumpAndSettle();
      expect(api.consultas.length, greaterThan(consultasAntes));
      expect(find.byKey(const Key('error-periodo')), findsNothing);
    });
  });

  group('Pestaña de servicios', () {
    testWidgets('muestra el total y el ranking con el renglón sin tipo', (tester) async {
      await _grande(tester);
      final api = _ApiFalsa();
      await tester.pumpWidget(_pantalla(api));
      await tester.pumpAndSettle();

      await tester.tap(find.text('Servicios'));
      await tester.pumpAndSettle();

      expect(api.rutas, contains('/reports/services'));
      expect(find.byKey(const Key('total-servicios')), findsOneWidget);
      expect(find.text('42'), findsOneWidget);
      expect(find.text('Importe: \$16300.00'), findsOneWidget);
      expect(find.text('Cambio de aceite'), findsOneWidget);
      expect(find.text('Sin tipo de servicio'), findsOneWidget);
    });

    testWidgets('sin datos muestra el estado vacío', (tester) async {
      await _grande(tester);
      await tester.pumpWidget(_pantalla(_ApiFalsa(vacio: true)));
      await tester.pumpAndSettle();
      await tester.tap(find.text('Servicios'));
      await tester.pumpAndSettle();

      expect(find.text('No hay servicios en órdenes terminadas en este periodo.'), findsOneWidget);
    });

    testWidgets('si falla muestra el error', (tester) async {
      await _grande(tester);
      await tester.pumpWidget(_pantalla(_ApiFalsa(falla: true)));
      await tester.pumpAndSettle();
      await tester.tap(find.text('Servicios'));
      await tester.pumpAndSettle();

      expect(find.text('No se pudo calcular el reporte.'), findsWidgets);
    });
  });

  group('Pestaña de productividad', () {
    testWidgets('muestra órdenes y mano de obra por mecánico', (tester) async {
      await _grande(tester);
      final api = _ApiFalsa();
      await tester.pumpWidget(_pantalla(api));
      await tester.pumpAndSettle();

      await tester.tap(find.text('Productividad'));
      await tester.pumpAndSettle();

      expect(api.rutas, contains('/reports/productivity'));
      expect(find.text('9'), findsOneWidget);
      expect(find.text('Mano de obra: \$4150.00'), findsOneWidget);
      expect(find.text('Mecánico Uno'), findsOneWidget);
      expect(find.text('\$1750.00'), findsOneWidget);
      expect(find.byKey(const Key('nota-fechas-aproximadas')), findsNothing);
    });

    testWidgets('avisa cuántas órdenes tienen fecha aproximada', (tester) async {
      await _grande(tester);
      await tester.pumpWidget(_pantalla(_ApiFalsa(aproximadas: 2)));
      await tester.pumpAndSettle();

      await tester.tap(find.text('Productividad'));
      await tester.pumpAndSettle();

      expect(find.byKey(const Key('nota-fechas-aproximadas')), findsOneWidget);
      expect(find.textContaining('2 órdenes tienen una fecha de terminación aproximada'), findsOneWidget);
    });

    testWidgets('con una sola orden aproximada usa el singular', (tester) async {
      await _grande(tester);
      await tester.pumpWidget(_pantalla(_ApiFalsa(aproximadas: 1)));
      await tester.pumpAndSettle();

      await tester.tap(find.text('Productividad'));
      await tester.pumpAndSettle();

      expect(find.textContaining('1 orden tiene una fecha de terminación aproximada'), findsOneWidget);
    });

    testWidgets('cambiar el periodo recarga también las pestañas ya abiertas', (tester) async {
      await _grande(tester);
      final api = _ApiFalsa();
      await tester.pumpWidget(_pantalla(api));
      await tester.pumpAndSettle();
      await tester.tap(find.text('Productividad'));
      await tester.pumpAndSettle();
      final antes = api.rutas.where((r) => r == '/reports/productivity').length;

      await tester.tap(find.byKey(const Key('periodo-hoy')));
      await tester.pumpAndSettle();

      expect(api.rutas.where((r) => r == '/reports/productivity').length, greaterThan(antes));
    });
  });

  group('Pestaña de margen de refacciones', () {
    testWidgets('muestra ventas, costo y margen y marca las líneas sin costo registrado', (tester) async {
      await _grande(tester);
      final api = _ApiFalsa();
      await tester.pumpWidget(_pantalla(api));
      await tester.pumpAndSettle();

      await tester.tap(find.text('Margen de refacciones'));
      await tester.pumpAndSettle();

      expect(api.rutas, contains('/reports/parts-margin'));
      expect(find.byKey(const Key('total-margen')), findsOneWidget);
      expect(find.text('\$540.00'), findsWidgets);
      expect(find.text('Ventas: \$1620.00 · Costo: \$360.00'), findsOneWidget);
      expect(find.text('Filtro de aceite'), findsOneWidget);
      expect(find.textContaining('Sin costo registrado: 4 u. · \$720.00'), findsOneWidget);
      expect(find.byKey(const Key('nota-sin-costo')), findsOneWidget);
      expect(find.textContaining('4 unidades sin costo registrado'), findsOneWidget);
    });

    testWidgets('sin líneas sin costo no muestra la nota', (tester) async {
      await _grande(tester);
      await tester.pumpWidget(_pantalla(_ApiFalsa(sinCosto: 0)));
      await tester.pumpAndSettle();

      await tester.tap(find.text('Margen de refacciones'));
      await tester.pumpAndSettle();

      expect(find.byKey(const Key('nota-sin-costo')), findsNothing);
    });

    testWidgets('sin datos muestra el estado vacío', (tester) async {
      await _grande(tester);
      await tester.pumpWidget(_pantalla(_ApiFalsa(vacio: true)));
      await tester.pumpAndSettle();

      await tester.tap(find.text('Margen de refacciones'));
      await tester.pumpAndSettle();

      expect(find.text('No hay refacciones vendidas en órdenes terminadas en este periodo.'), findsOneWidget);
    });
  });

  group('Pestaña de rotación', () {
    testWidgets('muestra la rotación y «Sin existencia» cuando no hay promedio', (tester) async {
      await _grande(tester);
      final api = _ApiFalsa();
      await tester.pumpWidget(_pantalla(api));
      await tester.pumpAndSettle();

      await tester.tap(find.text('Rotación'));
      await tester.pumpAndSettle();

      expect(api.rutas, contains('/reports/inventory-rotation'));
      expect(find.byKey(const Key('total-salidas')), findsOneWidget);
      expect(find.text('0.71'), findsOneWidget);
      expect(find.text('8.50'), findsOneWidget);
      expect(find.text('Sin existencia'), findsOneWidget);
    });

    testWidgets('si falla muestra el error y sin datos el vacío', (tester) async {
      await _grande(tester);
      await tester.pumpWidget(_pantalla(_ApiFalsa(falla: true)));
      await tester.pumpAndSettle();

      await tester.tap(find.text('Rotación'));
      await tester.pumpAndSettle();

      expect(find.text('No se pudo calcular el reporte.'), findsWidgets);
    });

    testWidgets('sin movimientos muestra el estado vacío', (tester) async {
      await _grande(tester);
      await tester.pumpWidget(_pantalla(_ApiFalsa(vacio: true)));
      await tester.pumpAndSettle();

      await tester.tap(find.text('Rotación'));
      await tester.pumpAndSettle();

      expect(find.text('No hay existencias ni movimientos de inventario en este periodo.'), findsOneWidget);
    });
  });

  group('Modelos', () {
    test('FilaIngreso formatea fecha y método en español', () {
      final fila = FilaIngreso.fromJson(
        {'date': '2026-11-03', 'method': 'MERCADO_PAGO', 'count': 2, 'total': '10.00'},
      );

      expect(fila.fechaLegible, '03/11/2026');
      expect(fila.etiquetaMetodo, 'Mercado Pago');
    });

    test('ReportResult conserva claves propias de un reporte en extras', () {
      final resultado = ReportResult.fromJson({
        'from': '2026-11-01',
        'to': '2026-11-30',
        'rows': [],
        'totals': {'ordersFinished': 0},
        'approximateDates': 2,
      });

      expect(resultado.extras['approximateDates'], 2);
      expect(resultado.vacio, isTrue);
      expect(resultado.truncated, isFalse);
    });
  });

  group('Sección Reportes en el menú (CA-10)', () {
    Widget shell(String rol) {
      final api = _ApiFalsa();
      final sesion = SessionProvider(api)
        ..usuario = User(
          id: 1,
          username: 'u',
          name: 'Usuario',
          email: 'u@motorix.local',
          role: rol,
        );
      return MultiProvider(
        providers: [
          ChangeNotifierProvider<SessionProvider>.value(value: sesion),
          ChangeNotifierProvider<UiProvider>(create: (_) => UiProvider()),
          ChangeNotifierProvider<NotificationsProvider>(
            create: (_) => NotificationsProvider(api),
          ),
        ],
        child: MaterialApp(theme: ThemeData(useMaterial3: true), home: const AppShell()),
      );
    }

    testWidgets('el administrador ve «Reportes»', (tester) async {
      await _grande(tester);
      await tester.pumpWidget(shell('ADMIN'));
      await tester.pumpAndSettle();

      expect(find.text('Reportes'), findsWidgets);
    });

    testWidgets('recepción y mecánico no la ven', (tester) async {
      await _grande(tester);
      for (final rol in ['RECEPTIONIST', 'MECHANIC']) {
        await tester.pumpWidget(shell(rol));
        await tester.pumpAndSettle();
        expect(find.text('Reportes'), findsNothing, reason: 'rol $rol');
      }
    });
  });
}
