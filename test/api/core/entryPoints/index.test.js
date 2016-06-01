/**
 * This component initializes
 */
var
  should = require('should'),
  Kuzzle = require.main.require('lib/api/Kuzzle'),
  EntryPoints = require.main.require('lib/api/core/entryPoints'),
  Lb = require.main.require('lib/api/core/entryPoints/lb'),
  Mq = require.main.require('lib/api/core/entryPoints/mq'),
  Http = require.main.require('lib/api/core/entryPoints/http');

describe('Test: core/entryPoints', function () {

  var httpPort = 6667;

  it('should create instance of lb/mq/http server on creation', function () {
    var
      kuzzle = new Kuzzle(),
      entryPoints = new EntryPoints(kuzzle, {httpPort: httpPort});

    should(entryPoints).be.an.Object();
    should(entryPoints.lb).be.instanceOf(Lb);
    should(entryPoints.mq).be.instanceOf(Mq);
    should(entryPoints.http).be.instanceOf(Http);
  });
});
