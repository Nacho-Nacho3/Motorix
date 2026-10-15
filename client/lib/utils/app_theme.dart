import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';

/// T014: tokens del sistema de diseño (docs/design-system.md).
/// Los colores, tipografía, espaciados y radios se definen UNA sola vez aquí;
/// las pantallas NUNCA escriben valores sueltos.
class AppColors {
  static const Color primary = Color(0xFF9B4F55);
  static const Color sidebar = Color(0xFF2B2325);
  static const Color sidebarActive = Color(0xFF43353A);
  static const Color background = Color(0xFFF5F2F1);
  static const Color surface = Color(0xFFFFFFFF);
  static const Color outline = Color(0xFFDDD5D4);
  static const Color textPrimary = Color(0xFF231F20);
  static const Color textSecondary = Color(0xFF6F6566);
  static const Color warning = Color(0xFFC9892B);
  static const Color success = Color(0xFF4F7A5A);
  static const Color danger = Color(0xFFC0392B);
}

/// Escala de espaciado: 4 px base.
class AppSpacing {
  static const double xs = 4;
  static const double sm = 8;
  static const double md = 12;
  static const double lg = 16;
  static const double xl = 24;
  static const double xxl = 32;
}

/// Radios: 6 px botones/inputs; 8 px paneles, tarjetas, chips y diálogos; 12 px pill.
class AppRadii {
  static const double control = 6;
  static const double panel = 8;
  static const double pill = 12;
}

/// Duraciones de movimiento: 150/200/250 ms.
class AppDurations {
  static const Duration state = Duration(milliseconds: 150);
  static const Duration element = Duration(milliseconds: 200);
  static const Duration navigation = Duration(milliseconds: 250);
  static const Curve curve = Curves.easeInOut;
  static const Curve curveOut = Curves.easeOutCubic;
}

/// Escala tipográfica fija: 12, 14, 18, 28.
class AppFontSizes {
  static const double small = 12;
  static const double body = 14;
  static const double subtitle = 18;
  static const double title = 28;
}

/// Transición compartida del sistema de diseño (6.4): fade + slide leve,
/// con `easeInOut` al entrar y `easeOutCubic` al salir.
/// La usan las rutas de pantalla (`pageTransitionsTheme`) y el guard de
/// sesión en `main.dart` para que no exista ningún cambio brusco.
Widget transicionPantalla(Animation<double> animacion, Widget hijo) {
  final curva = CurvedAnimation(
    parent: animacion,
    curve: AppDurations.curve,
    reverseCurve: AppDurations.curveOut,
  );
  return FadeTransition(
    opacity: curva,
    child: SlideTransition(
      position: Tween<Offset>(
        begin: const Offset(0.04, 0),
        end: Offset.zero,
      ).animate(curva),
      child: hijo,
    ),
  );
}

/// Transición discreta entre pantallas (6.4). La duración (250 ms) la
/// define la ruta con `AppRoute`, no el tema.
class _TransicionDiscreta extends PageTransitionsBuilder {
  const _TransicionDiscreta();

  @override
  Widget buildTransitions<T>(
    PageRoute<T> route,
    BuildContext context,
    Animation<double> animation,
    Animation<double> secondaryAnimation,
    Widget child,
  ) =>
      transicionPantalla(animation, child);
}

