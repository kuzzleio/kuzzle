import http from 'http';

test('Check duplicated Transfer-Encoding header', async () => {
  const promise = new Promise<http.IncomingMessage>(resolve => {
    // The usage of the port 17510 is to avoid the usage of the proxy
    // because NGINX is sanitizing the headers
    // which prevent us from seing the duplicated Transfer-Encoding header
    http.get({
      hostname: 'localhost',
      port: 17510,
      path: '/stream-test/download-chunked',
      headers: {
        'Connection': 'close'
      }
    }, res => {
      resolve(res);
    }).end();
  });
  const response = await promise;
  expect(response.headers['content-length']).toBeUndefined();
  expect(response.headers['transfer-encoding']).toBe('chunked');
  response.socket.destroy();
});

test('Check Content-Length header on fixed size stream', async () => {
  const promise = new Promise<http.IncomingMessage>(resolve => {
    // The usage of the port 17510 is to avoid the usage of the proxy
    // because NGINX is sanitizing the headers
    http.get({
      hostname: 'localhost',
      port: 17510,
      path: '/stream-test/download-fixed',
      headers: {
        'Connection': 'close'
      }
    }, res => {
      resolve(res);
    }).end();
  });
  const response = await promise;
  expect(response.headers['content-length']).toBe("10");
  expect(response.headers['transfer-encoding']).toBeUndefined();
  response.socket.destroy();
});