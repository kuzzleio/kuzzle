---
code: false
type: page
title: Go
---

## Database Search with Go

Let's create a new project folder called `databaseSearch`:

```bash
    mkdir databaseSearch
```

For this code example we'll need Kuzzle's Go SDK. To install it run the following command:

```bash
    go get github.com/kuzzleio/sdk-go
```

You should now see the `github.com/kuzzleio/sdk-go` folder in your go path.

Now the project configuration is complete, we can create a `snippet.go` file in the `databaseSearch` folder to program our test.

```bash
    touch snippet.go
```

Open the `snippet.go` file and import the following packages:

```Go
import (
    "github.com/kuzzleio/sdk-go/kuzzle"
    "github.com/kuzzleio/sdk-go/types"
    "github.com/kuzzleio/sdk-go/connection/websocket"
    "github.com/kuzzleio/sdk-go/collection"
)
```

## Connect to Kuzzle

The first thing we need to do is connect to Kuzzle. To do this write the following code:

```Go
cn := websocket.NewWebSocket("localhost", nil)
k, _ := kuzzle.NewKuzzle(cn, nil)
```

Here we assume you have installed Kuzzle on your localhost, if this is not the case replace the `localhost` with the ip or name of the Kuzzle server.

## Create a Document

Now that we have established a connection to Kuzzle, we will create a document in our `planets` collection. To do this, we use the Collection `CreateDocument` method.

In this case we create a document with name `Geonosis` and terrain `mountain`:

```Go
c := collection.NewCollection(k, "planets", "galaxies")
q := types.NewQueryOptions()
q.SetIfExist("replace")
planet := c.Document()
planet.Content = []byte(`{"name": "Geonosis", "terrain": "mountain"}`)
c.CreateDocument("", planet, q)
```

## Search for the Document

Now that the document is created and stored in Kuzzle, let's perform a search that will return this document in the result.

First we need to define the search criteria. Here we use the `match` term to find any document that has a `mountain` terrain. For additional terms refer to our [Elasticsearch Cookbook](/core/2/guides/cookbooks/elasticsearch) or Elasticsearch's own documentation.

We use the Collection `Search` method to search for the document in Kuzzle once the document is created:

```Go
filters := &types.SearchFilters{}
filters.Query = json.RawMessage([]byte(`{"match": {"terrain": "mountain"}}`))
result,err := c.Search(filters, nil)

if err != nil {
    handleError(err)
} else {
    //Do something with the matching documents
    doSomething(result)
}
```

There you have it, a simple bit of code that connects to Kuzzle, creates a document and then fetches that document.

## Run the Test

The full code should look something like this:

```Go
/* Test Class */

func test(){
    cn := websocket.NewWebSocket("localhost", nil)
    k, _ := kuzzle.NewKuzzle(cn, nil)
    c := collection.NewCollection(k, "planets", "galaxies")

    q := types.NewQueryOptions()
    q.SetIfExist("replace")
    planet := c.Document()
    planet.Content = []byte(`{"name": "Geonosis", "terrain": "mountain"}`)
    c.CreateDocument("", planet, q)

    filters := &types.SearchFilters{}
    filters.Query = json.RawMessage([]byte(`{"match": {"terrain": "mountain"}}`))
    result,err := c.Search(filters, nil)

    if err != nil {
        handleError(err)
    } else {
        //Do something with the matching documents
        doSomething(result)
    }
}

```
