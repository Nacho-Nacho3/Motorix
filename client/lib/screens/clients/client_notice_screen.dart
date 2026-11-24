import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../models/client_notice.dart';
import '../../providers/client_notices_provider.dart';
import '../../utils/app_theme.dart';
import '../../widgets/states_view.dart';

/// Clientes por avisar (Sprint 6, US7, CA-7, CA-10, CA-11, FR-010).
/// El sistema no envía mensajes: muestra a quién llamar y por qué hecho, y
/// «Ya lo hablé» registra quién avisó y cuándo para no repetir el aviso.
/// Solo ADMIN y recepción llegan a esta pantalla (el backend niega al mecánico).
class ClientNoticeScreen extends StatefulWidget {
  const ClientNoticeScreen({super.key});

  @override
  State<ClientNoticeScreen> createState() => _ClientNoticeScreenState();
}

class _ClientNoticeScreenState extends State<ClientNoticeScreen> {
  @override
  void initState() {
    super.initState();
    // Se carga tras el primer frame para no notificar durante la construcción.
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (mounted) context.read<ClientNoticesProvider>().cargar();
    });
  }

  /// Pide la nota opcional (D-07, máx. 300) y registra el aviso. Devuelve
  /// null si se cancela el diálogo.
  Future<void> _marcarAvisado(ClientNotice aviso) async {
    final proveedor = context.read<ClientNoticesProvider>();
    final mensajero = ScaffoldMessenger.of(context);
    final nota = await showDialog<String>(
      context: context,
      builder: (_) => _DialogoNota(aviso: aviso),
    );
    if (nota == null || !mounted) return;

    final registrado = await proveedor.marcarAvisado(aviso, nota: nota);
    if (!registrado) {
      mensajero.showSnackBar(
        SnackBar(
          content: Text(
            proveedor.errorAccion ?? 'No se pudo registrar el aviso.',
          ),
        ),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    final proveedor = context.watch<ClientNoticesProvider>();

    return Scaffold(
      backgroundColor: AppColors.background,
      body: Padding(
        padding: const EdgeInsets.all(AppSpacing.xl),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Row(
              children: [
                Expanded(
                  child: Text(
                    'Clientes por avisar',
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: Theme.of(context).textTheme.titleMedium,
                  ),
                ),
                const SizedBox(width: AppSpacing.md),
                Text(
                  'Total: ${proveedor.avisos.length}',
                  style: const TextStyle(color: AppColors.textSecondary),
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

  Widget _contenido(ClientNoticesProvider proveedor) {
    if (proveedor.cargando) {
      return const LoadingView(mensaje: 'Cargando clientes por avisar…');
    }
    if (proveedor.error != null) {
      return ErrorView(
        mensaje: proveedor.error!,
        onReintentar: proveedor.reintentar,
      );
    }
    if (proveedor.avisos.isEmpty) {
      return const EmptyView(
        icono: Icons.phone_in_talk_outlined,
        mensaje: 'No hay clientes por avisar.',
      );
    }

    return ListView.separated(
      itemCount: proveedor.avisos.length,
      separatorBuilder: (_, _) => const SizedBox(height: AppSpacing.md),
      itemBuilder: (context, indice) {
        final aviso = proveedor.avisos[indice];
        return _TarjetaAviso(
          aviso: aviso,
          onAvisado: () => _marcarAvisado(aviso),
        );
      },
    );
  }
}

/// Un cliente por avisar: nombre, teléfono, motivo, contexto y la acción.
class _TarjetaAviso extends StatelessWidget {
  const _TarjetaAviso({required this.aviso, required this.onAvisado});

  final ClientNotice aviso;
  final VoidCallback onAvisado;

  Color get _color => switch (aviso.motive) {
        'MAINTENANCE_OVERDUE' => AppColors.danger,
        'MAINTENANCE_UPCOMING' => AppColors.warning,
        'ORDER_READY' => AppColors.success,
        _ => AppColors.primary,
      };

  @override
  Widget build(BuildContext context) {
    final tema = Theme.of(context).textTheme;

    return Container(
      padding: const EdgeInsets.all(AppSpacing.lg),
      decoration: BoxDecoration(
        color: AppColors.surface,
        border: Border.all(color: AppColors.outline),
        borderRadius: BorderRadius.circular(AppRadii.panel),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Wrap(
                  spacing: AppSpacing.md,
                  runSpacing: AppSpacing.xs,
                  crossAxisAlignment: WrapCrossAlignment.center,
                  children: [
                    Text(
                      aviso.clientName,
                      style: tema.titleSmall
                          ?.copyWith(fontWeight: FontWeight.w600),
                    ),
                    Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        const Icon(
                          Icons.phone_outlined,
                          size: 16,
                          color: AppColors.textSecondary,
                        ),
                        const SizedBox(width: AppSpacing.xs),
                        Text(aviso.phone),
                      ],
                    ),
                  ],
                ),
                const SizedBox(height: AppSpacing.sm),
                Container(
                  padding: const EdgeInsets.symmetric(
                    horizontal: AppSpacing.sm,
                    vertical: AppSpacing.xs,
                  ),
                  decoration: BoxDecoration(
                    color: _color.withValues(alpha: 0.14),
                    borderRadius: BorderRadius.circular(AppRadii.pill),
                  ),
                  child: Text(
                    aviso.motiveLabel,
                    style: tema.bodySmall?.copyWith(
                      color: _color,
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                ),
                const SizedBox(height: AppSpacing.sm),
                Text(
                  aviso.detail,
                  style: const TextStyle(color: AppColors.textSecondary),
                ),
              ],
            ),
          ),
          const SizedBox(width: AppSpacing.md),
          OutlinedButton.icon(
            onPressed: onAvisado,
            icon: const Icon(Icons.check, size: 18),
            label: const Text('Ya lo hablé'),
          ),
        ],
      ),
    );
  }
}

/// Diálogo con la nota opcional (D-07, máx. 300 caracteres). Devuelve el
/// texto (vacío si no escribió nada) o null si se cancela.
class _DialogoNota extends StatefulWidget {
  const _DialogoNota({required this.aviso});

  final ClientNotice aviso;

  @override
  State<_DialogoNota> createState() => _DialogoNotaState();
}

class _DialogoNotaState extends State<_DialogoNota> {
  final _notaCtrl = TextEditingController();

  @override
  void dispose() {
    _notaCtrl.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return AlertDialog(
      title: const Text('Marcar como avisado'),
      content: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            '${widget.aviso.clientName} · ${widget.aviso.motiveLabel}',
            style: const TextStyle(color: AppColors.textSecondary),
          ),
          const SizedBox(height: AppSpacing.md),
          TextField(
            controller: _notaCtrl,
            maxLength: 300,
            maxLines: 3,
            decoration: const InputDecoration(
              labelText: 'Nota (opcional)',
              hintText: 'Ej. Ya lo llamé, pasa el viernes.',
            ),
          ),
        ],
      ),
      actions: [
        TextButton(
          onPressed: () => Navigator.of(context).pop(),
          child: const Text('Cancelar'),
        ),
        ElevatedButton(
          onPressed: () => Navigator.of(context).pop(_notaCtrl.text.trim()),
          child: const Text('Registrar aviso'),
        ),
      ],
    );
  }
}
