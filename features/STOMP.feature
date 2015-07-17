Feature: Test STOMP API
  As a user
  I want to create/update/delete/search a document and test bulk import
  Using STOMP API


  @usingMQTT @unsubscribe
  Scenario: Document update: removed document notification
    Given A room subscription listening to "lastName" having value "Hopper"
    When I write the document "documentGrace"
    Then I update the document with value "Foo" in field "lastName"
    Then I should receive a "update" notification
    And The notification should not have a "_source" member

    