import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:provider/provider.dart';

import 'package:motorix_client/models/user.dart';
import 'package:motorix_client/providers/session_provider.dart';
import 'package:motorix_client/providers/ui_provider.dart';
import 'package:motorix_client/providers/vehicle_history_provider.dart';
import 'package:motorix_client/screens/history/vehicle_history_screen.dart';
import 'package:motorix_client/services/api_client.dart';
import 'package:motorix_client/widgets/app_shell.dart';

/// ApiClient falso para el historial: lista de vehículos e historial.
class _ApiHistorialFalsa extends ApiClient {
  @override
  Future<dynamic> get(String path, {Map<String, String>? query}) async {
    if (path.endsWith('/history')) {
      return {
        'vehicle': {
          'id': 1,
          'label': 'Toyota Corolla ABC1234',
          'clientName': 'Juan Pérez',
          'currentMileage': 48500,
        },
        'entries': [
          {
            'orderId': 3,
            'date': '2026-10-05',
            'status': 'DELIVERED',
            'entryMileage': 48000,
            'reportedProblem': 'Ruido al frenar',
            'diagnosis': 'Balatas traseras desgastadas',
            'services': [
              {'description': 'Cambio de balatas', 'unitPrice': '850.00'},
            ],
            'labor': [
              {'concept': 'Mano de obra frenos', 'hours': '1.50', 'hourlyRate': '350.00'},
            ],
            'parts': [
              {'partCode': 'BAL-001', 'name': 'Balatas traseras', 'quantity': 1},
            ],
            'observations': 'Sin fugas',
            'recommendations': 'Revisar a los 5,000 km',
            'mechanicName': 'Mecánico Uno',
          },
        ],
      };
    }
    if (path.startsWith('/vehicles')) {
      return {
        'vehicles': [
          {
            'id': 1,
            'brand': 'Toyota',
            'model': 'Corolla',
            'year': 2020,
            'licensePlate': 'ABC1234',
            'vin': null,
            'currentMileage': 48500,
            'clientId': 1,
            'clientName': 'Juan Pérez',
          },
        ],
        'total': 1,
      };
    }
    return {'appointments': <Map<String, dynamic>>[]};
  }
}

Widget _shell(User usuario) {
  final sesion = SessionProvider(_ApiHistorialFalsa());
  sesion.usuario = usuario; // estado de prueba, sin notificar
  return MultiProvider(
    providers: [
      ChangeNotifierProvider<SessionProvider>.value(value: sesion),
      ChangeNotifierProvider<UiProvider>(create: (_) => UiProvider()),
    ],
    child: MaterialApp(
      theme: ThemeData(useMaterial3: true),
      home: const AppShell(),
    ),
  );
}

Widget _pantalla() => ChangeNotifierProvider<VehicleHistoryProvider>(
      create: (_) => VehicleHistoryProvider(_ApiHistorialFalsa()),
      child: MaterialApp(
        theme: ThemeData(useMaterial3: true),
        home: const VehicleHistoryScreen(),
      ),
    );

const _mecanico = User(
  id: 3,
  username: 'mecanico',
  name: 'Mecánico Uno',
  email: 'mecanico@motorix.local',
  role: 'MECHANIC',
);

const _recepcionista = User(
  id: 2,
  username: 'recepcion',
  name: 'Recepción',
  email: 'recepcion@motorix.local',
  role: 'RECEPTIONIST',
);

void main() {
  testWidgets('la entrada Historial es visible para MECHANIC y ADMIN', (tester) async {
    await tester.pumpWidget(_shell(_mecanico));
    await tester.pump();

    expect(find.text('Historial'), findsWidgets,
        reason: 'Historial es visible para ADMIN y MECHANIC (R-11)');

    await tester.pumpWidget(_shell(const User(
      id: 1,
      username: 'admin',
      name: 'Administrador',
      email: 'admin@motorix.local',
      role: 'ADMIN',
    )));
    await tester.pump();
    expect(find.text('Historial'), findsWidgets);
  });

  testWidgets('la entrada Historial no aparece para RECEPTIONIST', (tester) async {
    await tester.pumpWidget(_shell(_recepcionista));
    await tester.pump();

    expect(find.text('Historial'), findsNothing,
        reason: 'RECEPTIONIST no consulta el historial (R-07, R-11)');
  });

  testWidgets('cada tarjeta muestra fecha, kilometraje y diagnóstico del servicio',
      (tester) async {
    await tester.pumpWidget(_pantalla());
    await tester.pumpAndSettle();

    expect(find.text('Toyota Corolla ABC1234'), findsWidgets);
    expect(find.textContaining('05/10/2026'), findsWidgets,
        reason: 'fecha del servicio en la tarjeta (CA-1)');
    expect(find.textContaining('48000'), findsWidgets,
        reason: 'kilometraje registrado en ese servicio (FR-003)');
    expect(find.text('Balatas traseras desgastadas'), findsOneWidget,
        reason: 'diagnóstico de la orden terminada');
    expect(find.text('Revisar a los 5,000 km'), findsOneWidget,
        reason: 'recomendaciones de la orden terminada');
  });
}
