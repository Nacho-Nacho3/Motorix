import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../providers/clients_provider.dart';
import '../../utils/app_route.dart';
import '../../utils/app_theme.dart';
import '../../widgets/states_view.dart';
import 'client_form_screen.dart';

/// Ficha del cliente con sus vehículos asociados (T039, CA-4).
class ClienteDetailScreen extends StatefulWidget {
  const ClienteDetailScreen({super.key, required this.clienteId});

  final int clienteId;

  @override
  State<ClienteDetailScreen> createState() => _ClienteDetailScreenState();
}

class _ClienteDetailScreenState extends State<ClienteDetailScreen> {
  @override
  void initState() {
    super.initState();
    // Se carga tras el primer frame para no notificar durante la construcción.
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (mounted) context.read<ClientsProvider>().cargarDetalle(widget.clienteId);
    });
  }

  Future<void> _editar() async {
    final cliente = context.read<ClientsProvider>().clienteDetalle;
    if (cliente == null) return;
    await Navigator.of(context).push(
      AppRoute(builder: (_) => ClienteFormScreen(cliente: cliente)),
    );
  }

  @override
  Widget build(BuildContext context) {
    final proveedor = context.watch<ClientsProvider>();
    final cliente = proveedor.clienteDetalle;

    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: AppBar(
        title: Text(cliente?.name ?? 'Cliente'),
        actions: [
          if (cliente != null)
            TextButton.icon(
              onPressed: _editar,
              icon: const Icon(Icons.edit_outlined),
              label: const Text('Editar'),
            ),
        ],
      ),
      body: _contenido(proveedor),
    );
  }

  Widget _contenido(ClientsProvider proveedor) {
    if (proveedor.cargandoDetalle) {
      return const LoadingView(mensaje: 'Cargando ficha…');
    }
    if (proveedor.errorDetalle != null) {
      return ErrorView(
        mensaje: proveedor.errorDetalle!,
        onReintentar: () =>
            context.read<ClientsProvider>().cargarDetalle(widget.clienteId),
      );
    }

    final cliente = proveedor.clienteDetalle;
    if (cliente == null) {
      return const EmptyView(
        icono: Icons.person_off_outlined,
        mensaje: 'Cliente no encontrado.',
      );
    }

    return SingleChildScrollView(
      padding: const EdgeInsets.all(AppSpacing.xl),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Card(
            child: Padding(
              padding: const EdgeInsets.all(AppSpacing.lg),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    cliente.name,
                    style: Theme.of(context).textTheme.titleMedium,
                  ),
                  const SizedBox(height: AppSpacing.md),
                  _Dato(icono: Icons.phone_outlined, texto: cliente.phone),
                  const SizedBox(height: AppSpacing.sm),
                  _Dato(icono: Icons.mail_outline, texto: cliente.email),
                  if (cliente.createdAt != null) ...[
                    const SizedBox(height: AppSpacing.sm),
                    _Dato(
                      icono: Icons.calendar_today_outlined,
                      texto:
                          'Registrado el ${cliente.createdAt!.split('T').first}',
                    ),
                  ],
                ],
              ),
            ),
          ),
          const SizedBox(height: AppSpacing.xl),
          Text(
            'Vehículos (${proveedor.vehiculosDelCliente.length})',
            style: Theme.of(context).textTheme.titleMedium,
          ),
          const SizedBox(height: AppSpacing.md),
          if (proveedor.vehiculosDelCliente.isEmpty)
            const EmptyView(
              icono: Icons.directions_car_outlined,
              mensaje: 'Este cliente aún no tiene vehículos registrados.',
            )
          else
            Card(
              child: Column(
                children: [
                  for (final vehiculo in proveedor.vehiculosDelCliente)
                    ListTile(
                      leading: const Icon(
                        Icons.directions_car_outlined,
                        color: AppColors.primary,
                      ),
                      title: Text(
                        '${vehiculo.brand} ${vehiculo.model} (${vehiculo.year})',
                      ),
                      subtitle: Text(
                        'Placas ${vehiculo.licensePlate} · ${vehiculo.currentMileage} km'
                        '${vehiculo.vin != null && vehiculo.vin!.isNotEmpty ? ' · VIN ${vehiculo.vin}' : ''}',
                      ),
                    ),
                ],
              ),
            ),
        ],
      ),
    );
  }
}

class _Dato extends StatelessWidget {
  const _Dato({required this.icono, required this.texto});

  final IconData icono;
  final String texto;

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        Icon(icono, size: 18, color: AppColors.textSecondary),
        const SizedBox(width: AppSpacing.sm),
        Expanded(
          child: Text(
            texto,
            style: Theme.of(context).textTheme.bodyMedium,
          ),
        ),
      ],
    );
  }
}
