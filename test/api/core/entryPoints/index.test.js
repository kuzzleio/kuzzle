/**
 * This component initializes
 */
var
  should = require('should'),
  Kuzzle = require.main.require('lib/api/kuzzle'),
  sandbox = require('sinon').sandbox.create(),
  EntryPoints = require.main.require('lib/api/core/entryPoints'),
  KuzzleProxy = require.main.require('lib/api/core/entryPoints/kuzzleProxy'),
  Http = require.main.require('lib/api/core/entryPoints/http');

describe('Test: core/entryPoints', () => {

  var httpPort = 6667;

  afterEach(() => {
    sandbox.restore();
  });

  it('should create instance of proxy/http server on creation', () => {
    var
      kuzzle = new Kuzzle(),
      entryPoints = new EntryPoints(kuzzle, {httpPort: httpPort});

    should(entryPoints).be.an.Object();
    should(entryPoints.proxy).be.instanceOf(KuzzleProxy);
    should(entryPoints.http).be.instanceOf(Http);
  });

  it('should call init of each entry points', () => {
    var
      kuzzle = new Kuzzle(),
      entryPoints = new EntryPoints(kuzzle, {httpPort: httpPort}),
      spyProxy = sandbox.stub(entryPoints.proxy, 'init'),
      spyHttp = sandbox.stub(entryPoints.http, 'init').resolves();


    return entryPoints.init()
      .then(() => {
        should(spyProxy.callCount).be.eql(1);
        should(spyHttp.callCount).be.eql(1);
      });

  });
});
