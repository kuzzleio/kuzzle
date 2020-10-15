'use strict';

const assert = require('assert');

const { Then } = require('cucumber');

Then('I got an error with id {string}', function (id) {
  assert(this.props.error !== null, 'Expected the previous step to return an error');

  assert(this.props.error.id === id, `Expected error to have id "${id}", but got "${this.props.error.id}"`);
});
