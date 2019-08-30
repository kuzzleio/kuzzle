---
code: false
type: page
title: Go
order: 200
---

## Geofencing with Go

Let's create a new project folder called `geoFence`:

```bash
    mkdir geoFence
```

For this code example we'll need Kuzzle's Go SDK. To install it run the following command:

```bash
    go get github.com/kuzzleio/sdk-go
```

You should now see the `github.com/kuzzleio/sdk-go` folder in your go path.

Now the project configuration is complete, we can create a `snippet.go` file in the `geoFence` folder to program our test.

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

Let's create two functions, one for subscribe and another for publish:

```Go
func Subscribe() {
    /* TODO */
}

func Publish() {
    /* TODO */
}
```

## Connect to Kuzzle

The first thing we need to do is connect to Kuzzle. We will simulate two different clients by creating two separate connections to Kuzzle, one in the subscribe, the other in the publish. To do this write the following code:

```Go
func Subscribe() {
    cn := websocket.NewWebSocket("localhost", nil)
    k, _ := kuzzle.NewKuzzle(cn, nil)

    /* TODO */
}

func Publish() {
    cn := websocket.NewWebSocket("localhost", nil)
    k, _ := kuzzle.NewKuzzle(cn, nil)

    /* TODO */
}
```

Here we assume you have installed Kuzzle on your localhost, if this is not the case replace the `localhost` with the ip or name of the Kuzzle server.

## Create a Geographical Boundary

Now that we have established a connection to Kuzzle, we will perform a subscription request that tells Kuzzle that the App wants to be notified anytime a user leaves a geographical boundary.

We define the geographical boundary as follows, add this to your `Subscribe` function:

```Go
type Location struct {
    Lat float64 `json:"lat"`
    Lon float64 `json:"lon"`
}
type GeoDistance struct {
    Location Location `json:"location"`
    Distance string `json:"distance"`
}
type GeofencingFilters struct {
    GeoDistance GeoDistance `json:"geoDistance"`
}
var filters = GeofencingFilters{
    GeoDistance: GeoDistance{
        Location: Location{
            Lat: 51.510357,
            Lon: -0.116773,
        },
        Distance: "2km",
    },
}
```

