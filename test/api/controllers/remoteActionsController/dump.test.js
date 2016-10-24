var
  should = require('should'),
  sinon = require('sinon'),
  rewire = require('rewire'),
  sandbox = sinon.sandbox.create();


describe('Test: dump', () => {
  var
    writeFileSyncSpy,
    copySyncSpy,
    mkdirpSyncSpy,
    coreSpy,
    consoleLogSpy,
    getAllStatsSpy,
    dump,
    kuzzle;

  afterEach(() => {
    sandbox.restore();
  });

  beforeEach(() => {
    writeFileSyncSpy = sandbox.spy();
    copySyncSpy = sandbox.spy();
    mkdirpSyncSpy = sandbox.spy();
    coreSpy = sandbox.spy();
    consoleLogSpy = sandbox.spy();
    getAllStatsSpy = sandbox.stub().returns(Promise.resolve({hits: [{stats: 42}]}));

    kuzzle = {
      config: {
        dump: {
          path: '/tmp',
          dateFormat: 'YYYY'
        }
      },
      pluginsManager: {
        plugins: {
          'foo': {}
        }
      },
      statistics: {
        getAllStats: getAllStatsSpy
      }
    };

    dump = rewire('../../../../lib/api/controllers/remoteActions/dump');

    dump.__set__('fs', {
      writeFileSync: writeFileSyncSpy,
      copySync: copySyncSpy
    });

    dump.__set__('mkdirp', {
      sync: mkdirpSyncSpy
    });

    dump.__set__('core', coreSpy);
    dump.__set__('console', {
      log: consoleLogSpy
    });

    dump = dump(kuzzle);
  });

  it('should return computed dump path', done => {
    var expectedDumpPath = '/tmp/'.concat((new Date()).getFullYear()).concat('-tests');
    var requestObject = {
      data: {
        body: {
          sufix: 'tests'
        }
      }
    };

    dump(requestObject)
      .then(dumpPath => {
        should(dumpPath).be.exactly(expectedDumpPath);
        done();
      })
      .catch(error => done(error));
  });

  it('should generate dump files', done => {
    var
      processDump,
      osDump,
      baseDumpPath = '/tmp/'.concat((new Date()).getFullYear());

    dump()
      .then(() => {
        should(mkdirpSyncSpy.getCall(0).args[0]).be.exactly(baseDumpPath);

        should(writeFileSyncSpy.getCall(0).args[0]).be.exactly(baseDumpPath.concat('/config.json'));
        should(writeFileSyncSpy.getCall(0).args[1]).be.exactly(JSON.stringify(kuzzle.config, null, ' ').concat('\n'));

        should(writeFileSyncSpy.getCall(1).args[0]).be.exactly(baseDumpPath.concat('/plugins.json'));
        should(writeFileSyncSpy.getCall(1).args[1]).be.exactly(JSON.stringify(kuzzle.pluginsManager.plugins, null, ' ').concat('\n'));

        should(writeFileSyncSpy.getCall(2).args[0]).be.exactly(baseDumpPath.concat('/nodejs.json'));
        processDump = JSON.parse(writeFileSyncSpy.getCall(2).args[1]);
        should(processDump).have.keys('env', 'config', 'argv', 'versions', 'release', 'moduleLoadList');

        should(writeFileSyncSpy.getCall(3).args[0]).be.exactly(baseDumpPath.concat('/os.json'));
        osDump = JSON.parse(writeFileSyncSpy.getCall(3).args[1]);
        should(osDump).have.keys('platform', 'loadavg', 'uptime', 'cpus', 'mem', 'networkInterfaces');
        should(osDump.mem).have.keys('total', 'free');

        should(writeFileSyncSpy.getCall(4).args[0]).be.exactly(baseDumpPath.concat('/statistics.json'));
        should(writeFileSyncSpy.getCall(4).args[1]).be.exactly(JSON.stringify([{stats: 42}], null, ' ').concat('\n'));

        should(coreSpy.getCall(0).args[0]).be.exactly(baseDumpPath.concat('/core'));

        should(copySyncSpy.getCall(0).args[0]).be.exactly(process.argv[0]);
        should(copySyncSpy.getCall(0).args[1]).be.exactly(baseDumpPath.concat('/node'));
        done();
      })
      .catch(error => done(error));
  });

  it('should copy pm2 logs files if any', done => {
    var baseDumpPath = '/tmp/'.concat((new Date()).getFullYear());
    process.env.pm_log_path = '/tmp/logs/pm2.logs';

    dump()
      .then(() => {
        should(copySyncSpy.getCall(0).args[0]).be.exactly('/tmp/logs');
        should(copySyncSpy.getCall(0).args[1]).be.exactly(baseDumpPath.concat('/logs'));
        done();
      })
      .catch(error => done(error));
  });
});

