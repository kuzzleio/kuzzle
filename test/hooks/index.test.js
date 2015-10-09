var
  should = require('should'),
  winston = require('winston'),
  params = require('rc')('kuzzle'),
  _ = require('lodash'),
  Kuzzle = require('root-require')('lib/api/Kuzzle');

require('should-promised');

describe('Test main file for hooks managers', function () {
  var
    kuzzle,
    badHooksConfig = {
      'foo:bar': ['foo:bar'],
      'foo:baz': ['foo:bar', 'foo:baz']
    },
    hooksConfig = {
      'data:create': ['write:add'],
      'data:update': ['write:add']
    };

  beforeEach(function () {
    kuzzle = new Kuzzle();
    kuzzle.removeAllListeners();
    kuzzle.log = new (winston.Logger)({transports: [new (winston.transports.Console)({level: 'silent'})]});
  });

  it('should be rejected on init when a hook is undefined in config', function () {
    var pInit;

    kuzzle.config = {
      hooks: badHooksConfig
    };
    pInit = kuzzle.hooks.init();

    return should(pInit).be.rejected();
  });

  it('should be resolve when the config is valid', function () {
    var pInit;

    kuzzle.config = {
      hooks: hooksConfig
    };
    pInit = kuzzle.hooks.init();

    return should(pInit).be.fulfilled();
  });

  it('should attach event and trigger corresponding function according to config file', function (done) {
    kuzzle.config = {
      hooks: hooksConfig
    };
    kuzzle.hooks.init();

    should(kuzzle.hooks.list).have.property('write');
    should(kuzzle.hooks.list.write).be.an.Object();

    should(kuzzle.listeners('data:create')).be.an.Array();
    should(kuzzle.listeners('data:create').length).be.exactly(1);
    should(kuzzle.listeners('data:update')).be.an.Array();
    should(kuzzle.listeners('data:update').length).be.exactly(1);

    should(kuzzle.listeners('data:create')[0]).be.a.Function();
    should(kuzzle.listeners('data:update')[0]).be.a.Function();

    done();

  });
});