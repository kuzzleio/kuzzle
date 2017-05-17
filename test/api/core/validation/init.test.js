'use strict';

require('reify');

const
  should = require('should'),
  Bluebird = require('bluebird'),
  sinon = require('sinon'),
  mockRequire = require('mock-require'),
  KuzzleMock = require('../../../mocks/kuzzle.mock');

describe('Test: validation initialization', () => {
  let
    Validation,
    validation,
    sandbox = sinon.sandbox.create(),
    kuzzle;

  beforeEach(() => {
    mockRequire.stopAll();
    kuzzle = new KuzzleMock();

    Validation = mockRequire.reRequire('../../../../lib/api/core/validation');
    validation = new Validation(kuzzle);

    sandbox.reset();
  });

  afterEach(() => {
    mockRequire.stopAll();
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
    const
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

    Validation = mockRequire.reRequire('../../../../lib/api/core/validation');
    validation = new Validation(kuzzle);

    validation.addType = addTypeStub;

    validation.init();

    should(validationStub.callCount).be.eql(13);
    should(addTypeStub.callCount).be.eql(13);
  });

  describe('#curateSpecification', () => {
    const
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
      };

    beforeEach(() => {
      kuzzle.internalEngine.search.returns(Bluebird.resolve({
        hits: [
          {_source: {index: 'anIndex', collection: 'aCollection', validation: {a: 'specification'}}},
          {_source: {index: 'anIndex', collection: 'anotherCollection', validation: {another: 'specification'}}},
          {_source: {index: 'anotherIndex', collection: 'anotherCollection', validation: {another: 'specification'}}},
        ],
        length: 3
      }));
    });

    it('should build a specification if everything goes as expected', () => {
      validation.curateCollectionSpecification = sandbox.spy(function () {
        return Bluebird.resolve(arguments[2]);
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
        return Bluebird.reject(new Error('error'));
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
      const
        curateCollectionSpecificationStub = sandbox.stub().returns(Bluebird.resolve({}));

      validation.curateCollectionSpecification = curateCollectionSpecificationStub;

      return validation.isValidSpecification('anIndex', 'aCollection', {a: 'specification'})
        .then(result => {
          should(curateCollectionSpecificationStub.callCount).be.eql(1);
          should(result.isValid).be.true();
        });
    });

    it('should resolve false if the specification is not correct', () => {
      const
        curateCollectionSpecificationStub = sandbox.stub(validation, 'curateCollectionSpecification').returns(Bluebird.reject(new Error('Mocked error')));

      return validation.isValidSpecification('anIndex', 'aCollection', {a: 'bad specification'})
        .then(result => {
          should(curateCollectionSpecificationStub.callCount).be.eql(1);
          should(result.isValid).be.false();
        });
    });

    it('should resolve false and provide errors if the specification is not correct and we want some verbose errors', () => {
      const
        curateCollectionSpecificationStub = sandbox.stub(validation, 'curateCollectionSpecification').returns(Bluebird.resolve({isValid: false, errors: ['some error']}));

      return validation.isValidSpecification('anIndex', 'aCollection', {a: 'bad specification'}, true)
        .then(result => {
          should(curateCollectionSpecificationStub.callCount).be.eql(1);
          should(result.isValid).be.false();
          should(result.errors.length).be.eql(1);
        });
    });
  });

  describe('#addType', () => {
    it('should add a type with children properly', () => {
      const
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
      const
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
      const
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
      const
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
      const
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
      const
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
      const
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
    const
      checkAllowedPropertiesStub = sandbox.stub();

    it('should return a default specification if there an empty collection specification is provided', () => {
      const
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

      return validation.curateCollectionSpecification(indexName, collectionName, collectionSpec, dryRun)
        .then(returnedSpec => {
          should(returnedSpec).be.deepEqual(expectedReturn);
        });
    });

    it('should reject an error if the collection specification provides a not allowed property', () => {
      const
        indexName = 'anIndex',
        collectionName = 'aCollection',
        collectionSpec = {
          foo: 'bar'
        },
        dryRun = false;

      checkAllowedPropertiesStub.returns(false);

      return should(validation.curateCollectionSpecification(indexName, collectionName, collectionSpec, dryRun))
        .be.rejectedWith('anIndex.aCollection: the collection specification has invalid properties.');
    });

    it('should reject an error if the collection specification provides a not allowed property in verbose mode', () => {
      const
        indexName = 'anIndex',
        collectionName = 'aCollection',
        collectionSpec = {
          foo: 'bar'
        },
        dryRun = false,
        verboseErrors = true;

      checkAllowedPropertiesStub.returns(false);

      return validation.curateCollectionSpecification(indexName, collectionName, collectionSpec, dryRun, verboseErrors)
        .then(response => {
          should(response.isValid).be.false();
          should(response.errors.length).be.eql(1);
          should(response.errors[0]).be.eql(`${indexName}.${collectionName}: the collection specification has invalid properties.`);
        });
    });

    it('should return structured fields when a collection specification is provided', () => {
      const
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
      validation.structureCollectionValidation = structureCollectionValidationStub;

      return validation.curateCollectionSpecification(indexName, collectionName, collectionSpec, dryRun)
        .then(returnedSpec => {
          should(returnedSpec).be.deepEqual(expectedReturn);
        });
    });

    it('should return structured fields when a collection specification is provided even in verbose mode', () => {
      const
        indexName = 'anIndex',
        structureCollectionValidationStub = sandbox.spy(function () {return arguments[0].fields;}),
        collectionName = 'aCollection',
        collectionSpec = {
          fields: {
            some: 'field'
          }
        },
        dryRun = false,
        verboseErrors = true,
        expectedReturn = {
          strict: false,
          fields: {
            some: 'field'
          },
          validators: null
        };

      checkAllowedPropertiesStub.returns(true);
      validation.structureCollectionValidation = structureCollectionValidationStub;

      return validation.curateCollectionSpecification(indexName, collectionName, collectionSpec, dryRun, verboseErrors)
        .then(returnedSpec => {
          should(returnedSpec).be.deepEqual(expectedReturn);
        });
    });

    it('should reject an error if the field specification throws an error', () => {
      const
        indexName = 'anIndex',
        structureCollectionValidationStub = sandbox.stub().throws(new Error('an error')),
        collectionName = 'aCollection',
        collectionSpec = {
          fields: {
            some: 'bad field'
          }
        },
        dryRun = false;

      checkAllowedPropertiesStub.returns(true);
      validation.structureCollectionValidation = structureCollectionValidationStub;

      return should(validation.curateCollectionSpecification(indexName, collectionName, collectionSpec, dryRun))
        .be.rejectedWith('an error');
    });

    it('should reject an error if the field specification returns an error', () => {
      const
        indexName = 'anIndex',
        collectionName = 'aCollection',
        collectionSpec = {
          fields: {
            some: 'bad field'
          }
        },
        dryRun = false;

      checkAllowedPropertiesStub.returns(true);
      sandbox.stub(validation, 'structureCollectionValidation').returns({isValid: false, errors: ['an error']});

      return should(validation.curateCollectionSpecification(indexName, collectionName, collectionSpec, dryRun))
        .be.rejectedWith('an error');
    });

    it('should reject an error if the field specification returns an error in verbose mode', () => {
      const
        indexName = 'anIndex',
        collectionName = 'aCollection',
        collectionSpec = {
          fields: {
            some: 'bad field'
          }
        },
        dryRun = false,
        verboseErrors = true;

      sandbox.stub(validation, 'structureCollectionValidation').returns({isValid: false, errors: ['an error']});

      checkAllowedPropertiesStub.returns(true);

      return validation.curateCollectionSpecification(indexName, collectionName, collectionSpec, dryRun, verboseErrors)
        .catch(error => {
          should(error.message).be.exactly('an error');
          should(error.details.length).be.exactly(1);
          should(error.details[0]).be.exactly('an error');
        });
    });

    it('should return a treated collection specification if validators are valid', () => {
      const
        indexName = 'anIndex',
        curateValidatorFilterStub = sandbox.spy(function () {return Bluebird.resolve({id: 'aFilterId'});}),
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
      const
        indexName = 'anIndex',
        curateValidatorFilterStub = sandbox.spy(function () {return Bluebird.reject(new Error('error'));}),
        collectionName = 'aCollection',
        collectionSpec = {
          validators: [
            'bad validators'
          ]
        },
        dryRun = false;

      checkAllowedPropertiesStub.returns(true);
      validation.curateValidatorFilter = curateValidatorFilterStub;

      return should(validation.curateCollectionSpecification(indexName, collectionName, collectionSpec, dryRun))
        .be.rejectedWith('Validator specification of the collection anIndex.aCollection triggered an error');
    });
  });

  describe('#structureCollectionValidation', () => {
    it('should return a structured collection specification if configuration is correct', () => {
      const
        curateFieldSpecificationStub = sandbox.spy(function (...args) {return {isValid: true, fieldSpec: args[0]};}),
        collectionSpec = {
          fields: {
            aField: {a: 'field', type: 'foo'},
            anotherField: {another: 'field'},
            'aField/aSubField': {a: 'subField'}
          }
        },
        expectedRawFields = {
          children: {
            aField: {
              a: 'field',
              type: 'foo',
              path: [ 'aField' ],
              depth: 1,
              children: { aSubField: { a: 'subField', path: [ 'aField', 'aSubField' ], depth: 2 } }
            },
            anotherField: { another: 'field', path: [ 'anotherField' ], depth: 1 }
          },
          root: true
        };

      validation.typeAllowsChildren.push('foo');
      validation.curateFieldSpecification = curateFieldSpecificationStub;

      should(validation.structureCollectionValidation(collectionSpec)).be.deepEqual(expectedRawFields);
      should(curateFieldSpecificationStub.callCount).be.eql(3);
    });

    it('should return an empty object if no field is specified', () => {
      should(validation.structureCollectionValidation({fields: {}})).be.deepEqual({});
    });

    it('should throw an error if one of the field curation throws an error', () => {
      const
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
      }).throw('Specification for the field undefined.undefined.aField triggered an error');

      should(curateFieldSpecificationStub.callCount).be.eql(1);
      should(kuzzle.pluginsManager.trigger.callCount).be.eql(1);
      should(kuzzle.pluginsManager.trigger.args[0][0]).be.eql('log:error');
    });

    it('should return an error array if one of the field curation returns an error in verbose mode', () => {
      const
        curateFieldSpecificationStub = sandbox.stub(),
        indexName = 'anIndex',
        collectionName = 'aCollection',
        verboseErrors = true,
        collectionSpec = {
          fields: {
            aField: {a: 'field'},
            anotherField: {another: 'field'},
            'aField/aSubField': {a: 'subField'}
          }
        };

      curateFieldSpecificationStub.onCall(0).returns({isValid: false, errors: ['error one']});
      curateFieldSpecificationStub.onCall(1).returns({isValid: false, errors: ['error two']});
      curateFieldSpecificationStub.onCall(2).returns({isValid: false, errors: ['error three']});

      validation.curateFieldSpecification = curateFieldSpecificationStub;

      const response = validation.structureCollectionValidation(collectionSpec, indexName, collectionName, verboseErrors);

      should(response.isValid).be.false();
      should(response.errors.length).be.eql(3);
      should(response.errors[0]).be.eql('error one');
      should(response.errors[1]).be.eql('error two');
      should(response.errors[2]).be.eql('error three');
      should(curateFieldSpecificationStub.callCount).be.eql(3);
      should(kuzzle.pluginsManager.trigger.callCount).be.eql(3);
      should(kuzzle.pluginsManager.trigger.args[0][0]).be.eql('log:error');
    });
  });

  describe('#curateFieldSpecification', () => {
    const
      curateFieldSpecificationFormat = sandbox.stub().returns({isValid: true});

    beforeEach(() => {
      validation.curateFieldSpecificationFormat = curateFieldSpecificationFormat;
    });

    it('should validate and curate field specifications with default configuration', () => {
      const
        typeValidateSpecValidation = sandbox.stub().returns({}),
        fieldSpec = {
          type: 'string'
        },
        expectedReturn = {
          isValid: true,
          fieldSpec: {
            type: 'string',
            mandatory: false,
            multivalued: {
              value: false
            },
            typeOptions: {}
          }
        };

      validation.types.string = {validateFieldSpecification: typeValidateSpecValidation};

      should(validation.curateFieldSpecification(fieldSpec)).be.deepEqual(expectedReturn);
    });

    it('should validate, curate field specifications and use returned typeOptions of the field validation', () => {
      const
        genericMock = {foo: 'bar'},
        typeValidateSpecValidation = sandbox.stub().returns(genericMock),
        fieldSpec = {
          type: 'string'
        },
        expectedReturn = {
          isValid: true,
          fieldSpec: {
            type: 'string',
            mandatory: false,
            multivalued: {
              value: false
            },
            typeOptions: genericMock
          }
        };

      validation.types.string = {validateFieldSpecification: typeValidateSpecValidation};

      should(validation.curateFieldSpecification(fieldSpec)).be.deepEqual(expectedReturn);
    });

    it('should throw an error if type validation returns false', () => {
      const
        typeValidateSpecValidation = sandbox.stub().returns(false),
        fieldSpec = {
          type: 'string'
        };

      validation.types.string = {validateFieldSpecification: typeValidateSpecValidation};

      should(() => {
        validation.curateFieldSpecification(fieldSpec);
      }).throw('Field of type string is not specified properly');
    });

    it('should return an error if type validation returns false with verbose mode', () => {
      const
        typeValidateSpecValidation = sandbox.stub().returns(true),
        fieldSpec = {
          type: 'string',
          typeOptions: 'foobar'
        };

      validation.types.string = {validateFieldSpecification: typeValidateSpecValidation};

      const response = validation.curateFieldSpecification(fieldSpec, 'anIndex', 'aCollection', 'aField', true);
      should(response.isValid).be.false();
      should(response.errors.length).be.eql(1);
      should(response.errors[0]).eql('Field anIndex.aCollection.aField of type string is not specified properly');
    });

    it('should validate typeOptions from the field type', () => {
      const
        typeValidateSpecValidation = sandbox.stub().returns({some: 'options'}),
        fieldSpec = {
          type: 'string',
          typeOptions: {
            some: 'options'
          }
        },
        expectedReturn = {
          isValid: true,
          fieldSpec: {
            type: 'string',
            mandatory: false,
            multivalued: {
              value: false
            },
            typeOptions: {
              some: 'options'
            }
          }
        };

      validation.types.string = {
        validateFieldSpecification: typeValidateSpecValidation,
        allowedTypeOptions: ['some']
      };

      should(validation.curateFieldSpecification(fieldSpec)).be.deepEqual(expectedReturn);
    });

    it('should throw an error if an option of typeOptions is invalid', () => {
      const
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
      }).throw('Field undefined.undefined.undefined of type string is not specified properly');
    });

    it('should throw an error if an option of typeOptions is invalid', () => {
      const
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

    it('should return an error if a field specification format is invalid in verbose mode', () => {
      const
        anError = {isValid: false, errors: ['an error']},
        fieldSpec = {
          type: 'string',
          typeOptions: {
            some: 'options'
          }
        };

      validation.curateFieldSpecificationFormat = sandbox.stub().returns({isValid: false, errors: ['an error']});

      const response = validation.curateFieldSpecification(fieldSpec, 'anIndex', 'aCollection', 'aField', true);

      should(response).be.deepEqual(anError);
    });
  });

  describe('#curateFieldSpecificationFormat', () => {
    it('should throw an error if the field specification contains not allowed fields', () => {
      const
        fieldSpec = {
          type: 'string',
          foo: 'bar'
        };

      should(() => {
        validation.curateFieldSpecificationFormat(fieldSpec);
      }).throw('The field undefined.undefined.undefined specification has invalid properties.');
    });

    it('should return an error if the field specification is wrong in verbose mode', () => {
      const
        fieldSpec = {
          type: 'aType',
          foo: 'bar'
        },
        indexName = 'anIndex',
        collectionName = 'aCollection',
        fieldName = 'aField',
        verboseErrors = true;

      const response = validation.curateFieldSpecificationFormat(fieldSpec, indexName, collectionName, fieldName, verboseErrors);
      should(response.isValid).be.false();
      should(response.errors.length).be.eql(2);
      should(response.errors).be.eql([
        'The field anIndex.aCollection.aField specification has invalid properties.',
        'In anIndex.aCollection.aField: aType is not a recognized type.'
      ]);
    });

    it('should throw an error if the field specification does not contain all mandatory fields', () => {
      const
        fieldSpec = {
          mandatory: true
        };

      should(() => {
        validation.curateFieldSpecificationFormat(fieldSpec);
      }).throw('In undefined.undefined.undefined, type is a mandatory field specification property.');
    });

    it('should throw an error if the field specification contains a not recognized type', () => {
      const fieldSpec = {type: 'not_recognized'};

      validation.types = {
        string: 'aType'
      };

      should(() => {
        validation.curateFieldSpecificationFormat(fieldSpec);
      }).throw('In undefined.undefined.undefined: not_recognized is not a recognized type.');
    });

    it('should throw an error if the multivalued field is malformed', () => {
      const
        fieldSpec = {
          type: 'string',
          multivalued: {
            foo: 'bar'
          }
        };

      validation.types = {
        string: 'aType'
      };

      should(() => {
        validation.curateFieldSpecificationFormat(fieldSpec);
      }).throw('In undefined.undefined.undefined, the multivalued field specification has invalid properties.');
    });

    it('should throw an error if the multivalued field is malformed', () => {
      const
        fieldSpec = {
          type: 'string',
          multivalued: {}
        };

      validation.types = {
        string: 'aType'
      };

      should(() => {
        validation.curateFieldSpecificationFormat(fieldSpec);
      }).throw('In undefined.undefined.undefined, "value" is a mandatory property for multivalued field specification.');
    });

    it('should throw an error if the multivalued field is malformed', () => {
      const
        fieldSpec = {
          type: 'string',
          multivalued: {
            value: false,
            minCount: 42
          }
        };

      validation.types = {
        string: 'aType'
      };

      should(() => {
        validation.curateFieldSpecificationFormat(fieldSpec);
      }).throw('In undefined.undefined.undefined, "minCount" is not valid when multivalued field is disabled.');
    });

    it('should throw an error if the multivalued field is malformed', () => {
      const
        fieldSpec = {
          type: 'string',
          multivalued: {
            value: false,
            maxCount: 42
          }
        };

      validation.types = {
        string: 'aType'
      };

      should(() => {
        validation.curateFieldSpecificationFormat(fieldSpec);
      }).throw('In undefined.undefined.undefined, "maxCount" is not valid when multivalued field is disabled.');
    });

    it('should throw an error if the multivalued field is malformed', () => {
      const
        fieldSpec = {
          type: 'string',
          multivalued: {
            value: true,
            minCount: 43,
            maxCount: 42
          }
        };

      validation.types = {
        string: 'aType'
      };

      should(() => {
        validation.curateFieldSpecificationFormat(fieldSpec);
      }).throw('In undefined.undefined.undefined, "minCount" can not be greater than "maxCount".');
    });

    it('should return true if specification is well formed', () => {
      const
        fieldSpec = {
          type: 'string'
        };

      validation.types = {
        string: 'aType'
      };

      should(validation.curateFieldSpecificationFormat(fieldSpec).isValid).be.true();
    });

    it('should return true if specification is well formed', () => {
      const
        fieldSpec = {
          type: 'string',
          multivalued: {
            value: true,
            minCount: 41,
            maxCount: 42
          }
        };

      validation.types = {
        string: 'aType'
      };

      should(validation.curateFieldSpecificationFormat(fieldSpec).isValid).be.true();
    });
  });

  describe('#curateValidatorFilter', () => {
    it('should return a promise if everything goes as expected', () => {
      const
        registerStub = sandbox.stub().returns(Bluebird.resolve({})),
        validateStub = sandbox.stub().returns(Bluebird.resolve({})),
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
      const
        registerStub = sandbox.stub().returns(Bluebird.resolve({})),
        validateStub = sandbox.stub().returns(Bluebird.resolve({})),
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
