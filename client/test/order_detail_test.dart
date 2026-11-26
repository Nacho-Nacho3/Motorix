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

/// ApiClient falso del detalle: diagnóstico guardado, un servicio, una fila
/// de mano de obra y una línea de refacción; el DELETE del servicio quita la
/// fila y el PATCH de precio corrige la línea (US4).
class _ApiDetalleFalsa extends ApiClient {
  bool servicioBorrado = false;
  int borradosDeServicio = 0;

  /// Precio de la línea devuelto por GET /parts; `null` simula la
  /// proyección del mecánico (no recibe precios, D-10).
  String? precioLinea = '850.00';

  /// Conteo de correcciones recibidas y precio enviado (US4, T037).
  int correcciones = 0;
  String? precioCorregido;

  /// Si es `true`, la orden tiene un cobro en efectivo.
  bool conPago = false;

  /// Consultas al lookup del selector (US5, T043).
  int lookups = 0;

  @override
  Future<dynamic> get(String path, {Map<String, String>? query}) async {
    if (path.startsWith('/service-orders/mechanics')) {
      return {'mechanics': <Map<String, dynamic>>[]};
    }
    if (path == '/parts/lookup') {
      lookups += 1;
      // Sin precios: el lookup nunca los trae (FR-010, D-10).
      return {
        'parts': [
          {
            'id': 4,
            'partCode': 'BAL-001',
            'name': 'Balatas traseras',
            'category': 'Frenos',
            'brand': 'Bosch',
            'stockCurrent': 12,
            'stockMin': 3,
          },
        ],
      };
    }
    if (path == '/service-orders/1/parts') {
      return {
        'total': 1,
        'parts': [
          {
            'id': 31,
            'orderId': 1,
            'partId': 4,
            'partCode': 'BAL-001',
            'name': 'Balatas traseras',
            'quantity': 2,
            if (precioLinea != null) 'unitPrice': precioLinea,
            'createdBy': 3,
            'createdAt': '2026-11-03T10:00:00',
          },
        ],
      };
    }
    if (conPago && path == '/service-orders/1/payments') {
      return {
        'total': 1,
        'payments': [
          {
            'id': 7,
            'orderId': 1,
            'amount': '2005.00',
            'method': 'CASH',
            'status': 'PAID',
            'createdAt': '2026-11-26T14:05:20',
          },
        ],
      };
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
        'diagnosis': 'Pastillas desgastadas',
        'observations': null,
        'recommendations': null,
        'mileageCorrectionReason': null,
        'createdAt': '2026-10-14T10:30:00',
        'updatedAt': '2026-10-14T10:30:00',
      },
      'services': [
        if (!servicioBorrado)
          {
            'id': 10,
            'orderId': 1,
            'description': 'Cambio de pastillas delanteras',
            'unitPrice': 450,
            'createdAt': '2026-10-14T11:00:00',
          },
      ],
      'labor': [
        {
          'id': 20,
          'orderId': 1,
          'concept': 'Cambiar pastillas delanteras',
          'hours': 1.5,
          'hourlyRate': 350,
          'createdAt': '2026-10-14T11:05:00',
        },
      ],
    };
  }

  @override
  Future<dynamic> patch(String path, Object cuerpo) async {
    if (path == '/service-orders/1/parts/31/price') {
      final datos = cuerpo as Map<String, dynamic>;
      final motivo = (datos['reason'] as String?) ?? '';
      if (motivo.length < 10) {
        // Mismo patrón que el backend: mensaje principal genérico.
        throw ApiError(
          status: 400,
          code: 'VALIDATION_ERROR',
          message: 'Datos inválidos en el cuerpo de la petición.',
        );
      }
      correcciones += 1;
      precioCorregido = datos['unitPrice'] as String?;
      precioLinea = precioCorregido;
      return {
        'ok': true,
        'data': {
          'orderPart': {'id': 31},
        },
      };
    }
    throw ApiError(
      status: 404,
      code: 'UNKNOWN',
      message: 'Ruta desconocida.',
    );
  }

  @override
  Future<dynamic> delete(String path) async {
    if (path == '/service-orders/1/services/10') {
      servicioBorrado = true;
      borradosDeServicio += 1;
      return {'deleted': true};
    }
    throw ApiError(
      status: 404,
      code: 'ORDER_ITEM_NOT_FOUND',
      message: 'El registro indicado no existe o no pertenece a la orden.',
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

Widget _pantalla(_ApiDetalleFalsa api, {String rol = 'MECHANIC'}) {
  final sesion = SessionProvider(api);
  sesion.usuario = rol == 'ADMIN'
      ? const User(
          id: 1,
          username: 'admin',
          name: 'Administrador',
          email: 'admin@motorix.local',
          role: 'ADMIN',
        )
      : const User(
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

void main() {
  testWidgets(
      'el detalle muestra el diagnóstico guardado, los servicios y la mano de obra',
      (tester) async {
    await tester.pumpWidget(_pantalla(_ApiDetalleFalsa()));
    await tester.pumpAndSettle();

    expect(find.text('Pastillas desgastadas'), findsWidgets);
    expect(find.text('Servicios realizados'), findsOneWidget);
    expect(
      find.text('Cambio de pastillas delanteras · \$450.00'),
      findsOneWidget,
    );
    expect(find.text('Mano de obra'), findsOneWidget);
    expect(
      find.text('Cambiar pastillas delanteras · 1.5 h · \$350.00/h'),
      findsOneWidget,
    );
  });

  testWidgets('la fecha del pago se muestra legible (H-05)', (tester) async {
    final api = _ApiDetalleFalsa()..conPago = true;
    await tester.pumpWidget(_pantalla(api, rol: 'ADMIN'));
    await tester.pumpAndSettle();

    expect(find.text('26/11/2026 14:05'), findsOneWidget);
    expect(find.text('2026-11-26T14:05:20'), findsNothing);
  });

  testWidgets('el botón de eliminar servicio pide confirmación con «Confirmar»',
      (tester) async {
    final api = _ApiDetalleFalsa();
    await tester.pumpWidget(_pantalla(api));
    await tester.pumpAndSettle();

    final botonEliminar = find.byTooltip('Eliminar servicio');
    await tester.ensureVisible(botonEliminar);
    await tester.pumpAndSettle();
    await tester.tap(botonEliminar);
    await tester.pumpAndSettle();

    expect(find.text('Eliminar servicio'), findsOneWidget);
    expect(
      find.text(
        '¿Eliminar el servicio "Cambio de pastillas delanteras" de la orden?',
      ),
      findsOneWidget,
    );

    await tester.tap(find.widgetWithText(FilledButton, 'Confirmar'));
    await tester.pumpAndSettle();
    // Deja pasar el temporizador de la barra de aviso.
    await tester.pump(const Duration(seconds: 5));
    await tester.pumpAndSettle();

    expect(api.borradosDeServicio, 1);
    expect(
      find.text('Cambio de pastillas delanteras · \$450.00'),
      findsNothing,
      reason: 'el servicio eliminado ya no debe aparecer',
    );
    expect(find.text('Sin servicios registrados.'), findsOneWidget);
  });

  testWidgets('el admin ve el precio de la línea y la acción «Corregir» (US4, D-05)',
      (tester) async {
    await tester.pumpWidget(_pantalla(_ApiDetalleFalsa(), rol: 'ADMIN'));
    await tester.pumpAndSettle();

    expect(
      find.text('\$850.00'),
      findsOneWidget,
      reason: 'el precio de la línea se muestra a quien lo recibe',
    );
    expect(
      find.widgetWithText(TextButton, 'Corregir'),
      findsOneWidget,
      reason: 'solo ADMIN tiene la acción de corrección',
    );
  });

  testWidgets('el mecánico no ve precios ni la acción de corrección (D-10)',
      (tester) async {
    final api = _ApiDetalleFalsa()..precioLinea = null;
    await tester.pumpWidget(_pantalla(api));
    await tester.pumpAndSettle();

    expect(find.text('\$850.00'), findsNothing);
    expect(find.widgetWithText(TextButton, 'Corregir'), findsNothing);
    expect(
      find.text('BAL-001 · Balatas traseras · 2 uds'),
      findsOneWidget,
      reason: 'la fila sigue visible sin precios',
    );
  });

  testWidgets('el motivo corto no se envía y el diálogo sigue abierto (US4)',
      (tester) async {
    final api = _ApiDetalleFalsa();
    await tester.pumpWidget(_pantalla(api, rol: 'ADMIN'));
    await tester.pumpAndSettle();

    final botonCorregir = find.widgetWithText(TextButton, 'Corregir');
    await tester.ensureVisible(botonCorregir);
    await tester.pumpAndSettle();
    await tester.tap(botonCorregir);
    await tester.pumpAndSettle();
    expect(find.text('Corregir precio'), findsOneWidget);

    final motivo = find.ancestor(
      of: find.text('Motivo (mínimo 10 caracteres)'),
      matching: find.byType(TextFormField),
    );
    await tester.enterText(motivo, 'corto');
    await tester.tap(find.widgetWithText(FilledButton, 'Guardar'));
    await tester.pumpAndSettle();

    expect(
      find.text('El motivo debe tener al menos 10 caracteres.'),
      findsOneWidget,
      reason: 'el motivo obligatorio se valida en pantalla',
    );
    expect(
      find.text('Corregir precio'),
      findsOneWidget,
      reason: 'el diálogo sigue abierto',
    );
    expect(api.correcciones, 0, reason: 'no se llamó al backend');
  });

  testWidgets('la corrección exitosa cierra el diálogo y actualiza el precio (US4)',
      (tester) async {
    final api = _ApiDetalleFalsa();
    await tester.pumpWidget(_pantalla(api, rol: 'ADMIN'));
    await tester.pumpAndSettle();

    final botonCorregir = find.widgetWithText(TextButton, 'Corregir');
    await tester.ensureVisible(botonCorregir);
    await tester.pumpAndSettle();
    await tester.tap(botonCorregir);
    await tester.pumpAndSettle();

    final precio = find.ancestor(
      of: find.text('Precio unitario'),
      matching: find.byType(TextFormField),
    );
    final motivo = find.ancestor(
      of: find.text('Motivo (mínimo 10 caracteres)'),
      matching: find.byType(TextFormField),
    );
    await tester.enterText(precio, '950.00');
    await tester.enterText(motivo, 'Precio capturado de otra pieza');
    await tester.tap(find.widgetWithText(FilledButton, 'Guardar'));
    await tester.pumpAndSettle();

    expect(api.correcciones, 1, reason: 'el PATCH se envió una sola vez');
    expect(api.precioCorregido, '950.00');
    expect(
      find.text('Corregir precio'),
      findsNothing,
      reason: 'el diálogo se cerró al confirmar',
    );
    expect(find.text('Precio de la línea corregido.'), findsOneWidget);
    expect(
      find.text('\$950.00'),
      findsOneWidget,
      reason: 'la lista muestra el precio corregido',
    );

    // Deja pasar el temporizador de la barra de aviso.
    await tester.pump(const Duration(seconds: 5));
    await tester.pumpAndSettle();
  });

  testWidgets('el selector del mecánico carga el lookup y no muestra precios (US5, H-10)',
      (tester) async {
    final api = _ApiDetalleFalsa()..precioLinea = null;
    await tester.pumpWidget(_pantalla(api));
    await tester.pumpAndSettle();

    expect(
      api.lookups,
      1,
      reason: 'el selector usa /parts/lookup, no el catálogo de ADMIN',
    );

    final selector = find.byType(DropdownButtonFormField<int>);
    await tester.ensureVisible(selector);
    await tester.pumpAndSettle();
    await tester.tap(selector);
    await tester.pumpAndSettle();

    expect(
      find.text('BAL-001 · Balatas traseras'),
      findsOneWidget,
      reason: 'las opciones llegan desde el lookup',
    );
    expect(
      find.text('\$850.00'),
      findsNothing,
      reason: 'ningún precio en pantalla (D-10, FR-010)',
    );

    // Cierra el menú desplegado.
    await tester.tapAt(const Offset(10, 10));
    await tester.pumpAndSettle();
  });
}
