import 'package:flutter/foundation.dart';

import '../models/inventory_movement.dart';
import '../models/part.dart';
import '../services/api_client.dart';

/// Estado del catálogo de refacciones (US5/US6/US8, FR-009, FR-014).
class PartsProvider extends ChangeNotifier {
  PartsProvider(this.api);

  final ApiClient api;

  List<Part> refacciones = [];
  int total = 0;

  /// Total GLOBAL de refacciones en alerta de stock (CA-7).
  int totalStockBajo = 0;
  bool cargando = true;
  String? error;

  /// Texto de búsqueda (?q: código, nombre o categoría).
  String busqueda = '';

  /// Filtro de stock bajo (?low=true); llega en US8 desde la interfaz.
  bool soloStockBajo = false;

  /// Carga el catálogo. `mostrarCarga` se apaga en la búsqueda para no
  /// parpadear la lista con cada tecleo.
  Future<void> cargar({bool mostrarCarga = true}) async {
    if (mostrarCarga) cargando = true;
    error = null;
    notifyListeners();

    try {
      final datos = await ApiClient.conRed(
        () => api.get('/parts', query: {
          if (busqueda.isNotEmpty) 'q': busqueda,
          if (soloStockBajo) 'low': 'true',
        }),
      );
      refacciones = [
        for (final item in (datos['parts'] as List<dynamic>? ?? []))
          Part.fromJson(item as Map<String, dynamic>),
      ];
      total = (datos['total'] as num?)?.toInt() ?? refacciones.length;
      totalStockBajo =
          (datos['lowStockCount'] as num?)?.toInt() ?? totalStockBajo;
      cargando = false;
      notifyListeners();
    } catch (excepcion) {
      cargando = false;
      error = excepcion is ApiError
          ? excepcion.message
          : 'No se pudo cargar el inventario.';
      notifyListeners();
    }
  }

  /// Búsqueda por código, nombre o categoría (recarga sin estado de carga).
  Future<void> buscar(String texto) async {
    busqueda = texto;
    await cargar(mostrarCarga: false);
  }

  /// Filtra solo las refacciones con stock bajo (?low=true, CA-7/SC-007).
  Future<void> filtrarStockBajo(bool activo) async {
    soloStockBajo = activo;
    await cargar();
  }

  /// Da de alta una refacción con su stock inicial (RN-8).
  Future<ApiError?> crear({
    required String partCode,
    required String name,
    required String category,
    String? brand,
    int? stockCurrent,
    required int stockMin,
    String? purchasePrice,
    String? salePrice,
  }) async {
    try {
      await ApiClient.conRed(
        () => api.post('/parts', {
          'partCode': partCode,
          'name': name,
          'category': category,
          if (brand != null && brand.isNotEmpty) 'brand': brand,
          'stockCurrent': ?stockCurrent,
          'stockMin': stockMin,
          'purchasePrice': ?purchasePrice,
          'salePrice': ?salePrice,
        }),
      );
      await cargar();
      return null;
    } on ApiError catch (excepcion) {
      return excepcion;
    }
  }

  /// Edita los campos permitidos; código y stock no se tocan (R-05).
  Future<ApiError?> editar({
    required int id,
    String? name,
    String? category,
    String? brand,
    int? stockMin,
    String? purchasePrice,
    String? salePrice,
  }) async {
    try {
      await ApiClient.conRed(
        () => api.patch('/parts/$id', {
          'name': ?name,
          'category': ?category,
          'brand': ?brand,
          'stockMin': ?stockMin,
          'purchasePrice': ?purchasePrice,
          'salePrice': ?salePrice,
        }),
      );
      await cargar();
      return null;
    } on ApiError catch (excepcion) {
      return excepcion;
    }
  }

  /// Reintenta la carga tras un error.
  Future<void> reintentar() => cargar();

  /// Movimientos de una refacción, más recientes primero (US6,
  /// `GET /api/parts/{id}/movements`). Devuelve `null` si la consulta
  /// falla; el saldo de la lista se refresca con `cargar()`.
  Future<List<InventoryMovement>?> movimientosDe(int partId) async {
    try {
      final datos = await ApiClient.conRed(
        () => api.get('/parts/$partId/movements'),
      );
      return [
        for (final item in (datos['movements'] as List<dynamic>? ?? []))
          InventoryMovement.fromJson(item as Map<String, dynamic>),
      ];
    } on ApiError {
      return null;
    }
  }
}
