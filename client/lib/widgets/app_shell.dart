import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../providers/session_provider.dart';
import '../providers/ui_provider.dart';
import '../screens/appointments/appointment_list_screen.dart';
import '../screens/clients/client_list_screen.dart';
import '../screens/dashboard/dashboard_screen.dart';
import '../screens/history/vehicle_history_screen.dart';
import '../screens/home/home_screen.dart';
import '../screens/inventory/parts_list_screen.dart';
import '../screens/maintenances/maintenance_list_screen.dart';
import '../screens/orders/order_list_screen.dart';
import '../screens/users/user_list_screen.dart';
import '../screens/vehicles/vehicle_list_screen.dart';
import '../utils/app_theme.dart';
import 'confirm_dialog.dart';

/// Contenedor de la aplicación: sidebar colapsable + cabecera + secciones.
/// Sidebar: Inicio, Clientes y Vehículos para todos; Citas solo ADMIN y
/// RECEPTIONIST; Usuarios solo para ADMIN (Q1-A, CA-7).
class AppShell extends StatefulWidget {
  const AppShell({super.key});

  @override
  State<AppShell> createState() => _AppShellState();
}

class _AppShellState extends State<AppShell> {
  int _indice = 0;

  static const List<_Seccion> _secciones = [
    _Seccion('Inicio', Icons.home_outlined),
    _Seccion('Clientes', Icons.people_outline),
    _Seccion('Vehículos', Icons.directions_car_outlined),
    _Seccion(
      'Citas',
      Icons.event_note_outlined,
      roles: {'ADMIN', 'RECEPTIONIST'},
    ),
    _Seccion('Órdenes', Icons.assignment_outlined),
    _Seccion('Usuarios', Icons.supervisor_account_outlined, roles: {'ADMIN'}),
    // T019: Historial (R-11): solo ADMIN y MECHANIC; RECEPTIONIST no lo ve.
    _Seccion(
      'Historial',
      Icons.history,
      roles: {'ADMIN', 'MECHANIC'},
    ),
    // T035: Mantenimientos (R-11): visible para los tres roles.
    _Seccion('Mantenimientos', Icons.build_outlined),
    // T054: Inventario (R-07): lectura y escritura exclusivas de ADMIN.
    _Seccion(
      'Inventario',
      Icons.inventory_2_outlined,
      roles: {'ADMIN'},
    ),
    // T058: Dashboard (US5, FR-012): panel exclusivo de ADMIN. Va al final
    // para no recorrer los índices de las secciones existentes.
    _Seccion('Dashboard', Icons.dashboard_outlined, roles: {'ADMIN'}),
  ];

  void _irASeccion(int indice) {
    setState(() => _indice = indice);
  }

  Future<void> _cerrarSesion() async {
    final sesion = context.read<SessionProvider>();
    final confirmado = await mostrarConfirmacion(
      context,
      titulo: 'Cerrar sesión',
      mensaje: '¿Seguro que quieres cerrar sesión?',
      esPeligrosa: true,
    );
    if (confirmado && mounted) {
      await sesion.cerrarSesion();
    }
  }

  @override
  Widget build(BuildContext context) {
    final sesion = context.watch<SessionProvider>();
    final ui = context.watch<UiProvider>();
    final rol = sesion.usuario?.role;

    // Secciones visibles para el rol; los índices del rail se mapean a los
    // índices reales para que las secciones ocultas no desplacen las demás.
    final visibles = [
      for (var i = 0; i < _secciones.length; i++)
        if (_secciones[i].visiblePara(rol)) i,
    ];

    var posicionSeleccionado = visibles.indexOf(_indice);
    if (posicionSeleccionado < 0) posicionSeleccionado = 0;

    final destinos = [
      for (final indice in visibles)
        NavigationRailDestination(
          icon: _iconoDestino(indice, ui.sidebarExpandido),
          selectedIcon: _iconoDestino(indice, ui.sidebarExpandido),
          label: Text(_secciones[indice].titulo),
        ),
    ];

    return Scaffold(
      body: Row(
        children: [
          NavigationRail(
            extended: ui.sidebarExpandido,
            selectedIndex: posicionSeleccionado,
            // Collapsed: ~72 px, solo íconos (sección 7).
            minWidth: 72,
            backgroundColor: AppColors.sidebar,
            leading: Padding(
              padding: const EdgeInsets.symmetric(vertical: AppSpacing.md),
              child: AnimatedScale(
                // 32 px expandido, 24 px colapsado, sin salto brusco (6.4).
                scale: ui.sidebarExpandido ? 1 : 0.75,
                duration: AppDurations.element,
                curve: AppDurations.curve,
                child: const Icon(
                  Icons.directions_car_filled,
                  color: Colors.white,
                  size: 32,
                ),
              ),
            ),
            trailing: Expanded(
              child: Align(
                alignment: Alignment.bottomCenter,
                child: Padding(
                  padding: const EdgeInsets.only(bottom: AppSpacing.lg),
                  child: IconButton(
                    tooltip: ui.sidebarExpandido
                        ? 'Contraer menú lateral'
                        : 'Expandir menú lateral',
                    color: Colors.white,
                    icon: Icon(
                      ui.sidebarExpandido
                          ? Icons.chevron_left
                          : Icons.chevron_right,
                    ),
                    onPressed: ui.alternarSidebar,
                  ),
                ),
              ),
            ),
            onDestinationSelected: (destino) =>
                _irASeccion(visibles[destino]),
            destinations: destinos,
          ),
          const VerticalDivider(width: 1, thickness: 1),
          Expanded(
            child: Column(
              children: [
                _Cabecera(
                  titulo: _tituloSeccion(rol),
                  onCerrarSesion: _cerrarSesion,
                ),
                const Divider(height: 1),
                Expanded(child: _vistaSeccion(rol)),
              ],
            ),
          ),
        ],
      ),
    );
  }

