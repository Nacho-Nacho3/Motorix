import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:provider/provider.dart';

import 'package:motorix_client/providers/session_provider.dart';
import 'package:motorix_client/screens/login/login_screen.dart';
import 'package:motorix_client/services/api_client.dart';

class _ApiFalsa extends ApiClient {
  _ApiFalsa({this.fallo});

  final Object? fallo;

  @override
  Future<dynamic> post(String path, Object cuerpo) async {
    if (fallo != null) throw fallo!;
    return {
      'token': 'abc.def.ghi',
      'expiresIn': 28800,
      'user': {
        'id': 1,
        'username': 'admin',
        'name': 'Administrador',
        'email': 'admin@motorix.local',
        'role': 'ADMIN',
      },
    };
  }
}

Widget _pantalla(SessionProvider sesion) => ChangeNotifierProvider.value(
      value: sesion,
      child: MaterialApp(
        theme: ThemeData(useMaterial3: true),
        home: const LoginScreen(),
      ),
    );

void main() {
  testWidgets('muestra validación en español al enviar el formulario vacío',
      (tester) async {
    final sesion = SessionProvider(_ApiFalsa());
    await tester.pumpWidget(_pantalla(sesion));

    await tester.tap(find.widgetWithText(ElevatedButton, 'Iniciar sesión'));
    await tester.pump();

    expect(find.text('Escribe tu usuario o correo.'), findsOneWidget);
    expect(find.text('Escribe tu contraseña.'), findsOneWidget);
    expect(sesion.autenticado, isFalse);
  });

  testWidgets('muestra el error de credenciales del backend en un snackbar',
      (tester) async {
    final sesion = SessionProvider(
      _ApiFalsa(
        fallo: ApiError(
          status: 401,
          code: 'INVALID_CREDENTIALS',
          message: 'Usuario o contraseña incorrectos.',
        ),
      ),
    );
    await tester.pumpWidget(_pantalla(sesion));

    await tester.enterText(find.byType(TextFormField).first, 'admin');
    await tester.enterText(find.byType(TextFormField).at(1), 'clave-mala');
    await tester.tap(find.widgetWithText(ElevatedButton, 'Iniciar sesión'));
    await tester.pumpAndSettle();

    expect(find.text('Usuario o contraseña incorrectos.'), findsOneWidget,
        reason: 'el mensaje del backend debe mostrarse al usuario');
    expect(sesion.autenticado, isFalse);

    // Deja expirar el snackbar para no dejar temporizadores pendientes.
    await tester.pump(const Duration(seconds: 5));
    await tester.pumpAndSettle();
  });

  testWidgets('el botón de acceso se deshabilita mientras carga',
      (tester) async {
    final sesion = SessionProvider(_ApiFalsa());
    await tester.pumpWidget(_pantalla(sesion));

    expect(find.widgetWithText(ElevatedButton, 'Iniciar sesión'), findsOneWidget);
    expect(sesion.cargando, isFalse);

    await tester.enterText(find.byType(TextFormField).first, 'admin');
    await tester.enterText(find.byType(TextFormField).at(1), 'Admin2026!');
    await tester.tap(find.widgetWithText(ElevatedButton, 'Iniciar sesión'));
    await tester.pump();

    // Login exitoso: la raíz cambiaría a AppShell; aquí validamos el estado.
    expect(sesion.cargando, isFalse);
    expect(sesion.usuario?.username, 'admin');
  });
}
