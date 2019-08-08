---
code: false
type: page
title: Go
---

## Pub/Sub with Go

Let's create a new project folder called `realtimePubSub`:

```bash
    mkdir realtimePubSub
```

For this code example we'll need Kuzzle's Go SDK. To install it run the following command:

```bash
    go get github.com/kuzzleio/sdk-go
```

You should now see the `github.com/kuzzleio/sdk-go` folder in your go path.

Now the project configuration is complete, we can create a `snippet.go` file in the `realtimePubSub` folder to program our test.

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

## Subscribe to Documents with Specific Criteria

We will perform a subscription request that tells Kuzzle that the App wants to be notified anytime a document is created that contains the _message_ field. We define this subscription filter as follows, for more information about filters click [here](/core/1/guides/cookbooks/realtime-api/):

In the Subscribe function add:

```Go
type SubscribeFiltersField struct {
    Field string `json:"field"`
}
type SubscribeFiltersExists struct {
    Exists SubscribeFiltersField `json:"exists"`
}
var filter = SubscribeFiltersExists{
    Exists: SubscribeFiltersField{
        Field: "message",
    },
}
```

Use the Collection `Subscribe` method to execute the subscription request, using the filter object as input.

```Go
c := collection.NewCollection(k, "mycollection", "myindex")

ro := types.NewRoomOptions()
rtc := make(chan *types.NotificationResult)
res := <- c.Subscribe(filter, ro, rtc)

if res.Error != nil {
    handleError(res.Error)
} else {
    go func (rtc chan *types.NotificationResult) {
    //Triggered each time the document matches the filter
    doSomething(<-rtc)
    }(rtc)
}
```

We have now programmed the subscription side of the test.

## Publish a Document

Now let's move on to the publish side of the test. Here we will publish a document that contains the `message` field. When Kuzzle receives this message, it will detect that there is a subscriber listening for such messages and will send it to these subscribers, in this case to our Android App.

We will program a _publish_ method that connects to Kuzzle and creates a document that contains the value `hello world` in the `message` field.

```Go
c := collection.NewCollection(k, "mycollection", "myindex")

type doc struct {
    Message    string `json:"message"`
}

qo := types.NewQueryOptions()
c.PublishMessage(&doc{Message: "hello world"}, qo)
```

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

    //Create a filter that will be used to subscribe to document changes
    type SubscribeFiltersField struct {
        Field string `json:"field"`
    }
    type SubscribeFiltersExists struct {
        Exists SubscribeFiltersField `json:"exists"`
    }
    var filter = SubscribeFiltersExists{
        Exists: SubscribeFiltersField{
            Field: "message",
        },
    }

    //Get the collection
    c := collection.NewCollection(k, "mycollection", "myindex")

    //Subscribe to document changes using the filter
    ro := types.NewRoomOptions()
    rtc := make(chan *types.NotificationResult)
    res := <- c.Subscribe(filter, ro, rtc)

    if res.Error != nil {
        handleError(res.Error)
    } else {
        go func (rtc chan *types.NotificationResult) {
            //Triggered each time the document matches the filter
            doSomething(<-rtc)
        }(rtc)
    }

}

func Publish(){

    //Connect to Kuzzle
    cn := websocket.NewWebSocket("localhost", nil)
    k, _ := kuzzle.NewKuzzle(cn, nil)

    //Get the collection
    c := collection.NewCollection(k, "mycollection", "myindex")

    // Create the document that will trigger the notification
    type doc struct {
        Message    string `json:"message"`
    }

    // Publish the document
    qo := types.NewQueryOptions()
    c.PublishMessage(&doc{Message: "hello world"}, qo)
}


```
