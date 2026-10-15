import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:url_launcher/url_launcher.dart';

import '../../models/payment.dart';
import '../../providers/payments_provider.dart';
import '../../utils/app_theme.dart';
import '../../widgets/confirm_dialog.dart';
import '../../widgets/estado_pago_chip.dart';
import '../../widgets/states_view.dart';

/// Cobro manual o con Mercado Pago de una orden (Sprint 4, T019/T028, US1 y
/// US2, CA-1/CA-2, FR-002/FR-004/FR-005).
///
/// El total lo calcula el backend (R-03) y viaja precargado en el importe:
/// Q1 admite un único pago por el total, sin importes parciales. Los 4
/// métodos del negocio: los manuales nacen `PAID` y Mercado Pago `PENDING`;
/// sin credenciales el backend responde 409 y aquí se muestra el aviso «no
/// disponible» sin perder el formulario.
class PaymentFormScreen extends StatefulWidget {
  const PaymentFormScreen({super.key, required this.orderId});

  /// Orden a cobrar (el pago siempre cuelga de ella, RN-13).
  final int orderId;

  @override
  State<PaymentFormScreen> createState() => _PaymentFormScreenState();
}

class _PaymentFormScreenState extends State<PaymentFormScreen> {
  static const _metodos = ['CASH', 'CARD', 'TRANSFER', 'MERCADO_PAGO'];

  final _formKey = GlobalKey<FormState>();
  late final TextEditingController _importeCtrl;
  String _metodo = 'CASH';
  bool _guardando = false;

  @override
  void initState() {
    super.initState();
    _importeCtrl = TextEditingController();
    // Se carga tras el primer frame para no notificar durante la construcción.
    WidgetsBinding.instance.addPostFrameCallback((_) async {
      if (!mounted) return;
      final proveedor = context.read<PaymentsProvider>();
      await proveedor.cargarTotal(widget.orderId);
      if (!mounted) return;
      // Importe precargado igual al total (VN-03: sin pagos parciales).
      final total = proveedor.total;
      if (total != null) setState(() => _importeCtrl.text = total);
    });
  }

  @override
  void dispose() {
    _importeCtrl.dispose();
    super.dispose();
  }

  String? _validarImporte(String? valor) {
    final texto = (valor ?? '').trim();
    if (texto.isEmpty) return 'El importe es obligatorio.';
    final importe = num.tryParse(texto);
    if (importe == null || importe < 0.01) {
      return 'El importe debe ser un número mayor o igual a 0.01 con hasta 2 decimales.';
    }
    final total = context.read<PaymentsProvider>().total;
    if (total != null &&
        (importe * 100).round() != (num.parse(total) * 100).round()) {
      return 'El importe debe coincidir con el total de la orden; no se admiten pagos parciales.';
    }
    return null;
  }

