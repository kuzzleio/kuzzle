const
  mockRequire = require('mock-require'),
  rewire = require('rewire'),
  sinon = require('sinon'),
  should = require('should'),
  KuzzleMock = require('../../mocks/kuzzle.mock');

describe('bin/commands/start.js', () => {
  let
    start;

  beforeEach(() => {
    mockRequire('../../../bin/commands/loadJson', sinon.stub().resolves({}));
    mockRequire('../../../lib/api/kuzzle', KuzzleMock);
    start = rewire('../../../bin/commands/start');

    start.__set__({
      console: {
        log: sinon.stub(),
        error: sinon.stub()
      }
    });
  });

  afterEach(() => {
    mockRequire.stopAll();
  });

  it('should start kuzzle with proper params', () => {
    return start({
      mappings: 'mappings.json',
      fixtures: 'fixtures.json',
      securities: 'securities.json'
    })
      .then(() => {
        should(KuzzleMock.instance().start)
          .be.called()
          .be.calledWith({
            mappings: {},
            fixtures: {},
            securities: {}
          });
      });
  });

});
