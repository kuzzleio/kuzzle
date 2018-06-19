const
  rewire = require('rewire'),
  should = require('should'),
  sinon = require('sinon'),
  BadRequestError = require('kuzzle-common-objects').errors.BadRequestError,
  KuzzleMock = require('../../mocks/kuzzle.mock'),
  Request = require('kuzzle-common-objects').Request,
  AdminController = rewire('../../../lib/api/controllers/adminController'),
  mockrequire = require('mock-require'),
  path = require('path');


describe('Test: admin controller', () => {
  let
    adminController,
    kuzzle,
    request;

  beforeEach(() => {
    kuzzle = new KuzzleMock();

    adminController = new AdminController(kuzzle);
    request = new Request({ controller: 'admin' });
  });

  describe('#resetCache', () => {
    let flushdbStub = sinon.stub();

    beforeEach(() => {
      request.action = 'resetCache';
    });

    it('should flush the cache for the specified database', done => {
      kuzzle.services.list.memoryStorage.flushdb = flushdbStub.returns();
      request.input.args.database = 'memoryStorage';

      adminController.resetCache(request)
        .then(() => {
          should(flushdbStub).be.calledOnce();
          done();
        })
        .catch(error => done(error));
    });

    it('should raise an error if database does not exist', done => {
      request.input.args.database = 'city17';

      try {
        adminController.resetCache(request);
        done(new Error('Should not resolves'));
      } catch (e) {
        should(e).be.instanceOf(BadRequestError);
        done();
      }
    });
  });

  describe('#resetKuzzleData', () => {
    beforeEach(() => {
      request.action = 'resetKuzzleData';
    });

    it('should erase the internal ES & Redis dbs', done => {
      adminController.resetKuzzleData(request);

      setTimeout(() => {
        should(kuzzle.repositories.user.truncate).be.calledOnce();
        should(kuzzle.internalEngine.deleteIndex).be.calledOnce();
        should(kuzzle.services.list.internalCache.flushdb).be.calledOnce();

        should(kuzzle.indexCache.remove)
          .be.calledOnce()
          .be.calledWithExactly('internalIndex');

        should(kuzzle.internalEngine.bootstrap.all).be.calledOnce();
        should(kuzzle.validation).be.an.Object();
        should(kuzzle.start).be.a.Function();

        sinon.assert.callOrder(
          kuzzle.internalEngine.deleteIndex,
          kuzzle.services.list.internalCache.flushdb,
          kuzzle.indexCache.remove,
          kuzzle.internalEngine.bootstrap.all
        );
        done();
      }, 50);
    });
  });

  describe('#resetSecurity', () => {
    beforeEach(() => {
      request.action = 'resetKuzzleData';
    });

    it('should scroll and delete all registered users, profiles and roles', done => {
      adminController.resetSecurity(request);

      setTimeout(() => {
        should(kuzzle.repositories.user.truncate).be.calledOnce();
        should(kuzzle.repositories.profile.truncate).be.calledOnce();
        should(kuzzle.repositories.role.truncate).be.calledOnce();
        should(kuzzle.internalEngine.bootstrap.createDefaultProfiles).be.calledOnce();
        should(kuzzle.internalEngine.bootstrap.createDefaultRoles).be.calledOnce();

        sinon.assert.callOrder(
          kuzzle.repositories.user.truncate,
          kuzzle.repositories.profile.truncate,
          kuzzle.repositories.role.truncate,
          kuzzle.internalEngine.bootstrap.createDefaultProfiles,
          kuzzle.internalEngine.bootstrap.createDefaultRoles
        );
        done();
      }, 50);
    });
  });

  describe('#resetDatabase', () => {
    beforeEach(() => {
      request.action = 'resetDatabase';
    });

    it('remove all indexes handled by Kuzzle', done => {
      const deleteIndex = kuzzle.services.list.storageEngine.deleteIndex;
      kuzzle.indexCache.indexes = { halflife3: [], borealis: [], confirmed: [], '%kuzzle': [] };

      adminController.resetDatabase(request);

      setTimeout(() => {
        should(deleteIndex.callCount).be.eql(3);
        should(deleteIndex.getCall(0).args[0].input.resource.index).be.eql('halflife3');
        should(deleteIndex.getCall(1).args[0].input.resource.index).be.eql('borealis');
        should(deleteIndex.getCall(2).args[0].input.resource.index).be.eql('confirmed');
        should(kuzzle.indexCache.indexes).be.eql({ '%kuzzle': [] });

        done();
      }, 50);
    });
  });

  describe('#dump', () => {
    let
      fsStub,
      coreStub,
      getAllStatsStub,
      globStub;

    afterEach(() => {
      mockrequire.stopAll();
      AdminController.__set__('_dump', false);
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

      const AdminControllerReRequired = mockrequire.reRequire('../../../lib/api/controllers/adminController');
      adminController = new AdminControllerReRequired(kuzzle);

      request.action = 'dump';
      kuzzle.config.dump.enabled = true;
    });

    it('should throw an error if a dump is in progress', () => {
      AdminController.__set__('_dump', true);
      adminController = new AdminController(kuzzle);

      return should(() => {
        adminController.dump(request);
      }).throw(BadRequestError);
    });

    it('should throw an error if dump is disabled by configuration', done => {
      kuzzle.config.dump.enabled = false;

      try {
        adminController.dump(request);
        done(new Error('Should throw an error if dump is disabled'));
      }
      catch (e) {
        should(e).be.instanceOf(BadRequestError);
        done();
      }
    });

    describe('#dump', () => {
      beforeEach(() => {
        // deactivating the cleanUpHistory method
        fsStub.accessSync.throws(new Error('deactivated'));
      });

      it('should generate dump files', done => {
        let
          processDump,
          osDump,
          baseDumpPath = '/tmp/'.concat((new Date()).getFullYear());

        adminController.dump(request);
        setTimeout(() => {
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

          done();
        }, 50);
      });

      it('should copy pm2 logs and error files if any', done => {
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

        adminController.dump(request);

        setTimeout(() => {
          try {
            should(fsStub.createReadStream)
              .be.calledWith('/foo/bar/baz.log')
              .be.calledWith('/foo/bar/bar.log');
            should(fsStub.createWriteStream)
              .be.calledWith(baseDumpPath + '/logs/baz.gz')
              .be.calledWith(baseDumpPath + '/logs/bar.gz');

            delete process.env.pm_err_log_path;
            done();
          }
          catch (e) {
            delete process.env.pm_err_log_path;
            done(e);
          }
        }, 50);
      });
    });

    describe('#cleanHistory', () => {
      beforeEach(() => {
        fsStub.statSync.returns({
          isDirectory: () => true,
          birthtime: new Date('1979-12-28 14:56')
        });
      });

      it('should do nothing if the dump path is not reachable', done => {
        fsStub.accessSync.throws(new Error('foobar'));

        adminController.dump(request);

        setTimeout(() => {
          should(fsStub.readdirSync).not.be.called();
          done();
        }, 50);
      });

      it('should not delete reports nor coredumps if limits are not reached', done => {
        fsStub.readdirSync.returns(['foo', 'bar']);

        adminController.dump(request);

        setTimeout(() => {
          should(fsStub.removeSync).not.be.called();
          done();
        }, 50);
      });

      it('should delete reports directories if over the limit', done => {
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

        adminController.dump(request);
        setTimeout(() => {
          // readdir returns 9 directory + 1 non-directory
          // the limit is set to 5, so we should remove
          // (9 - 5 + 1) directories
          // (+1 because we are about to create a new one,
          // and we don't want the limit to be exceeded)
          should(fsStub.removeSync.callCount).be.eql(5);
          done();
        }, 50);
      });

      it('should delete coredumps in reports directories, if over the limit', done => {
        // do not let directory removals interfers with coredump removals
        kuzzle.config.dump.history.reports = 100;

        fsStub.readdirSync.returns([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
        globStub.sync = sinon.spy(pattern => [path.join(path.dirname(pattern), 'core.gz')]);

        fsStub.accessSync.throws(new Error('no coredump here'));
        fsStub.accessSync
          .withArgs('/tmp', 0)
          .returns();

        adminController.dump(request);
        setTimeout(() => {
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

          done();
        }, 50);
      });
    });
  });

  describe('#shutdown', () => {
    let
      originalKill;

    beforeEach(() => {
      originalKill = process.kill;
      Object.defineProperty(process, 'kill', {
        value: sinon.stub()
      });

      request.action = 'dump';
    });

    afterEach(() => {
      Object.defineProperty(process, 'kill', {
        value: originalKill
      });
      AdminController.__set__('_shutdown', false);
    });

    it('should throw an error if shutdown is in progress', () => {
      AdminController.__set__('_shutdown', true);
      adminController = new AdminController(kuzzle);

      return should(() => {
        adminController.shutdown(request);
      }).throw(BadRequestError);
    });

    it('should send a SIGTERM', done => {
      adminController.shutdown(request);

      setTimeout(() => {
        should(process.kill).be.calledOnce();
        should(process.kill.getCall(0).args[0]).be.eql(process.pid);
        should(process.kill.getCall(0).args[1]).be.eql('SIGTERM');
        done();
      }, 50);
    });
  });

});
