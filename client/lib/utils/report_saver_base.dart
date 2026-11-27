/// Resultado de guardar un reporte exportado.
class ArchivoGuardado {
  const ArchivoGuardado({required this.ruta, required this.mensaje});

  /// Ruta del archivo en el escritorio o nombre de la descarga en el navegador.
  final String ruta;

  /// Texto para la persona usuaria.
  final String mensaje;
}

/// Error al guardar el archivo, ya con un mensaje para mostrar.
class ErrorAlGuardar implements Exception {
  const ErrorAlGuardar(this.mensaje);

  final String mensaje;
}

/// Cómo se guarda un reporte; cambia entre el escritorio y el navegador.
typedef GuardarReporte =
    Future<ArchivoGuardado> Function(String nombre, String contenido);

/// Antepone la marca UTF-8 (BOM) para que Excel muestre los acentos: la
/// decodificación de la respuesta la descarta.
String conMarcaUtf8(String contenido) =>
    contenido.startsWith('\u{FEFF}') ? contenido : '\u{FEFF}$contenido';
