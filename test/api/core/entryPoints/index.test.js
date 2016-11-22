/**
 * This component initializes
 */
var
  should = require('should'),
  Kuzzle = require.main.require('lib/api/kuzzle'),
  sandbox = require('sinon').sandbox.create(),
  EntryPoints = require.main.require('lib/api/core/entryPoints'),
  KuzzleProxy = require.main.require('lib/api/core/entryPoints/kuzzleProxy');

describe('Test: core/entryPoints', () => {
  afterEach(() => {
    sandbox.restore();
  });

  it('should create instance of proxy server on creation', () => {
    var
      kuzzle = new Kuzzle(),
      entryPoints = new EntryPoints(kuzzle);

    should(entryPoints).be.an.Object();
    should(entryPoints.proxy).be.instanceOf(KuzzleProxy);
  });

  it('should call init of each entry points', () => {
    var
      kuzzle = new Kuzzle(),
      entryPoints = new EntryPoints(kuzzle),
      spyProxy = sandbox.stub(entryPoints.proxy, 'init');

    entryPoints.init();
    should(spyProxy.called).be.true();
  });
});
