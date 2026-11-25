// Herramienta de evidencias del Sprint 7: ejecuta la aplicación real contra el
// backend en http://localhost:3000, recorre las pantallas y guarda una imagen
// PNG de cada una en docs/evidencias/sprint-7/. Solo captura la propia
// aplicación. No forma parte del producto.
//
//   flutter run -d windows -t tool/capturas.dart
//
// ignore_for_file: avoid_print
import 'dart:io';
import 'dart:ui' as ui;

import 'package:flutter/gestures.dart';
import 'package:flutter/material.dart';
import 'package:flutter/rendering.dart';
import 'package:provider/provider.dart';

import 'package:motorix_client/main.dart';
import 'package:motorix_client/models/service_order.dart';
import 'package:motorix_client/providers/session_provider.dart';
import 'package:motorix_client/screens/maintenances/maintenance_form_screen.dart';
import 'package:motorix_client/screens/orders/order_detail_screen.dart';
import 'package:motorix_client/screens/tickets/ticket_screen.dart';
import 'package:motorix_client/services/api_client.dart';
import 'package:motorix_client/utils/app_route.dart';
import 'package:motorix_client/widgets/app_shell.dart';

const _carpeta = r'C:\sdd\motorix\docs\evidencias\sprint-7';
const _guion =
    String.fromEnvironment('PREPARAR', defaultValue: '');
final _lienzo = GlobalKey();
int _puntero = 1;
final List<String> _fallos = [];

void main() {
  WidgetsFlutterBinding.ensureInitialized();
  runApp(
    Directionality(
      textDirection: TextDirection.ltr,
      child: FittedBox(
        child: SizedBox(
          width: 1366,
          height: 900,
          child: RepaintBoundary(key: _lienzo, child: const MotorixApp()),
        ),
      ),
    ),
  );
  WidgetsBinding.instance.addPostFrameCallback((_) => _recorrido());
}

// ---------------------------------------------------------------- utilidades

Future<void> _esperar([int ms = 900]) =>
    Future<void>.delayed(Duration(milliseconds: ms));

List<Element> _buscar(bool Function(Widget w) coincide) {
  final encontrados = <Element>[];
  void visitar(Element elemento) {
    if (coincide(elemento.widget)) encontrados.add(elemento);
    elemento.visitChildren(visitar);
  }

  WidgetsBinding.instance.rootElement!.visitChildren(visitar);
  return encontrados;
}

Future<Element> _hasta(
  bool Function(Widget w) coincide,
  String que, {
  int segundos = 15,
}) async {
  final limite = DateTime.now().add(Duration(seconds: segundos));
  while (DateTime.now().isBefore(limite)) {
    final lista = _buscar(coincide);
    if (lista.isNotEmpty) return lista.last;
    await _esperar(200);
  }
  throw StateError('No apareció: $que');
}

Future<Element> _texto(String texto) =>
    _hasta((w) => w is Text && w.data == texto, 'texto «$texto»');

Future<Element> _clave(String clave) =>
    _hasta((w) => w.key == Key(clave), 'clave $clave');

Future<void> _ver(Element elemento, {double alineacion = 0.5}) async {
  await Scrollable.ensureVisible(
    elemento,
    alignment: alineacion,
    duration: const Duration(milliseconds: 100),
  );
  await _esperar(500);
}

Future<void> _tocar(Element elemento) async {
  final caja = elemento.renderObject! as RenderBox;
  final punto = caja.localToGlobal(caja.size.center(Offset.zero));
  final id = _puntero++;
  GestureBinding.instance.handlePointerEvent(
    PointerDownEvent(pointer: id, position: punto),
  );
  await _esperar(60);
  GestureBinding.instance.handlePointerEvent(
    PointerUpEvent(pointer: id, position: punto),
  );
  await _esperar();
}

Future<void> _tocarTexto(String texto) async => _tocar(await _texto(texto));

Future<void> _tocarClave(String clave) async {
  final elemento = await _clave(clave);
  await _ver(elemento);
  await _tocar(elemento);
}

void _fijarTexto(Element raiz, String valor) {
  TextEditingController? controlador;
  void visitar(Element e) {
    final w = e.widget;
    if (w is EditableText) controlador ??= w.controller;
    e.visitChildren(visitar);
  }

  visitar(raiz);
  controlador!.text = valor;
}

Future<void> _escribirClave(String clave, String valor) async {
  _fijarTexto(await _clave(clave), valor);
  await _esperar(400);
}

Future<void> _escribirEtiqueta(String etiqueta, String valor) async {
  final campo = await _hasta(
    (w) => w is TextField && w.decoration?.labelText == etiqueta,
    'campo $etiqueta',
  );
  _fijarTexto(campo, valor);
  await _esperar(300);
}

