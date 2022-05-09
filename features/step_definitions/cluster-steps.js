'use strict';

const should = require('should');
const { Then } = require('cucumber');

Then('I target {string}', async function (node) {
  should(this).have.property(node);

  this.sdk = this[node];
});
