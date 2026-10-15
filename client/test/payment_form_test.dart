import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:provider/provider.dart';

import 'package:motorix_client/providers/payments_provider.dart';
import 'package:motorix_client/screens/payments/payment_form_screen.dart';
import 'package:motorix_client/services/api_client.dart';

/// ApiClient falso del formulario de pago: total calculado del endpoint
/// GET .../total y alta de pago con método manual → PAID.
class _ApiPagosFalsa extends ApiClient {
  _ApiPagosFalsa({this.total = '3150.00', this.errorTotal, this.espera});

  /// Total devuelto por el backend (permite probar el estado vacío con 0.00).
  final String total;

  /// Si viene, GET .../total falla con este error (estado de error).
  final ApiError? errorTotal;

  /// Si viene, GET .../total no resuelve hasta completarlo (estado cargando).
  final Completer<void>? espera;

  int posteos = 0;
  Map<String, dynamic>? ultimoCuerpo;

  @override
  Future<dynamic> get(String path, {Map<String, String>? query}) async {
    if (path.endsWith('/total')) {
      if (errorTotal != null) throw errorTotal!;
      if (espera != null) await espera!.future;
      return {
        'orderId': 12,
        'servicesSubtotal': '850.00',
        'laborSubtotal': '600.00',
        'partsSubtotal': '1700.00',
        'total': total,
      };
    }
    if (path.endsWith('/payments')) {
      return {
        'payments': <Map<String, dynamic>>[],
        'total': '0.00',
      };
    }
    throw ApiError(status: 404, code: 'UNKNOWN', message: 'Ruta desconocida.');
  }

  @override
  Future<dynamic> post(String path, Object cuerpo) async {
    final datos = cuerpo as Map<String, dynamic>;
    // Sin credenciales del proveedor: el backend responde 409 (US2, R-04).
    if (datos['method'] == 'MERCADO_PAGO') {
      throw ApiError(
        status: 409,
        code: 'MERCADO_PAGO_NOT_CONFIGURED',
        message:
            'Mercado Pago no está disponible en este entorno: faltan las credenciales del proveedor.',
      );
    }
    posteos += 1;
    ultimoCuerpo = datos;
    return {
      'payment': {
        'id': 7,
        'orderId': 12,
        'amount': datos['amount'] ?? total,
        'method': datos['method'],
        'status': 'PAID',
        'externalReference': null,
        'createdBy': 2,
        'createdByName': 'Recepción',
        'createdAt': '2026-10-14T12:00:00',
        'updatedAt': '2026-10-14T12:00:00',
      },
      'initPoint': null,
    };
  }
}

Widget _pantalla(ApiClient api) => MultiProvider(
      providers: [
        ChangeNotifierProvider<PaymentsProvider>(
          create: (_) => PaymentsProvider(api),
        ),
      ],
      child: MaterialApp(
        theme: ThemeData(useMaterial3: true),
        home: const PaymentFormScreen(orderId: 12),
      ),
    );

