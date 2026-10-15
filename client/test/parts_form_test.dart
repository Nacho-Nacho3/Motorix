import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:provider/provider.dart';

import 'package:motorix_client/providers/parts_provider.dart';
import 'package:motorix_client/screens/inventory/part_form_screen.dart';
import 'package:motorix_client/services/api_client.dart';
import 'package:motorix_client/utils/app_route.dart';

/// ApiClient falso para el formulario de refacciones.
class _ApiRefaccionesFalsa extends ApiClient {
  int posteos = 0;
  Map<String, dynamic>? ultimoCuerpo;
  final Set<String> codigosExistentes = {'BAL-DUP'};

  @override
  Future<dynamic> get(String path, {Map<String, String>? query}) async {
    if (path.startsWith('/parts')) {
      return {
        'parts': <Map<String, dynamic>>[],
        'total': 0,
        'lowStockCount': 0,
      };
    }
    return {'appointments': <Map<String, dynamic>>[]};
  }

  @override
  Future<dynamic> post(String path, Object cuerpo) async {
    final datos = cuerpo as Map<String, dynamic>;
    if (codigosExistentes.contains(datos['partCode'])) {
      throw ApiError(
        status: 400,
        code: 'PART_CODE_DUPLICATED',
        message: 'Ese código de refacción ya está registrado.',
      );
    }
    posteos += 1;
    ultimoCuerpo = datos;
    return {
      'part': {
        'id': 9,
        ...datos,
        'brand': datos['brand'],
        'lowStock': false,
        'updatedAt': '2026-10-14T12:00:00',
      },
    };
  }
}

Widget _formulario(ApiClient api) => MultiProvider(
      providers: [
        ChangeNotifierProvider<PartsProvider>(
          create: (_) => PartsProvider(api),
        ),
      ],
      child: MaterialApp(
        theme: ThemeData(useMaterial3: true),
        home: const PartFormScreen(),
      ),
    );

/// Inicio con navegación al formulario (para probar guardado y BackButton).
class _Inicio extends StatelessWidget {
  const _Inicio();

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: Center(
        child: TextButton(
          onPressed: () => Navigator.of(context).push(
            AppRoute(builder: (_) => const PartFormScreen()),
          ),
          child: const Text('Ir al formulario'),
        ),
      ),
    );
  }
}

Widget _conNavegacion(ApiClient api) => MultiProvider(
      providers: [
        ChangeNotifierProvider<PartsProvider>(
          create: (_) => PartsProvider(api),
        ),
      ],
      child: MaterialApp(
        theme: ThemeData(useMaterial3: true),
        home: const _Inicio(),
      ),
    );

/// Orden esperado de los campos del formulario de alta.
List<Finder> _campos() => [
      find.byType(TextFormField).at(0), // Código
      find.byType(TextFormField).at(1), // Nombre
      find.byType(TextFormField).at(2), // Categoría
      find.byType(TextFormField).at(3), // Marca
      find.byType(TextFormField).at(4), // Stock inicial
      find.byType(TextFormField).at(5), // Stock mínimo
      find.byType(TextFormField).at(6), // Precio de compra
      find.byType(TextFormField).at(7), // Precio de venta
    ];

Future<void> _escribir(WidgetTester tester, int indice, String texto) async {
  final campo = _campos()[indice];
  await tester.ensureVisible(campo);
  await tester.pumpAndSettle();
  await tester.enterText(campo, texto);
}

