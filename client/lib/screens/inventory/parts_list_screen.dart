import 'package:data_table_2/data_table_2.dart';
import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../models/part.dart';
import '../../providers/parts_provider.dart';
import '../../utils/app_route.dart';
import '../../utils/app_theme.dart';
import '../../widgets/states_view.dart';
import 'part_form_screen.dart';

/// Catálogo de refacciones con búsqueda, alerta de stock bajo y edición
/// por fila (T052, US5/US6/US8, FR-009, FR-014, CA-7).
class PartsListScreen extends StatefulWidget {
  const PartsListScreen({super.key});

  @override
  State<PartsListScreen> createState() => _PartsListScreenState();
}

class _PartsListScreenState extends State<PartsListScreen> {
  @override
  void initState() {
    super.initState();
    // Se carga tras el primer frame para no notificar durante la construcción.
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (mounted) context.read<PartsProvider>().cargar();
    });
  }

  Future<void> _abrirAlta() async {
    await Navigator.of(context).push<bool>(
      AppRoute(builder: (_) => const PartFormScreen()),
    );
    // El alta y la edición ya recargan la lista desde el proveedor.
  }

  Future<void> _editar(Part parte) async {
    await Navigator.of(context).push<bool>(
      AppRoute(builder: (_) => PartFormScreen(parte: parte)),
    );
  }

  @override
  Widget build(BuildContext context) {
    final proveedor = context.watch<PartsProvider>();
    final enAlerta = proveedor.totalStockBajo > 0;

    return Scaffold(
      backgroundColor: AppColors.background,
      floatingActionButton: FloatingActionButton.extended(
        onPressed: _abrirAlta,
        icon: const Icon(Icons.add),
        label: const Text('Nueva'),
      ),
      body: Padding(
        padding: const EdgeInsets.all(AppSpacing.xl),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Row(
              children: [
                Expanded(
                  child: Text(
                    'Inventario de refacciones',
                    style: Theme.of(context).textTheme.titleMedium,
                    overflow: TextOverflow.ellipsis,
                  ),
                ),
                const SizedBox(width: AppSpacing.md),
                Text(
                  'Total: ${proveedor.total}',
                  style: const TextStyle(color: AppColors.textSecondary),
                ),
              ],
            ),
            const SizedBox(height: AppSpacing.md),
            Row(
              children: [
                Text(
                  'Stock bajo: ${proveedor.totalStockBajo}',
                  style: TextStyle(
                    color: enAlerta
                        ? AppColors.warning
                        : AppColors.textSecondary,
                    fontWeight: enAlerta ? FontWeight.w600 : FontWeight.normal,
                  ),
                ),
                const SizedBox(width: AppSpacing.md),
                // T076 (US8): el chip alimenta el filtro ?low=true (CA-7).
                FilterChip(
                  label: const Text('Stock bajo'),
                  selected: proveedor.soloStockBajo,
                  onSelected: proveedor.filtrarStockBajo,
                ),
                const Spacer(),
                SizedBox(
                  width: 280,
                  child: TextField(
                    decoration: const InputDecoration(
                      labelText: 'Buscar refacción',
                      hintText: 'Código, nombre o categoría',
                      prefixIcon: Icon(Icons.search),
                      isDense: true,
                      border: OutlineInputBorder(),
                    ),
                    onChanged: proveedor.buscar,
                  ),
                ),
              ],
            ),
            const SizedBox(height: AppSpacing.lg),
            Expanded(child: _contenido(proveedor)),
          ],
        ),
      ),
    );
  }

  Widget _contenido(PartsProvider proveedor) {
    if (proveedor.cargando) {
      return const LoadingView(mensaje: 'Cargando inventario…');
    }
    if (proveedor.error != null) {
      return ErrorView(
        mensaje: proveedor.error!,
        onReintentar: proveedor.reintentar,
      );
    }
    if (proveedor.refacciones.isEmpty) {
      if (proveedor.busqueda.isNotEmpty) {
        return EmptyView(
          icono: Icons.search_off,
          mensaje:
              'No hay refacciones que coincidan con "${proveedor.busqueda}".',
        );
      }
      if (proveedor.soloStockBajo) {
        // T076: el filtro activo sin resultados explica el vacío (FR-018).
        return const EmptyView(
          icono: Icons.notifications_none,
          mensaje: 'No hay refacciones con stock bajo.',
        );
      }
      return EmptyView(
        icono: Icons.inventory_2_outlined,
        mensaje: 'Aún no hay refacciones registradas.',
        accion: ElevatedButton.icon(
          onPressed: _abrirAlta,
          icon: const Icon(Icons.add),
          label: const Text('Registrar refacción'),
        ),
      );
    }

    // DataTable2 tiene scroll propio: no envolverlo en otro scroll vertical.
    return DataTable2(
      minWidth: 700,
      columnSpacing: 16,
      columns: const [
        DataColumn2(label: Text('Código'), size: ColumnSize.L),
        DataColumn2(label: Text('Nombre'), size: ColumnSize.L),
        DataColumn2(label: Text('Categoría'), size: ColumnSize.M),
        DataColumn2(label: Text('Stock actual'), size: ColumnSize.S),
        DataColumn2(label: Text('Stock mínimo'), size: ColumnSize.S),
        DataColumn2(label: Text('Estado'), size: ColumnSize.M),
      ],
      rows: [
        for (final parte in proveedor.refacciones)
          DataRow(
            cells: [
              DataCell(Text(parte.partCode), onTap: () => _editar(parte)),
              DataCell(Text(parte.name), onTap: () => _editar(parte)),
              DataCell(Text(parte.category), onTap: () => _editar(parte)),
              DataCell(Text('${parte.stockCurrent}')),
              DataCell(Text('${parte.stockMin}')),
              DataCell(_EstadoStock(parte: parte)),
            ],
          ),
      ],
    );
  }
}

/// Píldora del estado del stock (CA-7): rojo Agotado, ámbar Stock bajo,
/// verde Disponible; tokens del sistema de diseño.
class _EstadoStock extends StatelessWidget {
  const _EstadoStock({required this.parte});

  final Part parte;

  bool get _agotado => parte.stockCurrent == 0;

  Color get _color => _agotado
      ? AppColors.danger
      : parte.lowStock
          ? AppColors.warning
          : AppColors.success;

  String get _etiqueta => _agotado
      ? 'Agotado'
      : parte.lowStock
          ? 'Stock bajo'
          : 'Disponible';

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
        _etiqueta,
        style: Theme.of(context)
            .textTheme
            .bodySmall
            ?.copyWith(color: _color, fontWeight: FontWeight.w600),
      ),
    );
  }
}
