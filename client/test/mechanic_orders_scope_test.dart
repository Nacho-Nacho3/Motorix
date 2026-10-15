import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:provider/provider.dart';

import 'package:motorix_client/models/user.dart';
import 'package:motorix_client/providers/service_orders_provider.dart';
import 'package:motorix_client/providers/session_provider.dart';
import 'package:motorix_client/screens/orders/order_list_screen.dart';
import 'package:motorix_client/services/api_client.dart';

/// ApiClient falso para el rol MECHANIC: sin órdenes asignadas y sin
/// endpoint de mecánicos (que el mecánico nunca usa).
class _ApiMecanicoFalsa extends ApiClient {
  @override
  Future<dynamic> get(String path, {Map<String, String>? query}) async {
    if (path.startsWith('/service-orders/mechanics')) {
      throw ApiError(
        status: 403,
        code: 'FORBIDDEN',
        message: 'No tienes permisos para realizar esta acción.',
      );
    }
    return {'orders': <Map<String, dynamic>>[], 'total': 0};
  }
}

Widget _pantalla(_ApiMecanicoFalsa api) {
  final sesion = SessionProvider(api);
  sesion.usuario = const User(
    id: 3,
    username: 'mecanico',
    name: 'Mecánico Demo',
    email: 'mecanico@motorix.local',
    role: 'MECHANIC',
  );
  return MultiProvider(
    providers: [
      ChangeNotifierProvider<SessionProvider>.value(value: sesion),
      ChangeNotifierProvider<ServiceOrdersProvider>(
        create: (_) => ServiceOrdersProvider(api),
      ),
    ],
    child: MaterialApp(
      theme: ThemeData(useMaterial3: true),
      home: const OrderListScreen(),
    ),
  );
}

void main() {
  testWidgets('la lista del mecánico muestra la etiqueta «Solo mis órdenes»',
      (tester) async {
    await tester.pumpWidget(_pantalla(_ApiMecanicoFalsa()));
    await tester.pumpAndSettle();

    expect(find.text('Solo mis órdenes'), findsOneWidget);
  });

  testWidgets('no ofrece el alta de órdenes para el rol MECHANIC',
      (tester) async {
    await tester.pumpWidget(_pantalla(_ApiMecanicoFalsa()));
    await tester.pumpAndSettle();

    expect(find.byType(FloatingActionButton), findsNothing);
    expect(find.text('Nueva orden'), findsNothing);
  });

  testWidgets('el estado vacío muestra el mensaje en español',
      (tester) async {
    await tester.pumpWidget(_pantalla(_ApiMecanicoFalsa()));
    await tester.pumpAndSettle();

    expect(
      find.text('Cuando te asignen una orden de servicio aparecerá aquí.'),
      findsOneWidget,
    );
    expect(find.text('Recargar'), findsOneWidget);
  });
}
