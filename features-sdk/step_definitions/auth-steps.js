const
  _ = require('lodash'),
  {
    Given
  } = require('cucumber');

Given('I\'m logged in Kuzzle as user {string} with password {string}', async function (username, password) {
  this.props.result = await this.sdk.auth.login('local', { username, password });
});

Given(/I can( not)? login with the previously created API key/, async function (not) {
  const token = _.get(this.props, 'result._source.token') || this.props.token;

  should(token).not.be.undefined();

  this.sdk.jwt = token;

  const { valid } = await this.sdk.auth.checkToken();

  if (not) {
    should(valid).be.false('Provided token is valid');
  }
  else {
    should(valid).be.true('Provided token is invalid');
  }
});

Given('I save the created API key', function () {
  this.props.token = this.props.result._source.token;
});
