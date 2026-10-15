import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:provider/provider.dart';

import 'package:motorix_client/models/user.dart';
import 'package:motorix_client/providers/session_provider.dart';
import 'package:motorix_client/providers/ui_provider.dart';
import 'package:motorix_client/services/api_client.dart';
import 'package:motorix_client/widgets/app_shell.dart';

class _ApiFalsa extends ApiClient {
  @override
  Future<dynamic> get(String path, {Map<String, String>? query}) async {
    return {'users': <Map<String, dynamic>>[]};
  }

  @override
  Future<dynamic> post(String path, Object cuerpo) async {
    throw ApiError(status: 401, code: 'UNAUTHORIZED', message: 'Sin sesión.');
  }
}

Widget _shell(User usuario) {
  final sesion = SessionProvider(_ApiFalsa());
  sesion.usuario = usuario; // estado de prueba, sin notificar
  return MultiProvider(
    providers: [
      ChangeNotifierProvider<SessionProvider>.value(value: sesion),
      ChangeNotifierProvider<UiProvider>(create: (_) => UiProvider()),
    ],
    child: MaterialApp(
      theme: ThemeData(useMaterial3: true),
      home: const AppShell(),
    ),
  );
}

const _recepcionista = User(
  id: 2,
  username: 'recepcion',
  name: 'Recepción',
  email: 'recepcion@motorix.local',
  role: 'RECEPTIONIST',
);

const _administrador = User(
  id: 1,
  username: 'admin',
  name: 'Administrador',
  email: 'admin@motorix.local',
  role: 'ADMIN',
);

void main() {
  testWidgets('un usuario no administrador ve Inicio, Clientes y Vehículos, pero no Usuarios',
      (tester) async {
    await tester.pumpWidget(_shell(_recepcionista));
    await tester.pump();

    expect(find.text('Inicio'), findsWidgets);
    expect(find.text('Clientes'), findsWidgets);
    expect(find.text('Vehículos'), findsWidgets);
    expect(find.text('Usuarios'), findsNothing,
        reason: 'Usuarios solo es visible para ADMIN (Q1-A)');
    expect(find.text('Hola, Recepción'), findsOneWidget);
  });

  testWidgets('un administrador también ve la sección Usuarios', (tester) async {
    await tester.pumpWidget(_shell(_administrador));
    await tester.pump();

    expect(find.text('Usuarios'), findsWidgets);
    expect(find.text('Hola, Administrador'), findsOneWidget);
    expect(find.byTooltip('Cerrar sesión'), findsOneWidget);
  });

  testWidgets('el botón del sidebar contrae y expande el menú lateral',
      (tester) async {
    await tester.pumpWidget(_shell(_administrador));
    await tester.pump();

    final ui = tester.element(find.byType(AppShell)).read<UiProvider>();
    expect(ui.sidebarExpandido, isTrue);

    await tester.tap(find.byTooltip('Contraer menú lateral'));
    await tester.pumpAndSettle();

    expect(ui.sidebarExpandido, isFalse);
    expect(find.byTooltip('Expandir menú lateral'), findsOneWidget);
  });
}
