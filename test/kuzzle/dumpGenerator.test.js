'use strict';

const mockrequire = require('mock-require');
const rewire = require('rewire');
const sinon = require('sinon');
const should = require('should');
const {
  errors: {
    BadRequestError,
    PreconditionError
  }
} = require('kuzzle-common-objects');
const KuzzleMock = require('../mocks/kuzzle.mock');
const DumpGenerator = require('../../lib/kuzzle/dumpGenerator');

/*
 /!\ In these tests, the promise returned by shutdown
 do not mark the function as "finished".
 The promise is resolved before halting Kuzzle in case
 the shutdown is initiated using the CLI, to allow it
 to finish and exit while Kuzzle is shutting down.
 */
describe('Test: core/janitor', () => {
  let dumpGenerator;
  let kuzzle;

  beforeEach(() => {
    kuzzle = new KuzzleMock();
    dumpGenerator = new DumpGenerator(kuzzle);
  });

  describe('#dump', () => {
    let
      fsStub,
      coreStub,
      getAllStatsStub,
      suffix;

    beforeEach(() => {
      fsStub = {
        accessSync: sinon.stub(),
        constants: {},
        copyFileSync: sinon.stub(),
        createReadStream: sinon.stub().returns({
          pipe: sinon.stub().returnsThis(),
          on: sinon.stub().callsArgWith(1)
        }),
        createWriteStream: sinon.stub(),
        mkdirSync: sinon.stub(),
        readdir: sinon.stub(),
        readdirSync: sinon.stub().returns(['core']),
        removeSync: sinon.stub(),
        unlink: sinon.stub(),
        unlinkSync: sinon.stub(),
        stat: sinon.stub(),
        statSync: sinon.stub(),
        lstatSync: sinon.stub().returns({
          isFile: sinon.stub().returns(true)
        }),
        writeFileSync: sinon.stub(),
      };

      coreStub = sinon.stub().returns({});
      getAllStatsStub = sinon.stub().returns(Promise.resolve({hits: [{stats: 42}]}));

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

      mockrequire('fs', fsStub);
      mockrequire('dumpme', coreStub);

      mockrequire.reRequire('../../../lib/core/janitor');
      Janitor = rewire('../../../lib/core/janitor');
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

      it('should generate dump files', async () => {
        let
          processDump,
          osDump,
          baseDumpPath = `/tmp/${(new Date()).getFullYear()}-${suffix}`;

        await janitor.dump(suffix);

        should(fsStub.mkdirSync).be.calledOnce();
        should(fsStub.mkdirSync.getCall(0).args[0]).be.exactly(baseDumpPath);

        should(fsStub.writeFileSync.getCall(0).args[0])
          .be.exactly(baseDumpPath.concat('/kuzzle.json'));
        should(fsStub.writeFileSync.getCall(0).args[1])
          .be.exactly(JSON.stringify({
            config: kuzzle.config,
            version: require('../../../package.json').version
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

        should(fsStub.createReadStream.getCall(0).args[0]).be.exactly('/tmp/2020-dump-me-master/core');
        should(fsStub.createWriteStream).be.calledOnce();
        should(fsStub.createReadStream().pipe).be.called(2);

        should(fsStub.copyFileSync.getCall(0).args[0]).be.exactly(process.argv[0]);
        should(fsStub.copyFileSync.getCall(0).args[1]).be.exactly(baseDumpPath.concat('/node'));
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
            should(fsStub.removeSync).not.be.called();
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

        fsStub.readdirSync.returns(['1', '2', '3', '4', '5', '6', '7', '8', '9', '10']);
        fsStub.accessSync.throws(new Error('no coredump here'));
        fsStub.accessSync
          .withArgs('/tmp', 0)
          .returns();

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
        const stub = sinon.stub();
        for (let i = 0; i < 10; i++) {
          stub.onCall(i).returns([`/tmp/${i}/core.gz`]);
        }
        janitor._listFilesMatching = stub;
        kuzzle.config.dump.history.reports = 100;
        fsStub.readdirSync.returns(['1', '2', '3', '4', '5', '6', '7', '8', '9', '10']);

        fsStub.accessSync.throws(new Error('no coredump here'));
        fsStub.accessSync
          .withArgs('/tmp', 0)
          .returns();

        return janitor.dump(suffix)
          .then(() => {
            for (let i = 1; i < 8; i++) {
              should(stub)
                .be.calledWith(`/tmp/${i}`, 'core');
              should(fsStub.unlinkSync)
                .be.calledWith(`/tmp/${i}/core.gz`);
            }
            for (let i = 9; i < 11; i++) {
              should(stub)
                .not.be.calledWith(`/tmp/${i}/`, 'core');
            }
          });
      });
    });
  });
