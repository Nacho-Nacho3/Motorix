import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../models/service_type.dart';
import '../../providers/service_types_provider.dart';
import '../../utils/app_theme.dart';
import '../../widgets/confirm_dialog.dart';

/// Alta y edición de un tipo de servicio (Sprint 7, US3, FR-005, FR-017).
/// Pide confirmación «Cambios sin guardar» al salir con cambios pendientes.
class ServiceTypeFormScreen extends StatefulWidget {
  const ServiceTypeFormScreen({super.key, this.tipo});

  final ServiceType? tipo;

  @override
  State<ServiceTypeFormScreen> createState() => _ServiceTypeFormScreenState();
}

class _ServiceTypeFormScreenState extends State<ServiceTypeFormScreen> {
  final _formKey = GlobalKey<FormState>();
  late final TextEditingController _nombre;
  late final TextEditingController _dias;
  late final TextEditingController _km;
  bool _guardando = false;
  String? _error;

  bool get _esEdicion => widget.tipo != null;

  @override
  void initState() {
    super.initState();
    final tipo = widget.tipo;
    _nombre = TextEditingController(text: tipo?.name ?? '');
    _dias = TextEditingController(text: tipo?.intervalDays?.toString() ?? '');
    _km = TextEditingController(text: tipo?.intervalKm?.toString() ?? '');
  }

  @override
  void dispose() {
    _nombre.dispose();
    _dias.dispose();
    _km.dispose();
    super.dispose();
  }

  bool get _hayCambios {
    final tipo = widget.tipo;
    return _nombre.text.trim() != (tipo?.name ?? '') ||
        _dias.text.trim() != (tipo?.intervalDays?.toString() ?? '') ||
        _km.text.trim() != (tipo?.intervalKm?.toString() ?? '');
  }

  String? _validarIntervalo(String? valor, String rotulo, int maximo) {
    final texto = (valor ?? '').trim();
    if (texto.isEmpty) return null;
    final numero = int.tryParse(texto);
    if (numero == null) return '$rotulo debe ser un número entero.';
    if (numero < 1) return '$rotulo debe ser mayor que cero.';
    if (numero > maximo) return '$rotulo no puede ser mayor que $maximo.';
    return null;
  }

  Future<void> _guardar() async {
    if (!_formKey.currentState!.validate()) return;
    final dias = int.tryParse(_dias.text.trim());
    final km = int.tryParse(_km.text.trim());
    if (dias == null && km == null) {
      setState(() => _error = 'Indica al menos un intervalo, en días o en kilómetros.');
      return;
    }
    setState(() {
      _guardando = true;
      _error = null;
    });
    final proveedor = context.read<ServiceTypesProvider>();
    final error = _esEdicion
        ? await proveedor.actualizar(
            widget.tipo!.id,
            nombre: _nombre.text.trim(),
            dias: dias,
            kilometros: km,
          )
        : await proveedor.crear(
            nombre: _nombre.text.trim(),
            dias: dias,
            kilometros: km,
          );
    if (!mounted) return;
    if (error != null) {
      setState(() {
        _guardando = false;
        _error = error.message;
      });
      return;
    }
    Navigator.of(context).pop(true);
  }

  @override
  Widget build(BuildContext context) {
    return PopScope(
      canPop: false,
      onPopInvokedWithResult: (didPop, _) async {
        if (didPop || !mounted) return;
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
        if (salir && context.mounted) Navigator.of(context).pop();
      },
      child: Scaffold(
        backgroundColor: AppColors.background,
        appBar: AppBar(
          title: Text(_esEdicion ? 'Editar tipo de servicio' : 'Nuevo tipo de servicio'),
        ),
        body: SingleChildScrollView(
          padding: const EdgeInsets.all(AppSpacing.xl),
          child: Center(
            child: ConstrainedBox(
              constraints: const BoxConstraints(maxWidth: 560),
              child: Form(
                key: _formKey,
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    TextFormField(
                      key: const Key('campo-nombre-tipo'),
                      controller: _nombre,
                      maxLength: 100,
                      decoration: const InputDecoration(labelText: 'Nombre *'),
                      validator: (valor) {
                        final texto = (valor ?? '').trim();
                        if (texto.isEmpty) return 'El nombre del tipo de servicio es obligatorio.';
                        if (texto.length > 100) {
                          return 'El nombre no puede superar los 100 caracteres.';
                        }
                        return null;
                      },
                    ),
                    const SizedBox(height: AppSpacing.md),
                    Row(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Expanded(
                          child: TextFormField(
                            key: const Key('campo-intervalo-dias'),
                            controller: _dias,
                            keyboardType: TextInputType.number,
                            decoration: const InputDecoration(
                              labelText: 'Intervalo en días',
                              helperText: 'Hasta 3,650',
                            ),
                            validator: (v) => _validarIntervalo(v, 'El intervalo en días', 3650),
                          ),
                        ),
                        const SizedBox(width: AppSpacing.lg),
                        Expanded(
                          child: TextFormField(
                            key: const Key('campo-intervalo-km'),
                            controller: _km,
                            keyboardType: TextInputType.number,
                            decoration: const InputDecoration(
                              labelText: 'Intervalo en kilómetros',
                              helperText: 'Hasta 1,000,000',
                            ),
                            validator: (v) =>
                                _validarIntervalo(v, 'El intervalo en kilómetros', 1000000),
                          ),
                        ),
                      ],
                    ),
                    const Text(
                      'Indica al menos un intervalo.',
                      style: TextStyle(color: AppColors.textSecondary),
                    ),
                    if (_error != null) ...[
                      const SizedBox(height: AppSpacing.sm),
                      Text(
                        _error!,
                        key: const Key('error-tipo-servicio'),
                        style: const TextStyle(color: AppColors.danger),
                      ),
                    ],
                    const SizedBox(height: AppSpacing.lg),
                    Row(
                      mainAxisAlignment: MainAxisAlignment.end,
                      children: [
                        TextButton(
                          onPressed: _guardando
                              ? null
                              : () => Navigator.of(context).maybePop(),
                          child: const Text('Cancelar'),
                        ),
                        const SizedBox(width: AppSpacing.sm),
                        FilledButton(
                          key: const Key('boton-guardar-tipo'),
                          onPressed: _guardando ? null : _guardar,
                          child: Text(_guardando ? 'Guardando…' : 'Guardar'),
                        ),
                      ],
                    ),
                  ],
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }
}
