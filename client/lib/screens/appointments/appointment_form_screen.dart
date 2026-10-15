import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../models/appointment.dart';
import '../../models/client.dart';
import '../../models/vehicle.dart';
import '../../providers/appointments_provider.dart';
import '../../providers/vehicles_provider.dart';
import '../../services/api_client.dart';
import '../../utils/app_theme.dart';
import '../../widgets/confirm_dialog.dart';

/// Alta y edición de citas (T021). Si recibe [cita] existe, edita fecha,
/// hora, motivo y observaciones (el cliente y el vehículo no se cambian).
class AppointmentFormScreen extends StatefulWidget {
  const AppointmentFormScreen({super.key, this.cita});

  final Appointment? cita;

  @override
  State<AppointmentFormScreen> createState() => _AppointmentFormScreenState();
}

class _AppointmentFormScreenState extends State<AppointmentFormScreen> {
  final _formKey = GlobalKey<FormState>();
  late final TextEditingController _fechaCtrl;
  late final TextEditingController _horaCtrl;
  late final TextEditingController _motivoCtrl;
  late final TextEditingController _obsCtrl;
  Client? _cliente;
  Vehicle? _vehiculo;
  bool _guardando = false;

  bool get _esEdicion => widget.cita != null;

  /// Detecta cambios sin guardar respecto a los datos precargados.
  bool get _hayCambios {
    final cita = widget.cita;
    if (cita != null) {
      return _fechaCtrl.text != cita.date ||
          _horaCtrl.text != cita.time ||
          _motivoCtrl.text.trim() != cita.reason ||
          _obsCtrl.text.trim() != (cita.notes ?? '');
    }
    return _cliente != null ||
        _vehiculo != null ||
        _fechaCtrl.text.isNotEmpty ||
        _horaCtrl.text.isNotEmpty ||
        _motivoCtrl.text.trim().isNotEmpty ||
        _obsCtrl.text.trim().isNotEmpty;
  }

  @override
  void initState() {
    super.initState();
    final cita = widget.cita;
    _fechaCtrl = TextEditingController(text: cita?.date ?? '');
    _horaCtrl = TextEditingController(text: cita?.time ?? '');
    _motivoCtrl = TextEditingController(text: cita?.reason ?? '');
    _obsCtrl = TextEditingController(text: cita?.notes ?? '');

    if (!_esEdicion) {
      // Se carga tras el primer frame para no notificar durante la construcción.
      WidgetsBinding.instance.addPostFrameCallback((_) {
        if (mounted) context.read<VehiclesProvider>().cargarPropietarios();
      });
    }
  }

  @override
  void dispose() {
    _fechaCtrl.dispose();
    _horaCtrl.dispose();
    _motivoCtrl.dispose();
    _obsCtrl.dispose();
    super.dispose();
  }

  String _formatearFecha(DateTime dia) =>
      '${dia.year.toString().padLeft(4, '0')}-${dia.month.toString().padLeft(2, '0')}-${dia.day.toString().padLeft(2, '0')}';

  Future<void> _elegirFecha() async {
    var inicial = DateTime.now();
    if (_fechaCtrl.text.isNotEmpty) {
      try {
        inicial = DateTime.parse(_fechaCtrl.text);
      } catch (_) {
        inicial = DateTime.now();
      }
    }

    final dia = await showDatePicker(
      context: context,
      initialDate: inicial,
      firstDate: DateTime(2020),
      lastDate: DateTime(2100),
    );
    if (dia == null || !mounted) return;
    setState(() => _fechaCtrl.text = _formatearFecha(dia));
  }

  Future<void> _elegirHora() async {
    var inicial = const TimeOfDay(hour: 9, minute: 0);
    if (_horaCtrl.text.isNotEmpty) {
      final partes = _horaCtrl.text.split(':');
      if (partes.length >= 2) {
        final hora = int.tryParse(partes[0]);
        final minuto = int.tryParse(partes[1]);
        if (hora != null && minuto != null) {
          inicial = TimeOfDay(hour: hora, minute: minuto);
        }
      }
    }

    final hora = await showTimePicker(context: context, initialTime: inicial);
    if (hora == null || !mounted) return;
    setState(() {
      _horaCtrl.text =
          '${hora.hour.toString().padLeft(2, '0')}:${hora.minute.toString().padLeft(2, '0')}';
    });
  }

