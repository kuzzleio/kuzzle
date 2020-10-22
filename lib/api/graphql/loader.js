"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateLoader = void 0;
const dataloader_1 = __importDefault(require("dataloader"));
const kuzzle_common_objects_1 = require("kuzzle-common-objects");
/**
 * Generates a Dataloader for a given type.
 *
 * @param kuzzle The Kuzzle Core instance
 * @param indexName
 * @param collectionName
 * @param typeName
 */
exports.generateLoader = (kuzzle, indexName, collectionName, typeName) => new dataloader_1.default(ids => {
    try {
        const request = new kuzzle_common_objects_1.Request({
            action: 'mGet',
            body: { ids },
            collection: collectionName,
            controller: 'document',
            index: indexName,
        }, {});
        return kuzzle.funnel.checkRights(request)
            .then(_r => kuzzle.funnel.processRequest(_r)
            .then((response) => {
            return ids.map(id => {
                const success = response.result.successes.find(hit => hit._id === id);
                if (success) {
                    return {
                        ...success._source,
                        id
                    };
                }
                const notFoundId = response.result.errors.find(erroredId => erroredId === id);
                if (notFoundId) {
                    return new Error(`${typeName} not found "${notFoundId}"`);
                }
                return new Error(`${typeName} not found "${id}"`);
            });
        }));
    }
    catch (error) {
        return Promise.reject(error);
    }
});
//# sourceMappingURL=loader.js.map