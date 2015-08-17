# How we work

Kuzzle is currently in alpha version, and we are working hard to implement the needed functionalities to release our first beta version.

It won't be a one-time big release, suddenly bringing Kuzzle from alpha to beta. Kuzzle is an Agile project, and we plan to implement and improve Kuzzle incrementally, until we feel Kuzzle is worthy of a beta version tag.

So stay tuned, as many new functionalities will appear over time!

# Roadmap

Here is the list of features we plan to implement to bring Kuzzle's version to beta.
This list isn't proritized yet, and it may change over time, depending of feedbacks coming from users or from ourselves:
we follow the [Eat your own dog food](https://en.wikipedia.org/wiki/Eating_your_own_dog_food) principle!

## SDK

Our current Javascript SDK is a proof-of-concept, and it will be replaced.
We now have a clear idea of how our SDK should look like, and there is pretty good stuff in here.

Here is what we plan to do:

* Full SDK specifications: this document will be the base of all future SDK, and we'll expect SDK submissions to follow it
* Complete rewrite of our Javascript SDK to make it follow our SDK specifications
* Lots of documentation, examples and demos
* Creation of an Android SDK. More will follow!

## Back-office interface

We think that a good administration graphical interface is essential, so we'll implement one for the beta version.  
UX Design is planned, to make informations easy to retrieve, and to make the GUI itself easy to use.

Here is the list of functionalities we plan to implement for the beta version of this GUI:

* Kuzzle documentation links
* Navigation in stored data
* Realtime log of data and requests going through Kuzzle
* Back-up/Restore of the database
* Multi-level database reset
* Database schema management
* Kuzzle configuration
* Data import/export
* Database schema import/export

## Security

The alpha version currently offer no security, nor does it allow authentication.  
Security is very important to us, so we plan to start with a basic security layer for the beta version, and we'll improve it gradually.

Here is what we plan to do:

* User authentication
* Basic rights management
* Back-office interface only accessible through authentication
* First administrator login process
