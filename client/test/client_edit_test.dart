import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:provider/provider.dart';

import 'package:motorix_client/models/client.dart';
import 'package:motorix_client/providers/clients_provider.dart';
import 'package:motorix_client/screens/clients/client_form_screen.dart';
import 'package:motorix_client/screens/clients/client_list_screen.dart';
import 'package:motorix_client/services/api_client.dart';

/// ApiClient falso para la edición: lista, ficha y PATCH (T058).
class _ApiEdicionFalsa extends ApiClient {
  _ApiEdicionFalsa({required this.cliente, this.vehiculos = const []});

  Map<String, dynamic> cliente;
  List<Map<String, dynamic>> vehiculos;
  Map<String, dynamic>? ultimoPatch;

  @override
  Future<dynamic> get(String path, {Map<String, String>? query}) async {
    if (path.startsWith('/clients/')) {
      return {'client': cliente, 'vehicles': vehiculos};
    }
    return {'clients': [cliente], 'total': 1};
  }

  @override
  Future<dynamic> patch(String path, Object cuerpo) async {
    ultimoPatch = Map<String, dynamic>.from(cuerpo as Map);
    cliente = {...cliente, ...ultimoPatch!};
    return {'client': cliente};
  }
}

final Map<String, dynamic> _clienteBase = {
  'id': 1,
  'name': 'Juan Pérez',
  'phone': '5512345678',
  'email': 'juan@correo.mx',
  'active': true,
  'createdAt': '2026-10-13T10:00:00',
  'vehicleCount': 1,
};

final Map<String, dynamic> _vehiculoBase = {
  'id': 1,
  'clientId': 1,
  'brand': 'Toyota',
  'model': 'Corolla',
  'year': 2020,
  'licensePlate': 'ABC1234',
  'vin': null,
  'currentMileage': 85000,
};

Widget _pantallaLista(_ApiEdicionFalsa api) => ChangeNotifierProvider<
        ClientsProvider>(
      create: (_) => ClientsProvider(api),
      child: MaterialApp(
        theme: ThemeData(useMaterial3: true),
        home: const ClientesListScreen(),
      ),
    );

/// Muestra un botón que empuja el formulario de edición sobre una ruta base
/// (para poder probar la salida con el botón atrás).
Widget _pantallaConFormulario(_ApiEdicionFalsa api, Client cliente) =>
    ChangeNotifierProvider<ClientsProvider>.value(
      value: ClientsProvider(api),
      child: MaterialApp(
        theme: ThemeData(useMaterial3: true),
        home: Builder(
          builder: (context) => Scaffold(
            body: Center(
              child: ElevatedButton(
                onPressed: () => Navigator.of(context).push(
                  MaterialPageRoute<void>(
                    builder: (_) => ClienteFormScreen(cliente: cliente),
                  ),
                ),
                child: const Text('Abrir edición'),
              ),
            ),
          ),
        ),
      ),
    );

