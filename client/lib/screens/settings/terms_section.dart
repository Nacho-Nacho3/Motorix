import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../models/terms.dart';
import '../../providers/terms_provider.dart';
import '../../utils/app_theme.dart';
import '../../widgets/confirm_dialog.dart';
import '../../widgets/states_view.dart';

/// Sección «Términos y condiciones» de Configuración (Sprint 7, US9, FR-021,
/// FR-032, solo ADMIN): muestra la versión vigente, permite editar ambos textos
/// y publicarlos como versión nueva (con confirmación), y lista las
/// aceptaciones y los usuarios pendientes con paginación. Una versión
/// publicada no se edita: cambiar el texto crea otra.
class TermsSection extends StatefulWidget {
  const TermsSection({super.key, required this.onCambios});

  /// Avisa a la pantalla si hay texto editado sin publicar (confirmación al salir).
  final ValueChanged<bool> onCambios;

  @override
  State<TermsSection> createState() => _TermsSectionState();
}

class _TermsSectionState extends State<TermsSection> {
  final _terminos = TextEditingController();
  final _privacidad = TextEditingController();
  String _baseTerminos = '';
  String _basePrivacidad = '';
  int? _versionCargada;

  @override
  void initState() {
    super.initState();
    _terminos.addListener(_avisar);
    _privacidad.addListener(_avisar);
    WidgetsBinding.instance.addPostFrameCallback((_) => _cargar());
  }

  @override
  void dispose() {
    _terminos.dispose();
    _privacidad.dispose();
    super.dispose();
  }

  Future<void> _cargar() async {
    final proveedor = context.read<TermsProvider>();
    await proveedor.cargarVigente();
    await proveedor.cargarAceptaciones();
    if (mounted) _sincronizar(proveedor.vigente);
  }

  /// Carga los textos de la versión vigente como base editable.
  void _sincronizar(TermsVersion? vigente) {
    if (vigente == null || vigente.version == _versionCargada) return;
    _versionCargada = vigente.version;
    _baseTerminos = vigente.termsText;
    _basePrivacidad = vigente.privacyText;
    _terminos.text = vigente.termsText;
    _privacidad.text = vigente.privacyText;
    widget.onCambios(false);
  }

  bool get _sucia =>
      _terminos.text != _baseTerminos || _privacidad.text != _basePrivacidad;

  void _avisar() {
    // Reconstruye para habilitar o deshabilitar «Publicar» según haya cambios.
    if (mounted) setState(() {});
    widget.onCambios(_sucia);
  }

  Future<void> _publicar() async {
    final proveedor = context.read<TermsProvider>();
    final confirmado = await mostrarConfirmacion(
      context,
      titulo: 'Publicar versión nueva',
      mensaje:
          'Se publicará una versión nueva de los términos. Todos los usuarios, incluido tú, '
          'deberán aceptarla en su siguiente operación.',
      textoConfirmar: 'Publicar',
    );
    if (!confirmado || !mounted) return;
    final publicada = await proveedor.publicar(
      termsText: _terminos.text,
      privacyText: _privacidad.text,
    );
    if (!mounted || !publicada) return;
    _versionCargada = null;
    // Recargar dispara el bloqueo si el backend ya exige aceptar la nueva.
    await _cargar();
  }

