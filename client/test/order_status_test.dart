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

/// ApiClient falso para el control de estado (US6): la orden guarda el
/// estado enviado en el PATCH para que el detalle refleje el nuevo flujo.
class _ApiEstadoFalsa extends ApiClient {
  _ApiEstadoFalsa({this.status = 'RECEIVED', this.waitingOrigin});

  String status;
  String? waitingOrigin;
  int cambios = 0;

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
        'status': status,
        'entryMileage': 86000,
        'reportedProblem': 'Ruido al frenar',
        'diagnosis': null,
        'observations': null,
        'recommendations': null,
        'mileageCorrectionReason': null,
        'waitingOrigin': waitingOrigin,
        'createdAt': '2026-10-14T10:30:00',
        'updatedAt': '2026-10-14T10:30:00',
      },
      'services': <Map<String, dynamic>>[],
      'labor': <Map<String, dynamic>>[],
    };
  }

  @override
  Future<dynamic> patch(String path, Object cuerpo) async {
    if (path == '/service-orders/1/status' && cuerpo is Map) {
      cambios += 1;
      status = cuerpo['status'] as String;
      // El backend guarda el origen al entrar a espera y lo borra al salir.
      if (status == 'WAITING_PART') {
        waitingOrigin = 'DIAGNOSIS';
      } else {
        waitingOrigin = null;
      }
      return {
        'order': <String, dynamic>{'id': 1, 'status': status},
      };
    }
    return {
      'order': <String, dynamic>{'id': 1, 'status': status},
    };
  }
}

const _mecanico = User(
  id: 3,
  username: 'mecanico-uno',
  name: 'Mecánico Uno',
  email: 'mecanico@motorix.local',
  role: 'MECHANIC',
);

const _recepcion = User(
  id: 2,
  username: 'recepcion',
  name: 'Recepción',
  email: 'recepcion@motorix.local',
  role: 'RECEPTIONIST',
);

Widget _pantalla(_ApiEstadoFalsa api, User usuario) {
  final sesion = SessionProvider(api);
  sesion.usuario = usuario;
  final orden = ServiceOrder(
    id: 1,
    clientId: 1,
    clientName: 'Juan Pérez',
    vehicleId: 1,
    vehicleLabel: 'Toyota Corolla ABC1234',
    mechanicId: 3,
    mechanicName: 'Mecánico Uno',
    status: api.status,
    entryMileage: 86000,
    reportedProblem: 'Ruido al frenar',
    waitingOrigin: api.waitingOrigin,
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
      home: OrderDetailScreen(orden: orden),
    ),
  );
}

void main() {
  testWidgets(
      'la orden RECIBIDO solo ofrece avanzar a Diagnóstico (transiciones válidas)',
      (tester) async {
    await tester.pumpWidget(_pantalla(_ApiEstadoFalsa(), _mecanico));
    await tester.pumpAndSettle();

    expect(find.text('Cambiar estado'), findsOneWidget);
    expect(find.byType(DropdownButton<String>), findsOneWidget);

    await tester.tap(find.byType(DropdownButton<String>).first);
    await tester.pumpAndSettle();

    expect(
      find.text('Diagnóstico'),
      findsNWidgets(2), // el título de la sección y la única opción
    );
    expect(find.text('En reparación'), findsNothing);
    expect(find.text('Esperando refacción'), findsNothing);
    expect(find.text('Terminado'), findsNothing);
    expect(find.text('Entregado'), findsNothing);
  });

  testWidgets(
      'en ESPERANDO REFACCIÓN solo ofrece volver a su estado de origen',
      (tester) async {
    final api = _ApiEstadoFalsa(status: 'WAITING_PART', waitingOrigin: 'IN_REPAIR');
    await tester.pumpWidget(_pantalla(api, _mecanico));
    await tester.pumpAndSettle();

    await tester.tap(find.byType(DropdownButton<String>).first);
    await tester.pumpAndSettle();

    expect(find.text('En reparación'), findsOneWidget); // único destino
    expect(find.text('Terminado'), findsNothing);
    expect(find.text('Entregado'), findsNothing);
  });

  testWidgets('RECEPTIONIST no ve el control de estado', (tester) async {
    final api = _ApiEstadoFalsa(status: 'DIAGNOSIS');
    await tester.pumpWidget(_pantalla(api, _recepcion));
    await tester.pumpAndSettle();

    expect(find.text('Cambiar estado'), findsNothing);
    expect(find.byType(DropdownButton<String>), findsNothing);
  });

  testWidgets('cambiar estado pide confirmación y aplica la transición',
      (tester) async {
    final api = _ApiEstadoFalsa();
    await tester.pumpWidget(_pantalla(api, _mecanico));
    await tester.pumpAndSettle();

    await tester.tap(find.byType(DropdownButton<String>).first);
    await tester.pumpAndSettle();
    await tester.tap(find.text('Diagnóstico').last);
    await tester.pumpAndSettle();

    await tester.tap(find.widgetWithText(ElevatedButton, 'Cambiar estado'));
    await tester.pumpAndSettle();

    expect(find.text('¿Pasar la orden a "Diagnóstico"?'), findsOneWidget);

    await tester.tap(find.widgetWithText(FilledButton, 'Confirmar'));
    await tester.pumpAndSettle();

    expect(api.cambios, 1);
    expect(api.status, 'DIAGNOSIS');
    expect(find.text('Estado actualizado'), findsOneWidget);

    // Deja pasar el temporizador de la barra de aviso.
    await tester.pump(const Duration(seconds: 5));
    await tester.pumpAndSettle();
  });
}
