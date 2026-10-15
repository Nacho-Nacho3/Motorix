import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:provider/provider.dart';

import 'package:motorix_client/providers/maintenances_provider.dart';
import 'package:motorix_client/screens/maintenances/maintenance_list_screen.dart';
import 'package:motorix_client/services/api_client.dart';
import 'package:motorix_client/utils/app_theme.dart';

/// ApiClient falso para el listado: aplica el filtro ?state como el backend.
class _ApiMantenimientosFalsa extends ApiClient {
  _ApiMantenimientosFalsa({this.lista = const []});

  List<Map<String, dynamic>> lista;

  @override
  Future<dynamic> get(String path, {Map<String, String>? query}) async {
    if (path.startsWith('/maintenances')) {
      var filtrada = [...lista];
      final estado = query?['state'];
      if (estado != null && estado.isNotEmpty) {
        filtrada = filtrada.where((m) => m['state'] == estado).toList();
      }
      return {'maintenances': filtrada, 'total': filtrada.length};
    }
    return {'appointments': <Map<String, dynamic>>[]};
  }
}

Map<String, dynamic> _registro({
  required int id,
  required String vehiculo,
  required String estado,
  String? fecha,
  int? kilometraje,
}) =>
    {
      'id': id,
      'vehicleId': id,
      'vehicleLabel': vehiculo,
      'clientName': 'Cliente $id',
      'nextDueDate': fecha,
      'nextDueMileage': kilometraje,
      'warnDays': 30,
      'warnKm': 500,
      'recommendations': 'Revisar niveles',
      'state': estado,
      'daysRemaining': 10,
      'mileageRemaining': 150,
      'registeredBy': 1,
      'updatedAt': '2026-10-14 10:00:00',
    };

/// Escena sin ordenar a propósito: el orden por urgencia debe venir del código.
List<Map<String, dynamic>> _escenaDesordenada() => [
      _registro(id: 1, vehiculo: 'Nissan Versa Normal', estado: 'NORMAL', fecha: '2026-12-01'),
      _registro(id: 2, vehiculo: 'Nissan Versa Próximo', estado: 'UPCOMING', fecha: '2026-10-24'),
      _registro(id: 3, vehiculo: 'Nissan Versa Vencido', estado: 'OVERDUE', fecha: '2026-10-01'),
    ];

Widget _pantalla(ApiClient api) => MultiProvider(
      providers: [
        ChangeNotifierProvider<MaintenancesProvider>(
          create: (_) => MaintenancesProvider(api),
        ),
      ],
      child: MaterialApp(
        theme: ThemeData(useMaterial3: true),
        home: const MaintenanceListScreen(),
      ),
    );

void main() {
  testWidgets('muestra los tres estados con los tokens de color (CA-7)', (tester) async {
    await tester.pumpWidget(_pantalla(_ApiMantenimientosFalsa(lista: _escenaDesordenada())));
    await tester.pumpAndSettle();

    Color colorDe(String etiqueta) {
      final texto = tester.widget<Text>(find.text(etiqueta));
      expect(texto.style?.color, isNotNull, reason: 'La etiqueta "$etiqueta" debe llevar color');
      return texto.style!.color!;
    }

    expect(find.text('Vencido'), findsOneWidget);
    expect(find.text('Próximo'), findsOneWidget);
    expect(find.text('Normal'), findsOneWidget);

    expect(colorDe('Vencido'), AppColors.danger, reason: 'Vencido en rojo (danger)');
    expect(colorDe('Próximo'), AppColors.warning, reason: 'Próximo en ámbar (warning)');
    expect(colorDe('Normal'), AppColors.success, reason: 'Normal en verde (success)');
  });

  testWidgets('el chip de estado filtra la lista al elegir un estado', (tester) async {
    final api = _ApiMantenimientosFalsa(
      lista: [
        _registro(id: 1, vehiculo: 'Nissan Versa Uno', estado: 'UPCOMING', fecha: '2026-10-24'),
        _registro(id: 2, vehiculo: 'Nissan Versa Dos', estado: 'UPCOMING', fecha: '2026-10-28'),
        _registro(id: 3, vehiculo: 'Nissan Versa Tres', estado: 'NORMAL', fecha: '2026-12-01'),
        _registro(id: 4, vehiculo: 'Nissan Versa Cuatro', estado: 'OVERDUE', fecha: '2026-10-01'),
      ],
    );
    await tester.pumpWidget(_pantalla(api));
    await tester.pumpAndSettle();

    await tester.tap(find.text('Próximos'));
    await tester.pumpAndSettle();

    expect(find.text('Próximo'), findsNWidgets(2));
    expect(find.text('Normal'), findsNothing);
    expect(find.text('Vencido'), findsNothing);
    expect(find.text('Total: 2'), findsOneWidget);
  });

  testWidgets('ordena por urgencia: Vencido, Próximo, Normal (SC-004)', (tester) async {
    await tester.pumpWidget(_pantalla(_ApiMantenimientosFalsa(lista: _escenaDesordenada())));
    await tester.pumpAndSettle();

    final yVencido = tester.getTopLeft(find.text('Vencido')).dy;
    final yProximo = tester.getTopLeft(find.text('Próximo')).dy;
    final yNormal = tester.getTopLeft(find.text('Normal')).dy;

    expect(yVencido < yProximo, isTrue, reason: 'Vencido debe aparecer antes que Próximo');
    expect(yProximo < yNormal, isTrue, reason: 'Próximo debe aparecer antes que Normal');
  });

  testWidgets('el estado vacío muestra el mensaje en español', (tester) async {
    await tester.pumpWidget(_pantalla(_ApiMantenimientosFalsa()));
    await tester.pumpAndSettle();

    expect(find.text('Aún no hay mantenimientos registrados.'), findsOneWidget);
  });
}
