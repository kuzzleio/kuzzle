const
  path = require('path'),
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
    kuzzle,
    globStub;

  afterEach(() => {
    mockrequire.stopAll();
  });

  beforeEach(() => {
    fsStub = {
      accessSync: sinon.stub(),
      constants: {},
      copySync: sinon.stub(),
      createReadStream: sinon.stub().returns({pipe: sinon.stub().returnsThis(), on: sinon.stub().callsArgWith(1)}),
      createWriteStream: sinon.stub(),
      ensureDirSync: sinon.stub(),
      mkdirsSync: sinon.stub(),
      readdir: sinon.stub(),
      readdirSync: sinon.stub(),
      removeSync: sinon.stub(),
      unlink: sinon.stub(),
      unlinkSync: sinon.stub(),
      stat: sinon.stub(),
      statSync: sinon.stub(),
      writeFileSync: sinon.stub(),
    };

    coreStub = sinon.stub().returns({});
    getAllStatsStub = sinon.stub().returns(Promise.resolve({hits: [{stats: 42}]}));

    const globMock = function (pattern, cb) {
      if (typeof cb === 'function') {
        return cb(null, ['core']);
      }
    };
    globMock.sync = sinon.stub();
    globStub = sinon.spy(globMock);

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
    mockrequire('glob', globStub);

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

          should(fsStub.createReadStream.getCall(0).args[0]).be.exactly('core');
          should(fsStub.createWriteStream).be.calledOnce();
          should(fsStub.createReadStream().pipe).be.called(2);

          should(fsStub.copySync.getCall(0).args[0]).be.exactly(process.argv[0]);
          should(fsStub.copySync.getCall(0).args[1]).be.exactly(baseDumpPath.concat('/node'));
        });
    });

    it('should copy pm2 logs and error files if any', () => {
      const baseDumpPath = '/tmp/'.concat((new Date()).getFullYear());
      process.env.pm_err_log_path = '/foo/bar/baz.log';

      fsStub.readdir.yields(null, ['baz.log', 'baz-42.log', 'bar.log']);

      fsStub.stat
        .yields(new Error('test'));
      fsStub.stat
        .onFirstCall()
        .yields(null, {
          ctime: 42
        });
      fsStub.stat
        .onSecondCall()
        .yields(null, {
          ctime: 0
        });
      fsStub.stat
        .onThirdCall()
        .yields(null, {
          ctime: 3
        });

      return dump()
        .then(() => {
          should(fsStub.createReadStream)
            .be.calledWith('/foo/bar/baz.log')
            .be.calledWith('/foo/bar/bar.log');
          should(fsStub.createWriteStream)
            .be.calledWith(baseDumpPath + '/logs/baz.gz')
            .be.calledWith(baseDumpPath + '/logs/bar.gz');
        })
        .catch(e => {
          throw e;
        })
        .finally(() => {
          delete process.env.pm_err_log_path;
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
      fsStub.accessSync
        .withArgs('/tmp', 0)
        .returns();

      globStub.sync.returns([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);

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
      globStub.sync = sinon.spy(pattern => [path.join(path.dirname(pattern), 'core.gz')]);

      fsStub.accessSync.throws(new Error('no coredump here'));
      fsStub.accessSync
        .withArgs('/tmp', 0)
        .returns();

      return dump()
        .then(() => {
          for (let i = 1; i < 8; i++) {
            should(globStub.sync)
              .be.calledWith(`/tmp/${i}/core*`);
            should(fsStub.unlinkSync)
              .be.calledWith(`/tmp/${i}/core.gz`);
          }
          for (let i = 9; i < 11; i++) {
            should(globStub.sync)
              .not.be.calledWith(`/tmp/${i}/core*`);
          }
        });
    });
  });
});

