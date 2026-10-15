import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../models/history_entry.dart';
import '../../models/vehicle.dart';
import '../../providers/vehicle_history_provider.dart';
import '../../utils/app_theme.dart';
import '../../widgets/states_view.dart';

/// Historial de servicios del vehículo (T018, US1, CA-1, FR-001).
/// Selector de vehículo + tarjetas por servicio terminado o entregado.
class VehicleHistoryScreen extends StatefulWidget {
  const VehicleHistoryScreen({super.key});

  @override
  State<VehicleHistoryScreen> createState() => _VehicleHistoryScreenState();
}

class _VehicleHistoryScreenState extends State<VehicleHistoryScreen> {
  @override
  void initState() {
    super.initState();
    // Se carga tras el primer frame para no notificar durante la construcción.
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (mounted) context.read<VehicleHistoryProvider>().cargar();
    });
  }

  @override
  Widget build(BuildContext context) {
    final historial = context.watch<VehicleHistoryProvider>();

    return Scaffold(
      backgroundColor: AppColors.background,
      body: Padding(
        padding: const EdgeInsets.all(AppSpacing.xl),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            if (historial.vehiculos.isNotEmpty) ...[
              _SelectorVehiculo(historial: historial),
              const SizedBox(height: AppSpacing.lg),
            ],
            Expanded(child: _contenido(historial)),
          ],
        ),
      ),
    );
  }

  Widget _contenido(VehicleHistoryProvider historial) {
    if (historial.cargando) {
      return const LoadingView(mensaje: 'Cargando historial…');
    }
    if (historial.error != null && historial.vehiculos.isEmpty) {
      return ErrorView(
        mensaje: historial.error!,
        onReintentar: historial.reintentar,
      );
    }
    if (historial.vehiculos.isEmpty) {
      return const EmptyView(
        mensaje: 'Aún no hay vehículos registrados.',
        icono: Icons.directions_car_outlined,
      );
    }
    if (historial.error != null) {
      return ErrorView(
        mensaje: historial.error!,
        onReintentar: () => historial.seleccionar(
          historial.vehiculoSeleccionado ?? historial.vehiculos.first,
        ),
      );
    }
    if (historial.cargandoHistorial) {
      return const LoadingView(mensaje: 'Cargando historial…');
    }
    if (historial.entradas.isEmpty) {
      return const EmptyView(
        mensaje: 'Este vehículo aún no tiene servicios terminados.',
        icono: Icons.history,
      );
    }

    return ListView(
      children: [
        if (historial.cabecera != null)
          Padding(
            padding: const EdgeInsets.only(bottom: AppSpacing.md),
            child: Wrap(
              spacing: AppSpacing.lg,
              runSpacing: AppSpacing.xs,
              children: [
                Text(
                  historial.cabecera!.label,
                  style: Theme.of(context).textTheme.titleMedium,
                ),
                Text(
                  'Cliente: ${historial.cabecera!.clientName}',
                  style: const TextStyle(color: AppColors.textSecondary),
                ),
                Text(
                  'Kilometraje actual: ${historial.cabecera!.currentMileage} km',
                  style: const TextStyle(color: AppColors.textSecondary),
                ),
              ],
            ),
          ),
        for (final entrada in historial.entradas)
          _TarjetaHistorial(entrada: entrada),
      ],
    );
  }
}

class _SelectorVehiculo extends StatelessWidget {
  const _SelectorVehiculo({required this.historial});

  final VehicleHistoryProvider historial;

  @override
  Widget build(BuildContext context) {
    return DropdownButtonFormField<Vehicle>(
      initialValue: historial.vehiculoSeleccionado,
      isExpanded: true,
      decoration: const InputDecoration(
        labelText: 'Vehículo',
        border: OutlineInputBorder(),
      ),
      items: [
        for (final vehiculo in historial.vehiculos)
          DropdownMenuItem<Vehicle>(
            value: vehiculo,
            child: Text(VehicleHistoryProvider.etiquetaDe(vehiculo)),
          ),
      ],
      onChanged: (vehiculo) {
        if (vehiculo != null) historial.seleccionar(vehiculo);
      },
    );
  }
}

