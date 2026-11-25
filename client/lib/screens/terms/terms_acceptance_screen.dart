import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../providers/session_provider.dart';
import '../../providers/terms_provider.dart';
import '../../utils/app_theme.dart';
import '../../widgets/confirm_dialog.dart';
import '../../widgets/states_view.dart';

/// Pantalla de aceptación de los términos y del aviso de privacidad (Sprint 7,
/// US9, FR-018 a FR-020, CA-16). Se muestra en lugar del shell mientras el
/// usuario no haya aceptado la versión vigente, al iniciar sesión o a mitad de
/// una sesión si se publica una versión nueva (sin cerrar la sesión).
class TermsAcceptanceScreen extends StatefulWidget {
  const TermsAcceptanceScreen({super.key});

  @override
  State<TermsAcceptanceScreen> createState() => _TermsAcceptanceScreenState();
}

class _TermsAcceptanceScreenState extends State<TermsAcceptanceScreen> {
  /// Compartido por la barra y la lista: en escritorio una lista no usa el
  /// PrimaryScrollController y la barra fallaría sin un controlador propio.
  final _desplazamiento = ScrollController();

  @override
  void dispose() {
    _desplazamiento.dispose();
    super.dispose();
  }

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (mounted) context.read<TermsProvider>().cargarVigente();
    });
  }

  Future<void> _aceptar() async {
    final terminos = context.read<TermsProvider>();
    final sesion = context.read<SessionProvider>();
    final aceptada = await terminos.aceptar();
    if (!mounted) return;
    if (aceptada) sesion.marcarTerminosAceptados();
  }

  Future<void> _rechazar() async {
    final terminos = context.read<TermsProvider>();
    final sesion = context.read<SessionProvider>();
    final confirmado = await mostrarConfirmacion(
      context,
      titulo: 'No aceptar los términos',
      mensaje:
          'Sin aceptar los términos y el aviso de privacidad no puedes usar el sistema. Se cerrará tu sesión.',
      textoConfirmar: 'Cerrar sesión',
      esPeligrosa: true,
    );
    if (!confirmado || !mounted) return;
    await terminos.rechazar();
    await sesion.cerrarSesion();
  }

  @override
  Widget build(BuildContext context) {
    final proveedor = context.watch<TermsProvider>();

    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: AppBar(
        automaticallyImplyLeading: false,
        title: const Text('Términos y condiciones'),
      ),
      body: _cuerpo(proveedor),
    );
  }

  Widget _cuerpo(TermsProvider proveedor) {
    final vigente = proveedor.vigente;
    if (vigente == null) {
      if (proveedor.error != null) {
        return ErrorView(
          mensaje: proveedor.error!,
          onReintentar: proveedor.cargarVigente,
        );
      }
      return const LoadingView(mensaje: 'Cargando los términos…');
    }

    return Center(
      child: ConstrainedBox(
        constraints: const BoxConstraints(maxWidth: 820),
        child: Padding(
          padding: const EdgeInsets.all(AppSpacing.lg),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Text(
                'Versión ${vigente.version}',
                key: const Key('version-terminos'),
                style: const TextStyle(color: AppColors.textSecondary),
              ),
              const SizedBox(height: AppSpacing.sm),
              const Text(
                'Para usar Motorix debes leer y aceptar los términos y condiciones y el aviso de privacidad.',
              ),
              const SizedBox(height: AppSpacing.md),
              Expanded(
                child: Card(
                  color: AppColors.surface,
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(AppRadii.panel),
                    side: const BorderSide(color: AppColors.outline),
                  ),
                  child: Scrollbar(
                    controller: _desplazamiento,
                    child: SingleChildScrollView(
                      controller: _desplazamiento,
                      padding: const EdgeInsets.all(AppSpacing.lg),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          SelectableText(
                            vigente.termsText,
                            key: const Key('texto-terminos'),
                          ),
                          const SizedBox(height: AppSpacing.xl),
                          SelectableText(
                            vigente.privacyText,
                            key: const Key('texto-privacidad'),
                          ),
                        ],
                      ),
                    ),
                  ),
                ),
              ),
              if (proveedor.errorAccion != null) ...[
                const SizedBox(height: AppSpacing.sm),
                Text(
                  proveedor.errorAccion!,
                  key: const Key('error-aceptar-terminos'),
                  style: const TextStyle(color: AppColors.danger),
                ),
              ],
              const SizedBox(height: AppSpacing.md),
              Row(
                mainAxisAlignment: MainAxisAlignment.end,
                children: [
                  TextButton(
                    key: const Key('boton-no-acepto'),
                    onPressed: proveedor.aceptando ? null : _rechazar,
                    child: const Text('No acepto'),
                  ),
                  const SizedBox(width: AppSpacing.sm),
                  FilledButton(
                    key: const Key('boton-acepto'),
                    onPressed: proveedor.aceptando ? null : _aceptar,
                    child: Text(proveedor.aceptando ? 'Guardando…' : 'Acepto'),
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
