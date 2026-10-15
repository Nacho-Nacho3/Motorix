import 'package:flutter/material.dart';

import '../models/payment.dart';
import '../utils/app_theme.dart';

/// Píldora con el estado en español de un pago (colores de la máquina de
/// estados R-04: ámbar pendiente, verde pagado, rojo rechazado, gris
/// cancelado). Se comparte entre el formulario de cobro y el detalle de la
/// orden (T019/T020, y el sync de US4).
class EstadoPagoChip extends StatelessWidget {
  const EstadoPagoChip({super.key, required this.status});

  final String status;

  Color get _color {
    switch (status) {
      case 'PAID':
        return AppColors.success;
      case 'PENDING':
        return AppColors.warning;
      case 'REJECTED':
        return AppColors.danger;
      case 'CANCELLED':
        return AppColors.textSecondary;
      default:
        return AppColors.primary;
    }
  }

  @override
  Widget build(BuildContext context) {
    final etiqueta = Payment.etiquetasEstado[status] ?? status;
    return Container(
      padding: const EdgeInsets.symmetric(
        horizontal: AppSpacing.sm,
        vertical: AppSpacing.xs,
      ),
      decoration: BoxDecoration(
        color: _color.withValues(alpha: 0.15),
        borderRadius: BorderRadius.circular(AppRadii.pill),
        border: Border.all(color: _color),
      ),
      child: Text(
        etiqueta,
        style: TextStyle(
          color: _color,
          fontSize: 12,
          fontWeight: FontWeight.w600,
        ),
      ),
    );
  }
}
