import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:provider/provider.dart';

import 'package:motorix_client/models/order_item.dart';
import 'package:motorix_client/models/service_order.dart';
import 'package:motorix_client/models/user.dart';
import 'package:motorix_client/providers/parts_provider.dart';
import 'package:motorix_client/providers/payments_provider.dart';
import 'package:motorix_client/providers/service_orders_provider.dart';
import 'package:motorix_client/providers/service_types_provider.dart';
import 'package:motorix_client/providers/session_provider.dart';
import 'package:motorix_client/screens/orders/order_detail_screen.dart';
import 'package:motorix_client/services/api_client.dart';

// T045 (Sprint 7, US3, D-04): el formulario de servicio de la orden ofrece
// solo tipos activos del lookup y envía `serviceTypeId`; sin elegir tipo sigue
// funcionando; la lista muestra el nombre del tipo cuando existe.

class _ApiFalsa extends ApiClient {
  _ApiFalsa({this.lookupFalla = false});

  final bool lookupFalla;
  final List<Map<String, dynamic>> altas = [];
  final List<Map<String, dynamic>> servicios = [
    {
      'id': 10,
      'orderId': 1,
      'description': 'Cambio de pastillas delanteras',
      'unitPrice': 450,
      'createdAt': '2026-10-14T11:00:00',
      'serviceTypeId': 2,
      'serviceTypeName': 'Revisión de frenos',
    },
    {
      'id': 11,
      'orderId': 1,
      'description': 'Lavado de motor',
      'unitPrice': 100,
      'createdAt': '2026-10-14T11:10:00',
      'serviceTypeId': null,
      'serviceTypeName': null,
    },
  ];

  @override
  Future<dynamic> get(String path, {Map<String, String>? query}) async {
    if (path == '/service-types/lookup') {
      if (lookupFalla) {
        throw ApiError(status: 500, code: 'INTERNAL_ERROR', message: 'Falla.');
      }
      return [
        {'id': 1, 'name': 'Cambio de aceite', 'intervalDays': 180, 'intervalKm': 5000},
        {'id': 2, 'name': 'Revisión de frenos', 'intervalDays': 180, 'intervalKm': null},
      ];
    }
    if (path.startsWith('/service-orders/mechanics')) {
      return {'mechanics': <Map<String, dynamic>>[]};
    }
    if (path.endsWith('/parts')) return {'total': 0, 'parts': <dynamic>[]};
    return {
      'order': {
        'id': 1,
        'clientId': 1,
        'clientName': 'Juan Pérez',
        'vehicleId': 1,
        'vehicleLabel': 'Toyota Corolla ABC1234',
        'mechanicId': 3,
        'mechanicName': 'Mecánico Uno',
        'status': 'DIAGNOSIS',
        'entryMileage': 86000,
        'reportedProblem': 'Ruido al frenar',
        'diagnosis': null,
        'observations': null,
        'recommendations': null,
        'mileageCorrectionReason': null,
        'createdAt': '2026-10-14T10:30:00',
        'updatedAt': '2026-10-14T10:30:00',
      },
      'services': List<Map<String, dynamic>>.from(servicios),
      'labor': <dynamic>[],
    };
  }

  @override
  Future<dynamic> post(String path, Object cuerpo) async {
    final datos = Map<String, dynamic>.from(cuerpo as Map);
    altas.add(datos);
    return {
      'service': {
        'id': 12,
        'orderId': 1,
        'description': datos['description'],
        'unitPrice': datos['unitPrice'] ?? 0,
        'createdAt': '2026-10-14T12:00:00',
        'serviceTypeId': datos['serviceTypeId'],
        'serviceTypeName': null,
      },
    };
  }
}

const _orden = ServiceOrder(
  id: 1,
  clientId: 1,
  clientName: 'Juan Pérez',
  vehicleId: 1,
  vehicleLabel: 'Toyota Corolla ABC1234',
  mechanicId: 3,
  mechanicName: 'Mecánico Uno',
  status: 'DIAGNOSIS',
  entryMileage: 86000,
  reportedProblem: 'Ruido al frenar',
);

