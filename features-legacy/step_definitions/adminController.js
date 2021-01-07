'use strict';

const { Given, When } = require('cucumber');

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

When('I reset public database', function () {
  return this.api.adminResetDatabase();
});
