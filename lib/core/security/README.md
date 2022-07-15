# Kuzzle repositories

The Repository classes allow to fetch and store some Kuzzle internal business object from/to the persistent layer.

An abstract Repository class is available to be overridden if needed depending on the business needs.
The class handles the persistence both to the Cache module and to the database (elastic search by default).

The **Repository** class exposes the following methods:

## Constructor

The constructor expects to be passed the kuzzle instance and an options array.

### options

- _string_ collection (mandatory)

The underlying collection to store the Business objects to.

- _integer | false_ ttl (optional)

The ttl to use for the cache module. If set to false, the objects get an unlimited lifetime.

- _function_ ObjectConstructor (mandatory)

The constructor function for the business objects. The load\* methods will return some new instances of this function.

- _function_ indexStorage (optional)

The read engine to use to retrieve the business objects to/from the database. Defaults to Kuzzle's internalStorage (elasticsearch).

- _function_ cache (optional)

The cache database to use to store and retrieve the business objects to/from the cache. Defaults to Kuzzle's internal cache.

## loadOneFromDatabase

```javascript
Repository.prototype.loadOneFromDatabase = function (id) {...}
```

This method loads one object from the database given its id.

### parameters

- _string_ id

The id of the document to retrieve.

### returns

Returns a promise that resolves to the _ObjectConstructor_ instance if found or null if the id does not exist in the database.

## loadMultiFromDatabase

```javascript
Repository.prototype.loadMultiFromDatabase = function (ids, hydrate) {...}
```

This method tries to load the business objects from the database matching the given ids.

### returns

Returns a promise that resolves to an array containing the _ObjectConstructor_ instances or documents that could be retrieved from the database.

If no matching document could be found, an empty array is returned.

## search

```javascript
Repository.prototype.search = function (filter, from, size) {...}
```

This method tries to load documents matching the given ids from the indexStorage.

### parameters

- _object_ query

The query sent to the indexStorage in order to retrieve documents.

- _Integer_ from

Starting offset (default: 0).

- _Integer_ size

Number of hits to return (default: 20).

### returns

Returns a promise that resolves to an object that contains a list of documents from indexStorage.

## loadFromCache

```javascript
Repository.prototype.loadFromCache = function (id, opts) {...}
```

This method loads one object from the cache given its id.

### parameters

- _string_ id

The object id to load from the cache.

- _Object_ opts

An optional options object.

Currently, the only optional parameter that can be pass to the method is _key_.
If no key is given to the method, defaults to _collection_ + '/' + id.

### returns

Returns a promise that resolves to the _ObjectConstructor_ instance if a matching document could be found in the cache, or _null_ if no document could be found.

## persistToDB

```javascript
Repository.prototype.persistToDB = function (object) {...}
```

This method persists the given _ObjectConstructor_ instance to the database.

### parameters

- _ObjectConstructor_ object

The business object to persist.

### returns

_(Promise)_

## persistToCache

```javascript
Repository.prototype.persistToCache = function (object, opts) {...}
```

This method persists the given _ObjectConstructor_ instance to the cache.

### parameters

- _ObjectConstructor_ object

The business object to persist.

- _Object_ opts

An optional options object.
The supported options are:

> - key: The key used to store the object in the cache engine. Defaults to _collection_ + '/' + object.\_id
> - ttl: Defaults to the repository ttl. If set to false, the object will never expire.

### returns

_(Promise)_

## refreshCacheTTL

```javascript
Repository.prototype.refreshCacheTTL = function (object, opts) {...}
```

This methods updates the object's TTL in the cache engine.

### parameters

- _ObjectConstructor_ object

The business object to update.

- _Object_ opts

An optional options object.  
The supported options are:

> - key: The key used to store the object in the cache engine. Defaults to _collection_ + '/' + object.\_id
> - ttl: Defaults to the repository ttl. If set to false, the object will never expire.

### returns

_(Promise)_

## serializeToCache

```javascript
Repository.prototype.serializeToCache = function (object) {...}
```

This method transforms the business object before being persisted to the cache. The default implementation just returns the object without any transformation and is meant to be overridden.

### parameters

- _ObjectConstructor_ object

The business object to persist.

### returns

_(Object)_

## serializeToDatabase

```javascript
Repository.prototype.serializeToDatabase = function (object) {...}
```

This method transforms the business object before being persisted to the cache. The default implementation just returns the object without any transformation and is meant to be overridden.

### parameters

- _ObjectConstructor_ object

The business object to persist.

### returns

_(Object)_
