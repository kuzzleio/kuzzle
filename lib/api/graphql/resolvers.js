'use strict';

const Request = require('kuzzle-common-objects').Request; 
const DataLoader = require('dataloader');

class Resolvers {
  constructor (kuzzle) {
    this.kuzzle = kuzzle;
    this.booksById = new DataLoader(ids => {
      const request = new Request({
        _id: ids,
        action: 'mGet',
        collection: 'books',
        controller: 'document',
        index: 'test-data',
      });

      return kuzzle.funnel.checkRights(request)
        .then(_r => kuzzle.funnel.processRequest(_r)
          .then(response => ids.map(
            id => response.result.hits.find(
              hit => hit._id === id
            ))
          )
        );
    });

    // Note to my future self on monday: check if this works.

    this._resolversMap = {
      Query: {
        book: (parent, { id }) => this.booksById(id)
      }
    };
  }

  get dump() {
    return this._resolversMap;
  }
}

module.exports = Resolvers;