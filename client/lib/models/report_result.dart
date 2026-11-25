/// Resultado genérico de un reporte (Sprint 7, contracts/reports.md): periodo,
/// filas, totales y bandera de recorte. Las filas y los totales conservan las
/// claves del backend; cada pestaña sabe leer las suyas.
class ReportResult {
  const ReportResult({
    required this.from,
    required this.to,
    required this.rows,
    required this.totals,
    this.truncated = false,
    this.extras = const {},
  });

  final String from;
  final String to;
  final List<Map<String, dynamic>> rows;
  final Map<String, dynamic> totals;

  /// `true` si el listado superó el tope de 500 filas.
  final bool truncated;

  /// Campos propios de un reporte (p. ej. `approximateDates` de productividad).
  final Map<String, dynamic> extras;

  static const _claves = {'from', 'to', 'rows', 'totals', 'truncated'};

  factory ReportResult.fromJson(Map<String, dynamic> json) => ReportResult(
        from: json['from'] as String? ?? '',
        to: json['to'] as String? ?? '',
        rows: [
          for (final fila in (json['rows'] as List? ?? const []))
            Map<String, dynamic>.from(fila as Map),
        ],
        totals: Map<String, dynamic>.from((json['totals'] as Map?) ?? const {}),
        truncated: json['truncated'] as bool? ?? false,
        extras: {
          for (final e in json.entries)
            if (!_claves.contains(e.key)) e.key: e.value,
        },
      );

  bool get vacio => rows.isEmpty;

  /// Importe de un campo de totales como cadena de 2 decimales.
  String importe(String clave) => (totals[clave] as String?) ?? '0.00';
}

/// Una fila del reporte de ingresos (por fecha y método de pago).
class FilaIngreso {
  const FilaIngreso({
    required this.date,
    required this.method,
    required this.count,
    required this.total,
  });

  final String date;
  final String method;
  final int count;
  final String total;

  factory FilaIngreso.fromJson(Map<String, dynamic> json) => FilaIngreso(
        date: json['date'] as String? ?? '',
        method: json['method'] as String? ?? '',
        count: (json['count'] as num?)?.toInt() ?? 0,
        total: json['total'] as String? ?? '0.00',
      );

  /// `dd/mm/aaaa` a partir de `YYYY-MM-DD`.
  String get fechaLegible => date.length < 10
      ? date
      : '${date.substring(8, 10)}/${date.substring(5, 7)}/${date.substring(0, 4)}';

  String get etiquetaMetodo => etiquetaMetodoDePago(method);
}

/// Etiqueta en español del método de pago.
String etiquetaMetodoDePago(String metodo) => switch (metodo) {
      'CASH' => 'Efectivo',
      'CARD' => 'Tarjeta',
      'TRANSFER' => 'Transferencia',
      'MERCADO_PAGO' => 'Mercado Pago',
      final otro => otro,
    };