void main() {
  testWidgets(
      'muestra el total, el importe precargado, los métodos y el botón Registrar pago',
      (tester) async {
    await tester.pumpWidget(_pantalla(_ApiPagosFalsa()));
    await tester.pumpAndSettle();

    expect(find.text('Total de la orden'), findsOneWidget);
    expect(
      find.text('\$3150.00'),
      findsOneWidget,
      reason: 'el total calculado debe estar visible (US1)',
    );

    final campo = tester.widget<TextFormField>(find.byType(TextFormField));
    expect(
      campo.controller!.text,
      '3150.00',
      reason: 'el importe viene precargado igual al total (US1)',
    );

    expect(find.text('Efectivo'), findsOneWidget);
    expect(find.text('Tarjeta'), findsOneWidget);
    expect(find.text('Transferencia'), findsOneWidget);
    expect(
      find.widgetWithText(ElevatedButton, 'Registrar pago'),
      findsOneWidget,
    );
  });

  testWidgets('muestra el estado cargando mientras consulta el total',
      (tester) async {
    final espera = Completer<void>();
    await tester.pumpWidget(_pantalla(_ApiPagosFalsa(espera: espera)));
    await tester.pump();
    await tester.pump();

    expect(find.byType(CircularProgressIndicator), findsOneWidget);
    expect(find.text('Registrar pago'), findsNothing);

    espera.complete();
    await tester.pumpAndSettle();
    expect(find.widgetWithText(ElevatedButton, 'Registrar pago'), findsOneWidget);
  });

  testWidgets('muestra el estado de error en español con reintento',
      (tester) async {
    final api = _ApiPagosFalsa(
      errorTotal: ApiError(
        status: 500,
        code: 'INTERNAL_ERROR',
        message: 'Error interno del servidor.',
      ),
    );
    await tester.pumpWidget(_pantalla(api));
    await tester.pumpAndSettle();

    expect(find.text('Error interno del servidor.'), findsOneWidget);
    expect(find.text('Reintentar'), findsOneWidget);
    expect(find.text('Registrar pago'), findsNothing);
  });

  testWidgets('una orden sin cargos muestra el estado vacío', (tester) async {
    await tester.pumpWidget(_pantalla(_ApiPagosFalsa(total: '0.00')));
    await tester.pumpAndSettle();

    expect(
      find.text('Esta orden no tiene importes por cobrar.'),
      findsOneWidget,
    );
    expect(find.text('Registrar pago'), findsNothing);
  });

  testWidgets('registrar un pago en efectivo refleja el estado Pagado',
      (tester) async {
    final api = _ApiPagosFalsa();
    await tester.pumpWidget(_pantalla(api));
    await tester.pumpAndSettle();

    await tester.tap(find.widgetWithText(ElevatedButton, 'Registrar pago'));
    await tester.pumpAndSettle();

    // Confirmación previa al cobro (8.5).
    expect(
      find.text('¿Registrar el pago de \$3150.00 en Efectivo?'),
      findsOneWidget,
    );
    await tester.tap(find.widgetWithText(FilledButton, 'Confirmar'));
    await tester.pumpAndSettle();

    expect(api.posteos, 1, reason: 'debe enviarse un solo alta de pago (CA-1)');
    expect(api.ultimoCuerpo, {'method': 'CASH', 'amount': '3150.00'});
    expect(
      find.text('Pagado'),
      findsOneWidget,
      reason: 'el resultado del cobro manual queda en estado Pagado (CA-1)',
    );
  });

  testWidgets('los 4 métodos del negocio aparecen como opciones (CA-2)',
      (tester) async {
    await tester.pumpWidget(_pantalla(_ApiPagosFalsa()));
    await tester.pumpAndSettle();

    expect(find.text('Efectivo'), findsOneWidget);
    expect(find.text('Tarjeta'), findsOneWidget);
    expect(find.text('Transferencia'), findsOneWidget);
    expect(
      find.text('Mercado Pago'),
      findsOneWidget,
      reason: 'Mercado Pago es el cuarto método del negocio (FR-002, CA-2)',
    );
  });

  testWidgets(
      'Mercado Pago sin credenciales muestra el aviso no disponible '
      'y conserva el formulario', (tester) async {
    final api = _ApiPagosFalsa();
    await tester.pumpWidget(_pantalla(api));
    await tester.pumpAndSettle();

    await tester.tap(find.text('Mercado Pago'));
    await tester.pump();
    await tester.tap(find.widgetWithText(ElevatedButton, 'Registrar pago'));
    await tester.pumpAndSettle();

    await tester.tap(find.widgetWithText(FilledButton, 'Confirmar'));
    await tester.pumpAndSettle();

    expect(api.posteos, 0, reason: 'sin credenciales no se crea ningún pago');
    expect(
      find.text(
        'Mercado Pago no está disponible en este entorno: faltan las credenciales del proveedor.',
      ),
      findsOneWidget,
      reason: 'el aviso «no disponible» llega en español (US2)',
    );
    expect(
      find.text('Total de la orden'),
      findsOneWidget,
      reason: 'el formulario no se pierde tras el aviso (T028)',
    );
    expect(
      find.widgetWithText(ElevatedButton, 'Registrar pago'),
      findsOneWidget,
    );
    expect(
      find.text('Mercado Pago'),
      findsOneWidget,
      reason: 'la elección del método se conserva tras el aviso',
    );
  });

  testWidgets('el método elegido se muestra en la confirmación del pago',
      (tester) async {
    await tester.pumpWidget(_pantalla(_ApiPagosFalsa()));
    await tester.pumpAndSettle();

    await tester.tap(find.text('Mercado Pago'));
    await tester.pump();
    await tester.tap(find.widgetWithText(ElevatedButton, 'Registrar pago'));
    await tester.pumpAndSettle();

    expect(
      find.text('¿Registrar el pago de \$3150.00 en Mercado Pago?'),
      findsOneWidget,
      reason: 'el resumen de la confirmación incluye método e importe (CA-2)',
    );
    await tester.tap(find.widgetWithText(TextButton, 'Cancelar'));
    await tester.pumpAndSettle();
  });
}
