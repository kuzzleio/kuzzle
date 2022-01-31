'use strict';

const
  {
    Then,
    Given
  } = require('cucumber'),
  should = require('should');

Given('a collection {string}:{string}', async function (index, collection) {
  this.props.result = await this.sdk.collection.create(index, collection);

  this.props.index = index;
  this.props.collection = collection;
});

Given('an existing collection {string}:{string}', async function (index, collection) {
  if (! await this.sdk.index.exists(index)) {
    throw new Error(`Index ${index} does not exist`);
  }

  if (! await this.sdk.collection.exists(index, collection)) {
    throw new Error(`Collection ${index}:${collection} does not exist`);
  }

  this.props.index = index;
  this.props.collection = collection;
});

Then('I {string} the collection {string}:{string} with:', async function (action, index, collection, dataTable) {
  let
    mappings = {},
    settings = {};

  if (dataTable.rowsHash) {
    ({ mappings, settings } = this.parseObject(dataTable));
  }

  try {
    // @todo remove the condition when collection.update is available in sdk
    if (action === 'update') {
      this.props.result = await this.sdk.query({
        controller: 'collection',
        action: 'create',
        index,
        collection,
        body: { mappings, settings }
      });
    }
    else {
      this.props.result = await this.sdk.collection[action](
        index,
        collection,
        { mappings, settings });
    }

    this.props.index = index;
    this.props.collection = collection;
  }
  catch (error) {
    this.props.error = error;
  }
});

Then('I list {string} collections in index {string}', async function (expectedType, index) {
  const { collections } = await this.sdk.collection.list(index);

  this.props.result = {
    collections: collections.filter(({ type }) => type === expectedType)
  };
});

Then(/I should( not)? see the collection "(.*?)":"(.*?)"/, async function (not, index, collection) {
  const { collections } = await this.sdk.collection.list(index);

  const collectionNames = collections.map(({ name }) => name);

  if (not) {
    should(collectionNames).not.containEql(collection);
  }
  else {
    should(collectionNames).containEql(collection);
  }
});

Then('I get mappings of collection {string}:{string}', async function (index, collection) {
  this.props.result = await this.sdk.collection.getMapping(index, collection);
});

Then('I refresh the collection', function () {
  return this.sdk.collection.refresh(this.props.index, this.props.collection);
});
