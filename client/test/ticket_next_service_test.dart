import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:provider/provider.dart';

import 'package:motorix_client/models/ticket.dart';
import 'package:motorix_client/providers/payments_provider.dart';
import 'package:motorix_client/screens/tickets/ticket_screen.dart';
import 'package:motorix_client/services/api_client.dart';

// T058 (Sprint 7, US8, CA-14): la pantalla del ticket muestra «Próximo
// servicio» con fecha y/o kilometraje solo cuando `nextService` no es null; el
// PDF usa las mismas líneas del modelo.

class _ApiFalsa extends ApiClient {
  _ApiFalsa(this.ticket);

  final Map<String, dynamic> ticket;

  @override
  Future<dynamic> get(String path, {Map<String, String>? query}) async {
    if (path.endsWith('/ticket')) return {'ticket': ticket};
    throw ApiError(status: 404, code: 'UNKNOWN', message: 'Ruta desconocida.');
  }

  @override
  Future<dynamic> post(String path, Object cuerpo) async {
    if (path.endsWith('/ticket')) return {'ticket': ticket};
    throw ApiError(status: 404, code: 'UNKNOWN', message: 'Ruta desconocida.');
  }
}

Map<String, dynamic> _ticket({Map<String, dynamic>? nextService, bool incluir = true}) => {
      'id': 3,
      'folio': 'TCK-000003',
      'orderId': 12,
      'issuedBy': 2,
      'issuedByName': 'Recepción',
      'createdAt': '2026-10-14T12:30:00',
      'workshop': {'name': 'Taller Pérez', 'address': 'Av. Juárez 120', 'phone': '3511234567'},
      'client': {'id': 4, 'name': 'María López', 'phone': '5512345678'},
      'vehicle': {
        'id': 4,
        'label': 'Nissan Versa 2020',
        'licensePlate': 'ABC1234',
        'entryMileage': 45000,
      },
      'services': [
        {'id': 9, 'description': 'Cambio de aceite', 'unitPrice': '850.00'},
      ],
      'labor': <dynamic>[],
      'parts': <dynamic>[],
      'totals': {
        'servicesSubtotal': '850.00',
        'laborSubtotal': '0.00',
        'partsSubtotal': '0.00',
        'total': '850.00',
      },
      'payment': null,
      if (incluir) 'nextService': nextService,
    };

Widget _pantalla(ApiClient api) => MultiProvider(
      providers: [
        ChangeNotifierProvider<PaymentsProvider>(create: (_) => PaymentsProvider(api)),
      ],
      child: MaterialApp(
        theme: ThemeData(useMaterial3: true),
        home: const TicketScreen(orderId: 12),
      ),
    );

void main() {
  group('Modelo TicketProximoServicio', () {
    test('formatea fecha dd/mm/aaaa y kilometraje con separador de miles', () {
      final proximo = TicketProximoServicio.fromJson(
        {'date': '2027-05-24', 'mileage': 85000},
      );

      expect(proximo.etiquetaFecha, '24/05/2027');
      expect(proximo.etiquetaKilometraje, '85,000 km');
      expect(proximo.lineas.map((l) => l.key), ['Fecha', 'Kilometraje']);
    });

    test('solo fecha o solo kilometraje producen una línea', () {
      expect(
        TicketProximoServicio.fromJson({'date': '2027-05-24', 'mileage': null}).lineas,
        hasLength(1),
      );
      expect(
        TicketProximoServicio.fromJson({'date': null, 'mileage': 3000}).lineas.single.value,
        '3,000 km',
      );
    });

    test('el ticket sin nextService, o con null, lo deja en null', () {
      expect(Ticket.fromJson(_ticket(incluir: false)).nextService, isNull);
      expect(Ticket.fromJson(_ticket(nextService: null)).nextService, isNull);
      expect(
        Ticket.fromJson(_ticket(nextService: {'date': '2027-01-02', 'mileage': 10})).nextService,
        isNotNull,
      );
    });
  });

  group('Pantalla del ticket', () {
    testWidgets('muestra «Próximo servicio» con fecha y kilometraje', (tester) async {
      tester.view.devicePixelRatio = 1;
      tester.view.physicalSize = const Size(1000, 2400);
      addTearDown(tester.view.resetPhysicalSize);
      addTearDown(tester.view.resetDevicePixelRatio);
      await tester.pumpWidget(
        _pantalla(_ApiFalsa(_ticket(nextService: {'date': '2027-05-24', 'mileage': 85000}))),
      );
      await tester.pumpAndSettle();

      expect(find.text('Próximo servicio'), findsOneWidget);
      expect(find.text('24/05/2027'), findsOneWidget);
      expect(find.text('85,000 km'), findsOneWidget);
    });

    testWidgets('solo con fecha no muestra la línea de kilometraje', (tester) async {
      tester.view.devicePixelRatio = 1;
      tester.view.physicalSize = const Size(1000, 2400);
      addTearDown(tester.view.resetPhysicalSize);
      addTearDown(tester.view.resetDevicePixelRatio);
      await tester.pumpWidget(
        _pantalla(_ApiFalsa(_ticket(nextService: {'date': '2027-05-24', 'mileage': null}))),
      );
      await tester.pumpAndSettle();

      expect(find.text('Próximo servicio'), findsOneWidget);
      expect(find.text('Kilometraje'), findsNothing);
    });

    testWidgets('sin nextService no muestra la sección', (tester) async {
      tester.view.devicePixelRatio = 1;
      tester.view.physicalSize = const Size(1000, 2400);
      addTearDown(tester.view.resetPhysicalSize);
      addTearDown(tester.view.resetDevicePixelRatio);
      await tester.pumpWidget(_pantalla(_ApiFalsa(_ticket(nextService: null))));
      await tester.pumpAndSettle();

      expect(find.text('Próximo servicio'), findsNothing);
      expect(find.text('Taller Pérez'), findsOneWidget);
    });
  });
}
