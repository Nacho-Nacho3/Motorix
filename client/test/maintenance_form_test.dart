import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:provider/provider.dart';

import 'package:motorix_client/providers/maintenances_provider.dart';
import 'package:motorix_client/providers/vehicles_provider.dart';
import 'package:motorix_client/screens/maintenances/maintenance_form_screen.dart';
import 'package:motorix_client/services/api_client.dart';
import 'package:motorix_client/utils/app_route.dart';

/// ApiClient falso para el formulario de mantenimientos (vehículos + alta).
class _ApiMantenimientosFalsa extends ApiClient {
  int posteos = 0;
  Map<String, dynamic>? ultimoCuerpo;

  static const _vehiculo = {
    'id': 1,
    'brand': 'Toyota',
    'model': 'Corolla',
    'year': 2020,
    'licensePlate': 'ABC1234',
    'vin': null,
    'currentMileage': 48500,
    'clientId': 1,
    'clientName': 'Juan Pérez',
  };

  @override
  Future<dynamic> get(String path, {Map<String, String>? query}) async {
    if (path.startsWith('/vehicles')) {
      return {'vehicles': [_vehiculo], 'total': 1};
    }
    if (path.startsWith('/maintenances')) {
      return {'maintenances': <Map<String, dynamic>>[], 'total': 0};
    }
    return {'appointments': <Map<String, dynamic>>[]};
  }

  @override
  Future<dynamic> post(String path, Object cuerpo) async {
    final datos = cuerpo as Map<String, dynamic>;
    posteos += 1;
    ultimoCuerpo = datos;
    if (datos['nextDueDate'] == null && datos['nextDueMileage'] == null) {
      throw ApiError(
        status: 400,
        code: 'MAINTENANCE_TARGET_REQUIRED',
        message:
            'Debes indicar la fecha o el kilometraje del próximo mantenimiento.',
      );
    }
    return {
      'maintenance': {
        'id': 1,
        'vehicleId': datos['vehicleId'],
        'vehicleLabel': 'Toyota Corolla ABC1234',
        'clientName': 'Juan Pérez',
        'nextDueDate': datos['nextDueDate'],
        'nextDueMileage': datos['nextDueMileage'],
        'warnDays': 30,
        'warnKm': 500,
        'recommendations': datos['recommendations'],
        'state': 'UPCOMING',
        'daysRemaining': 10,
        'mileageRemaining': 150,
        'registeredBy': 1,
        'updatedAt': '2026-10-14 10:00:00',
      },
    };
  }
}

Widget _formulario(ApiClient api) => MultiProvider(
      providers: [
        ChangeNotifierProvider<VehiclesProvider>(
          create: (_) => VehiclesProvider(api),
        ),
        ChangeNotifierProvider<MaintenancesProvider>(
          create: (_) => MaintenancesProvider(api),
        ),
      ],
      child: MaterialApp(
        theme: ThemeData(useMaterial3: true),
        home: const MaintenanceFormScreen(),
      ),
    );

/// Inicio con navegación al formulario (necesario para probar el BackButton).
class _Inicio extends StatelessWidget {
  const _Inicio();

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: Center(
        child: TextButton(
          onPressed: () => Navigator.of(context).push(
            AppRoute(builder: (_) => const MaintenanceFormScreen()),
          ),
          child: const Text('Ir al formulario'),
        ),
      ),
    );
  }
}

/// Los providers van FUERA del MaterialApp: enrutan todas las rutas.
Widget _conNavegacion(ApiClient api) => MultiProvider(
      providers: [
        ChangeNotifierProvider<VehiclesProvider>(
          create: (_) => VehiclesProvider(api),
        ),
        ChangeNotifierProvider<MaintenancesProvider>(
          create: (_) => MaintenancesProvider(api),
        ),
      ],
      child: MaterialApp(
        theme: ThemeData(useMaterial3: true),
        home: const _Inicio(),
      ),
    );

void main() {
  testWidgets('sin objetivo muestra el mensaje en español (RN-11)', (tester) async {
    await tester.pumpWidget(_formulario(_ApiMantenimientosFalsa()));
    await tester.pumpAndSettle();

    await tester.ensureVisible(find.byType(ElevatedButton));
    await tester.pumpAndSettle();
    await tester.tap(find.byType(ElevatedButton));
    await tester.pumpAndSettle();

    expect(
      find.text(
        'Debes indicar la fecha o el kilometraje del próximo mantenimiento.',
      ),
      findsOneWidget,
      reason: 'RN-11: registrar requiere fecha y/o kilometraje objetivo',
    );
  });

  testWidgets('muestra los campos de fecha, kilometraje y antelación', (tester) async {
    await tester.pumpWidget(_formulario(_ApiMantenimientosFalsa()));
    await tester.pumpAndSettle();

    expect(find.text('Vehículo'), findsOneWidget);
    expect(find.text('Fecha objetivo'), findsOneWidget);
    expect(find.text('Kilometraje objetivo'), findsOneWidget);
    expect(find.text('Antelación en días'), findsOneWidget);
    expect(find.text('Antelación en kilómetros'), findsOneWidget);
    expect(find.text('Recomendaciones'), findsOneWidget);
  });

  testWidgets('abre el selector de fecha nativo del sistema', (tester) async {
    await tester.pumpWidget(_formulario(_ApiMantenimientosFalsa()));
    await tester.pumpAndSettle();

    final calendario = find.byIcon(Icons.calendar_month_outlined);
    await tester.ensureVisible(calendario);
    await tester.pumpAndSettle();
    await tester.tap(calendario);
    await tester.pumpAndSettle();

    expect(find.byType(CalendarDatePicker), findsOneWidget);
  });

  testWidgets('pide confirmación al salir con cambios sin guardar (PopScope)', (tester) async {
    await tester.pumpWidget(_conNavegacion(_ApiMantenimientosFalsa()));
    await tester.pumpAndSettle();

    await tester.tap(find.text('Ir al formulario'));
    await tester.pumpAndSettle();

    final recomendaciones = find.byType(TextFormField).last;
    await tester.ensureVisible(recomendaciones);
    await tester.pumpAndSettle();
    await tester.enterText(recomendaciones, 'Revisar filtro de aceite');

    await tester.tap(find.byType(BackButton));
    await tester.pumpAndSettle();

    expect(find.text('Cambios sin guardar'), findsOneWidget);
  });
}
