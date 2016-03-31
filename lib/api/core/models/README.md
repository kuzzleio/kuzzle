# About the models directory

This directory contains Kuzzle object abstraction for different request and response handle by different part of the code


## requestObject.js
This class allow to create an object that represent the user request (action, controller, collection, filter or document, requestId, ...)

## notificationObject.js
This class allow to create an object that represent information about room that we have to send to the user (room id)

## responseObject.js
This class allow to create an object that represent information about object send to the client (response from WriteEngine/readEngine, action, controller, collection, ...)