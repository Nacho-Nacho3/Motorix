import 'dart:io';

import 'report_saver_base.dart';

/// Carpeta de las exportaciones: `Documentos\Motorix\reportes` del usuario.
Directory carpetaPorOmision() {
  final entorno = Platform.environment;
  final base = entorno['USERPROFILE'] ?? entorno['HOME'] ?? Directory.current.path;
  return Directory(
    [base, 'Documents', 'Motorix', 'reportes'].join(Platform.pathSeparator),
  );
}

/// Escribe el reporte en la carpeta indicada (la crea si no existe).
GuardarReporte guardarEnCarpeta(Directory Function() carpetaDestino) {
  return (nombre, contenido) async {
    try {
      final carpeta = carpetaDestino();
      await carpeta.create(recursive: true);
      final archivo = File('${carpeta.path}${Platform.pathSeparator}$nombre');
      await archivo.writeAsString(conMarcaUtf8(contenido), flush: true);
      return ArchivoGuardado(
        ruta: archivo.path,
        mensaje: 'Archivo guardado en ${archivo.path}',
      );
    } on FileSystemException catch (e) {
      final motivo = e.osError?.message.isNotEmpty == true
          ? e.osError!.message
          : e.message;
      throw ErrorAlGuardar('No se pudo guardar el archivo: $motivo.');
    }
  };
}

Future<ArchivoGuardado> guardarReporte(String nombre, String contenido) =>
    guardarEnCarpeta(carpetaPorOmision)(nombre, contenido);
