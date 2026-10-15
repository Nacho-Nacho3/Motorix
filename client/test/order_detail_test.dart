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

/// ApiClient falso del detalle: diagnóstico guardado, un servicio y una fila
/// de mano de obra; el DELETE del servicio quita la fila.
class _ApiDetalleFalsa extends ApiClient {
  bool servicioBorrado = false;
  int borradosDeServicio = 0;

  @override
  Future<dynamic> get(String path, {Map<String, String>? query}) async {
    if (path.startsWith('/service-orders/mechanics')) {
      return {'mechanics': <Map<String, dynamic>>[]};
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

Widget _pantalla(_ApiDetalleFalsa api) {
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
}
