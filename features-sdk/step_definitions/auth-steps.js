const
  {
    Given
  } = require('cucumber');

Given('I\'m logged in Kuzzle as user {string} with password {string}', async function (username, password) {
  this.props.result = await this.sdk.auth.login('local', { username, password });
});

Given('I can login with the previously created API key', async function () {
  const token = this.props.result._source.token;

  should(token).not.be.undefined();

  this.sdk.jwt = token;

  const { valid } = await this.sdk.auth.checkToken();

  should(valid).be.true('Provided token is invalid');
});
