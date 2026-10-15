import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../models/user.dart';
import '../../providers/users_provider.dart';
import '../../services/api_client.dart';
import '../../utils/app_theme.dart';
import '../../widgets/confirm_dialog.dart';

/// Alta y edición de usuarios con rol y estado (T064).
class UserFormScreen extends StatefulWidget {
  const UserFormScreen({super.key, this.usuario});

  final User? usuario;

  @override
  State<UserFormScreen> createState() => _UserFormScreenState();
}

class _UserFormScreenState extends State<UserFormScreen> {
  final _formKey = GlobalKey<FormState>();
  late final TextEditingController _usuarioCtrl;
  late final TextEditingController _nombreCtrl;
  late final TextEditingController _correoCtrl;
  late final TextEditingController _passwordCtrl;
  String? _rol;
  bool _activo = true;
  bool _guardando = false;

  bool get _esEdicion => widget.usuario != null;

  // Política de contraseñas del backend (FR-013): 8+, mayúscula, minúscula, número.
  static final RegExp _passwordValida = RegExp(
    r'^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,72}$',
  );

  @override
  void initState() {
    super.initState();
    final usuario = widget.usuario;
    _usuarioCtrl = TextEditingController(text: usuario?.username ?? '');
    _nombreCtrl = TextEditingController(text: usuario?.name ?? '');
    _correoCtrl = TextEditingController(text: usuario?.email ?? '');
    _passwordCtrl = TextEditingController();
    _rol = usuario?.role;
    _activo = usuario?.active ?? true;
  }

  @override
  void dispose() {
    _usuarioCtrl.dispose();
    _nombreCtrl.dispose();
    _correoCtrl.dispose();
    _passwordCtrl.dispose();
    super.dispose();
  }

  String? _validarPassword(String? valor, {required bool obligatoria}) {
    final texto = valor?.trim() ?? '';
    if (texto.isEmpty) {
      return obligatoria ? 'La contraseña es obligatoria.' : null;
    }
    if (!_passwordValida.hasMatch(texto)) {
      return 'Debe tener 8 caracteres, una mayúscula, una minúscula y un número.';
    }
    return null;
  }

  /// Detecta cambios sin guardar respecto a los datos precargados (8.5).
  bool get _hayCambios {
    final usuario = widget.usuario;
    if (usuario == null) {
      // Alta: cualquier dato escrito cuenta.
      return _usuarioCtrl.text.trim().isNotEmpty ||
          _nombreCtrl.text.trim().isNotEmpty ||
          _correoCtrl.text.trim().isNotEmpty ||
          _passwordCtrl.text.trim().isNotEmpty ||
          _rol != null;
    }
    // Edición: el usuario (username) no se modifica en este sprint.
    return _nombreCtrl.text.trim() != usuario.name ||
        _correoCtrl.text.trim() != usuario.email ||
        _passwordCtrl.text.trim().isNotEmpty ||
        _rol != usuario.role ||
        _activo != usuario.active;
  }