void main() {
  testWidgets('alta válida envía código, nombre, categoría, stock y precios', (tester) async {
    final api = _ApiRefaccionesFalsa();
    await tester.pumpWidget(_conNavegacion(api));
    await tester.pumpAndSettle();

    await tester.tap(find.text('Ir al formulario'));
    await tester.pumpAndSettle();

    await _escribir(tester, 0, 'BAL-100');
    await _escribir(tester, 1, 'Balatas delanteras');
    await _escribir(tester, 2, 'Frenos');
    await _escribir(tester, 4, '12');
    await _escribir(tester, 5, '4');
    await _escribir(tester, 6, '420.00');
    await _escribir(tester, 7, '850.00');

    await tester.ensureVisible(find.byType(ElevatedButton));
    await tester.pumpAndSettle();
    await tester.tap(find.byType(ElevatedButton));
    await tester.pumpAndSettle();

    expect(api.posteos, 1, reason: 'debe enviar un solo POST /parts');
    expect(api.ultimoCuerpo, isNotNull);
    expect(api.ultimoCuerpo!['partCode'], 'BAL-100');
    expect(api.ultimoCuerpo!['name'], 'Balatas delanteras');
    expect(api.ultimoCuerpo!['category'], 'Frenos');
    expect(api.ultimoCuerpo!['stockCurrent'], 12);
    expect(api.ultimoCuerpo!['stockMin'], 4);
    expect(api.ultimoCuerpo!['purchasePrice'], '420.00');
    expect(api.ultimoCuerpo!['salePrice'], '850.00');

    expect(find.text('Refacción registrada'), findsOneWidget);
    // Volvió a la pantalla anterior tras guardar.
    expect(find.text('Ir al formulario'), findsOneWidget);
  });

  testWidgets('código duplicado muestra el mensaje en español sin perder lo escrito', (tester) async {
    final api = _ApiRefaccionesFalsa();
    await tester.pumpWidget(_formulario(api));
    await tester.pumpAndSettle();

    await _escribir(tester, 0, 'BAL-DUP');
    await _escribir(tester, 1, 'Balatas traseras');
    await _escribir(tester, 2, 'Frenos');
    await _escribir(tester, 5, '5');

    await tester.ensureVisible(find.byType(ElevatedButton));
    await tester.pumpAndSettle();
    await tester.tap(find.byType(ElevatedButton));
    await tester.pumpAndSettle();

    expect(
      find.text('Ese código de refacción ya está registrado.'),
      findsOneWidget,
    );
    // Nada se borra del formulario: los valores siguen en sus campos.
    final valores = tester
        .widgetList<EditableText>(find.byType(EditableText))
        .map((editable) => editable.controller.text)
        .toList();
    expect(
      valores,
      containsAll(<String>['BAL-DUP', 'Balatas traseras', 'Frenos', '5']),
      reason: 'todos los campos escritos conservan su valor',
    );
    expect(api.posteos, 0, reason: 'la API rechazó antes de registrar');
  });

  testWidgets('muestra los campos del formulario con sus etiquetas', (tester) async {
    await tester.pumpWidget(_formulario(_ApiRefaccionesFalsa()));
    await tester.pumpAndSettle();

    expect(find.text('Código'), findsOneWidget);
    expect(find.text('Nombre'), findsOneWidget);
    expect(find.text('Categoría'), findsOneWidget);
    expect(find.text('Marca'), findsOneWidget);
    expect(find.text('Stock inicial'), findsOneWidget);
    expect(find.text('Stock mínimo'), findsOneWidget);
    expect(find.text('Precio de compra'), findsOneWidget);
    expect(find.text('Precio de venta'), findsOneWidget);
  });

  testWidgets('la validación de campos obligatorios está en español', (tester) async {
    await tester.pumpWidget(_formulario(_ApiRefaccionesFalsa()));
    await tester.pumpAndSettle();

    await tester.ensureVisible(find.byType(ElevatedButton));
    await tester.pumpAndSettle();
    await tester.tap(find.byType(ElevatedButton));
    await tester.pumpAndSettle();

    expect(find.text('El código es obligatorio.'), findsOneWidget);
    expect(find.text('El nombre es obligatorio.'), findsOneWidget);
    expect(find.text('La categoría es obligatoria.'), findsOneWidget);
    expect(find.text('El stock mínimo es obligatorio.'), findsOneWidget);
    expect(find.text('La marca es obligatoria.'), findsNothing);
  });

  testWidgets('pide confirmación al salir con cambios sin guardar (PopScope)', (tester) async {
    await tester.pumpWidget(_conNavegacion(_ApiRefaccionesFalsa()));
    await tester.pumpAndSettle();

    await tester.tap(find.text('Ir al formulario'));
    await tester.pumpAndSettle();

    await _escribir(tester, 0, 'BAL-200');

    await tester.tap(find.byType(BackButton));
    await tester.pumpAndSettle();

    expect(find.text('Cambios sin guardar'), findsOneWidget);
  });
}
