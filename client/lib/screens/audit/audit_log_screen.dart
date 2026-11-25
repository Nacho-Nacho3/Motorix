import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../models/audit_entry.dart';
import '../../providers/audit_provider.dart';
import '../../utils/app_theme.dart';
import '../../widgets/states_view.dart';

/// Bitácora de acciones sensibles (Sprint 7, US10, CA-20, solo ADMIN). Solo
/// lectura: sin acciones de edición ni de borrado.
class AuditLogScreen extends StatefulWidget {
  const AuditLogScreen({super.key});

  @override
  State<AuditLogScreen> createState() => _AuditLogScreenState();
}

class _AuditLogScreenState extends State<AuditLogScreen> {
  final _desde = TextEditingController();
  final _hasta = TextEditingController();
  final _usuario = TextEditingController();
  String? _accion;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (mounted) context.read<AuditProvider>().cargar();
    });
  }

  @override
  void dispose() {
    _desde.dispose();
    _hasta.dispose();
    _usuario.dispose();
    super.dispose();
  }

  String _formato(DateTime dia) =>
      '${dia.year.toString().padLeft(4, '0')}-${dia.month.toString().padLeft(2, '0')}-${dia.day.toString().padLeft(2, '0')}';

  Future<void> _elegirFecha(TextEditingController controlador) async {
    final dia = await showDatePicker(
      context: context,
      initialDate: DateTime.now(),
      firstDate: DateTime(2020),
      lastDate: DateTime(2100),
    );
    if (dia != null && mounted) setState(() => controlador.text = _formato(dia));
  }

  void _aplicar() {
    context.read<AuditProvider>().filtrar(
          desde: _desde.text.isEmpty ? null : _desde.text,
          hasta: _hasta.text.isEmpty ? null : _hasta.text,
          usuarioId: int.tryParse(_usuario.text.trim()),
          accion: _accion,
        );
  }

  void _limpiar() {
    setState(() {
      _desde.clear();
      _hasta.clear();
      _usuario.clear();
      _accion = null;
    });
    context.read<AuditProvider>().limpiarFiltros();
  }

  @override
  Widget build(BuildContext context) {
    final proveedor = context.watch<AuditProvider>();

    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: AppBar(
        title: const Text('Bitácora'),
        actions: [
          IconButton(
            tooltip: 'Actualizar',
            icon: const Icon(Icons.refresh),
            onPressed: proveedor.cargando
                ? null
                : () => proveedor.cargar(page: proveedor.pagina?.page ?? 1),
          ),
        ],
      ),
      body: Padding(
        padding: const EdgeInsets.all(AppSpacing.lg),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            _filtros(proveedor),
            const SizedBox(height: AppSpacing.md),
            Expanded(child: _contenido(proveedor)),
          ],
        ),
      ),
    );
  }

  Widget _filtros(AuditProvider proveedor) {
    return Card(
      color: AppColors.surface,
      child: Padding(
        padding: const EdgeInsets.all(AppSpacing.md),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Wrap(
              spacing: AppSpacing.md,
              runSpacing: AppSpacing.md,
              crossAxisAlignment: WrapCrossAlignment.center,
              children: [
                SizedBox(
                  width: 170,
                  child: TextField(
                    key: const Key('filtro-desde'),
                    controller: _desde,
                    readOnly: true,
                    onTap: () => _elegirFecha(_desde),
                    decoration: const InputDecoration(
                      labelText: 'Desde',
                      hintText: 'YYYY-MM-DD',
                      suffixIcon: Icon(Icons.calendar_month_outlined),
                    ),
                  ),
                ),
                SizedBox(
                  width: 170,
                  child: TextField(
                    key: const Key('filtro-hasta'),
                    controller: _hasta,
                    readOnly: true,
                    onTap: () => _elegirFecha(_hasta),
                    decoration: const InputDecoration(
                      labelText: 'Hasta',
                      hintText: 'YYYY-MM-DD',
                      suffixIcon: Icon(Icons.calendar_month_outlined),
                    ),
                  ),
                ),
                SizedBox(
                  width: 150,
                  child: TextField(
                    key: const Key('filtro-usuario'),
                    controller: _usuario,
                    keyboardType: TextInputType.number,
                    decoration: const InputDecoration(labelText: 'ID de usuario'),
                  ),
                ),
                SizedBox(
                  width: 260,
                  child: DropdownButtonFormField<String?>(
                    key: const Key('filtro-accion'),
                    initialValue: _accion,
                    isExpanded: true,
                    decoration: const InputDecoration(labelText: 'Acción'),
                    items: [
                      const DropdownMenuItem<String?>(
                        value: null,
                        child: Text('Todas'),
                      ),
                      for (final e in AuditEntry.etiquetasDeAccion.entries)
                        DropdownMenuItem<String?>(value: e.key, child: Text(e.value)),
                    ],
                    onChanged: (valor) => setState(() => _accion = valor),
                  ),
                ),
                FilledButton(
                  key: const Key('boton-filtrar'),
                  onPressed: proveedor.cargando ? null : _aplicar,
                  child: const Text('Filtrar'),
                ),
                TextButton(
                  key: const Key('boton-limpiar'),
                  onPressed: proveedor.cargando ? null : _limpiar,
                  child: const Text('Limpiar'),
                ),
              ],
            ),
            if (proveedor.errorFiltros != null) ...[
              const SizedBox(height: AppSpacing.sm),
              Text(
                proveedor.errorFiltros!,
                key: const Key('error-filtros'),
                style: const TextStyle(color: AppColors.danger),
              ),
            ],
          ],
        ),
      ),
    );
  }

  Widget _contenido(AuditProvider proveedor) {
    if (proveedor.pagina == null) {
      if (proveedor.error != null) {
        return ErrorView(mensaje: proveedor.error!, onReintentar: proveedor.cargar);
      }
      return const LoadingView(mensaje: 'Cargando la bitácora…');
    }
    final pagina = proveedor.pagina!;
    if (proveedor.error != null && pagina.items.isEmpty) {
      return ErrorView(mensaje: proveedor.error!, onReintentar: proveedor.cargar);
    }
    if (pagina.items.isEmpty) {
      return const EmptyView(
        mensaje: 'No hay registros con estos filtros.',
        icono: Icons.history_edu_outlined,
      );
    }

    return Column(
      children: [
        Expanded(
          child: Card(
            color: AppColors.surface,
            child: ListView.separated(
              itemCount: pagina.items.length,
              separatorBuilder: (_, _) => const Divider(height: 1),
              itemBuilder: (context, indice) => _fila(pagina.items[indice]),
            ),
          ),
        ),
        const SizedBox(height: AppSpacing.sm),
        Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            Text(
              '${pagina.total} ${pagina.total == 1 ? 'registro' : 'registros'}',
              key: const Key('total-registros'),
              style: const TextStyle(color: AppColors.textSecondary),
            ),
            Row(
              children: [
                IconButton(
                  key: const Key('bitacora-anterior'),
                  tooltip: 'Página anterior',
                  icon: const Icon(Icons.chevron_left),
                  onPressed: pagina.page > 1 && !proveedor.cargando
                      ? () => proveedor.cargar(page: pagina.page - 1)
                      : null,
                ),
                Text('${pagina.page} de ${pagina.totalPaginas}'),
                IconButton(
                  key: const Key('bitacora-siguiente'),
                  tooltip: 'Página siguiente',
                  icon: const Icon(Icons.chevron_right),
                  onPressed: pagina.page < pagina.totalPaginas && !proveedor.cargando
                      ? () => proveedor.cargar(page: pagina.page + 1)
                      : null,
                ),
              ],
            ),
          ],
        ),
      ],
    );
  }

  Widget _fila(AuditEntry entrada) {
    return ListTile(
      key: Key('registro-${entrada.id}'),
      dense: true,
      title: Text(entrada.etiquetaAccion),
      subtitle: Text(
        '${entrada.fechaLegible} · ${entrada.actor} · ${entrada.etiquetaEntidad}'
        '${entrada.detail == null || entrada.detail!.isEmpty ? '' : '\n${entrada.detail}'}',
      ),
      isThreeLine: entrada.detail != null && entrada.detail!.isNotEmpty,
    );
  }
}
