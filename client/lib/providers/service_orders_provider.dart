import 'package:flutter/foundation.dart';

import '../models/order_item.dart';
import '../models/order_part.dart';
import '../models/service_order.dart';
import '../services/api_client.dart';

/// Estado de la lista de órdenes de servicio y del alta (US2).
class ServiceOrdersProvider extends ChangeNotifier {
  ServiceOrdersProvider(this.api);

  final ApiClient api;

  List<ServiceOrder> ordenes = [];
  int total = 0;
  bool cargando = true;
  String? error;
  String busqueda = '';
  String? filtroEstado;

  /// Órdenes de un solo vehículo (acción «Ver órdenes», T042).
  int? filtroVehiculoId;

  /// Mecánicos activos para el selector de asignación (Q2).
  List<Mechanic> mecanicos = [];

  /// Detalle de una orden: datos completos + servicios y mano de obra (CA-4).
  ServiceOrder? ordenDetalle;
  List<ServiceOrderItem> servicios = [];
  List<LaborOrderItem> manoDeObra = [];
  bool cargandoDetalle = false;
  String? errorDetalle;

  /// Refacciones utilizadas en la orden (US7, CA-5).
  List<OrderPart> refacciones = [];
  bool cargandoRefacciones = false;
  String? errorRefacciones;

  /// Carga el listado con los filtros activos (estado, texto, vehículo).
  Future<void> cargar({String? q, String? estado, int? vehicleId}) async {
    if (q != null) busqueda = q;
    if (estado != null) filtroEstado = estado;
    if (vehicleId != null) filtroVehiculoId = vehicleId;
    cargando = true;
    error = null;
    notifyListeners();

    try {
      final datos = await ApiClient.conRed(
        () => api.get('/service-orders', query: {
          if (busqueda.isNotEmpty) 'q': busqueda,
          if (filtroEstado != null && filtroEstado!.isNotEmpty)
            'status': filtroEstado!,
          if (filtroVehiculoId != null) 'vehicleId': '$filtroVehiculoId',
        }),
      ) as Map<String, dynamic>;

      ordenes = (datos['orders'] as List)
          .map((item) => ServiceOrder.fromJson(item as Map<String, dynamic>))
          .toList();
      total = (datos['total'] as num?)?.toInt() ?? ordenes.length;
    } on ApiError catch (e) {
      error = e.message;
    } finally {
      cargando = false;
      notifyListeners();
    }
  }

  /// Limpia el filtro de vehículo (vuelve a la lista completa).
  Future<void> limpiarFiltroVehiculo() {
    filtroVehiculoId = null;
    return cargar();
  }

  /// Carga el detalle de una orden para la pantalla de lectura (T047/T061).
  Future<void> cargarDetalle(int id) async {
    cargandoDetalle = true;
    ordenDetalle = null;
    servicios = [];
    manoDeObra = [];
    errorDetalle = null;
    notifyListeners();

    try {
      final datos = await ApiClient.conRed(
        () => api.get('/service-orders/$id'),
      ) as Map<String, dynamic>;

      ordenDetalle = ServiceOrder.fromJson(
        datos['order'] as Map<String, dynamic>,
      );
      servicios = (datos['services'] as List? ?? const [])
          .map((item) => ServiceOrderItem.fromJson(item as Map<String, dynamic>))
          .toList();
      manoDeObra = (datos['labor'] as List? ?? const [])
          .map((item) => LaborOrderItem.fromJson(item as Map<String, dynamic>))
          .toList();
    } on ApiError catch (e) {
      errorDetalle = e.message;
    } finally {
      cargandoDetalle = false;
      notifyListeners();
    }
  }

  /// Registra el diagnóstico de la orden (PATCH /{id}/work, R-06).
  Future<ApiError?> guardarDiagnostico(int id, String diagnosis) async {
    try {
      await ApiClient.conRed(
        () => api.patch('/service-orders/$id/work', {'diagnosis': diagnosis}),
      );
      await cargarDetalle(id);
      return null;
    } on ApiError catch (e) {
      return e;
    }
  }

  /// Cambia el estado con la máquina del backend (US6, Q1, R-02): los saltos,
  /// retrocesos y salidas de DELIVERED los rechaza el servidor.
  Future<ApiError?> cambiarEstado(int id, String status) async {
    try {
      await ApiClient.conRed(
        () => api.patch('/service-orders/$id/status', {'status': status}),
      );
      await cargarDetalle(id);
      return null;
    } on ApiError catch (e) {
      return e;
    }
  }

  /// Guarda observaciones y recomendaciones (PATCH /{id}/work, US7). Un campo
  /// vacío no se envía: conserva el valor guardado en el backend.
  Future<ApiError?> guardarNotas(
    int id, {
    required String observations,
    required String recommendations,
  }) async {
    try {
      await ApiClient.conRed(
        () => api.patch('/service-orders/$id/work', {
          if (observations.isNotEmpty) 'observations': observations,
          if (recommendations.isNotEmpty) 'recommendations': recommendations,
        }),
      );
      await cargarDetalle(id);
      return null;
    } on ApiError catch (e) {
      return e;
    }
  }

