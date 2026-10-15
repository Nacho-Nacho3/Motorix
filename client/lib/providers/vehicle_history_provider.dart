import 'package:flutter/foundation.dart';

import '../models/history_entry.dart';
import '../models/vehicle.dart';
import '../services/api_client.dart';

/// Estado del historial de servicios del vehículo (US1, FR-001, FR-018).
///
/// Carga el catálogo de vehículos, mantiene el vehículo seleccionado y su
/// historial (entradas FINISHED/DELIVERED ordenadas por el backend).
class VehicleHistoryProvider extends ChangeNotifier {
  VehicleHistoryProvider(this.api);

  final ApiClient api;

  List<Vehicle> vehiculos = [];
  Vehicle? vehiculoSeleccionado;
  HistoryVehicle? cabecera;
  List<HistoryEntry> entradas = [];
  bool cargando = true;
  bool cargandoHistorial = false;
  String? error;

  /// Etiqueta del vehículo para el selector.
  static String etiquetaDe(Vehicle vehiculo) =>
      '${vehiculo.brand} ${vehiculo.model} ${vehiculo.licensePlate}';

  /// Carga los vehículos y selecciona el primero para mostrar su historial.
  Future<void> cargar() async {
    cargando = true;
    error = null;
    notifyListeners();

    try {
      final datos = await ApiClient.conRed(() => api.get('/vehicles'));
      vehiculos = [
        for (final item in (datos['vehicles'] as List<dynamic>? ?? []))
          Vehicle.fromJson(item as Map<String, dynamic>),
      ];
      cargando = false;

      if (vehiculos.isEmpty) {
        vehiculoSeleccionado = null;
        cabecera = null;
        entradas = [];
        notifyListeners();
        return;
      }
      await seleccionar(vehiculos.first);
    } catch (excepcion) {
      cargando = false;
      cargandoHistorial = false;
      error = excepcion is ApiError
          ? excepcion.message
          : 'No se pudo cargar el historial.';
      notifyListeners();
    }
  }

  /// Carga el historial del vehículo indicado (selector de la pantalla).
  Future<void> seleccionar(Vehicle vehiculo) async {
    vehiculoSeleccionado = vehiculo;
    cargandoHistorial = true;
    error = null;
    cabecera = null;
    entradas = [];
    notifyListeners();

    try {
      final datos = await ApiClient.conRed(
        () => api.get('/vehicles/${vehiculo.id}/history'),
      );
      cabecera = HistoryVehicle.fromJson(
        datos['vehicle'] as Map<String, dynamic>,
      );
      entradas = [
        for (final item in (datos['entries'] as List<dynamic>? ?? []))
          HistoryEntry.fromJson(item as Map<String, dynamic>),
      ];
      cargandoHistorial = false;
      notifyListeners();
    } catch (excepcion) {
      cargandoHistorial = false;
      error = excepcion is ApiError
          ? excepcion.message
          : 'No se pudo cargar el historial.';
      notifyListeners();
    }
  }

  /// Reintenta la carga completa tras un error.
  Future<void> reintentar() => cargar();
}
