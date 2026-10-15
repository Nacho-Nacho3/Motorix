import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:provider/provider.dart';

import 'package:motorix_client/models/service_order.dart';
import 'package:motorix_client/models/user.dart';
import 'package:motorix_client/providers/parts_provider.dart';
import 'package:motorix_client/providers/payments_provider.dart';
import 'package:motorix_client/providers/service_orders_provider.dart';
import 'package:motorix_client/providers/session_provider.dart';
import 'package:motorix_client/screens/orders/order_detail_screen.dart';
import 'package:motorix_client/services/api_client.dart';

/// ApiClient falso del detalle con la sección «Refacciones»:
/// catálogo, usos de la orden y alta con fallo configurable.
class _ApiRefaccionesOrdenFalsa extends ApiClient {
  _ApiRefaccionesOrdenFalsa({this.errorAlAgregar, this.espera});

  /// Si está presente, el alta falla con este error (STOCK_INSUFFICIENT…).
  ApiError? errorAlAgregar;

  /// Si está presente, el alta espera antes de responder (botón bloqueado).
  Completer<void>? espera;

  final List<Map<String, dynamic>> usos = [
    {
      'id': 7,
      'orderId': 1,
      'partId': 1,
      'partCode': 'BAL-001',
      'name': 'Balatas traseras',
      'quantity': 2,
      'createdBy': 3,
      'createdAt': '2026-10-14T11:00:00',
    },
  ];

  static const List<Map<String, dynamic>> catalogo = [
    {
      'id': 1,
      'partCode': 'BAL-001',
      'name': 'Balatas traseras',
      'category': 'Frenos',
      'brand': 'Bosch',
      'stockCurrent': 10,
      'stockMin': 5,
      'purchasePrice': '420.00',
      'salePrice': '850.00',
      'lowStock': false,
      'updatedAt': '2026-10-14T10:00:00',
    },
    {
      'id': 2,
      'partCode': 'FIL-002',
      'name': 'Filtro de aceite',
      'category': 'Filtros',
      'brand': null,
      'stockCurrent': 20,
      'stockMin': 5,
      'purchasePrice': '90.00',
      'salePrice': '180.00',
      'lowStock': false,
      'updatedAt': '2026-10-14T10:00:00',
    },
  ];

  @override
  Future<dynamic> get(String path, {Map<String, String>? query}) async {
    if (path.startsWith('/service-orders/mechanics')) {
      return {'mechanics': <Map<String, dynamic>>[]};
    }
    if (path == '/service-orders/1/parts') {
      return {'parts': usos, 'total': usos.length};
    }
    if (path.startsWith('/parts')) {
      return {'parts': catalogo, 'total': catalogo.length, 'lowStockCount': 0};
    }
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
      'services': <Map<String, dynamic>>[],
      'labor': <Map<String, dynamic>>[],
    };
  }

  @override
  Future<dynamic> post(String path, Object cuerpo) async {
    if (path == '/service-orders/1/parts') {
      if (espera != null) await espera!.future;
      if (errorAlAgregar != null) throw errorAlAgregar!;
      final datos = cuerpo as Map<String, dynamic>;
      final parte = catalogo.firstWhere((p) => p['id'] == datos['partId']);
      final uso = <String, dynamic>{
        'id': usos.length + 10,
        'orderId': 1,
        'partId': datos['partId'],
        'partCode': parte['partCode'],
        'name': parte['name'],
        'quantity': datos['quantity'],
        'createdBy': 3,
        'createdAt': '2026-10-14T12:00:00',
      };
      usos.add(uso);
      return {'orderPart': uso};
    }
    throw ApiError(
      status: 404,
      code: 'SERVICE_ORDER_NOT_FOUND',
      message: 'La orden de servicio solicitada no existe.',
    );
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

Widget _pantalla(_ApiRefaccionesOrdenFalsa api) {
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
      ChangeNotifierProvider<PartsProvider>(
        create: (_) => PartsProvider(api),
      ),
      ChangeNotifierProvider<PaymentsProvider>(
        create: (_) => PaymentsProvider(api),
      ),
    ],
    child: MaterialApp(
      theme: ThemeData(useMaterial3: true),
      home: const OrderDetailScreen(orden: _orden),
    ),
  );
}

Future<void> _elegirRefaccion(WidgetTester tester, String etiqueta) async {
  // El detalle es largo: primero se lleva el campo a la vista.
  final campo = find.byType(DropdownButtonFormField<int>);
  await tester.ensureVisible(campo);
  await tester.pumpAndSettle();
  await tester.tap(campo);
  await tester.pumpAndSettle();
  await tester.tap(find.text(etiqueta).last);
  await tester.pumpAndSettle();
}

