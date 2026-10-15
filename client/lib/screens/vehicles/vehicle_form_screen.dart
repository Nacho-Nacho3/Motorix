import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../models/client.dart';
import '../../models/vehicle.dart';
import '../../providers/vehicles_provider.dart';
import '../../services/api_client.dart';
import '../../utils/app_theme.dart';
import '../../widgets/confirm_dialog.dart';

/// Alta y edición de vehículos (T049).
/// El selector de propietario es obligatorio: sin él no se guarda (RN-1).
class VehicleFormScreen extends StatefulWidget {
  const VehicleFormScreen({super.key, this.vehiculo});

  final Vehicle? vehiculo;

  @override
  State<VehicleFormScreen> createState() => _VehicleFormScreenState();
}

class _VehicleFormScreenState extends State<VehicleFormScreen> {
  final _formKey = GlobalKey<FormState>();
  late final TextEditingController _marcaCtrl;
  late final TextEditingController _modeloCtrl;
  late final TextEditingController _anioCtrl;
  late final TextEditingController _placasCtrl;
  late final TextEditingController _vinCtrl;
  late final TextEditingController _kilometrajeCtrl;
  Client? _propietario;
  bool _guardando = false;

  bool get _esEdicion => widget.vehiculo != null;

  int get _anioMaximo => DateTime.now().year + 1;

  /// Detecta cambios sin guardar respecto a los datos precargados (8.5).
  bool get _hayCambios {
    final vehiculo = widget.vehiculo;
    if (vehiculo == null) {
      // Alta: cualquier dato escrito o un propietario elegido cuenta.
      return _marcaCtrl.text.isNotEmpty ||
          _modeloCtrl.text.isNotEmpty ||
          _anioCtrl.text.isNotEmpty ||
          _placasCtrl.text.isNotEmpty ||
          _vinCtrl.text.isNotEmpty ||
          _kilometrajeCtrl.text.isNotEmpty ||
          _propietario != null;
    }
    // Edición: el propietario no se modifica en este sprint (contrato).
    return _marcaCtrl.text.trim() != vehiculo.brand ||
        _modeloCtrl.text.trim() != vehiculo.model ||
        _anioCtrl.text.trim() != '${vehiculo.year}' ||
        _placasCtrl.text.trim() != vehiculo.licensePlate ||
        _vinCtrl.text.trim() != (vehiculo.vin ?? '') ||
        _kilometrajeCtrl.text.trim() != '${vehiculo.currentMileage}';
  }

  @override
  void initState() {
    super.initState();
    final vehiculo = widget.vehiculo;
    _marcaCtrl = TextEditingController(text: vehiculo?.brand ?? '');
    _modeloCtrl = TextEditingController(text: vehiculo?.model ?? '');
    _anioCtrl = TextEditingController(
      text: vehiculo != null ? '${vehiculo.year}' : '',
    );
    _placasCtrl = TextEditingController(text: vehiculo?.licensePlate ?? '');
    _vinCtrl = TextEditingController(text: vehiculo?.vin ?? '');
    _kilometrajeCtrl = TextEditingController(
      text: vehiculo != null ? '${vehiculo.currentMileage}' : '',
    );

    // Se carga tras el primer frame para no notificar durante la construcción.
    WidgetsBinding.instance.addPostFrameCallback((_) async {
      if (!mounted) return;
      final proveedor = context.read<VehiclesProvider>();
      await proveedor.cargarPropietarios();
      final vehiculo = widget.vehiculo;
      if (!mounted || vehiculo == null || vehiculo.clientId == null) return;
      // En edición se precarga el propietario actual (selector de solo lectura).
      final indice = proveedor.propietarios
          .indexWhere((cliente) => cliente.id == vehiculo.clientId);
      if (indice < 0) return;
      setState(() => _propietario = proveedor.propietarios[indice]);
    });
  }

  @override
  void dispose() {
    _marcaCtrl.dispose();
    _modeloCtrl.dispose();
    _anioCtrl.dispose();
    _placasCtrl.dispose();
    _vinCtrl.dispose();
    _kilometrajeCtrl.dispose();
    super.dispose();
  }

  int? _entero(TextEditingController controlador) =>
      int.tryParse(controlador.text.trim());

  Future<void> _guardar() async {
    final form = _formKey.currentState;
    if (form == null || !form.validate()) return;

    setState(() => _guardando = true);
    final proveedor = context.read<VehiclesProvider>();

    final ApiError? error;
    if (_esEdicion) {
      // El propietario no viaja en el PATCH: clientId no se modifica
      // en este sprint (contrato vehicles.md).
      error = await proveedor.editar(
        id: widget.vehiculo!.id,
        brand: _marcaCtrl.text.trim(),
        model: _modeloCtrl.text.trim(),
        year: _entero(_anioCtrl)!,
        licensePlate: _placasCtrl.text.trim(),
        vin: _vinCtrl.text.trim(),
        currentMileage: _entero(_kilometrajeCtrl) ?? 0,
      );
    } else {
      final propietario = _propietario;
      if (propietario == null) {
        // Guardia extra: el alta se rechaza sin propietario (RN-1).
        setState(() => _guardando = false);
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Selecciona un propietario.')),
        );
        return;
      }
      error = await proveedor.registrar(
        clientId: propietario.id,
        brand: _marcaCtrl.text.trim(),
        model: _modeloCtrl.text.trim(),
        year: _entero(_anioCtrl)!,
        licensePlate: _placasCtrl.text.trim(),
        vin: _vinCtrl.text.trim(),
        currentMileage: _entero(_kilometrajeCtrl) ?? 0,
      );
    }

