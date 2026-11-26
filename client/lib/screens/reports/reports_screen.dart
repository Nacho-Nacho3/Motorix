import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../models/report_result.dart';
import '../../providers/reports_provider.dart';
import '../../utils/app_theme.dart';
import '../../widgets/states_view.dart';

/// Reportes del taller (Sprint 7, US4 a US7, solo ADMIN). El selector de periodo
/// es común a todas las pestañas; cada pestaña consulta su reporte, que el
/// backend calcula en cada consulta.
class ReportsScreen extends StatefulWidget {
  const ReportsScreen({super.key});

  @override
  State<ReportsScreen> createState() => _ReportsScreenState();
}

class _ReportsScreenState extends State<ReportsScreen> {
  final _desde = TextEditingController();
  final _hasta = TextEditingController();

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!mounted) return;
      final proveedor = context.read<ReportsProvider>();
      _desde.text = proveedor.desde;
      _hasta.text = proveedor.hasta;
    });
  }

  @override
  void dispose() {
    _desde.dispose();
    _hasta.dispose();
    super.dispose();
  }

  Future<void> _elegirFecha(TextEditingController controlador) async {
    final inicial = DateTime.tryParse(controlador.text) ?? DateTime.now();
    final dia = await showDatePicker(
      context: context,
      initialDate: inicial,
      firstDate: DateTime(2020),
      lastDate: DateTime(2100),
    );
    if (dia != null && mounted) {
      setState(() => controlador.text = ReportsProvider.formato(dia));
    }
  }

  void _atajo(AtajoPeriodo atajo) {
    final proveedor = context.read<ReportsProvider>();
    proveedor.aplicarAtajo(atajo);
    setState(() {
      _desde.text = proveedor.desde;
      _hasta.text = proveedor.hasta;
    });
  }

  void _aplicarRango() {
    context.read<ReportsProvider>().aplicarRango(_desde.text, _hasta.text);
  }

  @override
  Widget build(BuildContext context) {
    final proveedor = context.watch<ReportsProvider>();

    return DefaultTabController(
      length: 5,
      child: Scaffold(
        backgroundColor: AppColors.background,
        body: Padding(
          padding: const EdgeInsets.all(AppSpacing.lg),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              // El título de la sección ya está en la cabecera del menú.
              const TabBar(
                isScrollable: true,
                tabAlignment: TabAlignment.start,
                tabs: [
                  Tab(text: 'Ingresos'),
                  Tab(text: 'Servicios'),
                  Tab(text: 'Productividad'),
                  Tab(text: 'Margen de refacciones'),
                  Tab(text: 'Rotación'),
                ],
              ),
              const SizedBox(height: AppSpacing.md),
              _selectorPeriodo(proveedor),
              const SizedBox(height: AppSpacing.md),
              const Expanded(
                child: TabBarView(
                  children: [
                    PestanaIngresos(),
                    PestanaServicios(),
                    PestanaProductividad(),
                    PestanaMargen(),
                    PestanaRotacion(),
                  ],
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _selectorPeriodo(ReportsProvider proveedor) {
    return Card(
      color: AppColors.surface,
      child: Padding(
        padding: const EdgeInsets.all(AppSpacing.md),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Wrap(
              spacing: AppSpacing.sm,
              runSpacing: AppSpacing.sm,
              crossAxisAlignment: WrapCrossAlignment.center,
              children: [
                const Text('Periodo:'),
                for (final (atajo, etiqueta) in const [
                  (AtajoPeriodo.hoy, 'Hoy'),
                  (AtajoPeriodo.semana, 'Semana'),
                  (AtajoPeriodo.mes, 'Mes'),
                  (AtajoPeriodo.libre, 'Rango libre'),
                ])
                  ChoiceChip(
                    key: Key('periodo-${atajo.name}'),
                    label: Text(etiqueta),
                    selected: proveedor.atajo == atajo,
                    onSelected: (_) => atajo == AtajoPeriodo.libre
                        ? context.read<ReportsProvider>().aplicarAtajo(
                              AtajoPeriodo.libre,
                              recargar: false,
                            )
                        : _atajo(atajo),
                  ),
              ],
            ),
            if (proveedor.atajo == AtajoPeriodo.libre) ...[
              const SizedBox(height: AppSpacing.md),
              Wrap(
                spacing: AppSpacing.md,
                runSpacing: AppSpacing.sm,
                crossAxisAlignment: WrapCrossAlignment.center,
                children: [
                  SizedBox(
                    width: 170,
                    child: TextField(
                      key: const Key('rango-desde'),
                      controller: _desde,
                      readOnly: true,
                      onTap: () => _elegirFecha(_desde),
                      decoration: const InputDecoration(
                        labelText: 'Desde',
                        suffixIcon: Icon(Icons.calendar_month_outlined),
                      ),
                    ),
                  ),
                  SizedBox(
                    width: 170,
                    child: TextField(
                      key: const Key('rango-hasta'),
                      controller: _hasta,
                      readOnly: true,
                      onTap: () => _elegirFecha(_hasta),
                      decoration: const InputDecoration(
                        labelText: 'Hasta',
                        suffixIcon: Icon(Icons.calendar_month_outlined),
                      ),
                    ),
                  ),
                  FilledButton(
                    key: const Key('boton-aplicar-rango'),
                    onPressed: _aplicarRango,
                    child: const Text('Aplicar'),
                  ),
                ],
              ),
            ],
            const SizedBox(height: AppSpacing.sm),
            const _BotonExportar(),
            if (proveedor.errorPeriodo != null) ...[
              const SizedBox(height: AppSpacing.sm),
              Text(
                proveedor.errorPeriodo!,
                key: const Key('error-periodo'),
                style: const TextStyle(color: AppColors.danger),
              ),
            ],
            const SizedBox(height: AppSpacing.sm),
            Text(
              'Del ${_legible(proveedor.desde)} al ${_legible(proveedor.hasta)}',
              key: const Key('periodo-vigente'),
              style: const TextStyle(color: AppColors.textSecondary),
            ),
          ],
        ),
      ),
    );
  }

  static String _legible(String fecha) => fecha.length < 10
      ? fecha
      : '${fecha.substring(8, 10)}/${fecha.substring(5, 7)}/${fecha.substring(0, 4)}';
}

/// Estados comunes de una pestaña de reporte: carga, error, vacío y contenido.
/// Consulta su reporte al mostrarse por primera vez.
class CuerpoReporte extends StatefulWidget {
  const CuerpoReporte({
    super.key,
    required this.nombre,
    required this.mensajeVacio,
    required this.contenido,
  });

  final String nombre;
  final String mensajeVacio;
  final Widget Function(ReportResult resultado) contenido;

  @override
  State<CuerpoReporte> createState() => _CuerpoReporteState();
}

class _CuerpoReporteState extends State<CuerpoReporte> {
  String get nombre => widget.nombre;
  String get mensajeVacio => widget.mensajeVacio;
  Widget Function(ReportResult) get contenido => widget.contenido;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!mounted) return;
      final proveedor = context.read<ReportsProvider>();
      if (proveedor.resultados[nombre] == null &&
          proveedor.cargando[nombre] != true) {
        proveedor.cargar(nombre);
      }
    });
  }

  @override
  Widget build(BuildContext context) {
    final proveedor = context.watch<ReportsProvider>();
    final resultado = proveedor.resultados[nombre];
    final error = proveedor.errores[nombre];

    if (resultado == null) {
      if (error != null) {
        return ErrorView(mensaje: error, onReintentar: () => proveedor.cargar(nombre));
      }
      return const LoadingView(mensaje: 'Calculando el reporte…');
    }
    if (error != null && resultado.vacio) {
      return ErrorView(mensaje: error, onReintentar: () => proveedor.cargar(nombre));
    }
    if (resultado.vacio) {
      return EmptyView(mensaje: mensajeVacio, icono: Icons.bar_chart_outlined);
    }
    return Stack(
      children: [
        contenido(resultado),
        if (proveedor.cargando[nombre] == true)
          const Positioned(top: 0, right: 0, child: CircularProgressIndicator()),
      ],
    );
  }
}

