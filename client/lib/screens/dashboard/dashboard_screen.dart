import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../models/dashboard_data.dart';
import '../../providers/dashboard_provider.dart';
import '../../utils/app_theme.dart';
import '../../widgets/states_view.dart';

/// Panel de control con los 8 indicadores del taller (US5, T057, CA-6,
/// FR-012).
///
/// Cada apertura consulta `GET /api/dashboard` y el backend recalcula todo en
/// esa misma ejecución (RN-10, SC-007): sin caché ni datos guardados aquí.
class DashboardScreen extends StatefulWidget {
  const DashboardScreen({super.key});

  @override
  State<DashboardScreen> createState() => _DashboardScreenState();
}

class _DashboardScreenState extends State<DashboardScreen> {
  @override
  void initState() {
    super.initState();
    // Se carga tras el primer frame para no notificar durante la construcción.
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (mounted) context.read<DashboardProvider>().cargar();
    });
  }

  @override
  Widget build(BuildContext context) {
    final proveedor = context.watch<DashboardProvider>();

    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: AppBar(
        title: const Text('Dashboard'),
        actions: [
          IconButton(
            tooltip: 'Actualizar',
            icon: const Icon(Icons.refresh),
            onPressed: proveedor.cargando
                ? null
                : () => proveedor.cargar(),
          ),
        ],
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(AppSpacing.lg),
        child: _cuerpo(proveedor),
      ),
    );
  }

  Widget _cuerpo(DashboardProvider proveedor) {
    // Cargando: la consulta del panel está en curso o aún no arranca.
    if (proveedor.cargando ||
        (proveedor.resumen == null && proveedor.error == null)) {
      return const LoadingView(mensaje: 'Cargando el panel…');
    }
    if (proveedor.error != null) {
      return ErrorView(
        mensaje: proveedor.error!,
        onReintentar: proveedor.cargar,
      );
    }

    final resumen = proveedor.resumen!;
    if (resumen.totalActividad == 0) {
      // Taller vacío: todo en cero con su estado vacío (escenario 3, SC-007).
      return const EmptyView(
        mensaje: 'Aún no hay actividad del taller que mostrar.',
        icono: Icons.dashboard_outlined,
      );
    }

    final detalle = proveedor.detalle;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        // Los 8 contadores (US5)…
        Wrap(
          spacing: AppSpacing.md,
          runSpacing: AppSpacing.md,
          children: [
            for (final (etiqueta, valor) in resumen.indicadores)
              _tarjeta(etiqueta, valor),
          ],
        ),
        // …y en la MISMA respuesta las 4 secciones de detalle (US6, SC-007).
        if (detalle != null) ...[
          const SizedBox(height: AppSpacing.lg),
          _seccionOrdenes(detalle.ordenes),
          const SizedBox(height: AppSpacing.md),
          _seccionCitas(detalle.citas),
          const SizedBox(height: AppSpacing.md),
          _seccionMantenimientos(
            detalle.mantenimientosPorVencer,
            detalle.mantenimientosVencidos,
          ),
          const SizedBox(height: AppSpacing.md),
          _seccionAlertas(detalle.alertasStock),
        ],
      ],
    );
  }

  /// Tarjeta «etiqueta + número grande» con los tokens del design system.
  Widget _tarjeta(String etiqueta, int valor) {
    return SizedBox(
      width: 240,
      child: Card(
        child: Padding(
          padding: const EdgeInsets.all(AppSpacing.lg),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            mainAxisSize: MainAxisSize.min,
            children: [
              Text(
                etiqueta,
                style: const TextStyle(
                  fontSize: 13,
                  color: AppColors.textSecondary,
                ),
              ),
              const SizedBox(height: AppSpacing.sm),
              Text(
                '$valor',
                style: const TextStyle(
                  fontSize: 30,
                  fontWeight: FontWeight.w700,
                  color: AppColors.primary,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  // ── Secciones de detalle (US6, T063, CA-6) ──

  /// Contenedor de sección: título y contenido (lista o estado vacío).
  Widget _seccion({required String titulo, required Widget contenido}) {
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(AppSpacing.lg),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          mainAxisSize: MainAxisSize.min,
          children: [
            Text(
              titulo,
              style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w700),
            ),
            const SizedBox(height: AppSpacing.md),
            contenido,
          ],
        ),
      ),
    );
  }

  /// Sección «Últimas órdenes»: las 5 más recientes con su total calculado.
  Widget _seccionOrdenes(List<OrdenReciente> ordenes) {
    return _seccion(
      titulo: 'Últimas órdenes',
      contenido: ordenes.isEmpty
          ? const EmptyView(mensaje: 'Aún no hay órdenes recientes.')
          : Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              mainAxisSize: MainAxisSize.min,
              children: [for (final orden in ordenes) _filaOrden(orden)],
            ),
    );
  }

  Widget _filaOrden(OrdenReciente orden) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: AppSpacing.sm),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        mainAxisSize: MainAxisSize.min,
        children: [
          Text(
            orden.clientName,
            style: const TextStyle(fontWeight: FontWeight.w600),
          ),
          Text(
            orden.vehicleLabel,
            style: const TextStyle(
              fontSize: 13,
              color: AppColors.textSecondary,
            ),
          ),
          const SizedBox(height: 2),
          Row(
            children: [
              Text(
                orden.etiquetaEstado,
                style: const TextStyle(fontSize: 13, color: AppColors.primary),
              ),
              const SizedBox(width: AppSpacing.sm),
              Text(
                'Total: \$${orden.total}',
                style: const TextStyle(fontSize: 13),
              ),
            ],
          ),
        ],
      ),
    );
  }

  /// Sección «Próximas citas»: las 5 más próximas con fecha, hora y motivo.
  Widget _seccionCitas(List<CitaProxima> citas) {
    return _seccion(
      titulo: 'Próximas citas',
      contenido: citas.isEmpty
          ? const EmptyView(mensaje: 'No hay citas próximas.')
          : Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              mainAxisSize: MainAxisSize.min,
              children: [for (final cita in citas) _filaCita(cita)],
            ),
    );
  }

  Widget _filaCita(CitaProxima cita) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: AppSpacing.sm),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        mainAxisSize: MainAxisSize.min,
        children: [
          Text(cita.reason, style: const TextStyle(fontWeight: FontWeight.w600)),
          Text(
            '${cita.clientName} · ${cita.vehicleLabel}',
            style: const TextStyle(
              fontSize: 13,
              color: AppColors.textSecondary,
            ),
          ),
          const SizedBox(height: 2),
          Row(
            children: [
              Text(
                '${cita.appointmentDate} · ${cita.horaCorta}',
                style: const TextStyle(fontSize: 13),
              ),
              const SizedBox(width: AppSpacing.sm),
              Text(
                cita.etiquetaEstado,
                style: const TextStyle(fontSize: 13, color: AppColors.primary),
              ),
            ],
          ),
        ],
      ),
    );
  }

  /// Sección «Mantenimientos»: vencidos primero, después los por vencer
  /// (mismo orden de urgencia que la lista del módulo, SC-004).
  Widget _seccionMantenimientos(
    List<MantenimientoDetalle> porVencer,
    List<MantenimientoDetalle> vencidos,
  ) {
    final vacio = porVencer.isEmpty && vencidos.isEmpty;
    return _seccion(
      titulo: 'Mantenimientos',
      contenido: vacio
          ? const EmptyView(
              mensaje: 'Sin mantenimientos por vencer ni vencidos.',
            )
          : Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              mainAxisSize: MainAxisSize.min,
              children: [
                if (vencidos.isNotEmpty) ...[
                  const Text(
                    'Vencidos',
                    style: TextStyle(
                      fontSize: 13,
                      fontWeight: FontWeight.w700,
                      color: AppColors.danger,
                    ),
                  ),
                  for (final mantenimiento in vencidos)
                    _filaMantenimiento(mantenimiento),
                ],
                if (porVencer.isNotEmpty) ...[
                  if (vencidos.isNotEmpty)
                    const SizedBox(height: AppSpacing.md),
                  const Text(
                    'Próximos',
                    style: TextStyle(
                      fontSize: 13,
                      fontWeight: FontWeight.w700,
                      color: AppColors.warning,
                    ),
                  ),
                  for (final mantenimiento in porVencer)
                    _filaMantenimiento(mantenimiento),
                ],
              ],
            ),
    );
  }

  Widget _filaMantenimiento(MantenimientoDetalle mantenimiento) {
    final dias = mantenimiento.daysRemaining;
    final vencido = dias != null && dias < 0;
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: AppSpacing.sm),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        mainAxisSize: MainAxisSize.min,
        children: [
          Text(
            mantenimiento.vehicleLabel,
            style: const TextStyle(fontWeight: FontWeight.w600),
          ),
          Text(
            mantenimiento.clientName,
            style: const TextStyle(
              fontSize: 13,
              color: AppColors.textSecondary,
            ),
          ),
          const SizedBox(height: 2),
          Row(
            children: [
              Text(
                _textoDias(dias),
                style: TextStyle(
                  fontSize: 13,
                  color: vencido ? AppColors.danger : AppColors.warning,
                ),
              ),
              if (mantenimiento.mileageRemaining != null) ...[
                const SizedBox(width: AppSpacing.sm),
                Text(
                  'Faltan ${mantenimiento.mileageRemaining} km',
                  style: const TextStyle(
                    fontSize: 13,
                    color: AppColors.textSecondary,
                  ),
                ),
              ],
            ],
          ),
        ],
      ),
    );
  }

  /// Días restantes redactados en español (contract daysRemaining).
  String _textoDias(int? dias) {
    if (dias == null) return 'Sin fecha objetivo';
    if (dias == -1) return 'Vencido hace 1 día';
    if (dias < 0) return 'Vencido hace ${-dias} días';
    if (dias == 0) return 'Vence hoy';
    return 'Faltan $dias días';
  }

  /// Sección «Alertas de inventario»: todas las refacciones con stock bajo.
  Widget _seccionAlertas(List<RefaccionAlerta> alertas) {
    return _seccion(
      titulo: 'Alertas de inventario',
      contenido: alertas.isEmpty
          ? const EmptyView(mensaje: 'No hay refacciones con stock bajo.')
          : Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              mainAxisSize: MainAxisSize.min,
              children: [for (final parte in alertas) _filaRefaccion(parte)],
            ),
    );
  }

  Widget _filaRefaccion(RefaccionAlerta parte) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: AppSpacing.sm),
      child: Row(
        children: [
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              mainAxisSize: MainAxisSize.min,
              children: [
                Text(
                  parte.partCode,
                  style: const TextStyle(
                    fontSize: 13,
                    color: AppColors.textSecondary,
                  ),
                ),
                Text(
                  parte.name,
                  style: const TextStyle(fontWeight: FontWeight.w600),
                ),
              ],
            ),
          ),
          Text(
            '${parte.stockCurrent} / ${parte.stockMin}',
            style: const TextStyle(
              fontSize: 14,
              fontWeight: FontWeight.w700,
              color: AppColors.danger,
            ),
          ),
        ],
      ),
    );
  }
}
