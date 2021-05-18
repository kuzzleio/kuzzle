'use strict';

const util = require('util');

const should = require('should');
const mockrequire = require('mock-require');

const KuzzleMock = require('../../mocks/kuzzle.mock');
const FsMock = require('../../mocks/fs.mock');

describe('Backend', () => {
  let application;
  let fsStub;
  let Backend;

  beforeEach(() => {
    fsStub = new FsMock();
    fsStub.existsSync.returns(true);
    fsStub.readFileSync.returns('ref: refs/master');
    fsStub.statSync.returns({ isDirectory: () => true });

    mockrequire('fs', fsStub);
    mockrequire('../../../lib/kuzzle', KuzzleMock);

    ({ Backend } = mockrequire.reRequire('../../../lib/core/backend/backend'));

    application = new Backend('black-mesa');
  });

  afterEach(() => {
    mockrequire.stopAll();
  });

  describe('Logger', () => {
    describe('#_log', () => {
      it('should exposes log methods and call kuzzle ones', async () => {
        await application.start();

        application.log.debug('debug');
        application.log.info('info');
        application.log.warn('warn');
        application.log.error('error');
        application.log.verbose({ info: 'verbose' });

        should(global.kuzzle.log.debug).be.calledWith(util.inspect('debug'));
        should(global.kuzzle.log.info).be.calledWith(util.inspect('info'));
        should(global.kuzzle.log.warn).be.calledWith(util.inspect('warn'));
        should(global.kuzzle.log.error).be.calledWith(util.inspect('error'));
        should(global.kuzzle.log.verbose).be.calledWith(util.inspect({ info: 'verbose' }));
      });
    });
  });
});
