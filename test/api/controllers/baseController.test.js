const
  { BadRequestError } = require('kuzzle-common-objects').errors,
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

  describe('#tryGetBoolean', () => {
    let
      baseController,
      request;

    beforeEach(() => {
      request = {
        context: {
          connection: {
            protocol: 'http'
          }
        },
        input: {
          args: {
            doha: ''
          }
        }
      };

      baseController = new BaseController();
    });

    it('set the flag value to true if present in http', () => {
      const param = baseController.tryGetBoolean(request, 'args.doha');

      should(param).be.eql(true);
    });

    it('set the flag value to false if not present in http', () => {
      delete request.input.args.doha;

      const param = baseController.tryGetBoolean(request, 'args.doha');

      should(param).be.eql(false);
    });

    it('does not nothing if the flag is already a boolean with other protocols', () => {
      request.context.connection.protocol = 'ws';
      request.input.args.doha = true;

      const param = baseController.tryGetBoolean(request, 'args.doha');

      should(param).be.eql(true);
    });

    it('throw an error if flag is not a boolean with other protocols', done => {
      request.context.connection.protocol = 'ws';
      request.input.args.doha = 'hamad';

      try {
        baseController.tryGetBoolean(request, 'args.doha');
        done(new Error('Should throw BadRequestError'));
      } catch (error) {
        should(error).be.instanceOf(BadRequestError);
        should(error.message).be.eql('Invalid \'doha\' value (hamad): boolean expected');
        done();
      }
    });
  });
});
