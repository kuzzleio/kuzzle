"use strict";
/*
 * Kuzzle, a backend software, self-hostable and ready to use
 * to power modern apps
 *
 * Copyright 2015-2022 Kuzzle
 * mailto: support AT kuzzle.io
 * website: http://kuzzle.io
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * https://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.documentEventAliases = void 0;
const documentController_1 = __importDefault(require("../api/controllers/documentController"));
function filter(obj, expectValue) {
    const result = [];
    for (const action in obj) {
        if (obj[action] === expectValue) {
            result.push(action);
        }
    }
    return result;
}
exports.documentEventAliases = {
    list: {
        'delete': filter(documentController_1.default.actions, 'delete'),
        'get': filter(documentController_1.default.actions, 'get'),
        'update': filter(documentController_1.default.actions, 'update'),
        'write': filter(documentController_1.default.actions, 'write'),
    },
    namespace: 'generic:document',
    notBefore: ['search', 'deleteByQuery', 'updateByQuery'],
};
//# sourceMappingURL=documentEventAliases.js.map