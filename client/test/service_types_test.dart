import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:provider/provider.dart';

import 'package:motorix_client/models/service_type.dart';
import 'package:motorix_client/providers/service_types_provider.dart';
import 'package:motorix_client/providers/settings_provider.dart';
import 'package:motorix_client/screens/settings/service_type_form_screen.dart';
import 'package:motorix_client/screens/settings/settings_screen.dart';
import 'package:motorix_client/services/api_client.dart';
import 'package:motorix_client/widgets/states_view.dart';

// T045 (Sprint 7, US3, FR-005, FR-017): catálogo de tipos de servicio en
// Configuración: lista, alta, edición, desactivar con confirmación,
// «Cambios sin guardar» y estados de carga, vacío y error.

Map<String, dynamic> _tipo(
  int id,
  String nombre, {
  int? dias,
  int? km,
  bool activo = true,
  int usados = 0,
}) =>
    {
      'id': id,
      'name': nombre,
      'intervalDays': dias,
      'intervalKm': km,
      'active': activo,
      'usedInServices': usados,
    };

class _ApiFalsa extends ApiClient {
  _ApiFalsa({List<Map<String, dynamic>>? tipos, this.falla = false})
      : tipos = tipos ?? [];

  final List<Map<String, dynamic>> tipos;
  final bool falla;
  final List<Map<String, dynamic>> altas = [];
  final List<Map<String, dynamic>> ediciones = [];

  @override
  Future<dynamic> get(String path, {Map<String, String>? query}) async {
    if (path == '/settings') {
      return {
        'shop': {'name': 'Motorix', 'address': null, 'phone': null},
        'maintenance': {'warnDays': 30, 'warnKm': 500},
        'defaults': {
          'shop': {'name': 'Motorix', 'address': null, 'phone': null},
          'maintenance': {'warnDays': 30, 'warnKm': 500},
        },
      };
    }
    if (path == '/service-types') {
      if (falla) {
        throw ApiError(
          status: 500,
          code: 'INTERNAL_ERROR',
          message: 'No se pudo consultar el catálogo.',
        );
      }
      return List<Map<String, dynamic>>.from(tipos);
    }
    return <String, dynamic>{};
  }

  @override
  Future<dynamic> post(String path, Object cuerpo) async {
    final datos = Map<String, dynamic>.from(cuerpo as Map);
    altas.add(datos);
    tipos.add(_tipo(
      tipos.length + 1,
      datos['name'] as String,
      dias: datos['intervalDays'] as int?,
      km: datos['intervalKm'] as int?,
    ));
    return tipos.last;
  }

  @override
  Future<dynamic> patch(String path, Object cuerpo) async {
    final datos = Map<String, dynamic>.from(cuerpo as Map);
    ediciones.add(datos);
    final id = int.parse(path.split('/').last);
    final indice = tipos.indexWhere((t) => t['id'] == id);
    tipos[indice] = {...tipos[indice], ...datos};
    return tipos[indice];
  }
}

Widget _pantalla(_ApiFalsa api) => MultiProvider(
      providers: [
        ChangeNotifierProvider<SettingsProvider>(create: (_) => SettingsProvider(api)),
        ChangeNotifierProvider<ServiceTypesProvider>(
          create: (_) => ServiceTypesProvider(api),
        ),
      ],
      child: MaterialApp(
        theme: ThemeData(useMaterial3: true),
        home: const SettingsScreen(),
      ),
    );

Future<void> _verCatalogo(WidgetTester tester) async {
  tester.view.devicePixelRatio = 1;
  tester.view.physicalSize = const Size(1200, 2400);
  addTearDown(tester.view.resetPhysicalSize);
  addTearDown(tester.view.resetDevicePixelRatio);
}

