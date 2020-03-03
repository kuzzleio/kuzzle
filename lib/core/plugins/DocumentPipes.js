/*
 * Kuzzle, a backend software, self-hostable and ready to use
 * to power modern apps
 *
 * Copyright 2015-2020 Kuzzle
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

'use strict';

const Koncorde = require('koncorde');

class DocumentCallback {
  constructor (pluginName, filterId, index, collection, filters, callback) {
    this.pluginName = pluginName;
    this.filterId = filterId;
    this.index = index;
    this.collection = collection;
    this.filters = filters;
    this.callback = callback;
  }
}

class DocumentPipes {
  constructor (kuzzle) {
    this._koncorde = new Koncorde({
      maxMinTerms: kuzzle.config.limits.subscriptionMinterms,
      regExpEngine: kuzzle.config.realtime.pcreSupport ? 'js' : 're2',
      seed: kuzzle.config.internal.hash.seed
    });

    this._writeCallbacks = null;
  }

  async registerOnWrite (pluginName, index, collection, filters, callback) {
    const { id } = await this._koncorde.register(index, collection, filters);

    if (! this._writeCallbacks) {
      this._writeCallbacks = {};
    }

    if (! this._writeCallbacks[id]) {
      this._writeCallbacks[id] = [];
    }

    this._writeCallbacks[id].push(
      new DocumentCallback(pluginName, id, index, collection, filters, callback));

    return this._writeCallbacks[id].length;
  }

  triggerOnWrite (index, collection, document) {
    if (! this._writeCallbacks) {
      return [];
    }

    const ids = this._koncorde.test(
      index,
      collection,
      document._source,
      document._id);

    if (ids.length === 0) {
      return [];
    }

    const callbacks = [];

    for (let i = 0; i < ids.length; i++) {
      const id = ids[i];

      for (let j = 0; j < this._writeCallbacks[id].length; j++) {
        const documentCallback = this._writeCallbacks[id][j];

        callbacks.push(documentCallback);
      }
    }

    return callbacks;
  }
}

module.exports = DocumentPipes;
