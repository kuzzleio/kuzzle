'use strict';

class Resolvers {
  constructor (kuzzle) {
    this.kuzzle = kuzzle;

    this._resolversMap = {
      Author: {
        books: (author, args, { loaders }) => {
          const promises = author.books.map(id => loaders.booksById.load(id));
          return Promise.all(promises);
        }
      },
      Query: {
        author: (parent, { id }, { loaders }) => {
          return loaders.authorsById.load(id);
        },
        book: (parent, { id }, { loaders }) => {
          return loaders.booksById.load(id);
        },
      },
    };
  }

  get dump() {
    return this._resolversMap;
  }
}

module.exports = Resolvers;