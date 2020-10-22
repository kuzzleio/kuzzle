import DataLoader from 'dataloader'
import { Request, RequestResponse } from 'kuzzle-common-objects'

/**
 * Generates a Dataloader for a given type.
 * 
 * @param kuzzle The Kuzzle Core instance
 * @param indexName 
 * @param collectionName 
 * @param typeName 
 */
export const generateLoader =
  (kuzzle, indexName: string, collectionName: string, typeName: string): DataLoader<string, any, any> =>
    new DataLoader(ids => {
      try {
        const request = new Request({
          action: 'mGet',
          body: { ids },
          collection: collectionName,
          controller: 'document',
          index: indexName,
        }, {});
        return kuzzle.funnel.checkRights(request)
          .then(_r => kuzzle.funnel.processRequest(_r)
            .then((response: RequestResponse) => {
              return ids.map(
                id => {
                  const success = response.result.successes.find(
                    hit => hit._id === id
                  );
                  if (success) {
                    return {
                      ...success._source,
                      id
                    }
                  }
                  const notFoundId = response.result.errors.find(
                    erroredId => erroredId === id
                  );
                  if (notFoundId) {
                    return new Error(`${typeName} not found "${notFoundId}"`);
                  }
                  return new Error(`${typeName} not found "${id}"`);
                });
            })
          );
      } catch (error) {
        return Promise.reject(error);
      }
    })