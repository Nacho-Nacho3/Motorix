import 'package:flutter/foundation.dart';

import '../models/client.dart';
import '../models/vehicle.dart';
import '../services/api_client.dart';

/// Estado de la lista de vehículos y del alta con propietario (US3).
class VehiclesProvider extends ChangeNotifier {
  VehiclesProvider(this.api);

  final ApiClient api;

  List<Vehicle> vehiculos = [];
  int total = 0;
  bool cargando = true;
  String? error;
  String busqueda = '';
  int? filtroClienteId;

  /// Propietarios disponibles para el selector del formulario.
  List<Client> propietarios = [];
  bool cargandoPropietarios = false;

  Future<void> cargar({String? q, int? clientId}) async {
    if (q != null) busqueda = q;
    if (clientId != null) filtroClienteId = clientId;
    cargando = true;
    error = null;
    notifyListeners();

    try {
      final datos = await ApiClient.conRed(
        () => api.get('/vehicles', query: {
          if (busqueda.isNotEmpty) 'q': busqueda,
          if (filtroClienteId != null) 'clientId': '$filtroClienteId',
        }),
      ) as Map<String, dynamic>;

      vehiculos = (datos['vehicles'] as List)
          .map((item) => Vehicle.fromJson(item as Map<String, dynamic>))
          .toList();
      total = (datos['total'] as num?)?.toInt() ?? vehiculos.length;
    } on ApiError catch (e) {
      error = e.message;
    } finally {
      cargando = false;
      notifyListeners();
    }
  }

  /// Cambia solo el filtro por propietario.
  Future<void> filtrarPorCliente(int? clientId) => cargar(clientId: clientId);

  /// Carga los clientes para el selector de propietario del formulario.
  Future<void> cargarPropietarios() async {
    if (cargandoPropietarios || propietarios.isNotEmpty) return;
    cargandoPropietarios = true;
    notifyListeners();

    try {
      final datos = await ApiClient.conRed(
        () => api.get('/clients', query: {'limit': '100'}),
      ) as Map<String, dynamic>;

      propietarios = (datos['clients'] as List)
          .map((item) => Client.fromJson(item as Map<String, dynamic>))
          .toList();
    } on ApiError {
      // El formulario muestra el estado vacío del selector.
      propietarios = [];
    } finally {
      cargandoPropietarios = false;
      notifyListeners();
    }
  }

  /// Da de alta un vehículo. Devuelve `null` si salió bien o el error de la API
  /// (por ejemplo 409 DUPLICATE_PLATE, que el formulario muestra al usuario).
  Future<ApiError?> registrar({
    required int clientId,
    required String brand,
    required String model,
    required int year,
    required String licensePlate,
    String? vin,
    required int currentMileage,
  }) async {
    try {
      await ApiClient.conRed(
        () => api.post('/vehicles', {
          'clientId': clientId,
          'brand': brand,
          'model': model,
          'year': year,
          'licensePlate': licensePlate,
          if (vin != null && vin.isNotEmpty) 'vin': vin,
          'currentMileage': currentMileage,
        }),
      );
      await cargar();
      return null;
    } on ApiError catch (e) {
      return e;
    }
  }

  /// Edita un vehículo existente (kilometraje, datos, placas).
  Future<ApiError?> editar({
    required int id,
    required String brand,
    required String model,
    required int year,
    required String licensePlate,
    String? vin,
    required int currentMileage,
  }) async {
    try {
      await ApiClient.conRed(
        () => api.patch('/vehicles/$id', {
          'brand': brand,
          'model': model,
          'year': year,
          'licensePlate': licensePlate,
          if (vin != null && vin.isNotEmpty) 'vin': vin,
          'currentMileage': currentMileage,
        }),
      );
      await cargar();
      return null;
    } on ApiError catch (e) {
      return e;
    }
  }
}
