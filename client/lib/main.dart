import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import 'providers/appointments_provider.dart';
import 'providers/client_notices_provider.dart';
import 'providers/clients_provider.dart';
import 'providers/dashboard_provider.dart';
import 'providers/maintenances_provider.dart';
import 'providers/notifications_provider.dart';
import 'providers/parts_provider.dart';
import 'providers/payments_provider.dart';
import 'providers/service_orders_provider.dart';
import 'providers/service_types_provider.dart';
import 'providers/settings_provider.dart';
import 'providers/session_provider.dart';
import 'providers/terms_provider.dart';
import 'providers/ui_provider.dart';
import 'providers/users_provider.dart';
import 'providers/vehicle_history_provider.dart';
import 'providers/vehicles_provider.dart';
import 'screens/login/login_screen.dart';
import 'screens/terms/terms_acceptance_screen.dart';
import 'services/api_client.dart';
import 'utils/app_theme.dart';
import 'widgets/app_shell.dart';

void main() {
  runApp(const MotorixApp());
}

class MotorixApp extends StatelessWidget {
  const MotorixApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MultiProvider(
      providers: [
        Provider<ApiClient>(create: (_) => ApiClient()),
        ChangeNotifierProvider<SessionProvider>(
          create: (context) => SessionProvider(context.read<ApiClient>()),
        ),
        ChangeNotifierProvider<UiProvider>(
          create: (_) => UiProvider(),
        ),
        ChangeNotifierProvider<ClientsProvider>(
          create: (context) => ClientsProvider(context.read<ApiClient>()),
        ),
        ChangeNotifierProvider<VehiclesProvider>(
          create: (context) => VehiclesProvider(context.read<ApiClient>()),
        ),
        ChangeNotifierProvider<UsersProvider>(
          create: (context) => UsersProvider(context.read<ApiClient>()),
        ),
        ChangeNotifierProvider<AppointmentsProvider>(
          create: (context) => AppointmentsProvider(context.read<ApiClient>()),
        ),
        ChangeNotifierProvider<ServiceOrdersProvider>(
          create: (context) => ServiceOrdersProvider(context.read<ApiClient>()),
        ),
        ChangeNotifierProvider<VehicleHistoryProvider>(
          create: (context) =>
              VehicleHistoryProvider(context.read<ApiClient>()),
        ),
        ChangeNotifierProvider<MaintenancesProvider>(
          create: (context) => MaintenancesProvider(context.read<ApiClient>()),
        ),
        ChangeNotifierProvider<PartsProvider>(
          create: (context) => PartsProvider(context.read<ApiClient>()),
        ),
        ChangeNotifierProvider<PaymentsProvider>(
          create: (context) => PaymentsProvider(context.read<ApiClient>()),
        ),
        // T058: panel de control exclusivo de ADMIN (US5).
        ChangeNotifierProvider<DashboardProvider>(
          create: (context) => DashboardProvider(context.read<ApiClient>()),
        ),
        // T074 (Sprint 7, US9): términos y aviso de privacidad.
        ChangeNotifierProvider<TermsProvider>(
          create: (context) => TermsProvider(context.read<ApiClient>()),
        ),
        // T051 (Sprint 7, US3): catálogo de tipos de servicio.
        ChangeNotifierProvider<ServiceTypesProvider>(
          create: (context) => ServiceTypesProvider(context.read<ApiClient>()),
        ),
        // T028 (Sprint 7, US1): configuración del taller, solo ADMIN.
        ChangeNotifierProvider<SettingsProvider>(
          create: (context) => SettingsProvider(context.read<ApiClient>()),
        ),
        // T057 (US7): clientes por avisar, solo ADMIN y recepción.
        ChangeNotifierProvider<ClientNoticesProvider>(
          create: (context) => ClientNoticesProvider(context.read<ApiClient>()),
        ),
        // T017: centro de avisos (US1). `lazy: false` para conectar el
        // disparo de D-03 antes del primer inicio de sesión.
        ChangeNotifierProvider<NotificationsProvider>(
          lazy: false,
          create: (context) {
            final notificaciones =
                NotificationsProvider(context.read<ApiClient>());
            context.read<SessionProvider>().alIniciarSesion =
                notificaciones.cargar;
            return notificaciones;
          },
        ),
      ],
      child: MaterialApp(
        title: 'Motorix',
        debugShowCheckedModeBanner: false,
        theme: buildAppTheme(),
        home: const RaizApp(),
      ),
    );
  }
}

/// Guard de autenticación: decide entre login y el shell.
class RaizApp extends StatelessWidget {
  const RaizApp({super.key});

  @override
  Widget build(BuildContext context) {
    final sesion = context.watch<SessionProvider>();

    // Guard de expiración: no se hace logout dentro del build (regla de Flutter),
    // se agenda para el siguiente frame.
    if (sesion.autenticado && sesion.sesionExpirada) {
      WidgetsBinding.instance.addPostFrameCallback((_) {
        sesion.cerrarSesion();
      });
    }

    // Transición suave entre login y shell (6.4): 250 ms, fade + slide leve.
    return AnimatedSwitcher(
      duration: AppDurations.navigation,
      transitionBuilder: (hijo, animacion) =>
          transicionPantalla(animacion, hijo),
      // Sprint 7 (US9, CA-16, CA-19): sin aceptación vigente, la pantalla de
      // términos va en lugar del shell, sin cerrar la sesión.
      child: !sesion.autenticado
          ? const LoginScreen()
          : sesion.termsAccepted
              ? const AppShell()
              : const TermsAcceptanceScreen(),
    );
  }
}
