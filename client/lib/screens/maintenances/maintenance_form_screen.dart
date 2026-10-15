import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../models/vehicle.dart';
import '../../providers/maintenances_provider.dart';
import '../../providers/vehicles_provider.dart';
import '../../services/api_client.dart';
import '../../utils/app_theme.dart';
import '../../widgets/confirm_dialog.dart';

/// Alta del próximo mantenimiento por vehículo (T033, US3, RN-11).
/// Fecha y kilometraje objetivo (cualquiera de los dos o ambos) con la
/// antelación propia del registro y recomendaciones.
class MaintenanceFormScreen extends StatefulWidget {
  const MaintenanceFormScreen({super.key});

  @override
  State<MaintenanceFormScreen> createState() => _MaintenanceFormScreenState();
}

class _MaintenanceFormScreenState extends State<MaintenanceFormScreen> {
  final _formKey = GlobalKey<FormState>();
  late final TextEditingController _fechaCtrl;
  late final TextEditingController _kmCtrl;
  late final TextEditingController _warnDiasCtrl;
  late final TextEditingController _warnKmCtrl;
  late final TextEditingController _recomCtrl;
  Vehicle? _vehiculo;
  bool _guardando = false;
  String? _errorObjetivo;

  /// Detecta cambios sin guardar respecto al formulario vacío.
  bool get _hayCambios {
    return _vehiculo != null ||
        _fechaCtrl.text.trim().isNotEmpty ||
        _kmCtrl.text.trim().isNotEmpty ||
        _warnDiasCtrl.text.trim().isNotEmpty ||
        _warnKmCtrl.text.trim().isNotEmpty ||
        _recomCtrl.text.trim().isNotEmpty;
  }

