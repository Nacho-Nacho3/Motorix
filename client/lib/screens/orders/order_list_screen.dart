import 'dart:async';

import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../models/service_order.dart';
import '../../providers/service_orders_provider.dart';
import '../../providers/session_provider.dart';
import '../../utils/app_route.dart';
import '../../utils/app_theme.dart';
import '../../widgets/estado_orden_chip.dart';
import '../../widgets/states_view.dart';
import 'order_detail_screen.dart';
import 'order_form_screen.dart';

/// Listado de órdenes de servicio con búsqueda y filtros (T036, CA-2).
/// Si recibe [vehicleId], muestra solo las órdenes de ese vehículo (T042).
class OrderListScreen extends StatefulWidget {
  const OrderListScreen({super.key, this.vehicleId, this.vehicleLabel});

  final int? vehicleId;
  final String? vehicleLabel;

  @override
  State<OrderListScreen> createState() => _OrderListScreenState();
}

class _OrderListScreenState extends State<OrderListScreen> {
  Timer? _retardoBusqueda;
  final _busquedaCtrl = TextEditingController();

  @override
  void initState() {
    super.initState();
    // Se carga tras el primer frame para no notificar durante la construcción.
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!mounted) return;
      final proveedor = context.read<ServiceOrdersProvider>();
      final esMecanico =
          context.read<SessionProvider>().usuario?.role == 'MECHANIC';
      proveedor.cargar(vehicleId: widget.vehicleId);
      // El selector de mecánicos es solo para quien crea o reasigna órdenes.
      if (proveedor.mecanicos.isEmpty && !esMecanico) {
        proveedor.cargarMecanicos();
      }
    });
  }

  @override
  void dispose() {
    _retardoBusqueda?.cancel();
    _busquedaCtrl.dispose();
    super.dispose();
  }

  void _buscar(String texto) {
    _retardoBusqueda?.cancel();
    _retardoBusqueda = Timer(const Duration(milliseconds: 350), () {
      if (!mounted) return;
      context.read<ServiceOrdersProvider>().cargar(q: texto.trim());
    });
  }

  Future<void> _abrirAlta() async {
    await Navigator.of(context).push(
      AppRoute(builder: (_) => const OrderFormScreen()),
    );
  }

  Future<void> _abrirEdicion(ServiceOrder orden) async {
    await Navigator.of(context).push(
      AppRoute(builder: (_) => OrderFormScreen(orden: orden)),
    );
  }

  /// Abre el detalle en modo lectura (T047).
  Future<void> _abrirDetalle(ServiceOrder orden) async {
    await Navigator.of(context).push(
      AppRoute(builder: (_) => OrderDetailScreen(orden: orden)),
    );
  }

  @override
  Widget build(BuildContext context) {
    final proveedor = context.watch<ServiceOrdersProvider>();
    final esMecanico =
        context.watch<SessionProvider>().usuario?.role == 'MECHANIC';

    return Scaffold(
      backgroundColor: AppColors.background,
      // El mecánico no crea ni reasigna órdenes: no hay alta (T048, CA-7).
      floatingActionButton: esMecanico
          ? null
          : FloatingActionButton.extended(
              onPressed: _abrirAlta,
              icon: const Icon(Icons.add),
              label: const Text('Nueva orden'),
            ),
      body: Padding(
        padding: const EdgeInsets.all(AppSpacing.xl),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            if (esMecanico) ...[
              const _InsigniaSoloMisOrdenes(),
              const SizedBox(height: AppSpacing.md),
            ],
            Row(
              children: [
                Expanded(
                  child: TextField(
                    controller: _busquedaCtrl,
                    onChanged: _buscar,
                    decoration: const InputDecoration(
                      hintText: 'Buscar por cliente o placas',
                      prefixIcon: Icon(Icons.search),
                    ),
                  ),
                ),
                const SizedBox(width: AppSpacing.lg),
                SizedBox(
                  width: 200,
                  child: DropdownButtonFormField<String?>(
                    initialValue: proveedor.filtroEstado,
                    isExpanded: true,
                    hint: const Text('Todos'),
                    decoration: const InputDecoration(labelText: 'Estado'),
                    items: [
                      const DropdownMenuItem<String?>(
                        value: null,
                        child: Text('Todos'),
                      ),
                      for (final entrada in ServiceOrder.etiquetas.entries)
                        DropdownMenuItem<String?>(
                          value: entrada.key,
                          child: Text(entrada.value),
                        ),
                    ],
                    onChanged: (estado) => context
                        .read<ServiceOrdersProvider>()
                        .cargar(estado: estado ?? ''),
                  ),
                ),
              ],
            ),
            if (widget.vehicleId != null) ...[
              const SizedBox(height: AppSpacing.md),
              Align(
                alignment: Alignment.centerLeft,
                child: ActionChip(
                  avatar: const Icon(
                    Icons.directions_car_outlined,
                    size: 18,
                    color: AppColors.primary,
                  ),
                  label: Text(
                    'Vehículo: ${widget.vehicleLabel ?? 'seleccionado'}',
                  ),
                  onPressed: () {
                    // Vuelve a la lista completa (y cierra esta vista).
                    context.read<ServiceOrdersProvider>().limpiarFiltroVehiculo();
                    Navigator.of(context).pop();
                  },
                ),
              ),
            ],
            const SizedBox(height: AppSpacing.lg),
            Expanded(child: _contenido(proveedor, esMecanico)),
          ],
        ),
      ),
    );
  }

  Widget _contenido(ServiceOrdersProvider proveedor, bool esMecanico) {
    if (proveedor.cargando) {
      return const LoadingView(mensaje: 'Cargando órdenes…');
    }
    if (proveedor.error != null) {
      return ErrorView(
        mensaje: proveedor.error!,
        onReintentar: () => context.read<ServiceOrdersProvider>().cargar(),
      );
    }
    if (proveedor.ordenes.isEmpty) {
      final mensaje = esMecanico
          ? 'Cuando te asignen una orden de servicio aparecerá aquí.'
          : widget.vehicleId != null
              ? 'Este vehículo aún no tiene órdenes de servicio.'
              : proveedor.busqueda.isEmpty
                  ? 'Aún no hay órdenes de servicio.'
                  : 'No se encontraron órdenes para "${proveedor.busqueda}".';
      return EmptyView(
        icono: Icons.assignment_outlined,
        mensaje: mensaje,
        accion: esMecanico
            ? ElevatedButton.icon(
                onPressed: () => context.read<ServiceOrdersProvider>().cargar(),
                icon: const Icon(Icons.refresh),
                label: const Text('Recargar'),
              )
            : ElevatedButton.icon(
                onPressed: _abrirAlta,
                icon: const Icon(Icons.add),
                label: const Text('Nueva orden'),
              ),
      );
    }

    return ListView.separated(
      itemCount: proveedor.ordenes.length,
      separatorBuilder: (_, _) => const Divider(height: 1),
      itemBuilder: (context, indice) {
        final orden = proveedor.ordenes[indice];

        return ListTile(
          leading: const CircleAvatar(
            backgroundColor: AppColors.surface,
            child: Icon(Icons.assignment_outlined, color: AppColors.primary),
          ),
          title: Row(
            children: [
              Flexible(
                child: Text(
                  '${orden.clientName} · ${orden.vehicleLabel}',
                  overflow: TextOverflow.ellipsis,
                ),
              ),
              const SizedBox(width: AppSpacing.sm),
              EstadoOrdenChip(status: orden.status),
            ],
          ),
          subtitle: Text(
            '${orden.mechanicName} · ${orden.reportedProblem}',
            maxLines: 2,
            overflow: TextOverflow.ellipsis,
          ),
          trailing: IconButton(
            tooltip: 'Editar orden',
            icon: const Icon(Icons.edit_outlined),
            onPressed: () => _abrirEdicion(orden),
          ),
          onTap: () => _abrirDetalle(orden),
        );
      },
    );
  }
}

/// Insignia «Solo mis órdenes» visible para el rol MECHANIC (T048).
class _InsigniaSoloMisOrdenes extends StatelessWidget {
  const _InsigniaSoloMisOrdenes();

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(
        horizontal: AppSpacing.md,
        vertical: AppSpacing.xs,
      ),
      decoration: BoxDecoration(
        color: AppColors.sidebar.withValues(alpha: 0.12),
        borderRadius: BorderRadius.circular(AppRadii.pill),
      ),
      child: const Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(Icons.visibility_outlined, size: 16, color: AppColors.sidebar),
          SizedBox(width: AppSpacing.xs),
          Text(
            'Solo mis órdenes',
            style: TextStyle(
              color: AppColors.sidebar,
              fontWeight: FontWeight.w600,
              fontSize: AppFontSizes.small,
            ),
          ),
        ],
      ),
    );
  }
}
