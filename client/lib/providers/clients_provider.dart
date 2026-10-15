import 'package:flutter/foundation.dart';

import '../models/client.dart';
import '../models/vehicle.dart';
import '../services/api_client.dart';

/// Estado de la lista y la ficha de clientes (US2).
class ClientsProvider extends ChangeNotifier {
  ClientsProvider(this.api);

  final ApiClient api;

  List<Client> clientes = [];
  int total = 0;
  bool cargando = true;
  String? error;
  String busqueda = '';

  // Ficha de un cliente (CA-4)
  Client? clienteDetalle;
  List<Vehicle> vehiculosDelCliente = [];
  bool cargandoDetalle = true;
  String? errorDetalle;

  /// Carga el listado; `q` busca por nombre, teléfono o correo.
  Future<void> cargar({String? q}) async {
    busqueda = q ?? busqueda;
    cargando = true;
    error = null;
    notifyListeners();

    try {
      final datos = await ApiClient.conRed(
        () => api.get('/clients', query: {
          if (busqueda.isNotEmpty) 'q': busqueda,
        }),
      ) as Map<String, dynamic>;

      final lista = (datos['clients'] as List)
          .map((item) => Client.fromJson(item as Map<String, dynamic>))
          .toList();
      clientes = lista;
      total = (datos['total'] as num?)?.toInt() ?? lista.length;
    } on ApiError catch (e) {
      error = e.message;
    } finally {
      cargando = false;
      notifyListeners();
    }
  }

  /// Carga la ficha del cliente con sus vehículos.
  Future<void> cargarDetalle(int id) async {
    cargandoDetalle = true;
    errorDetalle = null;
    clienteDetalle = null;
    vehiculosDelCliente = [];
    notifyListeners();

    try {
      final datos = await ApiClient.conRed(
        () => api.get('/clients/$id'),
      ) as Map<String, dynamic>;

      clienteDetalle =
          Client.fromJson(datos['client'] as Map<String, dynamic>);
      vehiculosDelCliente = (datos['vehicles'] as List? ?? [])
          .map((item) => Vehicle.fromJson(item as Map<String, dynamic>))
          .toList();
    } on ApiError catch (e) {
      errorDetalle = e.message;
    } finally {
      cargandoDetalle = false;
      notifyListeners();
    }
  }

  /// Da de alta un cliente. Devuelve `null` si salió bien o el error de la API
  /// (el formulario decide qué hacer, p. ej. confirmar teléfono duplicado).
  Future<ApiError?> registrar({
    required String name,
    required String phone,
    required String email,
    bool confirmDuplicatePhone = false,
  }) async {
    try {
      await ApiClient.conRed(
        () => api.post('/clients', {
          'name': name,
          'phone': phone,
          'email': email,
          if (confirmDuplicatePhone) 'confirmDuplicatePhone': true,
        }),
      );
      await cargar();
      return null;
    } on ApiError catch (e) {
      return e;
    }
  }

  /// Edita un cliente existente (FR-008).
  Future<ApiError?> editar({
    required int id,
    required String name,
    required String phone,
    required String email,
    bool confirmDuplicatePhone = false,
  }) async {
    try {
      await ApiClient.conRed(
        () => api.patch('/clients/$id', {
          'name': name,
          'phone': phone,
          'email': email,
          if (confirmDuplicatePhone) 'confirmDuplicatePhone': true,
        }),
      );
      await cargar();
      clienteDetalle = null;
      await cargarDetalle(id);
      return null;
    } on ApiError catch (e) {
      return e;
    }
  }
}
