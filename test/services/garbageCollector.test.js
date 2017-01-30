'use strict';

const
  OneHour = 3600000,
  OneDay = OneHour * 24,
  sinon = require('sinon'),
  should = require('should'),
  rewire = require('rewire'),
  Promise = require('bluebird'),
  GarbageCollector = rewire('../../lib/services/garbageCollector'),
  KuzzleMock = require('../mocks/kuzzle.mock');

describe('Test: GarbageCollector service', () => {
  let
    sandbox = sinon.sandbox.create();

  describe('#init', () => {
    it('should run the garbage collector and resolve a promise directly', () => {
      let
        kuzzle = new KuzzleMock(),
        gc = new GarbageCollector(kuzzle);

      sandbox.stub(gc, 'run');

      should(gc.init())
        .be.fulfilled();

      should(gc.run)
        .be.calledOnce();
    });
  });

  describe('#run', () => {
    describe('when kuzzle is overloaded', () => {
      let
        gc,
        kuzzle,
        clearTimeoutSpy,
        setTimeoutStub;

      beforeEach(done => {
        kuzzle = new KuzzleMock();
        clearTimeoutSpy = sandbox.spy();
        setTimeoutStub = sandbox.stub().returns('banana');

        GarbageCollector.__with__({
          clearTimeout: clearTimeoutSpy,
          setTimeout: setTimeoutStub,
        })(() => {
          gc = new GarbageCollector(kuzzle);

          kuzzle.funnel.overloaded = true;

          done();
        });
      });

      afterEach(() => {
        sandbox.restore();
      });

      it('should do nothing and delay running to one hour', () => {
        gc.timer = null;

        gc.run();

        should(clearTimeoutSpy.callCount)
          .be.exactly(0);

        should(setTimeoutStub)
          .be.calledOnce();

        should(setTimeoutStub.getCall(0).args[0])
          .be.eql(gc.run.bind(gc));

        should(setTimeoutStub.getCall(0).args[1])
          .be.exactly(OneHour);

        should(gc.timer)
          .be.exactly('banana');
      });
      it('should clear previous timeout if any', () => {
        gc.timer = 'foobar';

        gc.run();

        should(clearTimeoutSpy)
          .be.calledOnce()
          .be.calledWithExactly('foobar');

        should(gc.timer)
          .be.exactly('banana');
      });
    });

    describe('when kuzzle is not overloaded', () => {
      let
        gc,
        kuzzle,
        clearTimeoutSpy,
        setTimeoutStub;

      beforeEach(done => {
        kuzzle = new KuzzleMock();
        clearTimeoutSpy = sandbox.spy();
        setTimeoutStub = sandbox.stub().returns('banana');

        GarbageCollector.__with__({
          clearTimeout: clearTimeoutSpy,
          setTimeout: setTimeoutStub,
        })(() => {
          gc = new GarbageCollector(kuzzle);

          kuzzle.funnel.overloaded = false;

          done();
        });
      });

      afterEach(() => {
        sandbox.restore();
      });

      it('should list all indexes and all collections, and execute a deleteByQueryFromTrash on each collections', done => {
        kuzzle.services.list.storageEngine.listIndexes
          .returns(Promise.resolve({indexes: ['index1', kuzzle.internalEngine.index, 'index2']}));

        kuzzle.services.list.storageEngine.listCollections
          .onFirstCall().returns(Promise.resolve({collections: {stored: ['collection1-1'] }}))
          .onSecondCall().returns(Promise.resolve({collections: {stored: ['collection2-1', 'collection2-2'] }}));

        kuzzle.services.list.storageEngine.deleteByQueryFromTrash
          .onFirstCall().returns(Promise.resolve({ids: ['document1-1-1', 'document1-1-2']}))
          .onSecondCall().returns(Promise.resolve({ids: ['document2-1-1']}))
          .onThirdCall().returns(Promise.resolve({ids: ['document2-2-1','document2-2-2', 'document2-2-3']}));

        gc.run()
          .then(ids => {
            should(kuzzle.services.list.storageEngine.listIndexes)
              .be.calledOnce();

            should(kuzzle.services.list.storageEngine.listCollections)
              .be.calledTwice();

            should(kuzzle.services.list.storageEngine.listCollections.getCall(0).args[0].input.resource.index)
              .be.exactly('index1');

            should(kuzzle.services.list.storageEngine.listCollections.getCall(1).args[0].input.resource.index)
              .be.exactly('index2');

            should(ids)
              .be.eql({ids: [
                'document1-1-1',
                'document1-1-2',
                'document2-1-1',
                'document2-2-1',
                'document2-2-2',
                'document2-2-3'
              ]});

            done();
          })
          .catch(error => {
            done(error);
          });
      });

      it('should be not blocked when errors occurs', done => {
        let
          deleteByQueryFromTrashError = new Error('mocked error');

        kuzzle.services.list.storageEngine.listIndexes
          .returns(Promise.resolve({indexes: ['index1', kuzzle.internalEngine.index, 'index2']}));

        kuzzle.services.list.storageEngine.listCollections
          .onFirstCall().returns(Promise.resolve({collections: {stored: ['collection1-1'] }}))
          .onSecondCall().returns(Promise.resolve({collections: {stored: ['collection2-1', 'collection2-2'] }}));

        kuzzle.services.list.storageEngine.deleteByQueryFromTrash
          .onFirstCall().returns(Promise.reject(deleteByQueryFromTrashError))
          .onSecondCall().returns(Promise.resolve({ids: ['document2-1-1']}))
          .onThirdCall().returns(Promise.resolve({ids: ['document2-2-1','document2-2-2', 'document2-2-3']}));

        gc.run()
          .then(ids => {
            should(kuzzle.services.list.storageEngine.listIndexes)
              .be.calledOnce();

            should(kuzzle.services.list.storageEngine.listCollections)
              .be.calledTwice();

            should(kuzzle.services.list.storageEngine.listCollections.getCall(0).args[0].input.resource.index)
              .be.exactly('index1');

            should(kuzzle.services.list.storageEngine.listCollections.getCall(1).args[0].input.resource.index)
              .be.exactly('index2');

            should(kuzzle.pluginsManager.trigger)
              .be.calledWith('log:error', deleteByQueryFromTrashError);

            should(ids)
              .be.eql({ids: [
                'document2-1-1',
                'document2-2-1',
                'document2-2-2',
                'document2-2-3'
              ]});

            done();
          });
      });

      it('should trigger a piped event before starting and after finishing', () => {
        gc.run()
          .then(() => {
            should(kuzzle.pluginsManager.trigger)
              .be.calledWith('gc:start');

            should(kuzzle.pluginsManager.trigger)
              .be.calledWith('gc:end', {ids: []});
          });
      });

      it('should delay next gc pass to one day by default', () => {
        gc.timer = 'foobar';
        kuzzle.config.services.garbageCollector.cleanInterval = undefined;

        gc.run();

        should(clearTimeoutSpy)
          .be.calledOnce()
          .be.calledWithExactly('foobar');

        should(setTimeoutStub)
          .be.calledOnce();

        should(setTimeoutStub.getCall(0).args[0])
          .be.eql(gc.run.bind(gc));

        should(setTimeoutStub.getCall(0).args[1])
          .be.exactly(OneDay);

        should(gc.timer)
          .be.exactly('banana');
      });

      it('should delay next gc pass to user defined setting', () => {
        gc.timer = null;
        kuzzle.config.services.garbageCollector.cleanInterval = 100;

        gc.run();

        should(clearTimeoutSpy.callCount)
          .be.exactly(0);

        should(setTimeoutStub)
          .be.calledOnce();

        should(setTimeoutStub.getCall(0).args[0])
          .be.eql(gc.run.bind(gc));

        should(setTimeoutStub.getCall(0).args[1])
          .be.exactly(100);

        should(gc.timer)
          .be.exactly('banana');
      });
    });
  });
});