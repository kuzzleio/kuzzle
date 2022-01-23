'use strict';

const should = require('should');
const Bluebird = require('bluebird');
const sinon = require('sinon');
const mockRequire = require('mock-require');

const KuzzleMock = require('../../mocks/kuzzle.mock');

const {
  BadRequestError,
  PluginImplementationError,
  PreconditionError
} = require('../../../index');

describe('Test: validation initialization', () => {
  let
    Validation,
    validation,
    kuzzle;

  beforeEach(() => {
    sinon.reset();

    kuzzle = new KuzzleMock();

    Validation = mockRequire.reRequire('../../../lib/core/validation');
    validation = new Validation();
  });

  afterEach(() => {
    mockRequire.stopAll();
  });

  it('should have the expected structure', () => {
    should(validation.types).be.an.Object();
    should(validation.specification).be.an.Object();
    should(validation.koncorde).be.an.Object();
    should(validation.rawConfiguration).be.an.Object();
    should(Array.isArray(validation.typeAllowsChildren)).be.true();
  });

  it('should add the type provided in defaultTypesFiles', () => {
    const
      validationStub = sinon.spy(() => {}),
      addTypeStub = sinon.stub();

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
      mockRequire('../../../lib/core/validation/types/'+ fileName, validationStub);
    });

    Validation = mockRequire.reRequire('../../../lib/core/validation');
    validation = new Validation();

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
      kuzzle.ask.withArgs('core:storage:private:document:search').resolves({
        hits: [
          { _id: 'anIndex#aCollection', _source: { index: 'anIndex', collection: 'aCollection', validation: { a: 'specification' } } },
          { _id: 'anIndex#anotherCollection', _source: { index: 'anIndex', collection: 'anotherCollection', validation: { another: 'specification' } } },
          { _id: 'anIndex#anotherCollection', _source: { index: 'anotherIndex', collection: 'anotherCollection', validation: { another: 'specification' } } },
        ],
        length: 3
      });
    });

    it('should build a specification if everything goes as expected', () => {
      validation.curateCollectionSpecification = sinon.spy(function (...args) {
        return Bluebird.resolve(args[2]);
      });

      return validation.curateSpecification()
        .then(() => {
          should(validation.rawConfiguration).be.eql(configurationMock);
          should(validation.specification).be.deepEqual(configurationMock);
        });
    });

    it('should build a specification if everything goes as expected', () => {
      validation.curateCollectionSpecification = sinon.spy(function () {
        return Bluebird.reject(new Error('error'));
      });

      return validation.curateSpecification()
        .then(() => {
          should(validation.rawConfiguration).be.eql(configurationMock);
          should(validation.specification).be.deepEqual({});
          should(kuzzle.log.error.callCount).be.eql(6);
        });
    });
  });

  describe('#validateFormat', () => {
    it('should resolve true if the specification is correct', () => {
      const
        curateCollectionSpecificationStub = sinon.stub().resolves({});

      validation.curateCollectionSpecification = curateCollectionSpecificationStub;

      return validation.validateFormat('anIndex', 'aCollection', { a: 'specification' })
        .then(result => {
          should(curateCollectionSpecificationStub.callCount).be.eql(1);
          should(result.isValid).be.true();
        });
    });

    it('should resolve false if the specification is not correct', () => {
      const
        curateCollectionSpecificationStub = sinon.stub(validation, 'curateCollectionSpecification')
          .rejects(new Error('Mocked Error'));

      return validation.validateFormat('anIndex', 'aCollection', { a: 'bad specification' })
        .then(result => {
          should(curateCollectionSpecificationStub.callCount).be.eql(1);
          should(result.isValid).be.false();
        });
    });

    it('should resolve false and provide errors if the specification is not correct and we want some verbose errors', () => {
      const
        curateCollectionSpecificationStub = sinon.stub(validation, 'curateCollectionSpecification')
          .resolves({ isValid: false, errors: ['some error'] });

      return validation.validateFormat('anIndex', 'aCollection', { a: 'bad specification' }, true)
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
        should(error.id).eql('validation.types.already_exists');
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
        should(error.id).be.eql('validation.types.missing_type_name');
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
        should(error.message).startWith('The type "aType" must implement a function "validate".');
        should(error.id).be.eql('validation.types.missing_function');
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
        should(error.message).startWith('The type "aType" must implement a function "validateFieldSpecification".');
        should(error.id).be.eql('validation.types.missing_function');
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
        should(error.message).startWith('The type "aType" must implement a function "getStrictness".');
        should(error.id).be.eql('validation.types.missing_function');
      }
    });
  });

  describe('#curateCollectionSpecification', () => {
    const checkAllowedPropertiesStub = sinon.stub();

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
        .be.rejectedWith(PreconditionError, {
          id: 'validation.assert.unexpected_properties'
        });
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
          should(response.errors[0]).be.eql(`The object "${indexName}.${collectionName}" contains unexpected properties (allowed: strict, fields, validators).`);
        });
    });

    it('should return structured fields when a collection specification is provided', () => {
      const
        indexName = 'anIndex',
        structureCollectionValidationStub = sinon.spy(function (...args) {
          return args[0].fields;
        }),
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
        structureCollectionValidationStub = sinon.spy(function (...args) {
          return args[0].fields;
        }),
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
        structureCollectionValidationStub = sinon.stub().throws(new Error('an error')),
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
      sinon.stub(validation, 'structureCollectionValidation').returns({ isValid: false, errors: ['an error'] });

      return should(validation.curateCollectionSpecification(indexName, collectionName, collectionSpec, dryRun))
        .be.rejectedWith(BadRequestError, {
          id: 'validation.assert.invalid_specifications'
        });
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

      sinon.stub(validation, 'structureCollectionValidation').returns({ isValid: false, errors: ['an error'] });

      checkAllowedPropertiesStub.returns(true);

      return validation.curateCollectionSpecification(indexName, collectionName, collectionSpec, dryRun, verboseErrors)
        .catch(error => {
          should(error.message).be.exactly('an error');
          should(error.details.length).be.exactly(1);
          should(error.details[0]).be.exactly('an error');
        });
    });

    it('should return a treated collection specification if validators are valid', () => {
      const indexName = 'anIndex';
      const curateValidatorFilterStub = sinon.stub().returns('aFilterId');
      const collectionName = 'aCollection';
      const collectionSpec = {
        validators: [
          'some',
          'validators'
        ]
      };
      const dryRun = true;
      const expectedReturn = {
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
      const indexName = 'anIndex';
      const collectionName = 'aCollection';
      const collectionSpec = {
        validators: [
          'bad validators'
        ]
      };
      const dryRun = false;

      checkAllowedPropertiesStub.returns(true);
      sinon.stub(validation, 'curateValidatorFilter').throws(new Error('error'));

      return should(validation.curateCollectionSpecification(indexName, collectionName, collectionSpec, dryRun))
        .be.rejectedWith(BadRequestError, {
          id: 'validation.assert.invalid_filters'
        });
    });
  });

  describe('#structureCollectionValidation', () => {
    it('should return a structured collection specification if configuration is correct', () => {
      const
        curateFieldSpecificationStub = sinon.spy(function (...args) {
          return { isValid: true, fieldSpec: args[0] };
        }),
        collectionSpec = {
          fields: {
            aField: { a: 'field', type: 'foo' },
            anotherField: { another: 'field' },
            'aField/aSubField': { a: 'subField' }
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
      should(validation.structureCollectionValidation({ fields: {} })).be.deepEqual({});
    });

    it('should throw an error if one of the field curation throws an error', () => {
      const
        curateFieldSpecificationStub = sinon.stub().throws(new Error('an error')),
        collectionSpec = {
          fields: {
            aField: { a: 'field' },
            anotherField: { another: 'field' },
            'aField/aSubField': { a: 'subField' }
          }
        };

      validation.curateFieldSpecification = curateFieldSpecificationStub;

      should(() => validation.structureCollectionValidation(collectionSpec))
        .throw('an error');

      should(curateFieldSpecificationStub.callCount).be.eql(1);
      should(kuzzle.log.error).calledOnce();
    });

    it('should return an error array if one of the field curation returns an error in verbose mode', () => {
      const
        curateFieldSpecificationStub = sinon.stub(),
        indexName = 'anIndex',
        collectionName = 'aCollection',
        verboseErrors = true,
        collectionSpec = {
          fields: {
            aField: { a: 'field' },
            anotherField: { another: 'field' },
            'aField/aSubField': { a: 'subField' }
          }
        };

      curateFieldSpecificationStub.onCall(0).returns({ isValid: false, errors: ['error one'] });
      curateFieldSpecificationStub.onCall(1).returns({ isValid: false, errors: ['error two'] });
      curateFieldSpecificationStub.onCall(2).returns({ isValid: false, errors: ['error three'] });

      validation.curateFieldSpecification = curateFieldSpecificationStub;

      const response = validation.structureCollectionValidation(collectionSpec, indexName, collectionName, verboseErrors);

      should(response.isValid).be.false();
      should(response.errors.length).be.eql(3);
      should(response.errors[0]).be.eql('error one');
      should(response.errors[1]).be.eql('error two');
      should(response.errors[2]).be.eql('error three');
      should(curateFieldSpecificationStub.callCount).be.eql(3);
      should(kuzzle.log.error.callCount).be.eql(3);
    });
  });

  describe('#curateFieldSpecification', () => {
    beforeEach(() => {
      validation.curateFieldSpecificationFormat = sinon.stub().returns({ isValid: true });
    });

    it('should validate and curate field specifications with default configuration', () => {
      const
        typeValidateSpecValidation = sinon.stub().returns({}),
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

      validation.types.string = { validateFieldSpecification: typeValidateSpecValidation };

      should(validation.curateFieldSpecification(fieldSpec)).be.deepEqual(expectedReturn);
    });

    it('should validate, curate field specifications and use returned typeOptions of the field validation', () => {
      const
        genericMock = { foo: 'bar' },
        typeValidateSpecValidation = sinon.stub().returns(genericMock),
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

      validation.types.string = { validateFieldSpecification: typeValidateSpecValidation };

      should(validation.curateFieldSpecification(fieldSpec)).be.deepEqual(expectedReturn);
    });

    it('should throw an error if type validation throws', () => {
      const
        typeValidateSpecValidation = sinon.stub().throws(new PreconditionError('foobar')),
        fieldSpec = {
          type: 'string'
        };

      validation.types.string = { validateFieldSpecification: typeValidateSpecValidation };

      should(() => {
        validation.curateFieldSpecification(fieldSpec);
      }).throw(PreconditionError, { message: 'foobar' });
    });

    it('should return an error if type validation returns false with verbose mode', () => {
      const
        typeValidateSpecValidation = sinon.stub().returns(true),
        fieldSpec = {
          type: 'string',
          typeOptions: 'foobar'
        };

      validation.types.string = { validateFieldSpecification: typeValidateSpecValidation };

      const response = validation.curateFieldSpecification(
        fieldSpec,
        'anIndex',
        'aCollection',
        'aField',
        true);
      should(response.isValid).be.false();
      should(response.errors.length).be.eql(1);
      should(response.errors[0]).startWith('The object "anIndex.aCollection.aField" contains unexpected properties');
    });

    it('should validate typeOptions from the field type', () => {
      const
        typeValidateSpecValidation = sinon.stub().returns({ some: 'options' }),
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
        typeValidateSpecValidation = sinon.stub().returns(true),
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
      }).throw({ message: /^The object "undefined.undefined.undefined" contains unexpected properties/ });
    });

    it('should throw a PluginImplementationError if a type throws a non-KuzzleError error', () => {
      const
        typeValidateSpecValidation = sinon.stub().throws(new Error('foobar')),
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
      }).throw(PluginImplementationError, {
        id: 'plugin.runtime.unexpected_error'
      });
    });

    it('should return an error if a field specification format is invalid in verbose mode', () => {
      const
        anError = { isValid: false, errors: ['an error'] },
        fieldSpec = {
          type: 'string',
          typeOptions: {
            some: 'options'
          }
        };

      validation.curateFieldSpecificationFormat = sinon.stub().returns({ isValid: false, errors: ['an error'] });

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
      }).throw(PreconditionError, {
        id: 'validation.assert.unexpected_properties'
      });
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

      const response = validation.curateFieldSpecificationFormat(
        fieldSpec,
        indexName,
        collectionName,
        fieldName,
        verboseErrors);
      should(response.isValid).be.false();
      should(response.errors.length).be.eql(2);
      should(response.errors).be.eql([
        'The object "anIndex.aCollection.aField" contains unexpected properties (allowed: mandatory, type, defaultValue, description, multivalued, typeOptions).',
        'In "anIndex.aCollection.aField": unknown type "aType".'
      ]);
    });

    it('should throw an error if the field specification does not contain all mandatory fields', () => {
      const
        fieldSpec = {
          mandatory: true
        };

      should(() => {
        validation.curateFieldSpecificationFormat(fieldSpec);
      }).throw('Missing property "type" in field "undefined.undefined.undefined".');
    });

    it('should throw an error if the field specification contains a not recognized type', () => {
      const fieldSpec = { type: 'not_recognized' };

      validation.types = {
        string: 'aType'
      };

      should(() => {
        validation.curateFieldSpecificationFormat(fieldSpec);
      }).throw('In "undefined.undefined.undefined": unknown type "not_recognized".');
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
      }).throw('The object "undefined.undefined.undefined.multivalued" contains unexpected properties (allowed: value, minCount, maxCount).');
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
      }).throw('Missing property "value" in field "undefined.undefined.undefined.multivalued".');
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
      }).throw('Field "undefined.undefined.undefined": cannot set a property "minCount" if the field is not multivalued.');
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
      }).throw('Field "undefined.undefined.undefined": cannot set a property "maxCount" if the field is not multivalued.');
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
      }).throw('Property "undefined.undefined.undefined": invalid range (minCount > maxCount).');
    });

    it('should throw if the multivalued value field is not a boolean', () => {
      const
        fieldSpec = {
          type: 'string',
          multivalued: {
            value: null,
            maxCount: 42
          }
        };

      validation.types = {
        string: 'aType'
      };

      should(() => validation.curateFieldSpecificationFormat(fieldSpec))
        .throw('Wrong type for parameter "undefined.undefined.undefined.multivalued.value" (expected: boolean).');
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
      const registerStub = sinon.stub().returns({});
      const validateStub = sinon.stub();
      const index = 'anIndex';
      const collection = 'aCollection';
      const filter = [{ some: 'filters' }];
      const dryRun = false;
      const expectedQuery = {
        bool: {
          must: filter
        }
      };

      validation.koncorde = {
        register: registerStub,
        validate: validateStub
      };

      validation.curateValidatorFilter(index, collection, filter, dryRun);
      should(validateStub.callCount).be.eql(1);
      should(validateStub.args[0][0]).be.deepEqual(expectedQuery);
      should(registerStub)
        .calledOnce()
        .calledWithMatch(expectedQuery, `${index}/${collection}`);
    });

    it('should return a promise if everything goes as expected and avoid registration if dryRun is true', () => {
      const registerStub = sinon.stub().returns({});
      const validateStub = sinon.stub();
      const index = 'anIndex';
      const collection= 'aCollection';
      const filter = [{ some: 'filters' }];
      const dryRun = true;
      const expectedQuery = {
        bool: {
          must: filter
        }
      };

      validation.koncorde = {
        register: registerStub,
        validate: validateStub
      };

      validation.curateValidatorFilter(index, collection, filter, dryRun);
      should(validateStub).calledOnce().calledWithMatch(expectedQuery);
      should(registerStub).not.called();
    });
  });
});
