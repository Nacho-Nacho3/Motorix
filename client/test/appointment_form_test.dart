import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:provider/provider.dart';

import 'package:motorix_client/providers/appointments_provider.dart';
import 'package:motorix_client/providers/vehicles_provider.dart';
import 'package:motorix_client/screens/appointments/appointment_form_screen.dart';
import 'package:motorix_client/screens/appointments/appointment_list_screen.dart';
import 'package:motorix_client/services/api_client.dart';

/// ApiClient falso para el listado y el formulario de citas.
class _ApiCitasFalsa extends ApiClient {
  _ApiCitasFalsa({this.lista = const []});

  List<Map<String, dynamic>> lista;
  int patches = 0;
  Map<String, dynamic>? ultimoCuerpo;

  @override
  Future<dynamic> get(String path, {Map<String, String>? query}) async {
    if (path.startsWith('/clients')) {
      return {
        'clients': <Map<String, dynamic>>[],
        'total': 0,
      };
    }
    if (path.startsWith('/vehicles')) {
      return {
        'vehicles': <Map<String, dynamic>>[],
        'total': 0,
      };
    }
    return {'appointments': lista, 'total': lista.length};
  }

  @override
  Future<dynamic> post(String path, Object cuerpo) async {
    final datos = Map<String, dynamic>.from(cuerpo as Map);
    final nueva = {
      'id': lista.length + 1,
      'clientId': datos['clientId'],
      'clientName': 'Cliente de prueba',
      'vehicleId': datos['vehicleId'],
      'vehicleLabel': 'Toyota Corolla ABC1234',
      'date': datos['date'],
      'time': datos['time'],
      'reason': datos['reason'],
      'notes': datos['notes'],
      'status': 'PENDING',
      'createdAt': '2026-10-14T10:00:00',
      'updatedAt': '2026-10-14T10:00:00',
    };
    lista = [...lista, nueva];
    return {'appointment': nueva};
  }

  @override
  Future<dynamic> patch(String path, Object cuerpo) async {
    patches += 1;
    ultimoCuerpo = Map<String, dynamic>.from(cuerpo as Map);
    final id = int.parse(path.split('/').last);
    final indice = lista.indexWhere((c) => c['id'] == id);
    // La lista inicial puede ser const: se reemplaza en lugar de mutarla.
    final actualizada = [...lista];
    actualizada[indice] = {...actualizada[indice], ...ultimoCuerpo!};
    lista = actualizada;
    return {'appointment': lista[indice]};
  }
}

const _citaPendiente = {
  'id': 1,
  'clientId': 1,
  'clientName': 'Juan Pérez',
  'vehicleId': 1,
  'vehicleLabel': 'Toyota Corolla ABC1234',
  'date': '2026-10-20',
  'time': '09:30',
  'reason': 'Servicio de 10,000 km',
  'notes': 'Llega puntual',
  'status': 'PENDING',
  'createdAt': '2026-10-14T10:00:00',
  'updatedAt': '2026-10-14T10:00:00',
};

Widget _pantalla(_ApiCitasFalsa api) => MultiProvider(
      providers: [
        ChangeNotifierProvider<AppointmentsProvider>(
          create: (_) => AppointmentsProvider(api),
        ),
        ChangeNotifierProvider<VehiclesProvider>(
          create: (_) => VehiclesProvider(api),
        ),
      ],
      child: MaterialApp(
        theme: ThemeData(useMaterial3: true),
        home: const AppointmentListScreen(),
      ),
    );

void main() {
  testWidgets('la validación muestra los campos obligatorios en español',
      (tester) async {
    final api = _ApiCitasFalsa();
    await tester.pumpWidget(_pantalla(api));
    await tester.pumpAndSettle();

    await tester.tap(find.byType(FloatingActionButton));
    await tester.pumpAndSettle();
    expect(find.byType(AppointmentFormScreen), findsOneWidget);

    final boton = find.widgetWithText(ElevatedButton, 'Agendar');
    await tester.ensureVisible(boton);
    await tester.pumpAndSettle();
    await tester.tap(boton);
    await tester.pump();

    expect(find.text('La fecha es obligatoria.'), findsOneWidget);
    expect(find.text('La hora es obligatoria.'), findsOneWidget);
    expect(find.text('El motivo es obligatorio.'), findsOneWidget);
  });

  testWidgets(
      'la cancelación pide confirmación con Confirmar y deja Cancelada',
      (tester) async {
    final api = _ApiCitasFalsa(lista: const [_citaPendiente]);
    await tester.pumpWidget(_pantalla(api));
    await tester.pumpAndSettle();

    expect(find.text('Pendiente'), findsOneWidget);

    await tester.tap(find.byTooltip('Cancelar cita'));
    await tester.pumpAndSettle();

    expect(find.text('Cancelar cita'), findsOneWidget);
    expect(find.text('¿Cancelar la cita de Juan Pérez?'), findsOneWidget);

    await tester.tap(find.widgetWithText(FilledButton, 'Confirmar'));
    await tester.pumpAndSettle();

    expect(api.patches, 1);
    expect(api.ultimoCuerpo?['status'], 'CANCELED');
    expect(find.text('Cancelada'), findsOneWidget);
    expect(find.text('Cita cancelada'), findsOneWidget);

    // Deja expirar el snackbar para no dejar temporizadores pendientes.
    await tester.pump(const Duration(seconds: 5));
    await tester.pumpAndSettle();
  });
}
