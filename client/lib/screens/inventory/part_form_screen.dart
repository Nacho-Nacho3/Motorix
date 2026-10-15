import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../models/part.dart';
import '../../providers/parts_provider.dart';
import '../../services/api_client.dart';
import '../../utils/app_theme.dart';
import '../../widgets/confirm_dialog.dart';

/// Expresión regular de precios del contrato: ≥ 0 con hasta 2 decimales.
final RegExp _precioValido = RegExp(r'^\d+(\.\d{1,2})?$');

/// Alta y edición de refacciones (T053, US5, FR-010, FR-011).
///
/// En modo edición el código y el stock actual quedan de solo lectura:
/// el contrato PATCH no los acepta (R-05, el stock solo cambia con
/// movimientos).
class PartFormScreen extends StatefulWidget {
  const PartFormScreen({super.key, this.parte});

  /// Refacción a editar; `null` = alta nueva.
  final Part? parte;

  @override
  State<PartFormScreen> createState() => _PartFormScreenState();
}

class _PartFormScreenState extends State<PartFormScreen> {
  final _formKey = GlobalKey<FormState>();
  final _codigo = TextEditingController();
  final _nombre = TextEditingController();
  final _categoria = TextEditingController();
  final _marca = TextEditingController();
  final _stockInicial = TextEditingController();
  final _stockMinimo = TextEditingController();
  final _precioCompra = TextEditingController();
  final _precioVenta = TextEditingController();
  bool _guardando = false;
  late final String _fotoInicial;

  bool get _editando => widget.parte != null;

  @override
  void initState() {
    super.initState();
    final parte = widget.parte;
    if (parte != null) {
      _codigo.text = parte.partCode;
      _nombre.text = parte.name;
      _categoria.text = parte.category;
      _marca.text = parte.brand ?? '';
      _stockInicial.text = '${parte.stockCurrent}';
      _stockMinimo.text = '${parte.stockMin}';
      _precioCompra.text = parte.purchasePrice;
      _precioVenta.text = parte.salePrice;
    }
    _fotoInicial = _foto();
  }

  @override
  void dispose() {
    _codigo.dispose();
    _nombre.dispose();
    _categoria.dispose();
    _marca.dispose();
    _stockInicial.dispose();
    _stockMinimo.dispose();
    _precioCompra.dispose();
    _precioVenta.dispose();
    super.dispose();
  }

  String _foto() => [
        _codigo.text,
        _nombre.text,
        _categoria.text,
        _marca.text,
        _stockInicial.text,
        _stockMinimo.text,
        _precioCompra.text,
        _precioVenta.text,
      ].join('');

  bool get _hayCambios => _foto() != _fotoInicial;

  Future<void> _confirmarSalida() async {
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
    if (salir && mounted) Navigator.of(context).pop();
  }

  String? _validarCodigo(String? valor) {
    final texto = (valor ?? '').trim();
    if (texto.isEmpty) return 'El código es obligatorio.';
    if (texto.length > 50) {
      return 'El código no puede superar los 50 caracteres.';
    }
    return null;
  }

  String? _validarNombre(String? valor) {
    final texto = (valor ?? '').trim();
    if (texto.isEmpty) return 'El nombre es obligatorio.';
    if (texto.length > 100) {
      return 'El nombre no puede superar los 100 caracteres.';
    }
    return null;
  }

  String? _validarCategoria(String? valor) {
    final texto = (valor ?? '').trim();
    if (texto.isEmpty) return 'La categoría es obligatoria.';
    if (texto.length > 50) {
      return 'La categoría no puede superar los 50 caracteres.';
    }
    return null;
  }

  String? _validarStockInicial(String? valor) {
    final texto = (valor ?? '').trim();
    if (texto.isEmpty) return null;
    final numero = int.tryParse(texto);
    if (numero == null || numero < 0) {
      return 'El stock inicial debe ser un número entero mayor o igual a cero.';
    }
    return null;
  }

  String? _validarStockMinimo(String? valor) {
    final texto = (valor ?? '').trim();
    if (texto.isEmpty) return 'El stock mínimo es obligatorio.';
    final numero = int.tryParse(texto);
    if (numero == null || numero < 0) {
      return 'El stock mínimo debe ser un número entero mayor o igual a cero.';
    }
    return null;
  }

  String? _validarPrecioCompra(String? valor) {
    final texto = (valor ?? '').trim();
    if (texto.isEmpty) return null;
    if (!_precioValido.hasMatch(texto)) {
      return 'El precio de compra debe ser un número mayor o igual a cero '
          'con hasta 2 decimales.';
    }
    return null;
  }

  String? _validarPrecioVenta(String? valor) {
    final texto = (valor ?? '').trim();
    if (texto.isEmpty) return null;
    if (!_precioValido.hasMatch(texto)) {
      return 'El precio de venta debe ser un número mayor o igual a cero '
          'con hasta 2 decimales.';
    }
    return null;
  }

