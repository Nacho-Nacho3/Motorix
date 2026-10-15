import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../providers/session_provider.dart';
import '../../utils/app_theme.dart';
import '../../widgets/states_view.dart';

/// Pantalla de inicio: bienvenida y acceso rápido a los módulos.
class HomeScreen extends StatelessWidget {
  const HomeScreen({super.key, this.irASeccion});

  /// Permite navegar a otra sección del sidebar desde los accesos rápidos.
  final void Function(int indice)? irASeccion;

  @override
  Widget build(BuildContext context) {
    final sesion = context.watch<SessionProvider>();
    final usuario = sesion.usuario;

    if (usuario == null) {
      return const LoadingView();
    }

    return SingleChildScrollView(
      padding: const EdgeInsets.all(AppSpacing.xl),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            'Hola, ${usuario.name}',
            style: Theme.of(context).textTheme.headlineSmall,
          ),
          const SizedBox(height: AppSpacing.xs),
          Text(
            'Sesión iniciada como ${usuario.nombreRol} (@${usuario.username}).',
            style: Theme.of(context).textTheme.bodySmall,
          ),
          const SizedBox(height: AppSpacing.xl),
          if (usuario.esAdmin)
            _AccesoRapido(
              titulo: 'Usuarios',
              descripcion: 'Crear, editar y desactivar cuentas del taller.',
              icono: Icons.supervisor_account_outlined,
              onTap: () => irASeccion?.call(5),
            ),
          if (usuario.role != 'MECHANIC')
            _AccesoRapido(
              titulo: 'Citas',
              descripcion: 'Agendar y gestionar las citas del taller.',
              icono: Icons.event_note_outlined,
              onTap: () => irASeccion?.call(3),
            ),
          _AccesoRapido(
            titulo: 'Órdenes',
            descripcion: 'Crear órdenes de servicio y seguir su avance.',
            icono: Icons.assignment_outlined,
            onTap: () => irASeccion?.call(4),
          ),
          _AccesoRapido(
            titulo: 'Clientes',
            descripcion: 'Registrar clientes y consultar su información.',
            icono: Icons.people_outline,
            onTap: () => irASeccion?.call(1),
          ),
          _AccesoRapido(
            titulo: 'Vehículos',
            descripcion: 'Vincular vehículos a sus clientes.',
            icono: Icons.directions_car_outlined,
            onTap: () => irASeccion?.call(2),
          ),
        ],
      ),
    );
  }
}

class _AccesoRapido extends StatelessWidget {
  const _AccesoRapido({
    required this.titulo,
    required this.descripcion,
    required this.icono,
    required this.onTap,
  });

  final String titulo;
  final String descripcion;
  final IconData icono;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: AppSpacing.md),
      child: Card(
        child: ListTile(
          leading: Icon(icono, color: AppColors.primary),
          title: Text(titulo),
          subtitle: Text(descripcion),
          trailing: const Icon(Icons.chevron_right),
          onTap: onTap,
        ),
      ),
    );
  }
}
