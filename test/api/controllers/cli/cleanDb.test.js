var
  KuzzleMock = require('../../../mocks/kuzzle.mock'),
  should = require('should');


describe('Test: clean database', () => {
  var
    cleanDb,
    kuzzle;

  beforeEach(() => {
    kuzzle = new KuzzleMock();
    cleanDb = require('../../../../lib/api/controllers/cli/cleanDb')(kuzzle);
  });

  it('should call kuzzle.resetStorage', () => {
    return cleanDb()
      .then(() => {
        try {
          should(kuzzle.resetStorage).be.calledOnce();

          return Promise.resolve();
        }
        catch (error) {
          return Promise.reject(error);
        }
      });
  });

});
