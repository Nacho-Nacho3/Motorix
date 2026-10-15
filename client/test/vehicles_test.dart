import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:provider/provider.dart';

import 'package:motorix_client/models/client.dart';
import 'package:motorix_client/models/vehicle.dart';
import 'package:motorix_client/providers/vehicles_provider.dart';
import 'package:motorix_client/screens/vehicles/vehicle_form_screen.dart';
import 'package:motorix_client/screens/vehicles/vehicle_list_screen.dart';
import 'package:motorix_client/services/api_client.dart';
import 'package:motorix_client/utils/app_route.dart';

/// ApiClient falso para vehículos: dueños, listado, alta y placas duplicadas.
class _ApiVehiculosFalsa extends ApiClient {
  _ApiVehiculosFalsa({this.duenios = const []});

  List<Map<String, dynamic>> duenios;
  List<Map<String, dynamic>> vehiculos = [];
  Map<String, dynamic>? ultimoCuerpo;
  int posteos = 0;
  bool placasDuplicadas = false;

  @override
  Future<dynamic> get(String path, {Map<String, String>? query}) async {
    if (path == '/clients') {
      return {'clients': duenios, 'total': duenios.length};
    }
    return {'vehicles': vehiculos, 'total': vehiculos.length};
  }

  @override
  Future<dynamic> post(String path, Object cuerpo) async {
    posteos += 1;
    ultimoCuerpo = Map<String, dynamic>.from(cuerpo as Map);

    if (placasDuplicadas) {
      throw ApiError(
        status: 409,
        code: 'DUPLICATE_PLATE',
        message: 'Esas placas ya están registradas.',
      );
    }

    final duenio = duenios.firstWhere(
      (cliente) => cliente['id'] == ultimoCuerpo!['clientId'],
      orElse: () => <String, dynamic>{},
    );
    if (duenio.isEmpty) {
      throw ApiError(
        status: 400,
        code: 'CLIENT_REQUIRED',
        message: 'El vehículo debe tener un propietario.',
      );
    }

    final nuevo = {
      'id': vehiculos.length + 1,
      'clientId': ultimoCuerpo!['clientId'],
      'clientName': duenio['name'],
      'brand': ultimoCuerpo!['brand'],
      'model': ultimoCuerpo!['model'],
      'year': ultimoCuerpo!['year'],
      'licensePlate': ultimoCuerpo!['licensePlate'],
      'vin': ultimoCuerpo!['vin'],
      'currentMileage': ultimoCuerpo!['currentMileage'],
    };
    vehiculos = [...vehiculos, nuevo];
    return {'vehicle': nuevo};
  }
}

const _duenioJuan = {
  'id': 1,
  'name': 'Juan Pérez',
  'phone': '5512345678',
  'email': 'juan@correo.mx',
  'active': true,
  'createdAt': '2026-10-13T10:00:00',
  'vehicleCount': 0,
};

Widget _pantalla(_ApiVehiculosFalsa api) =>
    ChangeNotifierProvider<VehiclesProvider>(
      create: (_) => VehiclesProvider(api),
      child: MaterialApp(
        theme: ThemeData(useMaterial3: true),
        home: const VehicleListScreen(),
      ),
    );

Future<void> _abrirFormulario(WidgetTester tester) async {
  await tester.pumpAndSettle();
  await tester.tap(find.byType(FloatingActionButton));
  await tester.pumpAndSettle();
  expect(find.byType(VehicleFormScreen), findsOneWidget);
}

Future<void> _llenarVehiculo(WidgetTester tester) async {
  await tester.enterText(find.byType(TextFormField).at(0), 'Toyota');
  await tester.enterText(find.byType(TextFormField).at(1), 'Corolla');
  await tester.enterText(find.byType(TextFormField).at(2), '2020');
  await tester.enterText(find.byType(TextFormField).at(3), '85000');
  await tester.enterText(find.byType(TextFormField).at(4), 'ABC1234');
}

