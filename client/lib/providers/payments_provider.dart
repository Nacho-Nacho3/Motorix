import 'package:flutter/foundation.dart';

import '../models/payment.dart';
import '../models/ticket.dart';
import '../services/api_client.dart';

/// Estado de los pagos de una orden (Sprint 4, US1, FR-001 a FR-008).
///
/// Tres operaciones (T018): `cargarTotal` (desglose calculado del backend),
/// `registrarPago` (alta manual o MP) y `listarPagos` (historial con la suma
/// de los cobros efectivos). El total nunca se calcula en el cliente: la
/// fórmula única vive en el backend (R-03, RN-10).
class PaymentsProvider extends ChangeNotifier {
  PaymentsProvider(this.api);

  final ApiClient api;

  // ── Total calculado (GET /service-orders/{id}/total) ──
  bool cargandoTotal = false;
  String? errorTotal;
  String? servicesSubtotal;
  String? laborSubtotal;
  String? partsSubtotal;

  /// Total de la orden como cadena de 2 decimales; `null` si aún no carga.
  String? total;

  // ── Historial (GET /service-orders/{id}/payments) ──
  List<Payment> pagos = [];

  /// Suma de los pagos `PAID` (contrato: `data.total`).
  String totalPagado = '0.00';
  bool cargandoPagos = false;
  String? errorPagos;

  // ── Alta de un pago (POST /service-orders/{id}/payments) ──

  /// Pago recién registrado; la pantalla muestra su estado con este valor.
  Payment? ultimoPago;
  bool registrando = false;

  /// URL de pago del proveedor (solo MP); null en métodos manuales (US4).
  String? initPoint;
  bool verificando = false;
  bool cancelando = false;

  // ── Ticket de la orden (US3, T038) ──
  Ticket? ticket;
  bool cargandoTicket = false;
  String? errorTicket;

  /// Carga el desglose calculado. Limpia el resultado previo para que
  /// reabrir el formulario no muestre un cobro viejo.
  Future<void> cargarTotal(int orderId) async {
    cargandoTotal = true;
    errorTotal = null;
    ultimoPago = null;
    initPoint = null;
    notifyListeners();

    try {
      final datos = await ApiClient.conRed(
        () => api.get('/service-orders/$orderId/total'),
      );
      final mapa = datos as Map<String, dynamic>;
      servicesSubtotal = _decimal(mapa['servicesSubtotal']);
      laborSubtotal = _decimal(mapa['laborSubtotal']);
      partsSubtotal = _decimal(mapa['partsSubtotal']);
      total = _decimal(mapa['total']);
      cargandoTotal = false;
    } on ApiError catch (e) {
      cargandoTotal = false;
      errorTotal = e.message;
    } catch (_) {
      cargandoTotal = false;
      errorTotal = 'No se pudo cargar el total de la orden.';
    }
    notifyListeners();
  }

  /// Registra un pago. Devuelve `null` si se guardó o el `ApiError` para
  /// que la pantalla muestre el mensaje en español (p. ej. un importe
  /// distinto del total o una orden ya pagada).
  Future<ApiError?> registrarPago(
    int orderId,
    String method,
    String? amount,
  ) async {
    registrando = true;
    notifyListeners();

    try {
      final cuerpo = <String, dynamic>{
        'method': method,
        if (amount != null && amount.isNotEmpty) 'amount': amount,
      };
      final datos = await ApiClient.conRed(
        () => api.post('/service-orders/$orderId/payments', cuerpo),
      );
      final mapa = datos as Map<String, dynamic>;
      ultimoPago = Payment.fromJson(mapa['payment'] as Map<String, dynamic>);
      // initPoint: URL de pago MP para abrirla fuera de la app (T047).
      initPoint = mapa['initPoint'] as String?;
      // Refresca el historial con el cobro recién creado.
      await listarPagos(orderId);
      return null;
    } on ApiError catch (e) {
      return e;
    } catch (_) {
      return ApiError(
        status: 0,
        code: 'UNKNOWN',
        message: 'No se pudo registrar el pago.',
      );
    } finally {
      registrando = false;
      notifyListeners();
    }
  }

  // ── Sync y cancel del pago MP (US4, T048, R-04) ──

  /// Aplica la respuesta `{payment}` de sync/cancel a los estados visibles.
  void _aplicarPago(Map<String, dynamic> mapa) {
    final actualizado =
        Payment.fromJson((mapa['payment'] as Map).cast<String, dynamic>());
    if (ultimoPago?.id == actualizado.id) ultimoPago = actualizado;
    final indice = pagos.indexWhere((pago) => pago.id == actualizado.id);
    if (indice >= 0) pagos[indice] = actualizado;
  }

