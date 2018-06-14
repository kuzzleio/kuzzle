const
  rewire = require('rewire'),
  should = require('should'),
  sinon = require('sinon'),
  Bluebird = require('bluebird'),
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
      kuzzle.services.list.memoryStorage.flushdb = flushdbStub.yields();
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

    it('should erase the internal ES & Redis dbs', () => {
      kuzzle.repositories.user.search.returns(Bluebird.resolve({total: 0, hits: []}));

      return adminController.resetKuzzleData(request)
        .then(() => {
          should(kuzzle.repositories.user.search).be.calledOnce();
          should(kuzzle.repositories.user.scroll).not.be.called();
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
        });
    });

    it('should scroll and delete all registered users', () => {
      kuzzle.repositories.user.search.returns(Bluebird.resolve({total: 5, scrollId: 'foobar', hits: [
        {_id: 'foo1' },
        {_id: 'foo2' },
        {_id: 'foo3' }
      ]}));

      kuzzle.repositories.user.scroll.onFirstCall().returns(Bluebird.resolve({
        total: 1,
        scrollId: 'foobar2',
        hits: [{_id: 'foo4'}]
      }));

      kuzzle.repositories.user.scroll.onSecondCall().returns(Bluebird.resolve({
        total: 1,
        scrollId: 'foobar2',
        hits: [{_id: 'foo5'}]
      }));

      return adminController.resetKuzzleData(request)
        .then(() => {
          should(kuzzle.repositories.user.search).be.calledOnce();
          should(kuzzle.repositories.user.scroll).be.calledTwice();

          should(kuzzle.repositories.user.scroll.getCall(0).args[0]).be.eql('foobar');
          should(kuzzle.repositories.user.scroll.getCall(1).args[0]).be.eql('foobar2');

          should(kuzzle.funnel.controllers.security.deleteUser.callCount).be.eql(5);
          should(kuzzle.funnel.controllers.security.deleteUser.getCall(0).args[0].input.resource._id).be.eql('foo1');
          should(kuzzle.funnel.controllers.security.deleteUser.getCall(1).args[0].input.resource._id).be.eql('foo2');
          should(kuzzle.funnel.controllers.security.deleteUser.getCall(2).args[0].input.resource._id).be.eql('foo3');
          should(kuzzle.funnel.controllers.security.deleteUser.getCall(3).args[0].input.resource._id).be.eql('foo4');
          should(kuzzle.funnel.controllers.security.deleteUser.getCall(4).args[0].input.resource._id).be.eql('foo5');
        });
    });
  });

  describe('#resetSecurity', () => {
    beforeEach(() => {
      request.action = 'resetKuzzleData';
    });

    it('should scroll and delete all registered users, profiles and roles', () => {
      kuzzle.repositories.user.search.returns(Bluebird.resolve({total: 5, scrollId: 'foobarUser', hits: [
        {_id: 'user1' },
        {_id: 'user2' },
        {_id: 'user3' }
      ]}));
      kuzzle.repositories.user.scroll.onFirstCall().returns(Bluebird.resolve({
        total: 1,
        scrollId: 'foobarUser2',
        hits: [{_id: 'user4'}]
      }));
      kuzzle.repositories.user.scroll.onSecondCall().returns(Bluebird.resolve({
        total: 1,
        scrollId: 'foobarUser2',
        hits: [{_id: 'user5'}]
      }));

      kuzzle.repositories.profile.search.returns(Bluebird.resolve({total: 5, scrollId: 'foobarProfile', hits: [
        {_id: 'profile1' },
        {_id: 'profile2' },
        {_id: 'profile3' }
      ]}));
      kuzzle.repositories.profile.scroll.onFirstCall().returns(Bluebird.resolve({
        total: 1,
        scrollId: 'foobarProfile2',
        hits: [{_id: 'profile4'}]
      }));
      kuzzle.repositories.profile.scroll.onSecondCall().returns(Bluebird.resolve({
        total: 1,
        scrollId: 'foobarProfile2',
        hits: [{_id: 'profile5'}]
      }));

      kuzzle.repositories.role.search.returns(Bluebird.resolve({total: 5, scrollId: 'foobarRole', hits: [
        {_id: 'role1' },
        {_id: 'role2' },
        {_id: 'role3' }
      ]}));
      kuzzle.repositories.role.scroll.onFirstCall().returns(Bluebird.resolve({
        total: 1,
        scrollId: 'foobarRole2',
        hits: [{_id: 'role4'}]
      }));
      kuzzle.repositories.role.scroll.onSecondCall().returns(Bluebird.resolve({
        total: 1,
        scrollId: 'foobarRole2',
        hits: [{_id: 'role5'}]
      }));

      return adminController.resetSecurity(request)
        .then(() => {
          should(kuzzle.repositories.user.search).be.calledOnce();
          should(kuzzle.repositories.user.scroll).be.calledTwice();

          should(kuzzle.repositories.user.scroll.getCall(0).args[0]).be.eql('foobarUser');
          should(kuzzle.repositories.user.scroll.getCall(1).args[0]).be.eql('foobarUser2');

          should(kuzzle.funnel.controllers.security.deleteUser.callCount).be.eql(5);
          should(kuzzle.funnel.controllers.security.deleteUser.getCall(0).args[0].input.resource._id).be.eql('user1');
          should(kuzzle.funnel.controllers.security.deleteUser.getCall(0).args[0].input.args.refresh).be.eql('wait_for');
          should(kuzzle.funnel.controllers.security.deleteUser.getCall(1).args[0].input.resource._id).be.eql('user2');
          should(kuzzle.funnel.controllers.security.deleteUser.getCall(2).args[0].input.resource._id).be.eql('user3');
          should(kuzzle.funnel.controllers.security.deleteUser.getCall(3).args[0].input.resource._id).be.eql('user4');
          should(kuzzle.funnel.controllers.security.deleteUser.getCall(4).args[0].input.resource._id).be.eql('user5');


          should(kuzzle.repositories.profile.search).be.calledOnce();
          should(kuzzle.repositories.profile.scroll).be.calledTwice();

          should(kuzzle.repositories.profile.scroll.getCall(0).args[0]).be.eql('foobarProfile');
          should(kuzzle.repositories.profile.scroll.getCall(1).args[0]).be.eql('foobarProfile2');

          should(kuzzle.funnel.controllers.security.deleteProfile.callCount).be.eql(5);
          should(kuzzle.funnel.controllers.security.deleteProfile.getCall(0).args[0].input.resource._id).be.eql('profile1');
          should(kuzzle.funnel.controllers.security.deleteProfile.getCall(0).args[0].input.args.refresh).be.eql('wait_for');
          should(kuzzle.funnel.controllers.security.deleteProfile.getCall(1).args[0].input.resource._id).be.eql('profile2');
          should(kuzzle.funnel.controllers.security.deleteProfile.getCall(2).args[0].input.resource._id).be.eql('profile3');
          should(kuzzle.funnel.controllers.security.deleteProfile.getCall(3).args[0].input.resource._id).be.eql('profile4');
          should(kuzzle.funnel.controllers.security.deleteProfile.getCall(4).args[0].input.resource._id).be.eql('profile5');


          should(kuzzle.repositories.role.search).be.calledOnce();
          should(kuzzle.repositories.role.scroll).be.calledTwice();

          should(kuzzle.repositories.role.scroll.getCall(0).args[0]).be.eql('foobarRole');
          should(kuzzle.repositories.role.scroll.getCall(1).args[0]).be.eql('foobarRole2');

          should(kuzzle.funnel.controllers.security.deleteRole.callCount).be.eql(5);
          should(kuzzle.funnel.controllers.security.deleteRole.getCall(0).args[0].input.resource._id).be.eql('role1');
          should(kuzzle.funnel.controllers.security.deleteRole.getCall(0).args[0].input.args.refresh).be.eql('wait_for');
          should(kuzzle.funnel.controllers.security.deleteRole.getCall(1).args[0].input.resource._id).be.eql('role2');
          should(kuzzle.funnel.controllers.security.deleteRole.getCall(2).args[0].input.resource._id).be.eql('role3');
          should(kuzzle.funnel.controllers.security.deleteRole.getCall(3).args[0].input.resource._id).be.eql('role4');
          should(kuzzle.funnel.controllers.security.deleteRole.getCall(4).args[0].input.resource._id).be.eql('role5');

          should(kuzzle.internalEngine.bootstrap.createDefaultRoles).be.calledOnce();
          should(kuzzle.internalEngine.bootstrap.createDefaultProfiles).be.calledOnce();
        });
    });
  });

  describe('#resetDatabase', () => {
    beforeEach(() => {
      request.action = 'resetDatabase';
    });

    it('remove all indexes handled by Kuzzle', () => {
      const deleteIndex = kuzzle.services.list.storageEngine.deleteIndex;
      kuzzle.indexCache.indexes = { halflife3: [], borealis: [], confirmed: [], '%kuzzle': [] };

      return adminController.resetDatabase(request)
        .then(() => {
          should(deleteIndex.callCount).be.eql(3);
          should(deleteIndex.getCall(0).args[0].input.resource.index).be.eql('halflife3');
          should(deleteIndex.getCall(1).args[0].input.resource.index).be.eql('borealis');
          should(deleteIndex.getCall(2).args[0].input.resource.index).be.eql('confirmed');
          should(kuzzle.indexCache.indexes).be.eql({ '%kuzzle': [] });
        });
    });
  });

  describe('#generateDump', () => {
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

      request.action = 'generateDump';
    });

    it('should throw an error if a dump is in progress', () => {
      AdminController.__set__('_dump', true);
      adminController = new AdminController(kuzzle);

      return should(() => {
        adminController.generateDump(request)
      }).throw(BadRequestError);
    });

    describe('#dump', () => {
      beforeEach(() => {
        // deactivating the cleanUpHistory method
        fsStub.accessSync.throws(new Error('deactivated'));
      });

      it('should return computed dump path', done => {
        request.input.args.suffix = 'tests';
        const expectedDumpPath = `/tmp/${(new Date()).getFullYear()}-tests`;

        adminController.generateDump(request)
          .then(dumpPath => {
            should(dumpPath).be.exactly(expectedDumpPath);
            done();
          })
          .catch(error => done(error));
      });

      it('should generate dump files', done => {
        let
          processDump,
          osDump,
          baseDumpPath = '/tmp/'.concat((new Date()).getFullYear());

        adminController.generateDump(request)
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

            done();
          })
          .catch(error => done(error));
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

        adminController.generateDump(request)
          .then(() => {
            should(fsStub.createReadStream)
              .be.calledWith('/foo/bar/baz.log')
              .be.calledWith('/foo/bar/bar.log');
            should(fsStub.createWriteStream)
              .be.calledWith(baseDumpPath + '/logs/baz.gz')
              .be.calledWith(baseDumpPath + '/logs/bar.gz');
            done();
          })
          .catch(e => {
            done(e);
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

        return adminController.generateDump(request)
          .then(() => should(fsStub.readdirSync).not.be.called());
      });

      it('should not delete reports nor coredumps if limits are not reached', () => {
        fsStub.readdirSync.returns(['foo', 'bar']);

        return adminController.generateDump(request)
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

        return adminController.generateDump(request)
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

        return adminController.generateDump(request)
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
      originalKill;

    beforeEach(() => {
      originalKill = process.kill;
      Object.defineProperty(process, 'kill', {
        value: sinon.stub()
      });

      request.action = 'generateDump';
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
        adminController.shutdown(request)
      }).throw(BadRequestError);
    });

    it('should send a SIGTERM', () => {
      return adminController.shutdown(request)
        .then(() => {
          should(process.kill).be.calledOnce();
          should(process.kill.getCall(0).args[0]).be.eql(process.pid);
          should(process.kill.getCall(0).args[1]).be.eql('SIGTERM');
        });
    });
  });

});
