var
  should = require('should'),
  sinon = require('sinon'),
  rewire = require('rewire'),
  Validation = rewire('../../../../lib/api/core/validation'),
  KuzzleMock = require('../../../mocks/kuzzle.mock');

describe.only('Test: validation.validate', () => {
  var
    validation,
    sandbox = sinon.sandbox.create(),
    manageErrorMessage = Validation.__get__('manageErrorMessage'),
    checkAllowedProperties = Validation.__get__('checkAllowedProperties'),
    kuzzle,
    indexName = 'anIndex',
    collectionName = 'aCollection';

  beforeEach(() => {
    kuzzle = new KuzzleMock();
    validation = new Validation(kuzzle);
    sandbox.reset();
    Validation.__set__('manageErrorMessage', manageErrorMessage);
    Validation.__set__('checkAllowedProperties', checkAllowedProperties);
  });

  describe('#validate', () => {
    it('should return the modified requestObject if everything is valid and use _id if action is an update', () => {
      var
        validationPromiseStub = sandbox.spy(function () {
          return Promise.resolve({
            validation: true,
            errorMessages: []
          });
        }),
        controllerName = 'write',
        actionName = 'update',
        id = 'anId',
        requestObject = {
          index: indexName,
          collection: collectionName,
          controller: controllerName,
          action: actionName,
          data: {
            _id: id,
            body: {
              some: 'content'
            }
          }
        };

      validation.validationPromise = validationPromiseStub;

      return validation.validate(requestObject)
        .then(result => {
          should(result).be.deepEqual({
            validation: true,
            errorMessages: []
          });
          should(validationPromiseStub.callCount).be.eql(1);
          should(validationPromiseStub.args[0][0]).be.deepEqual(requestObject);
          should(validationPromiseStub.args[0][1]).be.false();
        });
    });

    it('should return the modified requestObject if everything is valid', () => {
      var
        validationPromiseStub = sandbox.spy(function () {
          return Promise.resolve({
            validation: true,
            errorMessages: []
          });
        }),
        controllerName = 'aController',
        actionName = 'anAction',
        requestObject = {
          index: indexName,
          collection: collectionName,
          controller: controllerName,
          action: actionName,
          data: {
            body: {
              some: 'content'
            }
          }
        };

      validation.validationPromise = validationPromiseStub;

      return validation.validate(requestObject)
        .then(result => {
          should(result).be.deepEqual({
            validation: true,
            errorMessages: []
          });
          should(validationPromiseStub.callCount).be.eql(1);
          should(validationPromiseStub.args[0][0]).be.deepEqual(requestObject);
          should(validationPromiseStub.args[0][1]).be.false();
        });
    });

    it('should throw an error if the validation returns false', () => {
      var
        controllerName = 'aController',
        actionName = 'anAction',
        requestObject = {
          index: indexName,
          collection: collectionName,
          controller: controllerName,
          action: actionName,
          data: {
            body: {
              some: 'content'
            }
          }
        };

      validation.validationPromise = sandbox.spy(function () {
        return Promise.reject({message: 'anError'});
      });

      return validation.validate(requestObject)
        .should.rejectedWith('anError');
    });

    it('should throw an error if the requestObject has no data property', () => {
      var
        controllerName = 'aController',
        actionName = 'anAction',
        requestObject = {
          index: indexName,
          collection: collectionName,
          controller: controllerName,
          action: actionName
        };

      (() => {
        validation.validate(requestObject);
      }).should.throw('The request object must provide data');
    });

    it('should throw an error if the data has no body property', () => {
      var
        controllerName = 'aController',
        actionName = 'anAction',
        requestObject = {
          index: indexName,
          collection: collectionName,
          controller: controllerName,
          action: actionName,
          data: {}
        };

      (() => {
        validation.validate(requestObject);
      }).should.throw('The request object must provide a document body');
    });

    it('should throw an error if request is an update and _id is not provided', () => {
      var
        controllerName = 'write',
        actionName = 'update',
        requestObject = {
          index: indexName,
          collection: collectionName,
          controller: controllerName,
          action: actionName,
          data: {
            body: {
              some: 'content'
            }
          }
        };

      (() => {
        validation.validate(requestObject);
      }).should.throw('Update request must provide an _id.');
    });
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
        requestObject = {
          index: indexName,
          collection: collectionName,
          controller: controllerName,
          action: actionName,
          data: {
            _id: id,
            body: documentBody
          }
        };

      validation.specification = {
        [indexName]: {
          [collectionName]: {
            strict: false,
            fields: {},
            validators: null
          }
        }
      };

      validation.recurseFieldValidation = recurseFieldValidationStub;

      return validation.validationPromise(requestObject, verbose)
        .then((result) => {
          should(result).be.deepEqual(requestObject);
          should(recurseFieldValidationStub.callCount).be.eql(1);
          should(recurseFieldValidationStub.args[0][0]).be.eql(documentBody);
          should(recurseFieldValidationStub.args[0][1]).be.eql(null);
          should(typeof recurseFieldValidationStub.args[0][2]).be.eql('undefined');
          should(recurseFieldValidationStub.args[0][3]).be.false();
          should(recurseFieldValidationStub.args[0][4]).be.eql([]);
          should(recurseFieldValidationStub.args[0][5]).be.eql(verbose);
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
        requestObject = {
          index: indexName,
          collection: collectionName,
          controller: controllerName,
          action: actionName,
          data: {
            _id: id,
            body: documentBody
          }
        };

      validation.specification = {};

      validation.recurseFieldValidation = recurseFieldValidationStub;

      return validation.validationPromise(requestObject, verbose)
        .then((result) => {
          should(result).be.deepEqual(requestObject);
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
        requestObject = {
          index: indexName,
          collection: collectionName,
          controller: controllerName,
          action: actionName,
          data: {
            _id: id,
            body: documentBody
          }
        };

      validation.specification = {
        [indexName]: {
          [collectionName]: {
            strict: false,
            fields: {},
            validators: null
          }
        }
      };

      validation.recurseFieldValidation = recurseFieldValidationStub;

      return validation.validationPromise(requestObject, verbose)
        .then((result) => {
          should(result).be.deepEqual({
            errorMessages: {},
            validation: true
          });
          should(recurseFieldValidationStub.callCount).be.eql(1);
          should(recurseFieldValidationStub.args[0][0]).be.eql(documentBody);
          should(recurseFieldValidationStub.args[0][1]).be.eql(null);
          should(typeof recurseFieldValidationStub.args[0][2]).be.eql('undefined');
          should(recurseFieldValidationStub.args[0][3]).be.false();
          should(recurseFieldValidationStub.args[0][4]).be.eql({});
          should(recurseFieldValidationStub.args[0][5]).be.eql(verbose);
        });
    });

    it('should trigger all validation if specification enables them', () => {
      var
        recurseFieldValidationStub = sandbox.stub().returns(true),
        controllerName = 'aController',
        actionName = 'anAction',
        filterId = 'someFilter',
        testStub = sandbox.stub().resolves([filterId, 'anotherFilter']),
        dsl = {
          test: testStub
        },
        id = 'anId',
        verbose = false,
        documentBody = {},
        requestObject = {
          index: indexName,
          collection: collectionName,
          controller: controllerName,
          action: actionName,
          data: {
            _id: id,
            body: documentBody
          }
        },
        specification = {
          [indexName]: {
            [collectionName]: {
              strict: true,
              fields: {
                children: {
                  aField: 'validation'
                }
              },
              validators: filterId
            }
          }
        };

      validation.specification = specification;
      validation.recurseFieldValidation = recurseFieldValidationStub;
      validation.dsl = dsl;

      return validation.validationPromise(requestObject, verbose)
        .then((result) => {
          should(result).be.deepEqual(requestObject);
          should(recurseFieldValidationStub.callCount).be.eql(1);
          should(recurseFieldValidationStub.args[0][0]).be.deepEqual(documentBody);
          should(recurseFieldValidationStub.args[0][1]).be.eql(null);
          should(recurseFieldValidationStub.args[0][2]).be.eql(specification[indexName][collectionName].fields.children);
          should(recurseFieldValidationStub.args[0][3]).be.true();
          should(recurseFieldValidationStub.args[0][4]).be.eql([]);
          should(recurseFieldValidationStub.args[0][5]).be.eql(verbose);
          should(testStub.callCount).be.eql(1);
          should(testStub.args[0][0]).be.deepEqual(indexName);
          should(testStub.args[0][1]).be.deepEqual(collectionName);
          should(testStub.args[0][2]).be.deepEqual(documentBody);
          should(testStub.args[0][3]).be.deepEqual(id);
        });
    });

    it('should throw when field validation fails', () => {
      var
        recurseFieldValidationStub = sandbox.stub().throws({message: 'error'}),
        controllerName = 'aController',
        actionName = 'anAction',
        filterId = 'someFilter',
        testStub = sandbox.stub().resolves([filterId, 'anotherFilter']),
        dsl = {
          test: testStub
        },
        id = 'anId',
        verbose = false,
        documentBody = {},
        requestObject = {
          index: indexName,
          collection: collectionName,
          controller: controllerName,
          action: actionName,
          data: {
            _id: id,
            body: documentBody
          }
        };

      validation.specification = {
        [indexName]: {
          [collectionName]: {
            strict: true,
            fields: {
              children: {
                aField: 'validation'
              }
            },
            validators: filterId
          }
        }
      };
      validation.recurseFieldValidation = recurseFieldValidationStub;
      validation.dsl = dsl;
      Validation.__set__('manageErrorMessage', sandbox.spy(function() {throw new Error(arguments[2]);}));

      return validation.validationPromise(requestObject, verbose)
        .should.rejectedWith('error');
    });

    it('should return an unvalid status when validator validation fails', () => {
      var
        recurseFieldValidationStub = sandbox.stub().returns(true),
        controllerName = 'aController',
        actionName = 'anAction',
        filterId = 'someFilter',
        testStub = sandbox.stub().resolves(['anotherFilter']),
        dsl = {
          test: testStub
        },
        id = 'anId',
        verbose = false,
        documentBody = {},
        requestObject = {
          index: indexName,
          collection: collectionName,
          controller: controllerName,
          action: actionName,
          data: {
            _id: id,
            body: documentBody
          }
        };

      validation.specification = {
        [indexName]: {
          [collectionName]: {
            strict: true,
            fields: {
              children: {
                aField: 'validation'
              }
            },
            validators: filterId
          }
        }
      };
      validation.recurseFieldValidation = recurseFieldValidationStub;
      validation.dsl = dsl;
      Validation.__set__('manageErrorMessage', sandbox.spy(function() {throw new Error(arguments[2]);}));

      return validation.validationPromise(requestObject, verbose)
        .should.rejectedWith('The document does not match validation filters.');
    });

    it('should intercept a strictness error and set the message accordingly', () => {
      var
        recurseFieldValidationStub = sandbox.stub().throws({message: 'strictness'}),
        controllerName = 'aController',
        actionName = 'anAction',
        id = null,
        verbose = false,
        documentBody = {},
        requestObject = {
          index: indexName,
          collection: collectionName,
          controller: controllerName,
          action: actionName,
          data: {
            _id: id,
            body: documentBody
          }
        };

      validation.specification = {
        [indexName]: {
          [collectionName]: {
            strict: true,
            fields: {
              children: {
                aField: 'validation'
              }
            },
            validators: null
          }
        }
      };

      validation.recurseFieldValidation = recurseFieldValidationStub;
      Validation.__set__('manageErrorMessage', sandbox.spy(function() {throw new Error(arguments[2]);}));

      return validation.validationPromise(requestObject, verbose)
        .should.rejectedWith('The document validation is strict; it can not add unspecified sub-fields.');
    });

    it('should intercept a strictness error and set the message accordingly', () => {
      var
        recurseFieldValidationStub = sandbox.stub().throws({message: 'strictness'}),
        manageErrorMessageStub = sandbox.stub(),
        controllerName = 'aController',
        actionName = 'anAction',
        id = null,
        verbose = true,
        documentBody = {},
        requestObject = {
          index: indexName,
          collection: collectionName,
          controller: controllerName,
          action: actionName,
          data: {
            _id: id,
            body: documentBody
          }
        };

      validation.specification = {
        [indexName]: {
          [collectionName]: {
            strict: true,
            fields: {
              children: {
                aField: 'validation'
              }
            },
            validators: null
          }
        }
      };

      validation.recurseFieldValidation = recurseFieldValidationStub;
      Validation.__set__('manageErrorMessage', manageErrorMessageStub);

      return validation.validationPromise(requestObject, verbose)
        .then((result) => {
          should(result).be.deepEqual({
            errorMessages: {},
            validation: false
          });
          should(recurseFieldValidationStub.callCount).be.eql(1);
          should(recurseFieldValidationStub.args[0][0]).be.eql(documentBody);
          should(recurseFieldValidationStub.args[0][1]).be.eql(null);
          should(recurseFieldValidationStub.args[0][2]).be.deepEqual({aField: 'validation'});
          should(recurseFieldValidationStub.args[0][3]).be.true();
          should(recurseFieldValidationStub.args[0][4]).be.eql({});
          should(recurseFieldValidationStub.args[0][5]).be.eql(verbose);
          should(manageErrorMessageStub.callCount).be.eql(1);
          should(manageErrorMessageStub.args[0][2]).be.eql('The document validation is strict; it can not add unspecified sub-fields.');
        });
    });

    it('should throw back any other error happening during field validation', () => {
      var
        recurseFieldValidationStub = sandbox.stub().throws({message: 'not_strictness'}),
        controllerName = 'aController',
        actionName = 'anAction',
        id = null,
        verbose = false,
        documentBody = {},
        requestObject = {
          index: indexName,
          collection: collectionName,
          controller: controllerName,
          action: actionName,
          data: {
            _id: id,
            body: documentBody
          }
        };

      validation.specification = {
        [indexName]: {
          [collectionName]: {
            strict: true,
            fields: {
              children: {
                aField: 'validation'
              }
            },
            validators: null
          }
        }
      };
      validation.recurseFieldValidation = recurseFieldValidationStub;
      Validation.__set__('manageErrorMessage', sandbox.spy(function() {throw new Error(arguments[2]);}));

      return validation.validationPromise(requestObject, verbose)
        .should.rejectedWith('not_strictness');
    });
    /**
     * TODO (update case)
     */
  });

  describe('#recurseFieldValidation', () => {
    /**
     * TODO
     */
  });
});