  Future<void> _guardar() async {
    final form = _formKey.currentState;
    if (form == null || !form.validate()) return;

    final rol = _rol;
    if (rol == null) {
      ScaffoldMessenger.of(context)
          .showSnackBar(const SnackBar(content: Text('Selecciona un rol.')));
      return;
    }

    setState(() => _guardando = true);
    final proveedor = context.read<UsersProvider>();

    final ApiError? error;
    if (_esEdicion) {
      error = await proveedor.editar(
        id: widget.usuario!.id,
        name: _nombreCtrl.text.trim(),
        email: _correoCtrl.text.trim(),
        role: rol,
        active: _activo,
        password: _passwordCtrl.text.trim(),
      );
    } else {
      error = await proveedor.registrar(
        username: _usuarioCtrl.text.trim(),
        name: _nombreCtrl.text.trim(),
        email: _correoCtrl.text.trim(),
        password: _passwordCtrl.text.trim(),
        role: rol,
      );
    }

    if (!mounted) return;

    if (error != null) {
      setState(() => _guardando = false);
      ScaffoldMessenger.of(context)
          .showSnackBar(SnackBar(content: Text(error.message)));
      return;
    }

    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(_esEdicion ? 'Usuario actualizado' : 'Usuario creado'),
      ),
    );
    Navigator.of(context).pop(true);
  }

  @override
  Widget build(BuildContext context) {
    // canPop siempre falso: la salida se decide aquí, con confirmación si
    // hay cambios sin guardar (8.5); el guardado sale por código y no
    // pasa por aquí.
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
      child: _formulario(),
    );
  }

  Widget _formulario() {
    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: AppBar(
        title: Text(_esEdicion ? 'Editar usuario' : 'Registrar usuario'),
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
                      if (!_esEdicion) ...[
                        TextFormField(
                          controller: _usuarioCtrl,
                          decoration: const InputDecoration(
                            labelText: 'Usuario',
                            prefixIcon: Icon(Icons.alternate_email),
                          ),
                          validator: (valor) {
                            final texto = valor?.trim() ?? '';
                            if (texto.isEmpty) {
                              return 'El usuario es obligatorio.';
                            }
                            if (texto.length > 50) {
                              return 'El usuario no puede superar los 50 caracteres.';
                            }
                            return null;
                          },
                        ),
                        const SizedBox(height: AppSpacing.lg),
                      ],
                      TextFormField(
                        controller: _nombreCtrl,
                        decoration: const InputDecoration(
                          labelText: 'Nombre completo',
                          prefixIcon: Icon(Icons.person_outline),
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
                        controller: _correoCtrl,
                        keyboardType: TextInputType.emailAddress,
                        decoration: const InputDecoration(
                          labelText: 'Correo electrónico',
                          prefixIcon: Icon(Icons.mail_outline),
                        ),
                        validator: (valor) {
                          final texto = valor?.trim() ?? '';
                          if (texto.isEmpty) {
                            return 'El correo es obligatorio.';
                          }
                          if (!RegExp(r'^[^@\s]+@[^@\s]+\.[^@\s]+$')
                              .hasMatch(texto)) {
                            return 'Escribe un correo válido.';
                          }
                          if (texto.length > 120) {
                            return 'El correo no puede superar los 120 caracteres.';
                          }
                          return null;
                        },
                      ),
                      const SizedBox(height: AppSpacing.lg),
                      TextFormField(
                        controller: _passwordCtrl,
                        obscureText: true,
                        decoration: InputDecoration(
                          labelText: _esEdicion
                              ? 'Nueva contraseña (opcional)'
                              : 'Contraseña',
                          prefixIcon: const Icon(Icons.lock_outline),
                          helperText: _esEdicion
                              ? 'Déjala vacía para no cambiarla.'
                              : 'Mínimo 8, una mayúscula, una minúscula y un número.',
                        ),
                        validator: (valor) =>
                            _validarPassword(valor, obligatoria: !_esEdicion),
                      ),
                      const SizedBox(height: AppSpacing.lg),
                      DropdownButtonFormField<String>(
                        initialValue: _rol,
                        decoration: const InputDecoration(
                          labelText: 'Rol',
                          prefixIcon: Icon(Icons.badge_outlined),
                        ),
                        items: const [
                          DropdownMenuItem<String>(
                            value: 'ADMIN',
                            child: Text('Administrador'),
                          ),
                          DropdownMenuItem<String>(
                            value: 'RECEPTIONIST',
                            child: Text('Recepción'),
                          ),
                          DropdownMenuItem<String>(
                            value: 'MECHANIC',
                            child: Text('Mecánico'),
                          ),
                        ],
                        onChanged: (valor) => setState(() => _rol = valor),
                        validator: (valor) =>
                            valor == null ? 'Selecciona un rol.' : null,
                      ),
                      if (_esEdicion) ...[
                        const SizedBox(height: AppSpacing.sm),
                        SwitchListTile(
                          contentPadding: EdgeInsets.zero,
                          title: const Text('Cuenta activa'),
                          subtitle: Text(
                            _activo
                                ? 'Puede iniciar sesión.'
                                : 'No puede iniciar sesión.',
                          ),
                          value: _activo,
                          onChanged: (valor) => setState(() => _activo = valor),
                        ),
                      ],
                      const SizedBox(height: AppSpacing.xl),
                      ElevatedButton(
                        onPressed: _guardando ? null : _guardar,
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
    );
  }
}
