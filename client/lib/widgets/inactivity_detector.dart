import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

/// Detector de inactividad (Sprint 7, US10, CA-23). Escucha el puntero y el
/// teclado; cada actividad reinicia el reloj y, al cumplirse [duracion] sin
/// actividad, avisa con [alInactividad] una sola vez. El backend vuelve a
/// validar la inactividad en cada petición: este detector solo adelanta el
/// cierre en la interfaz.
class InactivityDetector extends StatefulWidget {
  const InactivityDetector({
    super.key,
    required this.child,
    required this.alInactividad,
    this.duracion = const Duration(minutes: 30),
  });

  final Widget child;
  final VoidCallback alInactividad;
  final Duration duracion;

  @override
  State<InactivityDetector> createState() => _InactivityDetectorState();
}

class _InactivityDetectorState extends State<InactivityDetector> {
  Timer? _reloj;

  @override
  void initState() {
    super.initState();
    HardwareKeyboard.instance.addHandler(_alTeclado);
    _reiniciar();
  }

  @override
  void didUpdateWidget(InactivityDetector anterior) {
    super.didUpdateWidget(anterior);
    if (anterior.duracion != widget.duracion) _reiniciar();
  }

  @override
  void dispose() {
    HardwareKeyboard.instance.removeHandler(_alTeclado);
    _reloj?.cancel();
    super.dispose();
  }

  bool _alTeclado(KeyEvent _) {
    _reiniciar();
    return false; // no consume la tecla
  }

  void _reiniciar() {
    _reloj?.cancel();
    _reloj = Timer(widget.duracion, () {
      if (mounted) widget.alInactividad();
    });
  }

  @override
  Widget build(BuildContext context) {
    return Listener(
      behavior: HitTestBehavior.translucent,
      onPointerDown: (_) => _reiniciar(),
      onPointerMove: (_) => _reiniciar(),
      onPointerHover: (_) => _reiniciar(),
      onPointerSignal: (_) => _reiniciar(),
      child: widget.child,
    );
  }
}
