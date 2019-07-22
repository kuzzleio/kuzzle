---
code: false
type: page
title: Javascript
order: 300
---

## Geofencing with Javascript

For this example we will use Node.js. You will need to install Node.js and NPM.

Let's create a new project folder called `geofence`:

```bash
    mkdir geofence
```

For this code example we'll need Kuzzle's Javascript SDK. To install it, run:

```bash
    npm install kuzzle-sdk
```

We can create an `index.js` file in the `geofence` folder to program our test.

```bash
    touch index.js
```

## Connect to Kuzzle

The first thing we need to do is connect to Kuzzle. To do this write the following code:

<<< ./snippets/load-sdk.js

Replace `kuzzle` with the IP address or with the name of the Kuzzle server.

## Create a Geographical Boundary

Now that we have established a connection to Kuzzle, we will perform a subscription request that tells Kuzzle that the App wants to be notified anytime a user leaves a geographical boundary.

We define the geographical boundary as follows:

<<< ./snippets/definearea.js

This defines a circular boundary centered around [Big Ben](https://www.google.com/maps/place/Big+Ben/@51.510357,-0.116773,15z/data=!4m12!1m6!3m5!1s0x0:0xb78f2474b9a45aa9!2sBig+Ben!8m2!3d51.5007292!4d-0.116773!3m4!1s0x0:0xb78f2474b9a45aa9!8m2!3d51.5007292!4d-0.1246254) with a radius of 2km. For more information about the `geoDistance` filter click [here](/core/1/guides/cookbooks/realtime-api/terms/#geodistance/).

Note that we use the field name `location` to store the geopoint we are centered around. This means that Kuzzle will monitor the field named `location` for position changes, and so any user location document sent to Kuzzle must also contain this field.

Now the App must request a subscription to the geographical boundary defined in our JSONObject. To ensure that the App only receives a message when the `location` changes from inside the boundary to outside the boundary, we need to set the subscription scope to `out`, for more scope options click [here](/sdk/js/5/core-classes/collection/subscribe/).

Let's use the _subscribe_ method :

<<< ./snippets/subscribe.js

We have now programmed the subscription side of the test.

## Place the User Inside the Geographical Boundary

Now let's move on to the publish side of the test. Here we will create a document that represents the user's location, placed inside the circular boundary around Big Ben.

We will use the _create_ method that creates a document containing three fields: `firstName`, `lastName` and `location`.

Let's start by creating the user _Ada Lovelace_ located at Big Ben. Create the Document object as follows:

<<< ./snippets/location.js

Now we create this document in Kuzzle.

<<< ./snippets/createdoc.js

Notice that we have included a document id, this is so that we can easily reference the document later on. We can also leave the id empty and Kuzzle will generate one automatically.

## Place the User Outside the Geographical Boundary

If the document creation is successful we can go ahead and update it to change the user's location to somewhere outside the geographical boundary. Let's move the user to [Hyde Park](https://www.google.com/maps/place/Hyde+Park/@51.507268,-0.165730,15z/data=!4m5!3m4!1s0x0:0xd1af6c4f49b4bd0c!8m2!3d51.507268!4d-0.165730). Since this is an update we need to do it after the first location document is created.

<<< ./snippets/updatedoc.js

When the document update request is sent to Kuzzle, it will detect the change in location and send a message to the subscriber, which in this case is our App.

## Run the Test

The full code should look something like this:

<<< ./snippets/geofenc.js

Your console should output the following message:

```bash
    User has entered Big Ben
```