/// Escribe la cantidad en el campo de la sección «Refacciones».
Future<void> _escribirCantidad(WidgetTester tester, String texto) async {
  final cantidad = find.byType(TextFormField).last;
  await tester.ensureVisible(cantidad);
  await tester.pumpAndSettle();
  await tester.enterText(cantidad, texto);
}

Finder get _botonAgregar => find.widgetWithText(ElevatedButton, 'Agregar');

void main() {
  testWidgets('la sección «Refacciones» lista las piezas con su cantidad', (tester) async {
    await tester.pumpWidget(_pantalla(_ApiRefaccionesOrdenFalsa()));
    await tester.pumpAndSettle();

    expect(find.text('Refacciones'), findsOneWidget);
    expect(
      find.text('BAL-001 · Balatas traseras · 2 uds'),
      findsOneWidget,
      reason: 'la fila muestra código, nombre y cantidad',
    );
  });

  testWidgets('agregar una refacción actualiza la lista', (tester) async {
    await tester.pumpWidget(_pantalla(_ApiRefaccionesOrdenFalsa()));
    await tester.pumpAndSettle();

    await _elegirRefaccion(tester, 'FIL-002 · Filtro de aceite');
    await _escribirCantidad(tester, '1');
    await tester.ensureVisible(_botonAgregar);
    await tester.pumpAndSettle();
    await tester.tap(_botonAgregar);
    await tester.pumpAndSettle();

    expect(
      find.text('FIL-002 · Filtro de aceite · 1 uds'),
      findsOneWidget,
      reason: 'el uso nuevo aparece en la sección',
    );
    expect(find.text('Refacción agregada a la orden.'), findsOneWidget);
    expect(_botonAgregar, findsOneWidget);
  });

  testWidgets('STOCK_INSUFFICIENT muestra el mensaje en español', (tester) async {
    await tester.pumpWidget(
      _pantalla(
        _ApiRefaccionesOrdenFalsa(
          errorAlAgregar: ApiError(
            status: 400,
            code: 'STOCK_INSUFFICIENT',
            message:
                'No hay existencias suficientes; el stock nunca puede quedar por debajo de cero.',
          ),
        ),
      ),
    );
    await tester.pumpAndSettle();

    await _elegirRefaccion(tester, 'BAL-001 · Balatas traseras');
    await _escribirCantidad(tester, '5');
    await tester.ensureVisible(_botonAgregar);
    await tester.pumpAndSettle();
    await tester.tap(_botonAgregar);
    await tester.pumpAndSettle();

    expect(
      find.text(
        'No hay existencias suficientes; el stock nunca puede quedar por debajo de cero.',
      ),
      findsOneWidget,
    );
    expect(find.text('FIL-002 · Filtro de aceite · 1 uds'), findsNothing);
    expect(
      find.text('BAL-001 · Balatas traseras · 2 uds'),
      findsOneWidget,
      reason: 'la lista no cambia cuando el backend rechaza',
    );
  });

  testWidgets('ORDER_DELIVERED muestra el mensaje en español', (tester) async {
    await tester.pumpWidget(
      _pantalla(
        _ApiRefaccionesOrdenFalsa(
          errorAlAgregar: ApiError(
            status: 400,
            code: 'ORDER_DELIVERED',
            message:
                'La orden ya fue entregada; solo el administrador puede corregirla.',
          ),
        ),
      ),
    );
    await tester.pumpAndSettle();

    await _elegirRefaccion(tester, 'BAL-001 · Balatas traseras');
    await _escribirCantidad(tester, '1');
    await tester.ensureVisible(_botonAgregar);
    await tester.pumpAndSettle();
    await tester.tap(_botonAgregar);
    await tester.pumpAndSettle();

    expect(
      find.text('La orden ya fue entregada; solo el administrador puede corregirla.'),
      findsOneWidget,
    );
  });

  testWidgets('el botón queda deshabilitado mientras guarda', (tester) async {
    final espera = Completer<void>();
    final api = _ApiRefaccionesOrdenFalsa(espera: espera);
    await tester.pumpWidget(_pantalla(api));
    await tester.pumpAndSettle();

    await _elegirRefaccion(tester, 'FIL-002 · Filtro de aceite');
    await _escribirCantidad(tester, '1');
    await tester.ensureVisible(_botonAgregar);
    await tester.pumpAndSettle();

    await tester.tap(_botonAgregar);
    await tester.pump();
    await tester.pump();

    // Mientras guarda, el botón muestra «Guardando…» y no responde.
    final botonEnVuelo = find.widgetWithText(ElevatedButton, 'Guardando…');
    expect(
      tester.widget<ElevatedButton>(botonEnVuelo).onPressed,
      isNull,
      reason: 'mientras la petición está en vuelo el botón no responde',
    );

    espera.complete();
    await tester.pumpAndSettle();

    expect(
      tester.widget<ElevatedButton>(_botonAgregar).onPressed,
      isNotNull,
      reason: 'al terminar vuelve a habilitarse',
    );
  });
}
