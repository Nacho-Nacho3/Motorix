import 'dart:async';

import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../providers/clients_provider.dart';
import '../../utils/app_route.dart';
import '../../utils/app_theme.dart';
import '../../widgets/states_view.dart';
import 'client_detail_screen.dart';
import 'client_form_screen.dart';

/// Listado de clientes con búsqueda por nombre, teléfono o correo (T037).
class ClientesListScreen extends StatefulWidget {
  const ClientesListScreen({super.key});

  @override
  State<ClientesListScreen> createState() => _ClientesListScreenState();
}

class _ClientesListScreenState extends State<ClientesListScreen> {
  Timer? _retardoBusqueda;
  final _busquedaCtrl = TextEditingController();

  @override
  void initState() {
    super.initState();
    // Se carga tras el primer frame para no notificar durante la construcción.
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (mounted) context.read<ClientsProvider>().cargar();
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
      context.read<ClientsProvider>().cargar(q: texto.trim());
    });
  }

  Future<void> _abrirAlta() async {
    await Navigator.of(context).push(
      AppRoute(builder: (_) => const ClienteFormScreen()),
    );
  }

  @override
  Widget build(BuildContext context) {
    final proveedor = context.watch<ClientsProvider>();

    return Scaffold(
      backgroundColor: AppColors.background,
      floatingActionButton: FloatingActionButton.extended(
        onPressed: _abrirAlta,
        icon: const Icon(Icons.person_add_alt),
        label: const Text('Registrar cliente'),
      ),
      body: Padding(
        padding: const EdgeInsets.all(AppSpacing.xl),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            TextField(
              controller: _busquedaCtrl,
              onChanged: _buscar,
              decoration: const InputDecoration(
                hintText: 'Buscar por nombre, teléfono o correo',
                prefixIcon: Icon(Icons.search),
              ),
            ),
            const SizedBox(height: AppSpacing.lg),
            Expanded(
              child: _contenido(proveedor),
            ),
          ],
        ),
      ),
    );
  }

  Widget _contenido(ClientsProvider proveedor) {
    if (proveedor.cargando) {
      return const LoadingView(mensaje: 'Cargando clientes…');
    }
    if (proveedor.error != null) {
      return ErrorView(
        mensaje: proveedor.error!,
        onReintentar: () => context.read<ClientsProvider>().cargar(),
      );
    }
    if (proveedor.clientes.isEmpty) {
      return EmptyView(
        icono: Icons.people_outline,
        mensaje: proveedor.busqueda.isEmpty
            ? 'Aún no hay clientes registrados.'
            : 'No se encontraron clientes para "${proveedor.busqueda}".',
        accion: ElevatedButton.icon(
          onPressed: _abrirAlta,
          icon: const Icon(Icons.person_add_alt),
          label: const Text('Registrar cliente'),
        ),
      );
    }

    return ListView.separated(
      itemCount: proveedor.clientes.length,
      separatorBuilder: (_, _) => const Divider(height: 1),
      itemBuilder: (context, indice) {
        final cliente = proveedor.clientes[indice];
        final vehiculos = cliente.vehicleCount ?? 0;
        return ListTile(
          leading: const CircleAvatar(
            backgroundColor: AppColors.surface,
            child: Icon(Icons.person_outline, color: AppColors.primary),
          ),
          title: Text(cliente.name),
          subtitle: Text('${cliente.phone} · ${cliente.email}'),
          trailing: Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              Text(
                vehiculos == 1 ? '1 vehículo' : '$vehiculos vehículos',
                style: Theme.of(context).textTheme.bodySmall,
              ),
              const SizedBox(width: AppSpacing.sm),
              const Icon(Icons.chevron_right, color: AppColors.textSecondary),
            ],
          ),
          onTap: () {
            Navigator.of(context).push(
              AppRoute(
                builder: (_) => ClienteDetailScreen(clienteId: cliente.id),
              ),
            );
          },
        );
      },
    );
  }
}
