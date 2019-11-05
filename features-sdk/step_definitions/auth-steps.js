const
  {
    Given
  } = require('cucumber');

Given('I\'m logged in Kuzzle as user {string} with password {string}', async function (username, password) {
  this.props.result = await this.sdk.auth.login('local', { username, password });
});
