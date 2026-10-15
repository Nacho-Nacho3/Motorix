import 'package:data_table_2/data_table_2.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:provider/provider.dart';

import 'package:motorix_client/providers/parts_provider.dart';
import 'package:motorix_client/screens/inventory/parts_list_screen.dart';
import 'package:motorix_client/services/api_client.dart';
import 'package:motorix_client/utils/app_theme.dart';

/// ApiClient falso para el catálogo con stock de prueba.
class _ApiRefaccionesFalsa extends ApiClient {
  _ApiRefaccionesFalsa({this.lista = const []});

  List<Map<String, dynamic>> lista;

  @override
  Future<dynamic> get(String path, {Map<String, String>? query}) async {
    if (path.startsWith('/parts')) {
      final bajos = lista.where((part) => part['lowStock'] == true).length;
      return {
        'parts': lista,
        'total': lista.length,
        'lowStockCount': bajos,
      };
    }
    return {'appointments': <Map<String, dynamic>>[]};
  }
}

Map<String, dynamic> _refaccion({
  int id = 1,
  String codigo = 'BAL-001',
  String nombre = 'Balatas traseras',
  int stock = 4,
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
  testWidgets(
    'la lista muestra el stock actual, el stock mínimo y «Stock bajo» (CA-4, FR-014)',
    (tester) async {
      await tester.pumpWidget(
        _pantalla(_ApiRefaccionesFalsa(lista: [_refaccion()])),
      );
      await tester.pumpAndSettle();

      expect(find.text('Stock actual'), findsOneWidget);
      expect(find.text('Stock mínimo'), findsOneWidget);

      // La píldora vive dentro de la tabla: el chip del encabezado (T076,
      // US8) también se llama «Stock bajo» y no debe confundirse con ella.
      final pildora = find.descendant(
        of: find.byType(DataTable2),
        matching: find.text('Stock bajo'),
      );
      expect(pildora, findsOneWidget);

      // El token de color de alerta es el ámbar del sistema de diseño.
      expect(tester.widget<Text>(pildora).style?.color, AppColors.warning);
    },
  );

  testWidgets(
    'con stock suficiente no aparece la etiqueta «Stock bajo»',
    (tester) async {
      await tester.pumpWidget(
        _pantalla(
          _ApiRefaccionesFalsa(
            lista: [
              _refaccion(
                id: 2,
                codigo: 'FIL-002',
                nombre: 'Filtro de aceite',
                stock: 20,
              ),
            ],
          ),
        ),
      );
      await tester.pumpAndSettle();

      // Sin píldora de alerta en la tabla (el chip del encabezado no cuenta).
      final pildora = find.descendant(
        of: find.byType(DataTable2),
        matching: find.text('Stock bajo'),
      );
      expect(pildora, findsNothing);
      expect(find.text('Disponible'), findsOneWidget);
    },
  );

  testWidgets(
    'el estado vacío muestra el mensaje en español (FR-018)',
    (tester) async {
      await tester.pumpWidget(_pantalla(_ApiRefaccionesFalsa()));
      await tester.pumpAndSettle();

      expect(
        find.text('Aún no hay refacciones registradas.'),
        findsOneWidget,
      );
    },
  );
}
