import 'dart:async';

import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../models/appointment.dart';
import '../../providers/appointments_provider.dart';
import '../../utils/app_route.dart';
import '../../utils/app_theme.dart';
import '../../widgets/confirm_dialog.dart';
import '../../widgets/states_view.dart';
import 'appointment_form_screen.dart';

/// Listado de la agenda de citas con búsqueda y filtros (T020, CA-1).
class AppointmentListScreen extends StatefulWidget {
  const AppointmentListScreen({super.key});

  @override
  State<AppointmentListScreen> createState() => _AppointmentListScreenState();
}

class _AppointmentListScreenState extends State<AppointmentListScreen> {
  Timer? _retardoBusqueda;
  final _busquedaCtrl = TextEditingController();

  @override
  void initState() {
    super.initState();
    // Se carga tras el primer frame para no notificar durante la construcción.
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (mounted) context.read<AppointmentsProvider>().cargar();
    });
  }

  @override
  void dispose() {
    _retardoBusqueda?.cancel();
    _busquedaCtrl.dispose();
    super.dispose();
  }

  void _buscar(String texto) {
    _retardoBusqueda?.cancel();
    _retardoBusqueda = Timer(const Duration(milliseconds: 350), () {
      if (!mounted) return;
      context.read<AppointmentsProvider>().cargar(q: texto.trim());
    });
  }

  String _fechaCorta(String fecha) {
    final partes = fecha.split('-');
    if (partes.length != 3) return fecha;
    return '${partes[2]}/${partes[1]}/${partes[0]}';
  }

  Future<void> _abrirAlta() async {
    await Navigator.of(context).push(
      AppRoute(builder: (_) => const AppointmentFormScreen()),
    );
  }

  Future<void> _abrirEdicion(Appointment cita) async {
    await Navigator.of(context).push(
      AppRoute(builder: (_) => AppointmentFormScreen(cita: cita)),
    );
  }

  Future<void> _elegirDia() async {
    final proveedor = context.read<AppointmentsProvider>();
    final hoy = DateTime.now();
    var inicial = hoy;
    if (proveedor.filtroFecha != null && proveedor.filtroFecha!.isNotEmpty) {
      try {
        inicial = DateTime.parse(proveedor.filtroFecha!);
      } catch (_) {
        inicial = hoy;
      }
    }

    final dia = await showDatePicker(
      context: context,
      initialDate: inicial,
      firstDate: DateTime(2020),
      lastDate: DateTime(2100),
    );
    if (dia == null || !mounted) return;
    final fecha =
        '${dia.year.toString().padLeft(4, '0')}-${dia.month.toString().padLeft(2, '0')}-${dia.day.toString().padLeft(2, '0')}';
    await context.read<AppointmentsProvider>().cargar(fecha: fecha);
  }

  /// Cancelación con confirmación obligatoria (FR-004, sección 8.5).
  Future<void> _cancelar(Appointment cita) async {
    final proveedor = context.read<AppointmentsProvider>();
    final confirmado = await mostrarConfirmacion(
      context,
      titulo: 'Cancelar cita',
      mensaje: '¿Cancelar la cita de ${cita.clientName}?',
      esPeligrosa: true,
    );
    if (!confirmado || !mounted) return;

    final error = await proveedor.cancelar(cita.id);
    if (!mounted) return;

    if (error != null) {
      ScaffoldMessenger.of(context)
          .showSnackBar(SnackBar(content: Text(error.message)));
      return;
    }
    ScaffoldMessenger.of(context).showSnackBar(
      const SnackBar(content: Text('Cita cancelada')),
    );
  }

  @override
  Widget build(BuildContext context) {
    final proveedor = context.watch<AppointmentsProvider>();
    final fechaActiva =
        proveedor.filtroFecha != null && proveedor.filtroFecha!.isNotEmpty;

    return Scaffold(
      backgroundColor: AppColors.background,
      floatingActionButton: FloatingActionButton.extended(
        onPressed: _abrirAlta,
        icon: const Icon(Icons.event_available_outlined),
        label: const Text('Agendar cita'),
      ),
      body: Padding(
        padding: const EdgeInsets.all(AppSpacing.xl),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Row(
              children: [
                Expanded(
                  child: TextField(
                    controller: _busquedaCtrl,
                    onChanged: _buscar,
                    decoration: const InputDecoration(
                      hintText: 'Buscar por cliente o placas',
                      prefixIcon: Icon(Icons.search),
                    ),
                  ),
                ),
                const SizedBox(width: AppSpacing.md),
                OutlinedButton.icon(
                  onPressed: _elegirDia,
                  icon: const Icon(Icons.calendar_today_outlined),
                  label: Text(
                    fechaActiva
                        ? _fechaCorta(proveedor.filtroFecha!)
                        : 'Fecha',
                  ),
                ),
                if (fechaActiva) ...[
                  IconButton(
                    tooltip: 'Quitar filtro de fecha',
                    icon: const Icon(Icons.close),
                    onPressed: () =>
                        context.read<AppointmentsProvider>().limpiarFecha(),
                  ),
                ] else
                  const SizedBox(width: AppSpacing.sm),
                SizedBox(
                  width: 200,
                  child: DropdownButtonFormField<String?>(
                    initialValue: proveedor.filtroEstado,
                    isExpanded: true,
                    hint: const Text('Todos'),
                    decoration: const InputDecoration(labelText: 'Estado'),
                    items: const [
                      DropdownMenuItem<String?>(
                        value: null,
                        child: Text('Todos'),
                      ),
                      DropdownMenuItem<String?>(
                        value: 'PENDING',
                        child: Text('Pendiente'),
                      ),
                      DropdownMenuItem<String?>(
                        value: 'CONFIRMED',
                        child: Text('Confirmada'),
                      ),
                      DropdownMenuItem<String?>(
                        value: 'IN_PROGRESS',
                        child: Text('En proceso'),
                      ),
                      DropdownMenuItem<String?>(
                        value: 'COMPLETED',
                        child: Text('Completada'),
                      ),
                      DropdownMenuItem<String?>(
                        value: 'CANCELED',
                        child: Text('Cancelada'),
                      ),
                    ],
                    onChanged: (estado) => context
                        .read<AppointmentsProvider>()
                        .cargar(estado: estado ?? ''),
                  ),
                ),
              ],
            ),
            const SizedBox(height: AppSpacing.lg),
            Expanded(child: _contenido(proveedor)),
          ],
        ),
      ),
    );
  }

  Widget _contenido(AppointmentsProvider proveedor) {
    if (proveedor.cargando) {
      return const LoadingView(mensaje: 'Cargando citas…');
    }
    if (proveedor.error != null) {
      return ErrorView(
        mensaje: proveedor.error!,
        onReintentar: () => context.read<AppointmentsProvider>().cargar(),
      );
    }
    if (proveedor.citas.isEmpty) {
      return EmptyView(
        icono: Icons.event_outlined,
        mensaje: proveedor.busqueda.isEmpty
            ? 'Aún no hay citas agendadas.'
            : 'No se encontraron citas para "${proveedor.busqueda}".',
        accion: ElevatedButton.icon(
          onPressed: _abrirAlta,
          icon: const Icon(Icons.event_available_outlined),
          label: const Text('Agendar cita'),
        ),
      );
    }

    return ListView.separated(
      itemCount: proveedor.citas.length,
      separatorBuilder: (_, _) => const Divider(height: 1),
      itemBuilder: (context, indice) {
        final cita = proveedor.citas[indice];
        final cerrada = cita.estaCerrada;

        return ListTile(
          leading: const CircleAvatar(
            backgroundColor: AppColors.surface,
            child: Icon(Icons.event_outlined, color: AppColors.primary),
          ),
          title: Row(
            children: [
              Flexible(
                child: Text(
                  '${cita.clientName} · ${cita.vehicleLabel}',
                  overflow: TextOverflow.ellipsis,
                ),
              ),
              const SizedBox(width: AppSpacing.sm),
              _EtiquetaEstado(status: cita.status),
            ],
          ),
          subtitle: Text(
            '${_fechaCorta(cita.date)} · ${cita.time} — ${cita.reason}',
            maxLines: 2,
            overflow: TextOverflow.ellipsis,
          ),
          trailing: Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              if (!cerrada) ...[
                IconButton(
                  tooltip: 'Editar cita',
                  icon: const Icon(Icons.edit_outlined),
                  onPressed: () => _abrirEdicion(cita),
                ),
                IconButton(
                  tooltip: 'Cancelar cita',
                  icon: const Icon(
                    Icons.event_busy_outlined,
                    color: AppColors.danger,
                  ),
                  onPressed: () => _cancelar(cita),
                ),
              ] else
                const Icon(Icons.lock_outline, color: AppColors.textSecondary),
            ],
          ),
          onTap: cerrada ? null : () => _abrirEdicion(cita),
        );
      },
    );
  }
}

/// Píldora con el estado en español de la cita (colores del sistema de diseño).
class _EtiquetaEstado extends StatelessWidget {
  const _EtiquetaEstado({required this.status});

  final String status;

  Color get _color {
    switch (status) {
      case 'COMPLETED':
        return AppColors.success;
      case 'CANCELED':
        return AppColors.danger;
      case 'CONFIRMED':
        return AppColors.primary;
      case 'IN_PROGRESS':
        return AppColors.sidebar;
      default:
        return AppColors.warning;
    }
  }

  @override
  Widget build(BuildContext context) {
    final etiqueta = Appointment.etiquetas[status] ?? status;
    return Container(
      padding: const EdgeInsets.symmetric(
        horizontal: AppSpacing.sm,
        vertical: AppSpacing.xs,
      ),
      decoration: BoxDecoration(
        color: _color.withValues(alpha: 0.14),
        borderRadius: BorderRadius.circular(AppRadii.pill),
      ),
      child: Text(
        etiqueta,
        style: Theme.of(context)
            .textTheme
            .bodySmall
            ?.copyWith(color: _color, fontWeight: FontWeight.w600),
      ),
    );
  }
}