Future<void> _capturar(String nombre) async {
  await _esperar(700);
  await WidgetsBinding.instance.endOfFrame;
  final limite =
      _lienzo.currentContext!.findRenderObject()! as RenderRepaintBoundary;
  final imagen = await limite.toImage();
  final datos = await imagen.toByteData(format: ui.ImageByteFormat.png);
  final archivo = File('$_carpeta\\$nombre.png');
  await archivo.create(recursive: true);
  await archivo.writeAsBytes(datos!.buffer.asUint8List(), flush: true);
  print('CAPTURA $nombre');
}

Future<void> _paso(String nombre, Future<void> Function() accion) async {
  try {
    await accion();
  } catch (error) {
    _fallos.add('$nombre: $error');
    print('FALLO $nombre: $error');
  }
}

Future<BuildContext> _shell() async =>
    _hasta((w) => w is AppShell, 'el contenedor principal');

Future<void> _abrir(Widget pantalla) async {
  final contexto = await _shell();
  if (!contexto.mounted) return;
  Navigator.of(contexto).push(AppRoute<void>(builder: (_) => pantalla));
  await _esperar(1800);
}

Future<void> _volver() async {
  final contexto = await _shell();
  if (!contexto.mounted) return;
  Navigator.of(contexto).popUntil((ruta) => ruta.isFirst);
  await _esperar();
}

Future<void> _seccion(String titulo) async {
  // El destino del menú lateral (último texto con ese título dentro del menú).
  final destino = await _hasta(
    (w) => w is NavigationRail,
    'el menú lateral',
  );
  Element? encontrado;
  void visitar(Element e) {
    final w = e.widget;
    if (w is Text && w.data == titulo) encontrado = e;
    e.visitChildren(visitar);
  }

  destino.visitChildren(visitar);
  if (encontrado == null) throw StateError('Sin sección $titulo');
  await _ver(encontrado!);
  await _tocar(encontrado!);
  await _esperar(1500);
}

Future<void> _ingresar(String usuario, String clave) async {
  await _escribirEtiqueta('Usuario o correo', usuario);
  await _escribirEtiqueta('Contraseña', clave);
  await _tocarTexto('Iniciar sesión');
  await _esperar(1800);
}

Future<void> _salir() async {
  final contexto = await _shell();
  if (!contexto.mounted) return;
  Navigator.of(contexto).popUntil((ruta) => ruta.isFirst);
  await contexto.read<SessionProvider>().cerrarSesion();
  await _esperar(1500);
}

// ----------------------------------------------------------------- recorrido

