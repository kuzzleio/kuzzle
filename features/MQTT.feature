Feature: Test MQTT API
  As a user
  I want to create/update/delete/search a document and test bulk import
  Using MQTT API

  @usingMQTT
  Scenario: Get server information
    When I get server informations
    Then I can retrieve the Kuzzle API version

  @usingMQTT
  Scenario: Publish a realtime message
    When I publish a message
    Then I should receive a request id
    Then I'm not able to get the document

  @usingMQTT
  Scenario: Create a new document and get it
    When I write the document
    Then I should receive a document id
    Then I'm able to get the document
    And I'm not able to get the document in index "kuzzle-test-index-alt"

  @usingMQTT @unsubscribe
  Scenario: Create or Update a document
    Given A room subscription listening to "lastName" having value "Hopper"
    When I write the document "documentGrace"
    And I createOrReplace it
    Then I should have updated the document
    And I should receive a "update" notification
    And The notification should have metadata

  @usingMQTT
  Scenario: Replace a document
    When I write the document "documentGrace"
    Then I replace the document with "documentAda" document
    Then my document has the value "Ada" in field "firstName"

  @usingMQTT
  Scenario: Update a document
    When I write the document
    Then I update the document with value "foo" in field "firstName"
    Then my document has the value "foo" in field "firstName"

  @usingMQTT
  Scenario: Delete a document
    When I write the document
    Then I remove the document
    Then I'm not able to get the document

  @usingMQTT
  Scenario: Search a document
    When I write the document "documentGrace"
    And I refresh the index
    Then I find a document with "grace" in field "firstName"
    And I don't find a document with "grace" in field "firstName" in index "kuzzle-test-index-alt"

  @usingMQTT
  Scenario: Bulk import
    When I do a bulk import
    Then I can retrieve actions from bulk import

  @usingMQTT
  Scenario: Global Bulk import
    When I do a global bulk import
    Then I can retrieve actions from bulk import

  @usingMQTT
  Scenario: Truncate collection
    When I write the document
    Then I refresh the index
    Then I truncate the collection
    Then I'm not able to get the document

  @usingMQTT
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

  @removeSchema @usingMQTT
  Scenario: Change mapping
    When I write the document "documentGrace"
    Then I don't find a document with "Grace" in field "firstName"
    Then I change the schema
    When I write the document "documentGrace"
    And I refresh the index
    Then I find a document with "Grace" in field "newFirstName"

  @usingMQTT @unsubscribe
  Scenario: Document creation notifications
    Given A room subscription listening to "lastName" having value "Hopper"
    When I write the document "documentGrace"
    Then I should receive a "create" notification
    And The notification should have a "_source" member
    And The notification should have metadata

  @usingMQTT @unsubscribe
  Scenario: Document delete notifications
    Given A room subscription listening to "lastName" having value "Hopper"
    When I write the document "documentGrace"
    Then I remove the document
    Then I should receive a "delete" notification
    And The notification should not have a "_source" member
    And The notification should have metadata

  @usingMQTT @unsubscribe
  Scenario: Document update: new document notification
    Given A room subscription listening to "lastName" having value "Hopper"
    When I write the document "documentAda"
    Then I update the document with value "Hopper" in field "lastName"
    Then I should receive a "update" notification
    And The notification should have a "_source" member
    And The notification should have metadata

  @usingMQTT @unsubscribe
  Scenario: Document update: removed document notification
    Given A room subscription listening to "lastName" having value "Hopper"
    When I write the document "documentGrace"
    Then I update the document with value "Foo" in field "lastName"
    Then I should receive a "update" notification
    And The notification should not have a "_source" member
    And The notification should have metadata

  @usingMQTT @unsubscribe
  Scenario: Document replace: new document notification
    Given A room subscription listening to "lastName" having value "Hopper"
    When I write the document "documentAda"
    Then I replace the document with "documentGrace" document
    Then I should receive a "update" notification
    And The notification should have a "_source" member
    And The notification should have metadata

  @usingMQTT @unsubscribe
  Scenario: Document replace: removed document notification
    Given A room subscription listening to "lastName" having value "Hopper"
    When I write the document "documentGrace"
    Then I replace the document with "documentAda" document
    Then I should receive a "update" notification
    And The notification should not have a "_source" member
    And The notification should have metadata

  @usingMQTT @unsubscribe
  Scenario: Document creation notifications with not exists
    Given A room subscription listening field "toto" doesn't exists
    When I write the document "documentGrace"
    Then I should receive a "create" notification
    And The notification should have a "_source" member
    And The notification should have metadata

  @usingMQTT @unsubscribe
  Scenario: Subscribe to a collection
    Given A room subscription listening to the whole collection
    When I write the document "documentGrace"
    Then I should receive a "create" notification
    And The notification should have a "_source" member
    And The notification should have metadata

  @usingMQTT @unsubscribe
  Scenario: Delete a document with a query
    Given A room subscription listening to "lastName" having value "Hopper"
    When I write the document "documentGrace"
    And I write the document "documentAda"
    And I refresh the index
    Then I remove documents with field "hobby" equals to value "computer"
    Then I should receive a "delete" notification
    And The notification should not have a "_source" member
    And The notification should have metadata

  @usingMQTT @unsubscribe
  Scenario: Count how many subscription on a room
    Given A room subscription listening to "lastName" having value "Hopper"
    Given A room subscription listening to "lastName" having value "Hopper"
    Then I can count "2" subscription

  @usingMQTT @unsubscribe
  Scenario: Subscription notifications
    Given A room subscription listening to "lastName" having value "Hopper"
    Given A room subscription listening to "lastName" having value "Hopper"
    Then I should receive a "on" notification
    And The notification should have metadata
    Then I unsubscribe
    And I should receive a "off" notification
    And The notification should have metadata

  @usingMQTT
  Scenario: Getting the last statistics frame
    When I get the last statistics frame
    Then I get at least 1 statistic frame

  @usingMQTT
  Scenario: Getting the statistics frame from a date
    When I get the statistics frame from a date
    Then I get at least 1 statistic frame

  @usingMQTT
  Scenario: Getting all statistics frame
    When I get all statistics frames
    Then I get at least 1 statistic frame

  @usingMQTT
  Scenario: list known stored collections
    When I write the document "documentGrace"
    And I list "stored" data collections
    Then I can find a stored collection kuzzle-collection-test

  @usingMQTT @unsubscribe
  Scenario: list known realtime collections
    Given A room subscription listening to "lastName" having value "Hopper"
    When I list "realtime" data collections
    Then I can find a realtime collection kuzzle-collection-test

  @usingMQTT
  Scenario: get the Kuzzle timestamp
    When I get the server timestamp
    Then I can read the timestamp

  @usingMQTT @unsubscribe
  Scenario: get list of subscriptions
    Given A room subscription listening to "lastName" having value "Hopper"
    And I get the list subscriptions
    Then In my list there is a collection "kuzzle-collection-test" with 1 room and 1 subscriber

  @usingMQTT @unsubscribe
  Scenario: remove a specific room in subscriptions
    Given A room subscription listening to "lastName" having value "Hopper"
    Given A room subscription listening to "firstName" having value "Grace"
    And I get the list subscriptions
    Then In my list there is a collection "kuzzle-collection-test" with 2 room and 2 subscriber
    When I remove the first room
    And I get the list subscriptions
    Then In my list there is a collection "kuzzle-collection-test" with 1 room and 1 subscriber

  @usingMQTT
  Scenario: create additional index
    When I create an index named "kuzzle-test-index-new"
    Then I'm able to find the index named "kuzzle-test-index-new" in index list
    Then I'm not able to find the index named "my-undefined-index" in index list
    Then I'm able to delete the index named "kuzzle-test-index-new"

  @usingMQTT @cleanSecurity
  Scenario: login user
    Given I create a user "useradmin" with id "useradmin-id"
    When I log in as useradmin-id:testpwd expiring in 1h
    Then I write the document
    Then I check the JWT Token
    And The token is valid
    Then I logout
    Then I can't write the document
    Then I check the JWT Token
    And The token is invalid

  @usingMQTT @cleanSecurity
  Scenario: Create/get/search/update/delete role
    When I create a new role "role1" with id "test"
    Then I'm able to find a role with id "test"
    And I update the role with id "test" with role "role2"
    Then I'm able to find a role with id "test" with role "role2"
    Then I'm able to find "1" role by searching controller corresponding to role "role2"
    And I delete the role with id "test"
    Then I'm not able to find a role with id "test"
    Then I create a new role "role1" with id "test"
    And I create a new role "role1" with id "test2"
    And I create a new role "role1" with id "test3"
    Then I'm able to do a multi get with "test,test2,test3" and get "3" roles
    Then I'm able to find "3" role by searching controller corresponding to role "role1"
    Then I'm able to find "1" role by searching controller corresponding to role "role1" from "0" to "1"

  @usingMQTT @cleanSecurity
  Scenario: create an invalid profile with unexisting role triggers an error
    Then I cannot create an invalid profile

  @usingMQTT @cleanSecurity
  Scenario: get profile without id triggers an error
    Then I cannot a profile without ID

  @usingMQTT @cleanSecurity
  Scenario: creating a profile with an empty set of roles triggers an error
    Then I cannot create a profile with an empty set of roles

  @usingMQTT @cleanSecurity
  Scenario: create, get and delete a profile
    Given I create a new role "role1" with id "role1"
    And I create a new role "role2" with id "role2"
    When I create a new profile "profile1" with id "my-new-profile"
    Then I'm able to find the profile with id "my-new-profile"
    Given I delete the profile with id "my-new-profile"
    Then I'm not able to find the profile with id "my-new-profile"

  @usingMQTT @cleanSecurity
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

  @usingMQTT @cleanSecurity
  Scenario: user crudl
    When I create a new role "role1" with id "role1"
    And I create a new role "role2" with id "role2"
    And I create a new profile "profile2" with id "profile2"
    And I create a new user "useradmin" with id "useradmin-id"
    And I create a user "user2" with id "user2-id"
    And I can't create a new user "user2" with id "useradmin-id"
    Then I am able to get the user "useradmin-id" matching {"_id":"#prefix#useradmin-id","_source":{"profile":{"_id":"admin", "_source": {"roles":[{"_id":"admin"}]}}}}
    Then I am able to get the user "user2-id" matching {"_id":"#prefix#user2-id","_source":{"profile":{"_id":"#prefix#profile2"}}}
    Then I search for {"regexp":{"_uid":"users.#prefix#.*"}} and find 2 users
    Then I delete the user "user2-id"
    Then I search for {"regexp":{"_uid":"users.#prefix#.*"}} and find 1 users matching {"_id":"#prefix#useradmin-id","_source":{"name":{"first":"David","last":"Bowie"}}}
    When I log in as useradmin-id:testpwd expiring in 1h
    Then I am getting the current user, which matches {"_id":"#prefix#useradmin-id","_source":{"profile":{"_id":"admin"}}}
    Then I log out
    Then I am getting the current user, which matches {"_id":-1,"_source":{"profile":{"_id":"anonymous"}}}

  @usingMQTT @cleanSecurity
  Scenario: user updateSelf
    When I create a new user "useradmin" with id "useradmin-id"
    Then I am able to get the user "useradmin-id" matching {"_id":"#prefix#useradmin-id","_source":{"profile":{"_id":"admin", "_source": {"roles":[{"_id":"admin"}]}}}}
    When I log in as useradmin-id:testpwd expiring in 1h
    Then I am getting the current user, which matches {"_id":"#prefix#useradmin-id","_source":{"profile":{"_id":"admin"}}}
    Then I update current user with data {"foo":"bar"}
    Then I am getting the current user, which matches {"_id":"#prefix#useradmin-id","_source":{"profile":{"_id":"admin"},"foo":"bar"}}
    Then I log out
    Then I am getting the current user, which matches {"_id":-1,"_source":{"profile":{"_id":"anonymous"}}}

  @usingMQTT @cleanSecurity
  Scenario: user permissions
    Given I create a new role "role1" with id "role1"
    And I create a new role "role2" with id "role2"
    And I create a new role "role3" with id "role3"
    And I create a new profile "profile1" with id "profile1"
    And I create a new profile "profile2" with id "profile2"
    And I create a new profile "profile3" with id "profile3"
    And I create a new profile "profile4" with id "profile4"
    And I create a new profile "profile5" with id "profile5"
    And I create a new profile "profile6" with id "profile6"
    And I create a new user "user1" with id "user1-id"
    And I create a new user "user2" with id "user2-id"
    And I create a new user "user3" with id "user3-id"
    And I create a new user "user4" with id "user4-id"
    And I create a new user "user5" with id "user5-id"
    And I create a new user "user6" with id "user6-id"
    When I log in as user1-id:testpwd1 expiring in 1h
    Then I'm allowed to create a document in index "kuzzle-test-index" and collection "kuzzle-collection-test"
    And I'm allowed to create a document in index "kuzzle-test-index" and collection "kuzzle-collection-test-alt"
    And I'm allowed to create a document in index "kuzzle-test-index-alt" and collection "kuzzle-collection-test"
    And I'm allowed to create a document in index "kuzzle-test-index-alt" and collection "kuzzle-collection-test-alt"
    And I'm allowed to search for documents in index "kuzzle-test-index" and collection "kuzzle-collection-test"
    And I'm allowed to search for documents in index "kuzzle-test-index" and collection "kuzzle-collection-test-alt"
    And I'm allowed to search for documents in index "kuzzle-test-index-alt" and collection "kuzzle-collection-test"
    And I'm allowed to search for documents in index "kuzzle-test-index-alt" and collection "kuzzle-collection-test-alt"
    And I'm allowed to count documents in index "kuzzle-test-index" and collection "kuzzle-collection-test"
    And I'm allowed to count documents in index "kuzzle-test-index" and collection "kuzzle-collection-test-alt"
    And I'm allowed to count documents in index "kuzzle-test-index-alt" and collection "kuzzle-collection-test"
    And I'm allowed to count documents in index "kuzzle-test-index-alt" and collection "kuzzle-collection-test-alt"
    Then I log out
    When I log in as user2-id:testpwd2 expiring in 1h
    Then I'm allowed to create a document in index "kuzzle-test-index" and collection "kuzzle-collection-test"
    And I'm allowed to create a document in index "kuzzle-test-index" and collection "kuzzle-collection-test-alt"
    And I'm not allowed to create a document in index "kuzzle-test-index-alt" and collection "kuzzle-collection-test"
    And I'm not allowed to create a document in index "kuzzle-test-index-alt" and collection "kuzzle-collection-test-alt"
    And I'm allowed to search for documents in index "kuzzle-test-index" and collection "kuzzle-collection-test"
    And I'm allowed to search for documents in index "kuzzle-test-index" and collection "kuzzle-collection-test-alt"
    And I'm allowed to search for documents in index "kuzzle-test-index-alt" and collection "kuzzle-collection-test"
    And I'm allowed to search for documents in index "kuzzle-test-index-alt" and collection "kuzzle-collection-test-alt"
    And I'm allowed to count documents in index "kuzzle-test-index" and collection "kuzzle-collection-test"
    And I'm allowed to count documents in index "kuzzle-test-index" and collection "kuzzle-collection-test-alt"
    And I'm allowed to count documents in index "kuzzle-test-index-alt" and collection "kuzzle-collection-test"
    And I'm allowed to count documents in index "kuzzle-test-index-alt" and collection "kuzzle-collection-test-alt"
    Then I log out
    When I log in as user3-id:testpwd3 expiring in 1h
    Then I'm not allowed to create a document in index "kuzzle-test-index" and collection "kuzzle-collection-test"
    And I'm not allowed to create a document in index "kuzzle-test-index" and collection "kuzzle-collection-test-alt"
    And I'm not allowed to create a document in index "kuzzle-test-index-alt" and collection "kuzzle-collection-test"
    And I'm not allowed to create a document in index "kuzzle-test-index-alt" and collection "kuzzle-collection-test-alt"
    And I'm not allowed to search for documents in index "kuzzle-test-index" and collection "kuzzle-collection-test"
    And I'm not allowed to search for documents in index "kuzzle-test-index" and collection "kuzzle-collection-test-alt"
    And I'm allowed to search for documents in index "kuzzle-test-index-alt" and collection "kuzzle-collection-test"
    And I'm not allowed to search for documents in index "kuzzle-test-index-alt" and collection "kuzzle-collection-test-alt"
    And I'm not allowed to count documents in index "kuzzle-test-index" and collection "kuzzle-collection-test"
    And I'm not allowed to count documents in index "kuzzle-test-index" and collection "kuzzle-collection-test-alt"
    And I'm allowed to count documents in index "kuzzle-test-index-alt" and collection "kuzzle-collection-test"
    And I'm not allowed to count documents in index "kuzzle-test-index-alt" and collection "kuzzle-collection-test-alt"
    Then I log out
    When I log in as user4-id:testpwd4 expiring in 1h
    Then I'm not allowed to create a document in index "kuzzle-test-index" and collection "kuzzle-collection-test"
    And I'm not allowed to create a document in index "kuzzle-test-index" and collection "kuzzle-collection-test-alt"
    And I'm not allowed to create a document in index "kuzzle-test-index-alt" and collection "kuzzle-collection-test"
    And I'm not allowed to create a document in index "kuzzle-test-index-alt" and collection "kuzzle-collection-test-alt"
    And I'm allowed to search for documents in index "kuzzle-test-index" and collection "kuzzle-collection-test"
    And I'm allowed to search for documents in index "kuzzle-test-index" and collection "kuzzle-collection-test-alt"
    And I'm allowed to search for documents in index "kuzzle-test-index-alt" and collection "kuzzle-collection-test"
    And I'm allowed to search for documents in index "kuzzle-test-index-alt" and collection "kuzzle-collection-test-alt"
    And I'm not allowed to count documents in index "kuzzle-test-index" and collection "kuzzle-collection-test"
    And I'm not allowed to count documents in index "kuzzle-test-index" and collection "kuzzle-collection-test-alt"
    And I'm not allowed to count documents in index "kuzzle-test-index-alt" and collection "kuzzle-collection-test"
    And I'm not allowed to count documents in index "kuzzle-test-index-alt" and collection "kuzzle-collection-test-alt"
    Then I log out
    When I log in as user5-id:testpwd5 expiring in 1h
    Then I'm not allowed to create a document in index "kuzzle-test-index" and collection "kuzzle-collection-test"
    And I'm not allowed to create a document in index "kuzzle-test-index" and collection "kuzzle-collection-test-alt"
    And I'm not allowed to create a document in index "kuzzle-test-index-alt" and collection "kuzzle-collection-test"
    And I'm not allowed to create a document in index "kuzzle-test-index-alt" and collection "kuzzle-collection-test-alt"
    And I'm allowed to search for documents in index "kuzzle-test-index" and collection "kuzzle-collection-test"
    And I'm allowed to search for documents in index "kuzzle-test-index" and collection "kuzzle-collection-test-alt"
    And I'm not allowed to search for documents in index "kuzzle-test-index-alt" and collection "kuzzle-collection-test"
    And I'm not allowed to search for documents in index "kuzzle-test-index-alt" and collection "kuzzle-collection-test-alt"
    And I'm not allowed to count documents in index "kuzzle-test-index" and collection "kuzzle-collection-test"
    And I'm not allowed to count documents in index "kuzzle-test-index" and collection "kuzzle-collection-test-alt"
    And I'm not allowed to count documents in index "kuzzle-test-index-alt" and collection "kuzzle-collection-test"
    And I'm not allowed to count documents in index "kuzzle-test-index-alt" and collection "kuzzle-collection-test-alt"
    Then I log out
    When I log in as user6-id:testpwd6 expiring in 1h
    Then I'm not allowed to create a document in index "kuzzle-test-index" and collection "kuzzle-collection-test"
    And I'm not allowed to create a document in index "kuzzle-test-index" and collection "kuzzle-collection-test-alt"
    And I'm not allowed to create a document in index "kuzzle-test-index-alt" and collection "kuzzle-collection-test"
    And I'm not allowed to create a document in index "kuzzle-test-index-alt" and collection "kuzzle-collection-test-alt"
    And I'm allowed to search for documents in index "kuzzle-test-index" and collection "kuzzle-collection-test"
    And I'm not allowed to search for documents in index "kuzzle-test-index" and collection "kuzzle-collection-test-alt"
    And I'm not allowed to search for documents in index "kuzzle-test-index-alt" and collection "kuzzle-collection-test"
    And I'm not allowed to search for documents in index "kuzzle-test-index-alt" and collection "kuzzle-collection-test-alt"
    And I'm not allowed to count documents in index "kuzzle-test-index" and collection "kuzzle-collection-test"
    And I'm not allowed to count documents in index "kuzzle-test-index" and collection "kuzzle-collection-test-alt"
    And I'm not allowed to count documents in index "kuzzle-test-index-alt" and collection "kuzzle-collection-test"
    And I'm not allowed to count documents in index "kuzzle-test-index-alt" and collection "kuzzle-collection-test-alt"
    Then I log out

  @usingMQTT @cleanRedis
  Scenario: memory storage - misc
    When I call the info method of the memory storage with arguments
      """
      """
    Then The ms result should match the regex ^# Server\r\nredis_version:
    # this test erases the whole index. commented for safety
    # Given I call the set method of the memory storage with arguments
    #  """
    #    { "_id": "#prefix#mykey", "body": { "value": 10 } }
    #  """
    # Then I call the flushdb method of the memory storage with arguments
    #  """
    #    {}
    #  """
    # Then I call the keys method of the memory storage with arguments
    #    """
    #      { "body": { "pattern": "*" } }
    #    """
    # And The ms result should match the json null
    When I call the lastsave method of the memory storage with arguments
      """
      {}
      """
    Then The ms result should match the regex ^\d{10}$

  @usingMQTT @cleanRedis
  Scenario: memory storage - scalars
    Given I call the set method of the memory storage with arguments
      """
      { "_id": "#prefix#mykey", "body": { "value": 999 }}
      """
    Then The ms result should match the json "OK"
    When I call the incrbyfloat method of the memory storage with arguments
      """
      { "_id": "#prefix#mykey", "body": { "value": -0.5 }}
      """
    Then The ms result should match the json "998.5"
    When I call the getset method of the memory storage with arguments
      """
      { "_id": "#prefix#mykey", "body": { "value": 2 }}
      """
    Then The ms result should match the json "998.5"
    When I call the get method of the memory storage with arguments
      """
      { "_id": "#prefix#mykey" }
      """
    Then The ms result should match the json "2"
    When I call the incr method of the memory storage with arguments
      """
      { "_id": "#prefix#mykey" }
      """
    Then The ms result should match the json 3
    When I call the decr method of the memory storage with arguments
      """
      { "_id": "#prefix#mykey" }
      """
    Then The ms result should match the json 2
    When I call the incrby method of the memory storage with arguments
      """
      { "_id": "#prefix#mykey", "body": { "value": 5 }}
      """
    Then The ms result should match the json 7
    When I call the decrby method of the memory storage with arguments
      """
      { "_id": "#prefix#mykey", "body": { "value": 3 }}
      """
    Then The ms result should match the json 4
    When I call the append method of the memory storage with arguments
      """
      { "_id": "#prefix#mykey", "body": "bar" }
      """
    Then The ms result should match the json 4
    When I call the get method of the memory storage with arguments
      """
      { "_id": "#prefix#mykey" }
      """
    Then The ms result should match the json "4bar"
    When I call the getrange method of the memory storage with arguments
      """
      { "_id": "#prefix#mykey", "body": { "start": 1, "end": 2 }}
      """
    Then The ms result should match the json "ba"
    When I call the getbit method of the memory storage with arguments
      """
      { "_id": "#prefix#mykey", "body": { "offset": 3 } }
      """
    Then The ms result should match the json 1
    When I call the del method of the memory storage with arguments
      """
      { "_id": "#prefix#mykey" }
      """
    Then The ms result should match the json 1
    When I call the get method of the memory storage with arguments
      """
      { "_id": "#prefix#mykey" }
      """
    Then The ms result should match the json null
    Given I call the set method of the memory storage with arguments
      """
      { "_id": "#prefix#x", "body": "foobar" }
      """
    And I call the set method of the memory storage with arguments
      """
      { "_id": "#prefix#y", "body": "abcdef" }
      """
    When I call the mget method of the memory storage with arguments
      """
      { "_id": "#prefix#x", "body": { "keys": ["#prefix#y", "nonexisting"]}}
      """
    Then The ms result should match the json ["foobar", "abcdef", null]
    When I call the bitop method of the memory storage with arguments
      """
      { "body": { "operation": "AND", "destkey": "#prefix#dest", "keys": [ "#prefix#x", "#prefix#y" ] } }
      """
    And I call the get method of the memory storage with arguments
      """
      { "_id": "#prefix#dest" }
      """
    Then The ms result should match the json "`bc`ab"
    When I call the bitop method of the memory storage with arguments
      """
      { "body": { "operation": "OR", "destkey": "#prefix#dest", "keys": [ "#prefix#x", "#prefix#y" ] } }
      """
    And I call the get method of the memory storage with arguments
      """
      { "_id": "#prefix#dest" }
      """
    Then The ms result should match the json "goofev"
    When I call the bitpos method of the memory storage with arguments
      """
      { "_id": "#prefix#x", "body": { "bit": 1 } }
      """
    Then The ms result should match the json 1
    Given I call the set method of the memory storage with arguments
      """
      { "_id": "#prefix#mykey", "body": { "value": 10 } }
      """
    When I call the exists method of the memory storage with arguments
      """
      { "_id": "#prefix#mykey", "body": { "keys": [ "i", "dont", "exist" ] } }
      """
    Then The ms result should match the json 1
    When I call the expire method of the memory storage with arguments
      """
      { "_id": "#prefix#mykey", "body": { "seconds": 1 } }
      """
    And I wait 1s
    And I call the get method of the memory storage with arguments
      """
      { "_id": "#prefix#mykey" }
      """
    Then The ms result should match the json null
    Given I call the mset method of the memory storage with arguments
      """
      { "_id": "#prefix#foo", "body": { "value": "bar", "values": ["#prefix#k1", "v1", "#prefix#k2", "v2"] }}
      """
    When I call the mget method of the memory storage with arguments
      """
      { "body": { "keys": [ "#prefix#foo", "#prefix#k2"] } }
      """
    Then The ms result should match the json ["bar", "v2"]
    When I call the msetnx method of the memory storage with arguments
      """
      { "body": { "values": ["#prefix#k1", "v1bis", "#prefix#foo", "barbis"] }}
      """
    Then The ms result should match the json 0
    Given I call the setex method of the memory storage with arguments
      """
      { "_id": "#prefix#foo", "body": { "seconds": 1, "value": "bar" }}
      """
    When I call the persist method of the memory storage with arguments
      """
      { "_id": "#prefix#foo" }
      """
    And I wait 1s
    And I call the get method of the memory storage with arguments
      """
      { "_id": "#prefix#foo" }
      """
    Then The ms result should match the json "bar"
    When I call the pexpire method of the memory storage with arguments
      """
      { "_id": "#prefix#foo", "body": { "milliseconds": 500 }}
      """
    And I wait 1s
    And I call the get method of the memory storage with arguments
      """
      { "_id": "#prefix#foo" }
      """
    Then The ms result should match the json null
    Given I call the psetex method of the memory storage with arguments
      """
      { "_id": "#prefix#foo", "body": { "milliseconds": 999, "value": "bar" }}
      """
    When I call the pttl method of the memory storage with arguments
      """
      { "_id": "#prefix#foo" }
      """
    Then The ms result should match the regex \d\d\d
    When I call the randomkey method of the memory storage with arguments
      """
      {}
      """
    Then The ms result should match the regex .+
    Given I call the set method of the memory storage with arguments
      """
      { "_id": "#prefix#foo", "body": "bar" }
      """
    And I call the rename method of the memory storage with arguments
      """
      { "_id": "#prefix#foo", "body": { "newkey": "#prefix#bar" } }
      """
    When I call the get method of the memory storage with arguments
      """
      { "_id": "#prefix#bar" }
      """
    Then The ms result should match the json "bar"
    When I call the renamenx method of the memory storage with arguments
      """
      { "_id": "#prefix#bar", "body": { "newkey": "#prefix#x" } }
      """
    Then The ms result should match the json 0
    Given I call the set method of the memory storage with arguments
      """
      { "_id": "#prefix#foo", "body": "Hello World" }
      """
    And I call the setrange method of the memory storage with arguments
      """
      { "_id": "#prefix#foo", "body": { "offset": 6, "value": "Kuzzle" }}
      """
    When I call the get method of the memory storage with arguments
      """
      { "_id": "#prefix#foo" }
      """
    Then The ms result should match the json "Hello Kuzzle"
    Given I call the set method of the memory storage with arguments
      """
      {
        "_id": "#prefix#mykey",
        "body": "Your base are belong to us"
      }
      """
    When I call the strlen method of the memory storage with arguments
      """
      { "_id": "#prefix#mykey" }
      """
    Then The ms result should match the json 26
    Given I call the setex method of the memory storage with arguments
      """
      {
        "_id": "#prefix#mykey",
        "body": {
          "seconds": 99,
          "value": "test"
        }
      }
      """
    When I call the ttl method of the memory storage with arguments
      """
      { "_id": "#prefix#mykey" }
      """
    Then The ms result should match the regex ^9[5-9]$

  @usingMQTT @cleanRedis
  Scenario: memory storage - lists
    Given I call the rpush method of the memory storage with arguments
      """
      { "_id": "#prefix#list", "body": { "value": 1, "values": [ "abcd", 5 ] }}
      """
    Then The ms result should match the json 3
    When I call the lindex method of the memory storage with arguments
      """
      { "_id": "#prefix#list", "body": { "idx": 1 } }
      """
    Then The ms result should match the json "abcd"
    When I call the linsert method of the memory storage with arguments
      """
      { "_id": "#prefix#list", "body": { "position": "BEFORE", "pivot": 5, "value": "inserted" } }
      """
    Then The ms result should match the json 4
    When I call the lrange method of the memory storage with arguments
      """
       { "_id": "#prefix#list", "body": { "start": 2, "stop": 3  } }
      """
    And The ms result should match the json [ "inserted", "5" ]
    When I call the llen method of the memory storage with arguments
      """
      { "_id": "#prefix#list"}
      """
    Then The ms result should match the json 4
    When I call the lpop method of the memory storage with arguments
      """
      { "_id": "#prefix#list" }
      """
    Then The ms result should match the json "1"
    When I call the llen method of the memory storage with arguments
      """
      { "_id": "#prefix#list"}
      """
    Then The ms result should match the json 3
    Given I call the lpush method of the memory storage with arguments
      """
      { "_id": "#prefix#list", "body": { "value": "first" }}
      """
    When I call the lindex method of the memory storage with arguments
      """
      { "_id": "#prefix#list", "body": { "idx": 0 } }
      """
    Then The ms result should match the json "first"
    When I call the lpushx method of the memory storage with arguments
      """
      { "_id": "idontexist", "body": { "value": "first" }}
      """
    Then The ms result should match the json 0
    Given I call the rpush method of the memory storage with arguments
      """
      { "_id": "#prefix#list", "body": { "values": [ "hello", "hello", "foo", "hello" ] }}
      """
    When I call the lrem method of the memory storage with arguments
      """
      {"_id": "#prefix#list", "body": { "count": -2, "value": "hello" }}
      """
    And I call the lrange method of the memory storage with arguments
      """
      { "_id": "#prefix#list", "body": { "start": 0, "stop": -1  } }
      """
    Then The ms result should match the json ["first", "abcd", "inserted", "5", "hello", "foo"]
    Given I call the lset method of the memory storage with arguments
      """
      {"_id": "#prefix#list", "body": { "idx": 1, "value": "replaced"}}
      """
    When I call the lindex method of the memory storage with arguments
      """
      {"_id": "#prefix#list", "body": {"idx": 1}}
      """
    Then The ms result should match the json "replaced"
    Given I call the ltrim method of the memory storage with arguments
      """
      {"_id": "#prefix#list", "body": { "start": 2, "stop": 3 }}
      """
    When I call the lrange method of the memory storage with arguments
      """
      { "_id": "#prefix#list", "body": { "start": 0, "stop": -1  } }
      """
    Then The ms result should match the json ["inserted", "5"]
    When I call the rpop method of the memory storage with arguments
      """
      { "_id": "#prefix#list" }
      """
    Then The ms result should match the json "5"
    When I call the rpoplpush method of the memory storage with arguments
      """
      { "body": { "source": "#prefix#list", "destination": "#prefix#list2" }}
      """
    Then The ms result should match the json "inserted"
    Given I call the del method of the memory storage with arguments
      """
      { "_id": "#prefix#list" }
      """
    And I call the rpush method of the memory storage with arguments
      """
      { "_id": "#prefix#list", "body": { "values": [ 1, 2, 3 ] } }
      """
    And I call the mset method of the memory storage with arguments
      """
      {
        "body": {
          "values": [
            "#prefix#o_1",
            "object1",
            "#prefix#o_2",
            "object2",
            "#prefix#o_3",
            "object3",
            "#prefix#w_1",
            2,
            "#prefix#w_2",
            3,
            "#prefix#w_3",
            1
          ]
        }
      }
      """
    When I call the sort method of the memory storage with arguments
      """
      {
        "_id": "#prefix#list",
        "body": {
          "by": "#prefix#w_*",
          "get": "#prefix#o_*",
          "direction": "DESC"
        }
      }
      """
    Then The ms result should match the json ["object2", "object1", "object3"]
    When I call the type method of the memory storage with arguments
      """
      { "_id": "#prefix#list" }
      """
    Then The ms result should match the json "list"

  @usingMQTT @cleanRedis
  Scenario: memory storage - hash
    Given I call the hset method of the memory storage with arguments
      """
      {"_id": "#prefix#hash", "body": { "field": "foo", "value": "bar" }}
      """
    And I call the hmset method of the memory storage with arguments
      """
      {"_id":"#prefix#hash","body":{"values":["k1","v1","k2","v2","k3","v3","k4",10]}}
      """
    When I call the hdel method of the memory storage with arguments
      """
      {"_id":"#prefix#hash", "body": { "field": "k3" } }
      """
    Then The ms result should match the json 1
    When I call the hget method of the memory storage with arguments
      """
      { "_id": "#prefix#hash", "body": { "field": "foo" }}
      """
    Then The ms result should match the json "bar"
    When I call the hgetall method of the memory storage with arguments
      """
      { "_id": "#prefix#hash" }
      """
    Then The ms result should match the json {"foo": "bar", "k1": "v1", "k2": "v2", "k4": "10"}
    When I call the hsetnx method of the memory storage with arguments
      """
      { "_id": "#prefix#hash", "body": { "field": "foo", "value": "bar2" }}
      """
    Then The ms result should match the json 0
    # redis 3.2+ only
    # When I call the hstrlen method of the memory storage with arguments
    #    """
    #    { "_id": "#prefix#hash", "body": { "field": "foo" }}
    #    """
    # Then The ms result should match the json 3
    When I call the hvals method of the memory storage with arguments
      """
      { "_id": "#prefix#hash" }
      """
    Then The ms result should match the json ["bar", "v1", "v2", "10"]
    When I call the hincrby method of the memory storage with arguments
      """
      { "_id": "#prefix#hash", "body": { "field": "k4", "value": 5 }}
      """
    Then The ms result should match the json 15
    When I call the hincrbyfloat method of the memory storage with arguments
      """
      { "_id": "#prefix#hash", "body": { "field": "k4", "value": 2.5 }}
      """
    Then The ms result should match the json "17.5"

  @usingMQTT @cleanRedis
  Scenario: memory storage - sets
    Given I call the sadd method of the memory storage with arguments
      """
      { "_id": "#prefix#set", "body": { "member": "foobar", "members": [ "v1", 5, 10, 10] }}
      """
    Then The ms result should match the json 4
    When I call the scard method of the memory storage with arguments
      """
      {"_id": "#prefix#set"}
      """
    Then The ms result should match the json 4
    When I call the sadd method of the memory storage with arguments
      """
      {"_id": "#prefix#set1", "body": { "members": [ "a", "b", "c" ]  }}
      """
    Given I call the sadd method of the memory storage with arguments
      """
      {"_id": "#prefix#set2", "body": { "members": [ "c", "d", "e" ]  }}
      """
    When I call the sdiff method of the memory storage with arguments
      """
      { "_id": "#prefix#set2", "body": { "keys": [ "#prefix#set1"] }}
      """
    Then The sorted ms result should match the json ["d", "e"]
    Given I call the sdiffstore method of the memory storage with arguments
      """
      { "_id": "#prefix#set2", "body": { "destination": "#prefix#set3" , "keys": [ "#prefix#set1"] }}
      """
    When I call the smembers method of the memory storage with arguments
      """
      { "_id": "#prefix#set3" }
      """
    Then The sorted ms result should match the json ["d", "e"]
    When I call the sinter method of the memory storage with arguments
      """
      { "_id": "#prefix#set1", "body": { "keys": ["#prefix#set2"] }}
      """
    Then The ms result should match the json ["c"]
    Given I call the sinterstore method of the memory storage with arguments
      """
      { "_id": "#prefix#set1", "body": { "destination": "#prefix#set3", "keys": ["#prefix#set2"] }}
      """
    When I call the smembers method of the memory storage with arguments
      """
      { "_id": "#prefix#set3" }
      """
    Then The ms result should match the json ["c"]
    When I call the sunion method of the memory storage with arguments
      """
      { "_id": "#prefix#set1", "body": { "keys": ["#prefix#set2"] }}
      """
    Then The sorted ms result should match the json ["a", "b", "c", "d", "e"]
    Given I call the sunionstore method of the memory storage with arguments
      """
      { "_id": "#prefix#set1", "body": { "destination": "#prefix#set3", "keys": ["#prefix#set2"] }}
      """
    When I call the smembers method of the memory storage with arguments
      """
      { "_id": "#prefix#set3" }
      """
    Then The sorted ms result should match the json ["a", "b", "c", "d", "e"]
    When I call the sismember method of the memory storage with arguments
      """
      {"_id": "#prefix#set", "body": { "member": 10 } }
      """
    Then The ms result should match the json 1
    Given I call the smove method of the memory storage with arguments
      """
      { "_id": "#prefix#set", "body": { "destination": "#prefix#set3", "member": 5 }}
      """
    When I call the smembers method of the memory storage with arguments
      """
      { "_id": "#prefix#set3" }
      """
    Then The sorted ms result should match the json ["5", "a", "b", "c", "d", "e"]
    When I call the sort method of the memory storage with arguments
      """
      {"_id": "#prefix#set1", "body": {"alpha": true}}
      """
    Then The ms result should match the json ["a", "b", "c"]
    Given I call the del method of the memory storage with arguments
      """
      { "_id": "#prefix#set" }
      """
    And I call the sadd method of the memory storage with arguments
      """
      { "_id": "#prefix#set", "body": { "members": [99, 54, 23] } }
      """
    When I call the sort method of the memory storage with arguments
      """
      { "_id": "#prefix#set"}
      """
    Then The ms result should match the json ["23", "54", "99"]
    When I call the sort method of the memory storage with arguments
      """
      { "_id": "#prefix#set", "body": { "offset": 1, "count": 2, "direction": "DESC" }}
      """
    Then The ms result should match the json ["54", "23"]
    When I call the srandmember method of the memory storage with arguments
      """
      { "_id": "#prefix#set" }
      """
    Then The ms result should match the regex ^(23|54|99)$
    When I call the spop method of the memory storage with arguments
      """
      { "_id": "#prefix#set" }
      """
    Then The ms result should match the regex ^(23|54|99)$
    Given I call the srem method of the memory storage with arguments
      """
      {
        "_id": "#prefix#set",
        "body": {
          "member": 54,
          "members": [ 23, 99 ]
        }
      }
      """
    When I call the smembers method of the memory storage with arguments
      """
      { "_id": "#prefix#set" }
      """
    Then The ms result should match the json []

  @usingMQTT @cleanRedis
  Scenario: memory storage - sorted sets
    Given I call the zadd method of the memory storage with arguments
      """
      {
        "_id": "#prefix#zset",
        "body": {
          "score": 1,
          "member": "one",
          "values": [
            { "score": 1, "member": "uno" },
            { "score": 3, "member": "three" },
            { "score": 2, "member": "two" }
          ]
        }
      }
      """
    When I call the zrange method of the memory storage with arguments
      """
      {
        "_id": "#prefix#zset",
        "body": {
          "start": 0,
          "stop": -1,
          "withscores": true
        }
      }
      """
    Then The ms result should match the json ["one", "1", "uno", "1", "two", "2", "three", "3"]
    When I call the zcard method of the memory storage with arguments
      """
      { "_id": "#prefix#zset" }
      """
    Then The ms result should match the json 4
    When I call the zcount method of the memory storage with arguments
      """
      {
        "_id": "#prefix#zset",
        "body": {
          "min": "(1",
          "max": 3
        }
      }
      """
    Then The ms result should match the json 2
    When I call the zincrby method of the memory storage with arguments
      """
      {
        "_id": "#prefix#zset",
        "body": {
          "member": "two",
          "value": 2
        }
      }
      """
    And I call the zrange method of the memory storage with arguments
      """
      {
        "_id": "#prefix#zset",
        "body": {
          "start": 0,
          "stop": -1,
          "withscores": true
        }
      }
      """
    Then The ms result should match the json ["one", "1", "uno", "1", "three", "3", "two", "4"]
    Given I call the zadd method of the memory storage with arguments
      """
      {
        "_id": "#prefix#zset2",
        "body": {
          "values": [
            { "score": 2, "member": "two" },
            { "score": 1, "member": "uno" }
          ]
        }
      }
      """
    And I call the zinterstore method of the memory storage with arguments
      """
      {
        "body": {
          "destination": "#prefix#zset3",
          "keys": [ "#prefix#zset", "#prefix#zset2" ],
          "weights": [ 2, 1 ],
          "aggregate": "max"
        }
      }
      """
    When I call the zrange method of the memory storage with arguments
      """
      {
        "_id": "#prefix#zset3",
        "body": { "start": 0, "stop": -1, "withscores": true }
      }
      """
    Then The ms result should match the json ["uno", "2", "two", "8"]
    Given I call the zunionstore method of the memory storage with arguments
      """
      {
        "body": {
          "destination": "#prefix#zset3",
          "keys": [ "#prefix#zset", "#prefix#zset2" ],
          "weights": [ 2, 1 ],
          "aggregate": "max"
        }
      }
      """
    When I call the zrange method of the memory storage with arguments
      """
      {
        "_id": "#prefix#zset3",
        "body": { "start": 0, "stop": -1, "withscores": true }
      }
      """
    Then The ms result should match the json ["one","2","uno","2","three","6","two","8"]
    Given I call the del method of the memory storage with arguments
      """
      { "_id": "#prefix#zset" }
      """
    And I call the zadd method of the memory storage with arguments
      """
      {
        "_id": "#prefix#zset",
        "body": {
          "values": [
            { "score": 0, "member": "zero" },
            { "score": 0, "member": "one" },
            { "score": 0, "member": "two" },
            { "score": 0, "member": "three" },
            { "score": 0, "member": "four" },
            { "score": 0, "member": "five" }
          ]
        }
      }
      """
    When I call the zrangebylex method of the memory storage with arguments
      """
      {
        "_id": "#prefix#zset",
        "body": {
          "min": "[o",
          "max": "(v"
        }
      }
      """
    Then The ms result should match the json ["one", "three", "two"]
    When I call the zrevrangebylex method of the memory storage with arguments
      """
      {
        "_id": "#prefix#zset",
        "body": {
          "min": "[o",
          "max": "(v"
        }
      }
      """
    Then The ms result should match the json ["two", "three", "one"]
    When I call the zremrangebylex method of the memory storage with arguments
      """
      {
        "_id": "#prefix#zset",
        "body": {
          "min": "[o",
          "max": "(v"
        }
      }
      """
    And I call the zrange method of the memory storage with arguments
      """
      {
        "_id": "#prefix#zset",
        "body": { "start": 0, "stop": -1 }
      }
      """
    Then The ms result should match the json ["five","four","zero"]
    Given I call the del method of the memory storage with arguments
      """
      { "_id": "#prefix#zset" }
      """
    And I call the zadd method of the memory storage with arguments
      """
      {
        "_id": "#prefix#zset",
        "body": {
          "values": [
            { "score": 0, "member": "zero" },
            { "score": 1, "member": "one" },
            { "score": 2, "member": "two" },
            { "score": 3, "member": "three" },
            { "score": 4, "member": "four" }
          ]
        }
      }
      """
    When I call the zrangebyscore method of the memory storage with arguments
      """
      {
        "_id": "#prefix#zset",
        "body": {
          "min": "(0",
          "max": "3",
          "offset": 1,
          "count": 5,
          "withscores": true
        }
      }
      """
    Then The ms result should match the json ["two", "2", "three", "3"]
    When I call the zrevrangebyscore method of the memory storage with arguments
      """
      {
        "_id": "#prefix#zset",
        "body": {
          "min": "(0",
          "max": "3",
          "offset": 1,
          "count": 5,
          "withscores": true
        }
      }
      """
    Then The ms result should match the json ["two", "2", "one", "1"]
    When I call the zscore method of the memory storage with arguments
      """
      { "_id": "#prefix#zset", "body": { "member": "two" } }
      """
    Then The ms result should match the json "2"
    When I call the zrem method of the memory storage with arguments
      """
      { "_id": "#prefix#zset", "body": { "member": "two" } }
      """
    And I call the zrange method of the memory storage with arguments
      """
      {
        "_id": "#prefix#zset",
        "body": { "start": 0, "stop": -1, "withscores": true }
      }
      """
    Then The ms result should match the json ["zero", "0", "one", "1", "three", "3", "four", "4"]
    Given I call the zadd method of the memory storage with arguments
      """
      { "_id": "#prefix#zset", "body": { "score": 2, "member": "two" } }
      """
    When I call the zremrangebyscore method of the memory storage with arguments
      """
      {
        "_id": "#prefix#zset",
        "body": {
          "min": "(1",
          "max": "3"
        }
      }
      """
    And I call the zrange method of the memory storage with arguments
      """
      {
        "_id": "#prefix#zset",
        "body": { "start": 0, "stop": -1, "withscores": true }
      }
      """
    Then The ms result should match the json ["zero", "0", "one", "1", "four", "4"]

  @usingMQTT @cleanRedis
  Scenario: memory storage - hyperloglog

    Given I call the pfadd method of the memory storage with arguments
      """
      {
        "_id": "#prefix#hll",
        "body": {
          "element": "a",
          "elements": [ "b", "c", "d", "e", "f", "g" ]
        }
      }
      """
    Then The ms result should match the json 1
    When I call the pfadd method of the memory storage with arguments
      """
      {
        "_id": "#prefix#hll",
        "body": {
          "element": "a",
          "elements": [ "b", "f", "g" ]
        }
      }
      """
    Then The ms result should match the json 0
    When I call the pfcount method of the memory storage with arguments
      """
      { "_id": "#prefix#hll" }
      """
    Then The ms result should match the json 7
    Given I call the pfadd method of the memory storage with arguments
      """
      {
        "_id": "#prefix#hll2",
        "body": {
          "elements": [
            "z", "y", "x", "w",
            "a", "b", "c"
          ]
        }
      }
      """
    When I call the pfcount method of the memory storage with arguments
      """
      { "body": { "keys": [ "#prefix#hll", "#prefix#hll2"] } }
      """
    Then The ms result should match the json 11
    When I call the pfmerge method of the memory storage with arguments
      """
      {
        "body": {
          "destkey": "#prefix#hll3",
          "sourcekeys": [ "#prefix#hll", "#prefix#hll2" ]
        }
      }
      """
    And I call the pfcount method of the memory storage with arguments
      """
      { "_id": "#prefix#hll3" }
      """
    Then The ms result should match the json 11

  @usingMQTT
  Scenario: autorefresh
    When I check the autoRefresh status
    Then The result should match the json false
    When I write the document "documentGrace"
    Then I don't find a document with "grace" in field "firstName"
    Given I refresh the index
    And I enable the autoRefresh
    And I truncate the collection
    When I write the document "documentGrace"
    Then I find a document with "grace" in field "firstName"
    When I check the autoRefresh status
    Then The result should match the json true
    Given I truncate the collection
    And I write the document "documentGrace"
    When I update the document with value "Josepha" in field "firstName"
    Then I find a document with "josepha" in field "firstName"