/// Pestaña «Ingresos»: pagos cobrados por fecha y método (US4, FR-012).
class PestanaIngresos extends StatelessWidget {
  const PestanaIngresos({super.key});

  @override
  Widget build(BuildContext context) {
    return CuerpoReporte(
      nombre: 'income',
      mensajeVacio: 'No hay pagos cobrados en este periodo.',
      contenido: (resultado) {
        final filas = [for (final f in resultado.rows) FilaIngreso.fromJson(f)];
        final porMetodo = [
          for (final m in (resultado.totals['byMethod'] as List? ?? const []))
            FilaIngreso.fromJson({...Map<String, dynamic>.from(m as Map), 'date': ''}),
        ];
        return SingleChildScrollView(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Card(
                color: AppColors.surface,
                child: Padding(
                  padding: const EdgeInsets.all(AppSpacing.lg),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      const Text('Total cobrado', style: TextStyle(color: AppColors.textSecondary)),
                      Text(
                        '\$${resultado.importe('total')}',
                        key: const Key('total-ingresos'),
                        style: const TextStyle(
                          fontSize: AppFontSizes.title,
                          fontWeight: FontWeight.w700,
                          color: AppColors.primary,
                        ),
                      ),
                      Text(
                        '${resultado.totals['count'] ?? 0} pagos',
                        key: const Key('conteo-ingresos'),
                      ),
                      const SizedBox(height: AppSpacing.sm),
                      Wrap(
                        spacing: AppSpacing.lg,
                        children: [
                          for (final m in porMetodo)
                            Text('${m.etiquetaMetodo}: \$${m.total} (${m.count})'),
                        ],
                      ),
                    ],
                  ),
                ),
              ),
              if (resultado.truncated)
                const Padding(
                  padding: EdgeInsets.only(top: AppSpacing.sm),
                  child: Text(
                    'Se muestran las primeras 500 filas; los totales incluyen todos los pagos.',
                    key: Key('aviso-recorte'),
                    style: TextStyle(color: AppColors.warning),
                  ),
                ),
              const SizedBox(height: AppSpacing.md),
              Card(
                color: AppColors.surface,
                child: SingleChildScrollView(
                  scrollDirection: Axis.horizontal,
                  child: DataTable(
                    key: const Key('tabla-ingresos'),
                    columns: const [
                      DataColumn(label: Text('Fecha')),
                      DataColumn(label: Text('Método')),
                      DataColumn(label: Text('Pagos'), numeric: true),
                      DataColumn(label: Text('Importe'), numeric: true),
                    ],
                    rows: [
                      for (final f in filas)
                        DataRow(cells: [
                          DataCell(Text(f.fechaLegible)),
                          DataCell(Text(f.etiquetaMetodo)),
                          DataCell(Text('${f.count}')),
                          DataCell(Text('\$${f.total}')),
                        ]),
                    ],
                  ),
                ),
              ),
            ],
          ),
        );
      },
    );
  }
}