  @override
  void initState() {
    super.initState();
    _fechaCtrl = TextEditingController();
    _kmCtrl = TextEditingController();
    _warnDiasCtrl = TextEditingController();
    _warnKmCtrl = TextEditingController();
    _recomCtrl = TextEditingController();

    // Se carga tras el primer frame para no notificar durante la construcción.
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (mounted) context.read<VehiclesProvider>().cargar();
    });
  }

  @override
  void dispose() {
    _fechaCtrl.dispose();
    _kmCtrl.dispose();
    _warnDiasCtrl.dispose();
    _warnKmCtrl.dispose();
    _recomCtrl.dispose();
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

  Future<void> _guardar() async {
    final form = _formKey.currentState;

    // RN-11: al menos un objetivo; se muestra en el formulario (CA-2).
    final sinObjetivo =
        _fechaCtrl.text.trim().isEmpty && _kmCtrl.text.trim().isEmpty;
    setState(() {
      _errorObjetivo = sinObjetivo
          ? 'Debes indicar la fecha o el kilometraje del próximo mantenimiento.'
          : null;
    });

    final valido = form?.validate() ?? false;
    if (!valido || sinObjetivo) return;

    setState(() => _guardando = true);
    final proveedor = context.read<MaintenancesProvider>();

    final ApiError? error = await proveedor.crear(
      vehicleId: _vehiculo!.id,
      nextDueDate:
          _fechaCtrl.text.trim().isEmpty ? null : _fechaCtrl.text.trim(),
      nextDueMileage: int.tryParse(_kmCtrl.text.trim()),
      warnDays: int.tryParse(_warnDiasCtrl.text.trim()),
      warnKm: int.tryParse(_warnKmCtrl.text.trim()),
      recommendations:
          _recomCtrl.text.trim().isEmpty ? null : _recomCtrl.text.trim(),
    );

    if (!mounted) return;

    if (error != null) {
      setState(() => _guardando = false);
      ScaffoldMessenger.of(context)
          .showSnackBar(SnackBar(content: Text(error.message)));
      return;
    }

    ScaffoldMessenger.of(context).showSnackBar(
      const SnackBar(content: Text('Mantenimiento registrado')),
    );
    Navigator.of(context).pop(true);
  }

  String? _validarEnteroNoNegativo(String? valor, String mensaje) {
    if (valor == null || valor.trim().isEmpty) return null;
    final numero = int.tryParse(valor.trim());
    if (numero == null || numero < 0) return mensaje;
    return null;
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
          title: const Text('Registrar mantenimiento'),
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
                        DropdownButtonFormField<Vehicle>(
                          initialValue: _vehiculo,
                          isExpanded: true,
                          decoration: const InputDecoration(
                            labelText: 'Vehículo',
                            border: OutlineInputBorder(),
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
                          validator: (vehiculo) => vehiculo == null
                              ? 'Selecciona un vehículo.'
                              : null,
                          onChanged: (vehiculo) =>
                              setState(() => _vehiculo = vehiculo),
                        ),
                        const SizedBox(height: AppSpacing.lg),
                        TextFormField(
                          controller: _fechaCtrl,
                          readOnly: true,
                          onTap: _elegirFecha,
                          decoration: InputDecoration(
                            labelText: 'Fecha objetivo',
                            hintText: 'YYYY-MM-DD',
                            border: const OutlineInputBorder(),
                            suffixIcon: IconButton(
                              tooltip: 'Elegir fecha',
                              icon: const Icon(Icons.calendar_month_outlined),
                              onPressed: _elegirFecha,
                            ),
                          ),
                          validator: (valor) {
                            if (valor == null || valor.trim().isEmpty) {
                              return null;
                            }
                            if (!RegExp(r'^\d{4}-\d{2}-\d{2}$')
                                .hasMatch(valor.trim())) {
                              return 'La fecha debe tener el formato YYYY-MM-DD.';
                            }
                            return null;
                          },
                        ),
                        const SizedBox(height: AppSpacing.lg),
                        TextFormField(
                          controller: _kmCtrl,
                          keyboardType: TextInputType.number,
                          decoration: const InputDecoration(
                            labelText: 'Kilometraje objetivo',
                            border: OutlineInputBorder(),
                          ),
                          validator: (valor) => _validarEnteroNoNegativo(
                            valor,
                            'El kilometraje objetivo debe ser un número entero mayor o igual a cero.',
                          ),
                        ),
                        const SizedBox(height: AppSpacing.lg),
                        Row(
                          children: [
                            Expanded(
                              child: TextFormField(
                                controller: _warnDiasCtrl,
                                keyboardType: TextInputType.number,
                                decoration: const InputDecoration(
                                  labelText: 'Antelación en días',
                                  hintText: '30',
                                  border: OutlineInputBorder(),
                                ),
                                validator: (valor) => _validarEnteroNoNegativo(
                                  valor,
                                  'La antelación en días debe ser un número entero mayor o igual a cero.',
                                ),
                              ),
                            ),
                            const SizedBox(width: AppSpacing.lg),
                            Expanded(
                              child: TextFormField(
                                controller: _warnKmCtrl,
                                keyboardType: TextInputType.number,
                                decoration: const InputDecoration(
                                  labelText: 'Antelación en kilómetros',
                                  hintText: '500',
                                  border: OutlineInputBorder(),
                                ),
                                validator: (valor) => _validarEnteroNoNegativo(
                                  valor,
                                  'La antelación en kilómetros debe ser un número entero mayor o igual a cero.',
                                ),
                              ),
                            ),
                          ],
                        ),
                        const SizedBox(height: AppSpacing.lg),
                        TextFormField(
                          controller: _recomCtrl,
                          maxLines: 3,
                          maxLength: 1000,
                          decoration: const InputDecoration(
                            labelText: 'Recomendaciones',
                            hintText: 'Próximo servicio, piezas a vigilar…',
                            border: OutlineInputBorder(),
                            counterText: '',
                          ),
                          validator: (valor) {
                            if (valor != null && valor.trim().length > 1000) {
                              return 'Las recomendaciones no pueden superar los 1000 caracteres.';
                            }
                            return null;
                          },
                        ),
                        if (_errorObjetivo != null) ...[
                          const SizedBox(height: AppSpacing.md),
                          Text(
                            _errorObjetivo!,
                            style: const TextStyle(color: AppColors.danger),
                          ),
                        ],
                        const SizedBox(height: AppSpacing.xl),
                        ElevatedButton(
                          onPressed: _guardando ? null : _guardar,
                          child: _guardando
                              ? const SizedBox(
                                  width: 20,
                                  height: 20,
                                  child: CircularProgressIndicator(
                                    strokeWidth: 2,
                                  ),
                                )
                              : const Text('Guardar'),
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
