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
