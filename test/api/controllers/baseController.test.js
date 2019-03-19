const
  should = require('should'),
  BaseController = require('../../../lib/api/controllers/controller');

describe('#base controller', () => {
  it('should expose a kuzzle property', () => {
    const base = new BaseController('foobar');

    should(base).have.properties({kuzzle: 'foobar'});
  });

  it('should initialize its actions list from the constructor', () => {
    const base = new BaseController('foobar', ['foo', 'bar']);

    base.qux = () => {};

    should(base.isAction('foo')).be.true();
    should(base.isAction('bar')).be.true();
    should(base.isAction('qux')).be.false();
  });
});