  /// Agrega un servicio realizado a la orden (POST /{id}/services).
  Future<ApiError?> agregarServicio(
    int orderId, {
    required String description,
    double? unitPrice,
  }) async {
    try {
      await ApiClient.conRed(
        () => api.post('/service-orders/$orderId/services', {
          'description': description,
          'unitPrice': ?unitPrice,
        }),
      );
      await cargarDetalle(orderId);
      return null;
    } on ApiError catch (e) {
      return e;
    }
  }

  /// Elimina una fila de servicio capturada por error (con confirmación previa
  /// en la interfaz, 8.5).
  Future<ApiError?> eliminarServicio(int orderId, int serviceId) async {
    try {
      await ApiClient.conRed(
        () => api.delete('/service-orders/$orderId/services/$serviceId'),
      );
      await cargarDetalle(orderId);
      return null;
    } on ApiError catch (e) {
      return e;
    }
  }

  /// Registra mano de obra en la orden (POST /{id}/labor).
  Future<ApiError?> agregarManoDeObra(
    int orderId, {
    required String concept,
    required double hours,
    double? hourlyRate,
  }) async {
    try {
      await ApiClient.conRed(
        () => api.post('/service-orders/$orderId/labor', {
          'concept': concept,
          'hours': hours,
          'hourlyRate': ?hourlyRate,
        }),
      );
      await cargarDetalle(orderId);
      return null;
    } on ApiError catch (e) {
      return e;
    }
  }

  /// Elimina una fila de mano de obra capturada por error (con confirmación).
  Future<ApiError?> eliminarManoDeObra(int orderId, int laborId) async {
    try {
      await ApiClient.conRed(
        () => api.delete('/service-orders/$orderId/labor/$laborId'),
      );
      await cargarDetalle(orderId);
      return null;
    } on ApiError catch (e) {
      return e;
    }
  }

  /// Carga los mecánicos activos para el selector (silencioso: si falla, el
  /// selector queda vacío y la validación del formulario lo indica).
  Future<void> cargarMecanicos() async {
    try {
      final datos = await ApiClient.conRed(
        () => api.get('/service-orders/mechanics'),
      ) as Map<String, dynamic>;

      mecanicos = (datos['mechanics'] as List)
          .map((item) => Mechanic.fromJson(item as Map<String, dynamic>))
          .toList();
      notifyListeners();
    } on ApiError {
      mecanicos = [];
    }
  }

  /// Da de alta una orden y la asigna a un mecánico (Q2).
  /// Devuelve `null` si salió bien o el error de la API.
  Future<ApiError?> registrar({
    required int clientId,
    required int vehicleId,
    required int mechanicId,
    required int entryMileage,
    required String reportedProblem,
  }) async {
    try {
      await ApiClient.conRed(
        () => api.post('/service-orders', {
          'clientId': clientId,
          'vehicleId': vehicleId,
          'mechanicId': mechanicId,
          'entryMileage': entryMileage,
          'reportedProblem': reportedProblem,
        }),
      );
      await cargar();
      return null;
    } on ApiError catch (e) {
      return e;
    }
  }

  /// Edita el problema reportado y/o reasigna el mecánico (Q2).
  Future<ApiError?> editar({
    required int id,
    String? reportedProblem,
    int? mechanicId,
  }) async {
    try {
      await ApiClient.conRed(
        () => api.patch('/service-orders/$id', {
          'reportedProblem': ?reportedProblem,
          'mechanicId': ?mechanicId,
        }),
      );
      await cargar();
      return null;
    } on ApiError catch (e) {
      return e;
    }
  }

  /// Carga los usos de refacciones de la orden
  /// (US7, `GET /api/service-orders/{id}/parts`).
  Future<void> cargarRefacciones(int orderId) async {
    cargandoRefacciones = true;
    errorRefacciones = null;
    notifyListeners();
    try {
      final datos = await ApiClient.conRed(
        () => api.get('/service-orders/$orderId/parts'),
      ) as Map<String, dynamic>;
      refacciones = [
        for (final uso in (datos['parts'] as List<dynamic>? ?? []))
          OrderPart.fromJson(uso as Map<String, dynamic>),
      ];
    } on ApiError catch (e) {
      errorRefacciones = e.message;
    } finally {
      cargandoRefacciones = false;
      notifyListeners();
    }
  }

  /// Agrega un uso de refacción a la orden (US7, `POST /{id}/parts`).
  ///
  /// Devuelve `null` si se registró (y recarga la sección) o el error del
  /// backend (`STOCK_INSUFFICIENT`, `ORDER_DELIVERED`…) para mostrarlo.
  Future<ApiError?> agregarRefaccionOrden(
    int orderId, {
    required int partId,
    required int quantity,
  }) async {
    try {
      await ApiClient.conRed(
        () => api.post('/service-orders/$orderId/parts', {
          'partId': partId,
          'quantity': quantity,
        }),
      );
      await cargarRefacciones(orderId);
      return null;
    } on ApiError catch (e) {
      return e;
    }
  }
}
