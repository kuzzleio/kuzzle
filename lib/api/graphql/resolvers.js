'use strict';

const Request = require('kuzzle-common-objects').Request; 
const DataLoader = require('dataloader');

class Resolvers {
  constructor (kuzzle) {
    this.kuzzle = kuzzle;
    this.authorsById = new DataLoader(ids => {
      try {
        const request = new Request({
          action: 'mGet',
          body: { ids },
          collection: 'authors',
          controller: 'document',
          index: 'test-data',
        });
        return kuzzle.funnel.checkRights(request)
          .then(_r => kuzzle.funnel.processRequest(_r)
            .then(response => {
              return ids.map(
                id => {
                  const success = response.result.successes.find(
                    hit => hit._id === id
                  );
                  if (success) {
                    return success._source;
                  }
                  const notFoundId = response.result.errors.find(
                    erroredId => erroredId === id
                  );
                  if (notFoundId) {
                    return new Error(`Author not found "${notFoundId}"`);
                  }
                  return new Error(`Authors not found "${id}"`);
                });
            })
          );
      } catch (error) {
        return Promise.reject(error);
      }
    });
    this.booksById = new DataLoader(ids => {
      try {
        const request = new Request({
          action: 'mGet',
          body: { ids },
          collection: 'books',
          controller: 'document',
          index: 'test-data',
        });
        return kuzzle.funnel.checkRights(request)
          .then(_r => kuzzle.funnel.processRequest(_r)
            .then(response => {
              return ids.map(
                id => {
                  const success = response.result.successes.find(
                    hit => hit._id === id
                  );
                  if (success) {
                    return success._source;
                  }
                  const notFoundId = response.result.errors.find(
                    erroredId => erroredId === id
                  );
                  if (notFoundId) {
                    return new Error(`Book not found "${notFoundId}"`);
                  }
                  return new Error(`Books not found "${id}"`);
                });
            })
          );
      } catch (error) {
        return Promise.reject(error);
      }
    });

    this._resolversMap = {
      Query: {
        author: (parent, { id }) => {
          return this.authorsById.load(id);
        },
        book: (parent, { id }) => {
          return this.booksById.load(id);
        },
      }
    };
  }

  get dump() {
    return this._resolversMap;
  }
}

module.exports = Resolvers;