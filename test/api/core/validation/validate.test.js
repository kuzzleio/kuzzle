var
  should = require('should'),
  sinon = require('sinon'),
  rewire = require('rewire'),
  BadRequestError = require('kuzzle-common-objects').errors.BadRequestError,
  Validation = rewire('../../../../lib/api/core/validation'),
  KuzzleMock = require('../../../mocks/kuzzle.mock'),
  Request = require('kuzzle-common-objects').Request;

describe('Test: validation.validate', () => {
  var
    validation,
    sandbox = sinon.sandbox.create(),
    manageErrorMessage = Validation.__get__('manageErrorMessage'),
    checkAllowedProperties = Validation.__get__('checkAllowedProperties'),
    kuzzle,
    indexName = 'anIndex',
    collectionName = 'aCollection',
    typeValidateStub = sandbox.stub(),
    getStrictnessStub = sandbox.stub(),
    typeChildren = {
      typeName: 'typeChildren',
      allowChildren: true,
      validate: typeValidateStub,
      validateFieldSpecification: () => {},
      getStrictness: () => getStrictnessStub
    },
    typeNoChild = {
      typeName: 'typeNoChild',
      allowChildren: false,
      validate: typeValidateStub,
      validateFieldSpecification: () => {}
    };

  beforeEach(() => {
    kuzzle = new KuzzleMock();
    validation = new Validation(kuzzle);
    [typeChildren, typeNoChild].forEach(type => validation.addType(type));
    sandbox.resetHistory();
    Validation.__set__('manageErrorMessage', manageErrorMessage);
    Validation.__set__('checkAllowedProperties', checkAllowedProperties);
  });

  describe('#validationPromise', () => {
    it('should return a validation if the specification is empty', () => {
      var
        recurseFieldValidationStub = sandbox.stub().returns(true),
        controllerName = 'aController',
        actionName = 'anAction',
        id = null,
        verbose = false,
        documentBody = {},
        request = new Request({
          index: indexName,
          collection: collectionName,
          controller: controllerName,
          action: actionName,
          _id: id,
          body: documentBody
        });

      validation.specification = {
        [indexName]: {
          [collectionName]: {
            strict: false,
            fields: {children: {}},
            validators: null
          }
        }
      };

      validation.recurseFieldValidation = recurseFieldValidationStub;

      return validation.validationPromise(request, verbose)
        .then((result) => {
          should(result).be.deepEqual(request);
          should(recurseFieldValidationStub.callCount).be.eql(1);
          should(recurseFieldValidationStub.args[0][0]).be.eql(documentBody);
          should(typeof recurseFieldValidationStub.args[0][1]).be.eql('object');
          should(recurseFieldValidationStub.args[0][2]).be.false();
          should(recurseFieldValidationStub.args[0][3]).be.eql([]);
          should(recurseFieldValidationStub.args[0][4]).be.eql(verbose);
        });
    });
    it('should return a validation if there is no specification', () => {
      var
        recurseFieldValidationStub = sandbox.stub().returns(true),
        controllerName = 'aController',
        actionName = 'anAction',
        id = null,
        verbose = false,
        documentBody = {},
        request = new Request({
          index: indexName,
          collection: collectionName,
          controller: controllerName,
          action: actionName,
          _id: id,
          body: documentBody
        });

      validation.specification = {};

      validation.recurseFieldValidation = recurseFieldValidationStub;

      return validation.validationPromise(request, verbose)
        .then((result) => {
          should(result).be.deepEqual(request);
          should(recurseFieldValidationStub.callCount).be.eql(0);
        });
    });

    it('should return a validation if the specification is empty', () => {
      var
        recurseFieldValidationStub = sandbox.stub().returns(true),
        controllerName = 'aController',
        actionName = 'anAction',
        id = null,
        verbose = true,
        documentBody = {},
        request = new Request({
          index: indexName,
          collection: collectionName,
          controller: controllerName,
          action: actionName,
          _id: id,
          body: documentBody
        });

      validation.specification = {
        [indexName]: {
          [collectionName]: {
            strict: false,
            fields: {children: {}},
            validators: null
          }
        }
      };

      validation.recurseFieldValidation = recurseFieldValidationStub;

      return validation.validationPromise(request, verbose)
        .then((result) => {
          should(result).be.deepEqual({errorMessages: {}, valid: true});
          should(recurseFieldValidationStub.callCount).be.eql(1);
          should(recurseFieldValidationStub.args[0][0]).be.eql(documentBody);
          should(typeof recurseFieldValidationStub.args[0][1]).be.eql('object');
          should(recurseFieldValidationStub.args[0][2]).be.false();
          should(recurseFieldValidationStub.args[0][3]).be.eql({});
          should(recurseFieldValidationStub.args[0][4]).be.eql(verbose);
        });
    });

    it('should trigger all validation if specification enables them', () => {
      const
        recurseFieldValidationStub = sandbox.stub().returns(true),
        controllerName = 'aController',
        actionName = 'anAction',
        filterId = 'someFilter',
        testStub = sandbox.stub().returns([filterId, 'anotherFilter']),
        koncorde = {test: testStub},
        id = 'anId',
        verbose = false,
        documentBody = {},
        request = new Request({
          index: indexName,
          collection: collectionName,
          controller: controllerName,
          action: actionName,
          _id: id,
          body: documentBody
        }),
        specification = {
          [indexName]: {
            [collectionName]: {
              strict: true,
              fields: {children: {aField: 'validation'}},
              validators: filterId
            }
          }
        };

      validation.specification = specification;
      validation.recurseFieldValidation = recurseFieldValidationStub;
      validation.koncorde = koncorde;

      return validation.validationPromise(request, verbose)
        .then((result) => {
          should(result).be.deepEqual(request);
          should(recurseFieldValidationStub.callCount).be.eql(1);
          should(recurseFieldValidationStub.args[0][0]).be.deepEqual(documentBody);
          should(recurseFieldValidationStub.args[0][1]).be.deepEqual(specification[indexName][collectionName].fields.children);
          should(recurseFieldValidationStub.args[0][2]).be.true();
          should(recurseFieldValidationStub.args[0][3]).be.eql([]);
          should(recurseFieldValidationStub.args[0][4]).be.eql(verbose);
          should(testStub.callCount).be.eql(1);
          should(testStub.args[0][0]).be.deepEqual(indexName);
          should(testStub.args[0][1]).be.deepEqual(collectionName);
          should(testStub.args[0][2]).be.deepEqual(documentBody);
          should(testStub.args[0][3]).be.deepEqual(id);
        });
    });

    it('should trigger all validation if specification enables them', () => {
      const
        recurseFieldValidationStub = sandbox.stub().returns(true),
        controllerName = 'write',
        actionName = 'update',
        filterId = 'someFilter',
        testStub = sandbox.stub().returns(Promise.resolve([filterId, 'anotherFilter'])),
        koncorde = {test: testStub},
        id = 'anId',
        verbose = false,
        documentBody = {foo: 'barbar'},
        request = new Request({
          index: indexName,
          collection: collectionName,
          controller: controllerName,
          action: actionName,
          _id: id,
          body: documentBody
        });

      validation.specification = {
        [indexName]: {
          [collectionName]: {
            strict: true,
            fields: {children: {}}
          }
        }
      };

      validation.recurseFieldValidation = recurseFieldValidationStub;
      validation.koncorde = koncorde;

      return validation.validationPromise(request, verbose)
        .then((result) => {
          should(result).be.deepEqual(request);
          should(recurseFieldValidationStub.callCount).be.eql(1);
          should(recurseFieldValidationStub.args[0][0]).be.deepEqual(documentBody);
          should(recurseFieldValidationStub.args[0][1]).be.deepEqual({});
          should(recurseFieldValidationStub.args[0][2]).be.true();
          should(recurseFieldValidationStub.args[0][3]).be.eql([]);
          should(recurseFieldValidationStub.args[0][4]).be.eql(verbose);
        });
    });

    it('should throw when field validation fails', () => {
      const
        error = new Error('Mocked error'),
        controllerName = 'aController',
        actionName = 'anAction',
        filterId = 'someFilter',
        testStub = sandbox.stub().returns(Promise.resolve([filterId, 'anotherFilter'])),
        koncorde = {
          test: testStub
        },
        id = 'anId',
        verbose = false,
        documentBody = {},
        request = new Request({
          index: indexName,
          collection: collectionName,
          controller: controllerName,
          action: actionName,
          _id: id,
          body: documentBody
        });

      validation.specification = {
        [indexName]: {
          [collectionName]: {
            strict: true,
            fields: {children: {aField: 'validation'}},
            validators: filterId
          }
        }
      };
      sandbox.stub(validation, 'recurseFieldValidation').throws(error);
      validation.koncorde = koncorde;
      Validation.__set__('manageErrorMessage', sandbox.spy(function() {throw new Error(arguments[2]);}));

      return should(validation.validationPromise(request, verbose))
        .be.rejectedWith(error);
    });

    it('should return an unvalid status when validator validation fails', () => {
      const
        recurseFieldValidationStub = sandbox.stub().returns(true),
        controllerName = 'aController',
        actionName = 'anAction',
        filterId = 'someFilter',
        testStub = sandbox.stub().returns(Promise.resolve(['anotherFilter'])),
        koncorde = {
          test: testStub
        },
        id = 'anId',
        verbose = false,
        documentBody = {},
        request = new Request({
          index: indexName,
          collection: collectionName,
          controller: controllerName,
          action: actionName,
          _id: id,
          body: documentBody
        });

      validation.specification = {
        [indexName]: {
          [collectionName]: {
            strict: true,
            fields: {children: {aField: 'validation'}},
            validators: filterId
          }
        }
      };
      validation.recurseFieldValidation = recurseFieldValidationStub;
      validation.koncorde = koncorde;
      Validation.__set__('manageErrorMessage', sandbox.spy(function() {throw new Error(arguments[2]);}));

      return should(validation.validationPromise(request, verbose))
        .be.rejectedWith('The document does not match validation filters.');
    });

    it('should intercept a strictness error and set the message accordingly', () => {
      var
        error = new BadRequestError('strictness'),
        controllerName = 'aController',
        actionName = 'anAction',
        id = null,
        verbose = false,
        documentBody = {},
        request = new Request({
          index: indexName,
          collection: collectionName,
          controller: controllerName,
          action: actionName,
          _id: id,
          body: documentBody
        });

      validation.specification = {
        [indexName]: {
          [collectionName]: {
            strict: true,
            fields: {children: {aField: 'validation'}},
            validators: null
          }
        }
      };

      sandbox.stub(validation, 'recurseFieldValidation').throws(error);
      Validation.__set__('manageErrorMessage', sandbox.spy(function() {throw new Error(arguments[2]);}));

      return should(validation.validationPromise(request, verbose))
        .be.rejectedWith('The document validation is strict; it can not add unspecified sub-fields.');
    });

    it('should intercept a strictness error and set the message accordingly', () => {
      var
        error = new Error('strictness'),
        recurseFieldValidationStub = sandbox.stub(validation, 'recurseFieldValidation').throws(error),
        manageErrorMessageStub = sandbox.stub(),
        controllerName = 'aController',
        actionName = 'anAction',
        id = null,
        verbose = true,
        documentBody = {},
        request = new Request({
          index: indexName,
          collection: collectionName,
          controller: controllerName,
          action: actionName,
          _id: id,
          body: documentBody
        });

      validation.specification = {
        [indexName]: {
          [collectionName]: {
            strict: true,
            fields: {children: {aField: 'validation'}},
            validators: null
          }
        }
      };

      Validation.__set__('manageErrorMessage', manageErrorMessageStub);

      return validation.validationPromise(request, verbose)
        .then((result) => {

          try {
            should(result).be.deepEqual({errorMessages: {}, valid: false});
            should(recurseFieldValidationStub.callCount).be.eql(1);
            should(recurseFieldValidationStub.args[0][0]).be.eql(documentBody);
            should(recurseFieldValidationStub.args[0][1]).be.deepEqual({aField: 'validation'});
            should(recurseFieldValidationStub.args[0][2]).be.true();
            should(recurseFieldValidationStub.args[0][3]).be.eql({});
            should(recurseFieldValidationStub.args[0][4]).be.eql(verbose);
            should(manageErrorMessageStub.callCount).be.eql(1);
            should(manageErrorMessageStub.args[0][2]).be.eql('The document validation is strict; it can not add unspecified sub-fields.');

            return Promise.resolve();
          }
          catch (err) {
            return Promise.reject(err);
          }
        });
    });

    it('should throw back any other error happening during field validation', () => {
      var
        error = new BadRequestError('not_strictness'),
        controllerName = 'aController',
        actionName = 'anAction',
        id = null,
        verbose = false,
        documentBody = {},
        request = new Request({
          index: indexName,
          collection: collectionName,
          controller: controllerName,
          action: actionName,
          data: {_id: id, body: documentBody}
        });

      validation.specification = {
        [indexName]: {
          [collectionName]: {
            strict: true,
            fields: {children: {aField: 'validation'}},
            validators: null
          }
        }
      };
      sandbox.stub(validation, 'recurseFieldValidation').throws(error);
      Validation.__set__('manageErrorMessage', sandbox.spy(function() {throw new Error(arguments[2]);}));

      return should(validation.validationPromise(request, verbose))
        .be.rejectedWith(error);
    });
  });

  describe('#recurseApplyDefault', () => {
    it('should update document with defaults if fields are missing or null', () => {
      var
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

      should(validation.recurseApplyDefault(isUpdate, documentSubset, collectionSpecSubset)).deepEqual(expectedResult);
    });

    it('should update document with defaults only if fields are null in write/update mode', () => {
      var
        isUpdate = true,
        documentSubset = {aField: {anotherSubField: 'some value',aSubField: null}},
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

      should(validation.recurseApplyDefault(isUpdate, documentSubset, collectionSpecSubset)).deepEqual(expectedResult);
    });

    it('should update document with defined defaults in multivalued fields', () => {
      var
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

      should(validation.recurseApplyDefault(isUpdate, documentSubset, collectionSpecSubset)).deepEqual(expectedResult);
    });
  });

  describe('#recurseFieldValidation', () => {
    it('should throw an error if validation is strict and a property is not allowed', () => {
      try {
        validation.recurseFieldValidation({anotherField: 'some value'}, {aField: {some: 'specification'}}, true, [], false);
      }
      catch (error) {
        should(error).be.an.instanceOf(BadRequestError);
        should(error.message).be.exactly('strictness');
      }
    });

    it('should throw an exception if isValidField throws an exception', () => {
      var isValidFieldStub = sandbox.stub().throws({message: 'an error'});

      validation.isValidField = isValidFieldStub;
      try {
        validation.recurseFieldValidation({
          anotherField: 'some value',
          aField: 'some value'
        }, {
          aField: {some: 'specification'},
          anotherField: {some: 'other specification'},
        }, false, [], false);
      }
      catch (error) {
        should(isValidFieldStub.callCount).be.eql(1);
        should(error).be.deepEqual({message: 'an error'});
      }
    });

    it('should return true if every fields are valid in verbose mode', () => {
      var isValidFieldStub = sandbox.stub().returns(true);

      validation.isValidField = isValidFieldStub;
      should(validation.recurseFieldValidation({
        anotherField: 'some value',
        aField: 'some value'
      }, {
        aField: {some: 'specification'},
        anotherField: {some: 'other specification'},
      }, false, [], true)).be.true();
      should(isValidFieldStub.callCount).be.eql(2);
    });

    it('should return true if every fields are valid in none verbose mode', () => {
      var isValidFieldStub = sandbox.stub().returns(true);

      validation.isValidField = isValidFieldStub;
      should(validation.recurseFieldValidation({
        anotherField: 'some value',
        aField: 'some value'
      }, {
        aField: {some: 'specification'},
        anotherField: {some: 'other specification'},
      }, true, [], false)).be.true();
      should(isValidFieldStub.callCount).be.eql(2);
    });

    it('should return false if a field is not valid in verbose mode', () => {
      var isValidFieldStub = sandbox.stub().returns(false);

      validation.isValidField = isValidFieldStub;
      should(validation.recurseFieldValidation({
        anotherField: 'some value',
        aField: 'some value'
      }, {
        aField: {some: 'specification'},
        anotherField: {some: 'other specification'},
      }, false, [], true)).be.false();
      should(isValidFieldStub.callCount).be.eql(2);
    });

    it('should return false if a field is not valid in none verbose mode', () => {
      var isValidFieldStub = sandbox.stub().returns(false);

      validation.isValidField = isValidFieldStub;
      should(validation.recurseFieldValidation({
        anotherField: 'some value',
        aField: 'some value'
      }, {
        aField: {some: 'specification'},
        anotherField: {some: 'other specification'},
      }, true, [], false)).be.false();
      should(isValidFieldStub.callCount).be.eql(1);
    });
  });

  describe('#isValidField', () => {
    it('should return true if the field is correct', () => {
      var
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
      var
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
      var
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

      try {
        validation.isValidField('aField', documentSubset, collectionSubset, true, errorMessages, false);
      }
      catch (error) {
        should(error.message).be.eql('Field aField: An error has occurred during validation.');
      }
    });

    it('should returns false in verbose mode', () => {
      var
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
      var
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
      var
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
      var
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
      var
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
      var
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
      var
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
      var
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
      var
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
      }).throw('Field aField.aSubField: An error has occurred during validation.');
    });

    it('should return false if one of the subfields throws an error in verbose mode', () => {
      var
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
      var
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
        .onSecondCall().throws({message: 'strictness'});

      should(validation.isValidField('aField', documentSubset, collectionSubset, true, errorMessages, true)).be.false();
      should(errorMessages).be.deepEqual({fieldScope: {children: {aField: {messages: ['The field is set to "strict"; cannot add unspecified subField.']}}}});
    });
  });
});
