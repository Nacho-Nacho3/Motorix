import 'dart:convert';
import 'dart:io';

import 'package:flutter_test/flutter_test.dart';

import 'package:motorix_client/services/api_client.dart';
import 'package:motorix_client/utils/report_saver.dart';

// El CSV debe llegar a Excel con la marca UTF-8 (BOM) para conservar acentos,
// aunque la decodificación de la respuesta la haya descartado.
void main() {
  test('el contenido que se guarda conserva la marca UTF-8 de la descarga real', () async {
    final servidor = await HttpServer.bind('127.0.0.1', 0);
    servidor.listen((peticion) {
      peticion.response
        ..headers.set('content-type', 'text/csv; charset=utf-8')
        ..add([0xEF, 0xBB, 0xBF, ...utf8.encode('Fecha,Método\r\n')])
        ..close();
    });
    addTearDown(() => servidor.close(force: true));
    final api = ApiClient(baseUrl: 'http://127.0.0.1:${servidor.port}/api');

    final contenido = await api.descargarReporteCsv('income', desde: 'a', hasta: 'b');

    expect(utf8.encode(conMarcaUtf8(contenido)).take(3), [0xEF, 0xBB, 0xBF]);
    expect(conMarcaUtf8(conMarcaUtf8(contenido)), conMarcaUtf8(contenido));
    expect(conMarcaUtf8(contenido), contains('Fecha,Método'));
  });
}
