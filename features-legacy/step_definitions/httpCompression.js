"use strict";

const { Given } = require("cucumber");

Given(/^a request compressed with "([^"]*)"$/, function (algorithm) {
  this.api.encode(algorithm);
});

Given(/^an expected response compressed with "([^"]*)"$/, function (algorithm) {
  this.api.decode(algorithm);
});
