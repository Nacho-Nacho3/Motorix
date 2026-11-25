import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:provider/provider.dart';

import 'package:motorix_client/models/audit_entry.dart';
import 'package:motorix_client/providers/audit_provider.dart';
import 'package:motorix_client/screens/audit/audit_log_screen.dart';
import 'package:motorix_client/services/api_client.dart';
import 'package:motorix_client/widgets/states_view.dart';

// T083 (Sprint 7, US10, CA-20): pantalla Bitácora de solo lectura con filtros
// de fecha, usuario y acción, paginación y estados de carga, vacío y error.

Map<String, dynamic> _registro(int id, String accion, {String? detalle}) => {
      'id': id,
      'createdAt': '2026-11-24T10:12:00',
      'userId': 1,
      'actor': 'admin',
      'action': accion,
      'entityType': 'PART',
      'entityId': 3,
      'detail': detalle,
    };

class _ApiFalsa extends ApiClient {
  _ApiFalsa({this.registros = const [], this.total, this.falla = false});

  final List<Map<String, dynamic>> registros;
  final int? total;
  final bool falla;
  final List<Map<String, String>> consultas = [];

  @override
  Future<dynamic> get(String path, {Map<String, String>? query}) async {
    if (path == '/audit-log') {
      consultas.add(Map<String, String>.from(query ?? {}));
      if (falla) {
        throw ApiError(
          status: 500,
          code: 'INTERNAL_ERROR',
          message: 'No se pudo consultar la bitácora.',
        );
      }
      return {
        'page': int.parse(query?['page'] ?? '1'),
        'pageSize': 20,
        'total': total ?? registros.length,
        'items': registros,
      };
    }
    return <String, dynamic>{};
  }
}

Widget _pantalla(_ApiFalsa api) => MultiProvider(
      providers: [
        ChangeNotifierProvider<AuditProvider>(create: (_) => AuditProvider(api)),
      ],
      child: MaterialApp(
        theme: ThemeData(useMaterial3: true),
        home: const AuditLogScreen(),
      ),
    );

Future<void> _grande(WidgetTester tester) async {
  tester.view.devicePixelRatio = 1;
  tester.view.physicalSize = const Size(1400, 1200);
  addTearDown(tester.view.resetPhysicalSize);
  addTearDown(tester.view.resetDevicePixelRatio);
}

