import 'payment.dart';

/// Ticket de servicio (contrato: specs/004-pagos-tickets-dashboard/
/// contracts/tickets.md). Todo el contenido lo calcula el backend al
/// servirlo (RN-10): aquí solo se representan las secciones, subtotales y
/// el pago, con importes como cadenas de 2 decimales.
class Ticket {
  const Ticket({
    required this.id,
    required this.folio,
    required this.orderId,
    required this.issuedBy,
    required this.issuedByName,
    this.createdAt,
    required this.workshop,
    required this.client,
    required this.vehicle,
    required this.services,
    required this.labor,
    required this.parts,
    required this.totals,
    this.payment,
  });

  final int id;

  /// Folio único e inalterable derivado del id (FR-011): TCK-000003.
  final String folio;
  final int orderId;
  final int issuedBy;
  final String issuedByName;
  final String? createdAt;
  final TicketTaller workshop;
  final TicketCliente client;
  final TicketVehiculo vehicle;
  final List<TicketServicio> services;
  final List<TicketLabor> labor;
  final List<TicketRefaccion> parts;
  final TicketTotales totals;

  /// Pago `PAID` de la orden; `null` → la interfaz muestra «Sin pago».
  final TicketPago? payment;

  factory Ticket.fromJson(Map<String, dynamic> json) => Ticket(
        id: (json['id'] as num).toInt(),
        folio: json['folio'] as String? ?? '',
        orderId: (json['orderId'] as num).toInt(),
        issuedBy: (json['issuedBy'] as num?)?.toInt() ?? 0,
        issuedByName: json['issuedByName'] as String? ?? '',
        createdAt: json['createdAt'] as String?,
        workshop: TicketTaller.fromJson(
          (json['workshop'] as Map?)?.cast<String, dynamic>() ?? const {},
        ),
        client: TicketCliente.fromJson(
          (json['client'] as Map?)?.cast<String, dynamic>() ?? const {},
        ),
        vehicle: TicketVehiculo.fromJson(
          (json['vehicle'] as Map?)?.cast<String, dynamic>() ?? const {},
        ),
        services: _lista(json['services'], TicketServicio.fromJson),
        labor: _lista(json['labor'], TicketLabor.fromJson),
        parts: _lista(json['parts'], TicketRefaccion.fromJson),
        totals: TicketTotales.fromJson(
          (json['totals'] as Map?)?.cast<String, dynamic>() ?? const {},
        ),
        payment: json['payment'] == null
            ? null
            : TicketPago.fromJson(
                (json['payment'] as Map).cast<String, dynamic>(),
              ),
      );
}

class TicketTaller {
  const TicketTaller({required this.name, this.address, this.phone});

  final String name;
  final String? address;
  final String? phone;

  factory TicketTaller.fromJson(Map<String, dynamic> json) => TicketTaller(
        name: json['name'] as String? ?? '',
        address: json['address'] as String?,
        phone: json['phone'] as String?,
      );
}

class TicketCliente {
  const TicketCliente({required this.id, required this.name, this.phone});

  final int id;
  final String name;
  final String? phone;

  factory TicketCliente.fromJson(Map<String, dynamic> json) => TicketCliente(
        id: (json['id'] as num?)?.toInt() ?? 0,
        name: json['name'] as String? ?? '',
        phone: json['phone'] as String?,
      );
}

class TicketVehiculo {
  const TicketVehiculo({
    required this.id,
    required this.label,
    required this.licensePlate,
    required this.entryMileage,
  });

  final int id;

  /// «Marca modelo año» (CA-4).
  final String label;
  final String licensePlate;
  final int entryMileage;

  factory TicketVehiculo.fromJson(Map<String, dynamic> json) => TicketVehiculo(
        id: (json['id'] as num?)?.toInt() ?? 0,
        label: json['label'] as String? ?? '',
        licensePlate: json['licensePlate'] as String? ?? '',
        entryMileage: (json['entryMileage'] as num?)?.toInt() ?? 0,
      );
}

class TicketServicio {
  const TicketServicio({
    required this.id,
    required this.description,
    required this.unitPrice,
  });

  final int id;
  final String description;
  final String unitPrice;

  factory TicketServicio.fromJson(Map<String, dynamic> json) => TicketServicio(
        id: (json['id'] as num?)?.toInt() ?? 0,
        description: json['description'] as String? ?? '',
        unitPrice: _cadena(json['unitPrice']),
      );
}

class TicketLabor {
  const TicketLabor({
    required this.id,
    required this.concept,
    required this.hours,
    required this.hourlyRate,
    required this.subtotal,
  });

  final int id;
  final String concept;

  /// Horas con 2 decimales («2.00»).
  final String hours;
  final String hourlyRate;
  final String subtotal;

  factory TicketLabor.fromJson(Map<String, dynamic> json) => TicketLabor(
        id: (json['id'] as num?)?.toInt() ?? 0,
        concept: json['concept'] as String? ?? '',
        hours: _cadena(json['hours']),
        hourlyRate: _cadena(json['hourlyRate']),
        subtotal: _cadena(json['subtotal']),
      );
}

class TicketRefaccion {
  const TicketRefaccion({
    required this.id,
    required this.partCode,
    required this.name,
    required this.quantity,
    required this.unitPrice,
    required this.subtotal,
  });

  final int id;
  final String partCode;
  final String name;
  final int quantity;

  /// Precio de venta vigente (R-03).
  final String unitPrice;
  final String subtotal;

  factory TicketRefaccion.fromJson(Map<String, dynamic> json) => TicketRefaccion(
        id: (json['id'] as num?)?.toInt() ?? 0,
        partCode: json['partCode'] as String? ?? '',
        name: json['name'] as String? ?? '',
        quantity: (json['quantity'] as num?)?.toInt() ?? 0,
        unitPrice: _cadena(json['unitPrice']),
        subtotal: _cadena(json['subtotal']),
      );
}

class TicketTotales {
  const TicketTotales({
    required this.servicesSubtotal,
    required this.laborSubtotal,
    required this.partsSubtotal,
    required this.total,
  });

  final String servicesSubtotal;
  final String laborSubtotal;
  final String partsSubtotal;
  final String total;

  factory TicketTotales.fromJson(Map<String, dynamic> json) => TicketTotales(
        servicesSubtotal: _cadena(json['servicesSubtotal']),
        laborSubtotal: _cadena(json['laborSubtotal']),
        partsSubtotal: _cadena(json['partsSubtotal']),
        total: _cadena(json['total']),
      );
}

/// Pago efectivo del comprobante: método e importe en español vía
/// `Payment.etiquetasMetodo`/`etiquetasEstado` (CA-2, FR-003).
class TicketPago {
  const TicketPago({
    required this.method,
    required this.status,
    required this.amount,
  });

  final String method;
  final String status;
  final String amount;

  String get etiquetaMetodo => Payment.etiquetasMetodo[method] ?? method;
  String get etiquetaEstado => Payment.etiquetasEstado[status] ?? status;

  factory TicketPago.fromJson(Map<String, dynamic> json) => TicketPago(
        method: json['method'] as String? ?? '',
        status: json['status'] as String? ?? '',
        amount: _cadena(json['amount']),
      );
}

List<T> _lista<T>(dynamic valor, T Function(Map<String, dynamic>) desde) {
  if (valor is! List) return <T>[];
  return valor
      .map((fila) => desde((fila as Map).cast<String, dynamic>()))
      .toList();
}

String _cadena(dynamic valor) {
  if (valor == null) return '0.00';
  final numero = num.tryParse(valor.toString());
  return numero == null ? '0.00' : numero.toStringAsFixed(2);
}
