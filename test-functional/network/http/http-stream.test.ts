import http from 'http';

test('Check duplicated Transfer-Encoding header', async () => {
  const promise = new Promise<http.IncomingMessage>(resolve => {
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
    http.get('http://localhost:17510/stream-test/download-fixed', res => {
      resolve(res);
    });
  });
  const response = await promise;
  expect(response.headers['content-length']).toBe("10");
  expect(response.headers['transfer-encoding']).toBeUndefined();
});