const
  mockRequire = require('mock-require'),
  sinon = require('sinon'),
  should = require('should'),
  KuzzleMock = require('../../mocks/kuzzle.mock');

describe.skip('bin/commands/start.js', () => {
  let
    start,
    ColorOutputMock;

  beforeEach(() => {
    ColorOutputMock = function () {
      return {
        ok: sinon.stub(),
        warn: sinon.stub(),
        notice: sinon.stub(),
        error: sinon.stub()
      };
    };

    mockRequire('../../../bin/commands/loadJson', sinon.stub().resolves({}));
    mockRequire('../../../lib/api/kuzzle', KuzzleMock);
    mockRequire('../../../bin/commands/colorOutput', ColorOutputMock);
    start = mockRequire.reRequire('../../../bin/commands/start');
  });

  afterEach(() => {
    mockRequire.stopAll();
  });

  it('should start kuzzle with proper params', () => {
    return start({
      mappings: 'mappings.json',
      fixtures: 'fixtures.json',
      securities: 'securities.json',
      enablePlugins: 'kuzzle-plugin-fake,kuzzle-plugin-fake2'
    })
      .then(() => {
        should(KuzzleMock.instance().start)
          .be.called()
          .be.calledWith({
            mappings: {},
            fixtures: {},
            securities: {},
            additionalPlugins: ['kuzzle-plugin-fake','kuzzle-plugin-fake2']
          });
      });
  });
});
