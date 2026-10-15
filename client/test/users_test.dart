import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:provider/provider.dart';

import 'package:motorix_client/models/user.dart';
import 'package:motorix_client/providers/session_provider.dart';
import 'package:motorix_client/providers/ui_provider.dart';
import 'package:motorix_client/providers/users_provider.dart';
import 'package:motorix_client/screens/users/user_form_screen.dart';
import 'package:motorix_client/screens/users/user_list_screen.dart';
import 'package:motorix_client/services/api_client.dart';
import 'package:motorix_client/widgets/app_shell.dart';

/// ApiClient falso para usuarios: lista, alta y cambio de estado (T066).
class _ApiUsuariosFalsa extends ApiClient {
  _ApiUsuariosFalsa({List<Map<String, dynamic>>? usuarios})
      : usuarios = usuarios ?? [{..._usuarioBase}];

  List<Map<String, dynamic>> usuarios;
  Map<String, dynamic>? ultimoCuerpo;
  int posteos = 0;
  int patcheos = 0;

  @override
  Future<dynamic> get(String path, {Map<String, String>? query}) async {
    var filtrada = usuarios;
    final texto = query?['q']?.toLowerCase();
    if (texto != null && texto.isNotEmpty) {
      filtrada = filtrada
          .where((u) =>
              (u['username'] as String).toLowerCase().contains(texto) ||
              (u['name'] as String).toLowerCase().contains(texto) ||
              (u['email'] as String).toLowerCase().contains(texto))
          .toList();
    }
    final rol = query?['role'];
    if (rol != null && rol.isNotEmpty) {
      filtrada = filtrada.where((u) => u['role'] == rol).toList();
    }
    return {'users': filtrada};
  }

  @override
  Future<dynamic> post(String path, Object cuerpo) async {
    posteos += 1;
    ultimoCuerpo = Map<String, dynamic>.from(cuerpo as Map);
    final nuevo = {
      'id': usuarios.length + 1,
      'username': ultimoCuerpo!['username'],
      'name': ultimoCuerpo!['name'],
      'email': ultimoCuerpo!['email'],
      'role': ultimoCuerpo!['role'],
      'active': true,
      'createdAt': '2026-10-13T10:00:00',
      'updatedAt': '2026-10-13T10:00:00',
    };
    usuarios = [...usuarios, nuevo];
    return {'user': nuevo};
  }

  @override
  Future<dynamic> patch(String path, Object cuerpo) async {
    patcheos += 1;
    ultimoCuerpo = Map<String, dynamic>.from(cuerpo as Map);
    final id = int.parse(path.split('/').last);
    usuarios = [
      for (final usuario in usuarios)
        if (usuario['id'] == id) {...usuario, ...ultimoCuerpo!} else usuario,
    ];
    return {'user': usuarios.firstWhere((u) => u['id'] == id)};
  }
}

final Map<String, dynamic> _usuarioBase = {
  'id': 1,
  'username': 'admin',
  'name': 'Administrador',
  'email': 'admin@motorix.local',
  'role': 'ADMIN',
  'active': true,
  'createdAt': '2026-10-13T10:00:00',
  'updatedAt': '2026-10-13T10:00:00',
};

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

/// Shell completo con sesión y proveedor de usuarios (sección Usuarios, T065).
Widget _shell(User usuario, _ApiUsuariosFalsa api) {
  final sesion = SessionProvider(api);
  sesion.usuario = usuario; // estado de prueba, sin notificar
  return MultiProvider(
    providers: [
      ChangeNotifierProvider<SessionProvider>.value(value: sesion),
      ChangeNotifierProvider<UiProvider>(create: (_) => UiProvider()),
      ChangeNotifierProvider<UsersProvider>.value(value: UsersProvider(api)),
    ],
    child: MaterialApp(
      theme: ThemeData(useMaterial3: true),
      home: const AppShell(),
    ),
  );
}

Widget _pantalla(_ApiUsuariosFalsa api) =>
    ChangeNotifierProvider<UsersProvider>(
      create: (_) => UsersProvider(api),
      child: MaterialApp(
        theme: ThemeData(useMaterial3: true),
        home: const UserListScreen(),
      ),
    );

Future<void> _abrirFormulario(WidgetTester tester) async {
  await tester.pumpAndSettle();
  await tester.tap(find.byType(FloatingActionButton));
  await tester.pumpAndSettle();
  expect(find.byType(UserFormScreen), findsOneWidget);
}

Future<void> _llenarUsuario(WidgetTester tester) async {
  await tester.enterText(find.byType(TextFormField).at(0), 'ana');
  await tester.enterText(find.byType(TextFormField).at(1), 'Ana López');
  await tester.enterText(find.byType(TextFormField).at(2), 'ana@motorix.local');
  await tester.enterText(find.byType(TextFormField).at(3), 'Ana2026!');
  await tester.tap(find.byType(DropdownButtonFormField<String>).first);
  await tester.pumpAndSettle();
  await tester.tap(find.text('Recepción').last);
  await tester.pumpAndSettle();
}

