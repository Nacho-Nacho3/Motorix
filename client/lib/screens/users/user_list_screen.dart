import 'dart:async';

import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../models/user.dart';
import '../../providers/users_provider.dart';
import '../../utils/app_route.dart';
import '../../utils/app_theme.dart';
import '../../widgets/confirm_dialog.dart';
import '../../widgets/states_view.dart';
import 'user_form_screen.dart';

/// Listado de usuarios con búsqueda, filtro por rol y alta/edición (T064).
/// La baja es por `active = false` y siempre pide confirmación.
class UserListScreen extends StatefulWidget {
  const UserListScreen({super.key});

  @override
  State<UserListScreen> createState() => _UserListScreenState();
}

class _UserListScreenState extends State<UserListScreen> {
  Timer? _retardoBusqueda;
  final _busquedaCtrl = TextEditingController();

  @override
  void initState() {
    super.initState();
    // Se carga tras el primer frame para no notificar durante la construcción.
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (mounted) context.read<UsersProvider>().cargar();
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
      context.read<UsersProvider>().cargar(q: texto.trim());
    });
  }

  Future<void> _abrirAlta() async {
    await Navigator.of(context)
        .push(AppRoute(builder: (_) => const UserFormScreen()));
  }

  Future<void> _editar(User usuario) async {
    await Navigator.of(
      context,
    ).push(AppRoute(builder: (_) => UserFormScreen(usuario: usuario)));
  }

  Future<void> _cambiarEstado(User usuario, bool activar) async {
    final proveedor = context.read<UsersProvider>();

    if (!activar) {
      final confirmado = await mostrarConfirmacion(
        context,
        titulo: 'Desactivar usuario',
        mensaje:
            '¿Desactivar la cuenta de ${usuario.name}? Dejará de poder iniciar sesión.',
        esPeligrosa: true,
      );
      if (!confirmado || !mounted) return;
    }

    final error = await proveedor.editar(id: usuario.id, active: activar);
    if (!mounted) return;

    if (error != null) {
      ScaffoldMessenger.of(context)
          .showSnackBar(SnackBar(content: Text(error.message)));
      return;
    }
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(activar ? 'Usuario activado' : 'Usuario desactivado'),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final proveedor = context.watch<UsersProvider>();

    return Scaffold(
      backgroundColor: AppColors.background,
      floatingActionButton: FloatingActionButton.extended(
        onPressed: _abrirAlta,
        icon: const Icon(Icons.add),
        label: const Text('Registrar usuario'),
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
                hintText: 'Buscar por usuario, nombre o correo',
                prefixIcon: Icon(Icons.search),
              ),
            ),
            const SizedBox(height: AppSpacing.lg),
            DropdownButtonFormField<String?>(
              initialValue: proveedor.filtroRol,
              decoration: const InputDecoration(
                labelText: 'Rol',
                prefixIcon: Icon(Icons.badge_outlined),
              ),
              items: const [
                DropdownMenuItem<String?>(
                  value: null,
                  child: Text('Todos'),
                ),
                DropdownMenuItem<String>(
                  value: 'ADMIN',
                  child: Text('Administrador'),
                ),
                DropdownMenuItem<String>(
                  value: 'RECEPTIONIST',
                  child: Text('Recepción'),
                ),
                DropdownMenuItem<String>(
                  value: 'MECHANIC',
                  child: Text('Mecánico'),
                ),
              ],
              onChanged: (rol) =>
                  context.read<UsersProvider>().filtrarPorRol(rol),
            ),
            const SizedBox(height: AppSpacing.lg),
            Expanded(child: _contenido(proveedor)),
          ],
        ),
      ),
    );
  }

  Widget _contenido(UsersProvider proveedor) {
    if (proveedor.cargando) {
      return const LoadingView(mensaje: 'Cargando usuarios…');
    }
    if (proveedor.error != null) {
      return ErrorView(
        mensaje: proveedor.error!,
        onReintentar: () => context.read<UsersProvider>().cargar(),
      );
    }
    if (proveedor.usuarios.isEmpty) {
      return EmptyView(
        icono: Icons.person_outline,
        mensaje: proveedor.busqueda.isEmpty
            ? 'Aún no hay usuarios registrados.'
            : 'No se encontraron usuarios para "${proveedor.busqueda}".',
        accion: ElevatedButton.icon(
          onPressed: _abrirAlta,
          icon: const Icon(Icons.add),
          label: const Text('Registrar usuario'),
        ),
      );
    }

    return ListView.separated(
      itemCount: proveedor.usuarios.length,
      separatorBuilder: (_, _) => const Divider(height: 1),
      itemBuilder: (context, indice) {
        final usuario = proveedor.usuarios[indice];
        return ListTile(
          leading: CircleAvatar(
            backgroundColor: AppColors.surface,
            child: Icon(
              usuario.active ? Icons.person_outline : Icons.person_off_outlined,
              color: usuario.active
                  ? AppColors.primary
                  : AppColors.textSecondary,
            ),
          ),
          title: Text(usuario.name),
          subtitle: Text(
            '${usuario.username} · ${usuario.email}\n'
            '${usuario.nombreRol} · ${usuario.active ? 'Activo' : 'Inactivo'}',
          ),
          trailing: Switch(
            value: usuario.active,
            onChanged: (valor) => _cambiarEstado(usuario, valor),
          ),
          onTap: () => _editar(usuario),
        );
      },
    );
  }
}
