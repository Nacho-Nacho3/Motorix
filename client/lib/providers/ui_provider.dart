import 'package:flutter/foundation.dart';

/// Estado de la interfaz compartido (layout de escritorio).
class UiProvider extends ChangeNotifier {
  /// Sidebar colapsable: fijo con Inicio, Clientes, Vehículos
  /// y Usuarios solo para ADMIN (clarificación Q1, opción A).
  bool sidebarExpandido = true;

  void alternarSidebar() {
    sidebarExpandido = !sidebarExpandido;
    notifyListeners();
  }
}
