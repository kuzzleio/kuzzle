var
  should = require('should'),
  sinon = require('sinon'),
  rewire = require('rewire'),
  mockRequire = require('mock-require'),
  Validation = rewire('../../../../lib/api/core/validation'),
  KuzzleMock = require('../../../mocks/kuzzle.mock');

describe('Test: validation initialization', () => {
  var
    validation,
    sandbox = sinon.sandbox.create(),
    defaultTypesFiles = Validation.__get__('defaultTypesFiles'),
    getValidationConfiguration = Validation.__get__('getValidationConfiguration'),
    checkAllowedProperties = Validation.__get__('checkAllowedProperties'),
    kuzzle;

  beforeEach(() => {
    kuzzle = new KuzzleMock();
    validation = new Validation(kuzzle);
    sandbox.reset();
    mockRequire.stopAll();
    Validation.__set__('defaultTypesFiles', defaultTypesFiles);
    Validation.__set__('getValidationConfiguration', getValidationConfiguration);
    Validation.__set__('checkAllowedProperties', checkAllowedProperties);
  });

  it('should have the expected structure', () => {
    should(validation.kuzzle).be.eql(kuzzle);
    should(validation.types).be.an.Object();
    should(validation.specification).be.an.Object();
    should(validation.dsl).be.an.Object();
    should(validation.rawConfiguration).be.an.Object();
    should(Array.isArray(validation.typeAllowsChildren)).be.true();
  });

  it('should add the type provided in defaultTypesFiles', () => {
    var
      validationStub = sandbox.spy(() => {}),
      anotherValidationStub = sandbox.spy(() => {}),
      addTypeStub = sandbox.stub();

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
    var
      configurationMock = {
        anIndex: {
          aCollection: {
            a: 'specification'
          },
          anotherCollection: {
            another: 'specification'
          }
        },
        anotherIndex: {
          anotherCollection: {
            another: 'specification'
          }
        }
      },
      getValidationConfigurationStub = sandbox.stub().resolves(configurationMock);

    beforeEach(() => {
      Validation.__set__('getValidationConfiguration', getValidationConfigurationStub);
    });

    it('should build a specification if everything goes as expected', () => {
      validation.curateCollectionSpecification = sandbox.spy(function () {
        return Promise.resolve(arguments[2]);
      });

      return validation.curateSpecification()
        .then(() => {
          should(validation.rawConfiguration).be.eql(configurationMock);
          should(validation.specification).be.deepEqual(configurationMock);
          should(kuzzle.pluginsManager.trigger.callCount).be.eql(4);
          should(kuzzle.pluginsManager.trigger.args[0][0]).be.eql('log:info');
          should(kuzzle.pluginsManager.trigger.args[1][0]).be.eql('log:info');
          should(kuzzle.pluginsManager.trigger.args[2][0]).be.eql('log:info');
          should(kuzzle.pluginsManager.trigger.args[3][0]).be.eql('log:info');
        });
    });

    it('should build a specification if everything goes as expected', () => {
      validation.curateCollectionSpecification = sandbox.spy(function () {
        return Promise.reject({an: 'error'});
      });

      return validation.curateSpecification()
        .then(() => {
          should(validation.rawConfiguration).be.eql(configurationMock);
          should(validation.specification).be.deepEqual({});
          should(kuzzle.pluginsManager.trigger.callCount).be.eql(7);
          should(kuzzle.pluginsManager.trigger.args[0][0]).be.eql('log:error');
          should(kuzzle.pluginsManager.trigger.args[1][0]).be.eql('log:error');
          should(kuzzle.pluginsManager.trigger.args[2][0]).be.eql('log:error');
          should(kuzzle.pluginsManager.trigger.args[3][0]).be.eql('log:error');
          should(kuzzle.pluginsManager.trigger.args[4][0]).be.eql('log:error');
          should(kuzzle.pluginsManager.trigger.args[5][0]).be.eql('log:error');
          should(kuzzle.pluginsManager.trigger.args[6][0]).be.eql('log:info');
        });
    });
  });

  describe('#validateSpecification', () => {
    it('should resolve true if the specification is correct', () => {
      var
        curateCollectionSpecificationStub = sandbox.stub().resolves({});

      validation.curateCollectionSpecification = curateCollectionSpecificationStub;

      return validation.validateSpecification('anIndex', 'aCollection', {a: 'specification'})
        .then(result => {
          should(curateCollectionSpecificationStub.callCount).be.eql(1);
          should(result).be.true();
        });
    });

    it('should resolve false if the specification is not correct', () => {
      var
        curateCollectionSpecificationStub = sandbox.stub().rejects({});

      validation.curateCollectionSpecification = curateCollectionSpecificationStub;

      return validation.validateSpecification('anIndex', 'aCollection', {a: 'bad specification'})
        .then(result => {
          should(curateCollectionSpecificationStub.callCount).be.eql(1);
          should(result).be.false();
        });
    });
  });

  describe('#addType', () => {
    it('should add a type with children properly', () => {
      var
        validationType = {
          validate: () => {},
          typeName: 'aType',
          validateFieldSpecification: () => {},
          allowChildren: false
        };

      validation.addType(validationType);

      should(validation.types.aType).be.eql(validationType);
    });

    it('should add a type with children properly', () => {
      var
        validationType = {
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
      var
        validationType = {
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
      var
        validationType = {
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
      var
        validationType = {
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
      var
        validationType = {
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
      var
        validationType = {
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

  describe('#curateCollectionSpecification', () => {
    /**
     * TODO
     */
  });

  describe('#structureCollectionValidation', () => {
    /**
     * TODO
     */
  });

  describe('#curateFieldSpecification', () => {
    var
      curateFieldSpecificationFormat = sandbox.stub();

    beforeEach(() => {
      validation.curateFieldSpecificationFormat = curateFieldSpecificationFormat;
    });

    it('should validate and curate field specifications with default configuration', () => {
      var
        typeValidateSpecValidation = sandbox.stub().returns(true),
        fieldSpec = {
          type: 'string'
        },
        expectedReturn = {
          type: 'string',
          mandatory: false,
          multivalued: {
            value: false
          },
          typeOptions: {}
        };

      validation.types.string = {validateFieldSpecification: typeValidateSpecValidation};

      should(validation.curateFieldSpecification(fieldSpec)).be.deepEqual(expectedReturn);
    });

    it('should validate, curate field specifications and use returned typeOptions of the field validation', () => {
      var
        genericMock = {foo: 'bar'},
        typeValidateSpecValidation = sandbox.stub().returns(genericMock),
        fieldSpec = {
          type: 'string'
        },
        expectedReturn = {
          type: 'string',
          mandatory: false,
          multivalued: {
            value: false
          },
          typeOptions: genericMock
        };

      validation.types.string = {validateFieldSpecification: typeValidateSpecValidation};

      should(validation.curateFieldSpecification(fieldSpec)).be.deepEqual(expectedReturn);
    });

    it('should throw an error if type validation returns false', () => {
      var
        typeValidateSpecValidation = sandbox.stub().returns(false),
        fieldSpec = {
          type: 'string'
        };

      validation.types.string = {validateFieldSpecification: typeValidateSpecValidation};

      (() => {
        validation.curateFieldSpecification(fieldSpec);
      }).should.throw('Field of type string is not specified properly');
    });

    it('should validate typeOptions from the field type', () => {
      var
        typeValidateSpecValidation = sandbox.stub().returns(true),
        fieldSpec = {
          type: 'string',
          typeOptions: {
            some: 'options'
          }
        },
        expectedReturn = {
          type: 'string',
          mandatory: false,
          multivalued: {
            value: false
          },
          typeOptions: {
            some: 'options'
          }
        };

      validation.types.string = {
        validateFieldSpecification: typeValidateSpecValidation,
        allowedTypeOptions: ['some']
      };

      should(validation.curateFieldSpecification(fieldSpec)).be.deepEqual(expectedReturn);
    });

    it('should throw an error if an option of typeOptions is invalid', () => {
      var
        typeValidateSpecValidation = sandbox.stub().returns(true),
        fieldSpec = {
          type: 'string',
          typeOptions: {
            some: 'options'
          }
        };

      validation.types.string = {
        validateFieldSpecification: typeValidateSpecValidation,
        allowedTypeOptions: ['another']
      };

      (() => {
        validation.curateFieldSpecification(fieldSpec);
      }).should.throw('Field of type string is not specified properly');
    });

    it('should throw an error if an option of typeOptions is invalid', () => {
      var
        anError = {an: 'error'},
        typeValidateSpecValidation = sandbox.stub().throws(anError),
        fieldSpec = {
          type: 'string',
          typeOptions: {
            some: 'options'
          }
        };

      validation.types.string = {
        validateFieldSpecification: typeValidateSpecValidation,
        allowedTypeOptions: ['some']
      };

      (() => {
        validation.curateFieldSpecification(fieldSpec);
      }).should.throw(anError);
    });
  });

  describe('#curateFieldSpecificationFormat', () => {
    var
      checkAllowedPropertiesStub = sandbox.stub();

    beforeEach(() => {
      Validation.__set__('checkAllowedProperties', checkAllowedPropertiesStub);
    });

    it('should throw an error if the field specification contains not allowed fields', () => {
      var
        fieldSpec = {
          type: 'string',
          foo: 'bar'
        };

      checkAllowedPropertiesStub.returns(false);

      (() => {
        validation.curateFieldSpecificationFormat(fieldSpec);
      }).should.throw('The field specification has invalid properties.');
    });

    it('should throw an error if the field specification does not contain all mandatory fields', () => {
      var
        fieldSpec = {
          mandatory: true
        };

      checkAllowedPropertiesStub.returns(true);

      (() => {
        validation.curateFieldSpecificationFormat(fieldSpec);
      }).should.throw('type is a mandatory field specification property.');
    });

    it('should throw an error if the field specification contains a not recognized type', () => {
      var
        fieldSpec = {
          type: 'not_recognized',
          foo: 'bar'
        };

      checkAllowedPropertiesStub.returns(true);

      validation.types = {
        string: 'aType'
      };

      (() => {
        validation.curateFieldSpecificationFormat(fieldSpec);
      }).should.throw('not_recognized is not a recognized type.');
    });

    it('should throw an error if the multivalued field is malformed', () => {
      var
        fieldSpec = {
          type: 'string',
          multivalued: {
            foo: 'bar'
          }
        };

      checkAllowedPropertiesStub
        .onFirstCall().returns(true)
        .onSecondCall().returns(false);

      validation.types = {
        string: 'aType'
      };

      (() => {
        validation.curateFieldSpecificationFormat(fieldSpec);
      }).should.throw('The multivalued field specification has invalid properties.');
    });

    it('should throw an error if the multivalued field is malformed', () => {
      var
        fieldSpec = {
          type: 'string',
          multivalued: {}
        };

      checkAllowedPropertiesStub
        .onFirstCall().returns(true)
        .onSecondCall().returns(true);

      validation.types = {
        string: 'aType'
      };

      (() => {
        validation.curateFieldSpecificationFormat(fieldSpec);
      }).should.throw('"value" is a mandatory property for multivalued field specification.');
    });

    it('should throw an error if the multivalued field is malformed', () => {
      var
        fieldSpec = {
          type: 'string',
          multivalued: {
            value: false,
            minCount: 42
          }
        };

      checkAllowedPropertiesStub
        .onFirstCall().returns(true)
        .onSecondCall().returns(true);

      validation.types = {
        string: 'aType'
      };

      (() => {
        validation.curateFieldSpecificationFormat(fieldSpec);
      }).should.throw('"minCount" is not valid when multivalued field is disabled.');
    });

    it('should throw an error if the multivalued field is malformed', () => {
      var
        fieldSpec = {
          type: 'string',
          multivalued: {
            value: false,
            maxCount: 42
          }
        };

      checkAllowedPropertiesStub
        .onFirstCall().returns(true)
        .onSecondCall().returns(true);

      validation.types = {
        string: 'aType'
      };

      (() => {
        validation.curateFieldSpecificationFormat(fieldSpec);
      }).should.throw('"maxCount" is not valid when multivalued field is disabled.');
    });

    it('should throw an error if the multivalued field is malformed', () => {
      var
        fieldSpec = {
          type: 'string',
          multivalued: {
            value: true,
            minCount: 43,
            maxCount: 42
          }
        };

      checkAllowedPropertiesStub
        .onFirstCall().returns(true)
        .onSecondCall().returns(true);

      validation.types = {
        string: 'aType'
      };

      (() => {
        validation.curateFieldSpecificationFormat(fieldSpec);
      }).should.throw('"minCount" can not be greater than "maxCount".');
    });

    it('should return true if specification is well formed', () => {
      var
        fieldSpec = {
          type: 'string'
        };

      checkAllowedPropertiesStub
        .onFirstCall().returns(true)
        .onSecondCall().returns(true);

      validation.types = {
        string: 'aType'
      };

      should(validation.curateFieldSpecificationFormat(fieldSpec)).be.true();
    });

    it('should return true if specification is well formed', () => {
      var
        fieldSpec = {
          type: 'string',
          multivalued: {
            value: true,
            minCount: 41,
            maxCount: 42
          }
        };

      checkAllowedPropertiesStub
        .onFirstCall().returns(true)
        .onSecondCall().returns(true);

      validation.types = {
        string: 'aType'
      };

      should(validation.curateFieldSpecificationFormat(fieldSpec)).be.true();
    });
  });

  describe('#curateValidatorFilter', () => {
    /**
     * TODO
     */
  });
});
