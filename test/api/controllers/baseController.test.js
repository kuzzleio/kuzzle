const
  { BadRequestError } = require('kuzzle-common-objects').errors,
  should = require('should'),
  { BaseController, NativeController } = require('../../../lib/api/controllers/baseController');

describe('#native controller', () => {
  it('should expose a kuzzle property', () => {
    const base = new NativeController('foobar');

    should(base).have.properties({kuzzle: 'foobar'});
  });

  it('should initialize its actions list from the constructor', () => {
    const base = new NativeController('foobar', ['foo', 'bar']);

    base.qux = () => {};

    should(base._isAction('foo')).be.true();
    should(base._isAction('bar')).be.true();
    should(base._isAction('qux')).be.false();
  });

  describe('#tryGetBoolean', () => {
    let
      nativeController,
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

      nativeController = new NativeController();
    });

    it('set the flag value to true if present in http', () => {
      const param = nativeController.tryGetBoolean(request, 'args.doha');

      should(param).be.eql(true);
    });

    it('set the flag value to false if not present in http', () => {
      delete request.input.args.doha;

      const param = nativeController.tryGetBoolean(request, 'args.doha');

      should(param).be.eql(false);
    });

    it('does not nothing if the flag is already a boolean with other protocols', () => {
      request.context.connection.protocol = 'ws';
      request.input.args.doha = true;

      const param = nativeController.tryGetBoolean(request, 'args.doha');

      should(param).be.eql(true);
    });

    it('throw an error if flag is not a boolean with other protocols', done => {
      request.context.connection.protocol = 'ws';
      request.input.args.doha = 'hamad';

      try {
        nativeController.tryGetBoolean(request, 'args.doha');
        done(new Error('Should throw BadRequestError'));
      } catch (error) {
        should(error).be.instanceOf(BadRequestError);
        should(error.errorName).be.eql('api.assert.invalid_type');
        done();
      }
    });
  });
});
