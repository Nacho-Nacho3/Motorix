import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../models/app_settings.dart';
import '../../providers/settings_provider.dart';
import '../../utils/app_theme.dart';
import '../../widgets/confirm_dialog.dart';
import '../../widgets/states_view.dart';
import 'service_types_section.dart';
import 'terms_section.dart';

/// Configuración del taller (Sprint 7, US1, FR-001, FR-017). Solo ADMIN.
///
/// Cada sección es un formulario con su propio estado y avisa a la pantalla
/// si tiene cambios sin guardar; al salir con cambios pendientes se pide
/// confirmación (`PopScope` + `mostrarConfirmacion`, como los formularios
/// existentes). Las secciones de márgenes, tipos de servicio y términos se
/// agregan en sus historias.
class SettingsScreen extends StatefulWidget {
  const SettingsScreen({super.key});

  @override
  State<SettingsScreen> createState() => _SettingsScreenState();
}

class _SettingsScreenState extends State<SettingsScreen> {
  /// Secciones con cambios sin guardar.
  final Set<String> _sucias = {};

  bool get _hayCambios => _sucias.isNotEmpty;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (mounted) context.read<SettingsProvider>().cargar();
    });
  }

  void _marcar(String seccion, bool sucia) {
    final cambio = sucia ? _sucias.add(seccion) : _sucias.remove(seccion);
    if (cambio) setState(() {});
  }

  @override
  Widget build(BuildContext context) {
    final proveedor = context.watch<SettingsProvider>();

    return PopScope(
      canPop: false,
      onPopInvokedWithResult: (didPop, _) async {
        if (didPop || !mounted) return;
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
        if (salir && context.mounted) Navigator.of(context).pop();
      },
      child: Scaffold(
        backgroundColor: AppColors.background,
        appBar: AppBar(
          title: const Text('Configuración'),
          actions: [
            IconButton(
              tooltip: 'Actualizar',
              icon: const Icon(Icons.refresh),
              onPressed: proveedor.cargando ? null : proveedor.cargar,
            ),
          ],
        ),
        body: _cuerpo(proveedor),
      ),
    );
  }

  Widget _cuerpo(SettingsProvider proveedor) {
    if (proveedor.config == null) {
      if (proveedor.error != null) {
        return ErrorView(
          mensaje: proveedor.error!,
          onReintentar: proveedor.cargar,
        );
      }
      return const LoadingView(mensaje: 'Cargando la configuración…');
    }

    final config = proveedor.config!;
    return SingleChildScrollView(
      padding: const EdgeInsets.all(AppSpacing.lg),
      child: Center(
        child: ConstrainedBox(
          constraints: const BoxConstraints(maxWidth: 720),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              FormularioTaller(
                key: ValueKey(
                  '${config.shop.name}|${config.shop.address}|${config.shop.phone}',
                ),
                config: config,
                onCambios: (sucia) => _marcar('taller', sucia),
              ),
              const SizedBox(height: AppSpacing.lg),
              FormularioMargenes(
                key: ValueKey(
                  'm|${config.maintenance.warnDays}|${config.maintenance.warnKm}',
                ),
                config: config,
                onCambios: (sucia) => _marcar('margenes', sucia),
              ),
              const SizedBox(height: AppSpacing.lg),
              const ServiceTypesSection(),
              const SizedBox(height: AppSpacing.lg),
              TermsSection(onCambios: (sucia) => _marcar('terminos', sucia)),
            ],
          ),
        ),
      ),
    );
  }
}

/// Sección «Taller»: nombre, dirección y teléfono (FR-001).
class FormularioTaller extends StatefulWidget {
  const FormularioTaller({
    super.key,
    required this.config,
    required this.onCambios,
  });

  final AppSettings config;
  final ValueChanged<bool> onCambios;

  @override
  State<FormularioTaller> createState() => _FormularioTallerState();
}

class _FormularioTallerState extends State<FormularioTaller> {
  final _formKey = GlobalKey<FormState>();
  late final TextEditingController _nombre;
  late final TextEditingController _direccion;
  late final TextEditingController _telefono;

  @override
  void initState() {
    super.initState();
    final taller = widget.config.shop;
    _nombre = TextEditingController(text: taller.name);
    _direccion = TextEditingController(text: taller.address ?? '');
    _telefono = TextEditingController(text: taller.phone ?? '');
    for (final c in [_nombre, _direccion, _telefono]) {
      c.addListener(_avisarCambios);
    }
  }

  @override
  void dispose() {
    _nombre.dispose();
    _direccion.dispose();
    _telefono.dispose();
    super.dispose();
  }

  bool get _sucia {
    final taller = widget.config.shop;
    return _nombre.text.trim() != taller.name ||
        _direccion.text.trim() != (taller.address ?? '') ||
        _telefono.text.trim() != (taller.phone ?? '');
  }

