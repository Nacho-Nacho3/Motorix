import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:provider/provider.dart';

import 'package:motorix_client/providers/payments_provider.dart';
import 'package:motorix_client/screens/tickets/ticket_screen.dart';
import 'package:motorix_client/services/api_client.dart';

/// ApiClient falso del ticket: el POST idempotente devuelve el comprobante
/// calculado del contrato tickets.md (US3, CA-4).
class _ApiTicketFalsa extends ApiClient {
  _ApiTicketFalsa({this.ticket});

  /// Comprobante devuelto por el backend; null simula un backend sin ticket.
  final Map<String, dynamic>? ticket;

  int posteos = 0;

  @override
  Future<dynamic> get(String path, {Map<String, String>? query}) async {
    if (path.endsWith('/ticket')) return {'ticket': ticket};
    throw ApiError(status: 404, code: 'UNKNOWN', message: 'Ruta desconocida.');
  }

  @override
  Future<dynamic> post(String path, Object cuerpo) async {
    if (path.endsWith('/ticket')) {
      posteos += 1;
      return {'ticket': ticket};
    }
    throw ApiError(status: 404, code: 'UNKNOWN', message: 'Ruta desconocida.');
  }
}

/// Ticket de ejemplo con pago efectivo (contrato: totales 3150.00).
Map<String, dynamic> _ticketConPago() => {
      'id': 3,
      'folio': 'TCK-000003',
      'orderId': 12,
      'issuedBy': 2,
      'issuedByName': 'Recepción',
      'createdAt': '2026-10-14T12:30:00',
      'workshop': {'name': 'Motorix', 'address': null, 'phone': null},
      'client': {'id': 4, 'name': 'María López', 'phone': '5512345678'},
      'vehicle': {
        'id': 4,
        'label': 'Nissan Versa 2020',
        'licensePlate': 'ABC1234',
        'entryMileage': 45000,
      },
      'services': [
        {'id': 9, 'description': 'Afinación mayor', 'unitPrice': '850.00'},
      ],
      'labor': [
        {
          'id': 5,
          'concept': 'Instalación de refacción',
          'hours': '2.00',
          'hourlyRate': '300.00',
          'subtotal': '600.00',
        },
      ],
      'parts': [
        {
          'id': 12,
          'partCode': 'BAL-001',
          'name': 'Balatas traseras',
          'quantity': 2,
          'unitPrice': '850.00',
          'subtotal': '1700.00',
        },
      ],
      'totals': {
        'servicesSubtotal': '850.00',
        'laborSubtotal': '600.00',
        'partsSubtotal': '1700.00',
        'total': '3150.00',
      },
      'payment': {'method': 'CASH', 'status': 'PAID', 'amount': '3150.00'},
    };

Widget _pantalla(ApiClient api) => MultiProvider(
      providers: [
        ChangeNotifierProvider<PaymentsProvider>(
          create: (_) => PaymentsProvider(api),
        ),
      ],
      child: MaterialApp(
        theme: ThemeData(useMaterial3: true),
        home: const TicketScreen(orderId: 12),
      ),
    );

void main() {
  testWidgets('el comprobante muestra folio, totales, desglose e Imprimir',
      (tester) async {
    await tester.pumpWidget(_pantalla(_ApiTicketFalsa(ticket: _ticketConPago())));
    await tester.pumpAndSettle();

    // Encabezado y folio único (CA-5, FR-011).
    expect(find.text('TCK-000003'), findsOneWidget);
    expect(find.text('Motorix'), findsOneWidget);
    expect(find.text('María López'), findsOneWidget);
    expect(find.text('ABC1234'), findsOneWidget);

    // Desglose calculado (CA-4).
    expect(find.text('Afinación mayor'), findsOneWidget);
    expect(find.text('Instalación de refacción'), findsOneWidget);
    expect(find.text('Balatas traseras'), findsOneWidget);
    expect(
      find.text('\$3150.00'),
      findsOneWidget,
      reason: 'el total calculado debe estar visible en el ticket (CA-4)',
    );

    // Impresión en memoria (CA-5): sin archivos almacenados.
    expect(find.widgetWithText(FilledButton, 'Imprimir'), findsOneWidget);
  });

  testWidgets('sin pago el comprobante muestra Sin pago (escenario 4)',
      (tester) async {
    final ticket = _ticketConPago();
    ticket['payment'] = null;
    await tester.pumpWidget(_pantalla(_ApiTicketFalsa(ticket: ticket)));
    await tester.pumpAndSettle();

    expect(
      find.text('Sin pago'),
      findsOneWidget,
      reason: 'un ticket sin cobro informa «Sin pago» (US3 escenario 4)',
    );
    expect(find.widgetWithText(FilledButton, 'Imprimir'), findsOneWidget);
  });
}
