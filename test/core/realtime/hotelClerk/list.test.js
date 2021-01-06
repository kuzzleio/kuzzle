'use strict';

const should = require('should');
const sinon = require('sinon');

const KuzzleMock = require('../../../mocks/kuzzle.mock');

const HotelClerk = require('../../../../lib/core/realtime/hotelClerk');

describe('Test: hotelClerk.list', () => {
  const index = '%test';
  const collection = 'user';
  let kuzzle;
  let hotelClerk;
  let user;

  beforeEach(() => {
    kuzzle = new KuzzleMock();
    hotelClerk = new HotelClerk({});

    user = {
      _id: 'user',
      isActionAllowed: sinon.stub().resolves(true),
    };

    return hotelClerk.init();
  });

  it('should register a "list" event', async () => {
    sinon.stub(hotelClerk, 'list');

    kuzzle.ask.restore();
    await kuzzle.ask('core:realtime:list', 'user');

    should(hotelClerk.list).calledWith('user');
  });

  it('should return an empty object if there is no room', async () => {
    const response = await hotelClerk.list(user);

    should(response).be.empty().Object();
  });

  it('should return a correct list according to subscribe on filter', async () => {
    kuzzle.koncorde.getIndexes.returns(['index', 'anotherIndex']);
    kuzzle.koncorde.getCollections.withArgs('index').returns(['collection']);
    kuzzle.koncorde.getCollections
      .withArgs('anotherIndex')
      .returns(['anotherCollection']);
    kuzzle.koncorde.getFilterIds
      .withArgs('index', 'collection')
      .returns(['foo', 'bar']);
    kuzzle.koncorde.getFilterIds
      .withArgs('anotherIndex', 'anotherCollection')
      .returns(['baz']);

    hotelClerk.rooms.set('foo', {
      index,
      collection,
      customers: new Set(['a', 'b', 'c'])
    });
    hotelClerk.rooms.set('bar', {
      index,
      collection,
      customers: new Set(['a', 'd'])
    });
    hotelClerk.rooms.set('baz', {
      index: 'anotherIndex',
      collection: 'anotherCollection',
      customers: new Set(['a', 'c'])
    });

    const response = await hotelClerk.list(user);

    should(response).match({
      index: {
        collection: {
          foo: 3,
          bar: 2
        }
      },
      anotherIndex: {
        anotherCollection: {
          baz: 2
        }
      }
    });
  });

  it('should return a correct list according to subscribe on filter and user right', async () => {
    kuzzle.koncorde.getIndexes
      .returns(['index', 'anotherIndex', 'andAnotherOne']);
    kuzzle.koncorde.getCollections
      .withArgs('index')
      .returns(['collection', 'forbidden']);
    kuzzle.koncorde.getCollections
      .withArgs('anotherIndex')
      .returns(['anotherCollection']);
    kuzzle.koncorde.getCollections
      .withArgs('andAnotherOne')
      .returns(['collection']);
    kuzzle.koncorde.getFilterIds
      .withArgs('index', 'collection')
      .returns(['foo', 'bar']);
    kuzzle.koncorde.getFilterIds
      .withArgs('index', 'forbidden')
      .returns(['foo']);
    kuzzle.koncorde.getFilterIds
      .withArgs('anotherIndex', 'anotherCollection')
      .returns(['baz']);
    kuzzle.koncorde.getFilterIds
      .withArgs('andAnotherOne', 'collection')
      .returns(['foobar']);

    hotelClerk.rooms.set('foo', { customers: new Set(['a', 'b', 'c']) });
    hotelClerk.rooms.set('bar', { customers: new Set(['b', 'd', 'e', 'f']) });
    hotelClerk.rooms.set('baz', { customers: new Set(['d', 'e']) });
    hotelClerk.rooms.set('foobar', { customers: new Set(['a', 'c']) });

    user.isActionAllowed
      .onSecondCall()
      .resolves(false);
    user.isActionAllowed
      .onThirdCall()
      .resolves(false);

    const response = await hotelClerk.list(user);

    should(response).match({
      index: {
        collection: {
          foo: 3,
          bar: 4
        }
      },
      andAnotherOne: {
        collection: {
          foobar: 2
        }
      }
    });
  });
});
