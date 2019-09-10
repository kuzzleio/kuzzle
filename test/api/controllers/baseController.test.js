const
  { BadRequestError } = require('kuzzle-common-objects').errors,
  should = require('should'),
  KuzzleMock = require('../../mocks/kuzzle.mock'),
  BaseController = require('../../../lib/api/controllers/baseController');

xdescribe('#base controller', () => {
  let
    kuzzle,
    actions,
    baseController,
    request;

  beforeEach(() => {
    kuzzle = new KuzzleMock();

    actions = ['speak', 'fight'];

    request = {
      input: {}
    };

    baseController = new BaseController(kuzzle, actions);
  });

  it('should initialize its actions list from the constructor', () => {
    baseController.privateAction = () => {};

    should(baseController.isAction('speak')).be.true();
    should(baseController.isAction('fight')).be.true();
    should(baseController.isAction('privateAction')).be.false();
  });

  describe('#tryGetBoolean', () => {
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
        should(error.message).be.eql('Invalid \'doha\' value (hamad).');
        done();
      }
    });
  });

  describe('#arrayParam', () => {
    beforeEach(() => {
      request.input.body = {
        names: ['Ender', 'Speaker for the Dead', 'Xenocide'],
        age: 3000
      };
    });

    it('should extract an array param', () => {
      const param = baseController.arrayParam(request, 'body.names');

      should(param).be.eql(['Ender', 'Speaker for the Dead', 'Xenocide']);
    });

    it('should throw if the param is missing', () => {
      should(() => {
        baseController.arrayParam(request, 'body.childhood');
      }).throw({ errorName: 'api.base.missing_param' });
    });

    it('should throw if the param is not an array', () => {
      should(() => {
        baseController.arrayParam(request, 'body.age');
      }).throw({ errorName: 'api.base.invalid_param_type' });
    });
  });

  describe('#stringParam', () => {
    beforeEach(() => {
      request.input.body = {
        name: 'Ender',
        age: 3000
      };
    });

    it('should extract an string param', () => {
      const param = baseController.stringParam(request, 'body.name');

      should(param).be.eql('Ender');
    });

    it('should throw if the param is missing', () => {
      should(() => {
        baseController.stringParam(request, 'body.childhood');
      }).throw({ errorName: 'api.base.missing_param' });
    });

    it('should throw if the param is not an string', () => {
      should(() => {
        baseController.stringParam(request, 'body.age');
      }).throw({ errorName: 'api.base.invalid_param_type' });
    });
  });
});
