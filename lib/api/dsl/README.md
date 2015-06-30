# What is Kuzzle's DSL?

This module converts our API Domain Specific Language in internal filtering functions. It is used by the hotelClerkController.


The Kuzzle's DSL use the [Elasticsearch filter DSL](https://www.elastic.co/guide/en/elasticsearch/reference/current/query-dsl-filters.html).

* for the persistent DSL (search), the whole Elasticsearch DSL is available,
* for real-time subscription, the filter list is a subset of the Elasticsearch DSL. See the [docs/filters.md](../../../docs/filters.md) section for details.


This folder contains the following files :

* **index.js** entry point for the module,
* **methods.js** split complex requests (e.g. hobby:"ski" and sex:"female") and convert the result into [currified functions](https://en.wikipedia.org/wiki/Currying), using test functions stored in the operator.js module,
* **operators.js** implements filters operators.


A complete subscription message can for instance have the following form:

```json
{
    "requestId": "my-custom-subscription",
    "action": "on",
    "collection": "members",
    "body": {
        "bool": {
            "must": [
                { "term": { "sex": "female" } },
                { "term": { "hobby": "ski" } },
                { 
                    "range": { 
                        "age": {
                            "gte": "30",
                            "lte": "45"
                        }
                    }
                },
                {
                    "geo_distance": {
                        "distance": "20km",
                        "location": {
                            "lat": 40,
                            "lon": 50
                        }
                    }
                }
            ]
        }
    }
}
```

Eventually, we want to store this subscription in the hotelClerkController rooms collection in the following form:

```json
rooms = {
    'f45de4d8ef4f3ze4ffzer85d4fgkzm41' : { // -> computed room id
        id: "f45de4d8ef4f3ze4ffzer85d4fgkzm41",
        names: [ 'my-custom-subscription' ], // -> customer
        count: 7 // -> how many users have subscribed to this room
        filters: {
        and : {
            'members.sex.termSexFemale': dsl.filtersTree.members.sex.termSexFemale.fn,
            'members.hobby.termHobbySki': dsl.filtersTree.members.hobby.termHobbySki.fn,
            'members.age.rangeAgeGte30Lte45': dsl.filtersTree.members.age.rangeAgeGte30Lte45.fn,
            'members.location.geoDistanceLocation20kmlat40lon50': dsl.filtersTree.members.location.geoDistanceLocation20kmlat40lon50.fn
            }
        }
    }
}
```

The current module manages the needed functions used in the final room definition.

These functions are stored in a central collection in kuzzle.dsl.filtersTree. This object is just a container for the created functions and is used as a repository.
It has the following structure:

```json
{
    // collection name
    "members" : {
        // attribute
        "sex": {
            "termSexFemale": {
                // list of rooms that use the function
                rooms: ["f45de4d8ef4f3ze4ffzer85d4fgkzm41", "2cf15c9ebf0e315866c44f4afb5920eb4a6a8462" ],
                // actual function implemenation
                fn: function(value) {...} 
            },
         },
         "hobby": {
            "termHobbySki": {
            [..]
            }
        }
    }
}
```

# index.js

The module entry point.

It exposes 3 methods: 

* addCurriedFunction
* testFilters
* removeRoom

## addCurriedFunction

    this.addCurriedFunction = function (roomId, collection, filters) {...}

This method parses the filters expressed using the DSL and returns a compound object that embeds the actual filter functions to use.

### parameters

* *string* roomId 

The computed room id.
In our example, would be *f45de4d8ef4f3ze4ffzer85d4fgkzm41*.

* *string* collection

The collection name.
In our example, would be *members*.

* *object* filters

The filters as expressed by the end-user. Matches the "content" attribute of the subscription message.

### return value

This method returns a promise that resolves to the final subobject stored hotelClerkController.rooms.filters.

In our example, it would resolve to:

```json
and : {
    'members.sex.termSexFemale': dsl.filtersTree.members.sex.termSexFemale.fn,
    'members.hobby.termHobbySki': dsl.filtersTree.members.hobby.termHobbySki.fn,
    'members.age.rangeAgeGte30Lte45': dsl.filtersTree.members.age.rangeAgeGte30Lte45.fn,
    'members.location.geoDistanceLocation20kmlat40lon50': dsl.filtersTree.members.location.geoDistanceLocation20kmlat40lon50.fn
}
```

## testFilters

    this.testFilters = function (data) {...}

This method takes a message submitted to kuzzle as an entry and returns the list of rooms to notify.

### parameters

* *object* data

The data sent including its envelope sent to kuzzle in a write call.

I.e.:

```
{
    "action": "create",
    "persist": false,
    "collection": "members",
    "content": {
        "firstName": "Beth",
        "lastName": "Gibbons",
        "hobby": "singing",
        "location": {
            "lat": 51;
            "lon": -2
        },
        "age": 50
    }
}
```

### return value

Returns a promise that resolves to the list of room ids to notify.

## removeRoom

    this.removeRoom = function (room) {...}

This method is called from the hotelClerkController to remove a room when it has no subscriber left.

### parameters

* *object* room

The room to delete, from the hotelClerkController.rooms collection.

### return value

The method returns a silent promise.


# Contributing


You can refer to the [docs/filters.md](../../../docs/filters.md) section to get the list of the implemented filters.
