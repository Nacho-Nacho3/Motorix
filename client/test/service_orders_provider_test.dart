import 'package:flutter_test/flutter_test.dart';

import 'package:motorix_client/providers/service_orders_provider.dart';
import 'package:motorix_client/services/api_client.dart';

/// ApiClient falso para órdenes: listado con filtros, alta, edición y
/// mecánicos.
class _ApiOrdenesFalsa extends ApiClient {
  _ApiOrdenesFalsa({this.lista = const [], this.fallar = false});

  List<Map<String, dynamic>> lista;
  bool fallar;
  int posteos = 0;
  Map<String, dynamic>? ultimoCuerpo;

  @override
  Future<dynamic> get(String path, {Map<String, String>? query}) async {
    if (fallar) {
      throw ApiError(
        status: 500,
        code: 'INTERNAL_ERROR',
        message: 'Error interno del servidor.',
      );
    }
    if (path.startsWith('/service-orders/mechanics')) {
      return {
        'mechanics': [
          {'id': 3, 'name': 'Mecánico Demo', 'username': 'mecanico'},
        ],
      };
    }
    var filtrada = [...lista];
    final estado = query?['status'];
    if (estado != null && estado.isNotEmpty) {
      filtrada = filtrada.where((o) => o['status'] == estado).toList();
    }
    final q = query?['q'];
    if (q != null && q.isNotEmpty) {
      filtrada = filtrada
          .where((o) =>
              (o['clientName'] as String)
                  .toLowerCase()
                  .contains(q.toLowerCase()) ||
              (o['vehicleLabel'] as String)
                  .toLowerCase()
                  .contains(q.toLowerCase()))
          .toList();
    }
    return {'orders': filtrada, 'total': filtrada.length};
  }

  @override
  Future<dynamic> post(String path, Object cuerpo) async {
    posteos += 1;
    ultimoCuerpo = Map<String, dynamic>.from(cuerpo as Map);
    // Simula un vehículo con 85,000 km previos:80,000 siempre es menor.
    if (ultimoCuerpo!['entryMileage'] == 80000) {
      throw ApiError(
        status: 400,
        code: 'MILEAGE_LOWER_THAN_PREVIOUS',
        message:
            'El kilometraje de entrada no puede ser menor que el registrado previamente.',
      );
    }
    final nueva = {
      'id': lista.length + 1,
      'clientId': ultimoCuerpo!['clientId'],
      'clientName': 'Juan Pérez',
      'vehicleId': ultimoCuerpo!['vehicleId'],
      'vehicleLabel': 'Toyota Corolla ABC1234',
      'mechanicId': ultimoCuerpo!['mechanicId'],
      'mechanicName': 'Mecánico Demo',
      'status': 'RECEIVED',
      'entryMileage': ultimoCuerpo!['entryMileage'],
      'reportedProblem': ultimoCuerpo!['reportedProblem'],
      'createdAt': '2026-10-14T10:30:00',
      'updatedAt': '2026-10-14T10:30:00',
    };
    lista = [...lista, nueva];
    return {'order': nueva};
  }

  @override
  Future<dynamic> patch(String path, Object cuerpo) async {
    final datos = Map<String, dynamic>.from(cuerpo as Map);
    final id = int.parse(path.split('/').last);
    final indice = lista.indexWhere((o) => o['id'] == id);
    final actualizada = [...lista];
    actualizada[indice] = {
      ...actualizada[indice],
      ...datos,
      'updatedAt': '2026-10-14T11:00:00',
    };
    lista = actualizada;
    return {'order': lista[indice]};
  }
}

Map<String, dynamic> _orden({int id = 1, String estado = 'RECEIVED'}) => {
      'id': id,
      'clientId': 1,
      'clientName': 'Juan Pérez',
      'vehicleId': 1,
      'vehicleLabel': 'Toyota Corolla ABC1234',
      'mechanicId': 3,
      'mechanicName': 'Mecánico Demo',
      'status': estado,
      'entryMileage': 86000,
      'reportedProblem': 'Ruido al frenar',
      'createdAt': '2026-10-14T10:30:00',
      'updatedAt': '2026-10-14T10:30:00',
    };

void main() {
  test('la carga de órdenes llena la lista con sus estados', () async {
    final api = _ApiOrdenesFalsa(
      lista: [_orden(), _orden(id: 2, estado: 'DIAGNOSIS')],
    );
    final proveedor = ServiceOrdersProvider(api);

    await proveedor.cargar();

    expect(proveedor.ordenes, hasLength(2));
    expect(proveedor.total, 2);
    expect(proveedor.cargando, isFalse);
    expect(proveedor.error, isNull);
    expect(proveedor.ordenes.first.etiquetaEstado, 'Recibido');
  });

  test('el filtro por estado llega al backend', () async {
    final api = _ApiOrdenesFalsa(
      lista: [_orden(), _orden(id: 2, estado: 'DIAGNOSIS')],
    );
    final proveedor = ServiceOrdersProvider(api);

    await proveedor.cargar(estado: 'DIAGNOSIS');

    expect(proveedor.ordenes, hasLength(1));
    expect(proveedor.ordenes.single.status, 'DIAGNOSIS');
  });

  test('crear una orden nueva la guarda en estado Recibido', () async {
    final api = _ApiOrdenesFalsa();
    final proveedor = ServiceOrdersProvider(api);

    final error = await proveedor.registrar(
      clientId: 1,
      vehicleId: 1,
      mechanicId: 3,
      entryMileage: 86000,
      reportedProblem: 'Ruido al frenar',
    );

    expect(error, isNull);
    expect(api.posteos, 1);
    expect(api.ultimoCuerpo?['mechanicId'], 3);
    expect(proveedor.ordenes.single.status, 'RECEIVED');
  });

  test(
      'un kilometraje menor que el previo muestra el error en español '
      '(MILEAGE_LOWER_THAN_PREVIOUS)', () async {
    final api = _ApiOrdenesFalsa();
    final proveedor = ServiceOrdersProvider(api);

    final error = await proveedor.registrar(
      clientId: 1,
      vehicleId: 1,
      mechanicId: 3,
      entryMileage: 80000,
      reportedProblem: 'Ruido al frenar',
    );

    expect(error, isNotNull);
    expect(error!.code, 'MILEAGE_LOWER_THAN_PREVIOUS');
    expect(
      error.message,
      'El kilometraje de entrada no puede ser menor que el registrado previamente.',
    );
    expect(proveedor.ordenes, isEmpty, reason: 'no debe agregarse la orden');
  });

  test('la lista de mecánicos activos se carga para el selector', () async {
    final api = _ApiOrdenesFalsa();
    final proveedor = ServiceOrdersProvider(api);

    await proveedor.cargarMecanicos();

    expect(proveedor.mecanicos, hasLength(1));
    expect(proveedor.mecanicos.single.name, 'Mecánico Demo');
    expect(proveedor.mecanicos.single.username, 'mecanico');
  });

  test('un error del servidor se muestra con mensaje en español', () async {
    final api = _ApiOrdenesFalsa(fallar: true);
    final proveedor = ServiceOrdersProvider(api);

    await proveedor.cargar();

    expect(proveedor.error, 'Error interno del servidor.');
    expect(proveedor.ordenes, isEmpty);
    expect(proveedor.cargando, isFalse);
  });
}
