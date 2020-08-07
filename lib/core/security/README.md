# Kuzzle repositories

The Repository classes allow to fetch and store some Kuzzle internal business object from/to the persistent layer.

An abstract Repository class is available to be overridden if needed depending on the business needs.
The class handles the persistence both to the Cache module and to the database (elastic search by default).

The **Repository** class exposes the following methods:

## Constructor

The constructor expects to be passed the kuzzle instance and an options array.

### options

* *string* collection (mandatory)

The underlying collection to store the Business objects to.

* *integer | false* ttl (optional)

The ttl to use for the cache module. If set to false, the objects get an unlimited lifetime.

* *function* ObjectConstructor (mandatory)

The constructor function for the business objects. The load* methods will return some new instances of this function.

* *function* indexStorage (optional)

The read engine to use to retrieve the business objects to/from the database. Defaults to Kuzzle's internalStorage (elasticsearch).

* *function* cache (optional)

The cache database to use to store and retrieve the business objects to/from the cache. Defaults to Kuzzle's internal cache.

## loadOneFromDatabase

```javascript
Repository.prototype.loadOneFromDatabase = function (id) {...}
```

This method loads one object from the database given its id.

### parameters

* *string* id

The id of the document to retrieve.

### returns

Returns a promise that resolves to the *ObjectConstructor* instance if found or null if the id does not exist in the database.

## loadMultiFromDatabase

```javascript
Repository.prototype.loadMultiFromDatabase = function (ids, hydrate) {...}
```

This method tries to load the business objects from the database matching the given ids.

### returns

Returns a promise that resolves to an array containing the *ObjectConstructor* instances or documents that could be retrieved from the database.

If no matching document could be found, an empty array is returned.

## search

```javascript
Repository.prototype.search = function (filter, from, size) {...}
```

This method tries to load documents matching the given ids from the indexStorage.

### parameters

* *object* query

The query sent to the indexStorage in order to retrieve documents.

* *Integer* from

Starting offset (default: 0).

* *Integer* size

Number of hits to return (default: 20).

### returns

Returns a promise that resolves to an object that contains a list of documents from indexStorage.


## loadFromCache

```javascript
Repository.prototype.loadFromCache = function (id, opts) {...}
```

This method loads one object from the cache given its id.

### parameters

* *string* id

The object id to load from the cache.

* *Object* opts

An optional options object.

Currently, the only optional parameter that can be pass to the method is *key*.
If no key is given to the method, defaults to *collection* + '/' + id.

### returns

Returns a promise that resolves to the *ObjectConstructor* instance if a matching document could be found in the cache, or *null* if no document could be found.

## persistToDB

```javascript
Repository.prototype.persistToDB = function (object) {...}
```

This method persists the given *ObjectConstructor* instance to the database.

### parameters

* *ObjectConstructor* object

The business object to persist.

### returns

*(Promise)*

## persistToCache

```javascript
Repository.prototype.persistToCache = function (object, opts) {...}
```

This method persists the given *ObjectConstructor* instance to the cache.

### parameters

* *ObjectConstructor* object

The business object to persist.

* *Object* opts

An optional options object.
The supported options are:

> * key: The key used to store the object in the cache engine. Defaults to *collection* + '/' + object._id
> * ttl: Defaults to the repository ttl. If set to false, the object will never expire.

### returns

*(Promise)*

## refreshCacheTTL

```javascript
Repository.prototype.refreshCacheTTL = function (object, opts) {...}
```

This methods updates the object's TTL in the cache engine.

### parameters

* *ObjectConstructor* object

The business object to update.

* *Object* opts

An optional options object.  
The supported options are:

> * key: The key used to store the object in the cache engine. Defaults to *collection* + '/' + object._id
> * ttl: Defaults to the repository ttl. If set to false, the object will never expire.

### returns

*(Promise)*

## serializeToCache

```javascript
Repository.prototype.serializeToCache = function (object) {...}
```

This method transforms the business object before being persisted to the cache. The default implementation just returns the object without any transformation and is meant to be overridden.

### parameters

* *ObjectConstructor* object

The business object to persist.

### returns

*(Object)*

## serializeToDatabase

```javascript
Repository.prototype.serializeToDatabase = function (object) {...}
```

This method transforms the business object before being persisted to the cache. The default implementation just returns the object without any transformation and is meant to be overridden.

### parameters

* *ObjectConstructor* object

The business object to persist.

### returns

*(Object)*
