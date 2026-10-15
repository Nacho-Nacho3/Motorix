import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:provider/provider.dart';

import 'package:motorix_client/providers/parts_provider.dart';
import 'package:motorix_client/screens/inventory/parts_list_screen.dart';
import 'package:motorix_client/services/api_client.dart';

/// ApiClient falso que replica el comportamiento del contrato de
/// `GET /api/parts` (`q`, `low=true` y `lowStockCount` global).
class _ApiAlertasFalsa extends ApiClient {
  _ApiAlertasFalsa(this.catalogo);

  final List<Map<String, dynamic>> catalogo;

  /// Para comprobar que el chip viajó como `low=true`.
  Map<String, String>? ultimaConsulta;

  @override
  Future<dynamic> get(String path, {Map<String, String>? query}) async {
    if (path.startsWith('/parts')) {
      ultimaConsulta = query;
      var lista = [...catalogo];
      if (query?['low'] == 'true') {
        lista = lista.where((part) => part['lowStock'] == true).toList();
      }
      final q = query?['q'];
      if (q != null && q.isNotEmpty) {
        lista = lista
            .where(
              (part) =>
                  (part['partCode'] as String).contains(q) ||
                  (part['name'] as String).contains(q) ||
                  (part['category'] as String).contains(q),
            )
            .toList();
      }
      return {
        'parts': lista,
        'total': lista.length,
        'lowStockCount':
            catalogo.where((part) => part['lowStock'] == true).length,
      };
    }
    return {'appointments': <Map<String, dynamic>>[]};
  }
}

Map<String, dynamic> _refaccion({
  required int id,
  required String codigo,
  required String nombre,
  required int stock,
  int minimo = 5,
}) =>
    {
      'id': id,
      'partCode': codigo,
      'name': nombre,
      'category': 'Frenos',
      'brand': 'Bosch',
      'stockCurrent': stock,
      'stockMin': minimo,
      'purchasePrice': '420.00',
      'salePrice': '850.00',
      'lowStock': stock <= minimo,
      'updatedAt': '2026-10-14T12:00:00',
    };

Widget _pantalla(ApiClient api) => MultiProvider(
      providers: [
        ChangeNotifierProvider<PartsProvider>(
          create: (_) => PartsProvider(api),
        ),
      ],
      child: MaterialApp(
        theme: ThemeData(useMaterial3: true),
        home: const PartsListScreen(),
      ),
    );

void main() {
  testWidgets('el chip «Stock bajo» filtra la lista (CA-7)', (tester) async {
    final api = _ApiAlertasFalsa([
      _refaccion(id: 1, codigo: 'BAL-001', nombre: 'Balatas traseras', stock: 4),
      _refaccion(
        id: 2,
        codigo: 'FIL-002',
        nombre: 'Filtro de aceite',
        stock: 20,
      ),
    ]);
    await tester.pumpWidget(_pantalla(api));
    await tester.pumpAndSettle();

    // Sin filtrar se ven las dos refacciones.
    expect(find.text('BAL-001'), findsOneWidget);
    expect(find.text('FIL-002'), findsOneWidget);

    final chip = find.byType(FilterChip);
    expect(chip, findsOneWidget);
    expect(tester.widget<FilterChip>(chip).selected, isFalse);

    await tester.tap(chip);
    await tester.pumpAndSettle();

    expect(tester.widget<FilterChip>(chip).selected, isTrue);
    expect(find.text('BAL-001'), findsOneWidget);
    expect(
      find.text('FIL-002'),
      findsNothing,
      reason: 'la refacción sana queda fuera con ?low=true',
    );
    expect(api.ultimaConsulta?['low'], 'true');

    // Al desactivarlo vuelve la lista completa.
    await tester.tap(chip);
    await tester.pumpAndSettle();
    expect(find.text('FIL-002'), findsOneWidget);
  });

  testWidgets('el contador muestra el número de alertas (SC-007)', (tester) async {
    await tester.pumpWidget(
      _pantalla(
        _ApiAlertasFalsa([
          _refaccion(
            id: 1,
            codigo: 'BAL-001',
            nombre: 'Balatas traseras',
            stock: 4,
          ),
          _refaccion(
            id: 2,
            codigo: 'AMO-003',
            nombre: 'Amortiguador',
            stock: 0,
            minimo: 2,
          ),
          _refaccion(
            id: 3,
            codigo: 'FIL-002',
            nombre: 'Filtro de aceite',
            stock: 20,
          ),
        ]),
      ),
    );
    await tester.pumpAndSettle();

    expect(
      find.text('Stock bajo: 2'),
      findsOneWidget,
      reason: 'el encabezado cuenta solo las refacciones en alerta',
    );
  });

  testWidgets(
    'sin alertas y con el chip activo muestra el estado vacío en español (FR-018)',
    (tester) async {
      await tester.pumpWidget(
        _pantalla(
          _ApiAlertasFalsa([
            _refaccion(
              id: 3,
              codigo: 'FIL-002',
              nombre: 'Filtro de aceite',
              stock: 20,
            ),
          ]),
        ),
      );
      await tester.pumpAndSettle();

      expect(find.text('Stock bajo: 0'), findsOneWidget);

      await tester.tap(find.byType(FilterChip));
      await tester.pumpAndSettle();

      expect(
        find.text('No hay refacciones con stock bajo.'),
        findsOneWidget,
        reason: 'el filtro activo sin resultados explica el vacío',
      );
    },
  );
}