class _TarjetaHistorial extends StatelessWidget {
  const _TarjetaHistorial({required this.entrada});

  final HistoryEntry entrada;

  @override
  Widget build(BuildContext context) {
    final estiloTitulo = Theme.of(context).textTheme.titleSmall;

    return Card(
      margin: const EdgeInsets.only(bottom: AppSpacing.md),
      color: AppColors.surface,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(AppRadii.panel),
      ),
      child: Padding(
        padding: const EdgeInsets.all(AppSpacing.lg),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Wrap(
              spacing: AppSpacing.lg,
              runSpacing: AppSpacing.xs,
              crossAxisAlignment: WrapCrossAlignment.center,
              children: [
                Text('${entrada.fechaFormateada} · ${entrada.etiquetaEstado}',
                    style: estiloTitulo),
                Text(
                  'Ingreso: ${entrada.entryMileage} km',
                  style: const TextStyle(color: AppColors.textSecondary),
                ),
                if (entrada.mechanicName != null)
                  Text(
                    'Mecánico: ${entrada.mechanicName}',
                    style: const TextStyle(color: AppColors.textSecondary),
                  ),
              ],
            ),
            if (entrada.diagnosis != null && entrada.diagnosis!.isNotEmpty) ...[
              const SizedBox(height: AppSpacing.sm),
              _Par(etiqueta: 'Diagnóstico', valor: entrada.diagnosis!),
            ],
            if (entrada.services.isNotEmpty) ...[
              const SizedBox(height: AppSpacing.sm),
              _Par(
                etiqueta: 'Servicios',
                valor: entrada.services
                    .map((servicio) =>
                        '${servicio.description} (\$${servicio.unitPrice})')
                    .join(', '),
              ),
            ],
            if (entrada.labor.isNotEmpty) ...[
              const SizedBox(height: AppSpacing.sm),
              _Par(
                etiqueta: 'Mano de obra',
                valor: entrada.labor
                    .map((concepto) =>
                        '${concepto.concept}: ${concepto.hours} h (\$${concepto.hourlyRate}/h)')
                    .join(', '),
              ),
            ],
            if (entrada.parts.isNotEmpty) ...[
              const SizedBox(height: AppSpacing.sm),
              _Par(
                etiqueta: 'Refacciones',
                valor: entrada.parts
                    .map((refaccion) =>
                        '${refaccion.partCode} ${refaccion.name} ×${refaccion.quantity}')
                    .join(', '),
              ),
            ],
            if (entrada.observations != null &&
                entrada.observations!.isNotEmpty) ...[
              const SizedBox(height: AppSpacing.sm),
              _Par(etiqueta: 'Observaciones', valor: entrada.observations!),
            ],
            if (entrada.recommendations != null &&
                entrada.recommendations!.isNotEmpty) ...[
              const SizedBox(height: AppSpacing.sm),
              _Par(
                etiqueta: 'Recomendaciones',
                valor: entrada.recommendations!,
              ),
            ],
          ],
        ),
      ),
    );
  }
}

/// Par etiqueta/valor en español para los campos del historial.
class _Par extends StatelessWidget {
  const _Par({required this.etiqueta, required this.valor});

  final String etiqueta;
  final String valor;

  @override
  Widget build(BuildContext context) {
    return Wrap(
      spacing: AppSpacing.sm,
      runSpacing: AppSpacing.xs,
      crossAxisAlignment: WrapCrossAlignment.start,
      children: [
        Text(
          '$etiqueta:',
          style: const TextStyle(
            fontWeight: FontWeight.w600,
            color: AppColors.textPrimary,
          ),
        ),
        Text(valor, style: const TextStyle(color: AppColors.textPrimary)),
      ],
    );
  }
}