  @override
  Widget build(BuildContext context) {
    final proveedor = context.watch<TermsProvider>();

    return Card(
      color: AppColors.surface,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(AppRadii.panel),
        side: const BorderSide(color: AppColors.outline),
      ),
      child: Padding(
        padding: const EdgeInsets.all(AppSpacing.xl),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            const Text(
              'Términos y condiciones',
              style: TextStyle(
                fontSize: AppFontSizes.subtitle,
                fontWeight: FontWeight.w600,
                color: AppColors.textPrimary,
              ),
            ),
            const SizedBox(height: AppSpacing.xs),
            ..._contenido(proveedor),
          ],
        ),
      ),
    );
  }

  List<Widget> _contenido(TermsProvider proveedor) {
    final vigente = proveedor.vigente;
    if (vigente == null) {
      if (proveedor.error != null) {
        return [
          SizedBox(
            height: 260,
            child: ErrorView(mensaje: proveedor.error!, onReintentar: _cargar),
          ),
        ];
      }
      return const [
        SizedBox(height: 120, child: LoadingView(mensaje: 'Cargando los términos…')),
      ];
    }

    return [
      Text(
        'Versión vigente: ${vigente.version}. Edita los textos y publica para crear una versión nueva.',
        key: const Key('version-vigente'),
        style: const TextStyle(color: AppColors.textSecondary),
      ),
      const SizedBox(height: AppSpacing.md),
      TextField(
        key: const Key('campo-terminos'),
        controller: _terminos,
        minLines: 4,
        maxLines: 10,
        maxLength: 20000,
        decoration: const InputDecoration(labelText: 'Términos y condiciones'),
      ),
      const SizedBox(height: AppSpacing.md),
      TextField(
        key: const Key('campo-privacidad'),
        controller: _privacidad,
        minLines: 3,
        maxLines: 8,
        maxLength: 20000,
        decoration: const InputDecoration(labelText: 'Aviso de privacidad'),
      ),
      if (proveedor.errorAccion != null)
        Padding(
          padding: const EdgeInsets.only(top: AppSpacing.sm),
          child: Text(
            proveedor.errorAccion!,
            key: const Key('error-publicar-terminos'),
            style: const TextStyle(color: AppColors.danger),
          ),
        ),
      const SizedBox(height: AppSpacing.md),
      Align(
        alignment: Alignment.centerRight,
        child: FilledButton(
          key: const Key('boton-publicar-terminos'),
          onPressed: _sucia ? _publicar : null,
          child: const Text('Publicar versión nueva'),
        ),
      ),
      const Divider(height: AppSpacing.xxl),
      const Text('Aceptaciones', style: TextStyle(fontWeight: FontWeight.w600)),
      const SizedBox(height: AppSpacing.sm),
      _aceptaciones(proveedor),
    ];
  }

  Widget _aceptaciones(TermsProvider proveedor) {
    if (proveedor.cargandoAceptaciones && proveedor.aceptaciones == null) {
      return const SizedBox(
        height: 80,
        child: LoadingView(mensaje: 'Cargando las aceptaciones…'),
      );
    }
    if (proveedor.errorAceptaciones != null && proveedor.aceptaciones == null) {
      return SizedBox(
        height: 260,
        child: ErrorView(
          mensaje: proveedor.errorAceptaciones!,
          onReintentar: proveedor.cargarAceptaciones,
        ),
      );
    }
    final pagina = proveedor.aceptaciones;
    if (pagina == null) return const SizedBox.shrink();

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          'Versión ${pagina.version}: ${pagina.total} ${pagina.total == 1 ? 'aceptación' : 'aceptaciones'}'
          ' y ${pagina.pendingUsers.length} ${pagina.pendingUsers.length == 1 ? 'usuario pendiente' : 'usuarios pendientes'}.',
          key: const Key('resumen-aceptaciones'),
          style: const TextStyle(color: AppColors.textSecondary),
        ),
        const SizedBox(height: AppSpacing.sm),
        if (pagina.items.isEmpty)
          const Text('Nadie ha aceptado esta versión todavía.')
        else
          for (final item in pagina.items)
            ListTile(
              dense: true,
              contentPadding: EdgeInsets.zero,
              leading: const Icon(Icons.check_circle_outline, color: AppColors.success),
              title: Text(item.name),
              subtitle: Text('${item.username} · ${item.acceptedAt ?? ''}'),
            ),
        if (pagina.totalPaginas > 1)
          Row(
            mainAxisAlignment: MainAxisAlignment.end,
            children: [
              IconButton(
                key: const Key('aceptaciones-anterior'),
                tooltip: 'Página anterior',
                icon: const Icon(Icons.chevron_left),
                onPressed: pagina.page > 1
                    ? () => proveedor.cargarAceptaciones(page: pagina.page - 1)
                    : null,
              ),
              Text('${pagina.page} de ${pagina.totalPaginas}'),
              IconButton(
                key: const Key('aceptaciones-siguiente'),
                tooltip: 'Página siguiente',
                icon: const Icon(Icons.chevron_right),
                onPressed: pagina.page < pagina.totalPaginas
                    ? () => proveedor.cargarAceptaciones(page: pagina.page + 1)
                    : null,
              ),
            ],
          ),
        if (pagina.pendingUsers.isNotEmpty) ...[
          const SizedBox(height: AppSpacing.md),
          const Text('Pendientes', style: TextStyle(fontWeight: FontWeight.w600)),
          for (final usuario in pagina.pendingUsers)
            ListTile(
              dense: true,
              contentPadding: EdgeInsets.zero,
              leading: const Icon(Icons.hourglass_empty, color: AppColors.warning),
              title: Text(usuario.name),
              subtitle: Text(usuario.username),
            ),
        ],
      ],
    );
  }
}
