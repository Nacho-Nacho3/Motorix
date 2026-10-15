import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:provider/provider.dart';

import '../../models/client.dart';
import '../../models/service_order.dart';
import '../../models/vehicle.dart';
import '../../providers/service_orders_provider.dart';
import '../../providers/vehicles_provider.dart';
import '../../services/api_client.dart';
import '../../utils/app_theme.dart';
import '../../widgets/confirm_dialog.dart';

/// Alta y edición de órdenes de servicio (T037).
/// Si recibe [orden] existe: se edita el problema reportado o se reasigna el
/// mecánico (Q2); cliente, vehículo y kilometraje no cambian.
class OrderFormScreen extends StatefulWidget {
  const OrderFormScreen({super.key, this.orden});

  final ServiceOrder? orden;

  @override
  State<OrderFormScreen> createState() => _OrderFormScreenState();
}

class _OrderFormScreenState extends State<OrderFormScreen> {
  final _formKey = GlobalKey<FormState>();
  late final TextEditingController _kilometrajeCtrl;
  late final TextEditingController _problemaCtrl;
  Client? _cliente;
  Vehicle? _vehiculo;
  Mechanic? _mecanico;
  bool _guardando = false;

  bool get _esEdicion => widget.orden != null;

  /// Detecta cambios sin guardar respecto a los datos precargados.
  bool get _hayCambios {
    final orden = widget.orden;
    if (orden != null) {
      return _problemaCtrl.text.trim() != orden.reportedProblem ||
          _mecanico?.id != orden.mechanicId;
    }
    return _cliente != null ||
        _vehiculo != null ||
        _mecanico != null ||
        _kilometrajeCtrl.text.trim().isNotEmpty ||
        _problemaCtrl.text.trim().isNotEmpty;
  }