  Future<void> _guardar() async {
    final form = _formKey.currentState;
    if (form == null || !form.validate()) return;

    setState(() => _guardando = true);
    final proveedor = context.read<AppointmentsProvider>();

    final ApiError? error;
    if (_esEdicion) {
      error = await proveedor.editar(
        id: widget.cita!.id,
        date: _fechaCtrl.text,
        time: _horaCtrl.text,
        reason: _motivoCtrl.text.trim(),
        notes: _obsCtrl.text.trim(),
      );
    } else {
      error = await proveedor.registrar(
        clientId: _cliente!.id,
        vehicleId: _vehiculo!.id,
        date: _fechaCtrl.text,
        time: _horaCtrl.text,
        reason: _motivoCtrl.text.trim(),
        notes: _obsCtrl.text.trim(),
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
        content: Text(_esEdicion ? 'Cita actualizada' : 'Cita agendada'),
      ),
    );
    Navigator.of(context).pop(true);
  }

  @override
  Widget build(BuildContext context) {
    final vehiculos = context.watch<VehiclesProvider>();

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
          title: Text(_esEdicion ? 'Editar cita' : 'Agendar cita'),
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
                            widget.cita!.clientName,
                            Icons.person_outline,
                          ),
                          const SizedBox(height: AppSpacing.lg),
                          _datoSoloLectura(
                            'Vehículo',
                            widget.cita!.vehicleLabel,
                            Icons.directions_car_outlined,
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
                        TextFormField(
                          controller: _fechaCtrl,
                          readOnly: true,
                          onTap: _elegirFecha,
                          decoration: InputDecoration(
                            labelText: 'Fecha de la cita *',
                            prefixIcon: const Icon(Icons.calendar_today_outlined),
                            suffixIcon: IconButton(
                              tooltip: 'Elegir fecha',
                              icon: const Icon(Icons.calendar_month_outlined),
                              onPressed: _elegirFecha,
                            ),
                          ),
                          validator: (valor) {
                            final texto = valor?.trim() ?? '';
                            if (texto.isEmpty) {
                              return 'La fecha es obligatoria.';
                            }
                            if (!RegExp(r'^\d{4}-\d{2}-\d{2}$')
                                .hasMatch(texto)) {
                              return 'La fecha debe tener el formato YYYY-MM-DD.';
                            }
                            return null;
                          },
                        ),
                        const SizedBox(height: AppSpacing.lg),
                        TextFormField(
                          controller: _horaCtrl,
                          readOnly: true,
                          onTap: _elegirHora,
                          decoration: InputDecoration(
                            labelText: 'Hora de la cita *',
                            prefixIcon: const Icon(Icons.schedule),
                            suffixIcon: IconButton(
                              tooltip: 'Elegir hora',
                              icon: const Icon(Icons.access_time_outlined),
                              onPressed: _elegirHora,
                            ),
                          ),
                          validator: (valor) {
                            final texto = valor?.trim() ?? '';
                            if (texto.isEmpty) {
                              return 'La hora es obligatoria.';
                            }
                            if (!RegExp(r'^\d{2}:\d{2}$').hasMatch(texto)) {
                              return 'La hora debe tener el formato HH:MM.';
                            }
                            return null;
                          },
                        ),
                        const SizedBox(height: AppSpacing.lg),
                        TextFormField(
                          controller: _motivoCtrl,
                          decoration: const InputDecoration(
                            labelText: 'Motivo de la visita *',
                          ),
                          validator: (valor) {
                            final texto = valor?.trim() ?? '';
                            if (texto.isEmpty) {
                              return 'El motivo es obligatorio.';
                            }
                            if (texto.length > 150) {
                              return 'El motivo no puede superar los 150 caracteres.';
                            }
                            return null;
                          },
                        ),
                        const SizedBox(height: AppSpacing.lg),
                        TextFormField(
                          controller: _obsCtrl,
                          maxLines: 3,
                          decoration: const InputDecoration(
                            labelText: 'Observaciones',
                            alignLabelWithHint: true,
                          ),
                          validator: (valor) {
                            final texto = valor?.trim() ?? '';
                            if (texto.length > 500) {
                              return 'Las observaciones no pueden superar los 500 caracteres.';
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
                                  _esEdicion ? 'Guardar cambios' : 'Agendar',
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

  /// Dato de solo lectura: el cliente y el vehículo no se cambian al editar.
  Widget _datoSoloLectura(String etiqueta, String valor, IconData icono) {
    return TextFormField(
      initialValue: valor,
      readOnly: true,
      decoration: InputDecoration(
        labelText: etiqueta,
        prefixIcon: Icon(icono),
        helperText: 'El cliente y el vehículo no se cambian al editar.',
      ),
    );
  }
}
