'use strict';

const
  _ = require('lodash'),
  should = require('should'),
  {
    Given,
    Then
  } = require('cucumber');

Given(/I can( not)? create the following document:/, async function (not, dataTable) {
  const document = this.parseObject(dataTable);

  const
    index = document.index || this.props.index,
    collection = document.collection || this.props.collection;

  try {
    this.props.result = await this.sdk.document.create(
      index,
      collection,
      document.body,
      document._id);

    if (not) {
      return Promise.reject(new Error('Document should not have been created'));
    }

    this.props.documentId = this.props.result._id;
  }
  catch (error) {
    if (!not) {
      throw error;
    }
  }
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
    documents);
});

Then('I {string} the document {string} with content:', async function (action, _id, dataTable) {
  const body = this.parseObject(dataTable);

  if (action === 'create') {
    this.props.result = await this.sdk.document[action](
      this.props.index,
      this.props.collection,
      body,
      _id);
  }
  else {
    this.props.result = await this.sdk.document[action](
      this.props.index,
      this.props.collection,
      _id,
      body);
  }
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

Then(/The document "(.*?)" should( not)? exist/, async function (id, not) {
  const exists = await this.sdk.document.exists(
    this.props.index,
    this.props.collection,
    id);

  if (not && exists) {
    throw new Error(`Document ${id} exists, but it shouldn't`);
  }

  if (!not && !exists) {
    throw new Error(`Expected document ${id} to exist`);
  }
});

Then(/I "(.*?)" the following document ids( with verb "(.*?)")?:/, async function (action, verb, dataTable) {
  action = `m${action[0].toUpperCase() + action.slice(1)}`;
  const options = verb ? { verb, refresh: 'wait_for' } : { refresh: 'wait_for' };
  const ids = _.flatten(dataTable.rawTable).map(JSON.parse);

  this.props.result = await this.sdk.document[action](
    this.props.index,
    this.props.collection,
    ids,
    options);
});

Then('I search documents with the following query:', function (queryRaw) {
  const query = JSON.parse(queryRaw);

  this.props.searchBody = { query };
});

Then('I search documents with the following search body:', function (searchBodyRaw) {
  const searchBody = JSON.parse(searchBodyRaw);

  this.props.searchBody = searchBody;
});

Then('with the following highlights:', function (highlightsRaw) {
  const highlights = JSON.parse(highlightsRaw);

  this.props.searchBody.highlight = highlights;
});

Then('with the following search options:', function (optionsRaw) {
  const options = JSON.parse(optionsRaw);

  this.props.searchOptions = options;
});

Then('I execute the search query', async function () {
  // temporary use of sdk.query until we add the new "remaining" property
  // in the SDK's SearchResults class
  const response = await this.sdk.query({
    action: 'search',
    body: this.props.searchBody,
    collection: this.props.collection,
    controller: 'document',
    index: this.props.index,
    ...this.props.searchOptions,
  });

  this.props.result = response.result;
});

Then('I scroll to the next page', async function () {
  // temporary use of raw results, until the "remaining" propery is made
  // available to the SearchResults SDK class
  if (!this.props.result.scrollId) {
    throw new Error('No scroll ID found');
  }

  const response = await this.sdk.query({
    action: 'scroll',
    controller: 'document',
    scroll: '30s',
    scrollId: this.props.result.scrollId,
  });

  this.props.result = response.result;
});

Then('I execute the search query with verb "GET"', async function () {
  const request = {
    action: 'search',
    controller: 'document',
    index: this.props.index,
    collection: this.props.collection,
  };
  const options = {};

  if (this.kuzzleConfig.PROTOCOL === 'http') {
    request.searchBody = JSON.stringify(this.props.searchBody);
    options.verb = 'GET';
  } else {
    request.body = this.props.searchBody;
  }
  const { result } = await this.sdk.query(request, options);
  this.props.result = result;
});

Then('I delete the document {string}', async function (id) {
  this.props.result = await this.sdk.document.delete(
    this.props.index,
    this.props.collection,
    id);
});