  void _avisarCambios() {
    context.read<SettingsProvider>().limpiarMensajes();
    widget.onCambios(_sucia);
  }

  void _restablecer() {
    final respaldo = widget.config.defaultShop;
    _nombre.text = respaldo.name;
    _direccion.text = respaldo.address ?? '';
    _telefono.text = respaldo.phone ?? '';
  }

  Future<void> _guardar() async {
    if (!_formKey.currentState!.validate()) return;
    final proveedor = context.read<SettingsProvider>();
    final guardado = await proveedor.guardarTaller(
      nombre: _nombre.text,
      direccion: _direccion.text,
      telefono: _telefono.text,
    );
    if (guardado && mounted) widget.onCambios(false);
  }

  @override
  Widget build(BuildContext context) {
    final proveedor = context.watch<SettingsProvider>();

    return Card(
      color: AppColors.surface,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(AppRadii.panel),
        side: const BorderSide(color: AppColors.outline),
      ),
      child: Padding(
        padding: const EdgeInsets.all(AppSpacing.xl),
        child: Form(
          key: _formKey,
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              const Text(
                'Taller',
                style: TextStyle(
                  fontSize: AppFontSizes.subtitle,
                  fontWeight: FontWeight.w600,
                  color: AppColors.textPrimary,
                ),
              ),
              const SizedBox(height: AppSpacing.xs),
              const Text(
                'Estos datos aparecen en el encabezado de los tickets nuevos. '
                'Los tickets ya emitidos conservan los datos con los que se emitieron.',
                style: TextStyle(color: AppColors.textSecondary),
              ),
              const SizedBox(height: AppSpacing.lg),
              TextFormField(
                key: const Key('campo-nombre-taller'),
                controller: _nombre,
                maxLength: 100,
                decoration: const InputDecoration(labelText: 'Nombre del taller *'),
                validator: (valor) {
                  final texto = (valor ?? '').trim();
                  if (texto.isEmpty) return 'El nombre del taller es obligatorio.';
                  if (texto.length > 100) {
                    return 'El nombre no puede superar los 100 caracteres.';
                  }
                  return null;
                },
              ),
              const SizedBox(height: AppSpacing.md),
              TextFormField(
                key: const Key('campo-direccion-taller'),
                controller: _direccion,
                maxLength: 200,
                decoration: const InputDecoration(labelText: 'Dirección'),
                validator: (valor) => (valor ?? '').trim().length > 200
                    ? 'La dirección no puede superar los 200 caracteres.'
                    : null,
              ),
              const SizedBox(height: AppSpacing.md),
              TextFormField(
                key: const Key('campo-telefono-taller'),
                controller: _telefono,
                maxLength: 30,
                keyboardType: TextInputType.phone,
                decoration: const InputDecoration(labelText: 'Teléfono'),
                validator: (valor) => (valor ?? '').trim().length > 30
                    ? 'El teléfono no puede superar los 30 caracteres.'
                    : null,
              ),
              if (proveedor.errorGuardado != null &&
                  proveedor.seccionGuardada == 'taller') ...[
                const SizedBox(height: AppSpacing.sm),
                Text(
                  proveedor.errorGuardado!,
                  key: const Key('error-guardado-taller'),
                  style: const TextStyle(color: AppColors.danger),
                ),
              ],
              if (proveedor.exito == 'Datos del taller guardados.') ...[
                const SizedBox(height: AppSpacing.sm),
                Text(
                  proveedor.exito!,
                  key: const Key('exito-guardado'),
                  style: const TextStyle(color: AppColors.success),
                ),
              ],
              const SizedBox(height: AppSpacing.lg),
              Row(
                mainAxisAlignment: MainAxisAlignment.end,
                children: [
                  TextButton(
                    key: const Key('boton-restablecer-taller'),
                    onPressed: proveedor.guardando ? null : _restablecer,
                    child: const Text('Restablecer'),
                  ),
                  const SizedBox(width: AppSpacing.sm),
                  FilledButton(
                    key: const Key('boton-guardar-taller'),
                    onPressed: proveedor.guardando ? null : _guardar,
                    child: Text(proveedor.guardando ? 'Guardando…' : 'Guardar'),
                  ),
                ],
              ),
            ],
          ),
        ),
      ),
    );
  }
}

/// Sección «Márgenes de “Próximo”» (US2, FR-003, D-16, D-17): días y
/// kilómetros con los que un mantenimiento pasa a «Próximo». Rige para todo
/// mantenimiento sin antelación propia.
class FormularioMargenes extends StatefulWidget {
  const FormularioMargenes({
    super.key,
    required this.config,
    required this.onCambios,
  });

  final AppSettings config;
  final ValueChanged<bool> onCambios;

  @override
  State<FormularioMargenes> createState() => _FormularioMargenesState();
}

class _FormularioMargenesState extends State<FormularioMargenes> {
  final _formKey = GlobalKey<FormState>();
  late final TextEditingController _dias;
  late final TextEditingController _km;