  Future<void> _guardar() async {
    final formulario = _formKey.currentState;
    if (formulario == null || !formulario.validate()) return;

    final proveedor = context.read<PartsProvider>();
    setState(() => _guardando = true);

    final nombre = _nombre.text.trim();
    final categoria = _categoria.text.trim();
    final marca = _marca.text.trim();
    final stockMinimo = int.tryParse(_stockMinimo.text.trim()) ?? 0;
    final precioCompra = _precioCompra.text.trim();
    final precioVenta = _precioVenta.text.trim();

    ApiError? error;
    if (_editando) {
      error = await proveedor.editar(
        id: widget.parte!.id,
        name: nombre,
        category: categoria,
        brand: marca.isEmpty ? null : marca,
        stockMin: stockMinimo,
        purchasePrice: precioCompra.isEmpty ? null : precioCompra,
        salePrice: precioVenta.isEmpty ? null : precioVenta,
      );
    } else {
      final inicial = int.tryParse(_stockInicial.text.trim());
      error = await proveedor.crear(
        partCode: _codigo.text.trim(),
        name: nombre,
        category: categoria,
        brand: marca.isEmpty ? null : marca,
        stockCurrent: inicial,
        stockMin: stockMinimo,
        purchasePrice: precioCompra.isEmpty ? null : precioCompra,
        salePrice: precioVenta.isEmpty ? null : precioVenta,
      );
    }

    if (!mounted) return;
    setState(() => _guardando = false);

    // Se capturan los controladores antes de usarlos (lint use_build_context_synchronously).
    final mensajero = ScaffoldMessenger.of(context);
    final navegacion = Navigator.of(context);

    if (error != null) {
      mensajero.showSnackBar(SnackBar(content: Text(error.message)));
      return;
    }

    mensajero.showSnackBar(
      SnackBar(
        content: Text(
          _editando ? 'Refacción actualizada' : 'Refacción registrada',
        ),
      ),
    );
    navegacion.pop(true);
  }

  @override
  Widget build(BuildContext context) {
    return PopScope(
      canPop: false,
      onPopInvokedWithResult: (puedePoper, _) {
        if (!puedePoper) _confirmarSalida();
      },
      child: Scaffold(
        backgroundColor: AppColors.background,
        appBar: AppBar(
          title: Text(_editando ? 'Editar refacción' : 'Nueva refacción'),
        ),
        body: SingleChildScrollView(
          padding: const EdgeInsets.all(AppSpacing.xl),
          child: Center(
            child: ConstrainedBox(
              constraints: const BoxConstraints(maxWidth: 680),
              child: Form(
                key: _formKey,
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    TextFormField(
                      controller: _codigo,
                      enabled: !_editando,
                      decoration: InputDecoration(
                        labelText: 'Código',
                        helperText: _editando
                            ? 'El código no se puede modificar.'
                            : 'Ejemplo: BAL-001 (único en el catálogo)',
                      ),
                      validator: _validarCodigo,
                    ),
                    const SizedBox(height: AppSpacing.md),
                    TextFormField(
                      controller: _nombre,
                      decoration: const InputDecoration(
                        labelText: 'Nombre',
                        hintText: 'Balatas traseras',
                      ),
                      validator: _validarNombre,
                    ),
                    const SizedBox(height: AppSpacing.md),
                    TextFormField(
                      controller: _categoria,
                      decoration: const InputDecoration(
                        labelText: 'Categoría',
                        hintText: 'Frenos',
                      ),
                      validator: _validarCategoria,
                    ),
                    const SizedBox(height: AppSpacing.md),
                    TextFormField(
                      controller: _marca,
                      decoration: const InputDecoration(
                        labelText: 'Marca',
                        helperText: 'Opcional',
                      ),
                    ),
                    const SizedBox(height: AppSpacing.md),
                    TextFormField(
                      controller: _stockInicial,
                      enabled: !_editando,
                      keyboardType: TextInputType.number,
                      decoration: InputDecoration(
                        labelText: 'Stock inicial',
                        helperText: _editando
                            ? 'El stock actual se modifica con movimientos.'
                            : 'Opcional; genera el movimiento IN inicial',
                      ),
                      validator: _validarStockInicial,
                    ),
                    const SizedBox(height: AppSpacing.md),
                    TextFormField(
                      controller: _stockMinimo,
                      keyboardType: TextInputType.number,
                      decoration: const InputDecoration(
                        labelText: 'Stock mínimo',
                        helperText: 'A partir de ahí se marca Stock bajo',
                      ),
                      validator: _validarStockMinimo,
                    ),
                    const SizedBox(height: AppSpacing.md),
                    TextFormField(
                      controller: _precioCompra,
                      keyboardType: const TextInputType.numberWithOptions(
                        decimal: true,
                      ),
                      decoration: const InputDecoration(
                        labelText: 'Precio de compra',
                        helperText: 'Opcional; pesos con hasta 2 decimales',
                      ),
                      validator: _validarPrecioCompra,
                    ),
                    const SizedBox(height: AppSpacing.md),
                    TextFormField(
                      controller: _precioVenta,
                      keyboardType: const TextInputType.numberWithOptions(
                        decimal: true,
                      ),
                      decoration: const InputDecoration(
                        labelText: 'Precio de venta',
                        helperText: 'Opcional; pesos con hasta 2 decimales',
                      ),
                      validator: _validarPrecioVenta,
                    ),
                    const SizedBox(height: AppSpacing.xl),
                    ElevatedButton(
                      onPressed: _guardando ? null : _guardar,
                      child: Text(
                        _guardando
                            ? 'Guardando…'
                            : _editando
                                ? 'Guardar cambios'
                                : 'Registrar',
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }
}
