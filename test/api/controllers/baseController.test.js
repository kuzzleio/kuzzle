const
  should = require('should'),
  BaseController = require('../../../lib/api/controllers/controller'),
  {
    errors: {
      InternalError: KuzzleInternalError
    }
  } = require('kuzzle-common-objects');

describe('#base controller', () => {
  it('should expose a kuzzle property', () => {
    const base = new BaseController('foobar');

    should(base).have.properties({kuzzle: 'foobar'});
  });

  it('should throw if the isAction method has not been overridden', () => {
    const base = new BaseController();

    should(() => base.isAction('foo')).throw(
      KuzzleInternalError,
      {message: 'Call to incomplete controller when invoking the action foo'});
  });
});
