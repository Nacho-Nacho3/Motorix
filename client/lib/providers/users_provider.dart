import 'package:flutter/foundation.dart';

import '../models/user.dart';
import '../services/api_client.dart';

/// Estado de la gestión de usuarios (US5, solo ADMIN).
class UsersProvider extends ChangeNotifier {
  UsersProvider(this.api);

  final ApiClient api;

  List<User> usuarios = [];
  bool cargando = true;
  String? error;
  String busqueda = '';
  String? filtroRol; // null o vacío = todos los roles

  Future<void> cargar({String? q, String? role}) async {
    if (q != null) busqueda = q;
    if (role != null) filtroRol = role;
    cargando = true;
    error = null;
    notifyListeners();

    try {
      final datos = await ApiClient.conRed(
        () => api.get(
          '/users',
          query: {
            if (busqueda.isNotEmpty) 'q': busqueda,
            if (filtroRol != null && filtroRol!.isNotEmpty) 'role': filtroRol!,
          },
        ),
      ) as Map<String, dynamic>;

      usuarios = (datos['users'] as List)
          .map((item) => User.fromJson(item as Map<String, dynamic>))
          .toList();
    } on ApiError catch (e) {
      error = e.message;
    } finally {
      cargando = false;
      notifyListeners();
    }
  }

  /// Cambia solo el filtro por rol.
  Future<void> filtrarPorRol(String? rol) => cargar(role: rol ?? '');

  /// Crea un usuario (FR-013). Devuelve `null` o el error del backend
  /// (409 DUPLICATE_USERNAME/DUPLICATE_EMAIL, 400 WEAK_PASSWORD…).
  Future<ApiError?> registrar({
    required String username,
    required String name,
    required String email,
    required String password,
    required String role,
  }) async {
    try {
      await ApiClient.conRed(
        () => api.post('/users', {
          'username': username,
          'name': name,
          'email': email,
          'password': password,
          'role': role,
        }),
      );
      await cargar();
      return null;
    } on ApiError catch (e) {
      return e;
    }
  }

  /// Edita un usuario. Los campos nulos no se envían (el backend exige al
  /// menos uno); `password` vacío significa "no cambiar la contraseña".
  Future<ApiError?> editar({
    required int id,
    String? name,
    String? email,
    String? role,
    bool? active,
    String? password,
  }) async {
    try {
      await ApiClient.conRed(
        () => api.patch('/users/$id', {
          'name': ?name,
          'email': ?email,
          'role': ?role,
          'active': ?active,
          if (password != null && password.isNotEmpty) 'password': password,
        }),
      );
      await cargar();
      return null;
    } on ApiError catch (e) {
      return e;
    }
  }
}