/// Pestaña «Servicios»: servicios más frecuentes del periodo (US5, FR-010).
class PestanaServicios extends StatelessWidget {
  const PestanaServicios({super.key});

  @override
  Widget build(BuildContext context) {
    return CuerpoReporte(
      nombre: 'services',
      mensajeVacio: 'No hay servicios en órdenes terminadas en este periodo.',
      contenido: (resultado) => SingleChildScrollView(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            _resumen(
              etiqueta: 'Servicios realizados',
              valor: '${resultado.totals['count'] ?? 0}',
              clave: const Key('total-servicios'),
              detalle: 'Importe: \$${resultado.importe('amount')}',
            ),
            const SizedBox(height: AppSpacing.md),
            Card(
              color: AppColors.surface,
              child: SingleChildScrollView(
                scrollDirection: Axis.horizontal,
                child: DataTable(
                  key: const Key('tabla-servicios'),
                  columns: const [
                    DataColumn(label: Text('Tipo de servicio')),
                    DataColumn(label: Text('Cantidad'), numeric: true),
                    DataColumn(label: Text('Importe'), numeric: true),
                  ],
                  rows: [
                    for (final fila in resultado.rows)
                      DataRow(cells: [
                        DataCell(Text('${fila['serviceType']}')),
                        DataCell(Text('${fila['count']}')),
                        DataCell(Text('\$${fila['amount']}')),
                      ]),
                  ],
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

/// Pestaña «Productividad»: órdenes terminadas y mano de obra por mecánico
/// (US5, FR-010), con la nota de fechas aproximadas (D-19).
class PestanaProductividad extends StatelessWidget {
  const PestanaProductividad({super.key});

  @override
  Widget build(BuildContext context) {
    return CuerpoReporte(
      nombre: 'productivity',
      mensajeVacio: 'No hay órdenes terminadas en este periodo.',
      contenido: (resultado) {
        final aproximadas =
            (resultado.extras['approximateDates'] as num?)?.toInt() ?? 0;
        return SingleChildScrollView(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              _resumen(
                etiqueta: 'Órdenes terminadas',
                valor: '${resultado.totals['ordersFinished'] ?? 0}',
                clave: const Key('total-ordenes'),
                detalle: 'Mano de obra: \$${resultado.importe('laborAmount')}',
              ),
              if (aproximadas > 0)
                Padding(
                  padding: const EdgeInsets.only(top: AppSpacing.sm),
                  child: Text(
                    '$aproximadas ${aproximadas == 1 ? 'orden tiene' : 'órdenes tienen'} una fecha de '
                    'terminación aproximada (anterior a este sprint): su periodo puede no ser exacto.',
                    key: const Key('nota-fechas-aproximadas'),
                    style: const TextStyle(color: AppColors.warning),
                  ),
                ),
              const SizedBox(height: AppSpacing.md),
              Card(
                color: AppColors.surface,
                child: SingleChildScrollView(
                  scrollDirection: Axis.horizontal,
                  child: DataTable(
                    key: const Key('tabla-productividad'),
                    columns: const [
                      DataColumn(label: Text('Mecánico')),
                      DataColumn(label: Text('Órdenes terminadas'), numeric: true),
                      DataColumn(label: Text('Mano de obra'), numeric: true),
                    ],
                    rows: [
                      for (final fila in resultado.rows)
                        DataRow(cells: [
                          DataCell(Text('${fila['mechanicName']}')),
                          DataCell(Text('${fila['ordersFinished']}')),
                          DataCell(Text('\$${fila['laborAmount']}')),
                        ]),
                    ],
                  ),
                ),
              ),
            ],
          ),
        );
      },
    );
  }
}

/// Tarjeta de resumen compartida por las pestañas de reporte.
Widget _resumen({
  required String etiqueta,
  required String valor,
  required Key clave,
  required String detalle,
}) {
  return Card(
    color: AppColors.surface,
    child: Padding(
      padding: const EdgeInsets.all(AppSpacing.lg),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(etiqueta, style: const TextStyle(color: AppColors.textSecondary)),
          Text(
            valor,
            key: clave,
            style: const TextStyle(
              fontSize: AppFontSizes.title,
              fontWeight: FontWeight.w700,
              color: AppColors.primary,
            ),
          ),
          Text(detalle),
        ],
      ),
    ),
  );
}

/// Pestaña «Margen de refacciones»: ventas, costo y margen por refacción con el
/// costo congelado de cada línea (US6, FR-010, D-05). Las líneas sin costo
/// registrado se muestran aparte y no entran al margen.
class PestanaMargen extends StatelessWidget {
  const PestanaMargen({super.key});

  @override
  Widget build(BuildContext context) {
    return CuerpoReporte(
      nombre: 'parts-margin',
      mensajeVacio: 'No hay refacciones vendidas en órdenes terminadas en este periodo.',
      contenido: (resultado) {
        final sinCosto = (resultado.totals['unitsWithoutCost'] as num?)?.toInt() ?? 0;
        return SingleChildScrollView(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              _resumen(
                etiqueta: 'Margen de refacciones',
                valor: '\$${resultado.importe('marginAmount')}',
                clave: const Key('total-margen'),
                detalle:
                    'Ventas: \$${resultado.importe('salesAmount')} · Costo: \$${resultado.importe('costAmount')}',
              ),
              if (sinCosto > 0)
                Padding(
                  padding: const EdgeInsets.only(top: AppSpacing.sm),
                  child: Text(
                    '$sinCosto ${sinCosto == 1 ? 'unidad' : 'unidades'} sin costo registrado '
                    '(ventas por \$${resultado.importe('salesWithoutCost')}): no entran al margen.',
                    key: const Key('nota-sin-costo'),
                    style: const TextStyle(color: AppColors.warning),
                  ),
                ),
              const SizedBox(height: AppSpacing.md),
              Card(
                color: AppColors.surface,
                child: SingleChildScrollView(
                  scrollDirection: Axis.horizontal,
                  child: DataTable(
                    key: const Key('tabla-margen'),
                    columns: const [
                      DataColumn(label: Text('Código')),
                      DataColumn(label: Text('Refacción')),
                      DataColumn(label: Text('Unidades'), numeric: true),
                      DataColumn(label: Text('Ventas'), numeric: true),
                      DataColumn(label: Text('Costo'), numeric: true),
                      DataColumn(label: Text('Margen'), numeric: true),
                      DataColumn(label: Text('Sin costo')),
                    ],
                    rows: [
                      for (final fila in resultado.rows)
                        DataRow(cells: [
                          DataCell(Text('${fila['partCode']}')),
                          DataCell(Text('${fila['name']}')),
                          DataCell(Text('${fila['units']}')),
                          DataCell(Text('\$${fila['salesAmount']}')),
                          DataCell(Text('\$${fila['costAmount']}')),
                          DataCell(Text('\$${fila['marginAmount']}')),
                          DataCell(
                            (fila['unitsWithoutCost'] as num? ?? 0) > 0
                                ? Text(
                                    'Sin costo registrado: ${fila['unitsWithoutCost']} u. · \$${fila['salesWithoutCost']}',
                                    style: const TextStyle(color: AppColors.warning),
                                  )
                                : const Text('—'),
                          ),
                        ]),
                    ],
                  ),
                ),
              ),
            ],
          ),
        );
      },
    );
  }
}

/// Pestaña «Rotación»: unidades salidas entre la existencia promedio del
/// periodo (US6, D-08). Sin existencia promedio la rotación es «sin existencia».
class PestanaRotacion extends StatelessWidget {
  const PestanaRotacion({super.key});