This defines a circular boundary centered around [Big Ben](https://www.google.com/maps/place/Big+Ben/@51.510357,-0.116773,15z/data=!4m12!1m6!3m5!1s0x0:0xb78f2474b9a45aa9!2sBig+Ben!8m2!3d51.5007292!4d-0.116773!3m4!1s0x0:0xb78f2474b9a45aa9!8m2!3d51.5007292!4d-0.1246254) with a radius of 2km. For more information about the `geoDistance` filter click [here](/core/1/guides/cookbooks/realtime-api/terms#geodistance).

Note that we use the field name `location` to store the geopoint we are centered around. This means that Kuzzle will monitor the field named `location` for position changes, and so any user location document sent to Kuzzle must also contain this field.

Now the App must request a subscription to the geographical boundary defined in our `filters` object. To ensure that the App only receives a message when the `location` changes from inside the boundary to outside the boundary, we need to set the subscription scope to `out`, for more scope options click [here](/sdk/js/5/core-classes/collection/subscribe).

Now use the Collection `Subscribe` method to execute the subscription request, add this to your `Subscribe` function:

```Go
c := collection.NewCollection(k, "mycollection", "myindex")

ro := types.NewRoomOptions()
rtc := make(chan *types.NotificationResult)
res := <- c.Subscribe(filters, ro.SetScope("out"), rtc)
if res.Error != nil {
    handleError(res.Error)
} else {
    go func (rtc chan *types.NotificationResult) {
        doSomething(<-rtc) // triggered each time the user leaves the circular area around Big Ben
    }(rtc)
}
```

We have now programmed the subscription side of the test.

## Place the User Inside the Geographical Boundary

Now let's move on to the publish side of the test. Here we will create a document that represents the user's location, placed inside the circular boundary around Big Ben.

We will program the _Publish_ function so that it creates a document that contains three fields: `firstName`, `lastName` and `location`.

Let's start by creating the user _Ada Lovelace_ located at Big Ben. Create the Document object in your _Publish_ function as follows:

```Go
//Get the collection
c := collection.NewCollection(k, "mycollection", "myindex")

//Create the user's location: they are inside the circular area
q := types.NewQueryOptions()
q.SetIfExist("replace")
currentLocation := c.Document()
currentLocation.Content = []byte(`{"firstName": "Ada", "lastName": "Lovelace", "location":{"lat": 51.510357, "lon": -0.116773}}`)
c.CreateDocument("326c8f08-63b0-429f-8917-b782d30930e9", currentLocation, q)
```

Notice that we have included a document id, this is so that we can easily reference the document later on. We can also leave the id empty and Kuzzle will generate one automatically.

## Place the User Outside the Geographical Boundary

If the document creation is successful we can go ahead and update it to change the user's location to somewhere outside the geographical boundary. Let's move the user to [Hyde Park](https://www.google.com/maps/place/Hyde+Park/@51.507268,-0.165730,15z/data=!4m5!3m4!1s0x0:0xd1af6c4f49b4bd0c!8m2!3d51.507268!4d-0.165730). Since this is an update we need to do it after the first location document is created.

Add this to your _Publish_ function:

```Go
/* ... */

//After the user's location is stored we can update it: now they are outside the circular area -> This will trigger the notification
newLocation := c.Document()
newLocation.Content = []byte(`{"location": {"lat": 51.507268, "lon": -0.165730}}`)
c.UpdateDocument("326c8f08-63b0-429f-8917-b782d30930e9", newLocation, nil)
```

When the document update request is sent to Kuzzle, it will detect the change in location and send a message to the subscriber, which in this case is our App.

## Run the Test

The full code should look something like this:

```Go
/* Test Class */

func test(){
    subscribe();
    publish();
}

func  Subscribe(){

    //Connect to Kuzzle
    cn := websocket.NewWebSocket("localhost", nil)
    k, _ := kuzzle.NewKuzzle(cn, nil)

    //Get the collection
    c := collection.NewCollection(k, "mycollection", "myindex")

    //Create a filter that defines the circular area around Big Ben
    type Location struct {
        Lat float64 `json:"lat"`
        Lon float64 `json:"lon"`
    }
    type GeoDistance struct {
        Location Location `json:"location"`
        Distance string `json:"distance"`
    }
    type GeofencingFilters struct {
        GeoDistance GeoDistance `json:"geoDistance"`
    }
    var filters = GeofencingFilters{
        GeoDistance: GeoDistance{
            Location: Location{
                Lat: 51.510357,
                Lon: -0.116773,
            },
            Distance: "2km",
        },
    }
    //Create a subscription that triggers a notification when a user the circular area
    ro := types.NewRoomOptions()
    rtc := make(chan *types.NotificationResult)
    res := <- c.Subscribe(filters, ro.SetScope("out"), rtc)
    if res.Error != nil {
        handleError(res.Error)
    } else {
        go func (rtc chan *types.NotificationResult) {
        doSomething(<-rtc) // triggered each time the user leaves the circular area around Big Ben
        }(rtc)
    }
}

func Publish(){

    //Connect to Kuzzle
    cn := websocket.NewWebSocket("localhost", nil)
    k, _ := kuzzle.NewKuzzle(cn, nil)

    //Get the collection
    c := collection.NewCollection(k, "mycollection", "myindex")

    //Create the user's location: they are inside the circular area
    q := types.NewQueryOptions()
    q.SetIfExist("replace")
    currentLocation := c.Document()
    currentLocation.Content = []byte(`{"firstName": "Ada", "lastName": "Lovelace", "location":{"lat": 51.510357, "lon": -0.116773}}`)
    c.CreateDocument("326c8f08-63b0-429f-8917-b782d30930e9", currentLocation, q)


    //After the user's location is stored we can update it: now they are outside the circular area -> This will trigger the notification
    newLocation := c.Document()
    newLocation.Content = []byte(`{"location": {"lat": 51.507268, "lon": -0.165730}}`)
    c.UpdateDocument("326c8f08-63b0-429f-8917-b782d30930e9", newLocation, nil)
}


```
