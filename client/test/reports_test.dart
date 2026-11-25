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
  _ApiFalsa({this.vacio = false, this.falla = false});

  final bool vacio;
  final bool falla;
  final List<Map<String, String>> consultas = [];

  @override
  Future<dynamic> get(String path, {Map<String, String>? query}) async {
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
