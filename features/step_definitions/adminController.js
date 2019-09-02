const { Given, When, Then } = require('cucumber'),
  should = require('should');

Given('I load the mappings {string}', function (mappings) {
  return this.api.loadMappings(JSON.parse(mappings));
});

When('I load the fixtures', function (fixtures) {
  return this.api.loadFixtures(JSON.parse(fixtures));
});

When('I load the securities', function (securities) {
  const parsed = JSON.parse(securities.replace(/#prefix#/g, this.idPrefix));
  return this.api.loadSecurities(parsed);
});

When('I send request to {string} the following secrets {string} with a vaultKey of value {string}', function (action, secrets, vaultKey, callback) {
  if (action === 'encrypt') {
    this.api.encryptSecrets(vaultKey, JSON.parse(secrets))
      .then(response => {
        if (response.error) {
          callback(new Error(response.error.message));
          return false;
        }
        this.result = response.result;
        callback();
      })
      .catch(error => callback(error));
    return;
  }
  this.api.decryptSecrets(vaultKey, JSON.parse(secrets))
    .then(response => {
      if (response.error) {
        callback(new Error(response.error.message));
        return false;
      }
      this.result = response.result;
      callback();
    })
    .catch(error => callback(error));
});

Then('It should be encrypted', function () {
  should(this.result.aws.key.length).be.eql(65);
});

Then('I should receive {string}', function (result) {
  should(this.result).be.eql(JSON.parse(result));
});