void main() {
  testWidgets('la sección Usuarios solo se ve y se navega para ADMIN (Q1-A)',
      (tester) async {
    final api = _ApiUsuariosFalsa();

    // Rol no administrador: la sección ni aparece.
    await tester.pumpWidget(_shell(_recepcionista, api));
    await tester.pumpAndSettle();
    expect(find.text('Usuarios'), findsNothing,
        reason: 'los roles que no son ADMIN no deben ver Usuarios');

    // Administrador: la sección existe y abre el CRUD.
    await tester.pumpWidget(_shell(_administrador, api));
    await tester.pumpAndSettle();
    expect(find.text('Usuarios'), findsWidgets);

    await tester.tap(
      find.descendant(
        of: find.byType(NavigationRail),
        matching: find.text('Usuarios'),
      ),
    );
    await tester.pumpAndSettle();

    expect(find.byType(FloatingActionButton), findsOneWidget);
    expect(find.textContaining('admin@motorix.local'), findsOneWidget,
        reason: 'el listado de usuarios debe mostrarse');
  });

  testWidgets('el alta valida los campos obligatorios en español',
      (tester) async {
    final api = _ApiUsuariosFalsa();
    await tester.pumpWidget(_pantalla(api));
    await _abrirFormulario(tester);

    await tester.tap(find.widgetWithText(ElevatedButton, 'Registrar'));
    await tester.pump();

    expect(find.text('El usuario es obligatorio.'), findsOneWidget);
    expect(find.text('El nombre es obligatorio.'), findsOneWidget);
    expect(find.text('El correo es obligatorio.'), findsOneWidget);
    expect(find.text('La contraseña es obligatoria.'), findsOneWidget);
    expect(find.text('Selecciona un rol.'), findsOneWidget);
    expect(api.posteos, 0, reason: 'no debe enviar nada inválido');
    expect(find.byType(UserFormScreen), findsOneWidget);
  });

  testWidgets('la contraseña fuera de política muestra el aviso en español',
      (tester) async {
    final api = _ApiUsuariosFalsa();
    await tester.pumpWidget(_pantalla(api));
    await _abrirFormulario(tester);

    await tester.enterText(find.byType(TextFormField).at(0), 'ana');
    await tester.enterText(find.byType(TextFormField).at(1), 'Ana López');
    await tester.enterText(find.byType(TextFormField).at(2), 'ana@motorix.local');
    await tester.enterText(find.byType(TextFormField).at(3), 'abcdefg1');
    await tester.tap(find.byType(DropdownButtonFormField<String>).first);
    await tester.pumpAndSettle();
    await tester.tap(find.text('Recepción').last);
    await tester.pumpAndSettle();

    await tester.tap(find.widgetWithText(ElevatedButton, 'Registrar'));
    await tester.pump();

    expect(
      find.text('Debe tener 8 caracteres, una mayúscula, una minúscula y un número.'),
      findsOneWidget,
    );
    expect(api.posteos, 0,
        reason: 'la contraseña débil no debe llegar al backend');
  });

  testWidgets('crea un usuario con el rol elegido y aparece en el listado',
      (tester) async {
    final api = _ApiUsuariosFalsa();
    await tester.pumpWidget(_pantalla(api));
    await _abrirFormulario(tester);

    await _llenarUsuario(tester);

    await tester.tap(find.widgetWithText(ElevatedButton, 'Registrar'));
    await tester.pumpAndSettle();

    expect(api.posteos, 1);
    expect(api.ultimoCuerpo?['username'], 'ana');
    expect(api.ultimoCuerpo?['role'], 'RECEPTIONIST',
        reason: 'debe enviar el rol elegido en el selector');
    expect(api.ultimoCuerpo?['password'], 'Ana2026!');
    expect(find.byType(UserFormScreen), findsNothing,
        reason: 'debe volver al listado tras guardar');
    expect(find.text('Ana López'), findsOneWidget);
    expect(find.text('Usuario creado'), findsOneWidget);

    await tester.pump(const Duration(seconds: 5));
    await tester.pumpAndSettle();
  });

  testWidgets('desactivar un usuario pide confirmación y cancelar no envía nada',
      (tester) async {
    final api = _ApiUsuariosFalsa();
    await tester.pumpWidget(_pantalla(api));
    await tester.pumpAndSettle();

    await tester.tap(find.byType(Switch));
    await tester.pumpAndSettle();

    expect(find.text('Desactivar usuario'), findsOneWidget);
    expect(
      find.text(
          '¿Desactivar la cuenta de Administrador? Dejará de poder iniciar sesión.'),
      findsOneWidget,
    );

    await tester.tap(find.widgetWithText(TextButton, 'Cancelar'));
    await tester.pumpAndSettle();

    expect(find.text('Desactivar usuario'), findsNothing);
    expect(api.patcheos, 0, reason: 'cancelar no debe modificar nada');
    expect(find.textContaining('Activo'), findsOneWidget);
  });

  testWidgets('la desactivación confirmada envía active:false al backend',
      (tester) async {
    final api = _ApiUsuariosFalsa();
    await tester.pumpWidget(_pantalla(api));
    await tester.pumpAndSettle();

    await tester.tap(find.byType(Switch));
    await tester.pumpAndSettle();
    await tester.tap(find.widgetWithText(FilledButton, 'Confirmar'));
    await tester.pumpAndSettle();

    expect(api.patcheos, 1);
    expect(api.ultimoCuerpo?['active'], false);
    expect(find.text('Usuario desactivado'), findsOneWidget);
    expect(find.textContaining('Inactivo'), findsOneWidget);

    await tester.pump(const Duration(seconds: 5));
    await tester.pumpAndSettle();
  });
}
