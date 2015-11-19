var
  should = require('should'),
  BadRequestError = require.main.require('lib/api/core/errors/badRequestError'),
  InternalError = require.main.require('lib/api/core/errors/internalError'),
  Role = require.main.require('lib/api/core/models/security/role');

describe('Test: security/roleTest', function () {
  var
    context = {connection: null, user: null},
    requestObject = {
      index: 'index',
      collection: 'collection',
      controller: 'controller',
      action: 'action'
    };

  it('should disallow any action when no matching entry can be found', function () {
    var
      role = new Role();

    role.indexes = {
      index: {
        collections: {
          collection: {
            controllers: {
              controller: {
                actions: {
                }
              }
            }
          }
        }
      }
    };

    should(role.isActionAllowed(requestObject, context)).be.false();

    delete role.indexes.index.collections.collection.controllers.controller.actions;
    should(role.isActionAllowed(requestObject, context)).be.false();

    delete role.indexes.index.collections.collection.controllers.controller;
    should(role.isActionAllowed(requestObject, context)).be.false();

    delete role.indexes.index.collections.collection.controllers;
    should(role.isActionAllowed(requestObject, context)).be.false();

    delete role.indexes.index.collections.collection;
    should(role.isActionAllowed(requestObject, context)).be.false();

    delete role.indexes.index.collections;
    should(role.isActionAllowed(requestObject, context)).be.false();

    delete role.indexes.index;
    should(role.isActionAllowed(requestObject, context)).be.false();

    delete role.indexes;
    should(role.isActionAllowed(requestObject, context)).be.false();
  });

  it('should allow an action explicitely set to true', function () {
    var role = new Role();

    role.indexes = {
      index: {
        collections: {
          collection: {
            controllers: {
              controller: {
                actions: {
                  action: true
                }
              }
            }
          }
        }
      }
    };

    should(role.isActionAllowed(requestObject, context)).be.true();
  });

  it('should allow an wildcard action', function () {
    var role = new Role();
    role.indexes = {
      '*': {
        collections: {
          '*': {
            controllers: {
              '*': {
                actions: {
                  '*': true
                }
              }
            }
          }
        }
      }
    };

    should(role.isActionAllowed(requestObject, context)).be.true();
  });

  it('should properly handle overwritten permissions', function () {
    var role = new Role();
    role.indexes = {
      '*': {
        collections: {
          '*': {
            controllers: {
              '*': {
                actions: {
                  '*': true
                }
              }
            }
          }
        }
      },
      index: {
        collections: {
          '*': {
            controllers: {
              '*': {
                actions: {
                  '*': false
                }
              }
            }
          }
        }
      }
    };

    should(role.isActionAllowed(requestObject, context)).be.false();

    role.indexes.index.collections['*'].controllers['*'].actions.action = true;
    should(role.isActionAllowed(requestObject, context)).be.true();

    role.indexes.index.collections['*'].controllers.controller = {
      actions: {
        '*': false
      }
    };
    should(role.isActionAllowed(requestObject, context)).be.false();

    role.indexes.index.collections['*'].controllers.controller.actions.action = true;
    should(role.isActionAllowed(requestObject, context)).be.true();

    role.indexes.index.collections.collection = {
      controllers: {
        '*': {
          actions: {
            '*': false
          }
        }
      }
    };
    should(role.isActionAllowed(requestObject, context)).be.false();

    role.indexes.index.collections.collection.controllers.controller = {
      actions: {
        '*': true
      }
    };
    should(role.isActionAllowed(requestObject, context)).be.true();

    role.indexes.index.collections.collection.controllers.controller.actions.action = false;
    should(role.isActionAllowed(requestObject, context)).be.false();
  });

  it('should throw an error if the rights configuration is not either a boolean or a function', function () {
    var role = new Role();
    role.indexes = {
      '*': {
        collections: {
          '*': {
            controllers: {
              '*': {
                actions: {
                  '*': {an: 'object'}
                }
              }
            }
          }
        }
      }
    };

    should(function () { role.isActionAllowed(requestObject, context); }).throw(InternalError);
  });

  it('should throw an error if an invalid function is given', function () {
    var role = new Role();
    role.indexes = {
      '*': {
        collections: {
          '*': {
            controllers: {
              '*': {
                actions: {
                  '*': '(some invalid code'
                }
              }
            }
          }
        }
      }
    };

    should(function () { role.isActionAllowed(requestObject, context); }).throw(InternalError);
  });

  it('should handle a custom right function', function () {
    var
      role = new Role(),
      noMatchRequestObject = {
        collection: 'collection',
        controller: 'controller',
        action: 'noaction'
      };

    role.indexes = {
      '*': {
        collections: {
          '*': {
            controllers: {
              '*': {
                actions: {
                  '*': 'return requestObject.action === \'action\'; '
                }
              }
            }
          }
        }
      }
    };

    should(role.isActionAllowed(requestObject, context)).be.true();
    should(role.isActionAllowed(noMatchRequestObject, context)).be.false();

    role.closures = {};
    role.indexes['*'].collections['*'].controllers['*'].actions['*'] = 'return requestObject.action !== \'action\'; ';
    should(role.isActionAllowed(requestObject, context)).be.false();

  });
});