  @override
  void initState() {
    super.initState();
    _dias = TextEditingController(text: '${widget.config.maintenance.warnDays}');
    _km = TextEditingController(text: '${widget.config.maintenance.warnKm}');
    _dias.addListener(_avisarCambios);
    _km.addListener(_avisarCambios);
  }

  @override
  void dispose() {
    _dias.dispose();
    _km.dispose();
    super.dispose();
  }

  bool get _sucia =>
      _dias.text.trim() != '${widget.config.maintenance.warnDays}' ||
      _km.text.trim() != '${widget.config.maintenance.warnKm}';

  void _avisarCambios() {
    context.read<SettingsProvider>().limpiarMensajes();
    widget.onCambios(_sucia);
  }

  String? _validar(String? valor, String rotulo, int maximo) {
    final texto = (valor ?? '').trim();
    final numero = int.tryParse(texto);
    if (numero == null || numero < 0) {
      return '$rotulo debe ser un número entero mayor o igual a cero.';
    }
    if (numero > maximo) return '$rotulo no puede ser mayor que $maximo.';
    return null;
  }

  void _restablecer() {
    final respaldo = widget.config.defaultMaintenance;
    _dias.text = '${respaldo.warnDays}';
    _km.text = '${respaldo.warnKm}';
  }

  Future<void> _guardar() async {
    if (!_formKey.currentState!.validate()) return;
    final guardado = await context.read<SettingsProvider>().guardarMargenes(
          dias: int.parse(_dias.text.trim()),
          kilometros: int.parse(_km.text.trim()),
        );
    if (guardado && mounted) widget.onCambios(false);
  }

  @override
  Widget build(BuildContext context) {
    final proveedor = context.watch<SettingsProvider>();

    return Card(
      color: AppColors.surface,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(AppRadii.panel),
        side: const BorderSide(color: AppColors.outline),
      ),
      child: Padding(
        padding: const EdgeInsets.all(AppSpacing.xl),
        child: Form(
          key: _formKey,
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              const Text(
                'Márgenes de “Próximo”',
                style: TextStyle(
                  fontSize: AppFontSizes.subtitle,
                  fontWeight: FontWeight.w600,
                  color: AppColors.textPrimary,
                ),
              ),
              const SizedBox(height: AppSpacing.xs),
              const Text(
                'Un mantenimiento pasa a «Próximo» cuando faltan estos días o '
                'kilómetros. Rige para todo mantenimiento sin antelación propia.',
                style: TextStyle(color: AppColors.textSecondary),
              ),
              const SizedBox(height: AppSpacing.lg),
              Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Expanded(
                    child: TextFormField(
                      key: const Key('campo-margen-dias'),
                      controller: _dias,
                      keyboardType: TextInputType.number,
                      decoration: const InputDecoration(
                        labelText: 'Días de antelación',
                        helperText: 'De 0 a 365',
                      ),
                      validator: (valor) =>
                          _validar(valor, 'Los días de antelación', 365),
                    ),
                  ),
                  const SizedBox(width: AppSpacing.lg),
                  Expanded(
                    child: TextFormField(
                      key: const Key('campo-margen-km'),
                      controller: _km,
                      keyboardType: TextInputType.number,
                      decoration: const InputDecoration(
                        labelText: 'Kilómetros de antelación',
                        helperText: 'De 0 a 20,000',
                      ),
                      validator: (valor) =>
                          _validar(valor, 'Los kilómetros de antelación', 20000),
                    ),
                  ),
                ],
              ),
              if (proveedor.errorGuardado != null &&
                  proveedor.seccionGuardada == 'margenes') ...[
                const SizedBox(height: AppSpacing.sm),
                Text(
                  proveedor.errorGuardado!,
                  key: const Key('error-guardado-margenes'),
                  style: const TextStyle(color: AppColors.danger),
                ),
              ],
              if (proveedor.exito == 'Márgenes de mantenimiento guardados.') ...[
                const SizedBox(height: AppSpacing.sm),
                Text(
                  proveedor.exito!,
                  key: const Key('exito-guardado-margenes'),
                  style: const TextStyle(color: AppColors.success),
                ),
              ],
              const SizedBox(height: AppSpacing.lg),
              Row(
                mainAxisAlignment: MainAxisAlignment.end,
                children: [
                  TextButton(
                    key: const Key('boton-restablecer-margenes'),
                    onPressed: proveedor.guardando ? null : _restablecer,
                    child: const Text('Restablecer'),
                  ),
                  const SizedBox(width: AppSpacing.sm),
                  FilledButton(
                    key: const Key('boton-guardar-margenes'),
                    onPressed: proveedor.guardando ? null : _guardar,
                    child: Text(proveedor.guardando ? 'Guardando…' : 'Guardar'),
                  ),
                ],
              ),
            ],
          ),
        ),
      ),
    );
  }
}
