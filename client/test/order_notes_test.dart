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

/// ApiClient falso de notas (US7): guarda lo enviado en PATCH /work y lo
/// devuelve en el detalle para comprobar que persisten al reabrir.
class _ApiNotasFalsa extends ApiClient {
  String? observaciones;
  String? recomendaciones;
  int guardados = 0;

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
        'observations': observaciones,
        'recommendations': recomendaciones,
        'mileageCorrectionReason': null,
        'waitingOrigin': null,
        'createdAt': '2026-10-14T10:30:00',
        'updatedAt': '2026-10-14T10:30:00',
      },
      'services': <Map<String, dynamic>>[],
      'labor': <Map<String, dynamic>>[],
    };
  }

  @override
  Future<dynamic> patch(String path, Object cuerpo) async {
    if (path == '/service-orders/1/work' && cuerpo is Map) {
      guardados += 1;
      // Un campo ausente conserva el valor guardado (igual que el backend).
      observaciones = (cuerpo['observations'] as String?) ?? observaciones;
      recomendaciones =
          (cuerpo['recommendations'] as String?) ?? recomendaciones;
      return {
        'order': <String, dynamic>{'id': 1},
      };
    }
    return {
      'order': <String, dynamic>{'id': 1},
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
  diagnosis: 'Pastillas desgastadas',
);

const _mecanico = User(
  id: 3,
  username: 'mecanico-uno',
  name: 'Mecánico Uno',
  email: 'mecanico@motorix.local',
  role: 'MECHANIC',
);

Widget _pantalla(_ApiNotasFalsa api) {
  final sesion = SessionProvider(api);
  sesion.usuario = _mecanico;
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
  testWidgets('guardar notas en la orden y mostrarlas al reabrir',
      (tester) async {
    final api = _ApiNotasFalsa();
    await tester.pumpWidget(_pantalla(api));
    await tester.pumpAndSettle();

    expect(find.text('Sin observaciones ni recomendaciones.'), findsOneWidget);

    final botonRegistrar = find.widgetWithText(TextButton, 'Registrar notas');
    await tester.ensureVisible(botonRegistrar);
    await tester.pumpAndSettle();
    await tester.tap(botonRegistrar);
    await tester.pumpAndSettle();

    await tester.enterText(
      find.byType(TextFormField).at(0),
      'Discos en buen estado',
    );
    await tester.enterText(
      find.byType(TextFormField).at(1),
      'Revisar frenos en 5,000 km',
    );

    final botonGuardar = find.widgetWithText(ElevatedButton, 'Guardar notas');
    await tester.ensureVisible(botonGuardar);
    await tester.pumpAndSettle();
    await tester.tap(botonGuardar);
    await tester.pumpAndSettle();

    expect(api.guardados, 1);
    expect(find.text('Notas guardadas'), findsOneWidget);
    expect(find.text('Discos en buen estado'), findsOneWidget);
    expect(find.text('Revisar frenos en 5,000 km'), findsOneWidget);

    // Deja pasar el temporizador de la barra de aviso.
    await tester.pump(const Duration(seconds: 5));
    await tester.pumpAndSettle();
  });

  testWidgets('bloquear el guardado con ambos campos vacíos', (tester) async {
    final api = _ApiNotasFalsa();
    await tester.pumpWidget(_pantalla(api));
    await tester.pumpAndSettle();

    final botonRegistrar = find.widgetWithText(TextButton, 'Registrar notas');
    await tester.ensureVisible(botonRegistrar);
    await tester.pumpAndSettle();
    await tester.tap(botonRegistrar);
    await tester.pumpAndSettle();

    final botonGuardar = find.widgetWithText(ElevatedButton, 'Guardar notas');
    await tester.ensureVisible(botonGuardar);
    await tester.pumpAndSettle();
    await tester.tap(botonGuardar);
    await tester.pumpAndSettle();

    expect(
      find.text('Guarda al menos una observación o una recomendación.'),
      findsWidgets,
    );
    expect(api.guardados, 0, reason: 'no debe llamar al backend sin notas');
  });
}
