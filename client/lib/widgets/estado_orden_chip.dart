import 'package:flutter/material.dart';

import '../models/service_order.dart';
import '../utils/app_theme.dart';

/// Píldora con el estado en español de una orden (colores del sistema de
/// diseño). Se comparte entre el listado y el detalle (T047).
class EstadoOrdenChip extends StatelessWidget {
  const EstadoOrdenChip({super.key, required this.status});

  final String status;

  Color get _color {
    switch (status) {
      case 'DELIVERED':
        return AppColors.success;
      case 'WAITING_PART':
        return AppColors.warning;
      case 'CANCELED':
        return AppColors.danger;
      case 'IN_REPAIR':
      case 'DIAGNOSIS':
        return AppColors.sidebar;
      default:
        return AppColors.primary;
    }
  }

  @override
  Widget build(BuildContext context) {
    final etiqueta = ServiceOrder.etiquetas[status] ?? status;
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
        etiqueta,
        style: Theme.of(context)
            .textTheme
            .bodySmall
            ?.copyWith(color: _color, fontWeight: FontWeight.w600),
      ),
    );
  }
}
