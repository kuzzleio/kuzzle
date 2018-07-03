const
  mockrequire = require('mock-require'),
  rewire = require('rewire'),
  sinon = require('sinon'),
  path = require('path'),
  should = require('should'),
  BadRequestError = require('kuzzle-common-objects').errors.BadRequestError,
  KuzzleMock = require('../../mocks/kuzzle.mock');

/*
 /!\ In these tests, the promise returned by shutdown
 do not mark the function as "finished".
 The promise is resolved before halting Kuzzle in case
 the shutdown is initiated using the CLI, to allow it
 to finish and exit while Kuzzle is shutting down.
 */

describe('Test: core/janitor', () => {
  let
    Janitor,
    janitor,
    kuzzle;

  beforeEach(() => {
    kuzzle = new KuzzleMock();

    Janitor = require('../../../lib/api/core/janitor');
    janitor = new Janitor(kuzzle);
  });

  describe('#dump', () => {
    let
      fsStub,
      coreStub,
      getAllStatsStub,
      suffix,
      globStub;

    afterEach(() => {
      mockrequire.stopAll();
      janitor._dump = false;
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

      kuzzle.config.dump = {
        history: {
          coredump: 3,
          reports: 5
        },
        path: '/tmp',
        dateFormat: 'YYYY'
      };
      kuzzle.pluginsManager.getPluginsDescription.returns({ foo: {} });
      kuzzle.pluginsManager.plugins = { foo: {} };
      kuzzle.statistics.getAllStats = getAllStatsStub;

      mockrequire('fs-extra', fsStub);
      mockrequire('dumpme', coreStub);
      mockrequire('glob', globStub);

      Janitor = mockrequire.reRequire('../../../lib/api/core/janitor');
      janitor = new Janitor(kuzzle);

      kuzzle.config.dump.enabled = true;
      janitor._dump = false;
      suffix = 'dump-me-master';
    });

    it('should throw an error if a dump is in progress', () => {
      janitor._dump = true;

      return should(() => {
        janitor.dump(suffix);
      }).throw(BadRequestError);
    });

    it('should throw an error if dump is disabled by configuration', () => {
      kuzzle.config.dump.enabled = false;

      return should(() => {
        janitor.dump(suffix);
      }).throw(BadRequestError);
    });

    describe('#dump', () => {
      beforeEach(() => {
        // deactivating the cleanUpHistory method
        fsStub.accessSync.throws(new Error('deactivated'));
      });

      it('should generate dump files', () => {
        let
          processDump,
          osDump,
          baseDumpPath = `/tmp/${(new Date()).getFullYear()}-${suffix}`;

        return janitor.dump(suffix)
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

        return janitor.dump(suffix)
          .then(() => {
            try {
              should(fsStub.createReadStream)
                .be.calledWith('/foo/bar/baz.log')
                .be.calledWith('/foo/bar/bar.log');
              should(fsStub.createWriteStream)
                .be.calledWith(baseDumpPath + '/logs/baz.gz')
                .be.calledWith(baseDumpPath + '/logs/bar.gz');

              delete process.env.pm_err_log_path;
            }
            catch (e) {
              delete process.env.pm_err_log_path;
            }
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

        return janitor.dump(suffix)
          .then(() => {
            should(fsStub.readdirSync).not.be.called();
          });
      });

      it('should not delete reports nor coredumps if limits are not reached', () => {
        fsStub.readdirSync.returns(['foo', 'bar']);

        return janitor.dump(suffix)
          .then(() => {
            should(fsStub.removeSync).not.be.called();
          });
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

        return janitor.dump(suffix)
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

        return janitor.dump(suffix)
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

  describe('#shutdown', () => {
    let
      pm2Mock,
      processMock;

    beforeEach(() => {
      kuzzle.funnel.remainingRequests = 0;

      pm2Mock = {
        list: sinon.stub(),
        restart: sinon.stub(),
        delete: sinon.stub()
      };

      processMock = {
        exit: sinon.stub(),
        pid: process.pid
      };

      mockrequire('pm2', pm2Mock);
      mockrequire.reRequire('../../../lib/api/core/janitor');
      Janitor = rewire('../../../lib/api/core/janitor');

      Janitor.__set__({
        process: processMock,
        // prevent waiting seconds for unit tests
        setTimeout: sinon.spy(function (...args) { setImmediate(args[0]); })
      });

      janitor = new Janitor(kuzzle);
    });

    afterEach(() => {
      mockrequire.stopAll();
    });

    it('should exit immediately if unable to retrieve the PM2 process list', done => {
      pm2Mock.list.yields(new Error('foo'));

      janitor.shutdown(kuzzle, sinon.stub())
        .then(() => {
          setTimeout(() => {
            should(kuzzle.entryPoints.dispatch)
              .calledOnce()
              .calledWith('shutdown');

            should(processMock.exit).calledOnce().calledWith(0);
            should(pm2Mock.delete).not.be.called();
            should(pm2Mock.restart).not.be.called();
            done();
          }, 50);
        });
    });

    it('should exit immediately if kuzzle was not started with PM2', done => {
      pm2Mock.list.yields(null, []);

      janitor.shutdown(kuzzle, sinon.stub())
        .then(() => {
          setTimeout(() => {
            should(kuzzle.entryPoints.dispatch)
              .calledOnce()
              .calledWith('shutdown');

            should(processMock.exit).calledOnce().calledWith(0);
            should(pm2Mock.delete).not.be.called();
            should(pm2Mock.restart).not.be.called();
            done();
          }, 50);
        });
    });

    it('should restart Kuzzle instead of stopping it if the PM2 watcher is active', done => {
      pm2Mock.list.yields(null, [{
        pid: process.pid,
        pm_id: 'foobar',
        pm2_env: {
          watch: true
        }
      }]);

      janitor.shutdown(kuzzle, sinon.stub())
        .then(() => {
          setTimeout(() => {
            should(kuzzle.entryPoints.dispatch)
              .calledOnce()
              .calledWith('shutdown');

            should(processMock.exit).not.be.called();
            should(pm2Mock.delete).not.be.called();
            should(pm2Mock.restart).be.calledOnce().calledWith('foobar');
            done();
          }, 50);
        });
    });

    it('should delete entries from PM2 if PM2 watcher is inactive and halt Kuzzle', done => {
      pm2Mock.list.yields(null, [{
        pid: process.pid,
        pm_id: 'foobar',
        pm2_env: {}
      }]);

      janitor.shutdown(kuzzle, sinon.stub())
        .then(() => {
          // should wait until called a second time by PM2
          setTimeout(() => {
            should(kuzzle.entryPoints.dispatch)
              .calledOnce()
              .calledWith('shutdown');

            should(processMock.exit).not.be.called();
            should(pm2Mock.delete).be.calledOnce().calledWith('foobar');
            should(pm2Mock.restart).not.be.called();

            janitor.shutdown(kuzzle, sinon.stub());

            setTimeout(() => {
              should(kuzzle.entryPoints.dispatch)
                .calledOnce()
                .calledWith('shutdown');

              should(processMock.exit).be.calledOnce().calledWith(0);
              should(pm2Mock.delete).be.calledOnce().calledWith('foobar');
              should(pm2Mock.restart).not.be.called();
              done();
            }, 200);
          }, 50);
        });
    });

    it('should wait for the funnel to finish remaining requests before shutting down', done => {
      // security against a wrong "success" test
      let remainingChanged = false;

      kuzzle.funnel.remainingRequests = 123;

      pm2Mock.list.yields(new Error('foo'));

      janitor.shutdown(kuzzle, sinon.stub())
        .then(() => {
          setTimeout(() => {
            should(remainingChanged).be.true();
            should(kuzzle.entryPoints.dispatch)
              .calledOnce()
              .calledWith('shutdown');

            should(processMock.exit).calledOnce().calledWith(0);
            should(pm2Mock.delete).not.be.called();
            should(pm2Mock.restart).not.be.called();
            done();
          }, 50);
        });

      setTimeout(() => {
        should(kuzzle.entryPoints.dispatch)
          .calledOnce()
          .calledWith('shutdown');

        should(pm2Mock.delete).not.be.called();
        should(pm2Mock.restart).not.be.called();
        should(processMock.exit).not.be.called();

        kuzzle.funnel.remainingRequests = 0;
        remainingChanged = true;
      }, 100);
    });
  });

});
