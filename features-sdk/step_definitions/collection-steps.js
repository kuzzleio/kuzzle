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
  if (!await this.sdk.index.exists(index)) {
    throw new Error(`Index ${index} does not exist`);
  }

  if (!await this.sdk.collection.exists(index, collection)) {
    throw new Error(`Collection ${index}:${collection} does not exist`);
  }

  this.props.index = index;
  this.props.collection = collection;
});

Then('I list collections in index {string}', async function (index) {
  this.props.result = await this.sdk.collection.list(index);
});

Then(/I should( not)? see the collection "(.*?)":"(.*?)"/, async function (not, index, collection) {
  const { collections } = await this.sdk.collection.list(index);

  const collectionNames = collections.map(({ name }) => name);

  if (not) {
    should(collectionNames).not.containEql(collection);
  } else {
    should(collectionNames).containEql(collection);
  }
});

Then('I get mappings of collection {string}:{string}', async function (index, collection) {
  this.props.result = await this.sdk.collection.getMapping(index, collection);
});

Then('I refresh the collection', function () {
  return this.sdk.collection.refresh(this.props.index, this.props.collection);
});