Widget _pantalla(_ApiFalsa api) {
  final sesion = SessionProvider(api);
  sesion.usuario = const User(
    id: 3,
    username: 'mecanico-uno',
    name: 'Mecánico Uno',
    email: 'mecanico@motorix.local',
    role: 'MECHANIC',
  );
  return MultiProvider(
    providers: [
      ChangeNotifierProvider<SessionProvider>.value(value: sesion),
      ChangeNotifierProvider<ServiceOrdersProvider>(
        create: (_) => ServiceOrdersProvider(api),
      ),
      ChangeNotifierProvider<PartsProvider>(create: (_) => PartsProvider(api)),
      ChangeNotifierProvider<PaymentsProvider>(create: (_) => PaymentsProvider(api)),
      ChangeNotifierProvider<ServiceTypesProvider>(
        create: (_) => ServiceTypesProvider(api),
      ),
    ],
    child: MaterialApp(
      theme: ThemeData(useMaterial3: true),
      home: const OrderDetailScreen(orden: _orden),
    ),
  );
}

Future<void> _abrirFormulario(WidgetTester tester) async {
  tester.view.devicePixelRatio = 1;
  tester.view.physicalSize = const Size(1200, 3000);
  addTearDown(tester.view.resetPhysicalSize);
  addTearDown(tester.view.resetDevicePixelRatio);
  await tester.pumpAndSettle();
  await tester.tap(find.text('Agregar servicio'));
  await tester.pumpAndSettle();
}

void main() {
  test('el modelo lee serviceTypeId y serviceTypeName y tolera su ausencia', () {
    final conTipo = ServiceOrderItem.fromJson({
      'id': 1,
      'orderId': 1,
      'description': 'Aceite',
      'unitPrice': 10,
      'serviceTypeId': 4,
      'serviceTypeName': 'Cambio de aceite',
    });
    final anterior = ServiceOrderItem.fromJson({
      'id': 2,
      'orderId': 1,
      'description': 'Antigua',
      'unitPrice': 5,
    });

    expect(conTipo.serviceTypeId, 4);
    expect(conTipo.serviceTypeName, 'Cambio de aceite');
    expect(anterior.serviceTypeId, isNull);
    expect(anterior.serviceTypeName, isNull);
  });

  testWidgets('la lista muestra el nombre del tipo solo cuando existe', (tester) async {
    await tester.pumpWidget(_pantalla(_ApiFalsa()));
    await _abrirFormulario(tester);

    expect(find.text('Tipo: Revisión de frenos'), findsOneWidget);
    expect(find.textContaining('Tipo:'), findsOneWidget);
  });

  testWidgets('el selector ofrece los tipos activos y envía serviceTypeId', (tester) async {
    final api = _ApiFalsa();
    await tester.pumpWidget(_pantalla(api));
    await _abrirFormulario(tester);

    await tester.enterText(
      find.widgetWithText(TextFormField, 'Descripción del servicio *'),
      'Aceite sintético',
    );
    await tester.tap(find.byKey(const Key('selector-tipo-servicio')));
    await tester.pumpAndSettle();
    expect(find.text('Sin tipo'), findsWidgets);
    expect(find.text('Cambio de aceite'), findsOneWidget);
    await tester.tap(find.text('Cambio de aceite').last);
    await tester.pumpAndSettle();

    await tester.tap(find.text('Guardar servicio'));
    await tester.pumpAndSettle();
    await tester.pump(const Duration(seconds: 5));
    await tester.pumpAndSettle();

    expect(api.altas, hasLength(1));
    expect(api.altas.single['description'], 'Aceite sintético');
    expect(api.altas.single['serviceTypeId'], 1);
  });

  testWidgets('sin elegir tipo el servicio se registra sin serviceTypeId', (tester) async {
    final api = _ApiFalsa();
    await tester.pumpWidget(_pantalla(api));
    await _abrirFormulario(tester);

    await tester.enterText(
      find.widgetWithText(TextFormField, 'Descripción del servicio *'),
      'Revisión general',
    );
    await tester.tap(find.text('Guardar servicio'));
    await tester.pumpAndSettle();
    await tester.pump(const Duration(seconds: 5));
    await tester.pumpAndSettle();

    expect(api.altas, hasLength(1));
    expect(api.altas.single.containsKey('serviceTypeId'), isFalse);
  });

  testWidgets('si el catálogo no responde el formulario sigue funcionando sin selector',
      (tester) async {
    final api = _ApiFalsa(lookupFalla: true);
    await tester.pumpWidget(_pantalla(api));
    await _abrirFormulario(tester);

    expect(find.byKey(const Key('selector-tipo-servicio')), findsNothing);
    await tester.enterText(
      find.widgetWithText(TextFormField, 'Descripción del servicio *'),
      'Servicio sin catálogo',
    );
    await tester.tap(find.text('Guardar servicio'));
    await tester.pumpAndSettle();
    await tester.pump(const Duration(seconds: 5));
    await tester.pumpAndSettle();

    expect(api.altas, hasLength(1));
  });
}
