'use strict';

const should = require('should');
const sinon = require('sinon');
const rewire = require('rewire');

const Validation = rewire('../../../lib/core/validation/validation');
const KuzzleMock = require('../../mocks/kuzzle.mock');
const {
  Request,
  BadRequestError
} = require('../../../index');

describe('Test: validation.validate', () => {
  let validation;
  let kuzzle;
  const typeValidateStub = sinon.stub();
  const getStrictnessStub = sinon.stub();
  const manageErrorMessage = Validation.__get__('manageErrorMessage');
  const checkAllowedProperties = Validation.__get__('checkAllowedProperties');
  const index = 'anIndex';
  const collection = 'aCollection';
  const typeChildren = {
    typeName: 'typeChildren',
    allowChildren: true,
    validate: typeValidateStub,
    validateFieldSpecification: () => {},
    getStrictness: () => getStrictnessStub
  };
  const typeNoChild = {
    typeName: 'typeNoChild',
    allowChildren: false,
    validate: typeValidateStub,
    validateFieldSpecification: () => {}
  };

  beforeEach(() => {
    kuzzle = new KuzzleMock();
    validation = new Validation();
    [typeChildren, typeNoChild].forEach(type => validation.addType(type));
    Validation.__set__('manageErrorMessage', manageErrorMessage);
    Validation.__set__('checkAllowedProperties', checkAllowedProperties);
  });

  afterEach(() => {
    typeValidateStub.reset();
    getStrictnessStub.reset();
  });

  describe('#validate', () => {
    it('should return a validation if the specification is empty', () => {
      const
        verbose = false,
        request = new Request({index, collection});

      validation.specification = {
        [index]: {
          [collection]: {
            strict: false,
            fields: {children: {}},
            validators: null
          }
        }
      };

      sinon.stub(validation, 'recurseFieldValidation').returns(true);

      return validation.validate(request, verbose)
        .then(result => {
          should(result).be.deepEqual(request);
          should(validation.recurseFieldValidation.callCount).be.eql(1);
          should(validation.recurseFieldValidation.args[0][0]).be.eql(null);
          should(validation.recurseFieldValidation.args[0][2]).be.false();
          should(validation.recurseFieldValidation.args[0][3]).be.eql([]);
          should(validation.recurseFieldValidation.args[0][4]).be.eql(verbose);
        });
    });

    it('should return a validation if there is no specification', () => {
      const
        verbose = false,
        request = new Request({index, collection});

      validation.specification = {};

      sinon.stub(validation, 'recurseFieldValidation').returns(true);

      return validation.validate(request, verbose)
        .then(result => {
          should(result).be.eql(request);
          should(validation.recurseFieldValidation.callCount).be.eql(0);
        });
    });

    it('should return a validation if the specification is empty', () => {
      const
        verbose = true,
        request = new Request({index, collection});

      validation.specification = {
        [index]: {
          [collection]: {
            strict: false,
            fields: {children: {}},
            validators: null
          }
        }
      };

      sinon.stub(validation, 'recurseFieldValidation').returns(true);

      return validation.validate(request, verbose)
        .then(result => {
          should(result).be.deepEqual({errorMessages: {}, valid: true});
          should(validation.recurseFieldValidation.callCount).be.eql(1);
          should(validation.recurseFieldValidation.args[0][0]).be.null();
          should(validation.recurseFieldValidation.args[0][2]).be.false();
          should(validation.recurseFieldValidation.args[0][3]).be.eql({});
          should(validation.recurseFieldValidation.args[0][4]).be.eql(verbose);
        });
    });

    it('should trigger all validation if specification enables them', () => {
      const filterId = 'someFilter';
      const id = 'anId';
      const verbose = false;
      const documentBody = {};
      const request = new Request({
        index,
        collection,
        _id: id,
        body: documentBody
      });
      const specification = {
        [index]: {
          [collection]: {
            strict: true,
            fields: {children: {aField: 'validation'}},
            validators: filterId
          }
        }
      };

      validation.specification = specification;
      sinon.stub(validation, 'recurseFieldValidation').returns(true);
      sinon.stub(validation.koncorde, 'test').returns([filterId, 'anotherFilter']);

      return validation.validate(request, verbose)
        .then(result => {
          should(result).be.deepEqual(request);
          should(validation.recurseFieldValidation.callCount).be.eql(1);
          should(validation.recurseFieldValidation.args[0][0]).be.deepEqual(documentBody);
          should(validation.recurseFieldValidation.args[0][1]).be.deepEqual(specification[index][collection].fields.children);
          should(validation.recurseFieldValidation.args[0][2]).be.true();
          should(validation.recurseFieldValidation.args[0][3]).be.eql([]);
          should(validation.recurseFieldValidation.args[0][4]).be.eql(verbose);
          should(validation.koncorde.test)
            .calledOnce()
            .calledWithMatch({ ...documentBody, _id: id }, `${index}/${collection}`);
        });
    });

    it('should trigger all validation if specification enables them', () => {
      const
        verbose = false,
        documentBody = {foo: 'barbar'},
        request = new Request({
          index,
          collection,
          body: documentBody
        });

      validation.specification = {
        [index]: {
          [collection]: {
            strict: true,
            fields: {children: {}}
          }
        }
      };

      sinon.stub(validation, 'recurseFieldValidation').returns(true);

      return validation.validate(request, verbose)
        .then((result) => {
          should(result).be.deepEqual(request);
          should(validation.recurseFieldValidation.callCount).be.eql(1);
          should(validation.recurseFieldValidation.args[0][0]).be.deepEqual(documentBody);
          should(validation.recurseFieldValidation.args[0][1]).be.deepEqual({});
          should(validation.recurseFieldValidation.args[0][2]).be.true();
          should(validation.recurseFieldValidation.args[0][3]).be.eql([]);
          should(validation.recurseFieldValidation.args[0][4]).be.eql(verbose);
        });
    });

    it('should throw when field validation fails', () => {
      const
        error = new Error('Mocked error'),
        filterId = 'someFilter',
        verbose = false,
        request = new Request({index, collection});

      validation.specification = {
        [index]: {
          [collection]: {
            strict: true,
            fields: {children: {aField: 'validation'}},
            validators: filterId
          }
        }
      };

      sinon.stub(validation, 'recurseFieldValidation').throws(error);
      Validation.__set__('manageErrorMessage', sinon.spy(function() {
        throw new Error(arguments[2]);
      }));

      return should(validation.validate(request, verbose))
        .be.rejectedWith(error);
    });

    it('should return an invalid status when validator validation fails', () => {
      const
        filterId = 'someFilter',
        verbose = false,
        request = new Request({index, collection});

      validation.specification = {
        [index]: {
          [collection]: {
            strict: true,
            fields: {children: {aField: 'validation'}},
            validators: filterId
          }
        }
      };

      sinon.stub(validation, 'recurseFieldValidation').returns(true);
      Validation.__set__('manageErrorMessage', sinon.spy(function() {
        throw new Error(arguments[2]);
      }));

      return should(validation.validate(request, verbose))
        .be.rejectedWith('The document does not match validation filters.');
    });

    it('should intercept a strictness error and set the message accordingly', () => {
      const
        error = new BadRequestError('strictness'),
        verbose = false,
        request = new Request({index, collection});

      error.details = {field: 'field'};

      validation.specification = {
        [index]: {
          [collection]: {
            strict: true,
            fields: {children: {aField: 'validation'}},
            validators: null
          }
        }
      };

      sinon.stub(validation, 'recurseFieldValidation').throws(error);
      Validation.__set__('manageErrorMessage', sinon.spy(function() {
        throw new Error(arguments[2]);
      }));

      return should(validation.validate(request, verbose))
        .be.rejectedWith('The document validation is strict. Cannot add unspecified sub-field "field"');
    });

    it('should intercept a strictness error and set the message accordingly', () => {
      const
        error = new Error('strictness'),
        recurseFieldValidationStub = sinon.stub(validation, 'recurseFieldValidation').throws(error),
        manageErrorMessageStub = sinon.stub(),
        verbose = true,
        request = new Request({index, collection});

      error.details = {field: 'field'};

      validation.specification = {
        [index]: {
          [collection]: {
            strict: true,
            fields: {children: {aField: 'validation'}},
            validators: null
          }
        }
      };

      Validation.__set__('manageErrorMessage', manageErrorMessageStub);

      return validation.validate(request, verbose)
        .then(result => {
          should(result).be.deepEqual({errorMessages: {}, valid: false});
          should(recurseFieldValidationStub.callCount).be.eql(1);
          should(recurseFieldValidationStub.args[0][0]).be.eql(null);
          should(recurseFieldValidationStub.args[0][1]).be.deepEqual({aField: 'validation'});
          should(recurseFieldValidationStub.args[0][2]).be.true();
          should(recurseFieldValidationStub.args[0][3]).be.eql({});
          should(recurseFieldValidationStub.args[0][4]).be.eql(verbose);
          should(manageErrorMessageStub.callCount).be.eql(1);
          should(manageErrorMessageStub.args[0][2]).be.eql('The document validation is strict. Cannot add unspecified sub-field "field"');
        });
    });

    it('should throw back any other error happening during field validation', () => {
      const
        error = new BadRequestError('foo'),
        verbose = false,
        request = new Request({index, collection});

      validation.specification = {
        [index]: {
          [collection]: {
            strict: true,
            fields: {children: {aField: 'validation'}},
            validators: null
          }
        }
      };

      sinon.stub(validation, 'recurseFieldValidation').throws(error);
      Validation.__set__('manageErrorMessage', sinon.spy(function() {
        throw new Error(arguments[2]);
      }));

      return should(validation.validate(request, verbose))
        .be.rejectedWith(error);
    });

    it('should get the full document from the DB in case of an update', async () => {
      const verbose = false;
      const request = new Request({
        index,
        collection,
        controller: 'document',
        action: 'update',
        _id: 'foo'
      });

      kuzzle.ask.withArgs('core:storage:public:document:get').resolves({
        _id: 'foo',
      });

      validation.specification = {};

      const result = await validation.validate(request, verbose);

      should(result).be.eql(request);
      should(kuzzle.ask).be.calledWith(
        'core:storage:public:document:get',
        index,
        collection,
        'foo');
    });
  });

  describe('#recurseApplyDefault', () => {
    it('should update document with defaults if fields are missing or null', () => {
      const
        isUpdate = false,
        documentSubset = {aField: {anotherSubField: 'some value'}, aDefaultField: null},
        collectionSpecSubset = {
          aField: {
            type: 'typeChildren',
            children: {aSubField: {type: 'typeNoChild', defaultValue: 'another default'}}
          },
          aDefaultField: {
            type: 'typeNoChild',
            defaultValue: 'some default'
          },
          aNormalField: {
            type: 'typeNoChild'
          }
        },
        expectedResult = {
          aField: {
            anotherSubField: 'some value',
            aSubField: 'another default'
          },
          aDefaultField: 'some default'
        };

      should(validation.recurseApplyDefault(isUpdate, documentSubset, collectionSpecSubset))
        .deepEqual(expectedResult);
    });

    it('should update document with defaults only if fields are null in write/update mode', () => {
      const
        isUpdate = true,
        documentSubset = {aField: {anotherSubField: 'some value', aSubField: null}},
        collectionSpecSubset = {
          aField: {
            type: 'typeChildren',
            children: {aSubField: {type: 'typeNoChild', defaultValue: 'another default'}}
          },
          aDefaultField: {type: 'typeNoChild', defaultValue: 'some default'},
          aNormalField: {type: 'typeNoChild'}
        },
        expectedResult = {
          aField: {anotherSubField: 'some value', aSubField: 'another default'}
        };

      should(validation.recurseApplyDefault(isUpdate, documentSubset, collectionSpecSubset))
        .deepEqual(expectedResult);
    });

    it('should update document with defined defaults in multivalued fields', () => {
      const
        isUpdate = true,
        documentSubset = {
          aField: [
            {anotherSubField: 'some value', aSubField: null},
            {anotherSubField: 'some other value', aSubField: null}
          ]
        },
        collectionSpecSubset = {
          aField: {
            type: 'typeChildren',
            multivalues: {value: true},
            children: {aSubField: {type: 'typeNoChild', defaultValue: 'another default'}}
          },
          aDefaultField: {type: 'typeNoChild', defaultValue: 'some default'},
          aNormalField: {type: 'typeNoChild'}
        },
        expectedResult = {
          aField: [
            {anotherSubField: 'some value', aSubField: 'another default'},
            {anotherSubField: 'some other value', aSubField: 'another default'}
          ]
        };

      should(validation.recurseApplyDefault(isUpdate, documentSubset, collectionSpecSubset))
        .deepEqual(expectedResult);
    });
  });

  describe('#recurseFieldValidation', () => {
    it('should throw an error if validation is strict and a property is not allowed', () => {
      should(
        () => validation.recurseFieldValidation(
          { anotherField: 'some value' },
          { aField: { some: 'specification' } },
          true,
          [],
          false))
        .throw('strictness');
    });

    it('should throw an exception if isValidField throws an exception', () => {
      sinon.stub(validation, 'isValidField').throws({message: 'an error'});

      should(() => validation.recurseFieldValidation({
        anotherField: 'some value',
        aField: 'some value'
      }, {
        aField: {some: 'specification'},
        anotherField: {some: 'other specification'},
      }, false, [], false)).throw('an error');

      should(validation.isValidField.callCount).be.eql(1);
    });

    it('should return true if every fields are valid in verbose mode', () => {
      sinon.stub(validation, 'isValidField').returns(true);

      should(validation.recurseFieldValidation({
        anotherField: 'some value',
        aField: 'some value'
      }, {
        aField: {some: 'specification'},
        anotherField: {some: 'other specification'},
      }, false, [], true)).be.true();

      should(validation.isValidField.callCount).be.eql(2);
    });

    it('should return true if every fields are valid in none verbose mode', () => {
      sinon.stub(validation, 'isValidField').returns(true);
      should(validation.recurseFieldValidation({
        anotherField: 'some value',
        aField: 'some value'
      }, {
        aField: {some: 'specification'},
        anotherField: {some: 'other specification'},
      }, true, [], false)).be.true();

      should(validation.isValidField.callCount).be.eql(2);
    });

    it('should return false if a field is not valid in verbose mode', () => {
      sinon.stub(validation, 'isValidField').returns(false);

      should(
        validation.recurseFieldValidation(
          { anotherField: 'some value', aField: 'some value' },
          {
            aField: {some: 'specification'},
            anotherField: {some: 'other specification'},
          },
          false,
          [],
          true))
        .be.false();

      should(validation.isValidField.callCount).be.eql(2);
    });

    it('should return false if a field is not valid in none verbose mode', () => {
      sinon.stub(validation, 'isValidField').returns(false);

      should(validation.recurseFieldValidation({
        anotherField: 'some value',
        aField: 'some value'
      }, {
        aField: {some: 'specification'},
        anotherField: {some: 'other specification'},
      }, true, [], false)).be.false();

      should(validation.isValidField.callCount).be.eql(1);
    });
  });

  describe('#isValidField', () => {
    it('should return true if the field is correct', () => {
      const
        documentSubset = {
          aField: 'some value'
        },
        collectionSubset = {
          aField: {
            type: 'typeNoChild',
            multivalued: {
              value: false
            }
          }
        };

      typeValidateStub.returns(true);

      should(validation.isValidField('aField', documentSubset, collectionSubset, true, [], false)).be.true();
    });

    it('should return true if the field is correct as multivalued', () => {
      const
        documentSubset = {
          aField: ['some value', 'some other value']
        },
        collectionSubset = {
          aField: {
            type: 'typeNoChild',
            multivalued: {
              value: true
            }
          }
        };

      typeValidateStub.returns(true);

      should(validation.isValidField('aField', documentSubset, collectionSubset, true, [], false)).be.true();
    });

    it('should throw an exception if validation of the field returns false in non verbose', () => {
      const
        errorMessages = [],
        documentSubset = {
          aField: 'some value',
        },
        collectionSubset = {
          aField: {
            path: ['aField'],
            type: 'typeNoChild',
            multivalued: {
              value: false
            }
          }
        };

      typeValidateStub.returns(false);

      should(() => validation.isValidField('aField', documentSubset, collectionSubset, true, errorMessages, false))
        .throw(BadRequestError, { id: 'validation.check.failed_field' });
    });

    it('should returns false in verbose mode', () => {
      const
        errorMessages = {},
        documentSubset = {
          aField: 'some value',
        },
        collectionSubset = {
          aField: {
            path: ['aField'],
            type: 'typeNoChild',
            multivalued: {
              value: false
            }
          }
        };

      typeValidateStub.returns(false);

      should(validation.isValidField('aField', documentSubset, collectionSubset, true, errorMessages, true)).be.false();
      should(errorMessages).be.deepEqual({fieldScope: {children: {aField: {messages: ['An error has occurred during validation.']}}}});
    });

    it('should return true if the field is correct as multivalued', () => {
      const
        documentSubset = {
          aField: ['some value', 'some other value']
        },
        collectionSubset = {
          aField: {
            type: 'typeNoChild',
            multivalued: {
              value: true,
              minCount: 2
            }
          }
        };

      typeValidateStub.returns(true);

      should(validation.isValidField('aField', documentSubset, collectionSubset, true, [], false)).be.true();
    });

    it('should return false if the field is not an array and it should be multivalued', () => {
      const
        errorMessages = {},
        documentSubset = {
          aField: 'some other value'
        },
        collectionSubset = {
          aField: {
            path: ['aField'],
            type: 'typeNoChild',
            multivalued: {
              value: true
            }
          }
        };

      typeValidateStub.returns(true);

      should(validation.isValidField('aField', documentSubset, collectionSubset, true, errorMessages, true)).be.false();
      should(errorMessages).be.deepEqual({fieldScope: {children: {aField: {messages: ['The field must be multivalued, unary value provided.']}}}});
    });

    it('should return false if the field has not enough elements', () => {
      const
        errorMessages = {},
        documentSubset = {
          aField: ['some value']
        },
        collectionSubset = {
          aField: {
            path: ['aField'],
            type: 'typeNoChild',
            multivalued: {
              value: true,
              minCount: 2
            }
          }
        };

      typeValidateStub.returns(true);

      should(validation.isValidField('aField', documentSubset, collectionSubset, true, errorMessages, true)).be.false();
      should(errorMessages).be.deepEqual({fieldScope: {children: {aField: {messages: ['Not enough elements. Minimum count is set to 2.']}}}});
    });

    it('should return false if the field has too much elements', () => {
      const
        errorMessages = {},
        documentSubset = {
          aField: ['some value', 'some other value', 'and yet another']
        },
        collectionSubset = {
          aField: {
            path: ['aField'],
            type: 'typeNoChild',
            multivalued: {
              value: true,
              maxCount: 2
            }
          }
        };

      typeValidateStub.returns(true);

      should(validation.isValidField('aField', documentSubset, collectionSubset, true, errorMessages, true)).be.false();
      should(errorMessages).be.deepEqual({fieldScope: {children: {aField: {messages: ['Too many elements. Maximum count is set to 2.']}}}});
    });

    it('should return false if the field provides an array but is not multivalued', () => {
      const
        errorMessages = {},
        documentSubset = {
          aField: ['some value', 'some other value', 'and yet another']
        },
        collectionSubset = {
          aField: {
            path: ['aField'],
            type: 'typeNoChild',
            multivalued: {
              value: false
            }
          }
        };

      typeValidateStub.returns(true);

      should(validation.isValidField('aField', documentSubset, collectionSubset, true, errorMessages, true)).be.false();
      should(errorMessages).be.deepEqual({fieldScope: {children: {aField: {messages: ['The field is not a multivalued field; Multiple values provided.']}}}});
    });

    it('should return false if the field is mandatory but not provided', () => {
      const
        errorMessages = {},
        documentSubset = {
          aField: ['some value', 'some other value', 'and yet another']
        },
        collectionSubset = {
          anotherField: {
            path: ['anotherField'],
            type: 'typeNoChild',
            mandatory: true
          }
        };

      typeValidateStub.returns(true);

      should(validation.isValidField('anotherField', documentSubset, collectionSubset, true, errorMessages, true)).be.false();
      should(errorMessages).be.deepEqual({fieldScope: {children: {anotherField: {messages: ['The field is mandatory.']}}}});
    });

    it('should return false if one of the subfields is not valid in verbose mode', () => {
      const
        errorMessages = {},
        documentSubset = {
          aField: {
            aSubField: 'bad value'
          }
        },
        collectionSubset = {
          aField: {
            path: ['aField'],
            type: 'typeChildren',
            multivalued: {
              value: false
            },
            children: {
              aSubField: {
                path: ['aField', 'aSubField'],
                type: 'typeNoChild',
                multivalued: {
                  value: false
                }
              }
            }
          }
        };

      getStrictnessStub.returns(true);

      typeValidateStub
        .onFirstCall().returns(true)
        .onSecondCall().returns(false);

      should(validation.isValidField('aField', documentSubset, collectionSubset, true, errorMessages, true)).be.false();
      should(errorMessages).be.deepEqual({fieldScope: {children: {aField: {children: {aSubField: {messages: ['An error has occurred during validation.']}}}}}});
    });

    it('should throw an error if one of the subfields is not valid in non verbose mode', () => {
      const
        errorMessages = [],
        documentSubset = {
          aField: {
            aSubField: 'bad value'
          }
        },
        collectionSubset = {
          aField: {
            path: ['aField'],
            type: 'typeChildren',
            multivalued: {
              value: false
            },
            children: {
              aSubField: {
                path: ['aField', 'aSubField'],
                type: 'typeNoChild',
                multivalued: {
                  value: false
                }
              }
            }
          }
        };

      getStrictnessStub.returns(true);

      typeValidateStub
        .onFirstCall().returns(true)
        .onSecondCall().returns(false);

      should(() => {
        validation.isValidField('aField', documentSubset, collectionSubset, true, errorMessages, false);
      }).throw(BadRequestError, { id: 'validation.check.failed_field' });
    });

    it('should return false if one of the subfields throws an error in verbose mode', () => {
      const
        errorMessages = {},
        documentSubset = {
          aField: {
            aSubField: 'bad value'
          }
        },
        collectionSubset = {
          aField: {
            path: ['aField'],
            type: 'typeChildren',
            multivalued: {
              value: false
            },
            children: {
              aSubField: {
                path: ['aField', 'aSubField'],
                type: 'typeNoChild',
                multivalued: {
                  value: false
                }
              }
            }
          }
        };

      getStrictnessStub.returns(true);

      typeValidateStub
        .onFirstCall().returns(true)
        .onSecondCall().throws({message: 'an error'});

      should(validation.isValidField('aField', documentSubset, collectionSubset, true, errorMessages, true)).be.false();
      should(errorMessages).be.deepEqual({fieldScope: {children: {aField: {messages: ['an error']}}}});
    });

    it('should return false if one of the subfields throws an strictness error in verbose mode', () => {
      const
        errorMessages = {},
        documentSubset = {
          aField: {
            aSubField: 'bad value'
          }
        },
        collectionSubset = {
          aField: {
            path: ['aField'],
            type: 'typeChildren',
            multivalued: {
              value: false
            },
            children: {
              aSubField: {
                path: ['aField', 'aSubField'],
                type: 'typeNoChild',
                multivalued: {
                  value: false
                }
              }
            }
          }
        };

      getStrictnessStub.returns(true);

      typeValidateStub
        .onFirstCall().returns(true)
        .onSecondCall().throws({message: 'strictness', details: {field: 'field'}});

      should(validation.isValidField('aField', documentSubset, collectionSubset, true, errorMessages, true)).be.false();
      should(errorMessages).be.deepEqual({fieldScope: {children: {aField: {messages: ['The field is set to "strict"; cannot add unspecified sub-field "field".']}}}});
    });
  });
});
