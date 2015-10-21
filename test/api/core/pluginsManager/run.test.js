var
  should = require('should'),
  PluginsManager = require.main.require('lib/api/core/pluginsManager'),
  EventEmitter = require('eventemitter2').EventEmitter2;

require('should-promised');

describe('Test plugins manager run', function () {

  it('should do nothing on run if plugin is not activated', function () {
    var
      pluginsManager = new PluginsManager ({}),
      isInitialized = false;

    pluginsManager.plugins = [{
      object: {
        init: function () {
          isInitialized = true;
        }
      },
      activated: false
    }];

    pluginsManager.run();
    should(isInitialized).be.false();
  });

  it('should attach event hook on kuzzle object', function (done) {
    var
      kuzzle = new EventEmitter({
        wildcard: true,
        maxListeners: 30,
        delimiter: ':'
      }),
      pluginsManager = new PluginsManager (kuzzle);

    pluginsManager.plugins = [{
      object: {
        init: function () {},
        hooks: {
          'test': 'myFunc'
        },
        myFunc: function () {
          done();
        }
      },
      activated: true
    }];

    pluginsManager.run();
    kuzzle.emit('test');
  });

  it('should attach event hook with wildcard on kuzzle object', function (done) {
    var
      kuzzle = new EventEmitter({
        wildcard: true,
        maxListeners: 30,
        delimiter: ':'
      }),
      pluginsManager = new PluginsManager (kuzzle);

    pluginsManager.plugins = [{
      object: {
        init: function () {},
        hooks: {
          'foo:*': 'myFunc'
        },
        myFunc: function () {
          done();
        }
      },
      activated: true
    }];

    pluginsManager.run();
    kuzzle.emit('foo:bar');
  });

  it('should attach pipes event', function (done) {
    var
      kuzzle = new EventEmitter({
        wildcard: true,
        maxListeners: 30,
        delimiter: ':'
      }),
      pluginsManager = new PluginsManager (kuzzle),
      isCalled = false;

    pluginsManager.plugins = [{
      object: {
        init: function () {},
        pipes: {
          'foo': 'myFunc'
        },
        myFunc: function (object, callback) {
          isCalled = true;
          callback();
        }
      },
      activated: true
    }];

    pluginsManager.run();
    pluginsManager.trigger('foo')
      .then(function () {
        should(isCalled).be.true();
        done();
      });
  });

  it('should attach pipes event with wildcard', function (done) {
    var
      kuzzle = new EventEmitter({
        wildcard: true,
        maxListeners: 30,
        delimiter: ':'
      }),
      pluginsManager = new PluginsManager (kuzzle),
      isCalled = false;

    pluginsManager.plugins = [{
      object: {
        init: function () {},
        pipes: {
          'foo:*': 'myFunc'
        },
        myFunc: function (object, callback) {
          isCalled = true;
          callback();
        }
      },
      activated: true
    }];

    pluginsManager.run();
    pluginsManager.trigger('foo:bar')
      .then(function () {
        should(isCalled).be.true();
        done();
      });
  });

  it('should attach pipes event and reject if an attached function return an error', function () {
    var
      kuzzle = new EventEmitter({
        wildcard: true,
        maxListeners: 30,
        delimiter: ':'
      }),
      pluginsManager = new PluginsManager (kuzzle);

    pluginsManager.plugins = [{
      object: {
        init: function () {},
        pipes: {
          'foo:bar': 'myFunc'
        },
        myFunc: function (object, callback) {
          callback(true);
        }
      },
      activated: true
    }];

    pluginsManager.run();
    should(pluginsManager.trigger('foo:bar')).be.rejected();
  });
});