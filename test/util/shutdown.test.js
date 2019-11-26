const
  rewire = require('rewire'),
  sinon = require('sinon'),
  should = require('should'),
  KuzzleMock = require('../mocks/kuzzle.mock');

// require runShutdown only after fake timers are installed
function requireRunShutdown() {
  return rewire('../../lib/util/shutdown');
}

describe('#util/shutdown', () => {
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

    const runShutdown = requireRunShutdown();
    kuzzle.funnel.remainingRequests = 1;

    try {
      runShutdown(kuzzle);
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