  @override
  void initState() {
    super.initState();
    final orden = widget.orden;
    _kilometrajeCtrl = TextEditingController(
      text: orden != null ? '${orden.entryMileage}' : '',
    );
    _problemaCtrl = TextEditingController(text: orden?.reportedProblem ?? '');

    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!mounted) return;
      final ordenes = context.read<ServiceOrdersProvider>();
      final vehiculos = context.read<VehiclesProvider>();
      if (!_esEdicion) vehiculos.cargarPropietarios();
      if (ordenes.mecanicos.isEmpty) ordenes.cargarMecanicos();
      // El mecánico actual se precarga para la reasignación.
      if (orden != null) {
        for (final mec in ordenes.mecanicos) {
          if (mec.id == orden.mechanicId) {
            _mecanico = mec;
            break;
          }
        }
      }
    });
  }

  @override
  void dispose() {
    _kilometrajeCtrl.dispose();
    _problemaCtrl.dispose();
    super.dispose();
  }

  Future<void> _guardar() async {
    final form = _formKey.currentState;
    if (form == null || !form.validate()) return;

    setState(() => _guardando = true);
    final proveedor = context.read<ServiceOrdersProvider>();

    final ApiError? error;
    if (_esEdicion) {
      error = await proveedor.editar(
        id: widget.orden!.id,
        reportedProblem: _problemaCtrl.text.trim(),
        mechanicId: _mecanico?.id,
      );
    } else {
      error = await proveedor.registrar(
        clientId: _cliente!.id,
        vehicleId: _vehiculo!.id,
        mechanicId: _mecanico!.id,
        entryMileage: int.parse(_kilometrajeCtrl.text.trim()),
        reportedProblem: _problemaCtrl.text.trim(),
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
        content: Text(_esEdicion ? 'Orden actualizada' : 'Orden creada'),
      ),
    );
    Navigator.of(context).pop(true);
  }

  @override
  Widget build(BuildContext context) {
    final vehiculos = context.watch<VehiclesProvider>();
    final ordenes = context.watch<ServiceOrdersProvider>();

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
          title: Text(_esEdicion ? 'Editar orden' : 'Nueva orden'),
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
                        if (_esEdicion) ...[
                          _datoSoloLectura(
                            'Cliente',
                            widget.orden!.clientName,
                            Icons.person_outline,
                          ),
                          const SizedBox(height: AppSpacing.lg),
                          _datoSoloLectura(
                            'Vehículo',
                            widget.orden!.vehicleLabel,
                            Icons.directions_car_outlined,
                          ),
                          const SizedBox(height: AppSpacing.lg),
                          _datoSoloLectura(
                            'Kilometraje de entrada',
                            '${widget.orden!.entryMileage} km',
                            Icons.speed_outlined,
                          ),
                          const SizedBox(height: AppSpacing.lg),
                        ] else ...[
                          DropdownButtonFormField<Client>(
                            initialValue: _cliente,
                            decoration: const InputDecoration(
                              labelText: 'Cliente *',
                              prefixIcon: Icon(Icons.person_outline),
                            ),
                            items: [
                              for (final cliente in vehiculos.propietarios)
                                DropdownMenuItem<Client>(
                                  value: cliente,
                                  child: Text(
                                    cliente.name,
                                    overflow: TextOverflow.ellipsis,
                                  ),
                                ),
                            ],
                            onChanged: (cliente) {
                              setState(() {
                                _cliente = cliente;
                                _vehiculo = null;
                              });
                              if (cliente != null) {
                                context
                                    .read<VehiclesProvider>()
                                    .filtrarPorCliente(cliente.id);
                              }
                            },
                            validator: (cliente) => cliente == null
                                ? 'Selecciona un cliente.'
                                : null,
                          ),
                          const SizedBox(height: AppSpacing.lg),
                          DropdownButtonFormField<Vehicle>(
                            initialValue: _vehiculo,
                            decoration: const InputDecoration(
                              labelText: 'Vehículo *',
                              prefixIcon: Icon(Icons.directions_car_outlined),
                            ),
                            items: [
                              if (_cliente != null)
                                for (final vehiculo in vehiculos.vehiculos)
                                  DropdownMenuItem<Vehicle>(
                                    value: vehiculo,
                                    child: Text(
                                      '${vehiculo.brand} ${vehiculo.model} ${vehiculo.licensePlate}',
                                      overflow: TextOverflow.ellipsis,
                                    ),
                                  ),
                            ],
                            onChanged: (vehiculo) =>
                                setState(() => _vehiculo = vehiculo),
                            validator: (vehiculo) => vehiculo == null
                                ? 'Selecciona un vehículo.'
                                : null,
                          ),
                          const SizedBox(height: AppSpacing.lg),
                        ],
                        DropdownButtonFormField<Mechanic>(
                          initialValue: _mecanico,
                          decoration: const InputDecoration(
                            labelText: 'Mecánico asignado *',
                            prefixIcon: Icon(Icons.handyman_outlined),
                          ),
                          items: [
                            for (final mec in ordenes.mecanicos)
                              DropdownMenuItem<Mechanic>(
                                value: mec,
                                child: Text(
                                  mec.name,
                                  overflow: TextOverflow.ellipsis,
                                ),
                              ),
                          ],
                          onChanged: (mecanico) =>
                              setState(() => _mecanico = mecanico),
                          validator: (mecanico) => mecanico == null
                              ? 'Selecciona un mecánico.'
                              : null,
                        ),
                        const SizedBox(height: AppSpacing.lg),
                        if (!_esEdicion) ...[
                          TextFormField(
                            controller: _kilometrajeCtrl,
                            keyboardType: TextInputType.number,
                            inputFormatters: [
                              FilteringTextInputFormatter.digitsOnly,
                            ],
                            decoration: const InputDecoration(
                              labelText: 'Kilometraje de entrada *',
                              prefixIcon: Icon(Icons.speed_outlined),
                            ),
                            validator: (valor) {
                              final texto = valor?.trim() ?? '';
                              if (texto.isEmpty) {
                                return 'El kilometraje de entrada es obligatorio.';
                              }
                              final numero = int.tryParse(texto);
                              if (numero == null || numero < 0) {
                                return 'El kilometraje de entrada debe ser un entero mayor o igual a 0.';
                              }
                              return null;
                            },
                          ),
                          const SizedBox(height: AppSpacing.lg),
                        ],
                        TextFormField(
                          controller: _problemaCtrl,
                          maxLines: 3,
                          decoration: const InputDecoration(
                            labelText: 'Problema reportado *',
                            alignLabelWithHint: true,
                          ),
                          validator: (valor) {
                            final texto = valor?.trim() ?? '';
                            if (texto.isEmpty) {
                              return 'El problema reportado es obligatorio.';
                            }
                            if (texto.length > 500) {
                              return 'El problema reportado no puede superar los 500 caracteres.';
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
                                  _esEdicion ? 'Guardar cambios' : 'Registrar orden',
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

  /// Dato de solo lectura: en la edición no se cambian cliente, vehículo ni
  /// kilometraje (el contrato solo permite problema reportado y mecánico).
  Widget _datoSoloLectura(String etiqueta, String valor, IconData icono) {
    return TextFormField(
      initialValue: valor,
      readOnly: true,
      decoration: InputDecoration(
        labelText: etiqueta,
        prefixIcon: Icon(icono),
        helperText: 'Este dato no se cambia al editar la orden.',
      ),
    );
  }
}
