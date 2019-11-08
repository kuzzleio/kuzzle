/*
 * Kuzzle, a backend software, self-hostable and ready to use
 * to power modern apps
 *
 * Copyright 2015-2018 Kuzzle
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

class BaseModel {

  static register (ModelClass, collection) {
    ModelClass.collection = collection;

    ModelClass.get = async id => {
      const { _source, _id } = await BaseModel.indexStorage.get(
        ModelClass.collection,
        id);

      return new ModelClass({ _id, _source });
    };

    ModelClass.deleteByQuery = query =>
      BaseModel.indexStorage.deleteByQuery(ModelClass.collection, query);
  }

  constructor (collection, fields, _id, _source) {
    this.__collection = collection;
    this.__fields = fields;
    this.__id = null;
    this.__source = {};

    this._id = _id;
    this._source = _source;

    for (const field of this.__fields) {
      Object.defineProperty(this, field, {
        get: () => this.__source[field],
        set: value => {
          this.__source[field] = value;
        }
      });
    }
  }

  get _id () {
    return this.__id;
  }

  set _id (_id) {
    this.__id = _id;
  }

  get _source () {
    return this.__source;
  }

  set _source (_source) {
    for (const key of Object.keys(_source)) {
      if (this.__fields.includes(key)) {
        this.__source[key] = _source[key] || null;
      }
    }
  }

  async save ({ userId=null, refresh } = {}) {
    if (! this._id) {
      const { _id, _source } = await BaseModel.indexStorage.create(
        this.__collection,
        null,
        this._source,
        { userId, refresh });

      this._id = _id;
      this._source = _source;
    }
    else {
      await BaseModel.indexStorage.update(
        this.__collection,
        this._id,
        this._source);
    }
  }

  async delete ({ refresh }) {
    if (! this._id) {
      return;
    }

    await BaseModel.indexStorage.delete(this.__collection, this._id, { refresh });
  }

  serialize () {
    return {
      _id : this._id,
      _source: this._source
    };
  }
}

module.exports = BaseModel;