  String _tituloSeccion(String? rol) {
    if (!_secciones[_indice].visiblePara(rol)) return _secciones[0].titulo;
    return _secciones[_indice].titulo;
  }

  /// Colapsado solo se ven íconos: el nombre de la sección viaja en el
  /// tooltip (sección 7 y regla de accesibilidad 10).
  Widget _iconoDestino(int indice, bool expandido) {
    final icono = Icon(_secciones[indice].icono);
    if (expandido) return icono;
    return Tooltip(message: _secciones[indice].titulo, child: icono);
  }

  Widget _vistaSeccion(String? rol) {
    if (!_secciones[_indice].visiblePara(rol)) {
      return HomeScreen(irASeccion: _irASeccion);
    }
    switch (_indice) {
      case 1:
        return const ClientesListScreen();
      case 2:
        return const VehicleListScreen();
      case 3:
        return const AppointmentListScreen();
      case 4:
        return const OrderListScreen();
      case 5:
        return const UserListScreen();
      case 6:
        return const VehicleHistoryScreen();
      case 7:
        return const MaintenanceListScreen();
      case 8:
        return const PartsListScreen();
      case 9:
        return const DashboardScreen();
      default:
        return HomeScreen(irASeccion: _irASeccion);
    }
  }
}

class _Seccion {
  const _Seccion(this.titulo, this.icono, {this.roles});

  final String titulo;
  final IconData icono;

  /// Roles que ven la sección; `null` = todos los roles.
  final Set<String>? roles;

  bool visiblePara(String? rol) => roles == null || (rol != null && roles!.contains(rol));
}

class _Cabecera extends StatelessWidget {
  const _Cabecera({required this.titulo, required this.onCerrarSesion});

  final String titulo;
  final VoidCallback onCerrarSesion;

  @override
  Widget build(BuildContext context) {
    final sesion = context.watch<SessionProvider>();
    final usuario = sesion.usuario;

    return Container(
      color: AppColors.surface,
      padding: const EdgeInsets.symmetric(
        horizontal: AppSpacing.xl,
        vertical: AppSpacing.md,
      ),
      child: Row(
        children: [
          Flexible(
            child: Text(
              titulo,
              overflow: TextOverflow.ellipsis,
              style: Theme.of(context).textTheme.titleMedium,
            ),
          ),
          const Spacer(),
          if (usuario != null) ...[
            Flexible(
              child: Text(
                usuario.name,
                overflow: TextOverflow.ellipsis,
                style: Theme.of(context).textTheme.bodyMedium,
              ),
            ),
            const SizedBox(width: AppSpacing.sm),
            Flexible(
              child: Container(
                padding: const EdgeInsets.symmetric(
                  horizontal: AppSpacing.sm,
                  vertical: AppSpacing.xs,
                ),
                decoration: BoxDecoration(
                  color: AppColors.primary.withValues(alpha: 0.12),
                  borderRadius: BorderRadius.circular(AppRadii.pill),
                ),
                child: Text(
                  usuario.nombreRol,
                  overflow: TextOverflow.ellipsis,
                  style: Theme.of(context).textTheme.bodySmall
                      ?.copyWith(color: AppColors.primary),
                ),
              ),
            ),
          ],
          const SizedBox(width: AppSpacing.lg),
          IconButton(
            tooltip: 'Cerrar sesión',
            icon: const Icon(Icons.logout),
            onPressed: onCerrarSesion,
          ),
        ],
      ),
    );
  }
}
