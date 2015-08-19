# How we work

Kuzzle is currently in alpha version, and we are working hard to implement new features for our first beta version, mainly focusing on user-friendliness and production readiness.  
It won't be a one-time big release, suddenly bringing Kuzzle from alpha to beta. Kuzzle is an agile project, and we plan to implement and improve Kuzzle incrementally, until we feel Kuzzle is worthy of a beta version tag.  

Likewise, the roadmap below is the required features needed to **enter** beta version. After that we'll keep amending this beta version with many more features, until we feel ready to bring Kuzzle to its first stable release.

And after our first stable release, we won't stop there!  
We have already planned a few neat things for Kuzzle. We already know that we want full scalability, data enrichment through external API, and more.

So stay tuned, as many new functionalities will appear over time!

# What we have planned to do with Kuzzle

On one hand, Kuzzle is a big project, and we're bringing a lot of resources to make it a reality and, in the future, it will need resources to maintain and to make it better.

On the other hand, Kuzzle is also an open source project, and we have open source core values at heart.

So, to avoid any confusion, we decided to be completely honest with our intents.  
Keep in mind that we're speaking about intents based on long-term goals: we're still far from a stable release of Kuzzle!

Here is what we know for sure:

* Kuzzle source code will **always** be open source and free to use
* We plan to sell professional-grade support of Kuzzle
* We plan to sell a cloud-based version of Kuzzle
* Because we feel that contributions will help us release a better version of Kuzzle faster, we plan to reward our contributors, or at least most of them, depending on our budget. What we have in mind at the moment is a free access to our cloud-based version of Kuzzle.

We have a few more ideas still up to debate, so more items might appear in the future.

# Roadmap to beta

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
UX Design is planned, to make information easy to retrieve, and to make the GUI itself easy to use.

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
