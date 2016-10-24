var
  KuzzleMock = require('../../../mocks/kuzzle.mock'),
  should = require('should');


describe('Test: clean database', () => {
  var
    cleanDb,
    kuzzle;

  beforeEach(() => {
    kuzzle = new KuzzleMock();
    cleanDb = require('../../../../lib/api/controllers/remoteActions/cleanDb')(kuzzle);
  });

  it('should call kuzzle.resetStorage', () => {
    return cleanDb()
      .then(() => {
        should(kuzzle.resetStorage).be.calledOnce();
      });
  });

});
