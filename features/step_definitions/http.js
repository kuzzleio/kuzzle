const { execSync } = require('child_process');

const { Then } = require('cucumber');

Then('I send the crafted HTTP multipart request', async function () {
  execSync('cat features/fixtures/bad-multipart.req | nc localhost 7512');
});

Then('Kuzzle is still up', async function () {
  await this.api.serverPublicApi();
});