  Future<void> _registrar() async {
    if (!(_formKey.currentState?.validate() ?? false)) return;

    final importe = _importeCtrl.text.trim();
    final etiqueta = Payment.etiquetasMetodo[_metodo] ?? _metodo;
    final confirmado = await mostrarConfirmacion(
      context,
      titulo: 'Registrar pago',
      mensaje: '¿Registrar el pago de \$$importe en $etiqueta?',
    );
    if (!confirmado || !mounted) return;

    setState(() => _guardando = true);
    final error = await context
        .read<PaymentsProvider>()
        .registrarPago(widget.orderId, _metodo, importe);
    if (!mounted) return;
    setState(() => _guardando = false);

    if (error != null) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(error.message)),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    final proveedor = context.watch<PaymentsProvider>();

    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: AppBar(title: const Text('Cobro de la orden')),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(AppSpacing.xl),
        child: Center(
          child: ConstrainedBox(
            constraints: const BoxConstraints(maxWidth: 480),
            child: _cuerpo(proveedor),
          ),
        ),
      ),
    );
  }

  Widget _cuerpo(PaymentsProvider proveedor) {
    // Cargando: la consulta del total está en curso o aún no arranca.
    if (proveedor.cargandoTotal ||
        (proveedor.total == null && proveedor.errorTotal == null)) {
      return const LoadingView(mensaje: 'Cargando el total de la orden…');
    }
    if (proveedor.errorTotal != null) {
      return ErrorView(
        mensaje: proveedor.errorTotal!,
        onReintentar: () => proveedor.cargarTotal(widget.orderId),
      );
    }

    final total = proveedor.total;
    final centavos = total == null ? 0 : (num.parse(total) * 100).round();
    if (centavos <= 0) {
      return const EmptyView(
        mensaje: 'Esta orden no tiene importes por cobrar.',
        icono: Icons.receipt_long_outlined,
      );
    }

    // Cobro realizado: estado final del flujo (CA-1); con MP el panel
    // muestra las acciones del modo sandbox (US4, T047).
    final pago = proveedor.ultimoPago;
    if (pago != null) return _resultado(proveedor, pago);

    return _formulario(proveedor, total!);
  }

  Widget _formulario(PaymentsProvider proveedor, String total) {
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(AppSpacing.lg),
        child: Form(
          key: _formKey,
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            mainAxisSize: MainAxisSize.min,
            children: [
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  const Text(
                    'Total de la orden',
                    style: TextStyle(color: AppColors.textSecondary),
                  ),
                  Text(
                    '\$$total',
                    style: const TextStyle(
                      fontSize: 20,
                      fontWeight: FontWeight.w700,
                      color: AppColors.textPrimary,
                    ),
                  ),
                ],
              ),
              const SizedBox(height: AppSpacing.lg),
              TextFormField(
                controller: _importeCtrl,
                decoration: const InputDecoration(labelText: 'Importe'),
                keyboardType:
                    const TextInputType.numberWithOptions(decimal: true),
                validator: _validarImporte,
              ),
              const SizedBox(height: AppSpacing.lg),
              const Text(
                'Método de pago',
                style: TextStyle(fontWeight: FontWeight.w600),
              ),
              const SizedBox(height: AppSpacing.sm),
              Wrap(
                spacing: AppSpacing.sm,
                runSpacing: AppSpacing.sm,
                children: [
                  for (final codigo in _metodos)
                    ChoiceChip(
                      label: Text(Payment.etiquetasMetodo[codigo] ?? codigo),
                      selected: _metodo == codigo,
                      onSelected: (_) => setState(() => _metodo = codigo),
                    ),
                ],
              ),
              const SizedBox(height: AppSpacing.xl),
              SizedBox(
                width: double.infinity,
                child: ElevatedButton.icon(
                  onPressed:
                      _guardando || proveedor.registrando ? null : _registrar,
                  icon: _guardando || proveedor.registrando
                      ? const SizedBox(
                          width: 16,
                          height: 16,
                          child: CircularProgressIndicator(strokeWidth: 2),
                        )
                      : const Icon(Icons.payments_outlined),
                  label: Text(_guardando ? 'Guardando…' : 'Registrar pago'),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  /// Icono y color del estado del pago (máquina R-04 en español con el chip).
  (IconData, Color) _indicador(String estado) {
    switch (estado) {
      case 'PENDING':
        return (Icons.hourglass_top_outlined, AppColors.warning);
      case 'REJECTED':
        return (Icons.cancel_outlined, AppColors.danger);
      case 'CANCELLED':
        return (Icons.block_outlined, AppColors.textSecondary);
      default:
        return (Icons.check_circle_outline, AppColors.success);
    }
  }

  Widget _resultado(PaymentsProvider proveedor, Payment pago) {
    final (icono, color) = _indicador(pago.status);
    final esPendienteMP =
        pago.method == 'MERCADO_PAGO' && pago.status == 'PENDING';
    final enAccion = proveedor.verificando || proveedor.cancelando;

    return Card(
      child: Padding(
        padding: const EdgeInsets.all(AppSpacing.xl),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(icono, size: 48, color: color),
            const SizedBox(height: AppSpacing.md),
            Text(
              pago.method == 'MERCADO_PAGO'
                  ? 'Pago con Mercado Pago'
                  : 'Pago registrado',
              style: const TextStyle(fontSize: 18, fontWeight: FontWeight.w700),
            ),
            const SizedBox(height: AppSpacing.md),
            EstadoPagoChip(status: pago.status),
            const SizedBox(height: AppSpacing.lg),
            Text('Importe: \$${pago.amount}'),
            Text('Método: ${pago.etiquetaMetodo}'),

            // US4/R-04: mientras el pago MP está PENDING se ofrece abrir el
            // checkout del proveedor fuera de la app (RN-14: la captura de la
            // tarjeta ocurre en Mercado Pago, nunca aquí).
            if (esPendienteMP && proveedor.initPoint != null) ...[
              const SizedBox(height: AppSpacing.lg),
              SizedBox(
                width: double.infinity,
                child: OutlinedButton.icon(
                  onPressed: enAccion
                      ? null
                      : () => _abrirEnNavegador(proveedor.initPoint!),
                  icon: const Icon(Icons.open_in_new),
                  label: const Text('Abrir en el navegador'),
                ),
              ),
            ],

            // La verificación consulta al proveedor y la cancelación es
            // local con confirmación previa (8.5).
            if (esPendienteMP) ...[
              const SizedBox(height: AppSpacing.sm),
              Row(
                children: [
                  Expanded(
                    child: FilledButton.icon(
                      onPressed: enAccion
                          ? null
                          : () => _verificar(proveedor, pago),
                      icon: proveedor.verificando
                          ? const SizedBox(
                              width: 16,
                              height: 16,
                              child: CircularProgressIndicator(strokeWidth: 2),
                            )
                          : const Icon(Icons.sync),
                      label: const Text('Verificar estado'),
                    ),
                  ),
                  const SizedBox(width: AppSpacing.sm),
                  TextButton.icon(
                    onPressed: enAccion
                        ? null
                        : () => _cancelar(proveedor, pago),
                    icon: const Icon(Icons.close),
                    label: const Text('Cancelar pago'),
                  ),
                ],
              ),
            ],

            const SizedBox(height: AppSpacing.xl),
            SizedBox(
              width: double.infinity,
              child: FilledButton(
                onPressed: () => Navigator.of(context).pop(),
                child: const Text('Listo'),
              ),
            ),
          ],
        ),
      ),
    );
  }

  /// Abre el `initPoint` (URL de pago MP) en el navegador del equipo.
  Future<void> _abrirEnNavegador(String url) async {
    final uri = Uri.tryParse(url);
    if (uri == null) return;
    try {
      final abierto = await launchUrl(uri, mode: LaunchMode.externalApplication);
      if (!abierto && mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('No se pudo abrir la página de pago.'),
          ),
        );
      }
    } catch (_) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('No se pudo abrir la página de pago.')),
        );
      }
    }
  }

  /// «Verificar estado»: consulta el resultado al proveedor vía sync.
  Future<void> _verificar(PaymentsProvider proveedor, Payment pago) async {
    final error = await proveedor.sincronizarPago(widget.orderId, pago.id);
    if (error == null || !mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(content: Text(error.message)),
    );
  }

  /// «Cancelar pago»: confirmación previa y luego cancelación local (Q1).
  Future<void> _cancelar(PaymentsProvider proveedor, Payment pago) async {
    final confirmado = await mostrarConfirmacion(
      context,
      titulo: 'Cancelar pago',
      mensaje: '¿Cancelar el intento de pago de Mercado Pago?',
      esPeligrosa: true,
    );
    if (!confirmado || !mounted) return;

    final error = await proveedor.cancelarPago(widget.orderId, pago.id);
    if (error == null || !mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(content: Text(error.message)),
    );
  }
}
