import 'dart:convert';
import 'dart:js_interop';

import 'package:web/web.dart' as web;

import 'report_saver_base.dart';

/// En el navegador el reporte se entrega como una descarga.
Future<ArchivoGuardado> guardarReporte(String nombre, String contenido) async {
  final bytes = utf8.encode(conMarcaUtf8(contenido));
  final blob = web.Blob(
    [bytes.toJS].toJS,
    web.BlobPropertyBag(type: 'text/csv;charset=utf-8'),
  );
  final url = web.URL.createObjectURL(blob);
  final enlace = web.HTMLAnchorElement()
    ..href = url
    ..download = nombre;
  web.document.body!.append(enlace);
  enlace.click();
  enlace.remove();
  web.URL.revokeObjectURL(url);
  return ArchivoGuardado(ruta: nombre, mensaje: 'Archivo descargado: $nombre');
}
