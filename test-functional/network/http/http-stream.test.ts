import http from 'http';

test('Check duplicated Transfer-Encoding header', async () => {
  const promise = new Promise<http.IncomingMessage>(resolve => {
    // The usage of the port 17510 is to avoid the usage of the proxy
    // because NGINX is sanitizing the headers
    // which prevent us from seing the duplicated Transfer-Encoding header
    http.get('http://localhost:17510/stream-test/download-chunked', res => {
      resolve(res);
    });
  });
  const response = await promise;
  expect(response.headers['content-length']).toBeUndefined();
  expect(response.headers['transfer-encoding']).toBe('chunked');
});

test('Check Content-Length header on fixed size stream', async () => {
  const promise = new Promise<http.IncomingMessage>(resolve => {
    // The usage of the port 17510 is to avoid the usage of the proxy
    // because NGINX is sanitizing the headers
    http.get('http://localhost:17510/stream-test/download-fixed', res => {
      resolve(res);
    });
  });
  const response = await promise;
  expect(response.headers['content-length']).toBe("10");
  expect(response.headers['transfer-encoding']).toBeUndefined();
});