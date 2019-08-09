---
code: false
type: page
title: Go
---

## IoT with Go

Let's create a new project folder called `iot`:

```bash
    mkdir iot
```

For this code example we'll need the `Paho` package. To install it run the following command:

```bash
    go get github.com/eclipse/paho.mqtt.golang
```

You should now see the `github.com/eclipse/paho.mqtt.golang` folder in your go path.

Now the project configuration is complete, we can create a `snippet.go` file in the `iot` folder to program our test.

```bash
    touch snippet.go
```

Open the `snippet.go` file and import the following packages:

```Go
import (
    mqtt "github.com/eclipse/paho.mqtt.golang"
)
```

## Connect to Kuzzle

The first thing we need to do is connect to Kuzzle. To do this write the following code:

```Go
//Connect to Kuzzle
opts := mqtt.NewClientOptions().AddBroker("tcp://localhost:1883")
client := mqtt.NewClient(opts)
if token := client.Connect(); token.Wait() && token.Error() != nil {
        handleError(token.Error())
}
var wg sync.WaitGroup
wg.Add(1)
```

Here we assume you have installed Kuzzle on your localhost, if this is not the case replace the `localhost` with the ip or name of the Kuzzle server.

## Subscribe to the MQTT Response Topic

Now that we have established a connection to Kuzzle, we will subscribe to the Kuzzle "Kuzzle/response" Topic so that the client can listen to responses from Kuzzle:

```Go
//Subscribe to the Kuzzle/response topic
if token := client.Subscribe("Kuzzle/response", 0, func(client mqtt.Client, msg mqtt.Message) {
        if string(msg.Payload()) != "mymessage" {
            handleError("unexpected result")
        }
        //Get the Kuzzle response
        doSomething(string(msg.Payload()))
        wg.Done()
}); token.Wait() && token.Error() != nil {
    handleError(token.Error())
}
```

We have now programmed the subscription side of the MQTT transport.

## Publish a Request on the MQTT Request Topic

Now let's move on to the publish side of the test. Here we will publish a request to Kuzzle through the MQTT Protocol. In this case we will send a Collection Publish request.

```js
//Publish a message to Kuzzle
payload := []byte(`{"index": "myindex", "collection": "mycollection", "controller": "realtime", "action": "publish", "requestId": "unique_request_id", "body": {"volatile": "message"}}`)

if token := client.Publish("Kuzzle/request", 0, false, payload); token.Wait() && token.Error() != nil {
    handleError(token.Error())
}
wg.Wait()
```

## Run the Test

The full code should look something like this:

```Go
/* Test Class */

func test(){
    //Connect to Kuzzle
    opts := mqtt.NewClientOptions().AddBroker("tcp://localhost:1883")
    client := mqtt.NewClient(opts)
    if token := client.Connect(); token.Wait() && token.Error() != nil {
            handleError(token.Error())
    }
    var wg sync.WaitGroup
    wg.Add(1)

    //Subscribe to the Kuzzle/response topic
    if token := client.Subscribe("Kuzzle/response", 0, func(client mqtt.Client, msg mqtt.Message) {
            if string(msg.Payload()) != "mymessage" {
                handleError("unexpected result")
            }
            //Get the Kuzzle response
            doSomething(string(msg.Payload()))
            wg.Done()
    }); token.Wait() && token.Error() != nil {
        handleError(token.Error())
    }

    //Publish a message to Kuzzle
    payload := []byte(`{"index": "myindex", "collection": "mycollection", "controller": "realtime", "action": "publish", "requestId": "unique_request_id", "body": {"volatile": "message"}}`)

    if token := client.Publish("Kuzzle/request", 0, false, payload); token.Wait() && token.Error() != nil {
        handleError(token.Error())
    }
    wg.Wait()
}


```