    if (!mounted) return;

    if (error != null) {
      setState(() => _guardando = false);
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(error.message)),
      );
      return;
    }

    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(_esEdicion ? 'Vehículo actualizado' : 'Vehículo registrado'),
      ),
    );
    Navigator.of(context).pop(true);
  }

  @override
  Widget build(BuildContext context) {
    final proveedor = context.watch<VehiclesProvider>();

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
      child: _formulario(proveedor),
    );
  }

  Widget _formulario(VehiclesProvider proveedor) {
    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: AppBar(
        title: Text(_esEdicion ? 'Editar vehículo' : 'Registrar vehículo'),
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
                      DropdownButtonFormField<Client>(
                        initialValue: _propietario,
                        decoration: InputDecoration(
                          labelText: 'Propietario *',
                          prefixIcon: const Icon(Icons.person_outline),
                          // El propietario no cambia en edición: clientId no
                          // se modifica en este sprint (contrato vehicles.md).
                          helperText: _esEdicion
                              ? 'El propietario no se puede cambiar en esta versión.'
                              : null,
                        ),
                        items: [
                          for (final cliente in proveedor.propietarios)
                            DropdownMenuItem<Client>(
                              value: cliente,
                              child: Text(cliente.name),
                            ),
                        ],
                        onChanged: _esEdicion
                            ? null
                            : (cliente) =>
                                setState(() => _propietario = cliente),
                        validator: (cliente) {
                          if (_esEdicion) return null;
                          return cliente == null
                              ? 'Selecciona un propietario.'
                              : null;
                        },
                      ),
                      const SizedBox(height: AppSpacing.lg),
                      TextFormField(
                        controller: _marcaCtrl,
                        decoration: const InputDecoration(labelText: 'Marca'),
                        validator: (valor) {
                          final texto = valor?.trim() ?? '';
                          if (texto.isEmpty) return 'La marca es obligatoria.';
                          if (texto.length > 50) {
                            return 'La marca no puede superar los 50 caracteres.';
                          }
                          return null;
                        },
                      ),
                      const SizedBox(height: AppSpacing.lg),
                      TextFormField(
                        controller: _modeloCtrl,
                        decoration: const InputDecoration(labelText: 'Modelo'),
                        validator: (valor) {
                          final texto = valor?.trim() ?? '';
                          if (texto.isEmpty) return 'El modelo es obligatorio.';
                          if (texto.length > 50) {
                            return 'El modelo no puede superar los 50 caracteres.';
                          }
                          return null;
                        },
                      ),
                      const SizedBox(height: AppSpacing.lg),
                      Row(
                        children: [
                          Expanded(
                            child: TextFormField(
                              controller: _anioCtrl,
                              keyboardType: TextInputType.number,
                              decoration:
                                  const InputDecoration(labelText: 'Año'),
                              validator: (valor) {
                                final texto = valor?.trim() ?? '';
                                final anio = int.tryParse(texto);
                                if (anio == null) {
                                  return 'El año debe ser un número.';
                                }
                                if (anio < 1900 || anio > _anioMaximo) {
                                  return 'El año debe estar entre 1900 y $_anioMaximo.';
                                }
                                return null;
                              },
                            ),
                          ),
                          const SizedBox(width: AppSpacing.lg),
                          Expanded(
                            child: TextFormField(
                              controller: _kilometrajeCtrl,
                              keyboardType: TextInputType.number,
                              decoration: const InputDecoration(
                                labelText: 'Kilometraje',
                              ),
                              validator: (valor) {
                                final texto = valor?.trim() ?? '';
                                if (texto.isEmpty) return null;
                                final km = int.tryParse(texto);
                                if (km == null) {
                                  return 'El kilometraje debe ser un número.';
                                }
                                if (km < 0) {
                                  return 'El kilometraje no puede ser negativo.';
                                }
                                return null;
                              },
                            ),
                          ),
                        ],
                      ),
                      const SizedBox(height: AppSpacing.lg),
                      TextFormField(
                        controller: _placasCtrl,
                        textCapitalization: TextCapitalization.characters,
                        decoration:
                            const InputDecoration(labelText: 'Placas'),
                        validator: (valor) {
                          final texto = valor?.trim() ?? '';
                          if (texto.isEmpty) return 'Las placas son obligatorias.';
                          if (texto.length > 20) {
                            return 'Las placas no pueden superar los 20 caracteres.';
                          }
                          return null;
                        },
                      ),
                      const SizedBox(height: AppSpacing.lg),
                      TextFormField(
                        controller: _vinCtrl,
                        textCapitalization: TextCapitalization.characters,
                        decoration: const InputDecoration(
                          labelText: 'VIN (opcional)',
                        ),
                        validator: (valor) {
                          final texto = valor?.trim() ?? '';
                          if (texto.length > 20) {
                            return 'El VIN no puede superar los 20 caracteres.';
                          }
                          return null;
                        },
                      ),
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
