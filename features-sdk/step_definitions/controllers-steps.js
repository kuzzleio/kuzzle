'use strict';

const _ = require('lodash');
const should = require('should');
const { Then } = require('cucumber');

Then(/I (successfully )?execute the action "(.*?)":"(.*?)" with args:$/, async function (expectSuccess, controller, action, dataTable) {
  const args = this.parseObject(dataTable);

  try {
    const response = await this.sdk.query({ controller, action, ...args });

    this.props.result = response.result;
  }
  catch (error) {
    if (expectSuccess) {
      throw error;
    }

    this.props.error = error;
  }
});

Then(/I (successfully )?execute the action "(.*?)":"(.*?)" with body:$/, async function (expectSuccess, controller, action, bodyRaw) {
  const body = JSON.parse(bodyRaw);

  try {
    const response = await this.sdk.query({ controller, action, body });

    this.props.result = response.result;
  }
  catch (error) {
    if (expectSuccess) {
      throw error;
    }

    this.props.error = error;
  }
});

Then(/I (successfully )?execute the action "(.*?)":"(.*?)"$/, async function (expectSuccess, controller, action) {
  try {
    const response = await this.sdk.query({ controller, action });

    this.props.result = response.result;
  }
  catch (error) {
    if (expectSuccess) {
      throw error;
    }

    this.props.error = error;
  }
});

Then(/I should receive a ("(.*?)" )?array (of objects )?matching:/, function (name, objects, dataTable) {
  const expected = objects ? this.parseObjectArray(dataTable) : _.flatten(dataTable.rawTable).map(JSON.parse);
  const result = name ? this.props.result[name] : this.props.result;

  should(result.length).be.eql(
    expected.length,
    `Array are not the same size: expected ${expected.length} got ${result.length}`);

  if (!objects) {
    should(result.sort()).match(expected.sort());
    return;
  }
  for (let i = 0; i < expected.length; i++) {
    should(result[i]).matchObject(expected[i]);
  }
});

Then(/I should receive a ("(.*?)" )?array containing (\d+) elements/, function (name, expectedCount) {
  const result = name ? this.props.result[name] : this.props.result;

  should(result).have.length(expectedCount);
});

Then('I should receive a result matching:', function (dataTable) {
  const expectedResult = this.parseObject(dataTable);

  should(this.props.result).not.be.undefined();

  should(this.props.result).matchObject(expectedResult);
});

Then('The property {string} of the result should match:', function (path, dataTable) {
  const expectedProperty = this.parseObject(dataTable);

  const property = _.get(this.props.result, path);

  should(property).not.be.undefined();

  if (_.isPlainObject(property)) {
    should(property).matchObject(expectedProperty);
  }
  else {
    should(property).match(expectedProperty);
  }
});

Then('The result should be {string}', function (rawValue) {
  const expectedValue = JSON.parse(rawValue);

  should(this.props.result).be.eql(expectedValue);
});

Then('The result should contain a property {string} of type {string}', function (path, type) {
  const property = _.get(this.props.result, path);

  should(property).not.be.undefined();

  should(typeof property).be.eql(type);
});

Then('I should receive a {string} result equals to {string}', function (type, rawResult) {
  let expectedResult;

  if (type === 'string') {
    expectedResult = rawResult;
  }
  else if (type === 'int') {
    expectedResult = parseInt(rawResult);
  }
  else {
    throw new Error(`Unknown result type '${type}'`);
  }

  should(this.props.result).not.be.undefined();

  should(this.props.result).eql(expectedResult);
});

Then('I should receive an empty result', function () {
  should(this.props.result).be.undefined();
});

Then('I should receive an error matching:', function (dataTable) {
  const expectedError = this.parseObject(dataTable);

  should(this.props.error).not.be.undefined();

  should(this.props.error).match(expectedError);
});

Then('I debug {string}', function (path) {
  const prop = _.get(this.props, path);

  try {
    console.log(JSON.stringify(prop, null, 2));
  }
  catch (e) {
    console.log(prop);
  }
});

Then('I should receive a empty {string} array', function (name) {
  should(this.props.result[name]).be.Array().be.empty();
});
