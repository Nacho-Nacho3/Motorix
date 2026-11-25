import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../models/service_type.dart';
import '../../providers/service_types_provider.dart';
import '../../utils/app_route.dart';
import '../../utils/app_theme.dart';
import '../../widgets/confirm_dialog.dart';
import '../../widgets/states_view.dart';
import 'service_type_form_screen.dart';

/// Sección «Tipos de servicio» de Configuración (Sprint 7, US3, FR-005):
/// lista con nombre, intervalos y estado; alta, edición y desactivación con
/// confirmación. Nunca se borra un tipo (CA-4).
class ServiceTypesSection extends StatefulWidget {
  const ServiceTypesSection({super.key});

  @override
  State<ServiceTypesSection> createState() => _ServiceTypesSectionState();
}

class _ServiceTypesSectionState extends State<ServiceTypesSection> {
  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (mounted) context.read<ServiceTypesProvider>().cargar();
    });
  }

  Future<void> _abrirFormulario([ServiceType? tipo]) async {
    await Navigator.of(context).push<bool>(
      AppRoute(builder: (_) => ServiceTypeFormScreen(tipo: tipo)),
    );
  }

  Future<void> _alternarEstado(ServiceType tipo) async {
    final proveedor = context.read<ServiceTypesProvider>();
    if (tipo.active) {
      final usado = tipo.usedInServices > 0
          ? ' Las ${tipo.usedInServices} líneas de servicio que ya lo usan conservan su nombre.'
          : '';
      final confirmado = await mostrarConfirmacion(
        context,
        titulo: 'Desactivar tipo de servicio',
        mensaje:
            '¿Desactivar "${tipo.name}"? Dejará de ofrecerse en los servicios nuevos.$usado',
        textoConfirmar: 'Desactivar',
        esPeligrosa: true,
      );
      if (!confirmado || !mounted) return;
    }
    final error = await proveedor.cambiarEstado(tipo.id, activo: !tipo.active);
    if (!mounted || error == null) return;
    ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(error.message)));
  }

  @override
  Widget build(BuildContext context) {
    final proveedor = context.watch<ServiceTypesProvider>();

    return Card(
      color: AppColors.surface,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(AppRadii.panel),
        side: const BorderSide(color: AppColors.outline),
      ),
      child: Padding(
        padding: const EdgeInsets.all(AppSpacing.xl),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Row(
              children: [
                const Expanded(
                  child: Text(
                    'Tipos de servicio',
                    style: TextStyle(
                      fontSize: AppFontSizes.subtitle,
                      fontWeight: FontWeight.w600,
                      color: AppColors.textPrimary,
                    ),
                  ),
                ),
                FilledButton.icon(
                  key: const Key('boton-nuevo-tipo'),
                  onPressed: () => _abrirFormulario(),
                  icon: const Icon(Icons.add),
                  label: const Text('Nuevo tipo'),
                ),
              ],
            ),
            const SizedBox(height: AppSpacing.xs),
            const Text(
              'Catálogo con el intervalo de cada servicio; sirve para sugerir el '
              'próximo servicio en el ticket y en los mantenimientos.',
              style: TextStyle(color: AppColors.textSecondary),
            ),
            const SizedBox(height: AppSpacing.md),
            _lista(proveedor),
          ],
        ),
      ),
    );
  }

  Widget _lista(ServiceTypesProvider proveedor) {
    if (proveedor.cargando && proveedor.tipos.isEmpty) {
      return const SizedBox(
        height: 120,
        child: LoadingView(mensaje: 'Cargando los tipos de servicio…'),
      );
    }
    if (proveedor.error != null && proveedor.tipos.isEmpty) {
      return SizedBox(
        height: 260,
        child: ErrorView(mensaje: proveedor.error!, onReintentar: proveedor.cargar),
      );
    }
    if (proveedor.tipos.isEmpty) {
      return const SizedBox(
        height: 160,
        child: EmptyView(
          mensaje: 'Aún no hay tipos de servicio. Crea el primero con «Nuevo tipo».',
          icono: Icons.build_circle_outlined,
        ),
      );
    }
    return Column(
      children: [
        for (final tipo in proveedor.tipos)
          ListTile(
            key: Key('tipo-${tipo.id}'),
            contentPadding: EdgeInsets.zero,
            title: Text(tipo.name),
            subtitle: Text(
              '${tipo.etiquetaIntervalos}${tipo.usedInServices > 0 ? ' · Usado en ${tipo.usedInServices} servicios' : ''}',
            ),
            leading: Icon(
              tipo.active ? Icons.check_circle_outline : Icons.pause_circle_outline,
              color: tipo.active ? AppColors.success : AppColors.textSecondary,
            ),
            trailing: Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                Text(
                  tipo.active ? 'Activo' : 'Inactivo',
                  style: const TextStyle(color: AppColors.textSecondary),
                ),
                IconButton(
                  tooltip: 'Editar tipo',
                  icon: const Icon(Icons.edit_outlined),
                  onPressed: () => _abrirFormulario(tipo),
                ),
                IconButton(
                  tooltip: tipo.active ? 'Desactivar tipo' : 'Activar tipo',
                  icon: Icon(tipo.active ? Icons.toggle_on : Icons.toggle_off_outlined),
                  onPressed: () => _alternarEstado(tipo),
                ),
              ],
            ),
          ),
      ],
    );
  }
}
