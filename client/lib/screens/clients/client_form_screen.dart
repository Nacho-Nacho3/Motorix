import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../models/client.dart';
import '../../providers/clients_provider.dart';
import '../../services/api_client.dart';
import '../../utils/app_theme.dart';
import '../../widgets/confirm_dialog.dart';

final RegExp _correoValido = RegExp(r'^[^@\s]+@[^@\s]+\.[^@\s]+$');

/// Alta y edición de clientes (T038). Si recibe [cliente] existe, edita (FR-008).
class ClienteFormScreen extends StatefulWidget {
  const ClienteFormScreen({super.key, this.cliente});

  final Client? cliente;

  @override
  State<ClienteFormScreen> createState() => _ClienteFormScreenState();
}

class _ClienteFormScreenState extends State<ClienteFormScreen> {
  final _formKey = GlobalKey<FormState>();
  late final TextEditingController _nombreCtrl;
  late final TextEditingController _telefonoCtrl;
  late final TextEditingController _correoCtrl;
  bool _guardando = false;

  bool get _esEdicion => widget.cliente != null;

  /// Detecta cambios sin guardar respecto a los datos precargados (T057).
  bool get _hayCambios {
    final cliente = widget.cliente;
    return _nombreCtrl.text.trim() != (cliente?.name ?? '') ||
        _telefonoCtrl.text.trim() != (cliente?.phone ?? '') ||
        _correoCtrl.text.trim() != (cliente?.email ?? '');
  }

  @override
  void initState() {
    super.initState();
    _nombreCtrl = TextEditingController(text: widget.cliente?.name ?? '');
    _telefonoCtrl = TextEditingController(text: widget.cliente?.phone ?? '');
    _correoCtrl = TextEditingController(text: widget.cliente?.email ?? '');
  }

  @override
  void dispose() {
    _nombreCtrl.dispose();
    _telefonoCtrl.dispose();
    _correoCtrl.dispose();
    super.dispose();
  }

  Future<void> _guardar({bool confirmarTelefono = false}) async {
    final form = _formKey.currentState;
    if (form == null || !form.validate()) return;

    setState(() => _guardando = true);
    final proveedor = context.read<ClientsProvider>();

    final ApiError? error;
    if (_esEdicion) {
      error = await proveedor.editar(
        id: widget.cliente!.id,
        name: _nombreCtrl.text.trim(),
        phone: _telefonoCtrl.text.trim(),
        email: _correoCtrl.text.trim(),
        confirmDuplicatePhone: confirmarTelefono,
      );
    } else {
      error = await proveedor.registrar(
        name: _nombreCtrl.text.trim(),
        phone: _telefonoCtrl.text.trim(),
        email: _correoCtrl.text.trim(),
        confirmDuplicatePhone: confirmarTelefono,
      );
    }

    if (!mounted) return;

    // VC-02: teléfono repetido → avisar y confirmar antes de reintentar.
    if (error != null && error.code == 'DUPLICATE_PHONE') {
      // Se detiene el indicador mientras la persona decide (evita bucles de animación).
      setState(() => _guardando = false);
      final confirmado = await mostrarConfirmacion(
        context,
        titulo: 'Teléfono repetido',
        mensaje:
            'Ya existe un cliente con ese teléfono. ¿Guardar de todos modos?',
      );
      if (!confirmado || !mounted) return;
      await _guardar(confirmarTelefono: true);
      return;
    }

    if (error != null) {
      setState(() => _guardando = false);
      ScaffoldMessenger.of(context)
          .showSnackBar(SnackBar(content: Text(error.message)));
      return;
    }

    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(
          _esEdicion ? 'Cliente actualizado' : 'Cliente registrado',
        ),
      ),
    );
    Navigator.of(context).pop(true);
  }

  @override
  Widget build(BuildContext context) {
    // canPop siempre falso: la salida se decide aquí, con confirmación si hay
    // cambios sin guardar (el guardado sale por código y no pasa por aquí).
    return PopScope(
      canPop: false,
      onPopInvokedWithResult: (didPop, _) async {
        if (didPop) return;
        if (!mounted) return;
        if (!_hayCambios) {
          Navigator.of(context).pop();
          return;
        }
        final salir = await mostrarConfirmacion(
          context,
          titulo: 'Cambios sin guardar',
          mensaje: 'Tienes cambios sin guardar. ¿Salir sin guardar?',
          esPeligrosa: true,
        );
        if (salir && context.mounted) {
          Navigator.of(context).pop();
        }
      },
      child: Scaffold(
        backgroundColor: AppColors.background,
        appBar: AppBar(
          title: Text(_esEdicion ? 'Editar cliente' : 'Registrar cliente'),
        ),
        body: SingleChildScrollView(
          padding: const EdgeInsets.all(AppSpacing.xl),
          child: Center(
            child: ConstrainedBox(
              constraints: const BoxConstraints(maxWidth: 560),
              child: Card(
                child: Padding(
                  padding: const EdgeInsets.all(AppSpacing.xl),
                  child: Form(
                    key: _formKey,
                    child: Column(
                      mainAxisSize: MainAxisSize.min,
                      crossAxisAlignment: CrossAxisAlignment.stretch,
                      children: [
                        TextFormField(
                          controller: _nombreCtrl,
                          decoration: const InputDecoration(
                            labelText: 'Nombre o razón social',
                          ),
                          validator: (valor) {
                            final texto = valor?.trim() ?? '';
                            if (texto.isEmpty) {
                              return 'El nombre es obligatorio.';
                            }
                            if (texto.length > 100) {
                              return 'El nombre no puede superar los 100 caracteres.';
                            }
                            return null;
                          },
                        ),
                        const SizedBox(height: AppSpacing.lg),
                        TextFormField(
                          controller: _telefonoCtrl,
                          keyboardType: TextInputType.phone,
                          decoration: const InputDecoration(
                            labelText: 'Teléfono',
                          ),
                          validator: (valor) {
                            final texto = valor?.trim() ?? '';
                            if (texto.isEmpty) {
                              return 'El teléfono es obligatorio.';
                            }
                            if (texto.length > 20) {
                              return 'El teléfono no puede superar los 20 caracteres.';
                            }
                            return null;
                          },
                        ),
                        const SizedBox(height: AppSpacing.lg),
                        TextFormField(
                          controller: _correoCtrl,
                          keyboardType: TextInputType.emailAddress,
                          decoration: const InputDecoration(
                            labelText: 'Correo electrónico',
                          ),
                          validator: (valor) {
                            final texto = valor?.trim() ?? '';
                            if (texto.isEmpty) {
                              return 'El correo es obligatorio.';
                            }
                            if (!_correoValido.hasMatch(texto)) {
                              return 'Escribe un correo válido.';
                            }
                            if (texto.length > 120) {
                              return 'El correo no puede superar los 120 caracteres.';
                            }
                            return null;
                          },
                        ),
                        const SizedBox(height: AppSpacing.xl),
                        ElevatedButton(
                          onPressed: _guardando ? null : () => _guardar(),
                          child: _guardando
                              ? const SizedBox(
                                  width: 18,
                                  height: 18,
                                  child: CircularProgressIndicator(
                                    strokeWidth: 2,
                                    color: Colors.white,
                                  ),
                                )
                              : Text(
                                  _esEdicion ? 'Guardar cambios' : 'Registrar',
                                ),
                        ),
                      ],
                    ),
                  ),
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }
}
