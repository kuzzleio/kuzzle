const
  _ = require('lodash'),
  should = require('should'),
  {
    Given,
    Then
  } = require('cucumber');

Given('I create the following document:', async function (dataTable) {
  const document = this.parseObject(dataTable);

  const
    index = document.index || this.props.index,
    collection = document.collection || this.props.collection;

  this.props.result = await this.sdk.document.create(
    index,
    collection,
    document.body,
    document._id,
    { refresh: 'wait_for' });

  this.props.documentId = this.props.result._id;
});

Then('The document {string} content match:', async function (documentId, dataTable) {
  const expectedContent = this.parseObject(dataTable);

  const document = await this.sdk.document.get(
    this.props.index,
    this.props.collection,
    documentId);

  for (const [key, value] of Object.entries(expectedContent)) {
    should(document._source[key]).be.eql(value);
  }
});

Then('I {string} the following documents:', async function (action, dataTable) {
  action = `m${action[0].toUpperCase() + action.slice(1)}`;

  const documents = this.parseObjectArray(dataTable);

  this.props.result = await this.sdk.document[action](
    this.props.index,
    this.props.collection,
    documents,
    { refresh: 'wait_for' });
});

Then('I should receive a {string} array of objects matching:', function (name, dataTable) {
  const expected = this.parseObjectArray(dataTable);

  should(this.props.result[name].length).be.eql(
      expected.length,
      `Array are not the same size: expected ${this.props.result[name].length} got ${expected.length}`);

  for (let i = 0; i < expected.length; i++) {
    should(this.props.result[name][i]).match(expected[i]);
  }
});

Then('I should receive a {string} array matching:', function (name, dataTable) {
  const expected = _.flatten(dataTable.rawTable).map(JSON.parse);

  should(this.props.result[name].length).be.eql(
      expected.length,
      `Array are not the same size: expected ${this.props.result[name].length} got ${expected.length}`);

  should(this.props.result[name].sort()).match(expected.sort());
});

Then('I should receive a empty {string} array', function (name) {
  should(this.props.result[name]).be.Array().be.empty();
});

Then('I count {int} documents', async function (expectedCount) {
  const count = await this.sdk.document.count(
    this.props.index,
    this.props.collection);

  should(count).be.eql(expectedCount);
});

Then('I count {int} documents matching:', async function (expectedCount, dataTable) {
  const properties = this.parseObject(dataTable);

  const query = {
    match: {
      ...properties
    }
  };

  const count = await this.sdk.document.count(
    this.props.index,
    this.props.collection,
    { query });

  should(count).be.eql(expectedCount);
});

Then('The document {string} exists', async function (id) {
  await this.sdk.document.get(
    this.props.index,
    this.props.collection,
    id);
});

Then('I {string} the following document ids:', async function (action, dataTable) {
  action = `m${action[0].toUpperCase() + action.slice(1)}`;

  const ids = _.flatten(dataTable.rawTable).map(JSON.parse);

  this.props.result = await this.sdk.document[action](
    this.props.index,
    this.props.collection,
    ids,
    { refresh: 'wait_for' });
});