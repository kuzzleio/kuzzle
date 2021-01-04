'use strict';

const sinon = require('sinon');
const should = require('should');

const Logger = require('../../lib/kuzzle/log');

describe('/lib/kuzzle/log', () => {
  let logger;

  beforeEach(() => {
    global.kuzzle = {
      once: sinon.stub(),
      id: 'nasty-author-4242',
      emit: sinon.stub(),
      asyncStore: {
        exists: () => false,
        has: () => true,
        get: () => ({ id: 'request-unique-id' })
      }
    };

    logger = new Logger();
    logger._useLogger();
  });

  it('should add the node id in log', () => {
    logger.info('Kiev');

    should(global.kuzzle.emit).be.calledWith('log:info', '[nasty-author-4242] Kiev');
  });

  it('should add the requestId in log', () => {
    global.kuzzle.asyncStore.exists = () => true;

    logger.info('Kiev');

    should(global.kuzzle.emit).be.calledWith('log:info', '[nasty-author-4242] [request-unique-id] Kiev');
  });
});
