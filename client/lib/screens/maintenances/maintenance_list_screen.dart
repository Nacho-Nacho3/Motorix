import 'package:data_table_2/data_table_2.dart';
import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../models/maintenance.dart';
import '../../providers/maintenances_provider.dart';
import '../../utils/app_route.dart';
import '../../utils/app_theme.dart';
import '../../widgets/states_view.dart';
import 'maintenance_form_screen.dart';

/// Listado de mantenimientos registrados por vehículo (T034, T038, US3/US4).
/// Tabla densa con chips de filtro y etiquetas de estado por urgencia.
class MaintenanceListScreen extends StatefulWidget {
  const MaintenanceListScreen({super.key});

  @override
  State<MaintenanceListScreen> createState() => _MaintenanceListScreenState();
}

class _MaintenanceListScreenState extends State<MaintenanceListScreen> {
  @override
  void initState() {
    super.initState();
    // Se carga tras el primer frame para no notificar durante la construcción.
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (mounted) context.read<MaintenancesProvider>().cargar();
    });
  }

  Future<void> _abrirAlta() async {
    await Navigator.of(context).push<bool>(
      AppRoute(builder: (_) => const MaintenanceFormScreen()),
    );
    // El alta ya recarga la lista desde el provider.
  }

  /// Chips de filtro por estado (SC-003): '' = todos.
  Widget _filtros(MaintenancesProvider proveedor) {
    const opciones = <(String, String)>[
      ('', 'Todos'),
      ('NORMAL', 'Normales'),
      ('UPCOMING', 'Próximos'),
      ('OVERDUE', 'Vencidos'),
    ];

    return Wrap(
      spacing: AppSpacing.sm,
      runSpacing: AppSpacing.xs,
      children: [
        for (final (valor, etiqueta) in opciones)
          FilterChip(
            label: Text(etiqueta),
            selected: proveedor.filtroEstado == valor,
            onSelected: (_) => proveedor.filtrarPorEstado(valor),
          ),
      ],
    );
  }

  bool _hayFiltros(MaintenancesProvider proveedor) =>
      proveedor.error == null &&
      (proveedor.mantenimientos.isNotEmpty ||
          proveedor.filtroEstado.isNotEmpty);

  @override
  Widget build(BuildContext context) {
    final proveedor = context.watch<MaintenancesProvider>();

    return Scaffold(
      backgroundColor: AppColors.background,
      floatingActionButton: FloatingActionButton.extended(
        onPressed: _abrirAlta,
        icon: const Icon(Icons.build_outlined),
        label: const Text('Registrar'),
      ),
      body: Padding(
        padding: const EdgeInsets.all(AppSpacing.xl),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Row(
              children: [
                Text(
                  'Mantenimientos registrados',
                  style: Theme.of(context).textTheme.titleMedium,
                ),
                const SizedBox(width: AppSpacing.md),
                Text(
                  'Total: ${proveedor.total}',
                  style: const TextStyle(color: AppColors.textSecondary),
                ),
              ],
            ),
            if (_hayFiltros(proveedor)) ...[
              const SizedBox(height: AppSpacing.md),
              _filtros(proveedor),
            ],
            const SizedBox(height: AppSpacing.lg),
            Expanded(child: _contenido(proveedor)),
          ],
        ),
      ),
    );
  }

  Widget _contenido(MaintenancesProvider proveedor) {
    if (proveedor.cargando) {
      return const LoadingView(mensaje: 'Cargando mantenimientos…');
    }
    if (proveedor.error != null) {
      return ErrorView(
        mensaje: proveedor.error!,
        onReintentar: proveedor.reintentar,
      );
    }
    if (proveedor.mantenimientos.isEmpty) {
      return EmptyView(
        icono: Icons.build_outlined,
        mensaje: proveedor.filtroEstado.isNotEmpty
            ? 'No hay mantenimientos con el estado elegido.'
            : 'Aún no hay mantenimientos registrados.',
        accion: ElevatedButton.icon(
          onPressed: _abrirAlta,
          icon: const Icon(Icons.build_outlined),
          label: const Text('Registrar mantenimiento'),
        ),
      );
    }

    // DataTable2 tiene scroll propio: no envolverlo en otro scroll vertical.
    return DataTable2(
      minWidth: 700,
      columnSpacing: 16,
      columns: const [
        DataColumn2(label: Text('Vehículo'), size: ColumnSize.L),
        DataColumn2(label: Text('Cliente'), size: ColumnSize.S),
        DataColumn2(label: Text('Estado'), size: ColumnSize.M),
        DataColumn2(label: Text('Próximo mantenimiento'), size: ColumnSize.M),
        DataColumn2(label: Text('Antelación'), size: ColumnSize.S),
        DataColumn2(label: Text('Recomendaciones'), size: ColumnSize.L),
      ],
      rows: [
        for (final mantenimiento in proveedor.mantenimientos)
          DataRow(
            cells: [
              DataCell(Text(mantenimiento.vehicleLabel)),
              DataCell(Text(mantenimiento.clientName)),
              DataCell(_EtiquetaEstado(mantenimiento: mantenimiento)),
              DataCell(Text(_objetivo(mantenimiento))),
              DataCell(
                Text(
                  '${mantenimiento.warnDays} días · ${mantenimiento.warnKm} km',
                ),
              ),
              DataCell(
                Text(
                  mantenimiento.recommendations ?? '—',
                  maxLines: 2,
                  overflow: TextOverflow.ellipsis,
                ),
              ),
            ],
          ),
      ],
    );
  }

  /// Fecha y/o kilometraje objetivo en pantalla (RN-11 admite cualquiera).
  String _objetivo(Maintenance mantenimiento) {
    final partes = <String>[];
    if (mantenimiento.nextDueDate != null) {
      partes.add(_fechaCorta(mantenimiento.nextDueDate!));
    }
    if (mantenimiento.nextDueMileage != null) {
      partes.add('${mantenimiento.nextDueMileage} km');
    }
    return partes.isEmpty ? '—' : partes.join(' · ');
  }

  String _fechaCorta(String fecha) {
    final partes = fecha.split('-');
    if (partes.length != 3) return fecha;
    return '${partes[2]}/${partes[1]}/${partes[0]}';
  }
}

/// Píldora con el estado en español del mantenimiento (CA-7: verde Normal,
/// ámbar Próximo, rojo Vencido; tokens del sistema de diseño).
class _EtiquetaEstado extends StatelessWidget {
  const _EtiquetaEstado({required this.mantenimiento});

  final Maintenance mantenimiento;

  Color get _color => switch (mantenimiento.state) {
        'OVERDUE' => AppColors.danger,
        'UPCOMING' => AppColors.warning,
        _ => AppColors.success,
      };

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(
        horizontal: AppSpacing.sm,
        vertical: AppSpacing.xs,
      ),
      decoration: BoxDecoration(
        color: _color.withValues(alpha: 0.14),
        borderRadius: BorderRadius.circular(AppRadii.pill),
      ),
      child: Text(
        mantenimiento.etiquetaEstado,
        style: Theme.of(context)
            .textTheme
            .bodySmall
            ?.copyWith(color: _color, fontWeight: FontWeight.w600),
      ),
    );
  }
}
