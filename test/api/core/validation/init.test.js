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
    getValidationConfiguration = Validation.__get__('getValidationConfiguration'),
    checkAllowedProperties = Validation.__get__('checkAllowedProperties'),
    curateStructuredFields = Validation.__get__('curateStructuredFields'),
    Dsl = Validation.__get__('Dsl'),
    kuzzle;

  beforeEach(() => {
    kuzzle = new KuzzleMock();
    validation = new Validation(kuzzle);
    sandbox.reset();
    mockRequire.stopAll();
    Validation.__set__('getValidationConfiguration', getValidationConfiguration);
    Validation.__set__('checkAllowedProperties', checkAllowedProperties);
    Validation.__set__('curateStructuredFields', curateStructuredFields);
    Validation.__set__('Dsl', Dsl);
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
      addTypeStub = sandbox.stub();

    [
      'anything',
      'boolean',
      'date',
      'email',
      'enum',
      'geoPoint',
      'geoShape',
      'integer',
      'ipAddress',
      'numeric',
      'object',
      'string',
      'url'
    ].forEach(fileName => {
      mockRequire('../../../../lib/api/core/validation/types/'+ fileName, validationStub);
    });

    validation.addType = addTypeStub;

    validation.init();

    should(validationStub.callCount).be.eql(13);
    should(addTypeStub.callCount).be.eql(13);
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

  describe('#isValidSpecification', () => {
    it('should resolve true if the specification is correct', () => {
      var
        curateCollectionSpecificationStub = sandbox.stub().resolves({});

      validation.curateCollectionSpecification = curateCollectionSpecificationStub;

      return validation.isValidSpecification('anIndex', 'aCollection', {a: 'specification'})
        .then(result => {
          should(curateCollectionSpecificationStub.callCount).be.eql(1);
          should(result).be.true();
        });
    });

    it('should resolve false if the specification is not correct', () => {
      var
        curateCollectionSpecificationStub = sandbox.stub().rejects({});

      validation.curateCollectionSpecification = curateCollectionSpecificationStub;

      return validation.isValidSpecification('anIndex', 'aCollection', {a: 'bad specification'})
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
    var
      checkAllowedPropertiesStub = sandbox.stub();

    it('should return a default specification if there an empty collection specification is provided', () => {
      var
        indexName = 'anIndex',
        collectionName = 'aCollection',
        collectionSpec = {
        },
        dryRun = false,
        expectedReturn = {
          strict: false,
          fields: {},
          validators: null
        };

      checkAllowedPropertiesStub.returns(true);
      Validation.__set__('checkAllowedProperties', checkAllowedPropertiesStub);

      return validation.curateCollectionSpecification(indexName, collectionName, collectionSpec, dryRun)
        .then(returnedSpec => {
          should(returnedSpec).be.deepEqual(expectedReturn);
        });
    });

    it('should reject an error if the collection specification provides a not allowed property', () => {
      var
        indexName = 'anIndex',
        collectionName = 'aCollection',
        collectionSpec = {
          foo: 'bar'
        },
        dryRun = false;

      checkAllowedPropertiesStub.returns(false);
      Validation.__set__('checkAllowedProperties', checkAllowedPropertiesStub);

      return should(validation.curateCollectionSpecification(indexName, collectionName, collectionSpec, dryRun))
        .be.rejectedWith('The collection specification has invalid properties.');
    });

    it('should return structured fields when a collection specification is provided', () => {
      var
        indexName = 'anIndex',
        structureCollectionValidationStub = sandbox.spy(function () {return arguments[0].fields;}),
        collectionName = 'aCollection',
        collectionSpec = {
          fields: {
            some: 'field'
          }
        },
        dryRun = false,
        expectedReturn = {
          strict: false,
          fields: {
            some: 'field'
          },
          validators: null
        };

      checkAllowedPropertiesStub.returns(true);
      Validation.__set__('checkAllowedProperties', checkAllowedPropertiesStub);
      validation.structureCollectionValidation = structureCollectionValidationStub;

      return validation.curateCollectionSpecification(indexName, collectionName, collectionSpec, dryRun)
        .then(returnedSpec => {
          should(returnedSpec).be.deepEqual(expectedReturn);
        });
    });

    it('should reject an error if the field specification throws an error', () => {
      var
        indexName = 'anIndex',
        structureCollectionValidationStub = sandbox.stub().throws({message: 'an error'}),
        collectionName = 'aCollection',
        collectionSpec = {
          fields: {
            some: 'bad field'
          }
        },
        dryRun = false;

      checkAllowedPropertiesStub.returns(true);
      Validation.__set__('checkAllowedProperties', checkAllowedPropertiesStub);
      validation.structureCollectionValidation = structureCollectionValidationStub;

      return should(validation.curateCollectionSpecification(indexName, collectionName, collectionSpec, dryRun))
        .be.rejectedWith('an error');
    });

    it('should return a treated collection specification if validators are valid', () => {
      var
        indexName = 'anIndex',
        curateValidatorFilterStub = sandbox.spy(function () {return Promise.resolve({id: 'aFilterId'});}),
        collectionName = 'aCollection',
        collectionSpec = {
          validators: [
            'some',
            'validators'
          ]
        },
        dryRun = true,
        expectedReturn = {
          strict: false,
          fields: {},
          validators: 'aFilterId'
        };

      checkAllowedPropertiesStub.returns(true);
      Validation.__set__('checkAllowedProperties', checkAllowedPropertiesStub);
      validation.curateValidatorFilter = curateValidatorFilterStub;

      return validation.curateCollectionSpecification(indexName, collectionName, collectionSpec, dryRun)
        .then(returnedSpec => {
          should(returnedSpec).be.deepEqual(expectedReturn);
          should(curateValidatorFilterStub.args[0][0]).be.eql(indexName);
          should(curateValidatorFilterStub.args[0][1]).be.eql(collectionName);
          should(curateValidatorFilterStub.args[0][2]).be.eql(collectionSpec.validators);
          should(curateValidatorFilterStub.args[0][3]).be.eql(dryRun);
        });
    });

    it('should reject an error if validators are not valid', () => {
      var
        indexName = 'anIndex',
        curateValidatorFilterStub = sandbox.spy(function () {return Promise.reject({an: 'error'});}),
        collectionName = 'aCollection',
        collectionSpec = {
          validators: [
            'bad validators'
          ]
        },
        dryRun = false;

      checkAllowedPropertiesStub.returns(true);
      Validation.__set__('checkAllowedProperties', checkAllowedPropertiesStub);
      validation.curateValidatorFilter = curateValidatorFilterStub;

      return should(validation.curateCollectionSpecification(indexName, collectionName, collectionSpec, dryRun))
        .be.rejectedWith('Validator specification of the collection triggered an error');
    });
  });

  describe('#structureCollectionValidation', () => {
    it('should return a structured collection specification if configuration is correct', () => {
      var
        curateFieldSpecificationStub = sandbox.spy(function () {return arguments[0];}),
        curateStructuredFieldsStub = sandbox.spy(function () {return arguments[1];}),
        collectionSpec = {
          fields: {
            aField: {a: 'field'},
            anotherField: {another: 'field'},
            'aField/aSubField': {a: 'subField'}
          }
        },
        expectedRawFields = {
          1: [{a: 'field', path: ['aField'], depth: 1}, {another: 'field', path: ['anotherField'], depth: 1}],
          2: [{a: 'subField', path: ['aField', 'aSubField'], depth: 2}]
        };

      validation.curateFieldSpecification = curateFieldSpecificationStub;
      Validation.__set__('curateStructuredFields', curateStructuredFieldsStub);

      should(validation.structureCollectionValidation(collectionSpec)).be.deepEqual(expectedRawFields);
      should(curateFieldSpecificationStub.callCount).be.eql(3);
      should(curateStructuredFieldsStub.callCount).be.eql(1);
      should(curateStructuredFieldsStub.args[0][1]).be.deepEqual(expectedRawFields);
      should(curateStructuredFieldsStub.args[0][2]).be.eql(2);
    });

    it('should return an empty object if no field is specified', () => {
      var
        collectionSpec = {fields: {}};

      should(validation.structureCollectionValidation(collectionSpec)).be.deepEqual({});
    });

    it('should throw an error if one of the field curation throws an error', () => {
      var
        curateFieldSpecificationStub = sandbox.stub().throws(new Error('an error')),
        collectionSpec = {
          fields: {
            aField: {a: 'field'},
            anotherField: {another: 'field'},
            'aField/aSubField': {a: 'subField'}
          }
        };

      validation.curateFieldSpecification = curateFieldSpecificationStub;

      should(() => {
        validation.structureCollectionValidation(collectionSpec);
      }).throw('Specification for the field aField triggered an error');

      should(curateFieldSpecificationStub.callCount).be.eql(1);
      should(kuzzle.pluginsManager.trigger.callCount).be.eql(1);
      should(kuzzle.pluginsManager.trigger.args[0][0]).be.eql('log:error');
    });
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

      should(() => {
        validation.curateFieldSpecification(fieldSpec);
      }).throw('Field of type string is not specified properly');
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

      should(() => {
        validation.curateFieldSpecification(fieldSpec);
      }).throw('Field of type string is not specified properly');
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

      should(() => {
        validation.curateFieldSpecification(fieldSpec);
      }).throw(anError);
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

      should(() => {
        validation.curateFieldSpecificationFormat(fieldSpec);
      }).throw('The field specification has invalid properties.');
    });

    it('should throw an error if the field specification does not contain all mandatory fields', () => {
      var
        fieldSpec = {
          mandatory: true
        };

      checkAllowedPropertiesStub.returns(true);

      should(() => {
        validation.curateFieldSpecificationFormat(fieldSpec);
      }).throw('type is a mandatory field specification property.');
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

      should(() => {
        validation.curateFieldSpecificationFormat(fieldSpec);
      }).throw('not_recognized is not a recognized type.');
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

      should(() => {
        validation.curateFieldSpecificationFormat(fieldSpec);
      }).throw('The multivalued field specification has invalid properties.');
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

      should(() => {
        validation.curateFieldSpecificationFormat(fieldSpec);
      }).throw('"value" is a mandatory property for multivalued field specification.');
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

      should(() => {
        validation.curateFieldSpecificationFormat(fieldSpec);
      }).throw('"minCount" is not valid when multivalued field is disabled.');
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

      should(() => {
        validation.curateFieldSpecificationFormat(fieldSpec);
      }).throw('"maxCount" is not valid when multivalued field is disabled.');
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

      should(() => {
        validation.curateFieldSpecificationFormat(fieldSpec);
      }).throw('"minCount" can not be greater than "maxCount".');
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
    it('should return a promise if everything goes as expected', () => {
      var
        registerStub = sandbox.stub().resolves({}),
        validateStub = sandbox.stub().resolves({}),
        indexName = 'anIndex',
        collectionName= 'aCollection',
        validatorFilter = [{some: 'filters'}],
        dryRun = false,
        expectedQuery = {
          bool: {
            must: validatorFilter
          }
        };

      validation.dsl = {
        register: registerStub,
        validate: validateStub
      };

      return validation.curateValidatorFilter(indexName, collectionName, validatorFilter, dryRun)
        .then(() => {
          should(validateStub.callCount).be.eql(1);
          should(validateStub.args[0][0]).be.deepEqual(expectedQuery);
          should(registerStub.callCount).be.eql(1);
          should(registerStub.args[0][0]).be.eql(indexName);
          should(registerStub.args[0][1]).be.eql(collectionName);
          should(registerStub.args[0][2]).be.deepEqual(expectedQuery);
        });
    });

    it('should return a promise if everything goes as expected and avoid registration if dryRun is true', () => {
      var
        registerStub = sandbox.stub().resolves({}),
        validateStub = sandbox.stub().resolves({}),
        indexName = 'anIndex',
        collectionName= 'aCollection',
        validatorFilter = [{some: 'filters'}],
        dryRun = true,
        expectedQuery = {
          bool: {
            must: validatorFilter
          }
        };

      validation.dsl = {
        register: registerStub,
        validate: validateStub
      };

      return validation.curateValidatorFilter(indexName, collectionName, validatorFilter, dryRun)
        .then(() => {
          should(validateStub.callCount).be.eql(1);
          should(registerStub.callCount).be.eql(0);
          should(validateStub.args[0][0]).be.deepEqual(expectedQuery);
        });
    });
  });
});
