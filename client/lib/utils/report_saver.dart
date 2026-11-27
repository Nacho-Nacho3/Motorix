import 'report_saver_base.dart';
import 'report_saver_io.dart'
    if (dart.library.js_interop) 'report_saver_web.dart'
    as plataforma;

export 'report_saver_base.dart';

/// Guarda el reporte según la plataforma: en la carpeta del usuario en el
/// escritorio, o como descarga en el navegador.
Future<ArchivoGuardado> guardarReporte(String nombre, String contenido) =>
    plataforma.guardarReporte(nombre, contenido);
