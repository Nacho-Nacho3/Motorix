import 'package:flutter/material.dart';
import 'package:pdf/pdf.dart';
import 'package:pdf/widgets.dart' as pw;
import 'package:printing/printing.dart';
import 'package:provider/provider.dart';

import '../../models/ticket.dart';
import '../../providers/payments_provider.dart';
import '../../utils/app_theme.dart';
import '../../widgets/estado_pago_chip.dart';
import '../../widgets/states_view.dart';

/// Comprobante de servicio imprimible (US3, T039, CA-4/CA-5, FR-010).
///
/// El contenido lo sirve el backend calculado (RN-10) y se muestra en un
/// comprobante de ancho fijo. «Imprimir» genera el PDF **en memoria** con
/// `pdf` y lo envía al diálogo del sistema con `printing`
/// (`Printing.layoutPdf`): no se escribe ni se almacena ningún archivo.
class TicketScreen extends StatefulWidget {
  const TicketScreen({super.key, required this.orderId});

  /// Orden cuyo comprobante se muestra (se genera o reabre al entrar).
  final int orderId;

  @override
  State<TicketScreen> createState() => _TicketScreenState();
}

class _TicketScreenState extends State<TicketScreen> {
  bool _imprimiendo = false;

  @override
  void initState() {
    super.initState();
    // Se carga tras el primer frame para no notificar durante la construcción.
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!mounted) return;
      // POST idempotente: crea el ticket o devuelve el existente (FR-011).
      context.read<PaymentsProvider>().generarTicket(widget.orderId);
    });
  }

  Future<void> _imprimir(Ticket ticket) async {
    setState(() => _imprimiendo = true);
    try {
      final documento = pw.Document();
      documento.addPage(
        pw.MultiPage(
          pageFormat: PdfPageFormat.a4,
          margin: const pw.EdgeInsets.all(36),
          build: (context) => _contenidoPdf(ticket),
        ),
      );
      // PDF en memoria → diálogo de impresión del sistema (CA-5, R-06).
      await Printing.layoutPdf(onLayout: (_) => documento.save());
    } finally {
      if (mounted) setState(() => _imprimiendo = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final proveedor = context.watch<PaymentsProvider>();

    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: AppBar(title: const Text('Ticket de servicio')),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(AppSpacing.lg),
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
    if (proveedor.cargandoTicket ||
        (proveedor.ticket == null && proveedor.errorTicket == null)) {
      return const LoadingView(mensaje: 'Generando el ticket…');
    }
    if (proveedor.errorTicket != null) {
      return ErrorView(
        mensaje: proveedor.errorTicket!,
        onReintentar: () => proveedor.generarTicket(widget.orderId),
      );
    }
    return _comprobante(proveedor.ticket!);
  }

  // ── Comprobante en pantalla ────────────────────────────────────────────

  Widget _comprobante(Ticket ticket) {
    final pago = ticket.payment;

    return Card(
      child: Padding(
        padding: const EdgeInsets.all(AppSpacing.lg),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            // Encabezado: folio único e inalterable (FR-011, CA-5).
            Center(
              child: Text(
                ticket.folio,
                style: const TextStyle(
                  fontSize: 22,
                  fontWeight: FontWeight.w700,
                  color: AppColors.primary,
                ),
              ),
            ),
            const SizedBox(height: AppSpacing.xs),
            Center(
              child: Text(
                ticket.createdAt ?? '',
                style: const TextStyle(
                  fontSize: 12,
                  color: AppColors.textSecondary,
                ),
              ),
            ),
            const SizedBox(height: AppSpacing.lg),

            _seccion('Taller', [
              _fila(ticket.workshop.name, ''),
              if (ticket.workshop.address != null)
                _fila('Dirección', ticket.workshop.address!),
              if (ticket.workshop.phone != null)
                _fila('Teléfono', ticket.workshop.phone!),
            ]),

            _seccion('Cliente', [
              _fila('Nombre', ticket.client.name),
              if (ticket.client.phone != null)
                _fila('Teléfono', ticket.client.phone!),
            ]),

            _seccion('Vehículo', [
              _fila('Descripción', ticket.vehicle.label),
              _fila('Placas', ticket.vehicle.licensePlate),
              _fila('Kilometraje de entrada', '${ticket.vehicle.entryMileage} km'),
            ]),

            if (ticket.services.isNotEmpty)
              _seccion(
                'Servicios',
                [
                  for (final servicio in ticket.services)
                    _fila(servicio.description, '\$${servicio.unitPrice}'),
                ],
              ),

            if (ticket.labor.isNotEmpty)
              _seccion(
                'Mano de obra',
                [
                  for (final trabajo in ticket.labor)
                    _filaConcepto(
                      trabajo.concept,
                      '${trabajo.hours} h × \$${trabajo.hourlyRate}',
                      '\$${trabajo.subtotal}',
                    ),
                ],
              ),

            if (ticket.parts.isNotEmpty)
              _seccion(
                'Refacciones',
                [
                  for (final parte in ticket.parts)
                    _filaConcepto(
                      parte.name,
                      '${parte.partCode} · ${parte.quantity} × \$${parte.unitPrice}',
                      '\$${parte.subtotal}',
                    ),
                ],
              ),

            _seccion('Totales', [
              _fila('Subtotal servicios', '\$${ticket.totals.servicesSubtotal}'),
              _fila('Subtotal mano de obra', '\$${ticket.totals.laborSubtotal}'),
              _fila('Subtotal refacciones', '\$${ticket.totals.partsSubtotal}'),
              _fila('Total', '\$${ticket.totals.total}', destacado: true),
            ]),

            _seccion('Pago', [
              if (pago == null)
                const Text(
                  'Sin pago',
                  style: TextStyle(fontWeight: FontWeight.w600),
                )
              else ...[
                Row(
                  children: [
                    Expanded(
                      child: Text(
                        'Método: ${pago.etiquetaMetodo}',
                        style: const TextStyle(fontWeight: FontWeight.w600),
                      ),
                    ),
                    EstadoPagoChip(status: pago.status),
                  ],
                ),
                const SizedBox(height: AppSpacing.xs),
                Text(
                  'Importe cobrado: \$${pago.amount}',
                  style: const TextStyle(
                    fontSize: 13,
                    color: AppColors.textSecondary,
                  ),
                ),
              ],
            ]),

            SizedBox(
              width: double.infinity,
              child: FilledButton.icon(
                onPressed:
                    _imprimiendo ? null : () => _imprimir(ticket),
                icon: _imprimiendo
                    ? const SizedBox(
                        width: 16,
                        height: 16,
                        child: CircularProgressIndicator(strokeWidth: 2),
                      )
                    : const Icon(Icons.print_outlined),
                label: const Text('Imprimir'),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _seccion(String titulo, List<Widget> filas) {
    return Padding(
      padding: const EdgeInsets.only(bottom: AppSpacing.lg),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            titulo,
            style: const TextStyle(
              fontWeight: FontWeight.w700,
              color: AppColors.primary,
            ),
          ),
          const SizedBox(height: AppSpacing.sm),
          ...filas,
        ],
      ),
    );
  }

  /// Fila «etiqueta — valor» del comprobante.
  Widget _fila(String etiqueta, String valor, {bool destacado = false}) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: AppSpacing.xs),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          if (etiqueta.isEmpty)
            const Expanded(child: SizedBox.shrink())
          else
            Expanded(
              child: Text(
                etiqueta,
                style: TextStyle(
                  color: destacado
                      ? AppColors.textPrimary
                      : AppColors.textSecondary,
                  fontWeight: destacado ? FontWeight.w700 : FontWeight.w400,
                ),
              ),
            ),
          Flexible(
            child: Text(
              valor,
              textAlign: TextAlign.right,
              style: TextStyle(
                fontWeight: destacado ? FontWeight.w700 : FontWeight.w600,
                fontSize: destacado ? 16 : 14,
              ),
            ),
          ),
        ],
      ),
    );
  }

  /// Fila con concepto, detalle en letra chica y subtotal a la derecha.
  Widget _filaConcepto(String concepto, String detalle, String subtotal) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: AppSpacing.xs),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(concepto, style: const TextStyle(fontWeight: FontWeight.w600)),
                const SizedBox(height: 2),
                Text(
                  detalle,
                  style: const TextStyle(
                    fontSize: 12,
                    color: AppColors.textSecondary,
                  ),
                ),
              ],
            ),
          ),
          Text(
            subtotal,
            style: const TextStyle(fontWeight: FontWeight.w600),
          ),
        ],
      ),
    );
  }

  // ── PDF en memoria (CA-5) ──────────────────────────────────────────────

  List<pw.Widget> _contenidoPdf(Ticket ticket) {
    pw.Widget titulo(String texto) => pw.Padding(
          padding: const pw.EdgeInsets.only(top: 14, bottom: 4),
          child: pw.Text(
            texto,
            style: const pw.TextStyle(fontWeight: pw.FontWeight.bold, fontSize: 12),
          ),
        );
    pw.Widget linea(String izquierda, String derecha) => pw.Padding(
          padding: const pw.EdgeInsets.symmetric(vertical: 2),
          child: pw.Row(
            children: [
              pw.Expanded(child: pw.Text(izquierda)),
              pw.Text(derecha),
            ],
          ),
        );

    final pago = ticket.payment;

    return [
      pw.Center(
        child: pw.Text(
          'Ticket de servicio',
          style: const pw.TextStyle(fontWeight: pw.FontWeight.bold, fontSize: 16),
        ),
      ),
      pw.Center(child: pw.Text(ticket.folio)),
      pw.Center(child: pw.Text(ticket.workshop.name)),
      pw.SizedBox(height: 8),
      pw.Text(ticket.createdAt ?? ''),
      titulo('Cliente'),
      linea(ticket.client.name, ticket.client.phone ?? ''),
      titulo('Vehículo'),
      linea(ticket.vehicle.label, ticket.vehicle.licensePlate),
      linea('Kilometraje de entrada', '${ticket.vehicle.entryMileage} km'),
      if (ticket.services.isNotEmpty) ...[
        titulo('Servicios'),
        for (final servicio in ticket.services)
          linea(servicio.description, '\$${servicio.unitPrice}'),
      ],
      if (ticket.labor.isNotEmpty) ...[
        titulo('Mano de obra'),
        for (final trabajo in ticket.labor)
          linea(
            '${trabajo.concept} (${trabajo.hours} h × \$${trabajo.hourlyRate})',
            '\$${trabajo.subtotal}',
          ),
      ],
      if (ticket.parts.isNotEmpty) ...[
        titulo('Refacciones'),
        for (final parte in ticket.parts)
          linea(
            '${parte.name} (${parte.partCode} × ${parte.quantity})',
            '\$${parte.subtotal}',
          ),
      ],
      titulo('Totales'),
      linea('Subtotal servicios', '\$${ticket.totals.servicesSubtotal}'),
      linea('Subtotal mano de obra', '\$${ticket.totals.laborSubtotal}'),
      linea('Subtotal refacciones', '\$${ticket.totals.partsSubtotal}'),
      pw.Padding(
        padding: const pw.EdgeInsets.symmetric(vertical: 4),
        child: pw.Row(
          children: [
            pw.Expanded(
              child: pw.Text(
                'Total',
                style: const pw.TextStyle(fontWeight: pw.FontWeight.bold),
              ),
            ),
            pw.Text(
              '\$${ticket.totals.total}',
              style: const pw.TextStyle(fontWeight: pw.FontWeight.bold),
            ),
          ],
        ),
      ),
      titulo('Pago'),
      pago == null
          ? pw.Text('Sin pago')
          : pw.Text(
              '${pago.etiquetaMetodo} · ${pago.etiquetaEstado} · \$${pago.amount}',
            ),
    ];
  }
}
