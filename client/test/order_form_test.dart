import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:provider/provider.dart';

import 'package:motorix_client/models/client.dart';
import 'package:motorix_client/models/user.dart';
import 'package:motorix_client/models/vehicle.dart';
import 'package:motorix_client/providers/service_orders_provider.dart';
import 'package:motorix_client/providers/session_provider.dart';
import 'package:motorix_client/providers/vehicles_provider.dart';
import 'package:motorix_client/screens/orders/order_form_screen.dart';
import 'package:motorix_client/screens/orders/order_list_screen.dart';
import 'package:motorix_client/services/api_client.dart';

/// ApiClient falso para el listado y el formulario de órdenes.
class _ApiOrdenesFalsa extends ApiClient {
  @override
  Future<dynamic> get(String path, {Map<String, String>? query}) async {
    if (path.startsWith('/clients')) {
      return {
        'clients': [
          {
            'id': 1,
            'name': 'Juan Pérez',
            'phone': '5512345678',
            'email': 'juan@correo.mx',
            'active': true,
          },
          {
            'id': 2,
            'name': 'María López',
            'phone': '5523456789',
            'email': 'maria@correo.mx',
            'active': true,
          },
        ],
        'total': 2,
      };
    }
    if (path.startsWith('/vehicles')) {
      final todos = [
        {
          'id': 1,
          'clientId': 1,
          'brand': 'Toyota',
          'model': 'Corolla',
          'year': 2020,
          'licensePlate': 'ABC1234',
          'currentMileage': 85000,
        },
        {
          'id': 2,
          'clientId': 2,
          'brand': 'Nissan',
          'model': 'Versa',
          'year': 2021,
          'licensePlate': 'XYZ9876',
          'currentMileage': 30000,
        },
      ];
      final clientId = query?['clientId'];
      final filtrada = clientId == null
          ? todos
          : todos
              .where((v) => '${v['clientId']}' == clientId)
              .toList();
      return {'vehicles': filtrada, 'total': filtrada.length};
    }
    if (path.startsWith('/service-orders/mechanics')) {
      return {
        'mechanics': [
          {'id': 3, 'name': 'Mecánico Demo', 'username': 'mecanico'},
          {'id': 4, 'name': 'Segundo Mecánico', 'username': 'mecanico2'},
        ],
      };
    }
    return {'orders': <Map<String, dynamic>>[], 'total': 0};
  }
}

Widget _pantalla(_ApiOrdenesFalsa api) {
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
      ChangeNotifierProvider<ServiceOrdersProvider>(
        create: (_) => ServiceOrdersProvider(api),
      ),
      ChangeNotifierProvider<VehiclesProvider>(
        create: (_) => VehiclesProvider(api),
      ),
    ],
    child: MaterialApp(
      theme: ThemeData(useMaterial3: true),
      home: const OrderListScreen(),
    ),
  );
}

void main() {
  testWidgets('la validación muestra los campos obligatorios en español',
      (tester) async {
    final api = _ApiOrdenesFalsa();
    await tester.pumpWidget(_pantalla(api));
    await tester.pumpAndSettle();

    await tester.tap(find.byType(FloatingActionButton));
    await tester.pumpAndSettle();
    expect(find.byType(OrderFormScreen), findsOneWidget);

    final boton = find.widgetWithText(ElevatedButton, 'Registrar orden');
    await tester.ensureVisible(boton);
    await tester.pumpAndSettle();
    await tester.tap(boton);
    await tester.pump();

    expect(find.text('Selecciona un cliente.'), findsOneWidget);
    expect(find.text('Selecciona un vehículo.'), findsOneWidget);
    expect(find.text('Selecciona un mecánico.'), findsOneWidget);
    expect(
      find.text('El kilometraje de entrada es obligatorio.'),
      findsOneWidget,
    );
    expect(find.text('El problema reportado es obligatorio.'), findsOneWidget);
  });

  testWidgets('al elegir cliente se filtran solo sus vehículos',
      (tester) async {
    final api = _ApiOrdenesFalsa();
    await tester.pumpWidget(_pantalla(api));
    await tester.pumpAndSettle();

    await tester.tap(find.byType(FloatingActionButton));
    await tester.pumpAndSettle();

    await tester.tap(find.byType(DropdownButtonFormField<Client>).first);
    await tester.pumpAndSettle();
    await tester.tap(find.text('Juan Pérez'));
    await tester.pumpAndSettle();

    await tester.tap(find.byType(DropdownButtonFormField<Vehicle>).first);
    await tester.pumpAndSettle();

    expect(find.text('Toyota Corolla ABC1234'), findsWidgets);
    expect(
      find.text('Nissan Versa XYZ9876'),
      findsNothing,
      reason: 'los vehículos de otros clientes no deben aparecer',
    );
  });

  testWidgets('salir con cambios sin guardar pide confirmación',
      (tester) async {
    final api = _ApiOrdenesFalsa();
    await tester.pumpWidget(_pantalla(api));
    await tester.pumpAndSettle();

    await tester.tap(find.byType(FloatingActionButton));
    await tester.pumpAndSettle();

    await tester.enterText(
      find.byType(TextFormField).last,
      'Ruido al frenar',
    );
    await tester.pump();

    await tester.pageBack();
    await tester.pumpAndSettle();

    expect(find.text('Cambios sin guardar'), findsOneWidget);
    expect(
      find.text('Tienes cambios sin guardar. ¿Salir sin guardar?'),
      findsOneWidget,
    );

    await tester.tap(find.widgetWithText(FilledButton, 'Confirmar'));
    await tester.pumpAndSettle();

    expect(find.byType(OrderFormScreen), findsNothing);
  });
}
