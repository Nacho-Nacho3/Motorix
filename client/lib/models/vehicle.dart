/// Modelo de vehículo (contrato: contracts/vehicles.md → data.vehicles[]).
class Vehicle {
  const Vehicle({
    required this.id,
    required this.brand,
    required this.model,
    required this.year,
    required this.licensePlate,
    this.vin,
    required this.currentMileage,
    this.clientId,
    this.clientName,
  });

  final int id;
  final String brand;
  final String model;
  final int year;
  final String licensePlate;
  final String? vin;
  final int currentMileage;
  final int? clientId;
  final String? clientName;

  factory Vehicle.fromJson(Map<String, dynamic> json) => Vehicle(
        id: (json['id'] as num).toInt(),
        brand: json['brand'] as String,
        model: json['model'] as String,
        year: (json['year'] as num).toInt(),
        licensePlate: json['licensePlate'] as String,
        vin: json['vin'] as String?,
        currentMileage: (json['currentMileage'] as num?)?.toInt() ?? 0,
        clientId: (json['clientId'] as num?)?.toInt(),
        clientName: json['clientName'] as String?,
      );

  Map<String, dynamic> toJson() => {
        'id': id,
        'brand': brand,
        'model': model,
        'year': year,
        'licensePlate': licensePlate,
        'vin': vin,
        'currentMileage': currentMileage,
        if (clientId != null) 'clientId': clientId,
        if (clientName != null) 'clientName': clientName,
      };
}
