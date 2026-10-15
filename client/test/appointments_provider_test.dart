import 'package:flutter_test/flutter_test.dart';

import 'package:motorix_client/providers/appointments_provider.dart';
import 'package:motorix_client/services/api_client.dart';

/// ApiClient falso para citas: listado con filtros, alta y PATCH.
class _ApiCitasFalsa extends ApiClient {
  _ApiCitasFalsa({this.lista = const [], this.fallar = false});

  List<Map<String, dynamic>> lista;
  bool fallar;
  int posteos = 0;
  int patches = 0;
  Map<String, dynamic>? ultimoCuerpo;
  String? ultimoPatch;

  @override
  Future<dynamic> get(String path, {Map<String, String>? query}) async {
    if (fallar) {
      throw ApiError(
        status: 500,
        code: 'INTERNAL_ERROR',
        message: 'Error interno del servidor.',
      );
    }
    var filtrada = [...lista];
    final estado = query?['status'];
    if (estado != null && estado.isNotEmpty) {
      filtrada = filtrada.where((c) => c['status'] == estado).toList();
    }
    final fecha = query?['date'];
    if (fecha != null && fecha.isNotEmpty) {
      filtrada = filtrada.where((c) => c['date'] == fecha).toList();
    }
    return {'appointments': filtrada, 'total': filtrada.length};
  }

  @override
  Future<dynamic> post(String path, Object cuerpo) async {
    posteos += 1;
    ultimoCuerpo = Map<String, dynamic>.from(cuerpo as Map);
    if (ultimoCuerpo!['vehicleId'] == 999) {
      throw ApiError(
        status: 400,
        code: 'VEHICLE_CLIENT_MISMATCH',
        message: 'El vehículo seleccionado no pertenece al cliente indicado.',
      );
    }
    final nueva = {
      'id': lista.length + 1,
      'clientId': ultimoCuerpo!['clientId'],
      'clientName': 'Cliente de prueba',
      'vehicleId': ultimoCuerpo!['vehicleId'],
      'vehicleLabel': 'Toyota Corolla ABC1234',
      'date': ultimoCuerpo!['date'],
      'time': ultimoCuerpo!['time'],
      'reason': ultimoCuerpo!['reason'],
      'notes': ultimoCuerpo!['notes'],
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
    ultimoPatch = path;
    ultimoCuerpo = Map<String, dynamic>.from(cuerpo as Map);
    final id = int.parse(path.split('/').last);
    final indice = lista.indexWhere((c) => c['id'] == id);
    if (indice < 0) {
      throw ApiError(
        status: 404,
        code: 'APPOINTMENT_NOT_FOUND',
        message: 'La cita solicitada no existe.',
      );
    }
    lista[indice] = {
      ...lista[indice],
      ...ultimoCuerpo!,
      'updatedAt': '2026-10-14T11:00:00',
    };
    return {'appointment': lista[indice]};
  }
}

Map<String, dynamic> _cita({int id = 1, String estado = 'PENDING'}) => {
      'id': id,
      'clientId': 1,
      'clientName': 'Juan Pérez',
      'vehicleId': 1,
      'vehicleLabel': 'Toyota Corolla ABC1234',
      'date': '2026-10-20',
      'time': '09:30',
      'reason': 'Servicio de 10,000 km',
      'notes': 'Llega puntual',
      'status': estado,
      'createdAt': '2026-10-14T10:00:00',
      'updatedAt': '2026-10-14T10:00:00',
    };

void main() {
  test('la carga de citas llena la lista con sus estados', () async {
    final api = _ApiCitasFalsa(
      lista: [_cita(), _cita(id: 2, estado: 'CONFIRMED')],
    );
    final proveedor = AppointmentsProvider(api);

    await proveedor.cargar();

    expect(proveedor.citas, hasLength(2));
    expect(proveedor.total, 2);
    expect(proveedor.cargando, isFalse);
    expect(proveedor.error, isNull);
  });

  test('el filtro por estado y fecha llega al backend', () async {
    final api = _ApiCitasFalsa(
      lista: [_cita(), _cita(id: 2, estado: 'CANCELED')],
    );
    final proveedor = AppointmentsProvider(api);

    await proveedor.cargar(estado: 'CANCELED');
    expect(proveedor.citas, hasLength(1));
    expect(proveedor.citas.single.status, 'CANCELED');

    await proveedor.cargar(estado: '', fecha: '2026-10-20');
    expect(proveedor.citas, hasLength(2));
  });

  test('registrar una cita nueva la guarda en estado Pendiente', () async {
    final api = _ApiCitasFalsa();
    final proveedor = AppointmentsProvider(api);

    final error = await proveedor.registrar(
      clientId: 1,
      vehicleId: 1,
      date: '2026-10-21',
      time: '10:00',
      reason: 'Alineación',
    );

    expect(error, isNull);
    expect(api.posteos, 1);
    expect(api.ultimoCuerpo?['reason'], 'Alineación');
    expect(proveedor.citas.single.status, 'PENDING');
    expect(proveedor.citas.single.reason, 'Alineación');
  });

  test('un vehículo que no pertenece al cliente muestra el error en español',
      () async {
    final api = _ApiCitasFalsa();
    final proveedor = AppointmentsProvider(api);

    final error = await proveedor.registrar(
      clientId: 1,
      vehicleId: 999,
      date: '2026-10-21',
      time: '10:00',
      reason: 'Alineación',
    );

    expect(error, isNotNull);
    expect(error!.code, 'VEHICLE_CLIENT_MISMATCH');
    expect(
      error.message,
      'El vehículo seleccionado no pertenece al cliente indicado.',
    );
    expect(proveedor.citas, isEmpty, reason: 'no debe agregarse la cita');
  });

  test('cancelar una cita deja el estado final Cancelada', () async {
    final api = _ApiCitasFalsa(lista: [_cita()]);
    final proveedor = AppointmentsProvider(api);
    await proveedor.cargar();

    final error = await proveedor.cancelar(1);

    expect(error, isNull);
    expect(api.ultimoPatch, '/appointments/1');
    expect(api.ultimoCuerpo?['status'], 'CANCELED');
    expect(proveedor.citas.single.status, 'CANCELED');
  });

  test('un error del servidor se muestra con mensaje en español', () async {
    final api = _ApiCitasFalsa(fallar: true);
    final proveedor = AppointmentsProvider(api);

    await proveedor.cargar();

    expect(proveedor.error, 'Error interno del servidor.');
    expect(proveedor.citas, isEmpty);
    expect(proveedor.cargando, isFalse);
  });
}
