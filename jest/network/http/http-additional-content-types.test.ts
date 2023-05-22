import rp from 'request-promise';
import YAML from 'yaml';

test('Check additional content type', async () => {
  const postData = YAML.stringify({ name: 'Martial' });

  const response = rp.post({
    uri: "http://localhost:17510/_/functional-tests/hello-world",
    headers: {
      'Content-Type': 'application/x-yaml',
      'Content-Length': Buffer.byteLength(postData),
    },
    body: postData,
    transform: (body) => JSON.parse(body)
  });
    
  await expect(response).resolves.toMatchObject({
    result: { greeting: "Hello, Martial" }
  });
});