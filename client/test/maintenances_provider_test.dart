import 'package:flutter_test/flutter_test.dart';

import 'package:motorix_client/providers/maintenances_provider.dart';
import 'package:motorix_client/services/api_client.dart';

/// ApiClient falso para mantenimientos: listado, alta y errores simulados.
class _ApiMantenimientosFalsa extends ApiClient {
  _ApiMantenimientosFalsa({this.lista = const [], this.conError = false});

  List<Map<String, dynamic>> lista;
  bool conError;
  int posteos = 0;
  Map<String, dynamic>? ultimoCuerpo;

  @override
  Future<dynamic> get(String path, {Map<String, String>? query}) async {
    if (conError) {
      throw ApiError(
        status: 500,
        code: 'INTERNAL_ERROR',
        message: 'Error interno del servidor.',
      );
    }
    return {'maintenances': [...lista], 'total': lista.length};
  }

  @override
  Future<dynamic> post(String path, Object cuerpo) async {
    final datos = cuerpo as Map<String, dynamic>;
    if (datos['vehicleId'] == null) {
      throw ApiError(
        status: 400,
        code: 'VEHICLE_REQUIRED',
        message: 'Debes seleccionar un vehículo.',
      );
    }
    if (datos['nextDueDate'] == null && datos['nextDueMileage'] == null) {
      throw ApiError(
        status: 400,
        code: 'MAINTENANCE_TARGET_REQUIRED',
        message:
            'Debes indicar la fecha o el kilometraje del próximo mantenimiento.',
      );
    }
    posteos += 1;
    ultimoCuerpo = datos;
    final registro = <String, dynamic>{
      'id': lista.length + 1,
      'vehicleId': datos['vehicleId'],
      'vehicleLabel': 'Toyota Corolla ABC1234',
      'clientName': 'Juan Pérez',
      'nextDueDate': datos['nextDueDate'],
      'nextDueMileage': datos['nextDueMileage'],
      'warnDays': datos['warnDays'] ?? 30,
      'warnKm': datos['warnKm'] ?? 500,
      'recommendations': datos['recommendations'],
      'state': 'UPCOMING',
      'daysRemaining': 10,
      'mileageRemaining': 150,
      'registeredBy': 1,
      'updatedAt': '2026-10-14 10:00:00',
    };
    lista = [...lista, registro];
    return {'maintenance': registro};
  }
}

const _registro = {
  'id': 7,
  'vehicleId': 3,
  'vehicleLabel': 'Nissan Versa KLM5678',
  'clientName': 'María López',
  'nextDueDate': '2026-11-01',
  'nextDueMileage': 60000,
  'warnDays': 30,
  'warnKm': 500,
  'recommendations': 'Cambio de aceite',
  'state': 'UPCOMING',
  'daysRemaining': 18,
  'mileageRemaining': 400,
  'registeredBy': 1,
  'updatedAt': '2026-10-14 10:00:00',
};

void main() {
  test('carga la lista de mantenimientos con su total', () async {
    final api = _ApiMantenimientosFalsa(lista: [_registro]);
    final proveedor = MaintenancesProvider(api);

    await proveedor.cargar();

    expect(proveedor.mantenimientos, hasLength(1));
    expect(proveedor.total, 1);
    expect(proveedor.mantenimientos.first.vehicleId, 3);
    expect(proveedor.cargando, isFalse);
    expect(proveedor.error, isNull);
  });

  test('crear hace aparecer el registro de inmediato en la lista (SC-002)', () async {
    final api = _ApiMantenimientosFalsa();
    final proveedor = MaintenancesProvider(api);

    final error = await proveedor.crear(
      vehicleId: 1,
      nextDueDate: '2026-11-24',
      nextDueMileage: 50000,
    );

    expect(error, isNull);
    expect(api.posteos, 1);
    expect(proveedor.mantenimientos, hasLength(1));
    expect(proveedor.mantenimientos.first.vehicleId, 1);
  });

  test('MAINTENANCE_TARGET_REQUIRED devuelve el mensaje en español', () async {
    final api = _ApiMantenimientosFalsa();
    final proveedor = MaintenancesProvider(api);

    final error = await proveedor.crear(vehicleId: 1);

    expect(error, isNotNull);
    expect(error!.code, 'MAINTENANCE_TARGET_REQUIRED');
    expect(
      error.message,
      'Debes indicar la fecha o el kilometraje del próximo mantenimiento.',
    );
    // No se pierde el estado: la lista sigue intacta y el proveedor legible.
    expect(proveedor.mantenimientos, isEmpty);
    expect(proveedor.error, isNull);
    expect(api.posteos, 0);
  });

  test('un error del servidor deja el mensaje en español y corta el cargando', () async {
    final proveedor = MaintenancesProvider(_ApiMantenimientosFalsa(conError: true));

    await proveedor.cargar();

    expect(proveedor.error, 'Error interno del servidor.');
    expect(proveedor.cargando, isFalse);
    expect(proveedor.mantenimientos, isEmpty);
  });

  test('sin registros la lista queda vacía con total en cero', () async {
    final proveedor = MaintenancesProvider(_ApiMantenimientosFalsa());

    await proveedor.cargar();

    expect(proveedor.mantenimientos, isEmpty);
    expect(proveedor.total, 0);
    expect(proveedor.error, isNull);
  });
}
