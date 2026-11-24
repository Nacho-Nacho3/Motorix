import 'package:flutter/material.dart';

import 'app_theme.dart';

/// Ruta de pantalla con la duración de navegación del sistema de diseño
/// (6.4: 250 ms). El estilo de la transición (fade + slide leve) lo define
/// el tema con `pageTransitionsTheme`; la ruta solo fija la duración.
class AppRoute<T> extends MaterialPageRoute<T> {
  AppRoute({required super.builder});

  @override
  Duration get transitionDuration => AppDurations.navigation;

  @override
  Duration get reverseTransitionDuration => AppDurations.navigation;
}

/// T029 (US6, FR-007): rutas de los avisos del centro de notificaciones y
/// la sección del shell que abre cada una. Los valores de `route` los envía
/// el backend en `navigation`; `entityId` queda reservado para enlaces
/// directos (el detalle de la orden se abre desde su lista).
class AppRutas {
  AppRutas._();

  static const mantenimiento = '/maintenance';
  static const cita = '/appointments';
  static const inventario = '/inventory';
  static const orden = '/orders';

  /// Índice de la sección del shell para cada ruta de aviso (espejo de
  /// `_vistaSeccion` en app_shell.dart); null si la ruta es desconocida.
  static int? seccionDeRuta(String ruta) {
    switch (ruta) {
      case mantenimiento:
        return 7;
      case cita:
        return 3;
      case inventario:
        return 8;
      case orden:
        return 4;
      default:
        return null;
    }
  }
}
