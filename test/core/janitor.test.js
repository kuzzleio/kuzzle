'use strict';

const
  mockrequire = require('mock-require'),
  rewire = require('rewire'),
  sinon = require('sinon'),
  path = require('path'),
  should = require('should'),
  {
    errors: {
      BadRequestError,
      PreconditionError
    }
  } = require('kuzzle-common-objects'),
  KuzzleMock = require('../mocks/kuzzle.mock');

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
    kuzzle,
    runShutdown;

  beforeEach(() => {
    kuzzle = new KuzzleMock();

    runShutdown = sinon.stub().resolves();
    mockrequire('../../lib/util/shutdown', runShutdown);
    Janitor = mockrequire.reRequire('../../lib/core/janitor');
    Janitor = rewire('../../lib/core/janitor');
    janitor = new Janitor(kuzzle);
  });

  afterEach(() => {
    mockrequire.stopAll();
  });

  describe('#loadSecurities', () => {
    const securities = require('../mocks/securities.json');

    it('should create or replace roles', () => {
      kuzzle.funnel.processRequest.resolves(true);

      return janitor.loadSecurities({ roles: securities.roles })
        .then(() => {
          should(kuzzle.funnel.processRequest.callCount).be.eql(2);

          should(kuzzle.funnel.processRequest.getCall(1).args[0].input.action).be.eql('createOrReplaceRole');
          should(kuzzle.funnel.processRequest.getCall(0).args[0].input.resource._id).be.eql('driver');
          should(kuzzle.funnel.processRequest.getCall(0).args[0].input.body.controllers.document.actions['*']).be.eql(true);
        });
    });

    it('should create or replace profiles', () => {
      kuzzle.funnel.processRequest.resolves(true);

      return janitor.loadSecurities({ profiles: securities.profiles })
        .then(() => {
          should(kuzzle.funnel.processRequest.callCount).be.eql(2);

          should(kuzzle.funnel.processRequest.getCall(1).args[0].input.action).be.eql('createOrReplaceProfile');
          should(kuzzle.funnel.processRequest.getCall(1).args[0].input.resource._id).be.eql('customer');
          should(kuzzle.funnel.processRequest.getCall(1).args[0].input.body.policies[0].roleId).be.eql('customer');
        });
    });

    it('should delete then create users', () => {
      kuzzle.funnel.processRequest.resolves(true);

      return janitor.loadSecurities({ users: securities.users })
        .then(() => {
          should(kuzzle.funnel.processRequest.callCount).be.eql(3);

          should(kuzzle.funnel.processRequest.getCall(0).args[0].input.action).be.eql('mDeleteUsers');
          should(kuzzle.funnel.processRequest.getCall(0).args[0].input.body.ids).be.eql(['gfreeman', 'bcalhoun']);

          should(kuzzle.funnel.processRequest.getCall(1).args[0].input.action).be.eql('createUser');
          should(kuzzle.funnel.processRequest.getCall(1).args[0].input.resource._id).be.eql('gfreeman');
          should(kuzzle.funnel.processRequest.getCall(1).args[0].input.body.content.profileIds).be.eql(['driver']);
        });
    });

    it('should reject if the securities object is null', () => {
      return should(janitor.loadSecurities(null))
        .rejectedWith(BadRequestError, {
          id: 'api.assert.invalid_argument',
          message: 'Invalid argument "null". Expected: object'
        });
    });

    it('should reject if roles contains non-object properties', () => {
      return should(janitor.loadSecurities({
        roles: { foo: 123},
        profiles: securities.profiles,
        users: securities.users
      }))
        .rejectedWith(BadRequestError, {
          id: 'api.assert.invalid_argument',
          message: 'Invalid argument "123". Expected: object'
        });
    });

    it('should reject if profiles contains non-object properties', () => {
      return should(janitor.loadSecurities({
        roles: securities.roles,
        profiles: { foo: 123},
        users: securities.users
      }))
        .rejectedWith(BadRequestError, {
          id: 'api.assert.invalid_argument',
          message: 'Invalid argument "123". Expected: object'
        });
    });

    it('should reject if users contains non-object properties', () => {
      return should(janitor.loadSecurities({
        roles: securities.roles,
        profiles: securities.profiles,
        users: { foo: 123},
      }))
        .rejectedWith(BadRequestError, {
          id: 'api.assert.invalid_argument',
          message: 'Invalid argument "123". Expected: object'
        });
    });
  });

  describe('#loadFixtures', () => {
    const fixtures = require('../mocks/fixtures.json');

    it('create index and collection that does not exists', () => {
      const storageEngine = kuzzle.storageEngine.public;
      storageEngine.import.onCall(0).resolves({ errors: []});
      storageEngine.import.onCall(1).resolves({ errors: []});
      storageEngine.import.onCall(2).resolves({ errors: []});

      return janitor.loadFixtures(fixtures)
        .then(() => {
          should(storageEngine.import.callCount).be.eql(3);
          should(storageEngine.import.getCall(0).args[0]).be.eql('nyc-open-data');
          should(storageEngine.import.getCall(0).args[1]).be.eql('yellow-taxi');
          should(storageEngine.import.getCall(0).args[2][1]).be.eql({ name: 'alyx' });
        });
    });

    it('should reject if fixtures contain non-object properties', () => {
      return should(janitor.loadFixtures({foo: 123}))
        .rejectedWith(BadRequestError, {
          id: 'api.assert.invalid_argument',
          message: 'Invalid argument "123". Expected: object'
        });
    });
  });

  describe('#loadMappings', () => {
    const mappings = require('../mocks/mappings.json');

    it('create index and collection that does not exists', () => {
      const storageEngine = kuzzle.storageEngine.public;
      storageEngine.indexExists.onCall(0).resolves(false);
      storageEngine.indexExists.onCall(1).resolves(true);
      storageEngine.indexExists.onCall(2).resolves(false);

      return janitor.loadMappings(mappings)
        .then(() => {
          should(storageEngine.indexExists.callCount).be.eql(3);
          should(storageEngine.createIndex.callCount).be.eql(2);
          should(storageEngine.createIndex.getCall(0).args[0]).be.eql('nyc-open-data');

          should(storageEngine.createCollection.callCount).be.eql(3);
          should(storageEngine.createCollection.getCall(0).args[1]).be.eql('yellow-taxi');
          should(storageEngine.createCollection.getCall(0).args[2].properties).be.eql({ name: { type: 'text' } });
        });
    });

    it('should reject if a mapping contains non-object properties', () => {
      return should(janitor.loadMappings({foo: 123}))
        .rejectedWith(BadRequestError, {
          id: 'api.assert.invalid_argument',
          message: 'Invalid argument "123". Expected: object'
        });
    });
  });

  describe('#dump', () => {
    let
      fsStub,
      coreStub,
      getAllStatsStub,
      suffix,
      globStub;

    beforeEach(() => {
      fsStub = {
        accessSync: sinon.stub(),
        constants: {},
        copySync: sinon.stub(),
        createReadStream: sinon.stub().returns({
          pipe: sinon.stub().returnsThis(),
          on: sinon.stub().callsArgWith(1)
        }),
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

      mockrequire.reRequire('../../lib/core/janitor');
      Janitor = rewire('../../lib/core/janitor');
      janitor = new Janitor(kuzzle);

      kuzzle.config.dump.enabled = true;
      janitor._dump = false;
      suffix = 'dump-me-master';
    });

    it('should reject with an error if a dump is in progress', done => {
      janitor._dump = true;

      janitor.dump(suffix)
        .then(() => done(new Error('Should reject with error')))
        .catch(error => {
          try {
            should(error).be.instanceOf(PreconditionError, {
              id: 'api.assert.action_locked'
            });
            done();
          }
          catch (e) {
            done(e);
          }
        });
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

            should(fsStub.writeFileSync.getCall(0).args[0])
              .be.exactly(baseDumpPath.concat('/kuzzle.json'));
            should(fsStub.writeFileSync.getCall(0).args[1])
              .be.exactly(JSON.stringify({
                version: require('../../package.json').version,
                config: kuzzle.config
              }, null, ' ').concat('\n'));

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
    it('should exit immediately if unable to retrieve the PM2 process list', async () => {
      await janitor.shutdown(kuzzle);
      should(runShutdown).calledOnce().calledWith(kuzzle);
    });
  });
});
