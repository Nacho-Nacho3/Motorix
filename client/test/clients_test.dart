import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:provider/provider.dart';

import 'package:motorix_client/providers/clients_provider.dart';
import 'package:motorix_client/screens/clients/client_form_screen.dart';
import 'package:motorix_client/screens/clients/client_list_screen.dart';
import 'package:motorix_client/services/api_client.dart';

/// ApiClient falso para clientes: lista, búsqueda, alta y teléfono duplicado.
class _ApiClientesFalsa extends ApiClient {
  _ApiClientesFalsa({this.lista = const []});

  List<Map<String, dynamic>> lista;
  String? ultimaBusqueda;
  Map<String, dynamic>? ultimoCuerpo;
  int posteos = 0;
  bool primerPostDuplicado = false;

  @override
  Future<dynamic> get(String path, {Map<String, String>? query}) async {
    ultimaBusqueda = query?['q'];
    var filtrada = lista;
    final q = query?['q'];
    if (q != null && q.isNotEmpty) {
      filtrada = lista
          .where((cliente) =>
              (cliente['name'] as String).toLowerCase().contains(q.toLowerCase()))
          .toList();
    }
    return {'clients': filtrada, 'total': filtrada.length};
  }

  @override
  Future<dynamic> post(String path, Object cuerpo) async {
    posteos += 1;
    ultimoCuerpo = Map<String, dynamic>.from(cuerpo as Map);
    final confirmado = ultimoCuerpo!['confirmDuplicatePhone'] == true;

    if (primerPostDuplicado && !confirmado) {
      throw ApiError(
        status: 409,
        code: 'DUPLICATE_PHONE',
        message:
            'Ya existe un cliente con ese teléfono. Confirma para guardar de todos modos.',
      );
    }

    final nuevo = {
      'id': lista.length + 1,
      'name': ultimoCuerpo!['name'],
      'phone': ultimoCuerpo!['phone'],
      'email': ultimoCuerpo!['email'],
      'active': true,
      'createdAt': '2026-10-13T10:00:00',
      'vehicleCount': 0,
    };
    lista = [...lista, nuevo];
    return {'client': nuevo};
  }
}

const _juan = {
  'id': 1,
  'name': 'Juan Pérez',
  'phone': '5512345678',
  'email': 'juan@correo.mx',
  'active': true,
  'createdAt': '2026-10-13T10:00:00',
  'vehicleCount': 2,
};

const _maria = {
  'id': 2,
  'name': 'María López',
  'phone': '5523456789',
  'email': 'maria@correo.mx',
  'active': true,
  'createdAt': '2026-10-13T11:00:00',
  'vehicleCount': 0,
};

Widget _pantallaListado(_ApiClientesFalsa api) =>
    ChangeNotifierProvider<ClientsProvider>(
      create: (_) => ClientsProvider(api),
      child: MaterialApp(
        theme: ThemeData(useMaterial3: true),
        home: const ClientesListScreen(),
      ),
    );

void main() {
  testWidgets('el listado muestra los clientes con sus datos', (tester) async {
    final api = _ApiClientesFalsa(lista: const [_juan, _maria]);
    await tester.pumpWidget(_pantallaListado(api));
    await tester.pumpAndSettle();

    expect(find.text('Juan Pérez'), findsOneWidget);
    expect(find.text('María López'), findsOneWidget);
    expect(find.text('5512345678 · juan@correo.mx'), findsOneWidget);
    expect(find.text('2 vehículos'), findsOneWidget);
    expect(find.text('0 vehículos'), findsOneWidget);
  });

  testWidgets('la búsqueda filtra la lista después del retardo', (tester) async {
    final api = _ApiClientesFalsa(lista: const [_juan, _maria]);
    await tester.pumpWidget(_pantallaListado(api));
    await tester.pumpAndSettle();

    await tester.enterText(find.byType(TextField).first, 'juan');
    await tester.pump(const Duration(milliseconds: 400));
    await tester.pumpAndSettle();

    expect(api.ultimaBusqueda, 'juan');
    expect(find.text('Juan Pérez'), findsOneWidget);
    expect(find.text('María López'), findsNothing);
  });

  testWidgets('el alta valida los campos obligatorios en español', (tester) async {
    final api = _ApiClientesFalsa();
    await tester.pumpWidget(_pantallaListado(api));
    await tester.pumpAndSettle();

    await tester.tap(find.byType(FloatingActionButton));
    await tester.pumpAndSettle();
    expect(find.byType(ClienteFormScreen), findsOneWidget);

    await tester.tap(find.widgetWithText(ElevatedButton, 'Registrar'));
    await tester.pump();

    expect(find.text('El nombre es obligatorio.'), findsOneWidget);
    expect(find.text('El teléfono es obligatorio.'), findsOneWidget);
    expect(find.text('El correo es obligatorio.'), findsOneWidget);
    expect(api.posteos, 0, reason: 'no debe enviar nada si la validación falla');
  });

  testWidgets('el alta exitosa registra el cliente y vuelve al listado',
      (tester) async {
    final api = _ApiClientesFalsa();
    await tester.pumpWidget(_pantallaListado(api));
    await tester.pumpAndSettle();

    await tester.tap(find.byType(FloatingActionButton));
    await tester.pumpAndSettle();

    await tester.enterText(find.byType(TextFormField).at(0), 'Carlos Ruiz');
    await tester.enterText(find.byType(TextFormField).at(1), '5533445566');
    await tester.enterText(find.byType(TextFormField).at(2), 'carlos@correo.mx');
    await tester.tap(find.widgetWithText(ElevatedButton, 'Registrar'));
    await tester.pumpAndSettle();

    expect(api.posteos, 1);
    expect(api.ultimoCuerpo?['name'], 'Carlos Ruiz');
    expect(find.byType(ClienteFormScreen), findsNothing,
        reason: 'debe volver al listado');
    expect(find.text('Carlos Ruiz'), findsOneWidget);

    // Deja expirar el snackbar para no dejar temporizadores pendientes.
    await tester.pump(const Duration(seconds: 5));
    await tester.pumpAndSettle();
  });

  testWidgets(
      'un teléfono repetido muestra confirmación y reintenta con confirmDuplicatePhone',
      (tester) async {
    final api = _ApiClientesFalsa()..primerPostDuplicado = true;
    await tester.pumpWidget(_pantallaListado(api));
    await tester.pumpAndSettle();

    await tester.tap(find.byType(FloatingActionButton));
    await tester.pumpAndSettle();

    await tester.enterText(find.byType(TextFormField).at(0), 'Otra Persona');
    await tester.enterText(find.byType(TextFormField).at(1), '5512345678');
    await tester.enterText(find.byType(TextFormField).at(2), 'otra@correo.mx');
    await tester.tap(find.widgetWithText(ElevatedButton, 'Registrar'));
    await tester.pumpAndSettle();

    expect(find.text('Teléfono repetido'), findsOneWidget);
    expect(
      find.text('Ya existe un cliente con ese teléfono. ¿Guardar de todos modos?'),
      findsOneWidget,
    );

    await tester.tap(find.widgetWithText(FilledButton, 'Confirmar'));
    await tester.pumpAndSettle();

    expect(api.posteos, 2, reason: 'debe reintentar una sola vez');
    expect(api.ultimoCuerpo?['confirmDuplicatePhone'], isTrue);
    expect(find.byType(ClienteFormScreen), findsNothing,
        reason: 'debe volver al listado tras confirmar');
    expect(find.text('Otra Persona'), findsOneWidget);

    await tester.pump(const Duration(seconds: 5));
    await tester.pumpAndSettle();
  });
}
