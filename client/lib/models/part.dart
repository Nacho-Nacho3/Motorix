/// Modelo de refacción del catálogo
/// (contrato: specs/003-historial-mantenimiento-inventario/contracts/inventory.md).
class Part {
  const Part({
    required this.id,
    required this.partCode,
    required this.name,
    required this.category,
    this.brand,
    required this.stockCurrent,
    required this.stockMin,
    required this.purchasePrice,
    required this.salePrice,
    required this.lowStock,
    this.updatedAt,
  });

  final int id;
  final String partCode;
  final String name;
  final String category;
  final String? brand;
  final int stockCurrent;
  final int stockMin;

  /// Precios como cadena decimal con 2 decimales (T049, contrato).
  final String purchasePrice;
  final String salePrice;

  /// Calculado en el backend: stockCurrent <= stockMin (CA-7).
  final bool lowStock;
  final String? updatedAt;

  factory Part.fromJson(Map<String, dynamic> json) => Part(
        id: (json['id'] as num).toInt(),
        partCode: json['partCode'] as String? ?? '',
        name: json['name'] as String? ?? '',
        category: json['category'] as String? ?? '',
        brand: json['brand'] as String?,
        stockCurrent: (json['stockCurrent'] as num?)?.toInt() ?? 0,
        stockMin: (json['stockMin'] as num?)?.toInt() ?? 0,
        purchasePrice: _decimales(json['purchasePrice']),
        salePrice: _decimales(json['salePrice']),
        lowStock: json['lowStock'] as bool? ?? false,
        updatedAt: json['updatedAt'] as String?,
      );

  /// Cuerpo del alta según el contrato (sin campos calculados).
  Map<String, dynamic> toJson() => {
        'partCode': partCode,
        'name': name,
        'category': category,
        if (brand != null && brand!.isNotEmpty) 'brand': brand,
        'stockCurrent': stockCurrent,
        'stockMin': stockMin,
        'purchasePrice': purchasePrice,
        'salePrice': salePrice,
      };

  static String _decimales(dynamic valor) {
    if (valor == null) return '0.00';
    final numero = num.tryParse(valor.toString());
    return numero == null ? '0.00' : numero.toStringAsFixed(2);
  }
}
