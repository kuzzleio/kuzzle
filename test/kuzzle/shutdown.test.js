'use strict';

const rewire = require('rewire');
const sinon = require('sinon');
const should = require('should');
const KuzzleMock = require('../mocks/kuzzle.mock');

describe('#kuzzle/shutdown', () => {
  let kuzzle;
  const saveExit = process.exit;

  beforeEach(() => {
    kuzzle = new KuzzleMock();
    Object.assign(process, {exit: sinon.stub()});
  });

  afterEach(() => {
    process.exit = saveExit;
  });

  it('should exit only when there is no request left in the funnel', () => {
    const clock = sinon.useFakeTimers();

    const shutdown = rewire('../../lib/kuzzle/shutdown');
    kuzzle.funnel.remainingRequests = 1;

    try {
      shutdown(kuzzle);

      should(kuzzle.entryPoint.dispatch).calledOnce().calledWith('shutdown');
      should(kuzzle.emit).calledWith('kuzzle:shutdown');

      // @deprecated
      should(kuzzle.emit).calledWith('core:shutdown');

      clock.next();
      should(process.exit).not.be.called();

      kuzzle.funnel.remainingRequests = 0;
      clock.next();
      should(process.exit).calledOnce().calledWith(0);
      clock.restore();
    }
    catch (e) {
      clock.restore();
      throw e;
    }
  });
});
