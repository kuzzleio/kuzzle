'use strict';

const should = require('should');
const { KuzzleGraphql } = require('../../lib/api/graphql/kuzzle-graphql'); 

describe('Generate type', () => {

  it('should throw if no config is provided for the collection', () => {
    const configuration = {
      titi: {
        toto: {
          typeName: 'Toto',
          properties: {}
        }
      }
    };
    const kgql = new KuzzleGraphql(configuration);
    should(kgql.generateType.bind(kgql, 'titi', 'books', {})).throw('No config found for collection books');
  });

  it('should throw if the mapping is malformed', () => {
    const configuration = {
      titi: {
        toto: {
          typeName: 'Toto',
          properties: {}
        }
      }
    };
    const kgql = new KuzzleGraphql(configuration);
    should(kgql.generateType.bind(kgql, 'titi', 'toto', {})).throw('Malformed mapping for collection toto (no properties)');
  });

  it('should generate type with default properties if no properties are defined in the type config', () => {
    const configuration = {
      library: {
        books: {
          typeName: 'Book'
        }
      }
    };
    const kgql = new KuzzleGraphql(configuration);
    const booksMapping = {
      properties: {
        title: {
          type: 'keyword'
        },
        pages: {
          type: 'integer'
        },
        comments: {
          type: 'text'
        },
        authors: {
          type: 'keyword'
        }
      }
    };

    const gqlType = kgql.generateType('library', 'books', booksMapping);
    should(gqlType).equal(`type Book {
  id: ID!
  title: String
  pages: Int
  comments: String
  authors: String
}`);
  });

  it('should generate a type for a simple collection', () => {
    const configuration = {
      library: {
        books: {
          typeName: 'Book',
          properties: {
            title: {
              nullable: false
            },
            comments: {
              plural: true,
              nullableElements: false
            },
            authors: {
              nullable: false,
              plural: true,
              nullableElements: false,
              type: 'Author'
            }
          }
        }
      }
    };
    const kgql = new KuzzleGraphql(configuration);
    const booksMapping = {
      properties: {
        title: {
          type: 'keyword'
        },
        pages: {
          type: 'integer'
        },
        comments: {
          type: 'text'
        },
        authors: {
          type: 'keyword'
        }
      }
    };

    const gqlType = kgql.generateType('library', 'books', booksMapping);
    should(gqlType).equal(`type Book {
  id: ID!
  title: String!
  pages: Int
  comments: [String!]
  authors: [Author!]!
}`);
  });

});

describe('Generate schema', () => {

  it('should generate an empty schema', () => {
    const configuration = {};
    const mappings = {
      library: {
        books: {
          properties: {}
        },
        authors: {
          properties: {}
        }
      }
    };
    const kgql = new KuzzleGraphql(configuration);
    const gqlSchema = kgql.generateSchema(mappings);

    should(gqlSchema).equal(`
type Query {
}

schema {
  query: Query
}`);
  });

  it('should generate a simple schema', () => {
    const configuration = {
      library: {
        books: {
          typeName: 'Book',
          properties: {}
        },
        authors: {
          typeName: 'Author',
          properties: {}
        }
      }
    };
    const mappings = {
      library: {
        books: {
          properties: {}
        },
        authors: {
          properties: {}
        }
      }
    };
    const kgql = new KuzzleGraphql(configuration);
    const gqlSchema = kgql.generateSchema(mappings);

    should(gqlSchema).equal(`type Book {
  id: ID!
}
type Author {
  id: ID!
}

type Query {
  getBook(id: ID!): Book
  mGetBook([id: ID!]!): [Book]
  getAuthor(id: ID!): Author
  mGetAuthor([id: ID!]!): [Author]
}

schema {
  query: Query
}`);

  });
});

describe('Generate resolvers', () => {

  it('should generate the loader creator', () => {
    const configuration = {
      library: {
        books: {
          typeName: 'Book',
          properties: {}
        },
        authors: {
          typeName: 'Author',
          properties: {}
        }
      }
    };
    const kgql = new KuzzleGraphql(configuration);
    const kuzzleMock = {
      funnel: {
        checkRights: () => { },
        processRequest: () => { }
      }
    };
    const loaderCreator = kgql.generateLoaderCreator(kuzzleMock);

    should(typeof loaderCreator).equal('function');

    const loaders = loaderCreator();

    should(loaders).have.ownProperty('Book');
    should(loaders).have.ownProperty('Author');

    should(loaders.Book).type('object');
    should(loaders.Author).type('object');

    should(loaders.Book).have.property('load');
    should(loaders.Author).have.property('load');
  });

  it('should generate the resolver map', () => {
    const configuration = {
      library: {
        books: {
          typeName: 'Book',
          properties: {
            title: {
              nullable: false
            },
            comments: {
              plural: true,
              nullableElements: false
            },
            author: {
              nullable: false,
              type: 'Author',
              isForeingKey: true
            }
          }
        },
        authors: {
          typeName: 'Author',
          properties: {}
        }
      }
    };
    const kgql = new KuzzleGraphql(configuration);

    const resolverMap = kgql.generateResolverMap();

    should(resolverMap).have.ownProperty('Query');

    should(resolverMap.Query).have.ownProperty('getBook');
    should(resolverMap.Query).have.ownProperty('getAuthor');
    should(resolverMap.Query).have.ownProperty('mGetBook');
    should(resolverMap.Query).have.ownProperty('mGetAuthor');

    should(resolverMap.Query.getBook).type('function');
    should(resolverMap.Query.getAuthor).type('function');
    should(resolverMap.Query.mGetBook).type('function');
    should(resolverMap.Query.mGetAuthor).type('function');

    should(resolverMap).have.ownProperty('Book');

    should(resolverMap.Book).have.ownProperty('author');
    should(resolverMap.Book.author).type('function');
  });

});