void main() {
  testWidgets('la edición precarga los datos del cliente', (tester) async {
    final api = _ApiEdicionFalsa(
      cliente: _clienteBase,
      vehiculos: [_vehiculoBase],
    );
    await tester.pumpWidget(
      ChangeNotifierProvider<ClientsProvider>(
        create: (_) => ClientsProvider(api),
        child: MaterialApp(
          theme: ThemeData(useMaterial3: true),
          home: ClienteFormScreen(cliente: Client.fromJson(_clienteBase)),
        ),
      ),
    );
    await tester.pumpAndSettle();

    expect(find.text('Editar cliente'), findsOneWidget);
    expect(find.text('Juan Pérez'), findsOneWidget,
        reason: 'el nombre debe venir precargado');
    expect(find.text('5512345678'), findsOneWidget,
        reason: 'el teléfono debe venir precargado');
    expect(find.text('juan@correo.mx'), findsOneWidget,
        reason: 'el correo debe venir precargado');
    expect(find.widgetWithText(ElevatedButton, 'Guardar cambios'),
        findsOneWidget);
  });

  testWidgets(
      'guarda el cambio, la ficha muestra el teléfono nuevo y conserva los vehículos',
      (tester) async {
    final api = _ApiEdicionFalsa(
      cliente: {..._clienteBase},
      vehiculos: [{..._vehiculoBase}],
    );
    await tester.pumpWidget(_pantallaLista(api));
    await tester.pumpAndSettle();

    // V5 del quickstart: abrir la ficha del cliente.
    await tester.tap(find.text('Juan Pérez'));
    await tester.pumpAndSettle();
    expect(find.text('Vehículos (1)'), findsOneWidget);
    expect(find.text('Toyota Corolla (2020)'), findsOneWidget);

    // Entrar en edición y cambiar el teléfono.
    await tester.tap(find.widgetWithText(TextButton, 'Editar'));
    await tester.pumpAndSettle();
    expect(find.text('Editar cliente'), findsOneWidget);

    await tester.enterText(find.byType(TextFormField).at(1), '5599887766');
    await tester.pump();
    await tester.tap(find.widgetWithText(ElevatedButton, 'Guardar cambios'));
    await tester.pumpAndSettle();

    expect(find.byType(ClienteFormScreen), findsNothing,
        reason: 'debe volver a la ficha tras guardar');
    expect(api.ultimoPatch?['phone'], '5599887766',
        reason: 'el PATCH debe llevar el teléfono nuevo');
    expect(find.text('5599887766'), findsOneWidget,
        reason: 'la ficha debe mostrar el teléfono actualizado');
    expect(find.text('Toyota Corolla (2020)'), findsOneWidget,
        reason: 'los vehículos deben conservarse intactos');

    // Limpia la animación del aviso 'Cliente actualizado'.
    await tester.pump(const Duration(seconds: 5));
    await tester.pumpAndSettle();
  });

  testWidgets('pide confirmación al salir con cambios sin guardar',
      (tester) async {
    final api = _ApiEdicionFalsa(cliente: {..._clienteBase});
    await tester.pumpWidget(
        _pantallaConFormulario(api, Client.fromJson(_clienteBase)));
    await tester.pumpAndSettle();

    await tester.tap(find.text('Abrir edición'));
    await tester.pumpAndSettle();
    expect(find.text('Editar cliente'), findsOneWidget);

    // Modificar un dato para dejar cambios sin guardar.
    await tester.enterText(find.byType(TextFormField).at(1), '5500000000');
    await tester.pump();

    await tester.tap(find.byType(BackButton));
    await tester.pumpAndSettle();
    expect(find.text('Cambios sin guardar'), findsOneWidget);
    expect(find.text('Tienes cambios sin guardar. ¿Salir sin guardar?'),
        findsOneWidget);

    // Cancelar: permanece en el formulario.
    await tester.tap(find.widgetWithText(TextButton, 'Cancelar'));
    await tester.pumpAndSettle();
    expect(find.byType(ClienteFormScreen), findsOneWidget);
    expect(find.text('Cambios sin guardar'), findsNothing);

    // Intentar salir de nuevo y confirmar esta vez.
    await tester.tap(find.byType(BackButton));
    await tester.pumpAndSettle();
    await tester.tap(find.widgetWithText(FilledButton, 'Confirmar'));
    await tester.pumpAndSettle();

    expect(find.byType(ClienteFormScreen), findsNothing,
        reason: 'al confirmar debe salir del formulario');
    expect(find.text('Abrir edición'), findsOneWidget);
    expect(api.ultimoPatch, isNull,
        reason: 'salir sin guardar no debe enviar nada');
  });

  testWidgets('sale sin confirmar si no hay cambios', (tester) async {
    final api = _ApiEdicionFalsa(cliente: {..._clienteBase});
    await tester.pumpWidget(
        _pantallaConFormulario(api, Client.fromJson(_clienteBase)));
    await tester.pumpAndSettle();

    await tester.tap(find.text('Abrir edición'));
    await tester.pumpAndSettle();

    await tester.tap(find.byType(BackButton));
    await tester.pumpAndSettle();

    expect(find.byType(ClienteFormScreen), findsNothing);
    expect(find.text('Cambios sin guardar'), findsNothing,
        reason: 'sin cambios no debe pedir confirmación');
  });
}
