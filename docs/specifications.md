# Kuzzle Specifications

## Message structure

Messsages (ie. requests sent to Kuzzle to publish data, subscribe to something, or search for specific data) use following JSON structure :

```json
{
  'controller': <controller>
  'collection': <collection>
  'action': <action>
  'content': <content>
}
```
* &lt;controller&gt; : **write** or **read** or **subscribe**
* &lt;collection&gt; : the collection name
* &lt;action&gt; : the action name, depending to the controller (see below)
* &lt;content&gt; : your content, that SHOULD be a json object.


### Protocol dependant encapsulation

#### REST

#### Websocket

#### AMQP / STOMP / MQTT

### Controllers


