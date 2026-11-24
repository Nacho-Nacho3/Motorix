import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../models/notification.dart';
import '../../providers/notifications_provider.dart';
import '../../utils/app_route.dart';
import '../../utils/app_theme.dart';
import '../../widgets/states_view.dart';

// T019: panel de avisos del encabezado (US1, FR-002, FR-003, CA-9).
// Se abre como bottom sheet desde la campana; los estados de carga, vacío
// y error reutilizan states_view.dart (tokens de docs/design-system.md).

/// T017/T018: recarga los avisos (D-03: apertura del panel) y abre el
/// panel. La recarga no bloquea la apertura: el panel muestra el estado
/// de carga hasta que llegan los datos. `onIrASeccion` recibe el índice de
/// la sección del shell que abre cada aviso (T029, FR-007).
Future<void> abrirPanelNotificaciones(
  BuildContext context, {
  required void Function(int indice) onIrASeccion,
}) async {
  final notificaciones = context.read<NotificationsProvider>();
  notificaciones.cargar();
  await showModalBottomSheet<void>(
    context: context,
    isScrollControlled: true,
    builder: (context) => NotificationsPanel(onIrASeccion: onIrASeccion),
  );
}

class NotificationsPanel extends StatelessWidget {
  const NotificationsPanel({super.key, this.onIrASeccion});

  /// T029: navega a la sección relacionada del aviso; null cuando el panel
  /// se renderiza aislado (pruebas de estados).
  final void Function(int indice)? onIrASeccion;

  @override
  Widget build(BuildContext context) {
    final notificaciones = context.watch<NotificationsProvider>();

    Widget contenido;
    if (notificaciones.cargando && notificaciones.groups.isEmpty) {
      contenido = const LoadingView();
    } else if (notificaciones.error != null) {
      contenido = ErrorView(
        mensaje: notificaciones.error!,
        onReintentar: notificaciones.reintentar,
      );
    } else if (notificaciones.totalAvisos == 0) {
      contenido = const EmptyView(
        mensaje: 'No hay avisos por ahora.',
        icono: Icons.notifications_none,
      );
    } else {
      contenido = ListView(
        padding: const EdgeInsets.symmetric(vertical: AppSpacing.sm),
        children: [
          for (final grupo in notificaciones.groups)
            if (grupo.items.isNotEmpty) ...[
              Padding(
                padding: const EdgeInsets.fromLTRB(
                  AppSpacing.xl,
                  AppSpacing.md,
                  AppSpacing.xl,
                  AppSpacing.xs,
                ),
                child: Row(
                  children: [
                    Text(
                      grupo.label,
                      style: Theme.of(context)
                          .textTheme
                          .titleSmall
                          ?.copyWith(fontWeight: FontWeight.w600),
                    ),
                    const SizedBox(width: AppSpacing.sm),
                    Text(
                      '${grupo.totalAvisos}',
                      style: Theme.of(context)
                          .textTheme
                          .bodySmall
                          ?.copyWith(color: AppColors.textSecondary),
                    ),
                  ],
                ),
              ),
              for (final item in grupo.items)
                ListTile(
                  dense: true,
                  leading: Icon(
                    item.read
                        ? Icons.check_circle_outline
                        : Icons.notifications,
                    color: item.read
                        ? AppColors.textSecondary
                        : AppColors.primary,
                  ),
                  title: Text(
                    item.title,
                    style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                          fontWeight: item.read
                              ? FontWeight.normal
                              : FontWeight.w600,
                        ),
                  ),
                  subtitle: Text(
                    item.detail,
                    style: Theme.of(context)
                        .textTheme
                        .bodySmall
                        ?.copyWith(color: AppColors.textSecondary),
                  ),
                  // T029 (US6): el tap marca como leído y abre su sección.
                  onTap: () =>
                      _seleccionarAviso(context, item, notificaciones),
                ),
            ],
        ],
      );
    }

    return SafeArea(
      child: ConstrainedBox(
        constraints: BoxConstraints(
          maxHeight: MediaQuery.of(context).size.height * 0.8,
        ),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Padding(
              padding: const EdgeInsets.fromLTRB(
                AppSpacing.xl,
                AppSpacing.md,
                AppSpacing.lg,
                AppSpacing.sm,
              ),
              child: Row(
                children: [
                  Text(
                    'Notificaciones',
                    style: Theme.of(context).textTheme.titleMedium,
                  ),
                  const SizedBox(width: AppSpacing.sm),
                  Text(
                    '${notificaciones.unreadCount} sin leer',
                    style: Theme.of(context)
                        .textTheme
                        .bodySmall
                        ?.copyWith(color: AppColors.primary),
                  ),
                  const Spacer(),
                  IconButton(
                    tooltip: 'Cerrar',
                    icon: const Icon(Icons.close),
                    onPressed: () => Navigator.of(context).pop(),
                  ),
                ],
              ),
            ),
            const Divider(height: 1),
            Flexible(child: contenido),
          ],
        ),
      ),
    );
  }

  /// T029 (US6, FR-006/FR-007): cierra el panel, marca el aviso como leído
  /// (espera al backend para no encascar la recarga de la sección) y abre
  /// la sección relacionada. La navegación usa `navigation.route` (AppRutas);
  /// `entityId` queda reservado para enlaces directos.
  Future<void> _seleccionarAviso(
    BuildContext context,
    NotificationItem item,
    NotificationsProvider notificaciones,
  ) async {
    final navigator = Navigator.of(context);
    final seccion = AppRutas.seccionDeRuta(item.navigation.route);
    navigator.pop(); // cerrar el panel de inmediato
    await notificaciones.marcarComoLeido(item.key);
    if (seccion != null && onIrASeccion != null && navigator.mounted) {
      onIrASeccion!(seccion);
    }
  }
}
