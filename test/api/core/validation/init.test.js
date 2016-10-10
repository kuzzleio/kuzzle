var
  should = require('should'),
  sinon = require('sinon'),
  rewire = require('rewire'),
  mockRequire = require('mock-require'),
  Validation = rewire('../../../../lib/api/core/validation');

describe('Test: validation initialization', () => {
  var
    validation,
    sandbox = sinon.sandbox.create(),
    genericMock = {
      foo: 'bar'
    },
    defaultTypesFiles = Validation.__get__('defaultTypesFiles');

  beforeEach(() => {
    validation = new Validation(genericMock);
    sandbox.restore();
    mockRequire.stopAll();
    Validation.__set__('defaultTypesFiles', defaultTypesFiles);
  });

  it('should have the expected structure', () => {
    should(validation.kuzzle).be.eql(genericMock);
    should(validation.types).be.an.Object();
    should(validation.specification).be.an.Object();
    should(validation.dsl).be.an.Object();
    should(validation.rawConfiguration).be.an.Object();
    should(Array.isArray(validation.typeAllowsChildren)).be.true();
  });

  it('should add the type provided in defaultTypesFiles', () => {
    var validationStub = sandbox.spy(() => {});
    var anotherValidationStub = sandbox.spy(() => {});
    var addTypeStub = sandbox.stub();

    Validation.__set__('defaultTypesFiles', ['aFile', 'anotherFile']);

    mockRequire('../../../../lib/api/core/validation/types/aFile', validationStub);
    mockRequire('../../../../lib/api/core/validation/types/anotherFile', anotherValidationStub);

    validation.addType = addTypeStub;

    validation.init();

    should(validationStub.callCount).be.eql(1);
    should(anotherValidationStub.callCount).be.eql(1);
    should(addTypeStub.callCount).be.eql(2);
  });


  describe('#curateSpecification', () => {
    /**
     * TODO
     */
  });

  describe('#validateSpecification', () => {
    /**
     * TODO
     */
  });

  describe('#curateCollectionSpecification', () => {
    /**
     * TODO
     */
  });
  describe('#curateFieldSpecification', () => {
    /**
     * TODO
     */
  });

  describe('#curateValidatorFilter', () => {
    /**
     * TODO
     */
  });

  describe('#addType', () => {
    it('should add a type with children properly', () => {
      var validationType = {
        validate: () => {},
        typeName: 'aType',
        validateFieldSpecification: () => {},
        allowChildren: false
      };

      validation.addType(validationType);

      should(validation.types.aType).be.eql(validationType);
    });

    it('should add a type with children properly', () => {
      var validationType = {
        validate: () => {},
        typeName: 'aType',
        validateFieldSpecification: () => {},
        allowChildren: true,
        getStrictness: () => {}
      };

      validation.addType(validationType);

      should(validation.types.aType).be.eql(validationType);
      should(validation.typeAllowsChildren).be.deepEqual(['aType']);
    });

    it('should not override an existing type', () => {
      var validationType = {
        validate: () => {},
        typeName: 'aType',
        validateFieldSpecification: () => {},
        allowChildren: false
      };

      validation.types.aType = {};

      try {
        validation.addType(validationType);
      }
      catch (error) {
        should(error.message).be.eql('The type aType is already defined.\nThis is probably not a Kuzzle error, but a problem with a plugin implementation.');
      }
    });


    it('should reject a type without name', () => {
      var validationType = {
        validate: () => {},
        validateFieldSpecification: () => {},
        allowChildren: false
      };

      try {
        validation.addType(validationType);
      }
      catch (error) {
        should(error.message).be.eql('The typeName property must be defined in the validation type object.\nThis is probably not a Kuzzle error, but a problem with a plugin implementation.');
      }
    });

    it('should reject a type without validate function', () => {
      var validationType = {
        typeName: 'aType',
        validateFieldSpecification: () => {},
        allowChildren: false
      };

      try {
        validation.addType(validationType);
      }
      catch (error) {
        should(error.message).be.eql('The type aType must implement the function \'validate\'.\nThis is probably not a Kuzzle error, but a problem with a plugin implementation.');
      }
    });

    it('should reject a type without validateFieldSpecification function', () => {
      var validationType = {
        typeName: 'aType',
        validate: () => {},
        allowChildren: false
      };

      try {
        validation.addType(validationType);
      }
      catch (error) {
        should(error.message).be.eql('The type aType must implement the function \'validateFieldSpecification\'.\nThis is probably not a Kuzzle error, but a problem with a plugin implementation.');
      }
    });

    it('should reject a type without getStrictness function when allowChildren is true', () => {
      var validationType = {
        typeName: 'aType',
        validate: () => {},
        validateFieldSpecification: () => {},
        allowChildren: true
      };

      try {
        validation.addType(validationType);
      }
      catch (error) {
        should(error.message).be.eql('The allowing children type aType must implement the function \'getStrictness\'.\nThis is probably not a Kuzzle error, but a problem with a plugin implementation.');
      }
    });
  });
});
