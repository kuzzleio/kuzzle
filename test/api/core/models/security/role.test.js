'use strict';

const ROLE_MODULE_PATH = '../../../../../lib/api/core/models/security/role';

const
  should = require('should'),
  mockrequire = require('mock-require'),
  Bluebird = require('bluebird'),
  Kuzzle = require('../../../../mocks/kuzzle.mock'),
  BadRequestError = require('kuzzle-common-objects').errors.BadRequestError,
  Request = require('kuzzle-common-objects').Request,
  ParseError = require('kuzzle-common-objects').errors.ParseError,
  Role = require(ROLE_MODULE_PATH);

describe('Test: security/roleTest', () => {
  let
    kuzzle,
    context = {
      protocol: 'test',
      userId: '-1'
    },
    request = new Request({
      index: 'index',
      collection: 'collection',
      controller: 'controller',
      action: 'action'
    }, context),
    documentAda = {
      _id: 'ada',
      found: true,
      _version: 1,
      _index: 'bar',
      _type: 'barbar',
      _source: {
        firstName: 'Ada',
        lastName: 'Lovelace',
        city: 'London',
        hobby: 'computer'
      }
    },
    documentFalseAda = {
      _id: 'foobar',
      found: true,
      _version: 1,
      _index: 'bar',
      _type: 'barbar',
      _source: {
        firstName: 'Ada',
        lastName: 'Lovelace',
        city: 'London',
        hobby: 'computer'
      }
    };

  before(() => {
    kuzzle = new Kuzzle();
  });

  describe('#isActionAllowed', () => {
    it('should disallow any action when no matching entry can be found', () => {
      const
        role = new Role();

      role.controllers = {
        controller: {
          actions: {}
        }
      };

      return role.isActionAllowed(request, kuzzle)
        .then(isAllowed => {
          should(isAllowed).be.false();

          delete role.controllers.controller.actions;
          return role.isActionAllowed(request, kuzzle);
        })
        .then(isAllowed => {
          should(isAllowed).be.false();

          delete role.controllers.controller;
          return role.isActionAllowed(request, kuzzle);
        })
        .then(isAllowed => {
          should(isAllowed).be.false();

          delete role.controllers;
          return role.isActionAllowed(request, kuzzle);
        })
        .then(isAllowed => {
          should(isAllowed).be.false();
        });

    });

    it('should allow an action explicitely set to true', () => {
      const role = new Role();

      role.controllers = {
        controller: {
          actions: {
            action: true
          }
        }
      };

      return should(role.isActionAllowed(request, kuzzle)).be.fulfilledWith(true);
    });

    it('should allow a wildcard action', () => {
      const role = new Role();
      role.controllers = {
        '*': {
          actions: {
            '*': true
          }
        }
      };

      return should(role.isActionAllowed(request, kuzzle)).be.fulfilledWith(true);
    });

    it('should properly handle restrictions', () => {
      const
        role = new Role(),
        req = new Request({
          controller: 'controller',
          action: 'action'
        }, context),
        restrictions = [
          {index: 'index1'},
          {index: 'index2', collections: ['collection1']},
          {index: 'index3', collections: ['collection1', 'collection2']}
        ];

      role.controllers = {
        controller: {
          actions: {
            action: true
          }
        }
      };

      return role.isActionAllowed(req, kuzzle)
        .then(isAllowed => {
          should(isAllowed).be.true();
          role.restrictedTo = restrictions;
          return role.isActionAllowed(req, kuzzle);
        })
        .then(isAllowed => {
          should(isAllowed).be.true();
          req.input.resource.index = 'index';
          return role.isActionAllowed(req, kuzzle);
        })
        .then(isAllowed => {
          should(isAllowed).be.false();
          req.input.resource.index = 'index1';
          return role.isActionAllowed(req, kuzzle);
        })
        .then(isAllowed => {
          should(isAllowed).be.true();
          req.input.resource.index = 'index2';
          return role.isActionAllowed(req, kuzzle);
        })
        .then(isAllowed => {
          should(isAllowed).be.true();
          req.input.resource.collection = 'collection';
          return role.isActionAllowed(req, kuzzle);
        })
        .then(isAllowed => {
          should(isAllowed).be.false();
          req.input.resource.collection = 'collection1';
          return role.isActionAllowed(req, kuzzle);
        })
        .then(isAllowed => {
          should(isAllowed).be.true();
          req.input.resource.collection = 'collection2';
          return role.isActionAllowed(req, kuzzle);
        })
        .then(isAllowed => {
          should(isAllowed).be.false();
          req.input.resource.index = 'index3';
          return role.isActionAllowed(req, kuzzle);
        })
        .then(isAllowed => {
          should(isAllowed).be.true();
        });
    });

    it('should properly handle overridden permissions', () => {
      const role = new Role();
      role.controllers = {
        '*': {
          actions: {
            '*': true
          }
        },
        controller: {
          actions: {
            '*': false
          }
        }
      };

      return role.isActionAllowed(request, kuzzle)
        .then(isAllowed => {
          should(isAllowed).be.false();
          role.controllers.controller.actions.action = true;
          return role.isActionAllowed(request, kuzzle);
        })
        .then(isAllowed => {
          should(isAllowed).be.true();
          role.controllers.controller.actions.action = false;
          return role.isActionAllowed(request, kuzzle);
        })
        .then(isAllowed => {
          should(isAllowed).be.false();
        });
    });

    it('should allow/deny collection creation according to index creation right', () => {
      const
        roleAllow = new Role(),
        roleDeny = new Role(),
        req = new Request({
          controller: 'admin',
          action: 'createCollection',
          index: 'index',
          collection: 'collection'
        }, context);

      roleAllow.controllers = {
        admin: {
          actions: {
            createIndex: true,
            createCollection: true
          }
        }
      };

      roleDeny.controllers = {
        admin: {
          actions: {
            createIndex: false,
            createCollection: true
          }
        }
      };

      return roleAllow.isActionAllowed(req, kuzzle)
        .then(isAllowed => {
          should(isAllowed).be.true();
          return roleDeny.isActionAllowed(req, kuzzle);
        })
        .then(isAllowed => {
          should(isAllowed).be.false();
        });
    });

    it('should allow/deny document creation according to index/collection creation right', () => {
      const
        roleAllow = new Role(),
        roleDeny1 = new Role(),
        roleDeny2 = new Role(),
        req = new Request({
          controller: 'write',
          action: 'create',
          index: 'index',
          collection: 'collection'
        }, context);

      roleAllow.controllers = {
        admin: {
          actions: {
            createIndex: true,
            createCollection: true
          }
        },
        write: {
          actions: {
            create: true
          }
        }
      };

      roleDeny1.controllers = {
        admin: {
          actions: {
            createIndex: false,
            createCollection: true
          }
        },
        write: {
          actions: {
            create: true
          }
        }
      };

      roleDeny2.controllers = {
        admin: {
          actions: {
            createIndex: true,
            createCollection: false
          }
        },
        write: {
          actions: {
            create: true
          }
        }
      };

      return roleAllow.isActionAllowed(req, kuzzle)
        .then(isAllowed => {
          should(isAllowed).be.true();
          return roleDeny1.isActionAllowed(req, kuzzle);
        })
        .then(isAllowed => {
          should(isAllowed).be.false();
          return roleDeny2.isActionAllowed(req, kuzzle);
        })
        .then(isAllowed => {
          should(isAllowed).be.false();
        });
    });

    it('should reject if the rights configuration is not either a boolean or a closure', () => {
      const role = new Role();
      role.controllers = {
        '*': {
          actions: {
            '*': {an: 'object'}
          }
        }
      };

      return should(role.isActionAllowed(request, kuzzle)).be.rejected();
    });

    it('should reject if the closure function return a non boolean value', () => {
      const role = new Role();

      role.controllers = {
        '*': {
          actions: {
            '*': {test: 'return "retret";'}
          }
        }
      };

      return should(role.isActionAllowed(request, kuzzle)).be.rejected();
    });

    it('should reject if an invalid function is given', () => {
      const role = new Role();

      role.controllers = {
        '*': {
          actions: {
            '*': {
              test: '(some invalid code',
              args: {}
            }
          }
        }
      };

      return should(role.isActionAllowed(request, kuzzle)).be.rejectedWith(ParseError);
    });

    it('should reject if an invalid argument is given', () => {
      const role = new Role();

      role.controllers = {
        '*': {
          actions: {
            '*': {
              test: 'return args.document && args.document.id === $request.input.resource._id;',
              args: {
                document: {
                  get: '$request.input.resource.._id'
                }
              }
            }
          }
        }
      };

      return should(role.isActionAllowed(request, kuzzle)).be.rejectedWith(ParseError);
    });

    it('should handle a custom right function', () => {
      const
        role = new Role(),
        noMatchRequest = new Request({
          collection: 'collection',
          controller: 'controller',
          action: 'noaction'
        }, context);

      role.controllers = {
        '*': {
          actions: {
            '*': {
              args: {},
              test: 'return $request.input.action === \'action\'; '
            }
          }
        }
      };

      return role.isActionAllowed(request, kuzzle)
        .then(isAllowed => {
          should(isAllowed).be.true();

          return role.isActionAllowed(noMatchRequest, kuzzle);
        })
        .then(isAllowed => {
          should(isAllowed).be.false();
          role.closures = {};
          role.controllers['*'].actions['*'] = {
            args: {},
            test: 'return $request.input.action !== \'action\'; '
          };

          return role.isActionAllowed(request, kuzzle);
        })
        .then(isAllowed => {
          should(isAllowed).be.false();
        });
    });

    it('should allow/deny rights using custom function with args using get', () => {
      let
        role = new Role(),
        allowed = new Request({
          controller: 'document',
          action: 'get',
          requestId: 'foo',
          collection: 'barbar',
          index: 'bar',
          _id: documentAda._id,
          body: {}
        }, context),
        denied = new Request({
          controller: 'document',
          action: 'get',
          requestId: 'foo',
          collection: 'barbar',
          index: 'bar',
          _id: documentFalseAda._id,
          body: {}
        }, context);

      role.controllers = {
        '*': {
          actions: {
            '*': {
              args: {
                document: {
                  action: {
                    get: '$currentId'
                  },
                  index: 'bar',
                  collection: 'barbar'
                }
              },
              test: 'return args.document && args.document.id === $request.input.resource._id;'
            }
          }
        }
      };

      kuzzle.services.list.storageEngine.get.returns(Bluebird.resolve(documentAda));

      return role.isActionAllowed(allowed, kuzzle)
        .then(isAllowed => {
          should(isAllowed).be.true();

          return role.isActionAllowed(denied, kuzzle);
        })
        .then(isAllowed => should(isAllowed).be.false());
    });

    it('should allow/deny rights using custom function with args using mget', () => {
      const
        role = new Role(),
        allowed = new Request({
          controller: 'document',
          action: 'get',
          requestId: 'foo',
          collection: 'barbar',
          index: 'bar',
          _id: documentAda._id,
          body: {}
        }, context),
        denied = new Request({
          controller: 'document',
          action: 'get',
          requestId: 'foo',
          collection: 'barbar',
          index: 'bar',
          _id: documentFalseAda._id,
          body: {}
        }, context);

      role.controllers = {
        '*': {
          actions: {
            '*': {
              args: {
                documents: {
                  action: {
                    mget: ['$currentId']
                  },
                  index: 'bar',
                  collection: 'barbar'
                }
              },
              test: 'return args.documents[0] && args.documents[0].id === $request.input.resource._id;'
            }
          }
        }
      };

      kuzzle.services.list.storageEngine.mget.returns(Bluebird.resolve({hits: [documentAda]}));

      return role.isActionAllowed(allowed, kuzzle)
        .then(isAllowed => {
          should(isAllowed).be.true();

          return role.isActionAllowed(denied, kuzzle);
        })
        .then(isAllowed => should(isAllowed).be.false());
    });

    it('should allow/deny rights using custom function with args using search', () => {
      const
        role = new Role(),
        allowed = new Request({
          controller: 'read',
          action: 'get',
          requestId: 'foo',
          collection: 'barbar',
          index: 'bar',
          _id: documentAda._id,
          body: {}
        }, context),
        denied = new Request({
          controller: 'read',
          action: 'get',
          requestId: 'foo',
          collection: 'barbar',
          index: 'bar',
          _id: documentFalseAda._id,
          body: {}
        }, context);

      role.controllers = {
        '*': {
          actions: {
            '*': {
              args: {
                documents: {
                  action: {
                    search: {
                      query: {
                        ids: {
                          values: [
                            '$request.input.resource._id'
                          ]
                        }
                      }
                    }
                  },
                  index: 'bar',
                  collection: 'barbar'
                }
              },
              test: 'return args.documents[0] && args.documents[0].id === $request.input.resource._id;'
            }
          }
        }
      };

      kuzzle.services.list.storageEngine.search.returns(Bluebird.resolve({hits: [documentAda]}));

      return role.isActionAllowed(allowed, kuzzle)
        .then(isAllowed => {
          should(isAllowed).be.true();

          return role.isActionAllowed(denied, kuzzle);
        })
        .then(isAllowed => should(isAllowed).be.false());
    });

    it('should not allow bad method call', () => {
      const
        role = new Role(),
        req = new Request({
          controller: 'read',
          action: 'get',
          requestId: 'foo',
          collection: 'barbar',
          index: 'bar',
          _id: documentAda._id,
          body: {}
        });

      role.controllers = {
        '*': {
          actions: {
            '*': {
              args: {
                document: {
                  action: {
                    foo: '$currentId'
                  },
                  index: 'bar',
                  collection: 'barbar'
                }
              },
              test: 'return args.document && args.document.id === $request.input.resource._id;'
            }
          }
        }
      };

      return role.isActionAllowed(req, kuzzle)
        .then(isAllowed => should(isAllowed).be.false());
    });

    it('should not allow if read method throws an error', () => {
      const
        role = new Role(),
        req = new Request({
          controller: 'read',
          action: 'get',
          requestId: 'foo',
          collection: 'barbar',
          index: 'bar',
          _id: 'reject',
          body: {}
        }, context);

      role.controllers = {
        '*': {
          actions: {
            '*': {
              args: {
                document: {
                  action: {
                    get: '$currentId'
                  },
                  index: 'bar',
                  collection: 'barbar'
                }
              },
              test: 'return args.document && args.document.id === $request.input.resource._id;'
            }
          }
        }
      };

      return should(role.isActionAllowed(req, kuzzle)).be.fulfilledWith(false);
    });

    it('should not allow if collection is not specified', () => {
      const
        role = new Role(),
        req = new Request({
          controller: 'read',
          action: 'get',
          requestId: 'foo',
          collection: 'barbar',
          index: 'bar',
          _id: documentAda._id,
          body: {}
        }, context);

      role.controllers = {
        '*': {
          actions: {
            '*': {
              args: {
                document: {
                  action: {
                    get: '$currentId'
                  },
                  collection: 'barbar'
                }
              },
              test: 'return args.document && args.document.id === $request.input.resource._id;'
            }
          }
        }
      };

      return should(role.isActionAllowed(req, kuzzle)).be.fulfilledWith(false);
    });
  });

  describe('#validateDefinition', () => {
    it('should reject the promise if the controllers definition is not an object', () => {
      const role = new Role();
      role.controllers = true;

      return should(role.validateDefinition(context)).be.rejectedWith(BadRequestError, {message: 'The "controllers" definition must be an object'});
    });

    it('should reject the promise if the controllers definition is empty', () => {
      const role = new Role();
      role.controllers = {};

      return should(role.validateDefinition(context)).be.rejectedWith(BadRequestError, {message: 'The "controllers" definition cannot be empty'});
    });

    it('should reject the promise if the controller element is not an object', () => {
      const role = new Role();
      role.controllers = {
        '*': true
      };

      return should(role.validateDefinition(context)).be.rejectedWith(BadRequestError, {message: 'Invalid definition for [*]: must be an object'});
    });

    it('should reject the promise if the controller element is empty', () => {
      const role = new Role();
      role.controllers = {
        '*': {}
      };

      return should(role.validateDefinition(context)).be.rejectedWith(BadRequestError, {message: 'Invalid definition for [*]: cannot be empty'});
    });

    it('should reject the promise if the actions attribute is missing', () => {
      const role = new Role();
      role.controllers = {
        controller: {
          a: true
        }
      };

      return should(role.validateDefinition(context)).be.rejectedWith(BadRequestError, {message: 'Invalid definition for [controller]: "actions" attribute missing'});
    });

    it('should reject the promise is the actions attribute is not an object', () => {
      const role = new Role();
      role.controllers = {
        controller: {
          actions: true
        }
      };

      return should(role.validateDefinition(context)).be.rejectedWith(BadRequestError, {message: 'Invalid definition for [controller]: "actions" attribute must be an object'});
    });

    it('should reject the promise if the actions attribute is empty', () => {
      const role = new Role();
      role.controllers = {
        controller: {
          actions: {}
        }
      };

      return should(role.validateDefinition(context)).be.rejectedWith(BadRequestError, {message: 'Invalid definition for [controller]: "actions" attribute cannot be empty'});
    });

    it('should reject the promise if the action right is neither a boolean or an object', () => {
      const role = new Role();
      role.controllers = {
        controller: {
          actions: {
            action: null
          }
        }
      };

      return should(role.validateDefinition(context)).be.rejectedWith(BadRequestError, {message: 'Invalid definition for [controller, action]: must be a boolean or an object'});
    });

    it('should validate if only boolean rights are given', () => {
      const role = new Role();
      role.controllers = {
        controller1: {
          actions: {
            action1: false,
            action2: true
          }
        },
        controller2: {
          actions: {
            action3: true
          }
        }
      };

      return should(role.validateDefinition(context)).be.fulfilledWith(true);
    });

    it('should reject the promise if the closure does not contain a "test" attribute', () => {
      const role = new Role();
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

      return should(role.validateDefinition(context)).be.rejected();
    });

    it('should reject the promise if the sandbox throws an error', () => {
      mockrequire('../../../../../lib/api/core/sandbox', function () {
        this.run = function () { return Bluebird.reject(new Error('unit test error')); };
      });

      let role = new (mockrequire.reRequire(ROLE_MODULE_PATH))();

      mockrequire.stopAll();

      role.controllers = {
        controller: {
          actions: {
            action: {
              args: {},
              test: 'a string'
            }
          }
        }
      };

      return should(role.validateDefinition()).be.rejectedWith(Error, {message: 'unit test error'});
    });

    it('should reject the promise if the sandbox does not resolve to a boolean', () => {
      mockrequire('../../../../../lib/api/core/sandbox', function () {
        this.run = function () { return Bluebird.resolve({result: 'I am not a boolean'}); };
      });

      let role = new (mockrequire.reRequire(ROLE_MODULE_PATH))();

      mockrequire.stopAll();

      role.controllers = {
        controller: {
          actions: {
            action: {
              args: {},
              test: 'a string'
            }
          }
        }
      };

      return should(role.validateDefinition()).be.rejectedWith(BadRequestError, {message: 'Invalid definition for [controller, action]: error executing function'});
    });

    it('should resolve the promise if the sandbox returned a boolean', () => {
      mockrequire('../../../../../lib/api/core/sandbox', function () {
        this.run = function () { return Bluebird.resolve({ result: true }); };
      });

      let role = new (mockrequire.reRequire(ROLE_MODULE_PATH))();

      mockrequire.stopAll();

      role.controllers = {
        controller: {
          actions: {
            action: {
              args: {},
              test: 'a string'
            }
          }
        }
      };

      return role.validateDefinition()
        .then(result => should(result).be.true());
    });
  });
});