void main() {
  test('el modelo etiqueta acciones y entidades en español', () {
    final entrada = AuditEntry.fromJson(
      _registro(7, 'PART_PRICE_CHANGED', detalle: 'campo: Precio de venta'),
    );

    expect(entrada.etiquetaAccion, 'Precio de refacción cambiado');
    expect(entrada.etiquetaEntidad, 'Refacción #3');
    expect(entrada.fechaLegible, '24/11/2026 10:12');
    expect(AuditEntry.etiquetasDeAccion, hasLength(9));
  });

  testWidgets('muestra fecha, usuario, acción, entidad y detalle', (tester) async {
    await _grande(tester);
    final api = _ApiFalsa(registros: [
      _registro(2, 'PART_PRICE_CHANGED', detalle: 'campo: Precio de venta; anterior: 150.00; nuevo: 180.00'),
      _registro(1, 'LOGIN_FAILED'),
    ]);
    await tester.pumpWidget(_pantalla(api));
    expect(find.byType(LoadingView), findsOneWidget);
    await tester.pumpAndSettle();

    expect(find.text('Precio de refacción cambiado'), findsOneWidget);
    expect(find.text('Inicio de sesión fallido'), findsOneWidget);
    expect(find.textContaining('24/11/2026 10:12 · admin · Refacción #3'), findsNWidgets(2));
    expect(find.textContaining('anterior: 150.00; nuevo: 180.00'), findsOneWidget);
    expect(find.byKey(const Key('total-registros')), findsOneWidget);
    expect(find.text('2 registros'), findsOneWidget);
  });

  testWidgets('no ofrece acciones de edición ni de borrado', (tester) async {
    await _grande(tester);
    await tester.pumpWidget(_pantalla(_ApiFalsa(registros: [_registro(1, 'LOGIN_FAILED')])));
    await tester.pumpAndSettle();

    expect(find.byIcon(Icons.delete_outline), findsNothing);
    expect(find.byIcon(Icons.edit_outlined), findsNothing);
    expect(find.byIcon(Icons.add), findsNothing);
    expect(find.text('Editar'), findsNothing);
    expect(find.text('Eliminar'), findsNothing);
  });

  testWidgets('sin registros muestra el estado vacío', (tester) async {
    await _grande(tester);
    await tester.pumpWidget(_pantalla(_ApiFalsa()));
    await tester.pumpAndSettle();

    expect(find.byType(EmptyView), findsOneWidget);
    expect(find.text('No hay registros con estos filtros.'), findsOneWidget);
  });

  testWidgets('si falla la carga muestra el error con reintento', (tester) async {
    await _grande(tester);
    await tester.pumpWidget(_pantalla(_ApiFalsa(falla: true)));
    await tester.pumpAndSettle();

    expect(find.byType(ErrorView), findsOneWidget);
    expect(find.text('No se pudo consultar la bitácora.'), findsOneWidget);
    expect(find.text('Reintentar'), findsOneWidget);
  });

  testWidgets('filtra por usuario y acción y vuelve a la primera página', (tester) async {
    await _grande(tester);
    final api = _ApiFalsa(registros: [_registro(1, 'LOGIN_FAILED')]);
    await tester.pumpWidget(_pantalla(api));
    await tester.pumpAndSettle();

    await tester.enterText(find.byKey(const Key('filtro-usuario')), '5');
    await tester.tap(find.byKey(const Key('filtro-accion')));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Usuario creado').last);
    await tester.pumpAndSettle();
    await tester.tap(find.byKey(const Key('boton-filtrar')));
    await tester.pumpAndSettle();

    final ultima = api.consultas.last;
    expect(ultima['userId'], '5');
    expect(ultima['action'], 'USER_CREATED');
    expect(ultima['page'], '1');
  });

  testWidgets('«Limpiar» quita los filtros', (tester) async {
    await _grande(tester);
    final api = _ApiFalsa(registros: [_registro(1, 'LOGIN_FAILED')]);
    await tester.pumpWidget(_pantalla(api));
    await tester.pumpAndSettle();
    await tester.enterText(find.byKey(const Key('filtro-usuario')), '5');
    await tester.tap(find.byKey(const Key('boton-filtrar')));
    await tester.pumpAndSettle();
    expect(api.consultas.last.containsKey('userId'), isTrue);

    await tester.tap(find.byKey(const Key('boton-limpiar')));
    await tester.pumpAndSettle();

    expect(api.consultas.last.containsKey('userId'), isFalse);
    expect(api.consultas.last.containsKey('action'), isFalse);
  });

  test('una fecha final anterior a la inicial se rechaza sin consultar', () async {
    final api = _ApiFalsa();
    final proveedor = AuditProvider(api);

    await proveedor.filtrar(desde: '2026-11-10', hasta: '2026-11-01');

    expect(proveedor.errorFiltros, 'La fecha final no puede ser anterior a la inicial.');
    expect(api.consultas, isEmpty);
  });

  test('las fechas válidas viajan como from y to', () async {
    final api = _ApiFalsa();
    final proveedor = AuditProvider(api);

    await proveedor.filtrar(desde: '2026-11-01', hasta: '2026-11-30');

    expect(api.consultas.last['from'], '2026-11-01');
    expect(api.consultas.last['to'], '2026-11-30');
    expect(proveedor.errorFiltros, isNull);
  });

  testWidgets('pagina con anterior y siguiente', (tester) async {
    await _grande(tester);
    final api = _ApiFalsa(registros: [_registro(1, 'LOGIN_FAILED')], total: 45);
    await tester.pumpWidget(_pantalla(api));
    await tester.pumpAndSettle();
    expect(find.text('1 de 3'), findsOneWidget);
    expect(
      tester.widget<IconButton>(find.byKey(const Key('bitacora-anterior'))).onPressed,
      isNull,
    );

    await tester.tap(find.byKey(const Key('bitacora-siguiente')));
    await tester.pumpAndSettle();

    expect(api.consultas.last['page'], '2');
    expect(find.text('2 de 3'), findsOneWidget);
  });
}
