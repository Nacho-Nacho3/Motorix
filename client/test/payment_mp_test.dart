import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:provider/provider.dart';

import 'package:motorix_client/providers/payments_provider.dart';
import 'package:motorix_client/screens/payments/payment_form_screen.dart';
import 'package:motorix_client/services/api_client.dart';

/// ApiClient falso del flujo Mercado Pago (US4): alta MP → PENDING con su
/// `initPoint`, sync según el resultado simulado del proveedor y cancel local.
/// RN-14: la UI nunca recibe ni muestra datos de tarjeta.
class _ApiMpFalsa extends ApiClient {
  _ApiMpFalsa({this.resultadoSync = 'approved'});

  /// Resultado simulado del proveedor: approved o rejected.
  final String resultadoSync;

  final List<String> rutasPost = [];

  static const _pago = {
    'id': 7,
    'orderId': 12,
    'amount': '3150.00',
    'method': 'MERCADO_PAGO',
    'externalReference': 'pref-1',
    'createdBy': 2,
    'createdByName': 'Recepción',
    'createdAt': '2026-10-14T12:00:00',
    'updatedAt': '2026-10-14T12:00:00',
  };

  @override
  Future<dynamic> get(String path, {Map<String, String>? query}) async {
    if (path.endsWith('/total')) {
      return {
        'orderId': 12,
        'servicesSubtotal': '850.00',
        'laborSubtotal': '600.00',
        'partsSubtotal': '1700.00',
        'total': '3150.00',
      };
    }
    if (path.endsWith('/payments')) {
      return {'payments': <Map<String, dynamic>>[], 'total': '0.00'};
    }
    throw ApiError(status: 404, code: 'UNKNOWN', message: 'Ruta desconocida.');
  }

  @override
  Future<dynamic> post(String path, Object cuerpo) async {
    rutasPost.add(path);

    if (path.endsWith('/payments')) {
      return {
        'payment': {..._pago, 'status': 'PENDING'},
        'initPoint':
            'https://sandbox.mercadopago.com.mx/checkout/v1/redirect?pref_id=pref-1',
      };
    }
    if (path.endsWith('/sync')) {
      // approved → PAID, rejected → REJECTED (R-04).
      final estado = resultadoSync == 'approved' ? 'PAID' : 'REJECTED';
      return {'payment': {..._pago, 'status': estado}};
    }
    if (path.endsWith('/cancel')) {
      return {'payment': {..._pago, 'status': 'CANCELLED'}};
    }
    throw ApiError(status: 404, code: 'UNKNOWN', message: 'Ruta desconocida.');
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

/// Paga con Mercado Pago y confirma el cobro (hasta el estado Pendiente).
Future<void> _pagarConMercadoPago(WidgetTester tester) async {
  await tester.pumpWidget(_pantalla(_ApiMpFalsa()));
  await tester.pumpAndSettle();

  await tester.tap(find.text('Mercado Pago'));
  await tester.pump();
  await tester.tap(find.widgetWithText(ElevatedButton, 'Registrar pago'));
  await tester.pumpAndSettle();
  await tester.tap(find.widgetWithText(FilledButton, 'Confirmar'));
  await tester.pumpAndSettle();
}

void main() {
  testWidgets(
      'el pago MP queda Pendiente y ofrece abrir, verificar y cancelar',
      (tester) async {
    await _pagarConMercadoPago(tester);

    // Estado inicial del pago MP y acciones del flujo sandbox (CA-3).
    expect(
      find.text('Pendiente'),
      findsOneWidget,
      reason: 'el pago MP nace Pendiente (R-04)',
    );
    expect(
      find.widgetWithText(OutlinedButton, 'Abrir en el navegador'),
      findsOneWidget,
      reason: 'initPoint se abre fuera de la app (RN-14)',
    );
    expect(
      find.widgetWithText(FilledButton, 'Verificar estado'),
      findsOneWidget,
    );
    expect(find.widgetWithText(TextButton, 'Cancelar pago'), findsOneWidget);

    // RN-14: la UI no tiene ningún campo de tarjeta.
    expect(
      find.byType(TextFormField),
      findsNothing,
      reason: 'sin campos de tarjeta en la interfaz (RN-14)',
    );
  });

  testWidgets('verificar estado con aprobación refleja Pagado', (tester) async {
    final api = _ApiMpFalsa(resultadoSync: 'approved');
    await tester.pumpWidget(_pantalla(api));
    await tester.pumpAndSettle();

    await tester.tap(find.text('Mercado Pago'));
    await tester.pump();
    await tester.tap(find.widgetWithText(ElevatedButton, 'Registrar pago'));
    await tester.pumpAndSettle();
    await tester.tap(find.widgetWithText(FilledButton, 'Confirmar'));
    await tester.pumpAndSettle();

    await tester.tap(find.widgetWithText(FilledButton, 'Verificar estado'));
    await tester.pumpAndSettle();

    expect(
      api.rutasPost.any((ruta) => ruta.endsWith('/sync')),
      isTrue,
      reason: 'la verificación consulta al proveedor vía sync',
    );
    expect(
      find.text('Pagado'),
      findsOneWidget,
      reason: 'approved → Pagado (CA-3, R-04)',
    );
    // Estado terminal: ya no se ofrece verificar ni cancelar.
    expect(find.text('Verificar estado'), findsNothing);
    expect(find.text('Cancelar pago'), findsNothing);
  });

  testWidgets('verificar estado con rechazo refleja Rechazado',
      (tester) async {
    await tester.pumpWidget(_pantalla(_ApiMpFalsa(resultadoSync: 'rejected')));
    await tester.pumpAndSettle();

    await tester.tap(find.text('Mercado Pago'));
    await tester.pump();
    await tester.tap(find.widgetWithText(ElevatedButton, 'Registrar pago'));
    await tester.pumpAndSettle();
    await tester.tap(find.widgetWithText(FilledButton, 'Confirmar'));
    await tester.pumpAndSettle();

    await tester.tap(find.widgetWithText(FilledButton, 'Verificar estado'));
    await tester.pumpAndSettle();

    expect(
      find.text('Rechazado'),
      findsOneWidget,
      reason: 'rejected → Rechazado (CA-3, R-04)',
    );
    expect(find.text('Verificar estado'), findsNothing);
  });

  testWidgets('cancelar el pago pide confirmación y deja Cancelado',
      (tester) async {
    final api = _ApiMpFalsa();
    await tester.pumpWidget(_pantalla(api));
    await tester.pumpAndSettle();

    await tester.tap(find.text('Mercado Pago'));
    await tester.pump();
    await tester.tap(find.widgetWithText(ElevatedButton, 'Registrar pago'));
    await tester.pumpAndSettle();
    await tester.tap(find.widgetWithText(FilledButton, 'Confirmar'));
    await tester.pumpAndSettle();

    await tester.tap(find.widgetWithText(TextButton, 'Cancelar pago'));
    await tester.pumpAndSettle();

    // Confirmación previa a la cancelación (8.5).
    expect(
      find.text('¿Cancelar el intento de pago de Mercado Pago?'),
      findsOneWidget,
    );
    await tester.tap(find.widgetWithText(FilledButton, 'Confirmar'));
    await tester.pumpAndSettle();

    expect(
      api.rutasPost.any((ruta) => ruta.endsWith('/cancel')),
      isTrue,
      reason: 'la cancelación es local (contrato: sin proveedor)',
    );
    expect(
      find.text('Cancelado'),
      findsOneWidget,
      reason: 'el pago cancelado queda Cancelado y libre para otro intento',
    );
    expect(find.text('Cancelar pago'), findsNothing);
  });
}