/// Tema propio de Material 3 (nunca el tema por defecto de Material).
ThemeData buildAppTheme() {
  final baseText = GoogleFonts.ibmPlexSansTextTheme();

  return ThemeData(
    useMaterial3: true,
    scaffoldBackgroundColor: AppColors.background,
    colorScheme: ColorScheme.fromSeed(
      seedColor: AppColors.primary,
      brightness: Brightness.light,
    ).copyWith(
      primary: AppColors.primary,
      surface: AppColors.surface,
      surfaceContainerLowest: AppColors.background,
      outlineVariant: AppColors.outline,
      onSurface: AppColors.textPrimary,
      error: AppColors.danger,
    ),
    textTheme: baseText.copyWith(
      bodySmall: baseText.bodySmall?.copyWith(
        fontSize: AppFontSizes.small,
        color: AppColors.textSecondary,
      ),
      bodyMedium: baseText.bodyMedium?.copyWith(
        fontSize: AppFontSizes.body,
        color: AppColors.textPrimary,
      ),
      titleMedium: baseText.titleMedium?.copyWith(
        fontSize: AppFontSizes.subtitle,
        color: AppColors.textPrimary,
        fontWeight: FontWeight.w600,
      ),
      headlineSmall: baseText.headlineSmall?.copyWith(
        fontSize: AppFontSizes.title,
        color: AppColors.textPrimary,
        fontWeight: FontWeight.w600,
      ),
    ),
    appBarTheme: const AppBarTheme(
      backgroundColor: AppColors.surface,
      foregroundColor: AppColors.textPrimary,
      elevation: 0,
      centerTitle: false,
    ),
    cardTheme: CardThemeData(
      color: AppColors.surface,
      elevation: 0,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(AppRadii.panel),
        side: const BorderSide(color: AppColors.outline),
      ),
      margin: EdgeInsets.zero,
    ),
    dialogTheme: DialogThemeData(
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(AppRadii.panel),
      ),
    ),
    inputDecorationTheme: InputDecorationTheme(
      filled: true,
      fillColor: AppColors.surface,
      border: OutlineInputBorder(
        borderRadius: BorderRadius.circular(AppRadii.control),
        borderSide: const BorderSide(color: AppColors.outline),
      ),
      enabledBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(AppRadii.control),
        borderSide: const BorderSide(color: AppColors.outline),
      ),
      focusedBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(AppRadii.control),
        borderSide: const BorderSide(color: AppColors.primary, width: 2),
      ),
      contentPadding: const EdgeInsets.symmetric(
        horizontal: AppSpacing.md,
        vertical: AppSpacing.sm,
      ),
    ),
    elevatedButtonTheme: ElevatedButtonThemeData(
      style: ElevatedButton.styleFrom(
        backgroundColor: AppColors.primary,
        foregroundColor: Colors.white,
        minimumSize: const Size(0, 44),
        padding: const EdgeInsets.symmetric(
          horizontal: AppSpacing.lg,
          vertical: AppSpacing.sm,
        ),
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(AppRadii.control),
        ),
        textStyle: GoogleFonts.ibmPlexSans(fontSize: AppFontSizes.body),
      ),
    ),
    outlinedButtonTheme: OutlinedButtonThemeData(
      style: OutlinedButton.styleFrom(
        foregroundColor: AppColors.textPrimary,
        minimumSize: const Size(0, 44),
        side: const BorderSide(color: AppColors.outline),
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(AppRadii.control),
        ),
      ),
    ),
    // Mismo estilo que Elevated: los botones se ven idénticos (8.1).
    filledButtonTheme: FilledButtonThemeData(
      style: FilledButton.styleFrom(
        backgroundColor: AppColors.primary,
        foregroundColor: Colors.white,
        minimumSize: const Size(0, 44),
        padding: const EdgeInsets.symmetric(
          horizontal: AppSpacing.lg,
          vertical: AppSpacing.sm,
        ),
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(AppRadii.control),
        ),
        textStyle: GoogleFonts.ibmPlexSans(fontSize: AppFontSizes.body),
      ),
    ),
    textButtonTheme: TextButtonThemeData(
      style: TextButton.styleFrom(
        foregroundColor: AppColors.primary,
        minimumSize: const Size(0, 44),
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(AppRadii.control),
        ),
        textStyle: GoogleFonts.ibmPlexSans(fontSize: AppFontSizes.body),
      ),
    ),
    navigationRailTheme: NavigationRailThemeData(
      backgroundColor: AppColors.sidebar,
      indicatorColor: AppColors.sidebarActive,
      selectedIconTheme: const IconThemeData(color: Colors.white),
      unselectedIconTheme: IconThemeData(color: Colors.white.withValues(alpha: 0.6)),
      selectedLabelTextStyle: GoogleFonts.ibmPlexSans(
        fontSize: AppFontSizes.small,
        color: Colors.white,
        fontWeight: FontWeight.w600,
      ),
      unselectedLabelTextStyle: GoogleFonts.ibmPlexSans(
        fontSize: AppFontSizes.small,
        color: Colors.white.withValues(alpha: 0.6),
      ),
    ),
    dividerTheme: const DividerThemeData(color: AppColors.outline, thickness: 1),
    progressIndicatorTheme: const ProgressIndicatorThemeData(color: AppColors.primary),
    snackBarTheme: SnackBarThemeData(
      behavior: SnackBarBehavior.floating,
      backgroundColor: AppColors.textPrimary,
      contentTextStyle: GoogleFonts.ibmPlexSans(
        fontSize: AppFontSizes.body,
        color: Colors.white,
      ),
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(AppRadii.control),
      ),
    ),
    tooltipTheme: TooltipThemeData(
      waitDuration: AppDurations.state,
      decoration: BoxDecoration(
        color: AppColors.textPrimary,
        borderRadius: BorderRadius.circular(AppRadii.control),
      ),
      textStyle: GoogleFonts.ibmPlexSans(
        fontSize: AppFontSizes.small,
        color: Colors.white,
      ),
    ),
    pageTransitionsTheme: const PageTransitionsTheme(
      builders: {
        TargetPlatform.android: _TransicionDiscreta(),
        TargetPlatform.iOS: _TransicionDiscreta(),
        TargetPlatform.fuchsia: _TransicionDiscreta(),
        TargetPlatform.linux: _TransicionDiscreta(),
        TargetPlatform.macOS: _TransicionDiscreta(),
        TargetPlatform.windows: _TransicionDiscreta(),
      },
    ),
  );
}
