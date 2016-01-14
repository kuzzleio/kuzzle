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
    And I'm not able to get the document in index "index-test-alt"

  @usingWebsocket @unsubscribe
  Scenario: Create or Update a document
    Given A room subscription listening to "lastName" having value "Hopper"
    When I write the document "documentGrace"
    And I createOrUpdate it
    Then I should have updated the document
    And I should receive a "update" notification
    And The notification should have metadata

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
    And I wait 1s
    Then I find a document with "grace" in field "firstName"
    And I don't find a document with "grace" in field "firstName" in index "index-test-alt"

  @usingWebsocket
  Scenario: Bulk import
    When I do a bulk import
    Then I can retrieve actions from bulk import

  @usingWebsocket
  Scenario: Global Bulk import
    When I do a global bulk import
    Then I can retrieve actions from bulk import

  @usingWebsocket
  Scenario: Delete type
    When I write the document
    Then I remove the collection and schema
    Then I'm not able to get the document

  @usingWebsocket
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

  @usingWebsocket
  Scenario: Change mapping
    When I write the document "documentGrace"
    Then I don't find a document with "Grace" in field "firstName"
    Then I remove the collection and schema
    Then I wait 1s
    Then I change the schema
    When I write the document "documentGrace"
    And I wait 1s
    Then I find a document with "Grace" in field "firstName"

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
    And I wait 1s
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
    When I create an index named "my-new-index"
    Then I'm able to find the index named "my-new-index" in index list
    Then I'm not able to find the index named "my-undefined-index" in index list
    Then I'm able to delete the index named "my-new-index"

  @usingWebsocket @createTestUser
  Scenario: login user
    When I send a login request with test:testpwd user
    Then I write the document with auth token
    Then I send a logout request with previously received token
    Then I can't write the document with auth token