Future<void> _recorrido() async {
  await _esperar(2500);

  await _paso('V5 términos', () async {
    await _ingresar('admin', 'Admin2026!');
    await _clave('version-terminos');
    await _capturar('V5-01-terminos-aceptacion-admin');
    await _tocarClave('boton-acepto');
    await _esperar(2000);
    await _capturar('V5-02-inicio-tras-aceptar');
  });

  List<ServiceOrder> ordenes = [];
  await _paso('órdenes', () async {
    final contexto = await _shell();
    if (!contexto.mounted) return;
    final api = contexto.read<ApiClient>();
    final datos = await api.get('/service-orders', query: {'limit': '50'});
    ordenes = [
      for (final o in (datos['orders'] as List))
        ServiceOrder.fromJson(Map<String, dynamic>.from(o as Map)),
    ];
  });
  ServiceOrder porProblema(String inicio) =>
      ordenes.firstWhere((o) => o.reportedProblem.startsWith(inicio));

  await _paso('V1 ticket anterior', () async {
    await _abrir(TicketScreen(orderId: porProblema('Vibración').id));
    await _capturar('V1-01-ticket-anterior');
    await _volver();
  });

  await _paso('V1 configuración', () async {
    await _seccion('Configuración');
    await _clave('campo-nombre-taller');
    await _capturar('V1-02-configuracion-taller');
    await _escribirClave('campo-nombre-taller', 'Taller Evidencia');
    await _escribirClave('campo-telefono-taller', '5598765432');
    await _tocarClave('boton-guardar-taller');
    await _esperar(1500);
    await _ver(await _clave('campo-nombre-taller'), alineacion: 0.2);
    await _capturar('V1-03-taller-guardado');
  });

  await _paso('V2 márgenes', () async {
    await _ver(await _clave('campo-margen-dias'), alineacion: 0.3);
    await _capturar('V2-01-margenes-de-proximo');
  });

  await _paso('V3 catálogo', () async {
    await _ver(await _clave('boton-nuevo-tipo'), alineacion: 0.1);
    await _capturar('V3-01-tipos-de-servicio');
    await _tocarClave('boton-nuevo-tipo');
    await _escribirClave('campo-nombre-tipo', 'Cambio de aceite');
    await _escribirClave('campo-intervalo-dias', '180');
    await _tocarClave('boton-guardar-tipo');
    await _esperar(1200);
    await _capturar('V3-02-nombre-repetido');
    await _tocarTexto('Cancelar');
    await _capturar('V3-03-cambios-sin-guardar');
    await _tocarTexto('Confirmar');
  });

  await _paso('V5 sección de términos', () async {
    await _ver(await _clave('version-vigente'), alineacion: 0.05);
    await _capturar('V5-03-terminos-en-configuracion');
  });

  await _paso('V4 ticket con próximo servicio', () async {
    await _abrir(TicketScreen(orderId: porProblema('Mantenimiento de').id));
    await _capturar('V4-01-ticket-nuevo-con-datos-del-taller');
    final seccion = await _texto('Próximo servicio');
    await _ver(seccion, alineacion: 0.3);
    await _capturar('V4-02-ticket-proximo-servicio');
    await _volver();
  });

  await _paso('V4 selector de tipo', () async {
    await _abrir(OrderDetailScreen(orden: porProblema('Falla eléctrica')));
    final boton = await _texto('Agregar servicio');
    await _ver(boton, alineacion: 0.2);
    await _tocar(boton);
    final selector = await _clave('selector-tipo-servicio');
    await _ver(selector);
    await _tocar(selector);
    await _capturar('V4-03-selector-de-tipo-de-servicio');
    await _tocarTexto('Sin tipo');
    await _volver();
  });

  await _paso('V4 propuesta de mantenimiento', () async {
    await _abrir(const MaintenanceFormScreen());
    final lista = await _hasta(
      (w) => w is DropdownButtonFormField,
      'el selector de vehículo',
    );
    await _tocar(lista);
    final opciones = _buscar(
      (w) => w is Text && (w.data ?? '').contains('ABC1234'),
    );
    await _tocar(opciones.last);
    await _esperar(1500);
    await _capturar('V4-04-propuesta-de-mantenimiento');
    final contexto = await _shell();
    if (contexto.mounted) {
      Navigator.of(contexto).popUntil((ruta) => ruta.isFirst);
    }
    await _esperar();
  });

  await _paso('V2 mantenimientos', () async {
    await _seccion('Mantenimientos');
    await _capturar('V2-02-lista-de-mantenimientos');
  });

  await _paso('V9 reportes', () async {
    await _seccion('Reportes');
    await _clave('tabla-ingresos');
    await _capturar('V9-01-ingresos');
    for (final (pestana, clave, nombre) in const [
      ('Servicios', 'tabla-servicios', 'V9-02-servicios'),
      ('Productividad', 'tabla-productividad', 'V9-03-productividad'),
      ('Margen de refacciones', 'tabla-margen', 'V9-04-margen-de-refacciones'),
      ('Rotación', 'tabla-rotacion', 'V9-05-rotacion'),
    ]) {
      await _tocar(
        await _hasta((w) => w is Tab && w.text == pestana, 'pestaña $pestana'),
      );
      await _clave(clave);
      await _capturar(nombre);
    }
  });

  await _paso('V10 exportación', () async {
    await _tocarClave('boton-exportar-csv');
    await _hasta(
      (w) => w is Text && (w.data ?? '').startsWith('Archivo guardado en'),
      'el mensaje de exportación',
    );
    await _capturar('V10-01-exportacion-csv');
  });

  await _paso('V6 bitácora', () async {
    await _seccion('Bitácora');
    await _clave('total-registros');
    await _capturar('V6-01-bitacora');
  });

  await _paso('V11 recepción', () async {
    await _salir();
    await _ingresar('recepcion', 'Recepcion2026!');
    await _clave('boton-acepto');
    await _tocarClave('boton-acepto');
    await _esperar(2000);
    await _capturar('V11-01-menu-recepcion');
  });

  await _paso('V11 mecánico', () async {
    await _salir();
    await _ingresar('mecanico', 'Mecanico2026!');
    await _clave('boton-acepto');
    await _tocarClave('boton-acepto');
    await _esperar(2000);
    await _capturar('V11-02-menu-mecanico');
  });

  await _paso('V8 inactividad', () async {
    await _salir();
    await _ingresar('admin', 'Admin2026!');
    final contexto = await _shell();
    if (!contexto.mounted) return;
    final api = contexto.read<ApiClient>();
    // Se adelanta en la base de pruebas la última actividad 31 minutos y la
    // siguiente llamada recibe 401 SESSION_IDLE del backend real.
    final resultado = await Process.run('node', [_guion, 'idle']);
    if (resultado.exitCode != 0) throw StateError('${resultado.stderr}');
    try {
      await api.get('/clients');
    } on ApiError catch (e) {
      print('API ${e.status} ${e.code}');
    }
    await _clave('aviso-sesion');
    await _capturar('V8-01-sesion-cerrada-por-inactividad');
  });

  print('FIN fallos=${_fallos.length}');
  for (final f in _fallos) {
    print('  - $f');
  }
  await _esperar(500);
  exit(0);
}
