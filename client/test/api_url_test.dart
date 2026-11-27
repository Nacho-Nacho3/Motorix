import 'package:flutter_test/flutter_test.dart';

import 'package:motorix_client/services/api_client.dart';

// Despliegue: la dirección de la API se fija al compilar.
void main() {
  test('sin API_URL la aplicación usa el backend local', () {
    expect(ApiClient().baseUrl, 'http://localhost:3000/api');
  });

  test('en el navegador usa la API del mismo sitio que sirve la página', () {
    expect(
      ApiClient.urlPorOmision(
        compilada: '',
        esWeb: true,
        pagina: Uri.parse('https://motorix.onrender.com/#/inicio'),
      ),
      'https://motorix.onrender.com/api',
    );
  });

  test('una dirección compilada tiene prioridad, también en el navegador', () {
    expect(
      ApiClient.urlPorOmision(
        compilada: 'https://otra.onrender.com/api',
        esWeb: true,
        pagina: Uri.parse('http://localhost:3000/'),
      ),
      'https://otra.onrender.com/api',
    );
  });

  test('un servidor local responde con poca espera', () {
    expect(ApiClient.esperaPara('http://localhost:3000/api'), const Duration(seconds: 15));
    expect(ApiClient.esperaPara('http://127.0.0.1:3000/api'), const Duration(seconds: 15));
  });

  test('un servidor remoto tiene tiempo de despertar', () {
    expect(
      ApiClient.esperaPara('https://motorix-api.onrender.com/api'),
      const Duration(seconds: 90),
    );
  });
}
