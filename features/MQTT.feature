Feature: Test MQTT API
  As a user
  I want to create/update/delete/search a document and test bulk import
  Using MQTT API

  @usingMQTT
  Scenario: Create a new document and get it
    When I write the document
    Then I should receive a document id
    Then I'm able to get the document

  @usingMQTT @unsubscribe
  Scenario: Create or Update a document
    Given A room subscription listening to "lastName" having value "Hopper"
    When I write the document "documentGrace"
    And I createOrUpdate it
    Then I should have updated the document
    And I should receive a "update" notification
    And The notification should have metadata

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
    Then I find a document with "grace" in field "firstName"

  @usingMQTT
  Scenario: Bulk import
    When I do a bulk import
    Then I can retrieve actions from bulk import

  @usingMQTT
  Scenario: Global Bulk import
    When I do a global bulk import
    Then I can retrieve actions from bulk import

  @usingMQTT
  Scenario: Delete type
    When I write the document
    Then I remove the collection and schema
    Then I'm not able to get the document

  @usingMQTT
  Scenario: Count document
    When I write the document "documentGrace"
    When I write the document "documentAda"
    When I write the document "documentGrace"
    When I write the document "documentAda"
    Then I count 4 documents
    And I count 2 documents with "NYC" in field "city"

  @removeSchema @usingMQTT
  Scenario: Change mapping
    When I write the document "documentGrace"
    Then I don't find a document with "Grace" in field "firstName"
    Then I remove the collection and schema
    Then I wait 1s
    Then I change the schema
    When I write the document "documentGrace"
    Then I find a document with "Grace" in field "firstName"

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
    And I wait 1s
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
  Scenario: Getting the statistics frame from a date when there is no stats in cache
    When I get the last statistics frame when there is still no statistics in cache
    Then I get at least 1 statistic frame

  @usingMQTT
  Scenario: Getting all statistics frame
    When I get all statistics frames
    Then I get at least 1 statistic frame

  @usingMQTT
  Scenario: list known collections
    When I write the document "documentGrace"
    And I list data collections
    Then I can find a collection "kuzzle-collection-test"

  @usingMQTT
  Scenario: get the Kuzzle timestamp
    When I get the server timestamp
    Then I can read the timestamp
