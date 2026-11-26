// Herramienta de evidencias del Sprint 5 (C-04, C-05 y C-12): ejecuta la
// aplicación real contra el backend en http://localhost:3000 con la base de
// pruebas recién sembrada, recorre el flujo del SC-008 y guarda las imágenes en
// docs/evidencias/sprint-5/. No forma parte del producto.
//
//   flutter run -d windows -t tool/capturas_sprint5.dart
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
import 'package:motorix_client/screens/orders/order_detail_screen.dart';
import 'package:motorix_client/screens/tickets/ticket_screen.dart';
import 'package:motorix_client/services/api_client.dart';
import 'package:motorix_client/utils/app_route.dart';
import 'package:motorix_client/widgets/app_shell.dart';

const _carpeta = r'C:\sdd\motorix\docs\evidencias\sprint-5';
final _lienzo = GlobalKey();
final _reloj = Stopwatch();
final _rotulo = ValueNotifier<String>('');
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
          child: RepaintBoundary(
            key: _lienzo,
            child: Stack(
              children: [
                const Positioned.fill(child: MotorixApp()),
                Positioned(
                  right: 16,
                  bottom: 16,
                  child: ValueListenableBuilder<String>(
                    valueListenable: _rotulo,
                    builder: (_, texto, _) => texto.isEmpty
                        ? const SizedBox.shrink()
                        : ColoredBox(
                            color: const Color(0xFF111827),
                            child: Padding(
                              padding: const EdgeInsets.all(12),
                              child: Text(
                                texto,
                                style: const TextStyle(
                                  color: Color(0xFFFFFFFF),
                                  fontSize: 18,
                                ),
                              ),
                            ),
                          ),
                  ),
                ),
              ],
            ),
          ),
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

Future<void> _aceptarTerminos() async {
  await _esperar(1000);
  if (_buscar((w) => w.key == const Key('boton-acepto')).isNotEmpty) {
    await _tocarClave('boton-acepto');
    await _esperar(2000);
  }
}

Future<void> _entrar(String usuario, String clave) async {
  await _ingresar(usuario, clave);
  await _aceptarTerminos();
}

Future<ServiceOrder> _orden(String problema) async {
  final contexto = await _shell();
  if (!contexto.mounted) throw StateError('Sin contexto');
  final api = contexto.read<ApiClient>();
  final datos = await api.get('/service-orders', query: {'limit': '50'});
  return [
    for (final o in (datos['orders'] as List))
      ServiceOrder.fromJson(Map<String, dynamic>.from(o as Map)),
  ].firstWhere((o) => o.reportedProblem.startsWith(problema));
}

Future<void> _tocarVisible(Element elemento) async {
  await _ver(elemento);
  await _tocar(elemento);
}

Future<void> _avanzar(String destino) async {
  await _tocarVisible(
    await _hasta((w) => w is DropdownButton<String>, 'siguiente estado'),
  );
  await _tocarTexto(destino);
  await _tocarVisible(await _texto('Cambiar estado'));
  await _tocarTexto('Confirmar');
  await _esperar(1800);
}

Future<Element> _campoPrecio() => _hasta(
  (w) => w is TextField && w.decoration?.labelText == 'Precio de venta',
  'precio de venta',
);

Future<void> _abrirBalata() async {
  await _seccion('Inventario');
  await _tocarVisible(await _texto('BAL-001'));
  await _esperar(1000);
  await _ver(await _campoPrecio());
}

Future<void> _verRefacciones() async {
  await _ver(await _texto('Refacciones'), alineacion: 0.15);
}

Future<void> _recorrido() async {
  await _esperar(2500);
  const problema = 'Ruido al frenar';

  await _paso('flujo SC-008', () async {
    _reloj.start();
    await _entrar('admin', 'Admin2026!');
    await _abrirBalata();
    await _capturar('flujo-01-precio-inicial');
    await _volver();

    await _salir();
    await _entrar('mecanico', 'Mecanico2026!');
    var orden = await _orden(problema);
    await _abrir(OrderDetailScreen(orden: orden));
    await _tocarVisible(
      await _hasta((w) => w is DropdownButtonFormField<int>, 'refacción'),
    );
    await _tocarTexto('FIL-002 · Filtro de aceite');
    await _escribirEtiqueta('Cantidad', '1');
    await _tocarVisible(await _texto('Agregar'));
    await _texto('Refacción agregada a la orden.');
    await _verRefacciones();
    await _capturar('flujo-02-refaccion-agregada');
    await _avanzar('En reparación');
    await _avanzar('Terminado');
    orden = await _orden(problema);
    if (orden.status != 'FINISHED') throw StateError(orden.status);
    await _volver();

    await _salir();
    await _entrar('recepcion', 'Recepcion2026!');
    orden = await _orden(problema);
    await _abrir(OrderDetailScreen(orden: orden));
    await _tocarVisible(await _texto('Registrar pago'));
    await _esperar(1800);
    await _capturar('flujo-03-total-a-cobrar');
    await _tocarVisible(await _texto('Registrar pago'));
    await _tocarTexto('Confirmar');
    await _esperar(2000);
    await _capturar('flujo-04-pago-registrado');
    await _volver();
    await _abrir(TicketScreen(orderId: orden.id));
    await _capturar('flujo-05-ticket');
    await _volver();

    await _salir();
    await _entrar('admin', 'Admin2026!');
    await _abrirBalata();
    _fijarTexto(await _campoPrecio(), '950.00');
    await _esperar(400);
    await _tocarVisible(await _texto('Guardar cambios'));
    await _esperar(1800);
    await _volver();
    orden = await _orden(problema);
    await _abrir(OrderDetailScreen(orden: orden));
    await _verRefacciones();
    await _texto(r'$850.00');
    _reloj.stop();
    final s = _reloj.elapsed.inSeconds;
    _rotulo.value =
        'Recorrido SC-008 automatizado, sin errores: '
        '${(s ~/ 60).toString().padLeft(2, '0')}:'
        '${(s % 60).toString().padLeft(2, '0')}';
    await _capturar('captura-tiempos-sc-008-flujo-demostrable');
    print('DURACION $s');
    _rotulo.value = '';
    await _capturar('captura-rf-01-instantanea-precio-linea');
    await _volver();
  });

  await _paso('C-04 catálogo', () async {
    await _abrirBalata();
    await _capturar('captura-rf-01-instantanea-precio-catalogo');
    await _volver();
  });

  await _paso('C-05 tickets', () async {
    await _abrir(TicketScreen(orderId: (await _orden('Vibración')).id));
    await _capturar('captura-rf-02-ticket-anterior');
    await _volver();
    await _abrir(TicketScreen(orderId: (await _orden(problema)).id));
    await _capturar('captura-rf-02-ticket-nuevo');
    await _volver();
  });

  print('FIN fallos=${_fallos.length}');
  for (final f in _fallos) {
    print('  - $f');
  }
  await _esperar(500);
  exit(0);
}
