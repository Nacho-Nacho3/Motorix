import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../models/order_item.dart';
import '../../models/payment.dart';
import '../../models/service_order.dart';
import '../../providers/parts_provider.dart';
import '../../providers/payments_provider.dart';
import '../../providers/service_orders_provider.dart';
import '../../providers/session_provider.dart';
import '../../utils/app_route.dart';
import '../../utils/app_theme.dart';
import '../../widgets/confirm_dialog.dart';
import '../../widgets/estado_orden_chip.dart';
import '../../widgets/estado_pago_chip.dart';
import '../../widgets/states_view.dart';
import '../payments/payment_form_screen.dart';
import '../tickets/ticket_screen.dart';

/// Detalle de la orden (T047/T062, CA-4): lectura de los datos y del trabajo
/// registrado, con altas de diagnóstico, servicios y mano de obra en línea
/// para ADMIN y el mecánico asignado (R-06); bajas con confirmación (8.5).
class OrderDetailScreen extends StatefulWidget {
  const OrderDetailScreen({super.key, required this.orden});

  final ServiceOrder orden;

  @override
  State<OrderDetailScreen> createState() => _OrderDetailScreenState();
}

class _OrderDetailScreenState extends State<OrderDetailScreen> {
  final _formDiagnosticoKey = GlobalKey<FormState>();
  final _formServicioKey = GlobalKey<FormState>();
  final _formManoDeObraKey = GlobalKey<FormState>();
  final _formNotasKey = GlobalKey<FormState>();

  late final TextEditingController _diagnosticoCtrl;
  final _descripcionCtrl = TextEditingController();
  final _precioCtrl = TextEditingController();
  final _conceptoCtrl = TextEditingController();
  final _horasCtrl = TextEditingController();
  final _tarifaCtrl = TextEditingController();
  final _observacionesCtrl = TextEditingController();
  final _recomendacionesCtrl = TextEditingController();

  bool _mostrarFormDiagnostico = false;
  bool _mostrarFormServicio = false;
  bool _mostrarFormManoDeObra = false;
  bool _mostrarFormNotas = false;
  bool _guardando = false;
  String? _estadoSeleccionado;

  // T072: sección «Refacciones» (US7, CA-5, RN-6).
  final _cantidadRefaccionCtrl = TextEditingController();
  int? _parteSeleccionada;
  bool _guardandoRefaccion = false;

