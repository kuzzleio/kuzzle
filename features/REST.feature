Feature: Test REST API
  As a user
  I want to create/update/delete/search a document and test bulk import
  Using REST API

  @usingREST
  Scenario: Create a non-persistent document
    When I write the document "documentNonPersistentGrace"
    Then I should receive a request id
    Then I'm not able to get the document

  @usingREST
  Scenario: Create a new document and get it
    When I write the document
    Then I should receive a document id
    Then I'm able to get the document

  @usingREST
  Scenario: Create or Update a document
    When I write the document
    And I createOrUpdate it
    Then I should have updated the document

  @usingREST
  Scenario: Update a document
    When I write the document
    Then I update the document with value "foo" in field "firstName"
    Then my document has the value "foo" in field "firstName"

  @usingREST
  Scenario: Delete a document
    When I write the document
    Then I remove the document
    Then I'm not able to get the document

  @usingREST
  Scenario: Search a document
    When I write the document "documentGrace"
    Then I find a document with "grace" in field "firstName"

  @usingREST
  Scenario: Bulk import
    When I do a bulk import
    Then I can retrieve actions from bulk import

  @usingREST
  Scenario: Global Bulk import
    When I do a global bulk import
    Then I can retrieve actions from bulk import

  @usingREST
  Scenario: Delete type
    When I write the document
    Then I remove the collection and schema
    Then I'm not able to get the document

  @usingREST
  Scenario: Count document
    When I write the document "documentGrace"
    When I write the document "documentAda"
    When I write the document "documentGrace"
    When I write the document "documentAda"
    Then I count 4 documents
    And I count 2 documents with "NYC" in field "city"

  @usingREST @removeSchema
  Scenario: Change mapping
    When I write the document "documentGrace"
    Then I don't find a document with "Grace" in field "firstName"
    Then I remove the collection and schema
    Then I wait 1s
    Then I change the schema
    When I write the document "documentGrace"
    Then I find a document with "Grace" in field "firstName"

  @usingREST
  Scenario: Getting the last statistics frame
    When I get the last statistics frame
    Then I get at least 1 statistic frame

  @usingREST
  Scenario: Getting all statistics frame
    When I get all statistics frames
    Then I get at least 1 statistic frame

  @usingREST
  Scenario: list known collections
    When I write the document "documentGrace"
    And I list data collections
    Then I can find a collection "kuzzle-collection-test"

  @usingREST
  Scenario: get the Kuzzle timestamp
    When I get the server timestamp
    Then I can read the timestamp
