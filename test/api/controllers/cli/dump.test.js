const
  should = require('should'),
  sinon = require('sinon'),
  mockrequire = require('mock-require'),
  Request = require('kuzzle-common-objects').Request;

describe('Test: dump', () => {
  let
    fsStub,
    coreStub,
    getAllStatsStub,
    dump,
    kuzzle;

  afterEach(() => {
    mockrequire.stopAll();
  });

  beforeEach(() => {
    fsStub = {
      constants: {},
      accessSync: sinon.stub(),
      copySync: sinon.stub(),
      statSync: sinon.stub(),
      mkdirsSync: sinon.stub(),
      readdirSync: sinon.stub(),
      removeSync: sinon.stub(),
      writeFileSync: sinon.stub()
    };

    coreStub = sinon.stub().returns({});
    getAllStatsStub = sinon.stub().returns(Promise.resolve({hits: [{stats: 42}]}));

    kuzzle = {
      config: {
        dump: {
          history: {
            coredump: 3,
            reports: 5
          },
          path: '/tmp',
          dateFormat: 'YYYY'
        }
      },
      pluginsManager: {
        getPluginsFeatures: () => { return {'foo': {}}; },
        plugins: {
          'foo': {}
        }
      },
      statistics: {
        getAllStats: getAllStatsStub
      }
    };

    mockrequire('fs-extra', fsStub);
    mockrequire('dumpme', coreStub);

    const dumpfactory = mockrequire.reRequire('../../../../lib/api/controllers/cli/dump');
    dump = dumpfactory(kuzzle);
  });

  describe('#dump', () => {
    beforeEach(() => {
      // deactivating the cleanUpHistory method
      fsStub.accessSync.throws(new Error('deactivated'));
    });

    it('should return computed dump path', () => {
      const expectedDumpPath = '/tmp/'.concat((new Date()).getFullYear()).concat('-tests');

      return dump(new Request({suffix: 'tests'}))
        .then(dumpPath => should(dumpPath).be.exactly(expectedDumpPath));
    });

    it('should generate dump files', () => {
      let
        processDump,
        osDump,
        baseDumpPath = '/tmp/'.concat((new Date()).getFullYear());

      return dump()
        .then(() => {
          should(fsStub.mkdirsSync).be.calledOnce();
          should(fsStub.mkdirsSync.getCall(0).args[0]).be.exactly(baseDumpPath);

          should(fsStub.writeFileSync.getCall(0).args[0]).be.exactly(baseDumpPath.concat('/config.json'));
          should(fsStub.writeFileSync.getCall(0).args[1]).be.exactly(JSON.stringify(kuzzle.config, null, ' ').concat('\n'));

          should(fsStub.writeFileSync.getCall(1).args[0]).be.exactly(baseDumpPath.concat('/plugins.json'));
          should(fsStub.writeFileSync.getCall(1).args[1]).be.exactly(JSON.stringify(kuzzle.pluginsManager.plugins, null, ' ').concat('\n'));

          should(fsStub.writeFileSync.getCall(2).args[0]).be.exactly(baseDumpPath.concat('/nodejs.json'));
          processDump = JSON.parse(fsStub.writeFileSync.getCall(2).args[1]);
          should(processDump).have.keys('env', 'config', 'argv', 'versions', 'release', 'moduleLoadList');

          should(fsStub.writeFileSync.getCall(3).args[0]).be.exactly(baseDumpPath.concat('/os.json'));
          osDump = JSON.parse(fsStub.writeFileSync.getCall(3).args[1]);
          should(osDump).have.keys('platform', 'loadavg', 'uptime', 'cpus', 'mem', 'networkInterfaces');
          should(osDump.mem).have.keys('total', 'free');

          should(fsStub.writeFileSync.getCall(4).args[0]).be.exactly(baseDumpPath.concat('/statistics.json'));
          should(fsStub.writeFileSync.getCall(4).args[1]).be.exactly(JSON.stringify([{stats: 42}], null, ' ').concat('\n'));

          should(coreStub.firstCall.calledWith('gcore', baseDumpPath.concat('/core'))).be.true();

          should(fsStub.copySync.getCall(0).args[0]).be.exactly(process.argv[0]);
          should(fsStub.copySync.getCall(0).args[1]).be.exactly(baseDumpPath.concat('/node'));
        });
    });

    it('should copy pm2 logs files if any', () => {
      const baseDumpPath = '/tmp/'.concat((new Date()).getFullYear());
      process.env.pm_log_path = '/tmp/logs/pm2.logs';

      return dump()
        .then(() => {
          should(fsStub.copySync.getCall(0).args[0]).be.exactly('/tmp/logs');
          should(fsStub.copySync.getCall(0).args[1]).be.exactly(baseDumpPath.concat('/logs'));
        });
    });

    it('should copy pm2 logs and error files if any', () => {
      const baseDumpPath = '/tmp/'.concat((new Date()).getFullYear());
      process.env.pm_err_log_path = '/foo/bar/baz.log';

      return dump()
        .then(() => {
          should(fsStub.copySync.getCall(0).args[0]).be.exactly('/foo/bar');
          should(fsStub.copySync.getCall(0).args[1]).be.exactly(baseDumpPath.concat('/logs'));
        });
    });
  });

  describe('#cleanHistory', () => {
    beforeEach(() => {
      fsStub.statSync.returns({
        isDirectory: () => true,
        birthtime: new Date('1979-12-28 14:56')
      });
    });

    it('should do nothing if the dump path is not reachable', () => {
      fsStub.accessSync.throws(new Error('foobar'));

      return dump()
        .then(() => should(fsStub.readdirSync).not.be.called());
    });

    it('should not delete reports nor coredumps if limits are not reached', () => {
      fsStub.readdirSync.returns(['foo', 'bar']);

      return dump()
        .then(() => should(fsStub.removeSync).not.be.called());
    });

    it('should delete reports directories if over the limit', () => {
      fsStub.statSync.onSecondCall().returns({
        isDirectory: () => false,
        birthtime: new Date('1979-11-13 01:13')
      });

      fsStub.readdirSync.returns([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
      fsStub.accessSync.throws(new Error('no coredump here'));
      fsStub.accessSync.onFirstCall().returns();

      return dump()
        .then(() => {
          // readdir returns 9 directory + 1 non-directory
          // the limit is set to 5, so we should remove
          // (9 - 5 + 1) directories
          // (+1 because we are about to create a new one,
          // and we don't want the limit to be exceeded)
          should(fsStub.removeSync.callCount).be.eql(5);
        });
    });

    it('should delete coredumps in reports directories, if over the limit', () => {
      // do not let directory removals interfers with coredump removals
      kuzzle.config.dump.history.reports = 100;

      fsStub.readdirSync.returns([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);

      // throws every 2 calls (the 1st one does not count)
      for(let i = 1; i < 10; i+=2) {
        fsStub.accessSync.onCall(i).throws(new Error('no coredump here'));
      }

      return dump()
        .then(() => {
          // 10 directories, 1 coredump per 2 directories = 5 dumps in total
          // The limit is set to 3, so the method should remove
          // (5 - 3 + 1) = 3 coredumps
          // (+1 because we're about to create a new coredump)
          should(fsStub.removeSync.callCount).be.eql(3);
        });
    });
  });
});