  /// Verifica el resultado del pago MP en el proveedor («Verificar estado»):
  /// approved → Pagado, rejected → Rechazado, en proceso sigue Pendiente.
  Future<ApiError?> sincronizarPago(int orderId, int paymentId) async {
    verificando = true;
    notifyListeners();
    try {
      final datos = await ApiClient.conRed(
        () => api.post(
          '/service-orders/$orderId/payments/$paymentId/sync',
          const <String, dynamic>{},
        ),
      );
      _aplicarPago(datos as Map<String, dynamic>);
      return null;
    } on ApiError catch (e) {
      return e;
    } catch (_) {
      return ApiError(
        status: 0,
        code: 'UNKNOWN',
        message: 'No se pudo verificar el estado del pago.',
      );
    } finally {
      verificando = false;
      notifyListeners();
    }
  }

  /// Cancela el intento MP `PENDING` (cancelación local, sin proveedor y sin
  /// reembolsos en el MVP): la orden queda libre para otro cobro (Q1).
  Future<ApiError?> cancelarPago(int orderId, int paymentId) async {
    cancelando = true;
    notifyListeners();
    try {
      final datos = await ApiClient.conRed(
        () => api.post(
          '/service-orders/$orderId/payments/$paymentId/cancel',
          const <String, dynamic>{},
        ),
      );
      _aplicarPago(datos as Map<String, dynamic>);
      initPoint = null;
      return null;
    } on ApiError catch (e) {
      return e;
    } catch (_) {
      return ApiError(
        status: 0,
        code: 'UNKNOWN',
        message: 'No se pudo cancelar el pago.',
      );
    } finally {
      cancelando = false;
      notifyListeners();
    }
  }

  /// Historial de pagos de la orden (más recientes primero) y su suma `PAID`.
  Future<void> listarPagos(int orderId) async {
    cargandoPagos = true;
    errorPagos = null;
    notifyListeners();

    try {
      final datos = await ApiClient.conRed(
        () => api.get('/service-orders/$orderId/payments'),
      );
      final mapa = datos as Map<String, dynamic>;
      final lista = (mapa['payments'] as List?) ?? const [];
      pagos = lista
          .map((fila) => Payment.fromJson(fila as Map<String, dynamic>))
          .toList();
      totalPagado = _decimal(mapa['total']) ?? '0.00';
      cargandoPagos = false;
    } on ApiError catch (e) {
      cargandoPagos = false;
      errorPagos = e.message;
    } catch (_) {
      cargandoPagos = false;
      errorPagos = 'No se pudo cargar el historial de pagos.';
    }
    notifyListeners();
  }

  /// Genera (o reabre) el comprobante: POST idempotente que devuelve 201 al
  /// crear y 200 si ya existía (FR-011, CA-5). Devuelve `null` si salió bien.
  Future<ApiError?> generarTicket(int orderId) async {
    cargandoTicket = true;
    errorTicket = null;
    notifyListeners();

    try {
      final datos = await ApiClient.conRed(
        () => api.post('/service-orders/$orderId/ticket', const <String, dynamic>{}),
      );
      final mapa = datos as Map<String, dynamic>;
      ticket = Ticket.fromJson((mapa['ticket'] as Map).cast<String, dynamic>());
      cargandoTicket = false;
      notifyListeners();
      return null;
    } on ApiError catch (e) {
      cargandoTicket = false;
      errorTicket = e.message;
      notifyListeners();
      return e;
    } catch (_) {
      cargandoTicket = false;
      errorTicket = 'No se pudo generar el ticket.';
      notifyListeners();
      return ApiError(
        status: 0,
        code: 'UNKNOWN',
        message: 'No se pudo generar el ticket.',
      );
    }
  }

  /// Lee el ticket existente (GET); sin comprobante el backend responde
  /// 404 `TICKET_NOT_FOUND` y se muestra su mensaje en español.
  Future<ApiError?> obtenerTicket(int orderId) async {
    cargandoTicket = true;
    errorTicket = null;
    notifyListeners();

    try {
      final datos = await ApiClient.conRed(
        () => api.get('/service-orders/$orderId/ticket'),
      );
      final mapa = datos as Map<String, dynamic>;
      ticket = Ticket.fromJson((mapa['ticket'] as Map).cast<String, dynamic>());
      cargandoTicket = false;
      notifyListeners();
      return null;
    } on ApiError catch (e) {
      cargandoTicket = false;
      errorTicket = e.message;
      notifyListeners();
      return e;
    } catch (_) {
      cargandoTicket = false;
      errorTicket = 'No se pudo cargar el ticket.';
      notifyListeners();
      return ApiError(
        status: 0,
        code: 'UNKNOWN',
        message: 'No se pudo cargar el ticket.',
      );
    }
  }

  static String? _decimal(dynamic valor) {
    if (valor == null) return null;
    final numero = num.tryParse(valor.toString());
    return numero?.toStringAsFixed(2);
  }
}