void main() {
  test('el modelo arma la etiqueta de intervalos', () {
    expect(
      ServiceType.fromJson(_tipo(1, 'Aceite', dias: 180, km: 5000)).etiquetaIntervalos,
      '180 días · 5,000 km',
    );
    expect(
      ServiceType.fromJson(_tipo(2, 'Frenos', dias: 90)).etiquetaIntervalos,
      '90 días',
    );
    expect(
      ServiceType.fromJson(_tipo(3, 'Afinación', km: 1000000)).etiquetaIntervalos,
      '1,000,000 km',
    );
  });

  testWidgets('lista los tipos con nombre, intervalos y estado', (tester) async {
    await _verCatalogo(tester);
    final api = _ApiFalsa(tipos: [
      _tipo(1, 'Cambio de aceite', dias: 180, km: 5000, usados: 12),
      _tipo(2, 'Afinación', km: 10000, activo: false),
    ]);
    await tester.pumpWidget(_pantalla(api));
    await tester.pumpAndSettle();

    expect(find.text('Cambio de aceite'), findsOneWidget);
    expect(find.textContaining('180 días · 5,000 km'), findsOneWidget);
    expect(find.textContaining('Usado en 12 servicios'), findsOneWidget);
    expect(find.text('Activo'), findsOneWidget);
    expect(find.text('Inactivo'), findsOneWidget);
  });

  testWidgets('sin tipos muestra el estado vacío', (tester) async {
    await _verCatalogo(tester);
    await tester.pumpWidget(_pantalla(_ApiFalsa()));
    await tester.pumpAndSettle();

    expect(find.byType(EmptyView), findsOneWidget);
    expect(find.textContaining('Aún no hay tipos de servicio'), findsOneWidget);
  });

  testWidgets('si falla la carga muestra el estado de error', (tester) async {
    await _verCatalogo(tester);
    await tester.pumpWidget(_pantalla(_ApiFalsa(falla: true)));
    await tester.pumpAndSettle();

    expect(find.text('No se pudo consultar el catálogo.'), findsOneWidget);
  });

  testWidgets('el alta exige nombre e intervalo y luego guarda', (tester) async {
    await _verCatalogo(tester);
    final api = _ApiFalsa();
    await tester.pumpWidget(_pantalla(api));
    await tester.pumpAndSettle();

    await tester.tap(find.byKey(const Key('boton-nuevo-tipo')));
    await tester.pumpAndSettle();
    expect(find.byType(ServiceTypeFormScreen), findsOneWidget);

    await tester.tap(find.byKey(const Key('boton-guardar-tipo')));
    await tester.pumpAndSettle();
    expect(find.text('El nombre del tipo de servicio es obligatorio.'), findsOneWidget);

    await tester.enterText(find.byKey(const Key('campo-nombre-tipo')), 'Cambio de aceite');
    await tester.tap(find.byKey(const Key('boton-guardar-tipo')));
    await tester.pumpAndSettle();
    expect(
      find.text('Indica al menos un intervalo, en días o en kilómetros.'),
      findsOneWidget,
    );
    expect(api.altas, isEmpty);

    await tester.enterText(find.byKey(const Key('campo-intervalo-dias')), '180');
    await tester.enterText(find.byKey(const Key('campo-intervalo-km')), '5000');
    await tester.tap(find.byKey(const Key('boton-guardar-tipo')));
    await tester.pumpAndSettle();

    expect(api.altas, hasLength(1));
    expect(api.altas.single['name'], 'Cambio de aceite');
    expect(api.altas.single['intervalDays'], 180);
    expect(api.altas.single['intervalKm'], 5000);
    expect(find.byType(ServiceTypeFormScreen), findsNothing);
    expect(find.text('Cambio de aceite'), findsOneWidget);
  });

  testWidgets('valida los máximos de los intervalos', (tester) async {
    await _verCatalogo(tester);
    final api = _ApiFalsa();
    await tester.pumpWidget(_pantalla(api));
    await tester.pumpAndSettle();
    await tester.tap(find.byKey(const Key('boton-nuevo-tipo')));
    await tester.pumpAndSettle();

    await tester.enterText(find.byKey(const Key('campo-nombre-tipo')), 'X');
    await tester.enterText(find.byKey(const Key('campo-intervalo-dias')), '3651');
    await tester.enterText(find.byKey(const Key('campo-intervalo-km')), '0');
    await tester.tap(find.byKey(const Key('boton-guardar-tipo')));
    await tester.pumpAndSettle();

    expect(find.text('El intervalo en días no puede ser mayor que 3650.'), findsOneWidget);
    expect(find.text('El intervalo en kilómetros debe ser mayor que cero.'), findsOneWidget);
    expect(api.altas, isEmpty);
  });

  testWidgets('la edición precarga los datos y envía los cambios', (tester) async {
    await _verCatalogo(tester);
    final api = _ApiFalsa(tipos: [_tipo(1, 'Aceite', dias: 180, km: 5000)]);
    await tester.pumpWidget(_pantalla(api));
    await tester.pumpAndSettle();

    await tester.tap(find.byTooltip('Editar tipo'));
    await tester.pumpAndSettle();
    expect(find.widgetWithText(TextFormField, 'Aceite'), findsOneWidget);
    expect(find.widgetWithText(TextFormField, '180'), findsOneWidget);

    await tester.enterText(find.byKey(const Key('campo-intervalo-km')), '');
    await tester.tap(find.byKey(const Key('boton-guardar-tipo')));
    await tester.pumpAndSettle();

    expect(api.ediciones, hasLength(1));
    expect(api.ediciones.single['intervalKm'], isNull);
    expect(api.ediciones.single['intervalDays'], 180);
  });

  testWidgets('desactivar pide confirmación y cancelar no envía nada', (tester) async {
    await _verCatalogo(tester);
    final api = _ApiFalsa(tipos: [_tipo(1, 'Aceite', dias: 180, usados: 3)]);
    await tester.pumpWidget(_pantalla(api));
    await tester.pumpAndSettle();

    await tester.tap(find.byTooltip('Desactivar tipo'));
    await tester.pumpAndSettle();
    expect(find.text('Desactivar tipo de servicio'), findsOneWidget);
    expect(find.textContaining('3 líneas de servicio'), findsOneWidget);

    await tester.tap(find.text('Cancelar'));
    await tester.pumpAndSettle();
    expect(api.ediciones, isEmpty);

    await tester.tap(find.byTooltip('Desactivar tipo'));
    await tester.pumpAndSettle();
    await tester.tap(find.widgetWithText(FilledButton, 'Desactivar'));
    await tester.pumpAndSettle();

    expect(api.ediciones.single, {'active': false});
    expect(find.text('Inactivo'), findsOneWidget);
  });

  testWidgets('reactivar no pide confirmación', (tester) async {
    await _verCatalogo(tester);
    final api = _ApiFalsa(tipos: [_tipo(1, 'Aceite', dias: 180, activo: false)]);
    await tester.pumpWidget(_pantalla(api));
    await tester.pumpAndSettle();

    await tester.tap(find.byTooltip('Activar tipo'));
    await tester.pumpAndSettle();

    expect(api.ediciones.single, {'active': true});
  });

  testWidgets('el formulario pide «Cambios sin guardar» al salir con cambios', (tester) async {
    await _verCatalogo(tester);
    await tester.pumpWidget(_pantalla(_ApiFalsa()));
    await tester.pumpAndSettle();
    await tester.tap(find.byKey(const Key('boton-nuevo-tipo')));
    await tester.pumpAndSettle();

    await tester.enterText(find.byKey(const Key('campo-nombre-tipo')), 'Algo');
    await tester.pump();
    await tester.tap(find.text('Cancelar'));
    await tester.pumpAndSettle();
    expect(find.text('Cambios sin guardar'), findsOneWidget);

    await tester.tap(find.text('Cancelar').last);
    await tester.pumpAndSettle();
    expect(find.byType(ServiceTypeFormScreen), findsOneWidget);

    await tester.tap(find.text('Cancelar').first);
    await tester.pumpAndSettle();
    await tester.tap(find.text('Confirmar'));
    await tester.pumpAndSettle();
    expect(find.byType(ServiceTypeFormScreen), findsNothing);
  });

  testWidgets('el formulario sin cambios sale sin confirmar', (tester) async {
    await _verCatalogo(tester);
    await tester.pumpWidget(_pantalla(_ApiFalsa()));
    await tester.pumpAndSettle();
    await tester.tap(find.byKey(const Key('boton-nuevo-tipo')));
    await tester.pumpAndSettle();

    await tester.tap(find.text('Cancelar'));
    await tester.pumpAndSettle();

    expect(find.text('Cambios sin guardar'), findsNothing);
    expect(find.byType(ServiceTypeFormScreen), findsNothing);
  });
}
