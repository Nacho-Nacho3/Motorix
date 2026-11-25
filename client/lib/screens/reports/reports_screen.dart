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
      proveedor.cargarIngresos();
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
      length: 1,
      child: Scaffold(
        backgroundColor: AppColors.background,
        appBar: AppBar(
          title: const Text('Reportes'),
          bottom: const TabBar(
            isScrollable: true,
            tabs: [Tab(text: 'Ingresos')],
          ),
        ),
        body: Padding(
          padding: const EdgeInsets.all(AppSpacing.lg),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              _selectorPeriodo(proveedor),
              const SizedBox(height: AppSpacing.md),
              const Expanded(
                child: TabBarView(children: [PestanaIngresos()]),
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
class CuerpoReporte extends StatelessWidget {
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
