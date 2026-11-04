/// Elemento del lookup del selector de refacciones (US5, H-10).
/// Contrato: specs/005-precios-refacciones-cobro/contracts/parts-catalog.md.
///
/// El mecánico elige piezas sin recibir ningún precio (FR-010, D-10): este
/// modelo ni siquiera tiene campos de precio, así que ninguna interfaz puede
/// mostrar uno por error.
class PartLookup {
  const PartLookup({
    required this.id,
    required this.partCode,
    required this.name,
    required this.category,
    this.brand,
    required this.stockCurrent,
    required this.stockMin,
  });

  final int id;
  final String partCode;
  final String name;
  final String category;
  final String? brand;
  final int stockCurrent;
  final int stockMin;

  factory PartLookup.fromJson(Map<String, dynamic> json) => PartLookup(
        id: (json['id'] as num).toInt(),
        partCode: json['partCode'] as String? ?? '',
        name: json['name'] as String? ?? '',
        category: json['category'] as String? ?? '',
        brand: json['brand'] as String?,
        stockCurrent: (json['stockCurrent'] as num?)?.toInt() ?? 0,
        stockMin: (json['stockMin'] as num?)?.toInt() ?? 0,
      );
}
