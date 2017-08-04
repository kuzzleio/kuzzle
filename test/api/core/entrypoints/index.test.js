/**
 * This component initializes
 */
const
  Bluebird = require('bluebird'),
  EmbeddedEntryPoint = require('../../../../lib/api/core/entrypoints/embedded'),
  EntryPoints = require('../../../../lib/api/core/entrypoints'),
  KuzzleMock = require('../../../mocks/kuzzle.mock'),
  ProxyEntryPoint = require('../../../../lib/api/core/entrypoints/proxy'),
  should = require('should'),
  sinon = require('sinon');

describe('Test: core/entryPoints', () => {
  let
    entrypoints,
    kuzzle;

  beforeEach(() => {
    kuzzle = new KuzzleMock();
    entrypoints = new EntryPoints(kuzzle);
    entrypoints.entryPoints = [
      {
        dispatch: sinon.spy(),
        init: sinon.stub().returns(Bluebird.resolve()),
        joinChannel: sinon.spy(),
        leaveChannel: sinon.spy()
      },
      {
        dispatch: sinon.spy(),
        init: sinon.stub().returns(Bluebird.resolve()),
        joinChannel: sinon.spy(),
        leaveChannel: sinon.spy()
      }
    ];

  });

  describe('#constructor', () => {
    it('should construct entry points', () => {
      const ep = new EntryPoints(kuzzle);

      should(ep.entryPoints)
        .have.length(2);
      should(ep.entryPoints[0])
        .be.an.instanceof(EmbeddedEntryPoint);
      should(ep.entryPoints[1])
        .be.an.instanceof(ProxyEntryPoint);
    });
  });

  describe('#dispatch', () => {
    it('should propagate dispatch to all entry points', () => {
      entrypoints.dispatch('test');

      for (const ep of entrypoints.entryPoints) {
        should(ep.dispatch)
          .be.calledOnce()
          .be.calledWith('test');
      }
    });
  });

  describe('#init', () => {
    it('should propagate to all entry points', () => {
      return entrypoints.init()
        .then(() => {
          for (const ep of entrypoints.entryPoints) {
            should(ep.init)
              .be.calledOnce();
            should(ep.init.firstCall.returnValue)
              .be.fulfilled();
          }
        });
    });
  });

  describe('#joinChannel', () => {
    it('should propagate to all entry points', () => {
      entrypoints.joinChannel('test');

      for (const ep of entrypoints.entryPoints) {
        should(ep.joinChannel)
          .be.calledOnce()
          .be.calledWith('test');
      }
    });
  });

  describe('#leaveChannel', () => {
    it('should propagae to all entry points', () => {
      entrypoints.leaveChannel('test');

      for (const ep of entrypoints.entryPoints) {
        should(ep.leaveChannel)
          .be.calledOnce()
          .be.calledWith('test');
      }
    });
  });


});


