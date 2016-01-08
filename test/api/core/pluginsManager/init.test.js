var
  should = require('should'),
  rewire = require('rewire'),
  PluginsManager = rewire('../../../../lib/api/core/pluginsManager');

describe('Plugins manager initialization', function () {
  var
    kuzzle = {
      config: {
        pluginsManager: {}
      }
    },
    installed = false,
    configWritten = false,
    locked = false;

  before(function () {
    PluginsManager.__set__('console', {
      log: () => {},
      error: () => {}
    });

    PluginsManager.__set__('installPlugins', function () {
      installed = true;
      return true;
    });

    PluginsManager.__set__('fs', {
      writeFileSync: function () {
        configWritten = true;
        return false;
      },
      existsSync: function () { return locked; }
    });
  });

  beforeEach(function () {
    installed = false;
    configWritten = false;
    locked = false;
  });

  it('should exit Kuzzle if nodejs does not support sync fs methods', function (done) {
    var exitted = false;

    PluginsManager.__with__({
      childProcess: {
        hasOwnProperty: () => { return false; }
      },
      process: {
        exit: () => exitted = true
      }
    })(function () {
      var pluginManager = new PluginsManager(kuzzle);
      pluginManager.init(true, false)
        .then(() => {
          should(exitted).be.true();
          done();
        })
        .catch(err => done(err));
    });
  });

  it('should wait for the lock to be released before installing plugins', function (done) {
    var
      released = false;

    this.timeout(100);

    PluginsManager.__with__({
      lockfile: {
        lock: function (foo, bar, cb) {
          setTimeout(function () {
            if (installed) {
              return done(new Error('Plugin installation started before locks were released'));
            }

            cb(null, function () { released = true; });
          }, 20);
        }
      }
    })(function () {
      var pluginManager = new PluginsManager(kuzzle);
      pluginManager.init(true, false)
        .then(() => {
          should(installed).be.true();
          should(released).be.true();
          should(configWritten).be.true();
          done();
        })
        .catch(err => done(err));
    });
  });

  it('should not install plugins if locked by another instance', function (done) {
    var
      released = false;

    this.timeout(100);
    locked = true;

    PluginsManager.__with__({
      lockfile: {
        lock: function (foo, bar, cb) {
          setTimeout(function () {
            if (installed) {
              return done(new Error('Plugin installation started before locks were released'));
            }

            cb(null, function () { released = true; });
          }, 20);
        }
      }
    })(function () {
      var pluginManager = new PluginsManager(kuzzle);
      pluginManager.init(true, false)
        .then(() => {
          should(installed).be.false();
          should(released).be.true();
          should(configWritten).be.false();
          done();
        })
        .catch(err => done(err));
    });
  });
});
