import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:provider/provider.dart';

import 'package:motorix_client/models/user.dart';
import 'package:motorix_client/providers/service_orders_provider.dart';
import 'package:motorix_client/providers/session_provider.dart';
import 'package:motorix_client/providers/vehicles_provider.dart';
import 'package:motorix_client/screens/orders/order_list_screen.dart';
import 'package:motorix_client/screens/vehicles/vehicle_list_screen.dart';
import 'package:motorix_client/services/api_client.dart';

/// ApiClient falso: vehículos del taller y órdenes por vehículo.
class _ApiFalsa extends ApiClient {
  _ApiFalsa({this.ordenesPorVehiculo = const {}});

  /// vehicleId → órdenes de ese vehículo.
  final Map<int, List<Map<String, dynamic>>> ordenesPorVehiculo;
  int? ultimoVehicleId;

  @override
  Future<dynamic> get(String path, {Map<String, String>? query}) async {
    if (path.startsWith('/clients')) {
      return {'clients': <Map<String, dynamic>>[], 'total': 0};
    }
    if (path.startsWith('/vehicles')) {
      return {
        'vehicles': [
          {
            'id': 1,
            'clientId': 1,
            'brand': 'Toyota',
            'model': 'Corolla',
            'year': 2020,
            'licensePlate': 'ABC1234',
            'currentMileage': 85000,
            'clientName': 'Juan Pérez',
          },
          {
            'id': 2,
            'clientId': 1,
            'brand': 'Nissan',
            'model': 'Versa',
            'year': 2021,
            'licensePlate': 'XYZ9876',
            'currentMileage': 30000,
            'clientName': 'Juan Pérez',
          },
        ],
        'total': 2,
      };
    }
    if (path.startsWith('/service-orders/mechanics')) {
      return {'mechanics': <Map<String, dynamic>>[]};
    }
    final vehicleId = query?['vehicleId'];
    ultimoVehicleId = vehicleId == null ? null : int.tryParse(vehicleId);
    final lista =
        ordenesPorVehiculo[ultimoVehicleId] ?? <Map<String, dynamic>>[];
    return {'orders': lista, 'total': lista.length};
  }
}

Map<String, dynamic> _orden() => {
      'id': 1,
      'clientId': 1,
      'clientName': 'Juan Pérez',
      'vehicleId': 1,
      'vehicleLabel': 'Toyota Corolla ABC1234',
      'mechanicId': 3,
      'mechanicName': 'Mecánico Demo',
      'status': 'RECEIVED',
      'entryMileage': 86000,
      'reportedProblem': 'Ruido al frenar',
      'createdAt': '2026-10-14T10:30:00',
      'updatedAt': '2026-10-14T10:30:00',
    };

Widget _pantalla(_ApiFalsa api) {
  final sesion = SessionProvider(api);
  sesion.usuario = const User(
    id: 2,
    username: 'recepcion',
    name: 'Recepción',
    email: 'recepcion@motorix.local',
    role: 'RECEPTIONIST',
  );
  return MultiProvider(
    providers: [
      ChangeNotifierProvider<SessionProvider>.value(value: sesion),
      ChangeNotifierProvider<VehiclesProvider>(
        create: (_) => VehiclesProvider(api),
      ),
      ChangeNotifierProvider<ServiceOrdersProvider>(
        create: (_) => ServiceOrdersProvider(api),
      ),
    ],
    child: MaterialApp(
      theme: ThemeData(useMaterial3: true),
      home: const VehicleListScreen(),
    ),
  );
}

void main() {
  testWidgets('Ver órdenes filtra la lista por vehículo', (tester) async {
    final api = _ApiFalsa(ordenesPorVehiculo: {1: [_orden()]});
    await tester.pumpWidget(_pantalla(api));
    await tester.pumpAndSettle();

    await tester.tap(find.byTooltip('Ver órdenes').first);
    await tester.pumpAndSettle();

    expect(find.byType(OrderListScreen), findsOneWidget);
    expect(api.ultimoVehicleId, 1);
    expect(
      find.text('Mecánico Demo · Ruido al frenar'),
      findsOneWidget,
      reason: 'solo debe mostrarse la orden del vehículo seleccionado',
    );
    expect(find.text('Vehículo: Toyota Corolla ABC1234'), findsOneWidget);
  });

  testWidgets('un vehículo sin órdenes muestra el estado vacío', (tester) async {
    final api = _ApiFalsa(ordenesPorVehiculo: {1: [_orden()]});
    await tester.pumpWidget(_pantalla(api));
    await tester.pumpAndSettle();

    await tester.tap(find.byTooltip('Ver órdenes').last);
    await tester.pumpAndSettle();

    expect(find.byType(OrderListScreen), findsOneWidget);
    expect(api.ultimoVehicleId, 2);
    expect(
      find.text('Este vehículo aún no tiene órdenes de servicio.'),
      findsOneWidget,
    );
  });
}
