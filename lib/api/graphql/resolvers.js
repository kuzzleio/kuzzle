'use strict';

const Request = require('kuzzle-common-objects').Request; 

class Resolvers {
  constructor (kuzzle) {
    this.kuzzle = kuzzle;

    this._resolversMap = {
      Query: {
        book: (root, { id }) => {
          const request = new Request({
            _id: id,
            action: 'get',
            collection: 'books',
            controller: 'document',
            index: 'test-data',
          });

          return kuzzle.funnel.checkRights(request)
            .then(_r => kuzzle.funnel.processRequest(_r)
              .then(response => ({ id: response.result._id, ...response.result._source })
              )
            );
        }
      }
    };
  }

  get dump() {
    return this._resolversMap;
  }
}

module.exports = Resolvers;