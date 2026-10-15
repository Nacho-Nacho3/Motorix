import 'package:flutter_test/flutter_test.dart';

import 'package:motorix_client/providers/parts_provider.dart';
import 'package:motorix_client/services/api_client.dart';

/// ApiClient falso para el catálogo de refacciones.
class _ApiRefaccionesFalsa extends ApiClient {
  _ApiRefaccionesFalsa({this.lista = const [], this.conError = false});

  List<Map<String, dynamic>> lista;
  bool conError;
  int posteos = 0;
  int patcheos = 0;

  @override
  Future<dynamic> get(String path, {Map<String, String>? query}) async {
    if (conError) {
      throw ApiError(
        status: 500,
        code: 'INTERNAL_ERROR',
        message: 'Error interno del servidor.',
      );
    }
    var filtrada = [...lista];
    final buscado = query?['q'];
    if (buscado != null && buscado.isNotEmpty) {
      filtrada = filtrada
          .where(
            (part) =>
                (part['partCode'] as String)
                    .toLowerCase()
                    .contains(buscado.toLowerCase()) ||
                (part['name'] as String)
                    .toLowerCase()
                    .contains(buscado.toLowerCase()) ||
                (part['category'] as String)
                    .toLowerCase()
                    .contains(buscado.toLowerCase()),
          )
          .toList();
    }
    final bajos = filtrada.where((part) => part['lowStock'] == true).length;
    return {
      'parts': filtrada,
      'total': filtrada.length,
      'lowStockCount': bajos,
    };
  }

  @override
  Future<dynamic> post(String path, Object cuerpo) async {
    final datos = cuerpo as Map<String, dynamic>;
    posteos += 1;
    final registro = <String, dynamic>{
      'id': lista.length + 1,
      'partCode': datos['partCode'],
      'name': datos['name'],
      'category': datos['category'],
      'brand': datos['brand'],
      'stockCurrent': datos['stockCurrent'] ?? 0,
      'stockMin': datos['stockMin'],
      'purchasePrice': datos['purchasePrice'] ?? '0.00',
      'salePrice': datos['salePrice'] ?? '0.00',
      'lowStock':
          (datos['stockCurrent'] ?? 0) as int <= (datos['stockMin'] as int),
      'updatedAt': '2026-10-14T12:00:00',
    };
    lista = [...lista, registro];
    return {'part': registro};
  }

  @override
  Future<dynamic> patch(String path, Object cuerpo) async {
    final datos = cuerpo as Map<String, dynamic>;
    patcheos += 1;
    final id = int.parse(path.split('/').last);
    final actualizada = <String, dynamic>{};
    for (final parte in lista) {
      if (parte['id'] == id) {
        actualizada
          ..addAll(parte)
          ..addAll(datos);
        actualizada['updatedAt'] = '2026-10-14T13:00:00';
      }
    }
    lista = [
      for (final parte in lista)
        if (parte['id'] == id) actualizada else parte,
    ];
    return {'part': actualizada};
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

void main() {
  test('carga el catálogo con su total y el contador de stock bajo', () async {
    final api = _ApiRefaccionesFalsa(
      lista: [_refaccion(), _refaccion(id: 2, codigo: 'FIL-002', stock: 20, minimo: 5)],
    );
    final proveedor = PartsProvider(api);

    await proveedor.cargar();

    expect(proveedor.refacciones, hasLength(2));
    expect(proveedor.total, 2);
    expect(proveedor.totalStockBajo, 1);
    expect(proveedor.cargando, isFalse);
    expect(proveedor.error, isNull);
  });

  test('crear hace aparecer la refacción en el catálogo de inmediato', () async {
    final api = _ApiRefaccionesFalsa();
    final proveedor = PartsProvider(api);

    final error = await proveedor.crear(
      partCode: 'BAL-100',
      name: 'Balatas delanteras',
      category: 'Frenos',
      stockMin: 4,
      stockCurrent: 12,
      purchasePrice: '420.00',
      salePrice: '850.00',
    );

    expect(error, isNull);
    expect(api.posteos, 1);
    expect(proveedor.refacciones, hasLength(1));
    expect(proveedor.refacciones.first.partCode, 'BAL-100');
    expect(proveedor.refacciones.first.stockCurrent, 12);
  });

  test('editar actualiza la refacción en la lista', () async {
    final api = _ApiRefaccionesFalsa(lista: [_refaccion()]);
    final proveedor = PartsProvider(api);

    final error = await proveedor.editar(
      id: 1,
      name: 'Balatas traseras reforzadas',
      category: 'Frenos',
      stockMin: 8,
      purchasePrice: '430.50',
      salePrice: '900.00',
    );

    expect(error, isNull);
    expect(api.patcheos, 1);
    expect(proveedor.refacciones.single.name, 'Balatas traseras reforzadas');
    expect(proveedor.refacciones.single.stockMin, 8);
    // El código y el stock no se tocan desde el formulario de edición.
    expect(proveedor.refacciones.single.partCode, 'BAL-001');
    expect(proveedor.refacciones.single.stockCurrent, 4);
  });

  test('un error del servidor deja el mensaje en español', () async {
    final proveedor = PartsProvider(_ApiRefaccionesFalsa(conError: true));

    await proveedor.cargar();

    expect(proveedor.error, 'Error interno del servidor.');
    expect(proveedor.cargando, isFalse);
    expect(proveedor.refacciones, isEmpty);
  });

  test('sin refacciones la lista queda vacía con total y contador en cero', () async {
    final proveedor = PartsProvider(_ApiRefaccionesFalsa());

    await proveedor.cargar();

    expect(proveedor.refacciones, isEmpty);
    expect(proveedor.total, 0);
    expect(proveedor.totalStockBajo, 0);
    expect(proveedor.error, isNull);
  });
}
