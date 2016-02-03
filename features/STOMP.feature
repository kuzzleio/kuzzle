Feature: Test STOMP API
  As a user
  I want to create/update/delete/search a document and test bulk import
  Using STOMP API

  @usingSTOMP
  Scenario: Get server information
    When I get server informations
    Then I can retrieve the Kuzzle API version

  @usingSTOMP
  Scenario: Publish a realtime message
    When I publish a message
    Then I should receive a request id
    Then I'm not able to get the document

  @usingSTOMP
  Scenario: Create a new document and get it
    When I write the document
    Then I should receive a document id
    Then I'm able to get the document
    And I'm not able to get the document in index "index-test-alt"

  @usingSTOMP
  Scenario: Replace a document
    When I write the document "documentGrace"
    Then I replace the document with "documentAda" document
    Then my document has the value "Ada" in field "firstName"

  @usingSTOMP @unsubscribe
  Scenario: Create or Update a document
    Given A room subscription listening to "lastName" having value "Hopper"
    When I write the document "documentGrace"
    And I createOrReplace it
    Then I should have updated the document
    And I should receive a "update" notification
    And The notification should have metadata

  @usingSTOMP
  Scenario: Update a document
    When I write the document
    Then I update the document with value "foo" in field "firstName"
    Then my document has the value "foo" in field "firstName"

  @usingSTOMP
  Scenario: Delete a document
    When I write the document
    Then I remove the document
    Then I'm not able to get the document

  @usingSTOMP
  Scenario: Search a document
    When I write the document "documentGrace"
    And I find a document with "grace" in field "firstName"
    And I don't find a document with "grace" in field "firstName" in index "index-test-alt"

  @usingSTOMP
  Scenario: Bulk import
    When I do a bulk import
    Then I can retrieve actions from bulk import

  @usingSTOMP
  Scenario: Global Bulk import
    When I do a global bulk import
    Then I can retrieve actions from bulk import

  @usingSTOMP
  Scenario: Delete type
    When I write the document
    Then I remove the collection and schema
    Then I'm not able to get the document

  @usingSTOMP
  Scenario: Count document
    When I write the document "documentGrace"
    When I write the document "documentAda"
    When I write the document "documentGrace"
    When I write the document "documentAda"
    Then I count 4 documents
    And I count 0 documents in index "index-test-alt"
    And I count 2 documents with "NYC" in field "city"
    Then I truncate the collection
    And I count 0 documents

  @removeSchema @usingSTOMP
  Scenario: Change mapping
    When I write the document "documentGrace"
    Then I don't find a document with "Grace" in field "firstName"
    Then I remove the collection and schema
    Then I wait 1s
    Then I change the schema
    When I write the document "documentGrace"
    Then I find a document with "Grace" in field "firstName"

  @usingSTOMP @unsubscribe
  Scenario: Document creation notifications
    Given A room subscription listening to "lastName" having value "Hopper"
    When I write the document "documentGrace"
    Then I should receive a "create" notification
    And The notification should have a "_source" member
    And The notification should have metadata

  @usingSTOMP @unsubscribe
  Scenario: Document delete notifications
    Given A room subscription listening to "lastName" having value "Hopper"
    When I write the document "documentGrace"
    Then I remove the document
    Then I should receive a "delete" notification
    And The notification should not have a "_source" member
    And The notification should have metadata

  @usingSTOMP @unsubscribe
  Scenario: Document update: new document notification
    Given A room subscription listening to "lastName" having value "Hopper"
    When I write the document "documentAda"
    Then I update the document with value "Hopper" in field "lastName"
    Then I should receive a "update" notification
    And The notification should have a "_source" member
    And The notification should have metadata

  @usingSTOMP @unsubscribe
  Scenario: Document update: removed document notification
    Given A room subscription listening to "lastName" having value "Hopper"
    When I write the document "documentGrace"
    Then I update the document with value "Foo" in field "lastName"
    Then I should receive a "update" notification
    And The notification should not have a "_source" member
    And The notification should have metadata

  @usingSTOMP @unsubscribe
  Scenario: Document replace: new document notification
    Given A room subscription listening to "lastName" having value "Hopper"
    When I write the document "documentAda"
    Then I replace the document with "documentGrace" document
    Then I should receive a "update" notification
    And The notification should have a "_source" member
    And The notification should have metadata

  @usingSTOMP @unsubscribe
  Scenario: Document replace: removed document notification
    Given A room subscription listening to "lastName" having value "Hopper"
    When I write the document "documentGrace"
    Then I replace the document with "documentAda" document
    Then I should receive a "update" notification
    And The notification should not have a "_source" member
    And The notification should have metadata

  @usingSTOMP @unsubscribe
  Scenario: Document creation notifications with not exists
    Given A room subscription listening field "toto" doesn't exists
    When I write the document "documentGrace"
    Then I should receive a "create" notification
    And The notification should have a "_source" member
    And The notification should have metadata

  @usingSTOMP @unsubscribe
  Scenario: Subscribe to a collection
    Given A room subscription listening to the whole collection
    When I write the document "documentGrace"
    Then I should receive a "create" notification
    And The notification should have a "_source" member
    And The notification should have metadata

  @usingSTOMP @unsubscribe
  Scenario: Delete a document with a query
    Given A room subscription listening to "lastName" having value "Hopper"
    When I write the document "documentGrace"
    And I write the document "documentAda"
    And I wait 1s
    Then I remove documents with field "hobby" equals to value "computer"
    Then I should receive a "delete" notification
    And The notification should not have a "_source" member
    And The notification should have metadata

  @usingSTOMP @unsubscribe
  Scenario: Count how many subscription on a room
    Given A room subscription listening to "lastName" having value "Hopper"
    Given A room subscription listening to "lastName" having value "Hopper"
    Then I can count "2" subscription

  @usingSTOMP @unsubscribe
  Scenario: Subscription notifications
    Given A room subscription listening to "lastName" having value "Hopper"
    Given A room subscription listening to "lastName" having value "Hopper"
    Then I should receive a "on" notification
    And The notification should have metadata
    Then I unsubscribe
    And I should receive a "off" notification
    And The notification should have metadata

  @usingSTOMP
  Scenario: Getting the last statistics frame
    When I get the last statistics frame
    Then I get at least 1 statistic frame

  @usingSTOMP
  Scenario: Getting the statistics frame from a date
    When I get the statistics frame from a date
    Then I get at least 1 statistic frame

  @usingSTOMP
  Scenario: Getting all statistics frame
    When I get all statistics frames
    Then I get at least 1 statistic frame

  @usingSTOMP
  Scenario: list known stored collections
    When I write the document "documentGrace"
    And I list "stored" data collections
    Then I can find a stored collection kuzzle-collection-test

  @usingSTOMP @unsubscribe
  Scenario: list known realtime collections
    Given A room subscription listening to "lastName" having value "Hopper"
    When I list "realtime" data collections
    Then I can find a realtime collection kuzzle-collection-test

  @usingSTOMP
  Scenario: get the Kuzzle timestamp
    When I get the server timestamp
    Then I can read the timestamp

  @usingSTOMP @unsubscribe
  Scenario: get list of subscriptions
    Given A room subscription listening to "lastName" having value "Hopper"
    And I get the list subscriptions
    Then In my list there is a collection "kuzzle-collection-test" with 1 room and 1 subscriber

  @usingSTOMP @unsubscribe
  Scenario: remove a specific room in subscriptions
    Given A room subscription listening to "lastName" having value "Hopper"
    Given A room subscription listening to "firstName" having value "Grace"
    And I get the list subscriptions
    Then In my list there is a collection "kuzzle-collection-test" with 2 room and 2 subscriber
    When I remove the first room
    And I get the list subscriptions
    Then In my list there is a collection "kuzzle-collection-test" with 1 room and 1 subscriber

  @usingSTOMP
  Scenario: create additional index
    When I create an index named "my-new-index"
    Then I'm able to find the index named "my-new-index" in index list
    Then I'm not able to find the index named "my-undefined-index" in index list
    Then I'm able to delete the index named "my-new-index"

  @usingSTOMP @cleanSecurity
  Scenario: login user
    Given I create a user "user1" with id "user1-id"
    When I log in as user1-id:testpwd
    Then I write the document
    Then I logout
    Then I can't write the document

  @usingSTOMP @cleanSecurity
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

  @usingSTOMP @cleanSecurity
  Scenario: create an invalid profile with unexisting role triggers an error
    Then I cannot create an invalid profile

  @usingSTOMP @cleanSecurity
  Scenario: get profile without id triggers an error
    Then I cannot a profile without ID

  @usingSTOMP
  Scenario: creating a profile with an empty set of roles triggers an error
    Then I cannot create a profile with an empty set of roles

  @usingSTOMP @cleanSecurity
  Scenario: create, get and delete a profile
    Given I create a new role "role1" with id "role1"
    And I create a new role "role2" with id "role2"
    When I create a new profile "profile1" with id "my-new-profile"
    Then I'm able to find the profile with id "my-new-profile"
    Given I delete the profile with id "my-new-profile"
    Then I'm not able to find the profile with id "my-new-profile"

  @usingSTOMP @cleanSecurity
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

  @usingSTOMP @cleanSecurity
  Scenario: user crudl
    And I create a new role "role1" with id "role1"
    And I create a new role "role2" with id "role2"
    And I create a new profile "profile2" with id "profile2"
    And I create a new user "user1" with id "user1-id"
    And I create a user "user2" with id "user2-id"
    And I can't create a new user "user2" with id "user1-id"
    Then I am able to get the user "user1-id" matching {"_id":"#prefix#user1-id","_source":{"profile":{"_id":"admin","roles":[{"_id":"admin"}]}}}
    Then I am able to get the unhydrated user "user1-id" matching {"_id":"#prefix#user1-id","_source":{"profile":"admin"}}
    Then I am able to get the user "user2-id" matching {"_id":"#prefix#user2-id","_source":{"profile":{"_id":"#prefix#profile2"}}}
    Then I search for {"regexp":{"_uid":"users.#prefix#.*"}} and find 2 users
    Then I delete the user "user2-id"
    Then I search for {"regexp":{"_uid":"users.#prefix#.*"}} and find 1 users matching {"_id":"#prefix#user1-id","_source":{"name":{"first":"David","last":"Bowie"}}}
    When I log in as user1-id:testpwd
    Then I am getting the current user, which matches {"_id":"#prefix#user1-id","_source":{"profile":{"_id":"admin"}}}
    Then I log out
    Then I am getting the current user, which matches {"_id":-1,"_source":{"profile":{"_id":"anonymous"}}}

