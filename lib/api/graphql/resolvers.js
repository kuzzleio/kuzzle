'use strict';

const Request = require('kuzzle-common-objects').Request; 

class Resolvers {
  constructor (kuzzle) {
    this.kuzzle = kuzzle;

    this._resolversMap = {
      Query: {
        book: (root, { id }) => {
          return new Promise((resolve, reject) => kuzzle.funnel.execute(
            new Request({
              _id: id,
              action: 'get',
              collection: 'books',
              controller: 'document',
              index: 'test-data',
            }),
            (error, response) => {
              if (error) {
                reject(error);
                return;
              }
              resolve({ id: response.result._id, ...response.result._source });
            })
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