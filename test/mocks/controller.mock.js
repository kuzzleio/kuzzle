const
  BaseController = require('../../lib/api/controllers/baseController'),
  {
    errors: {
      InternalError: KuzzleInternalError
    }
  } = require('kuzzle-common-objects'),
  sinon = require('sinon');

class MockController extends BaseController {
  constructor(kuzzle) {
    super(kuzzle);

    this.failResult = new KuzzleInternalError('rejected action');
    this.fail = sinon.stub().rejects(this.failResult);

    // we need to use "callsFake" instead of "resolvesArg" because, for some
    // reason, .resolves and .resolvesArg behaviors are not overwritten
    // when we do "this.succeed.returns('another value')": in that case,
    // "another value" is resolved as a promise result, which is not the
    // desired result
    this.succeed = sinon.stub().callsFake(foo => Promise.resolve(foo));
  }

  isAction(name) {
    return name === 'succeed' || name === 'fail';
  }
}

module.exports = MockController;
