var
  rc = require('rc'),
  q = require('q'),
  should = require('should'),
  rewire = require('rewire'),
  sinon = require('sinon'),
  managePlugins = rewire('../../../../lib/api/controllers/remoteActions/managePlugins'),
  InternalEngine = require('../../../../lib/services/internalEngine'),
  lockFile = require('proper-lockfile'),
  sandbox;

require('sinon-as-promised')(q.Promise);

describe('Test: managePlugins remote action caller', function () {
  var
    exitStatus = -1,
    internalEngineStub;

  before(function () {
    process.exit = function (status) {
      exitStatus = status;
    };
  });

  beforeEach(() => {
    sandbox = sinon.sandbox.create();
    internalEngineStub = sandbox.stub(new InternalEngine({config:{}}));

    internalEngineStub.createInternalIndex.resolves();
    internalEngineStub.createOrReplace.resolves();
    sandbox.stub(lockFile, 'lock').yields(undefined, () => {});
  });

  afterEach(() => {
    sandbox.restore();
  });

  it('should raise an error if configuration file does not exist', () => {
    var options = {
      importConfig: 'config.json'
    };

    managePlugins.__set__({
      'DatabaseService': function () { return internalEngineStub; },
      'fs': {
        readFileSync: function () { throw new Error(); }
      }
    });
    should(managePlugins('test', options)).be.rejected();
  });

  it('should raise an error if the plugin is not registered in Kuzzle', () => {
    var options = {
      importConfig: 'config.json'
    };

    internalEngineStub.get.rejects();
    managePlugins.__set__({
      'DatabaseService': function () { return internalEngineStub; },
      'fs': {
        readFileSync: function () { return '{"test": true}'; }
      }
    });
    should(managePlugins('test', options)).be.rejected();
  });

  it('should raise an error if the file is not a json file', () => {
    var options = {
      importConfig: 'config.json'
    };

    internalEngineStub.get.rejects();
    managePlugins.__set__({
      'DatabaseService': function () { return internalEngineStub; },
      'fs': {
        readFileSync: function () { return 'not a json'; }
      }
    });
    should(managePlugins('test', options)).be.rejected();
  });

  it('should import the configuration file for a given plugin properly', () => {
    var
      options = {
        importConfig: 'config.json'
      };

    internalEngineStub.get.resolves({_source: {}});
    managePlugins.__set__({
      'DatabaseService': function () { return internalEngineStub; },
      'fs': {
        readFileSync: function () { return '{"test": true}'; }
      }
    });

    should(managePlugins('test', options)).be.fulfilled();
  });

});
