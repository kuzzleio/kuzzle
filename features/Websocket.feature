Feature: Test websocket API
  As a user
  I want to create/update/delete/search a document and test bulk import
  Using WebSocket API

  @usingWebsocket
  Scenario: Get server information
    When I get server informations
    Then I can retrieve the Kuzzle API version

  @usingWebsocket
  Scenario: Publish a realtime message
    When I publish a message
    Then I should receive a request id
    Then I'm not able to get the document

  @usingWebsocket
  Scenario: Create a new document and get it
    When I write the document
    Then I should receive a document id
    Then I'm able to get the document
    And I'm not able to get the document in index "kuzzle-test-index-alt"

  @usingWebsocket @unsubscribe
  Scenario: Create or Update a document
    Given A room subscription listening to "lastName" having value "Hopper"
    When I write the document "documentGrace"
    And I createOrReplace it
    Then I should have updated the document
    And I should receive a "update" notification
    And The notification should have metadata

  @usingWebsocket
  Scenario: Replace a document
    When I write the document "documentGrace"
    Then I replace the document with "documentAda" document
    Then my document has the value "Ada" in field "firstName"

  @usingWebsocket
  Scenario: Update a document
    When I write the document
    Then I update the document with value "foo" in field "firstName"
    Then my document has the value "foo" in field "firstName"

  @usingWebsocket
  Scenario: Delete a document
    When I write the document
    Then I remove the document
    Then I'm not able to get the document

  @usingWebsocket
  Scenario: Search a document
    When I write the document "documentGrace"
    And I refresh the index
    Then I find a document with "grace" in field "firstName"
    And I don't find a document with "grace" in field "firstName" in index "kuzzle-test-index-alt"

  @usingWebsocket
  Scenario: Bulk import
    When I do a bulk import
    Then I can retrieve actions from bulk import

  @usingWebsocket
  Scenario: Global Bulk import
    When I do a global bulk import
    Then I can retrieve actions from bulk import

  @usingWebsocket
  Scenario: Truncate collection
    When I write the document
    Then I refresh the index
    Then I truncate the collection
    Then I'm not able to get the document

  @usingWebsocket
  Scenario: Count document
    When I write the document "documentGrace"
    When I write the document "documentAda"
    When I write the document "documentGrace"
    When I write the document "documentAda"
    Then I count 4 documents
    And I count 0 documents in index "kuzzle-test-index-alt"
    And I count 2 documents with "NYC" in field "city"
    Then I truncate the collection
    And I count 0 documents

  @usingWebsocket
  Scenario: Change mapping
    When I write the document "documentGrace"
    Then I don't find a document with "Grace" in field "firstName"
    Then I change the schema
    When I write the document "documentGrace"
    And I refresh the index
    Then I find a document with "Grace" in field "newFirstName"

  @usingWebsocket @unsubscribe
  Scenario: Document creation notifications
    Given A room subscription listening to "lastName" having value "Hopper"
    When I write the document "documentGrace"
    Then I should receive a "create" notification
    And The notification should have a "_source" member
    And The notification should have metadata

  @usingWebsocket @unsubscribe
  Scenario: Document creation notifications with not exists
    Given A room subscription listening field "toto" doesn't exists
    When I write the document "documentGrace"
    Then I should receive a "create" notification
    And The notification should have a "_source" member
    And The notification should have metadata

  @usingWebsocket @unsubscribe
  Scenario: Document delete notifications
    Given A room subscription listening to "lastName" having value "Hopper"
    When I write the document "documentGrace"
    Then I remove the document
    Then I should receive a "delete" notification
    And The notification should not have a "_source" member
    And The notification should have metadata

  @usingWebsocket @unsubscribe
  Scenario: Document update: new document notification
    Given A room subscription listening to "lastName" having value "Hopper"
    When I write the document "documentAda"
    Then I update the document with value "Hopper" in field "lastName"
    Then I should receive a "update" notification
    And The notification should have a "_source" member
    And The notification should have metadata

  @usingWebsocket @unsubscribe
  Scenario: Document update: removed document notification
    Given A room subscription listening to "lastName" having value "Hopper"
    When I write the document "documentGrace"
    Then I update the document with value "Foo" in field "lastName"
    Then I should receive a "update" notification
    And The notification should not have a "_source" member
    And The notification should have metadata

  @usingWebsocket @unsubscribe
  Scenario: Document replace: new document notification
    Given A room subscription listening to "lastName" having value "Hopper"
    When I write the document "documentAda"
    Then I replace the document with "documentGrace" document
    Then I should receive a "update" notification
    And The notification should have a "_source" member
    And The notification should have metadata

  @usingWebsocket @unsubscribe
  Scenario: Document replace: removed document notification
    Given A room subscription listening to "lastName" having value "Hopper"
    When I write the document "documentGrace"
    Then I replace the document with "documentAda" document
    Then I should receive a "update" notification
    And The notification should not have a "_source" member
    And The notification should have metadata

  @usingWebsocket @unsubscribe
  Scenario: Subscribe to a collection
    Given A room subscription listening to the whole collection
    When I write the document "documentGrace"
    Then I should receive a "create" notification
    And The notification should have a "_source" member
    And The notification should have metadata

  @usingWebsocket @unsubscribe
  Scenario: Delete a document with a query
    Given A room subscription listening to "lastName" having value "Hopper"
    When I write the document "documentGrace"
    And I write the document "documentAda"
    And I refresh the index
    Then I remove documents with field "hobby" equals to value "computer"
    Then I should receive a "delete" notification
    And The notification should not have a "_source" member
    And The notification should have metadata

  @usingWebsocket @unsubscribe
  Scenario: Count how many subscription on a room
    Given A room subscription listening to "lastName" having value "Hopper" with socket "client1"
    Given A room subscription listening to "lastName" having value "Hopper" with socket "client2"
    Then I can count "2" subscription

  @usingWebsocket @unsubscribe
  Scenario: Subscription notifications
    Given A room subscription listening to "lastName" having value "Hopper" with socket "client1"
    Given A room subscription listening to "lastName" having value "Hopper" with socket "client2"
    Then I should receive a "on" notification
    And The notification should have metadata
    Then I unsubscribe socket "client1"
    And I should receive a "off" notification
    And The notification should have metadata

  @usingWebsocket
  Scenario: Getting the last statistics frame
    When I get the last statistics frame
    Then I get at least 1 statistic frame

  @usingWebsocket
  Scenario: Getting the statistics frame from a date
    When I get the statistics frame from a date
    Then I get at least 1 statistic frame

  @usingWebsocket
  Scenario: Getting all statistics frame
    When I get all statistics frames
    Then I get at least 1 statistic frame

  @usingWebsocket
  Scenario: list known stored collections
    When I write the document "documentGrace"
    And I list "stored" data collections
    Then I can find a stored collection kuzzle-collection-test

  @usingWebsocket @unsubscribe
  Scenario: list known realtime collections
    Given A room subscription listening to "lastName" having value "Hopper"
    When I list "realtime" data collections
    Then I can find a realtime collection kuzzle-collection-test

  @usingWebsocket
  Scenario: get the Kuzzle timestamp
    When I get the server timestamp
    Then I can read the timestamp

  @usingWebsocket @unsubscribe
  Scenario: get list of subscriptions
    Given A room subscription listening to "lastName" having value "Hopper"
    And I get the list subscriptions
    Then In my list there is a collection "kuzzle-collection-test" with 1 room and 1 subscriber

  @usingWebsocket @unsubscribe
  Scenario: remove a specific room in subscriptions
    Given A room subscription listening to "lastName" having value "Hopper"
    Given A room subscription listening to "firstName" having value "Grace"
    And I get the list subscriptions
    Then In my list there is a collection "kuzzle-collection-test" with 2 room and 2 subscriber
    When I remove the first room
    And I get the list subscriptions
    Then In my list there is a collection "kuzzle-collection-test" with 1 room and 1 subscriber

  @usingWebsocket
  Scenario: create additional index
    When I create an index named "kuzzle-test-index-new"
    Then I'm able to find the index named "kuzzle-test-index-new" in index list
    Then I'm not able to find the index named "my-undefined-index" in index list
    Then I'm able to delete the index named "kuzzle-test-index-new"

  @usingWebsocket @cleanSecurity
  Scenario: login user
    Given I create a user "user1" with id "user1-id"
    When I log in as user1-id:testpwd expiring in 1h
    Then I write the document
    Then I check the JWT Token
    And The token is valid
    Then I logout
    Then I can't write the document
    Then I check the JWT Token
    And The token is invalid

  @usingWebsocket @cleanSecurity
  Scenario: Create/get/search/update/delete role
    When I create a new role "role1" with id "test"
    Then I'm able to find a role with id "test"
    And I update the role with id "test" with role "role2"
    Then I'm able to find a role with id "test" with role "role2"
    Then I'm able to find "1" role by searching index corresponding to role "role2"
    And I delete the role with id "test"
    Then I'm not able to find a role with id "test"
    Then I create a new role "role1" with id "test"
    And I create a new role "role1" with id "test2"
    And I create a new role "role1" with id "test3"
    Then I'm able to do a multi get with "test,test2,test3" and get "3" roles
    Then I'm able to find "3" role by searching index corresponding to role "role1"
    Then I'm able to find "1" role by searching index corresponding to role "role1" from "0" to "1"

  @usingWebsocket @cleanSecurity
  Scenario: create an invalid profile with unexisting role triggers an error
    Then I cannot create an invalid profile

  @usingWebsocket @cleanSecurity
  Scenario: get profile without id triggers an error
    Then I cannot a profile without ID

  @usingWebsocket @cleanSecurity
  Scenario: creating a profile with an empty set of roles triggers an error
    Then I cannot create a profile with an empty set of roles

  @usingWebsocket @cleanSecurity
  Scenario: create, get and delete a profile
    Given I create a new role "role1" with id "role1"
    And I create a new role "role2" with id "role2"
    When I create a new profile "profile1" with id "my-new-profile"
    Then I'm able to find the profile with id "my-new-profile"
    Given I delete the profile with id "my-new-profile"
    Then I'm not able to find the profile with id "my-new-profile"

  @usingWebsocket @cleanSecurity
  Scenario: search and update profiles
    Given I create a new role "role1" with id "role1"
    And I create a new role "role2" with id "role2"
    And I create a new profile "profile1" with id "my-profile-1"
    And I create a new profile "profile3" with id "my-profile-2"
    Then I'm able to find "1" profiles containing the role with id "role1"
    Then I'm able to find "2" profiles
    Then I'm able to find "0" profiles containing the role with id "undefined-role"
    Then I'm able to do a multi get with "my-profile-1,my-profile-2" and get "2" profiles
    Given I update the profile with id "my-profile-2" by adding the role "role1"
    Then I'm able to find "2" profiles
    Then I'm able to find "2" profiles containing the role with id "role1"

  @usingWebsocket @cleanSecurity
  Scenario: user crudl
    When I create a new role "role1" with id "role1"
    And I create a new role "role2" with id "role2"
    And I create a new profile "profile2" with id "profile2"
    And I create a new user "user1" with id "user1-id"
    And I create a user "user2" with id "user2-id"
    And I can't create a new user "user2" with id "user1-id"
    Then I am able to get the user "user1-id" matching {"_id":"#prefix#user1-id","_source":{"profile":{"_id":"admin", "_source": {"roles":[{"_id":"admin"}]}}}}
    Then I am able to get the user "user2-id" matching {"_id":"#prefix#user2-id","_source":{"profile":{"_id":"#prefix#profile2"}}}
    Then I search for {"regexp":{"_uid":"users.#prefix#.*"}} and find 2 users
    Then I delete the user "user2-id"
    Then I search for {"regexp":{"_uid":"users.#prefix#.*"}} and find 1 users matching {"_id":"#prefix#user1-id","_source":{"name":{"first":"David","last":"Bowie"}}}
    When I log in as user1-id:testpwd expiring in 1h
    Then I am getting the current user, which matches {"_id":"#prefix#user1-id","_source":{"profile":{"_id":"admin"}}}
    Then I log out
    Then I am getting the current user, which matches {"_id":-1,"_source":{"profile":{"_id":"anonymous"}}}

  @usingWebsocket @cleanSecurity @unsubscribe
  Scenario: token expiration
    Given A room subscription listening to "lastName" having value "Hopper"
    Given I create a user "user1" with id "user1-id"
    When I log in as user1-id:testpwd expiring in 1s
    Then I wait 1s
    And I should receive a "jwtTokenExpired" notification

  @usingWebsocket @cleanRedis
  Scenario: memory storage
    When I call the info method of the memory storage with arguments ""
    Then The ms result should match the regex ^# Server\r\nredis_version:
    When I call the set method of the memory storage with arguments { "_id": "#prefix#mykey", "body": { "value": 2 }}
    Then The ms result should match the regex OK
    Then I call the incr method of the memory storage with arguments { "_id": "#prefix#mykey" }
    And The ms result should match the json 3
    Then I call the decr method of the memory storage with arguments { "_id": "#prefix#mykey" }
    And The ms result should match the json 2
    Then I call the append method of the memory storage with arguments { "_id": "#prefix#mykey", "body": "bar" }
    And The ms result should match the json 4
    Then I call the get method of the memory storage with arguments { "_id": "#prefix#mykey" }
    And The ms result should match the json "2bar"
    Then I call the del method of the memory storage with arguments { "_id": "#prefix#mykey" }
    And The ms result should match the json 1
    Then I call the get method of the memory storage with arguments { "_id": "#prefix#mykey" }
    And The ms result should match the json null
    Then I call the set method of the memory storage with arguments { "_id": "#prefix#x", "body": "foobar" }
    Then I call the set method of the memory storage with arguments { "_id": "#prefix#y", "body": "abcdef" }
    Then I call the bitop method of the memory storage with arguments { "body": { "operation": "AND", "destkey": "#prefix#dest", "keys": [ "#prefix#x", "#prefix#y" ] } }
    Then I call the get method of the memory storage with arguments { "_id": "#prefix#dest" }
    And The ms result should match the json "`bc`ab"
    Then I call the bitop method of the memory storage with arguments { "body": { "operation": "OR", "destkey": "#prefix#dest", "keys": [ "#prefix#x", "#prefix#y" ] } }
    Then I call the get method of the memory storage with arguments { "_id": "#prefix#dest" }
    And The ms result should match the json "goofev"
    Then I call the bitpos method of the memory storage with arguments { "_id": "#prefix#x", "body": { "bit": 1 } }
    And The ms result should match the json 1
    Then I call the rpush method of the memory storage with arguments { "_id": "#prefix#list", "body": { "value": 1, "values": [ "abcd", 5 ] }}
    And The ms result should match the json 5
    Then I call the lindex method of the memory storage with arguments { "_id": "#prefix#list", "body": { "idx": 1 } }
    And The ms result should match the json "abcd"



