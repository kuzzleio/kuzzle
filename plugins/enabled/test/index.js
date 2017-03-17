function Plugin () {
  this.pipes = {
    'document:create': 'myFunction'
  };

  this.init = function pluginInit (config, context) {
    context.accessors.storage.bootstrap({
      someCollection: {
        properties: {
          myField: {
            type: 'keyword'
          }
        }
      }
    })
      .then(result => {
        console.log('=============== bootstrap ===============');
        console.log(result);

        return context.accessors.storage.createCollection('anotherColllection', {
          properties: {
            anotherField: {
              type: 'keyword'
            }
          }
        });
      })
      .then(result => {
        console.log('=============== createCollection ===============');
        console.log(result);

        return context.accessors.storage.create({
          _id: 'someDocumentId',
          some: 'content'
        }, 'someCollection');
      })
      .then(result => {
        console.log('=============== create1 ===============');
        console.log(result);

        return context.accessors.storage.create({
          _id: 'anotherDocumentId',
          some: 'content'
        }, 'someCollection');
      })
      .then(result => {
        console.log('=============== create2 ===============');
        console.log(result);

        return context.accessors.storage.createOrReplace({
          _id: 'someDocumentId',
          some: 'content'
        }, 'someCollection');
      })
      .then(result => {
        console.log('=============== createOrReplace ===============');
        console.log(result);

        return context.accessors.storage.search({
          query: {
            match_all: {}
          }
        }, 0, 10, 'someCollection');
      })
      .then(result => {
        console.log('=============== search ===============');
        console.log(result);

        return context.accessors.storage.get('someDocumentId', 'someCollection');
      })
      .then(result => {
        console.log('=============== get ===============');
        console.log(result);

        return context.accessors.storage.mGet(['someDocumentId', 'anotherDocumentId'], 'someCollection');
      })
      .then(result => {
        console.log('=============== mGet ===============');
        console.log(result);

        return context.accessors.storage.replace({
          _id: 'anotherDocumentId',
          some: 'content'
        }, 'someCollection');
      })
      .then(result => {
        console.log('=============== replace ===============');
        console.log(result);

        return context.accessors.storage.update({
          _id: 'anotherDocumentId',
          some: 'content'
        }, 'someCollection');
      })
      .then(result => {
        console.log('=============== update ===============');
        console.log(result);

        return context.accessors.storage.delete('someDocumentId', 'someCollection');
      })
      .then(result => {
        console.log('=============== delete ===============');
        console.log(result);
      })
      .catch(error => {
        console.error(error);
      });
  };

  this.myFunction = function pluginMyFunction (request, callback) {
    console.log('Hello World');
    return callback(null, request);
  };
}

module.exports = Plugin;