  @override
  Widget build(BuildContext context) {
    return CuerpoReporte(
      nombre: 'inventory-rotation',
      mensajeVacio: 'No hay existencias ni movimientos de inventario en este periodo.',
      contenido: (resultado) => SingleChildScrollView(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            _resumen(
              etiqueta: 'Unidades salidas',
              valor: '${resultado.totals['unitsOut'] ?? 0}',
              clave: const Key('total-salidas'),
              detalle: 'Rotación = unidades salidas ÷ existencia promedio del periodo',
            ),
            const SizedBox(height: AppSpacing.md),
            Card(
              color: AppColors.surface,
              child: SingleChildScrollView(
                scrollDirection: Axis.horizontal,
                child: DataTable(
                  key: const Key('tabla-rotacion'),
                  columns: const [
                    DataColumn(label: Text('Código')),
                    DataColumn(label: Text('Refacción')),
                    DataColumn(label: Text('Unidades salidas'), numeric: true),
                    DataColumn(label: Text('Existencia promedio'), numeric: true),
                    DataColumn(label: Text('Rotación'), numeric: true),
                  ],
                  rows: [
                    for (final fila in resultado.rows)
                      DataRow(cells: [
                        DataCell(Text('${fila['partCode']}')),
                        DataCell(Text('${fila['name']}')),
                        DataCell(Text('${fila['unitsOut']}')),
                        DataCell(Text('${fila['averageStock']}')),
                        DataCell(Text(fila['rotation'] == null ? 'Sin existencia' : '${fila['rotation']}')),
                      ]),
                  ],
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

/// Reportes en el orden de las pestañas, para saber cuál exportar.
const List<String> _nombresDeReporte = [
  'income',
  'services',
  'productivity',
  'parts-margin',
  'inventory-rotation',
];

/// Botón «Exportar CSV» (US7, FR-014): exporta la pestaña visible con el periodo
/// vigente y muestra la ruta del archivo o el error en un mensaje.
class _BotonExportar extends StatelessWidget {
  const _BotonExportar();

  Future<void> _exportar(BuildContext context) async {
    final proveedor = context.read<ReportsProvider>();
    final mensajero = ScaffoldMessenger.of(context);
    final nombre = _nombresDeReporte[DefaultTabController.of(context).index];
    await proveedor.exportar(nombre);
    final mensaje = proveedor.mensajeExportacion;
    if (mensaje == null) return;
    mensajero.showSnackBar(
      SnackBar(
        key: const Key('mensaje-exportacion'),
        content: Text(mensaje),
        backgroundColor: proveedor.exportacionConError ? AppColors.danger : null,
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final exportando = context.select<ReportsProvider, bool>((p) => p.exportando);
    return Align(
      alignment: Alignment.centerLeft,
      child: OutlinedButton.icon(
        key: const Key('boton-exportar-csv'),
        onPressed: exportando ? null : () => _exportar(context),
        icon: const Icon(Icons.file_download_outlined),
        label: Text(exportando ? 'Exportando…' : 'Exportar CSV'),
      ),
    );
  }
}
