import 'package:flutter/material.dart';

import '../utils/app_theme.dart';

/// Diálogo de confirmación obligatorio para acciones destructivas o sensibles
/// (8.5). Los botones son "Cancelar" y "Confirmar"; la acción concreta va en
/// el título y el mensaje. Devuelve `true` solo cuando se pulsa "Confirmar".
Future<bool> mostrarConfirmacion(
  BuildContext context, {
  required String titulo,
  required String mensaje,
  String textoConfirmar = 'Confirmar',
  String textoCancelar = 'Cancelar',
  bool esPeligrosa = false,
}) async {
  final resultado = await showDialog<bool>(
    context: context,
    barrierDismissible: false,
    // Aparición de diálogos: 200 ms con easeOutCubic (sección 6.4).
    animationStyle: const AnimationStyle(
      duration: AppDurations.element,
      curve: AppDurations.curveOut,
      reverseCurve: AppDurations.curve,
    ),
    builder: (context) => AlertDialog(
      title: Text(titulo),
      content: Text(mensaje),
      actions: [
        TextButton(
          onPressed: () => Navigator.of(context).pop(false),
          child: Text(textoCancelar),
        ),
        FilledButton(
          onPressed: () => Navigator.of(context).pop(true),
          style: FilledButton.styleFrom(
            backgroundColor: esPeligrosa ? AppColors.danger : AppColors.primary,
            foregroundColor: Colors.white,
          ),
          child: Text(textoConfirmar),
        ),
      ],
    ),
  );
  return resultado ?? false;
}
