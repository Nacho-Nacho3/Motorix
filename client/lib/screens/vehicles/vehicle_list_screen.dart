import 'dart:async';

import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../models/vehicle.dart';
import '../../providers/vehicles_provider.dart';
import '../../utils/app_route.dart';
import '../../utils/app_theme.dart';
import '../../widgets/states_view.dart';
import '../orders/order_list_screen.dart';
import 'vehicle_form_screen.dart';

/// Listado de vehículos con búsqueda y filtro por propietario (T050).
class VehicleListScreen extends StatefulWidget {
  const VehicleListScreen({super.key});

  @override
  State<VehicleListScreen> createState() => _VehicleListScreenState();
}

class _VehicleListScreenState extends State<VehicleListScreen> {
  Timer? _retardoBusqueda;
  final _busquedaCtrl = TextEditingController();

  @override
  void initState() {
    super.initState();
    // Se carga tras el primer frame para no notificar durante la construcción.
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!mounted) return;
      context.read<VehiclesProvider>().cargar();
      context.read<VehiclesProvider>().cargarPropietarios();
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
      context.read<VehiclesProvider>().cargar(q: texto.trim());
    });
  }

  Future<void> _abrirAlta() async {
    await Navigator.of(context).push(
      AppRoute(builder: (_) => const VehicleFormScreen()),
    );
  }

  /// Abre las órdenes del vehículo seleccionado (T042).
  Future<void> _abrirOrdenes(Vehicle vehiculo) async {
    await Navigator.of(context).push(
      AppRoute(
        builder: (_) => OrderListScreen(
          vehicleId: vehiculo.id,
          vehicleLabel:
              '${vehiculo.brand} ${vehiculo.model} ${vehiculo.licensePlate}',
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final proveedor = context.watch<VehiclesProvider>();

    return Scaffold(
      backgroundColor: AppColors.background,
      floatingActionButton: FloatingActionButton.extended(
        onPressed: _abrirAlta,
        icon: const Icon(Icons.add),
        label: const Text('Registrar vehículo'),
      ),
      body: Padding(
        padding: const EdgeInsets.all(AppSpacing.xl),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Row(
              children: [
                Expanded(
                  child: TextField(
                    controller: _busquedaCtrl,
                    onChanged: _buscar,
                    decoration: const InputDecoration(
                      hintText: 'Buscar por placa, marca, modelo o VIN',
                      prefixIcon: Icon(Icons.search),
                    ),
                  ),
                ),
                const SizedBox(width: AppSpacing.lg),
                Expanded(
                  child: DropdownButtonFormField<int?>(
                    initialValue: proveedor.filtroClienteId,
                    decoration: const InputDecoration(
                      labelText: 'Propietario',
                      prefixIcon: Icon(Icons.person_outline),
                    ),
                    items: [
                      const DropdownMenuItem<int?>(
                        value: null,
                        child: Text('Todos'),
                      ),
                      for (final cliente in proveedor.propietarios)
                        DropdownMenuItem<int?>(
                          value: cliente.id,
                          child: Text(cliente.name),
                        ),
                    ],
                    onChanged: (clientId) =>
                        context.read<VehiclesProvider>().filtrarPorCliente(clientId),
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

  Widget _contenido(VehiclesProvider proveedor) {
    if (proveedor.cargando) {
      return const LoadingView(mensaje: 'Cargando vehículos…');
    }
    if (proveedor.error != null) {
      return ErrorView(
        mensaje: proveedor.error!,
        onReintentar: () => context.read<VehiclesProvider>().cargar(),
      );
    }
    if (proveedor.vehiculos.isEmpty) {
      return EmptyView(
        icono: Icons.directions_car_outlined,
        mensaje: proveedor.busqueda.isEmpty
            ? 'Aún no hay vehículos registrados.'
            : 'No se encontraron vehículos para "${proveedor.busqueda}".',
        accion: ElevatedButton.icon(
          onPressed: _abrirAlta,
          icon: const Icon(Icons.add),
          label: const Text('Registrar vehículo'),
        ),
      );
    }

    return ListView.separated(
      itemCount: proveedor.vehiculos.length,
      separatorBuilder: (_, _) => const Divider(height: 1),
      itemBuilder: (context, indice) {
        final vehiculo = proveedor.vehiculos[indice];
        return ListTile(
          leading: const CircleAvatar(
            backgroundColor: AppColors.surface,
            child: Icon(
              Icons.directions_car_outlined,
              color: AppColors.primary,
            ),
          ),
          title: Text('${vehiculo.brand} ${vehiculo.model} (${vehiculo.year})'),
          subtitle: Text(
            '${vehiculo.licensePlate} · ${vehiculo.currentMileage} km · ${vehiculo.clientName ?? ''}'
                .trim(),
          ),
          trailing: Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              IconButton(
                tooltip: 'Ver órdenes',
                icon: const Icon(
                  Icons.assignment_outlined,
                  color: AppColors.primary,
                ),
                onPressed: () => _abrirOrdenes(vehiculo),
              ),
              const Icon(
                Icons.chevron_right,
                color: AppColors.textSecondary,
              ),
            ],
          ),
          onTap: () {
            Navigator.of(context).push(
              AppRoute(
                builder: (_) => VehicleFormScreen(vehiculo: vehiculo),
              ),
            );
          },
        );
      },
    );
  }
}
