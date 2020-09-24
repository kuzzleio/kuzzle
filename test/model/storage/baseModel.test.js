'use strict';

const should = require('should');
const sinon = require('sinon');
const mockrequire = require('mock-require');

const KuzzleMock = require('../../mocks/kuzzle.mock');
const ClientAdapterMock = require('../../mocks/clientAdapter.mock');

const BaseModel = require('../../../lib/model/storage/baseModel');

class Model extends BaseModel {
  constructor (_source, _id) {
    super(_source, _id);
  }

  static get collection () {
    return 'models';
  }

  static get fields () {
    return ['name', 'location'];
  }
}

BaseModel.register(Model);

describe('BaseModel', () => {
  let StorageEngine;
  let storageEngine;
  let kuzzle;

  beforeEach(() => {
    Model.prototype._afterDelete = sinon.stub().resolves();

    kuzzle = new KuzzleMock();

    mockrequire('../../../lib/core/storage/clientAdapter', ClientAdapterMock);

    StorageEngine = mockrequire.reRequire('../../../lib/core/storage/storageEngine');
    storageEngine = new StorageEngine(kuzzle);

    return storageEngine.init();
  });

  describe('BaseModel.register', () => {
    it('should have define getter and setters for defined fields', () => {
      const
        expectedSource = {},
        model = new Model();

      for (const field of Model.fields) {
        expectedSource[field] = 'some value';
        model[field] = 'some value';

        should(model[field]).be.eql('some value');
      }

      should(model.__source).match(expectedSource);
    });

    it('should define the hidden __persisted property', () => {
      const model = new Model();

      model.__persisted = true;

      should(model.__persisted).be.true();
      const keys = Object.keys(model);
      should(keys.includes('__persisted')).be.false();
    });
  });

  describe('BaseModel.getter/setter', () => {
    it('should have _id getter/setter', () => {
      const model = new Model();

      model._id = 'mylehuong';

      should(model._id).be.eql('mylehuong');
      should(model.__id).be.eql('mylehuong');
    });

    it('should have _source getter/setter', () => {
      const model = new Model();

      model._source = {
        name: 'mylehuong',
        location: 'thehive'
      };

      should(model._source).be.eql({
        name: 'mylehuong',
        location: 'thehive'
      });

      should(model.__source).be.eql({
        name: 'mylehuong',
        location: 'thehive'
      });
    });
  });

  describe('BaseModel.load', () => {
    it('should load and instantiate a model from database', async () => {
      kuzzle.internalIndex.get.resolves({
        _id: 'mylehuong' ,
        _source: {
          name: 'mylehuong',
          location: 'thehive'
        }
      });

      const model = await Model.load('mylehuong');

      should(model._id).be.eql('mylehuong');
      should(model._source).be.eql({
        name: 'mylehuong',
        location: 'thehive'
      });
      should(model.__persisted).be.true();
      should(kuzzle.internalIndex.get).be.calledWith('models', 'mylehuong');
    });
  });

  describe('BaseModel.deleteByQuery', () => {
    let documents;

    beforeEach(() => {
      documents = [
        { _id: 'mylehuong', _source: {} },
        { _id: 'thehive', _source: {} }
      ];

      sinon.stub(kuzzle.internalIndex, 'deleteByQuery').resolves({ documents });
    });

    it('should call the driver\'s deleteByQuery', async () => {
      await Model.deleteByQuery({ match_all: {} });

      should(kuzzle.internalIndex.deleteByQuery).be.calledOnce();

      const [ collection, query ] = kuzzle.internalIndex.deleteByQuery
        .getCall(0)
        .args;

      should(collection).be.eql('models');
      should(query).be.eql({ match_all: {} });
      should(Model.prototype._afterDelete).be.calledTwice();
    });

    it('should refresh the collection if the option.refresh is set', async () => {
      await Model.deleteByQuery({ match_all: {} }, { refresh: 'wait_for' });

      should(kuzzle.internalIndex.refreshCollection).be.calledWith('models');
    });
  });

  describe('BaseModel.search', () => {
    it('should call search and return instantiated models', async () => {
      kuzzle.internalIndex.search.resolves({
        hits: [
          { _id: 'mylehuong', _source: { location: 'Saigon' } },
          { _id: 'thehive', _source: { location: 'Hanoi' } },
        ],
      });

      const models = await Model.search(
        { query: { match_all: {} } },
        { scroll: '5s' });

      should(kuzzle.internalIndex.search).be.calledWith(
        'models',
        { query: { match_all: {} } },
        { scroll: '5s' });
      should(models).be.length(2);
      should(models[0]._id).be.eql('mylehuong');
      should(models[0]._source).be.eql({ location: 'Saigon' });
      should(models[0].__persisted).be.eql(true);
    });
  });

  describe('BaseModel.truncate', () => {
    it('should call BaseModel.deleteByQuery with match_all', async () => {
      sinon.stub(BaseModel, 'deleteByQuery').resolves('ret');

      try {
        const ret = await BaseModel.truncate({ refresh: 'wait_for' });

        should(BaseModel.deleteByQuery).be.calledWith(
          { match_all: {} },
          { refresh: 'wait_for' });
        should(ret).be.eql('ret');
      }
      finally {
        BaseModel.deleteByQuery.restore();
      }
    });
  });

  describe('#save', () => {
    const _id = 'mylehuong';
    const _source = { location: 'Saigon' };

    beforeEach(() => {
      kuzzle.internalIndex.create.resolves({ _id, _source });
    });

    it('should create the document if it is not persisted yet', async () => {
      const model = new Model(_source, _id);

      await model.save({ userId: 'aschen', refresh: 'wait_for' });

      should(kuzzle.internalIndex.create).be.calledWith(
        'models',
        'mylehuong',
        { location: 'Saigon' },
        { userId: 'aschen', refresh: 'wait_for' });
      should(model.__persisted).be.true();
    });

    it('should create the document and assign generated _id', async () => {
      const model = new Model(_source);

      await model.save();

      should(kuzzle.internalIndex.create).be.calledWith(
        'models',
        null,
        { location: 'Saigon' },
        { userId: null, refresh: undefined });
      should(model._id).be.eql('mylehuong');
    });

    it('should update the document if it is already persisted', async () => {
      const model = new Model(_source, _id);
      model.__persisted = true;

      await model.save({ userId: 'aschen', refresh: 'wait_for' });

      should(kuzzle.internalIndex.update).be.calledWith(
        'models',
        'mylehuong',
        { location: 'Saigon' },
        { userId: 'aschen', refresh: 'wait_for' });
    });
  });

  describe('#delete', () => {
    const _id = 'mylehuong';
    const _source = { location: 'Saigon' };

    it('should delete the document and call _afterDelete hook', async () => {
      const model = new Model(_source, _id);
      model.__persisted = true;

      await model.delete({ refresh: 'wait_for' });

      should(kuzzle.internalIndex.delete).be.calledWith(
        'models',
        'mylehuong',
        { refresh: 'wait_for' });
      should(model._afterDelete).be.calledOnce();
      should(model.__persisted).be.false();
    });

    it('should do nothing if the document is not persisted', async () => {
      const model = new Model(_source, _id);

      await model.delete();

      should(kuzzle.internalIndex.delete).not.be.called();
    });
  });

  describe('#serialize', () => {
    it('should return an object with _id and _source', () => {
      const _id = 'mylehuong';
      const _source = { location: 'Saigon' };
      const model = new Model(_source, _id);

      const serialized = model.serialize();

      should(serialized).be.eql({
        _id: 'mylehuong',
        _source: { location: 'Saigon' }
      });
    });
  });
});