void main() {
  testWidgets('el alta rechaza el guardado sin propietario seleccionado',
      (tester) async {
    final api = _ApiVehiculosFalsa(duenios: const [_duenioJuan]);
    await tester.pumpWidget(_pantalla(api));
    await _abrirFormulario(tester);

    await _llenarVehiculo(tester);
    await tester.tap(find.widgetWithText(ElevatedButton, 'Registrar'));
    await tester.pump();

    expect(find.text('Selecciona un propietario.'), findsOneWidget);
    expect(api.posteos, 0,
        reason: 'no debe enviar nada sin propietario (RN-1)');
    expect(find.byType(VehicleFormScreen), findsOneWidget,
        reason: 'debe permanecer en el formulario');
  });

  testWidgets('registra un vehículo con propietario seleccionado', (tester) async {
    final api = _ApiVehiculosFalsa(duenios: const [_duenioJuan]);
    await tester.pumpWidget(_pantalla(api));
    await _abrirFormulario(tester);

    await _llenarVehiculo(tester);

    // Seleccionar el propietario en el selector obligatorio.
    await tester.tap(find.byType(DropdownButtonFormField<Client>).first);
    await tester.pumpAndSettle();
    await tester.tap(find.text('Juan Pérez').last);
    await tester.pumpAndSettle();

    await tester.tap(find.widgetWithText(ElevatedButton, 'Registrar'));
    await tester.pumpAndSettle();

    expect(api.posteos, 1);
    expect(api.ultimoCuerpo?['clientId'], 1,
        reason: 'debe enviar el propietario elegido');
    expect(api.ultimoCuerpo?['licensePlate'], 'ABC1234');
    expect(find.byType(VehicleFormScreen), findsNothing,
        reason: 'debe volver al listado');
    expect(find.text('Toyota Corolla (2020)'), findsOneWidget);

    await tester.pump(const Duration(seconds: 5));
    await tester.pumpAndSettle();
  });

  testWidgets('muestra el aviso de placas duplicadas (409) en español',
      (tester) async {
    final api = _ApiVehiculosFalsa(
      duenios: const [_duenioJuan],
    )..placasDuplicadas = true;
    await tester.pumpWidget(_pantalla(api));
    await _abrirFormulario(tester);

    await _llenarVehiculo(tester);
    await tester.tap(find.byType(DropdownButtonFormField<Client>).first);
    await tester.pumpAndSettle();
    await tester.tap(find.text('Juan Pérez').last);
    await tester.pumpAndSettle();

    await tester.tap(find.widgetWithText(ElevatedButton, 'Registrar'));
    await tester.pumpAndSettle();

    expect(find.text('Esas placas ya están registradas.'), findsOneWidget,
        reason: 'el error del backend debe mostrarse al usuario');
    expect(find.byType(VehicleFormScreen), findsOneWidget,
        reason: 'debe poder corregir las placas');

    await tester.pump(const Duration(seconds: 5));
    await tester.pumpAndSettle();
  });

  testWidgets('la edición precarga el propietario y no deja cambiarlo',
      (tester) async {
    final api = _ApiVehiculosFalsa(duenios: const [_duenioJuan]);
    const vehiculo = Vehicle(
      id: 7,
      brand: 'Toyota',
      model: 'Corolla',
      year: 2020,
      licensePlate: 'ABC1234',
      currentMileage: 85000,
      clientId: 1,
      clientName: 'Juan Pérez',
    );
    await tester.pumpWidget(
      ChangeNotifierProvider<VehiclesProvider>(
        create: (_) => VehiclesProvider(api),
        child: MaterialApp(
          theme: ThemeData(useMaterial3: true),
          home: const VehicleFormScreen(vehiculo: vehiculo),
        ),
      ),
    );
    await tester.pumpAndSettle();

    expect(find.text('Editar vehículo'), findsOneWidget);
    expect(find.text('Toyota'), findsOneWidget,
        reason: 'la marca debe venir precargada');
    expect(find.text('Juan Pérez'), findsOneWidget,
        reason: 'debe precargar el propietario actual');
    final selector = tester.widget<DropdownButtonFormField<Client>>(
      find.byType(DropdownButtonFormField<Client>),
    );
    expect(selector.onChanged, isNull,
        reason: 'clientId no se modifica en este sprint (contrato)');
    expect(find.text('El propietario no se puede cambiar en esta versión.'),
        findsOneWidget,
        reason: 'debe explicar en español por qué está bloqueado');
  });

  testWidgets('pide confirmación al salir del formulario con cambios sin guardar',
      (tester) async {
    final api = _ApiVehiculosFalsa(duenios: const [_duenioJuan]);
    await tester.pumpWidget(
      ChangeNotifierProvider<VehiclesProvider>(
        create: (_) => VehiclesProvider(api),
        child: MaterialApp(
          theme: ThemeData(useMaterial3: true),
          home: Builder(
            builder: (context) => Scaffold(
              body: Center(
                child: ElevatedButton(
                  onPressed: () => Navigator.of(context).push(
                    AppRoute<void>(
                      builder: (_) => const VehicleFormScreen(),
                    ),
                  ),
                  child: const Text('Abrir formulario'),
                ),
              ),
            ),
          ),
        ),
      ),
    );
    await tester.pumpAndSettle();

    // Sin cambios: sale directamente, sin diálogo.
    await tester.tap(find.text('Abrir formulario'));
    await tester.pumpAndSettle();
    expect(find.byType(VehicleFormScreen), findsOneWidget);
    await tester.tap(find.byType(BackButton));
    await tester.pumpAndSettle();
    expect(find.byType(VehicleFormScreen), findsNothing);
    expect(find.text('Cambios sin guardar'), findsNothing,
        reason: 'sin cambios no debe pedir confirmación');

    // Con cambios: pide confirmación (8.5).
    await tester.tap(find.text('Abrir formulario'));
    await tester.pumpAndSettle();
    await tester.enterText(find.byType(TextFormField).at(0), 'Honda');
    await tester.pump();
    await tester.tap(find.byType(BackButton));
    await tester.pumpAndSettle();
    expect(find.text('Cambios sin guardar'), findsOneWidget);
    expect(find.text('Tienes cambios sin guardar. ¿Salir sin guardar?'),
        findsOneWidget);

    // Cancelar: permanece en el formulario.
    await tester.tap(find.widgetWithText(TextButton, 'Cancelar'));
    await tester.pumpAndSettle();
    expect(find.byType(VehicleFormScreen), findsOneWidget);
    expect(find.text('Cambios sin guardar'), findsNothing);

    // Confirmar: sale sin guardar.
    await tester.tap(find.byType(BackButton));
    await tester.pumpAndSettle();
    await tester.tap(find.widgetWithText(FilledButton, 'Confirmar'));
    await tester.pumpAndSettle();
    expect(find.byType(VehicleFormScreen), findsNothing,
        reason: 'al confirmar debe salir del formulario');
    expect(api.posteos, 0, reason: 'salir sin guardar no debe enviar nada');
  });
}
