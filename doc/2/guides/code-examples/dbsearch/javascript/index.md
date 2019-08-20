---
code: false
type: page
title: Javascript
---

## Database Search with Javascript

For this example we will use Node.js. You will need to install Node.js and NPM.

Let's create a new project folder called `database-search`:

```bash
    mkdir database-search
```

Now install Kuzzle SDK JS 6:

```bash
    npm init
    npm install kuzzle-sdk
```

Now the project configuration is complete, we can create an `index.js` file in the `database-search` folder to program our test.

```bash
    touch index.js
```

## Instantiate Kuzzle

First, we need to instantiate a new Kuzzle object. To do this implement the following code:

<<< ./snippets/load-sdk.js

## Connect to Kuzzle

We now need to connect to Kuzzle:

<<< ./snippets/connect.js

## Create an index, a collection and documents

Now that we have established a connection to Kuzzle, we will create a new index, a new collection and two documents.

<<< ./snippets/create.js

## Search for documents

Now that the documents are created and stored in Kuzzle, let's perform a search returning the documents that match our query filters.

<<< ./snippets/search.js

Your index.js file should now look like this:

<<< ./snippets/final.js

Here we are, we have a simple bit of code that connects to Kuzzle, creates some documents and then prints the number of documents matching a simple search request on the terrain property.

To run it, just use node :

```bash
    node index.js
```

By running this code, the console should output the following message:

```bash
    There are 1 matching documents.
```