  @override
  void initState() {
    super.initState();
    _diagnosticoCtrl = TextEditingController(text: widget.orden.diagnosis);
    // Se carga tras el primer frame para no notificar durante la construcción.
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!mounted) return;
      context.read<ServiceOrdersProvider>()
        ..cargarDetalle(widget.orden.id)
        ..cargarRefacciones(widget.orden.id);
      // Catálogo para el selector de refacciones (US7); si ya estaba
      // cargado desde Inventario se reutiliza sin volver a pedirlo.
      final partes = context.read<PartsProvider>();
      if (partes.refacciones.isEmpty) partes.cargar();
      // Historial de cobros de la orden (US1); el mecánico no consulta
      // pagos porque el backend responde 403 (RN-15, matriz R-08).
      if (_puedeVerPagos()) {
        context.read<PaymentsProvider>().listarPagos(widget.orden.id);
      }
    });
  }

  @override
  void dispose() {
    _diagnosticoCtrl.dispose();
    _descripcionCtrl.dispose();
    _precioCtrl.dispose();
    _conceptoCtrl.dispose();
    _horasCtrl.dispose();
    _tarifaCtrl.dispose();
    _observacionesCtrl.dispose();
    _recomendacionesCtrl.dispose();
    _cantidadRefaccionCtrl.dispose();
    super.dispose();
  }

  /// R-06: el trabajo lo registran ADMIN o el mecánico de la orden.
  bool _puedeTrabajar(ServiceOrder orden) {
    final usuario = context.read<SessionProvider>().usuario;
    if (usuario == null) return false;
    if (usuario.role == 'ADMIN') return true;
    if (usuario.role == 'MECHANIC') return orden.mechanicId == usuario.id;
    return false;
  }

  /// Espejo de la máquina del backend (R-02, Q1): solo avance lineal, sin
  /// salidas de DELIVERED; WAITING_PART solo sale hacia el origen (US6).
  static const Map<String, List<String>> _transiciones = {
    'RECEIVED': ['DIAGNOSIS'],
    'DIAGNOSIS': ['IN_REPAIR', 'WAITING_PART'],
    'IN_REPAIR': ['FINISHED', 'WAITING_PART'],
    'WAITING_PART': [],
    'FINISHED': ['DELIVERED'],
    'DELIVERED': [],
  };

  List<String> _opcionesDeEstado(ServiceOrder orden) {
    if (orden.status == 'WAITING_PART') {
      final origen = orden.waitingOrigin;
      return origen == null ? const [] : [origen];
    }
    return _transiciones[orden.status] ?? const [];
  }

  Future<void> _cambiarEstado(ServiceOrder orden) async {
    final destino = _estadoSeleccionado;
    if (destino == null) {
      _aviso('Selecciona el estado al que quieres pasar la orden.');
      return;
    }
    final etiqueta = ServiceOrder.etiquetas[destino] ?? destino;
    // Entregar es irreversible (CA-8): se confirma como acción peligrosa.
    final confirmar = await mostrarConfirmacion(
      context,
      titulo: 'Cambiar estado',
      mensaje: '¿Pasar la orden a "$etiqueta"?',
      esPeligrosa: destino == 'DELIVERED',
    );
    if (!confirmar || !mounted) return;

    setState(() => _guardando = true);
    final error = await context
        .read<ServiceOrdersProvider>()
        .cambiarEstado(orden.id, destino);
    if (!mounted) return;
    setState(() {
      _guardando = false;
      if (error == null) _estadoSeleccionado = null;
    });

    if (error != null) {
      _aviso(error.message);
      return;
    }
    _aviso('Estado actualizado');
  }

  void _aviso(String mensaje) {
    ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(mensaje)));
  }

  @override
  Widget build(BuildContext context) {
    final proveedor = context.watch<ServiceOrdersProvider>();

    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: AppBar(title: const Text('Detalle de la orden')),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(AppSpacing.xl),
        child: Center(
          child: ConstrainedBox(
            constraints: const BoxConstraints(maxWidth: 720),
            child: _contenido(proveedor),
          ),
        ),
      ),
    );
  }

  Widget _contenido(ServiceOrdersProvider proveedor) {
    if (proveedor.cargandoDetalle) {
      return const LoadingView(mensaje: 'Cargando la orden…');
    }
    if (proveedor.errorDetalle != null) {
      return ErrorView(
        mensaje: proveedor.errorDetalle!,
        onReintentar: () => context
            .read<ServiceOrdersProvider>()
            .cargarDetalle(widget.orden.id),
      );
    }

    final orden = proveedor.ordenDetalle ?? widget.orden;
    final puedeTrabajar = _puedeTrabajar(orden);
    final opciones = _opcionesDeEstado(orden);
    final valorEstado =
        opciones.contains(_estadoSeleccionado) ? _estadoSeleccionado : null;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        _tarjetaResumen(orden, puedeTrabajar, opciones, valorEstado),
        const SizedBox(height: AppSpacing.lg),
        _tarjetaDatos(orden),
        const SizedBox(height: AppSpacing.lg),
        _tarjetaTexto('Problema reportado', orden.reportedProblem),
        const SizedBox(height: AppSpacing.lg),
        _tarjetaDiagnostico(orden, puedeTrabajar),
        const SizedBox(height: AppSpacing.lg),
        _tarjetaNotas(orden, puedeTrabajar),
        const SizedBox(height: AppSpacing.lg),
        _tarjetaServicios(orden, proveedor.servicios, puedeTrabajar),
        const SizedBox(height: AppSpacing.lg),
        _tarjetaRefacciones(orden, proveedor),
        const SizedBox(height: AppSpacing.lg),
        _tarjetaManoDeObra(orden, proveedor.manoDeObra, puedeTrabajar),
        const SizedBox(height: AppSpacing.lg),
        _tarjetaPago(orden),
      ],
    );
  }

  /// RN-15 (matriz R-08): la información de pagos es de ADMIN y RECEPTIONIST;
  /// el mecánico no ve cobros ni consulta el historial.
  bool _puedeVerPagos() {
    final usuario = context.read<SessionProvider>().usuario;
    return usuario != null && usuario.role != 'MECHANIC';
  }

  /// US1/T020: sección «Pago» con el estado de cobro actual, el historial y
  /// la acción de cobrar para órdenes terminadas o entregadas (VN-02) que
  /// aún no tienen un pago efectivo (VN-04, Q1).
  Widget _tarjetaPago(ServiceOrder orden) {
    if (!_puedeVerPagos()) return const SizedBox.shrink();

    final proveedor = context.watch<PaymentsProvider>();
    final cobrable =
        orden.status == 'FINISHED' || orden.status == 'DELIVERED';
    final yaPagado = proveedor.pagos.any((pago) => pago.status == 'PAID');

    Widget cuerpo;
    if (proveedor.cargandoPagos) {
      cuerpo = const Padding(
        padding: EdgeInsets.symmetric(vertical: AppSpacing.lg),
        child: LoadingView(mensaje: 'Cargando pagos…'),
      );
    } else if (proveedor.errorPagos != null) {
      cuerpo = Padding(
        padding: const EdgeInsets.symmetric(vertical: AppSpacing.lg),
        child: ErrorView(
          mensaje: proveedor.errorPagos!,
          onReintentar: () => proveedor.listarPagos(orden.id),
        ),
      );
    } else if (proveedor.pagos.isEmpty) {
      cuerpo = const Padding(
        padding: EdgeInsets.symmetric(vertical: AppSpacing.lg),
        child: EmptyView(
          mensaje: 'Sin pago',
          icono: Icons.receipt_long_outlined,
        ),
      );
    } else {
      cuerpo = Column(
        children: [for (final pago in proveedor.pagos) _filaPago(pago)],
      );
    }

    return Card(
      child: Padding(
        padding: const EdgeInsets.all(AppSpacing.lg),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                const Icon(Icons.payments_outlined,
                    size: 20, color: AppColors.primary),
                const SizedBox(width: AppSpacing.sm),
                const Expanded(
                  child: Text(
                    'Pago',
                    style: TextStyle(fontWeight: FontWeight.w600),
                  ),
                ),
                // Estado de cobro actual: el pago más reciente primero.
                if (proveedor.pagos.isNotEmpty)
                  EstadoPagoChip(status: proveedor.pagos.first.status),
              ],
            ),
            const SizedBox(height: AppSpacing.md),
            cuerpo,
            if (cobrable && !yaPagado) ...[
              const SizedBox(height: AppSpacing.md),
              SizedBox(
                width: double.infinity,
                child: ElevatedButton.icon(
                  onPressed: () => _abrirFormularioPago(orden),
                  icon: const Icon(Icons.payments_outlined),
                  label: const Text('Registrar pago'),
                ),
              ),
            ],
            // US3/T040: comprobante con folio único (CA-5); la orden debe
            // estar terminada o entregada porque el ticket exige esos estados.
            if (cobrable) ...[
              const SizedBox(height: AppSpacing.sm),
              SizedBox(
                width: double.infinity,
                child: OutlinedButton.icon(
                  onPressed: () => _abrirTicket(orden),
                  icon: const Icon(Icons.receipt_long_outlined),
                  label: const Text('Generar / Ver ticket'),
                ),
              ),
            ],
          ],
        ),
      ),
    );
  }

  /// Fila del historial de cobros (más recientes primero, contrato).
  Widget _filaPago(Payment pago) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: AppSpacing.sm),
      child: Row(
        children: [
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  '${pago.etiquetaMetodo} · \$${pago.amount}',
                  style: const TextStyle(fontWeight: FontWeight.w600),
                ),
                const SizedBox(height: 2),
                Text(
                  pago.createdAt ?? '',
                  style: const TextStyle(
                    fontSize: 12,
                    color: AppColors.textSecondary,
                  ),
                ),
              ],
            ),
          ),
          EstadoPagoChip(status: pago.status),
        ],
      ),
    );
  }

  /// Abre el formulario de cobro y refresca el historial al volver para
  /// mostrar el pago recién registrado (CA-1).
  Future<void> _abrirFormularioPago(ServiceOrder orden) async {
    await Navigator.of(context).push(
      AppRoute(builder: (_) => PaymentFormScreen(orderId: orden.id)),
    );
    if (!mounted) return;
    if (_puedeVerPagos()) {
      context.read<PaymentsProvider>().listarPagos(orden.id);
    }
  }

  /// Abre el comprobante (US3): el POST idempotente del ticket devuelve el
  /// mismo folio al reabrirlo (FR-011, CA-5).
  Future<void> _abrirTicket(ServiceOrder orden) async {
    await Navigator.of(context).push(
      AppRoute(builder: (_) => TicketScreen(orderId: orden.id)),
    );
  }

  /// US7: solo el mecánico de la orden agrega refacciones, y nunca una
  /// orden ya entregada (Q5, RN-6, RN-9; el backend revalida igual).
  bool _puedeAgregarRefacciones(ServiceOrder orden) {
    final usuario = context.read<SessionProvider>().usuario;
    return usuario != null &&
        usuario.role == 'MECHANIC' &&
        orden.mechanicId == usuario.id &&
        orden.status != 'DELIVERED';
  }

  Future<void> _agregarRefaccion() async {
    final parteId = _parteSeleccionada;
    if (parteId == null) {
      _aviso('Selecciona la refacción que vas a usar.');
      return;
    }
    final cantidad = int.tryParse(_cantidadRefaccionCtrl.text.trim());
    if (cantidad == null || cantidad <= 0) {
      _aviso('La cantidad debe ser un número entero mayor que cero.');
      return;
    }

    final orderId = widget.orden.id;
    setState(() => _guardandoRefaccion = true);
    final error = await context
        .read<ServiceOrdersProvider>()
        .agregarRefaccionOrden(orderId, partId: parteId, quantity: cantidad);
    if (!mounted) return;
    setState(() => _guardandoRefaccion = false);

    if (error != null) {
      // STOCK_INSUFFICIENT / ORDER_DELIVERED llegan ya traducidos (CA-5).
      _aviso(error.message);
      return;
    }
    _cantidadRefaccionCtrl.clear();
    _aviso('Refacción agregada a la orden.');
  }

  /// Refacciones utilizadas en la orden (CA-5): la lista es de lectura para
  /// los tres roles y el alta inline (selector + cantidad) solo aparece para
  /// el mecánico dueño de la orden.
  Widget _tarjetaRefacciones(
    ServiceOrder orden,
    ServiceOrdersProvider proveedor,
  ) {
    final catalogo = context.watch<PartsProvider>().refacciones;
    final puedeAgregar = _puedeAgregarRefacciones(orden);

    return Card(
      child: Padding(
        padding: const EdgeInsets.all(AppSpacing.lg),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Text(
              'Refacciones',
              style: Theme.of(context).textTheme.titleMedium,
            ),
            const SizedBox(height: AppSpacing.md),
            if (puedeAgregar) ...[
              Row(
                children: [
                  Expanded(
                    child: DropdownButtonFormField<int>(
                      initialValue: _parteSeleccionada,
                      hint: const Text('Refacción'),
                      isExpanded: true,
                      items: [
                        for (final parte in catalogo)
                          DropdownMenuItem(
                            value: parte.id,
                            child: Text(
                              '${parte.partCode} · ${parte.name}',
                              overflow: TextOverflow.ellipsis,
                            ),
                          ),
                      ],
                      onChanged: (valor) =>
                          setState(() => _parteSeleccionada = valor),
                    ),
                  ),
                  const SizedBox(width: AppSpacing.md),
                  SizedBox(
                    width: 96,
                    child: TextFormField(
                      controller: _cantidadRefaccionCtrl,
                      keyboardType: TextInputType.number,
                      decoration: const InputDecoration(
                        labelText: 'Cantidad',
                        isDense: true,
                      ),
                    ),
                  ),
                  const SizedBox(width: AppSpacing.md),
                  ElevatedButton(
                    onPressed: _guardandoRefaccion ? null : _agregarRefaccion,
                    child: Text(
                      _guardandoRefaccion ? 'Guardando…' : 'Agregar',
                    ),
                  ),
                ],
              ),
              const SizedBox(height: AppSpacing.md),
            ],
            if (proveedor.cargandoRefacciones)
              const Text(
                'Cargando refacciones…',
                style: TextStyle(color: AppColors.textSecondary),
              )
            else if (proveedor.errorRefacciones != null)
              Text(
                proveedor.errorRefacciones!,
                style: const TextStyle(color: AppColors.danger),
              )
            else if (proveedor.refacciones.isEmpty)
              const Text(
                'Sin refacciones registradas.',
                style: TextStyle(color: AppColors.textSecondary),
              )
            else
              for (final uso in proveedor.refacciones)
                Padding(
                  padding: const EdgeInsets.symmetric(
                    vertical: AppSpacing.xs,
                  ),
                  child: Text(
                    '${uso.partCode} · ${uso.name} · ${uso.quantity} uds',
                  ),
                ),
          ],
        ),
      ),
    );
  }

  /// Resumen de la orden + control de estado (T068): el desplegable solo
  /// ofrece las transiciones válidas y el rol lo ve si puede trabajar.
  Widget _tarjetaResumen(
    ServiceOrder orden,
    bool puedeTrabajar,
    List<String> opciones,
    String? valorEstado,
  ) {
    final mostrarControl = puedeTrabajar && opciones.isNotEmpty;

    return Card(
      child: Padding(
        padding: const EdgeInsets.all(AppSpacing.lg),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Expanded(
                  child: Text(
                    '${orden.clientName} · ${orden.vehicleLabel}',
                    style: Theme.of(context).textTheme.titleMedium,
                  ),
                ),
                EstadoOrdenChip(status: orden.status),
              ],
            ),
            if (mostrarControl) ...[
              const SizedBox(height: AppSpacing.md),
              Row(
                children: [
                  SizedBox(
                    width: 260,
                    child: InputDecorator(
                      decoration: const InputDecoration(
                        labelText: 'Siguiente estado',
                      ),
                      child: DropdownButton<String>(
                        value: valorEstado,
                        isExpanded: true,
                        underline: const SizedBox.shrink(),
                        items: [
                          for (final opcion in opciones)
                            DropdownMenuItem(
                              value: opcion,
                              child: Text(
                                ServiceOrder.etiquetas[opcion] ?? opcion,
                              ),
                            ),
                        ],
                        onChanged: _guardando
                            ? null
                            : (valor) =>
                                setState(() => _estadoSeleccionado = valor),
                      ),
                    ),
                  ),
                  const SizedBox(width: AppSpacing.md),
                  ElevatedButton(
                    onPressed:
                        _guardando ? null : () => _cambiarEstado(orden),
                    child: _guardando
                        ? const SizedBox(
                            width: 18,
                            height: 18,
                            child: CircularProgressIndicator(
                              strokeWidth: 2,
                              color: Colors.white,
                            ),
                          )
                        : const Text('Cambiar estado'),
                  ),
                ],
              ),
            ],
          ],
        ),
      ),
    );
  }

  Widget _tarjetaDatos(ServiceOrder orden) {
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(AppSpacing.lg),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            _fila(Icons.person_outline, 'Cliente', orden.clientName),
            _fila(
              Icons.directions_car_outlined,
              'Vehículo',
              orden.vehicleLabel,
            ),
            _fila(
              Icons.handyman_outlined,
              'Mecánico asignado',
              orden.mechanicName,
            ),
            _fila(
              Icons.speed_outlined,
              'Kilometraje de entrada',
              '${orden.entryMileage} km',
            ),
            if (orden.mileageCorrectionReason != null &&
                orden.mileageCorrectionReason!.isNotEmpty)
              _fila(
                Icons.rule_outlined,
                'Motivo de la corrección del kilometraje',
                orden.mileageCorrectionReason!,
              ),
          ],
        ),
      ),
    );
  }

  Widget _tarjetaDiagnostico(ServiceOrder orden, bool puedeTrabajar) {
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(AppSpacing.lg),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                const Expanded(
                  child: Text(
                    'Diagnóstico',
                    style: TextStyle(fontWeight: FontWeight.w600),
                  ),
                ),
                if (puedeTrabajar)
                  TextButton(
                    onPressed: _guardando
                        ? null
                        : () => setState(() {
                              _mostrarFormDiagnostico = !_mostrarFormDiagnostico;
                              if (_mostrarFormDiagnostico) {
                                _diagnosticoCtrl.text = orden.diagnosis ?? '';
                              }
                            }),
                    child: Text(
                      _mostrarFormDiagnostico
                          ? 'Cancelar'
                          : (orden.diagnosis == null ||
                                  orden.diagnosis!.isEmpty
                              ? 'Registrar diagnóstico'
                              : 'Editar diagnóstico'),
                    ),
                  ),
              ],
            ),
            if (!_mostrarFormDiagnostico)
              Text(
                (orden.diagnosis == null || orden.diagnosis!.isEmpty)
                    ? 'Aún no se registra el diagnóstico.'
                    : orden.diagnosis!,
              )
            else ...[
              Form(
                key: _formDiagnosticoKey,
                child: TextFormField(
                  controller: _diagnosticoCtrl,
                  maxLines: 3,
                  decoration: const InputDecoration(
                    labelText: 'Diagnóstico *',
                    alignLabelWithHint: true,
                    helperText: 'Hasta 1000 caracteres.',
                  ),
                  validator: (valor) {
                    final texto = valor?.trim() ?? '';
                    if (texto.isEmpty) {
                      return 'El diagnóstico no puede quedar vacío.';
                    }
                    if (texto.length > 1000) {
                      return 'El diagnóstico no puede superar los 1000 caracteres.';
                    }
                    return null;
                  },
                ),
              ),
              const SizedBox(height: AppSpacing.md),
              Row(
                mainAxisAlignment: MainAxisAlignment.end,
                children: [
                  TextButton(
                    onPressed: _guardando
                        ? null
                        : () => setState(() => _mostrarFormDiagnostico = false),
                    child: const Text('Cancelar'),
                  ),
                  const SizedBox(width: AppSpacing.sm),
                  ElevatedButton(
                    onPressed:
                        _guardando ? null : () => _guardarDiagnostico(orden),
                    child: _guardando
                        ? const SizedBox(
                            width: 18,
                            height: 18,
                            child: CircularProgressIndicator(
                              strokeWidth: 2,
                              color: Colors.white,
                            ),
                          )
                        : const Text('Guardar diagnóstico'),
                  ),
                ],
              ),
            ],
          ],
        ),
      ),
    );
  }

  /// Observaciones y recomendaciones (T073, US7): lectura con edición en
  /// línea para ADMIN y el mecánico asignado (R-06) y validación en español.
  Widget _tarjetaNotas(ServiceOrder orden, bool puedeTrabajar) {
    final conObservaciones =
        orden.observations != null && orden.observations!.isNotEmpty;
    final conRecomendaciones =
        orden.recommendations != null && orden.recommendations!.isNotEmpty;
    final conNotas = conObservaciones || conRecomendaciones;

    return Card(
      child: Padding(
        padding: const EdgeInsets.all(AppSpacing.lg),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                const Icon(
                  Icons.edit_note_outlined,
                  size: 20,
                  color: AppColors.primary,
                ),
                const SizedBox(width: AppSpacing.sm),
                const Expanded(
                  child: Text(
                    'Observaciones y recomendaciones',
                    style: TextStyle(fontWeight: FontWeight.w600),
                  ),
                ),
                if (puedeTrabajar)
                  TextButton(
                    onPressed: _guardando
                        ? null
                        : () => setState(() {
                              _mostrarFormNotas = !_mostrarFormNotas;
                              if (_mostrarFormNotas) {
                                _observacionesCtrl.text =
                                    orden.observations ?? '';
                                _recomendacionesCtrl.text =
                                    orden.recommendations ?? '';
                              }
                            }),
                    child: Text(
                      _mostrarFormNotas
                          ? 'Cancelar'
                          : (conNotas ? 'Editar notas' : 'Registrar notas'),
                    ),
                  ),
              ],
            ),
            if (!_mostrarFormNotas) ...[
              if (!conNotas)
                const Text('Sin observaciones ni recomendaciones.')
              else ...[
                if (conObservaciones) ...[
                  const Text(
                    'Observaciones',
                    style: TextStyle(fontWeight: FontWeight.w600),
                  ),
                  const SizedBox(height: AppSpacing.xs),
                  Text(orden.observations!),
                  if (conRecomendaciones)
                    const SizedBox(height: AppSpacing.md),
                ],
                if (conRecomendaciones) ...[
                  const Text(
                    'Recomendaciones',
                    style: TextStyle(fontWeight: FontWeight.w600),
                  ),
                  const SizedBox(height: AppSpacing.xs),
                  Text(orden.recommendations!),
                ],
              ],
            ] else ...[
              const SizedBox(height: AppSpacing.md),
              Form(
                key: _formNotasKey,
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    TextFormField(
                      controller: _observacionesCtrl,
                      maxLines: 3,
                      decoration: const InputDecoration(
                        labelText: 'Observaciones',
                        alignLabelWithHint: true,
                        helperText:
                            'Hasta 1000 caracteres. Si lo dejas vacío, se conserva el valor guardado.',
                      ),
                      validator: (valor) => _validarNota(
                        valor,
                        _recomendacionesCtrl.text,
                        'Las observaciones',
                      ),
                    ),
                    const SizedBox(height: AppSpacing.md),
                    TextFormField(
                      controller: _recomendacionesCtrl,
                      maxLines: 3,
                      decoration: const InputDecoration(
                        labelText: 'Recomendaciones',
                        alignLabelWithHint: true,
                        helperText:
                            'Hasta 1000 caracteres. Si lo dejas vacío, se conserva el valor guardado.',
                      ),
                      validator: (valor) => _validarNota(
                        valor,
                        _observacionesCtrl.text,
                        'Las recomendaciones',
                      ),
                    ),
                  ],
                ),
              ),
              const SizedBox(height: AppSpacing.md),
              Row(
                mainAxisAlignment: MainAxisAlignment.end,
                children: [
                  TextButton(
                    onPressed: _guardando
                        ? null
                        : () => setState(() => _mostrarFormNotas = false),
                    child: const Text('Cancelar'),
                  ),
                  const SizedBox(width: AppSpacing.sm),
                  ElevatedButton(
                    onPressed:
                        _guardando ? null : () => _guardarNotas(orden),
                    child: _guardando
                        ? const SizedBox(
                            width: 18,
                            height: 18,
                            child: CircularProgressIndicator(
                              strokeWidth: 2,
                              color: Colors.white,
                            ),
                          )
                        : const Text('Guardar notas'),
                  ),
                ],
              ),
            ],
          ],
        ),
      ),
    );
  }

  /// Validación en español de una nota: hasta 1000 caracteres y, entre las
  /// dos, al menos una con contenido (mínimo del backend).
  String? _validarNota(String? valor, String otra, String etiqueta) {
    final texto = valor?.trim() ?? '';
    if (texto.isEmpty && otra.trim().isEmpty) {
      return 'Guarda al menos una observación o una recomendación.';
    }
    if (texto.length > 1000) {
      return '$etiqueta no pueden superar los 1000 caracteres.';
    }
    return null;
  }

  Future<void> _guardarNotas(ServiceOrder orden) async {
    final form = _formNotasKey.currentState;
    if (form == null || !form.validate()) return;

    setState(() => _guardando = true);
    final error = await context.read<ServiceOrdersProvider>().guardarNotas(
          orden.id,
          observations: _observacionesCtrl.text.trim(),
          recommendations: _recomendacionesCtrl.text.trim(),
        );
    if (!mounted) return;
    setState(() {
      _guardando = false;
      if (error == null) _mostrarFormNotas = false;
    });

    if (error != null) {
      _aviso(error.message);
      return;
    }
    _aviso('Notas guardadas');
  }

  Widget _tarjetaServicios(
    ServiceOrder orden,
    List<ServiceOrderItem> servicios,
    bool puedeTrabajar,
  ) {
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(AppSpacing.lg),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                const Icon(Icons.build_outlined,
                    size: 20, color: AppColors.primary),
                const SizedBox(width: AppSpacing.sm),
                const Expanded(
                  child: Text(
                    'Servicios realizados',
                    style: TextStyle(fontWeight: FontWeight.w600),
                  ),
                ),
                if (puedeTrabajar)
                  TextButton.icon(
                    onPressed: _guardando
                        ? null
                        : () => setState(() {
                              _mostrarFormServicio = !_mostrarFormServicio;
                              if (_mostrarFormServicio) {
                                _descripcionCtrl.clear();
                                _precioCtrl.clear();
                              }
                            }),
                    icon: const Icon(Icons.add),
                    label: const Text('Agregar servicio'),
                  ),
              ],
            ),
            if (servicios.isEmpty && !_mostrarFormServicio)
              const Text('Sin servicios registrados.')
            else
              for (final servicio in servicios)
                Padding(
                  padding: const EdgeInsets.symmetric(vertical: AppSpacing.xs),
                  child: Row(
                    children: [
                      Expanded(
                        child: Text(
                          '${servicio.description} · \$${servicio.unitPrice.toStringAsFixed(2)}',
                        ),
                      ),
                      if (puedeTrabajar)
                        IconButton(
                          tooltip: 'Eliminar servicio',
                          icon: const Icon(Icons.delete_outline,
                              color: AppColors.danger),
                          onPressed: _guardando
                              ? null
                              : () => _eliminarServicio(orden, servicio),
                        ),
                    ],
                  ),
                ),
            if (_mostrarFormServicio) ...[
              const SizedBox(height: AppSpacing.md),
              Form(
                key: _formServicioKey,
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    TextFormField(
                      controller: _descripcionCtrl,
                      decoration: const InputDecoration(
                        labelText: 'Descripción del servicio *',
                      ),
                      validator: (valor) {
                        final texto = valor?.trim() ?? '';
                        if (texto.isEmpty) {
                          return 'La descripción del servicio es obligatoria.';
                        }
                        if (texto.length > 200) {
                          return 'La descripción del servicio no puede superar los 200 caracteres.';
                        }
                        return null;
                      },
                    ),
                    const SizedBox(height: AppSpacing.md),
                    TextFormField(
                      controller: _precioCtrl,
                      keyboardType: const TextInputType.numberWithOptions(
                        decimal: true,
                      ),
                      decoration: const InputDecoration(
                        labelText: 'Precio unitario (opcional)',
                        prefixText: '\$',
                      ),
                      validator: (valor) {
                        final texto = valor?.trim() ?? '';
                        if (texto.isEmpty) return null;
                        final numero = double.tryParse(texto);
                        if (numero == null) {
                          return 'El precio unitario debe ser un número.';
                        }
                        if (numero < 0) {
                          return 'El precio unitario no puede ser negativo.';
                        }
                        return null;
                      },
                    ),
                  ],
                ),
              ),
              const SizedBox(height: AppSpacing.md),
              Row(
                mainAxisAlignment: MainAxisAlignment.end,
                children: [
                  TextButton(
                    onPressed: _guardando
                        ? null
                        : () => setState(() => _mostrarFormServicio = false),
                    child: const Text('Cancelar'),
                  ),
                  const SizedBox(width: AppSpacing.sm),
                  ElevatedButton(
                    onPressed:
                        _guardando ? null : () => _guardarServicio(orden),
                    child: const Text('Guardar servicio'),
                  ),
                ],
              ),
            ],
          ],
        ),
      ),
    );
  }

  Widget _tarjetaManoDeObra(
    ServiceOrder orden,
    List<LaborOrderItem> manoDeObra,
    bool puedeTrabajar,
  ) {
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(AppSpacing.lg),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                const Icon(Icons.engineering_outlined,
                    size: 20, color: AppColors.primary),
                const SizedBox(width: AppSpacing.sm),
                const Expanded(
                  child: Text(
                    'Mano de obra',
                    style: TextStyle(fontWeight: FontWeight.w600),
                  ),
                ),
                if (puedeTrabajar)
                  TextButton.icon(
                    onPressed: _guardando
                        ? null
                        : () => setState(() {
                              _mostrarFormManoDeObra = !_mostrarFormManoDeObra;
                              if (_mostrarFormManoDeObra) {
                                _conceptoCtrl.clear();
                                _horasCtrl.clear();
                                _tarifaCtrl.clear();
                              }
                            }),
                    icon: const Icon(Icons.add),
                    label: const Text('Agregar mano de obra'),
                  ),
              ],
            ),
            if (manoDeObra.isEmpty && !_mostrarFormManoDeObra)
              const Text('Sin mano de obra registrada.')
            else
              for (final trabajo in manoDeObra)
                Padding(
                  padding: const EdgeInsets.symmetric(vertical: AppSpacing.xs),
                  child: Row(
                    children: [
                      Expanded(
                        child: Text(
                          '${trabajo.concept} · ${trabajo.hours} h · '
                          '\$${trabajo.hourlyRate.toStringAsFixed(2)}/h',
                        ),
                      ),
                      if (puedeTrabajar)
                        IconButton(
                          tooltip: 'Eliminar mano de obra',
                          icon: const Icon(Icons.delete_outline,
                              color: AppColors.danger),
                          onPressed: _guardando
                              ? null
                              : () => _eliminarManoDeObra(orden, trabajo),
                        ),
                    ],
                  ),
                ),
            if (_mostrarFormManoDeObra) ...[
              const SizedBox(height: AppSpacing.md),
              Form(
                key: _formManoDeObraKey,
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    TextFormField(
                      controller: _conceptoCtrl,
                      decoration: const InputDecoration(
                        labelText: 'Concepto *',
                      ),
                      validator: (valor) {
                        final texto = valor?.trim() ?? '';
                        if (texto.isEmpty) {
                          return 'El concepto de mano de obra es obligatorio.';
                        }
                        if (texto.length > 200) {
                          return 'El concepto de mano de obra no puede superar los 200 caracteres.';
                        }
                        return null;
                      },
                    ),
                    const SizedBox(height: AppSpacing.md),
                    TextFormField(
                      controller: _horasCtrl,
                      keyboardType: const TextInputType.numberWithOptions(
                        decimal: true,
                      ),
                      decoration: const InputDecoration(
                        labelText: 'Horas *',
                        helperText: 'Mayores a 0 y hasta 999.99.',
                      ),
                      validator: (valor) {
                        final texto = valor?.trim() ?? '';
                        if (texto.isEmpty) {
                          return 'Las horas de mano de obra son obligatorias.';
                        }
                        final numero = double.tryParse(texto);
                        if (numero == null) {
                          return 'Las horas deben ser un número.';
                        }
                        if (numero <= 0) {
                          return 'Las horas deben ser mayores a 0.';
                        }
                        if (numero > 999.99) {
                          return 'Las horas no pueden superar las 999.99.';
                        }
                        return null;
                      },
                    ),
                    const SizedBox(height: AppSpacing.md),
                    TextFormField(
                      controller: _tarifaCtrl,
                      keyboardType: const TextInputType.numberWithOptions(
                        decimal: true,
                      ),
                      decoration: const InputDecoration(
                        labelText: 'Tarifa por hora (opcional)',
                        prefixText: '\$',
                      ),
                      validator: (valor) {
                        final texto = valor?.trim() ?? '';
                        if (texto.isEmpty) return null;
                        final numero = double.tryParse(texto);
                        if (numero == null) {
                          return 'La tarifa por hora debe ser un número.';
                        }
                        if (numero < 0) {
                          return 'La tarifa por hora no puede ser negativa.';
                        }
                        return null;
                      },
                    ),
                  ],
                ),
              ),
              const SizedBox(height: AppSpacing.md),
              Row(
                mainAxisAlignment: MainAxisAlignment.end,
                children: [
                  TextButton(
                    onPressed: _guardando
                        ? null
                        : () => setState(() => _mostrarFormManoDeObra = false),
                    child: const Text('Cancelar'),
                  ),
                  const SizedBox(width: AppSpacing.sm),
                  ElevatedButton(
                    onPressed:
                        _guardando ? null : () => _guardarManoDeObra(orden),
                    child: const Text('Guardar mano de obra'),
                  ),
                ],
              ),
            ],
          ],
        ),
      ),
    );
  }

  Future<void> _guardarDiagnostico(ServiceOrder orden) async {
    final form = _formDiagnosticoKey.currentState;
    if (form == null || !form.validate()) return;

    setState(() => _guardando = true);
    final error = await context
        .read<ServiceOrdersProvider>()
        .guardarDiagnostico(orden.id, _diagnosticoCtrl.text.trim());
    if (!mounted) return;
    setState(() {
      _guardando = false;
      if (error == null) _mostrarFormDiagnostico = false;
    });

    if (error != null) {
      _aviso(error.message);
      return;
    }
    _aviso('Diagnóstico guardado');
  }

  Future<void> _guardarServicio(ServiceOrder orden) async {
    final form = _formServicioKey.currentState;
    if (form == null || !form.validate()) return;

    setState(() => _guardando = true);
    final textoPrecio = _precioCtrl.text.trim();
    final error = await context.read<ServiceOrdersProvider>().agregarServicio(
          orden.id,
          description: _descripcionCtrl.text.trim(),
          unitPrice: textoPrecio.isEmpty ? null : double.parse(textoPrecio),
        );
    if (!mounted) return;
    setState(() {
      _guardando = false;
      if (error == null) _mostrarFormServicio = false;
    });

    if (error != null) {
      _aviso(error.message);
      return;
    }
    _aviso('Servicio agregado');
  }

  Future<void> _eliminarServicio(
    ServiceOrder orden,
    ServiceOrderItem servicio,
  ) async {
    final confirmar = await mostrarConfirmacion(
      context,
      titulo: 'Eliminar servicio',
      mensaje: '¿Eliminar el servicio "${servicio.description}" de la orden?',
      esPeligrosa: true,
    );
    if (!confirmar || !mounted) return;

    final error = await context
        .read<ServiceOrdersProvider>()
        .eliminarServicio(orden.id, servicio.id);
    if (!mounted) return;
    if (error != null) {
      _aviso(error.message);
      return;
    }
    _aviso('Servicio eliminado');
  }

  Future<void> _guardarManoDeObra(ServiceOrder orden) async {
    final form = _formManoDeObraKey.currentState;
    if (form == null || !form.validate()) return;

    setState(() => _guardando = true);
    final textoTarifa = _tarifaCtrl.text.trim();
    final error = await context.read<ServiceOrdersProvider>().agregarManoDeObra(
          orden.id,
          concept: _conceptoCtrl.text.trim(),
          hours: double.parse(_horasCtrl.text.trim()),
          hourlyRate: textoTarifa.isEmpty ? null : double.parse(textoTarifa),
        );
    if (!mounted) return;
    setState(() {
      _guardando = false;
      if (error == null) _mostrarFormManoDeObra = false;
    });

    if (error != null) {
      _aviso(error.message);
      return;
    }
    _aviso('Mano de obra agregada');
  }

  Future<void> _eliminarManoDeObra(
    ServiceOrder orden,
    LaborOrderItem trabajo,
  ) async {
    final confirmar = await mostrarConfirmacion(
      context,
      titulo: 'Eliminar mano de obra',
      mensaje: '¿Eliminar la mano de obra "${trabajo.concept}" de la orden?',
      esPeligrosa: true,
    );
    if (!confirmar || !mounted) return;

    final error = await context
        .read<ServiceOrdersProvider>()
        .eliminarManoDeObra(orden.id, trabajo.id);
    if (!mounted) return;
    if (error != null) {
      _aviso(error.message);
      return;
    }
    _aviso('Mano de obra eliminada');
  }

  Widget _fila(IconData icono, String etiqueta, String valor) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: AppSpacing.xs),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Icon(icono, size: 20, color: AppColors.primary),
          const SizedBox(width: AppSpacing.md),
          SizedBox(
            width: 210,
            child: Text(
              etiqueta,
              style: const TextStyle(fontWeight: FontWeight.w600),
            ),
          ),
          Expanded(child: Text(valor)),
        ],
      ),
    );
  }

  Widget _tarjetaTexto(String titulo, String contenido) {
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(AppSpacing.lg),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(titulo, style: const TextStyle(fontWeight: FontWeight.w600)),
            const SizedBox(height: AppSpacing.sm),
            Text(contenido),
          ],
        ),
      ),
    );
  }
}
