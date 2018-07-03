Feature: Kuzzle functional tests

  @http
  Scenario: Send a request compressed with gzip
    Given a request compressed with "gzip"
    When I write the document
    Then I should receive a document id
    Then I'm able to get the document

  @http
  Scenario: Send a request compressed with deflate
    Given a request compressed with "deflate"
    When I write the document
    Then I should receive a document id
    Then I'm able to get the document

  @http
  Scenario: Send a request compressed with multiple algorithms
    Given a request compressed with "deflate, gzip, identity"
    When I write the document
    Then I should receive a document id
    Then I'm able to get the document

  @http
  Scenario: Receive a request compressed with gzip
    Given an expected response compressed with "gzip"
    When I write the document
    Then I should receive a document id
    Then I'm able to get the document

  @http
  Scenario: Receive a request compressed with deflate
    Given an expected response compressed with "deflate"
    When I write the document
    Then I should receive a document id
    Then I'm able to get the document

  Scenario: Check server Health
    When I check server health

  Scenario: Get server information
    When I get server informations

  Scenario: Get server configuration
    When I get server configuration

  @validation
  Scenario: Publish a realtime message
    When I publish a message
    Then I should receive a request id
    Then I'm not able to get the document

  Scenario: Create a new document and get it
    When I write the document
    Then I should receive a document id
    Then I'm able to get the document
    And I'm not able to get the document in index "kuzzle-test-index-alt"

  Scenario: Create or Replace a document (no notification)
    When I write the document "documentGrace"
    And I createOrReplace it
    Then I should have updated the document

  @realtime
  Scenario: Create or Replace a document
    Given A room subscription listening to "info.city" having value "NYC"
    When I write the document "documentGrace"
    And I createOrReplace it
    Then I should have updated the document
    And I should receive a document notification with field action equal to "replace"
    And The notification should have volatile

  Scenario: Replace a document
    When I write the document "documentGrace"
    Then I replace the document with "documentAda" document
    Then my document has the value "Ada" in field "firstName"

  Scenario: Update a document
    When I write the document
    Then I update the document with value "foo" in field "firstName"
    Then my document has the value "foo" in field "firstName"

  Scenario: Delete a document
    When I write the document
    Then I remove the document
    Then I'm not able to get the document

  Scenario: Search a document
    When I write the document "documentGrace"
    And I refresh the index
    Then I find a document with "grace" in field "firstName"
    And I don't find a document with "grace" in field "firstName" in index "kuzzle-test-index-alt"

  Scenario: Bulk import
    When I do a bulk import
    Then I can retrieve actions from bulk import

  Scenario: Can't do a bulk import on internal index
    When I can't do a bulk import from index "%kuzzle"

  Scenario: Global Bulk import
    When I do a global bulk import
    Then I can retrieve actions from bulk import

  Scenario: Truncate collection
    When I write the document
    Then I refresh the index
    Then I truncate the collection
    Then I'm not able to get the document

  Scenario: Count document
    When I write the document "documentGrace"
    When I write the document "documentAda"
    When I write the document "documentGrace"
    When I write the document "documentAda"
    Then I count 4 documents
    And I count 0 documents in index "kuzzle-test-index-alt"
    And I count 2 documents with "NYC" in field "info.city"
    Then I truncate the collection
    And I count 0 documents

  Scenario: delete multiple documents with no error
    When I write the document "documentGrace" with id "Grace"
    When I write the document "documentAda" with id "Ada"
    Then I count 2 documents
    Then I remove the documents '["Grace", "Ada"]'
    And I count 0 documents

  Scenario: delete multiple documents with partial errors
    When I write the document "documentGrace" with id "Grace"
    When I write the document "documentAda" with id "Ada"
    Then I count 2 documents
    Then I remove the documents '["Grace", "Ada", "Not exist"]' and get partial errors
    And I count 0 documents

  Scenario: create multiple documents
    When I create multiple documents '{"Ada": "documentAda", "Grace": "documentGrace"}'
    Then I count 2 documents
    Then I truncate the collection
    And I count 0 documents

  Scenario: replace multiple documents
    When I create multiple documents '{"Ada": "documentAda", "Grace": "documentGrace"}'
    Then I count 2 documents
    Then I replace multiple documents '{"Ada": "documentGrace", "Grace": "documentAda"}'
    Then I count 2 documents
    Then I truncate the collection
    And I count 0 documents

  Scenario: replace multiple documents with partial errors
    When I create multiple documents '{"Ada": "documentAda", "Grace": "documentGrace"}'
    Then I count 2 documents
    Then I replace multiple documents '{"Ada": "documentGrace", "Not Exist": "documentAda"}' and get partial errors
    Then I count 2 documents
    Then I truncate the collection
    And I count 0 documents

  Scenario: update multiple documents
    When I create multiple documents '{"Ada": "documentAda", "Grace": "documentGrace"}'
    Then I count 2 documents
    Then I update multiple documents '{"Ada": "documentGrace", "Grace": "documentAda"}'
    Then I count 2 documents
    Then I truncate the collection
    And I count 0 documents

  Scenario: create and replace multiple documents
    Then I count 0 documents
    When I createOrReplace multiple documents '{"Ada": "documentAda", "Grace": "documentGrace"}'
    Then I count 2 documents
    Then I createOrReplace multiple documents '{"Ada": "documentGrace", "Grace": "documentAda"}'
    Then I count 2 documents
    Then I truncate the collection
    And I count 0 documents

  Scenario: Checking that documents exist or not
    When I write the document with id "documentGrace"
    Then I check that the document "documentGrace" exists
    Then I remove the document
    Then I check that the document "documentGrace" doesn't exists

  Scenario: get multiple documents
    When I create multiple documents '{"Ada": "documentAda", "Grace": "documentGrace"}'
    Then I count 2 documents
    Then I get 2 documents '["Ada", "Grace"]'
    Then I truncate the collection
    And I count 0 documents

  Scenario: Search with scroll documents
    When I write the document "documentGrace"
    When I write the document "documentGrace"
    When I write the document "documentGrace"
    When I write the document "documentGrace"
    And I refresh the index
    Then I find a document with "Grace" in field "firstName" with scroll "5m"
    And I am able to scroll previous search

  Scenario: Change mapping
    When I write the document "documentGrace"
    Then I don't find a document with "Grace" in field "firstName"
    Then I change the mapping
    When I write the document "documentGrace"
    And I refresh the index
    Then I find a document with "Grace" in field "newFirstName"

  @realtime
  Scenario: Document creation notifications
    Given A room subscription listening to "info.city" having value "NYC"
    When I write the document "documentGrace"
    Then I should receive a document notification with field action equal to "create"
    And The notification should have a "_source" member
    And The notification should have volatile

  @realtime
  Scenario: Document creation notifications with not exists
    Given A room subscription listening field "toto" doesn't exists
    When I write the document "documentGrace"
    Then I should receive a document notification with field action equal to "create"
    And The notification should have a "_source" member
    And The notification should have volatile

  @realtime
  Scenario: Document delete notifications
    Given A room subscription listening to "info.city" having value "NYC"
    When I write the document "documentGrace"
    Then I remove the document
    Then I should receive a document notification with field action equal to "delete"
    And The notification should not have a "_source" member
    And The notification should have volatile

  @realtime
  Scenario: Document update: new document notification
    Given A room subscription listening to "info.hobby" having value "computer"
    When I write the document "documentAda"
    Then I update the document with value "Hopper" in field "lastName"
    Then I should receive a document notification with field action equal to "update"
    And The notification should have a "_source" member
    And The notification should have volatile

  @realtime
  Scenario: Document update: removed document notification
    Given A room subscription listening to "lastName" having value "Hopper"
    When I write the document "documentGrace"
    Then I update the document with value "Foo" in field "lastName"
    Then I should receive a document notification with field action equal to "update"
    And The notification should not have a "_source" member
    And The notification should have volatile

  @realtime
  Scenario: Document replace: new document notification
    Given A room subscription listening to "info.hobby" having value "computer"
    When I write the document "documentAda"
    Then I replace the document with "documentGrace" document
    Then I should receive a document notification with field action equal to "replace"
    And The notification should have a "_source" member
    And The notification should have volatile

  @realtime
  Scenario: Document replace: removed document notification
    Given A room subscription listening to "info.city" having value "NYC"
    When I write the document "documentGrace"
    Then I replace the document with "documentAda" document
    Then I should receive a document notification with field action equal to "replace"
    And The notification should not have a "_source" member
    And The notification should have volatile

  @realtime
  Scenario: Subscribe to a collection
    Given A room subscription listening to the whole collection
    When I write the document "documentGrace"
    Then I should receive a document notification with field action equal to "create"
    And The notification should have a "_source" member
    And The notification should have volatile

  @realtime
  Scenario: Delete a document with a query
    Given A room subscription listening to "info.city" having value "NYC"
    When I write the document "documentGrace"
    And I write the document "documentAda"
    And I refresh the index
    Then I remove documents with field "info.hobby" equals to value "computer"
    Then I should receive a document notification with field action equal to "delete"
    And The notification should not have a "_source" member
    And The notification should have volatile

  @realtime
  Scenario: Count how many subscription on a room
    Given A room subscription listening to "lastName" having value "Hopper" with socket "client1"
    Given A room subscription listening to "lastName" having value "Hopper" with socket "client2"
    Then I can count "2" subscription

  @realtime
  Scenario: Subscription notifications
    Given A room subscription listening to "lastName" having value "Hopper" with socket "client1"
    Given A room subscription listening to "lastName" having value "Hopper" with socket "client2"
    Then I should receive a user notification with field action equal to "subscribe"
    And The notification should have volatile
    Then I unsubscribe socket "client1"
    And I should receive a user notification with field action equal to "unsubscribe"
    And The notification should have volatile

  Scenario: Getting the last statistics frame
    When I get the last statistics frame
    Then I get at least 1 statistic frame

  Scenario: Getting the statistics frame from a date
    When I get the statistics frame from a date
    Then I get at least 1 statistic frame

  Scenario: Getting all statistics frame
    When I get server informations
    And I get all statistics frames
    Then I get at least 1 statistic frame

  Scenario: list known stored collections
    When I write the document "documentGrace"
    And I list "stored" data collections
    Then I can find a stored collection kuzzle-collection-test

  Scenario: Index and collection existence
    When I check if index "%kuzzle" exists
    Then The result should raise an error with message "Indexes starting with a "%" are reserved for internal use. Cannot process index %kuzzle."
    When I check if index "idontexist" exists
    Then The result should match the json false
    When I check if collection "users" exists on index "%kuzzle"
    Then The result should raise an error with message "Indexes starting with a "%" are reserved for internal use. Cannot process index %kuzzle."
    When I write the document "documentGrace"
    When I check if index "kuzzle-test-index" exists
    Then The result should match the json true
    When I check if collection "kuzzle-collection-test" exists on index "kuzzle-test-index"
    Then The result should match the json true

  @realtime
  Scenario: list known realtime collections
    Given A room subscription listening to "lastName" having value "Hopper"
    When I list "realtime" data collections
    Then I can find a realtime collection kuzzle-collection-test

  Scenario: get the Kuzzle timestamp
    When I get the server timestamp
    Then I can read the timestamp

  @realtime
  Scenario: get list of subscriptions
    Given A room subscription listening to "lastName" having value "Hopper"
    And I get the list subscriptions
    Then In my list there is a collection "kuzzle-collection-test" with 1 room and 1 subscriber

  @realtime
  Scenario: remove a specific room in subscriptions
    Given A room subscription listening to "lastName" having value "Hopper"
    Given A room subscription listening to "firstName" having value "Grace"
    And I get the list subscriptions
    Then In my list there is a collection "kuzzle-collection-test" with 2 room and 2 subscriber

  Scenario: create additional index
    When I create an index named "kuzzle-test-index-new"
    Then I'm able to find the index named "kuzzle-test-index-new" in index list
    Then I'm not able to find the index named "my-undefined-index" in index list
    Then I'm able to delete the index named "kuzzle-test-index-new"

  @security
  Scenario: login user
    Given I create a user "useradmin" with id "useradmin-id"
    When I log in as useradmin:testpwd expiring in 1h
    Then I write the document
    Then I check the JWT Token
    And The token is valid
    Then I logout
    Then I can't write the document
    Then I check the JWT Token
    And The token is invalid

  @security
  Scenario: user token deletion
    Given I create a user "useradmin" with id "useradmin-id"
    When I log in as useradmin:testpwd expiring in 1h
    Then I write the document
    Then I check the JWT Token
    And The token is valid
    Then I delete the user "useradmin-id"
    Then I check the JWT Token
    And The token is invalid

  @security
  Scenario: create restricted user
    Then I create a restricted user "restricteduser1" with id "restricteduser1-id"

  @security
  Scenario: Role mapping
    Given I get the role mapping
    Then The mapping should contain "controllers" field of type "object"
    When I change the role mapping
    Then I get the role mapping
    Then The mapping should contain "foo" field of type "text"
    And The mapping should contain "bar" field of type "keyword"

  @security
  Scenario: Create/get/search/update/delete role
    When I create a new role "foo" with id "test"
    Then I'm able to find a role with id "test"
    And I update the role "test" with the test content "bar"
    Then I'm able to find a role with id "test" equivalent to role "bar"
    Then I'm able to find "3" role by searching controller "foo"
    And I'm able to find "4" role by searching controller "foo,bar"
    And I'm able to find "4" role by searching controller "bar"
    And I delete the role with id "test"
    Then I'm not able to find a role with id "test"
    Then I create a new role "foobar" with id "test"
    And I create a new role "foo" with id "test2"
    And I create a new role "foo" with id "test3"
    Then I'm able to do a multi get with "test,test2,test3" and get "3" roles
    Then I'm able to find "6" role by searching controller "foo"
    And I'm able to find "3" role by searching controller "foo" with maximum "3" results starting from "1"
    And I'm able to find "2" role by searching controller "foo" with maximum "10" results starting from "4"
    And I'm able to find "4" role by searching controller "bar"

  @security
  Scenario: create an invalid profile with unexisting role triggers an error
    Then I cannot create an invalid profile

  @security
  Scenario: get profile without id triggers an error
    Then I cannot get a profile without ID

  @security
  Scenario: creating a profile with an empty set of roles triggers an error
    Then I cannot create a profile with an empty set of roles

  @security
  Scenario: Profile mapping
    Given I get the profile mapping
    Then The mapping should contain a nested "policies" field with property "roleId" of type "keyword"
    When I change the profile mapping
    Then I get the profile mapping
    Then The mapping should contain "foo" field of type "text"
    And The mapping should contain "bar" field of type "keyword"

  @security
  Scenario: create, get and delete a profile
    Given I create a new role "role1" with id "role1"
    And I create a new role "role2" with id "role2"
    When I create a new profile "profile1" with id "my-new-profile"
    Then I'm able to find the profile with id "my-new-profile"
    Given I delete the profile with id "my-new-profile"
    Then I'm not able to find the profile with id "my-new-profile"

  @security
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
    Given A scrolled search on profiles
    Then I am able to perform a scrollProfiles request
    Then I delete the profile "my-profile-1"
    Then I delete the profile "my-profile-2"

  @security
  Scenario: get profile rights
    Given I create a new role "role1" with id "role1"
    And I create a new role "role2" with id "role2"
    And I create a new profile "profile1" with id "profile1"
    And I create a new profile "profile2" with id "profile2"
    Then I'm able to find rights for profile "profile2"
    Then I'm able to find rights for profile "profile1"
    Then I'm not able to find rights for profile "fake-profile"

  @security
  Scenario: User mapping
    Given I get the user mapping
    Then The mapping should contain "profileIds" field of type "keyword"
    When I change the user mapping
    Then I get the user mapping
    Then The mapping should contain "foo" field of type "text"
    And The mapping should contain "bar" field of type "keyword"

  @security
  Scenario: user crudl
    When I create a new role "role1" with id "role1"
    And I create a new role "role2" with id "role2"
    And I create a new profile "profile2" with id "profile2"
    And I create a user "useradmin" with id "useradmin-id"
    And I create a user "user2" with id "user2-id"
    And I can't create a user "user2" with id "useradmin-id"
    Then I am able to get the user "useradmin-id" matching {"_id":"#prefix#useradmin-id","_source":{"profileIds":["admin"]}}
    Then I am able to get the user "user2-id" matching {"_id":"#prefix#user2-id","_source":{"profileIds":["#prefix#profile2"]}}
    Then I search for {"ids":{"type": "users", "values":["#prefix#useradmin-id", "#prefix#user2-id"]}} and find 2 users
    Given A scrolled search on users
    Then I am able to perform a scrollUsers request
    Then I delete the user "user2-id"
    Then I search for {"ids":{"type": "users", "values":["#prefix#useradmin-id"]}} and find 1 users matching {"_id":"#prefix#useradmin-id","_source":{"name":{"first":"David","last":"Bowie"}}}
    When I log in as useradmin:testpwd expiring in 1h
    Then I am getting the current user, which matches {"_id":"#prefix#useradmin-id","_source":{"profileIds":["admin"]},"strategies":["local"]}
    Then I log out
    Then I am getting the current user, which matches {"_id":"-1","_source":{"profileIds":["anonymous"]}}

  @security
  Scenario: user replace
    When I create a user "useradmin" with id "useradmin-id"
    Then I am able to get the user "useradmin-id" matching {"_id":"#prefix#useradmin-id","_source":{"profileIds":["admin"]}}
    Then I create a new role "role1" with id "role1"
    Then I create a new profile "profile1" with id "profile1"
    Then I create a user "user1" with id "user1-id"
    When I log in as useradmin:testpwd expiring in 1h
    Then I am getting the current user, which matches {"_id":"#prefix#useradmin-id","_source":{"profileIds":["admin"]}}
    Then I replace the user "user1-id" with data {"profileIds":["anonymous"],"foo":"bar"}
    Then I am able to get the user "user1-id" matching {"_id":"#prefix#user1-id","_source":{"profileIds":["anonymous"],"foo":"bar"}}
    Then I log out
    Then I am getting the current user, which matches {"_id":"-1","_source":{"profileIds":["anonymous"]}}

  @security
  Scenario: user updateSelf
    When I create a user "useradmin" with id "useradmin-id"
    Then I am able to get the user "useradmin-id" matching {"_id":"#prefix#useradmin-id","_source":{"profileIds":["admin"]}}
    When I log in as useradmin:testpwd expiring in 1h
    Then I am getting the current user, which matches {"_id":"#prefix#useradmin-id","_source":{"profileIds":["admin"]}}
    Then I update current user with data {"foo":"bar"}
    Then I am getting the current user, which matches {"_id":"#prefix#useradmin-id","_source":{"profileIds":["admin"],"foo":"bar"}}
    Then I log out
    Then I am getting the current user, which matches {"_id":"-1","_source":{"profileIds":["anonymous"]}}

  @security @realtime
  Scenario: token expiration
    Given I create a user "useradmin" with id "useradmin-id"
    When I log in as useradmin:testpwd expiring in 3s
    Then I use my JWT to subscribe to field "lastName" having value "Hopper"
    Then I wait 5s
    And I should receive a TokenExpired notification with field message equal to "Authentication Token Expired"

  @security
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
    And I create a user "user1" with id "user1-id"
    And I create a user "user2" with id "user2-id"
    And I create a user "user3" with id "user3-id"
    And I create a user "user4" with id "user4-id"
    And I create a user "user5" with id "user5-id"
    And I create a user "user6" with id "user6-id"
    When I log in as user1:testpwd1 expiring in 1h
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
    When I log in as user2:testpwd2 expiring in 1h
    Then I'm allowed to create a document in index "kuzzle-test-index" and collection "kuzzle-collection-test"
    And I'm allowed to create a document in index "kuzzle-test-index" and collection "kuzzle-collection-test-alt"
    And I'm allowed to search for documents in index "kuzzle-test-index" and collection "kuzzle-collection-test"
    And I'm allowed to search for documents in index "kuzzle-test-index" and collection "kuzzle-collection-test-alt"
    And I'm allowed to search for documents in index "kuzzle-test-index-alt" and collection "kuzzle-collection-test"
    And I'm allowed to search for documents in index "kuzzle-test-index-alt" and collection "kuzzle-collection-test-alt"
    And I'm allowed to count documents in index "kuzzle-test-index" and collection "kuzzle-collection-test"
    And I'm allowed to count documents in index "kuzzle-test-index" and collection "kuzzle-collection-test-alt"
    And I'm allowed to count documents in index "kuzzle-test-index-alt" and collection "kuzzle-collection-test"
    And I'm allowed to count documents in index "kuzzle-test-index-alt" and collection "kuzzle-collection-test-alt"
    Then I log out
    When I log in as user3:testpwd3 expiring in 1h
    Then I'm not allowed to create a document in index "kuzzle-test-index" and collection "kuzzle-collection-test"
    And I'm not allowed to create a document in index "kuzzle-test-index" and collection "kuzzle-collection-test-alt"
    And I'm not allowed to search for documents in index "kuzzle-test-index" and collection "kuzzle-collection-test"
    And I'm not allowed to search for documents in index "kuzzle-test-index" and collection "kuzzle-collection-test-alt"
    And I'm allowed to search for documents in index "kuzzle-test-index-alt" and collection "kuzzle-collection-test"
    And I'm not allowed to search for documents in index "kuzzle-test-index-alt" and collection "kuzzle-collection-test-alt"
    And I'm not allowed to count documents in index "kuzzle-test-index" and collection "kuzzle-collection-test"
    And I'm not allowed to count documents in index "kuzzle-test-index" and collection "kuzzle-collection-test-alt"
    And I'm allowed to count documents in index "kuzzle-test-index-alt" and collection "kuzzle-collection-test"
    And I'm not allowed to count documents in index "kuzzle-test-index-alt" and collection "kuzzle-collection-test-alt"
    Then I log out
    When I log in as user4:testpwd4 expiring in 1h
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
    When I log in as user5:testpwd5 expiring in 1h
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
    When I log in as user6:testpwd6 expiring in 1h
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

  @security
  Scenario: get user rights
    Given I create a new role "role1" with id "role1"
    And I create a new role "role2" with id "role2"
    And I create a new profile "profile2" with id "profile2"
    And I create a user "user2" with id "user2-id"
    Then I'm able to find rights for user "user2-id"
    Then I'm not able to find rights for user "fakeuser-id"

  @security
  Scenario: get my rights
    Given I create a new role "role1" with id "role1"
    And I create a new role "role2" with id "role2"
    And I create a new profile "profile2" with id "profile2"
    And I create a user "user2" with id "user2-id"
    When I log in as user2:testpwd2 expiring in 1h
    Then I'm able to find my rights

  @security
  Scenario: user credentials crudl
    Given I create a user "nocredentialuser" with id "nocredentialuser-id"
    Then I validate local credentials of user nocredentialuser with id nocredentialuser-id
    Then I create local credentials of user nocredentialuser with id nocredentialuser-id
    Then I check if local credentials exist for user nocredentialuser with id nocredentialuser-id
    Then I get local credentials of user nocredentialuser with id nocredentialuser-id
    Then I get local credentials of user nocredentialuser by id nocredentialuser
    Then I log in as nocredentialuser:testpwd1 expiring in 1h
    Then I log out
    Then I update local credentials password to "testpwd2" for user with id nocredentialuser-id
    Then I can't log in as nocredentialuser:testpwd1 expiring in 1h
    Then I log in as nocredentialuser:testpwd2 expiring in 1h
    Then I log out
    Then I delete local credentials of user with id nocredentialuser-id
    Then I can't log in as nocredentialuser:testpwd2 expiring in 1h

  @security
  Scenario: current user credentials crudl
    Given I create a user "nocredentialuser" with id "nocredentialuser-id"
    Then I create local credentials of user nocredentialuser with id nocredentialuser-id
    Then I log in as nocredentialuser:testpwd1 expiring in 1h
    Then I validate my local credentials
    Then I delete my local credentials
    Then I check if i have no local credentials
    Then I create my local credentials
    Then I check if i have local credentials
    Then I get my local credentials
    Then I update my local credentials password to "testpwd2"
    Then I log out
    Then I can't log in as nocredentialuser:testpwd1 expiring in 1h
    Then I log in as nocredentialuser:testpwd2 expiring in 1h
    Then I delete my local credentials
    Then I log out
    Then I can't log in as nocredentialuser:testpwd2 expiring in 1h

  @redis
  Scenario: memory storage - scalars
    Given I call the setnx method of the memory storage with arguments
      """
      { "_id": "#prefix#mykey", "body": { "value": "999" }}
      """
    Then The ms result should match the json 1
    When I call the setnx method of the memory storage with arguments
      """
      { "_id": "#prefix#mykey", "body": { "value": "999" }}
      """
    Then The ms result should match the json 0
    When I scan the database using the scan method with arguments
      """
      { "args": { "match": "#prefix#*" } }
      """
    Then The ms result should match the json ["#prefix#mykey"]
    When I call the touch method of the memory storage with arguments
      """
      { "body": { "keys": ["#prefix#mykey"] } }
      """
    Then The ms result should match the json 1
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
      { "_id": "#prefix#mykey", "body": { "value": "bar" }}
      """
    Then The ms result should match the json 4
    When I call the get method of the memory storage with arguments
      """
      { "_id": "#prefix#mykey" }
      """
    Then The ms result should match the json "4bar"
    When I call the getrange method of the memory storage with arguments
      """
      { "_id": "#prefix#mykey", "args": { "start": 1, "end": 2 }}
      """
    Then The ms result should match the json "ba"
    When I call the getbit method of the memory storage with arguments
      """
      { "_id": "#prefix#mykey", "args": { "offset": 3 } }
      """
    Then The ms result should match the json 1
    When I call the del method of the memory storage with arguments
      """
      { "body": { "keys": ["#prefix#mykey"] } }
      """
    Then The ms result should match the json 1
    When I call the get method of the memory storage with arguments
      """
      { "_id": "#prefix#mykey" }
      """
    Then The ms result should match the json null
    Given I call the set method of the memory storage with arguments
      """
      { "_id": "#prefix#x", "body": { "value": "foobar" }}
      """
    And I call the set method of the memory storage with arguments
      """
      { "_id": "#prefix#y", "body": { "value": "abcdef" }}
      """
    When I call the mget method of the memory storage with arguments
      """
      { "args": { "keys": ["#prefix#x", "#prefix#y", "nonexisting"]}}
      """
    Then The ms result should match the json ["foobar", "abcdef", null]
    When I call the bitop method of the memory storage with arguments
      """
      { "_id": "#prefix#dest", "body": { "operation": "AND", "keys": [ "#prefix#x", "#prefix#y" ] } }
      """
    And I call the get method of the memory storage with arguments
      """
      { "_id": "#prefix#dest" }
      """
    Then The ms result should match the json "`bc`ab"
    When I call the bitop method of the memory storage with arguments
      """
      { "_id": "#prefix#dest", "body": { "operation": "OR", "keys": [ "#prefix#x", "#prefix#y" ] } }
      """
    And I call the get method of the memory storage with arguments
      """
      { "_id": "#prefix#dest" }
      """
    Then The ms result should match the json "goofev"
    When I call the bitcount method of the memory storage with arguments
      """
      { "_id": "#prefix#x" }
      """
    Then The ms result should match the json 26
    When I call the bitcount method of the memory storage with arguments
      """
      { "_id": "#prefix#x", "args": {"start": 0, "end": 3} }
      """
    Then The ms result should match the json 19
    When I call the bitpos method of the memory storage with arguments
      """
      { "_id": "#prefix#x", "args": { "bit": 1 } }
      """
    Then The ms result should match the json 1
    Given I call the set method of the memory storage with arguments
      """
      { "_id": "#prefix#mykey", "body": { "value": 10 } }
      """
    When I call the exists method of the memory storage with arguments
      """
      { "args": {"keys": [ "#prefix#mykey", "i", "dont", "exist" ] } }
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
      { "body": {"entries": [{"key": "#prefix#foo", "value": "bar"}, {"key":"#prefix#k1", "value": "v1"}, {"key":"#prefix#k2", "value":"v2"}]}}
      """
    When I call the mget method of the memory storage with arguments
      """
      { "args": { "keys": [ "#prefix#foo", "#prefix#k2"] } }
      """
    Then The ms result should match the json ["bar", "v2"]
    When I call the msetnx method of the memory storage with arguments
      """
      { "body": { "entries": [{"key":"#prefix#k1", "value":"v1bis"}, {"key":"#prefix#foo", "value":"barbis"}] }}
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
      { "_id": "#prefix#foo", "body": {"value": "bar" }}
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
      {
        "_id": "#prefix#mykey",
        "body": {"value": "Your base are belong to us"}
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

  @redis
  Scenario: memory storage - lists
    Given I call the rpush method of the memory storage with arguments
      """
      { "_id": "#prefix#list", "body": { "values": [ 1, "abcd", 5 ] }}
      """
    Then The ms result should match the json 3
    When I call the lindex method of the memory storage with arguments
      """
      { "_id": "#prefix#list", "args": { "idx": 1 } }
      """
    Then The ms result should match the json "abcd"
    When I call the linsert method of the memory storage with arguments
      """
      { "_id": "#prefix#list", "body": { "position": "BEFORE", "pivot": 5, "value": "inserted" } }
      """
    Then The ms result should match the json 4
    When I call the lrange method of the memory storage with arguments
      """
       { "_id": "#prefix#list", "args": { "start": 2, "stop": 3  } }
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
    When I call the rpushx method of the memory storage with arguments
      """
      { "_id": "#prefix#list", "body": { "value": "foobar" } }
      """
    Then The ms result should match the json 4
    When I call the rpushx method of the memory storage with arguments
      """
      { "_id": "nonexisting", "body": { "value": "foobar" } }
      """
    Then The ms result should match the json 0
    Given I call the lpush method of the memory storage with arguments
      """
      { "_id": "#prefix#list", "body": { "values": ["first"] }}
      """
    When I call the lindex method of the memory storage with arguments
      """
      { "_id": "#prefix#list", "args": { "idx": 0 } }
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
      { "_id": "#prefix#list", "args": { "start": 0, "stop": -1  } }
      """
    Then The ms result should match the json ["first", "abcd", "inserted", "5", "foobar", "hello", "foo"]
    Given I call the lset method of the memory storage with arguments
      """
      {"_id": "#prefix#list", "body": { "index": 1, "value": "replaced"}}
      """
    When I call the lindex method of the memory storage with arguments
      """
      {"_id": "#prefix#list", "args": {"idx": 1}}
      """
    Then The ms result should match the json "replaced"
    Given I call the ltrim method of the memory storage with arguments
      """
      {"_id": "#prefix#list", "body": { "start": 2, "stop": 3 }}
      """
    When I call the lrange method of the memory storage with arguments
      """
      { "_id": "#prefix#list", "args": { "start": 0, "stop": -1  } }
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
      { "body": { "keys": ["#prefix#list"] } }
      """
    And I call the rpush method of the memory storage with arguments
      """
      { "_id": "#prefix#list", "body": { "values": [ 1, 2, 3 ] } }
      """
    And I call the mset method of the memory storage with arguments
      """
      {
        "body": {
          "entries": [
            {"key":"#prefix#o_1", "value":"object1"},
            {"key":"#prefix#o_2", "value":"object2"},
            {"key":"#prefix#o_3", "value":"object3"},
            {"key":"#prefix#w_1","value":2},
            {"key":"#prefix#w_2","value":3},
            {"key":"#prefix#w_3","value":1}
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
          "get": ["#prefix#o_*"],
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

  @redis
  Scenario: memory storage - hash
    Given I call the hset method of the memory storage with arguments
      """
      {"_id": "#prefix#hash", "body": { "field": "foo", "value": "bar" }}
      """
    And I call the hmset method of the memory storage with arguments
      """
      {
        "_id":"#prefix#hash",
        "body": {
          "entries": [
            {"field": "k1", "value": "v1"},
            {"field": "k2", "value": "v2"},
            {"field": "k3", "value": "v3"},
            {"field": "k4", "value": 10}
          ]
        }
      }
      """
    When I scan the database using the hscan method with arguments
      """
      { "_id": "#prefix#hash" }
      """
    Then The ms result should match the json ["foo", "bar", "k1", "v1", "k2", "v2", "k3", "v3", "k4", "10"]
    When I call the hexists method of the memory storage with arguments
      """
      {"_id": "#prefix#hash", "args": { "field": "k3" } }
      """
    Then The ms result should match the json 1
    When I call the hdel method of the memory storage with arguments
      """
      {"_id":"#prefix#hash", "body": { "fields": ["k3"] } }
      """
    Then The ms result should match the json 1
    When I call the hexists method of the memory storage with arguments
      """
      {"_id": "#prefix#hash", "args": { "field": "k3" } }
      """
    Then The ms result should match the json 0
    When I call the hget method of the memory storage with arguments
      """
      { "_id": "#prefix#hash", "args": { "field": "foo" }}
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

  @redis
  Scenario: memory storage - sets
    Given I call the sadd method of the memory storage with arguments
      """
      { "_id": "#prefix#set", "body": { "members": ["foobar", "v1", 5, 10, 10] }}
      """
    Then The ms result should match the json 4
    When I scan the database using the sscan method with arguments
      """
      { "_id": "#prefix#set" }
      """
    Then The sorted ms result should match the json ["10","5","foobar","v1"]
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
      { "_id": "#prefix#set2", "args": { "keys": [ "#prefix#set1"] }}
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
      { "args": { "keys": ["#prefix#set1", "#prefix#set2"] }}
      """
    Then The ms result should match the json ["c"]
    Given I call the sinterstore method of the memory storage with arguments
      """
      { "body": { "destination": "#prefix#set3", "keys": ["#prefix#set1", "#prefix#set2"] }}
      """
    When I call the smembers method of the memory storage with arguments
      """
      { "_id": "#prefix#set3" }
      """
    Then The ms result should match the json ["c"]
    When I call the sunion method of the memory storage with arguments
      """
      { "args": { "keys": ["#prefix#set1", "#prefix#set2"] }}
      """
    Then The sorted ms result should match the json ["a", "b", "c", "d", "e"]
    Given I call the sunionstore method of the memory storage with arguments
      """
      { "body": { "destination": "#prefix#set3", "keys": ["#prefix#set1", "#prefix#set2"] }}
      """
    When I call the smembers method of the memory storage with arguments
      """
      { "_id": "#prefix#set3" }
      """
    Then The sorted ms result should match the json ["a", "b", "c", "d", "e"]
    When I call the sismember method of the memory storage with arguments
      """
      {"_id": "#prefix#set", "args": { "member": 10 } }
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
      { "body": { "keys": ["#prefix#set"] } }
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
      { "_id": "#prefix#set", "body": { "limit": [1, 2], "direction": "DESC" }}
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
          "members": [ 54, 23, 99 ]
        }
      }
      """
    When I call the smembers method of the memory storage with arguments
      """
      { "_id": "#prefix#set" }
      """
    Then The ms result should match the json []

  @redis
  Scenario: memory storage - sorted sets
    Given I call the zadd method of the memory storage with arguments
      """
      {
        "_id": "#prefix#zset",
        "body": {
          "elements": [
            { "score": 1, "member": "one" },
            { "score": 1, "member": "uno" },
            { "score": 3, "member": "three" },
            { "score": 2, "member": "two" }
          ]
        }
      }
      """
    When I scan the database using the zscan method with arguments
      """
      { "_id": "#prefix#zset" }
      """
    Then The ms result should match the json ["one", "1", "uno", "1", "two", "2", "three", "3"]
    When I call the zrange method of the memory storage with arguments
      """
      {
        "_id": "#prefix#zset",
        "args": {
          "start": 0,
          "stop": -1,
          "options": ["withscores"]
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
        "args": {
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
        "args": {
          "start": 0,
          "stop": -1,
          "options": ["withscores"]
        }
      }
      """
    Then The ms result should match the json ["one", "1", "uno", "1", "three", "3", "two", "4"]
    Given I call the zadd method of the memory storage with arguments
      """
      {
        "_id": "#prefix#zset2",
        "body": {
          "elements": [
            { "score": 2, "member": "two" },
            { "score": 1, "member": "uno" }
          ]
        }
      }
      """
    And I call the zinterstore method of the memory storage with arguments
      """
      {
        "_id": "#prefix#zset3",
        "body": {
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
        "args": {
          "start": 0,
          "stop": -1,
          "options": ["withscores"]
        }
      }
      """
    Then The ms result should match the json ["uno", "2", "two", "8"]
    Given I call the zunionstore method of the memory storage with arguments
      """
      {
        "_id": "#prefix#zset3",
        "body": {
          "_id": "#prefix#zset3",
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
        "args": {
          "start": 0,
          "stop": -1,
          "options": ["withscores"]
        }
      }
      """
    Then The ms result should match the json ["one","2","uno","2","three","6","two","8"]
    Given I call the del method of the memory storage with arguments
      """
      { "body": { "keys": ["#prefix#zset"] } }
      """
    And I call the zadd method of the memory storage with arguments
      """
      {
        "_id": "#prefix#zset",
        "body": {
          "elements": [
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
        "args": {
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
        "args": {
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
        "args": { "start": 0, "stop": -1 }
      }
      """
    Then The ms result should match the json ["five","four","zero"]
    When I call the zremrangebyrank method of the memory storage with arguments
      """
      {
        "_id": "#prefix#zset",
        "body": { "start": 1, "stop": 2 }
      }
      """
    Then The ms result should match the json 2
    When I call the zrange method of the memory storage with arguments
      """
      {
        "_id": "#prefix#zset",
        "args": { "start": 0, "stop": -1 }
      }
      """
    Then The ms result should match the json ["five"]
    Given I call the del method of the memory storage with arguments
      """
      { "body": { "keys": ["#prefix#zset"] } }
      """
    And I call the zadd method of the memory storage with arguments
      """
      {
        "_id": "#prefix#zset",
        "body": {
          "elements": [
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
        "args": {
          "min": "(0",
          "max": "3",
          "limit": [1, 5],
          "options": ["withscores"]
        }
      }
      """
    Then The ms result should match the json ["two", "2", "three", "3"]
    When I call the zrevrangebyscore method of the memory storage with arguments
      """
      {
        "_id": "#prefix#zset",
        "args": {
          "min": "(0",
          "max": "3",
          "limit": [1, 5],
          "options": ["withscores"]
        }
      }
      """
    Then The ms result should match the json ["two", "2", "one", "1"]
    When I call the zscore method of the memory storage with arguments
      """
      { "_id": "#prefix#zset", "args": { "member": "two" } }
      """
    Then The ms result should match the json "2"
    When I call the zrem method of the memory storage with arguments
      """
      { "_id": "#prefix#zset", "body": { "members": ["two"] } }
      """
    And I call the zrange method of the memory storage with arguments
      """
      {
        "_id": "#prefix#zset",
        "args": { "start": 0, "stop": -1, "options": ["withscores"] }
      }
      """
    Then The ms result should match the json ["zero", "0", "one", "1", "three", "3", "four", "4"]
    Given I call the zadd method of the memory storage with arguments
      """
      { "_id": "#prefix#zset", "body": { "elements": [{"score": 2, "member": "two"}] } }
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
        "args": { "start": 0, "stop": -1, "options": ["withscores"] }
      }
      """
    Then The ms result should match the json ["zero", "0", "one", "1", "four", "4"]

  @redis
  Scenario: memory storage - hyperloglog

    Given I call the pfadd method of the memory storage with arguments
      """
      {
        "_id": "#prefix#hll",
        "body": {
          "elements": [ "a", "b", "c", "d", "e", "f", "g" ]
        }
      }
      """
    Then The ms result should match the json 1
    When I call the pfadd method of the memory storage with arguments
      """
      {
        "_id": "#prefix#hll",
        "body": {
          "elements": [ "a", "b", "f", "g" ]
        }
      }
      """
    Then The ms result should match the json 0
    When I call the pfcount method of the memory storage with arguments
      """
      { "args": { "keys": ["#prefix#hll"] } }
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
      { "args": { "keys": [ "#prefix#hll", "#prefix#hll2"] } }
      """
    Then The ms result should match the json 11
    When I call the pfmerge method of the memory storage with arguments
      """
      {
        "_id": "#prefix#hll3",
        "body": {
          "sources": [ "#prefix#hll", "#prefix#hll2" ]
        }
      }
      """
    And I call the pfcount method of the memory storage with arguments
      """
      { "args": { "keys": ["#prefix#hll3"] } }
      """
    Then The ms result should match the json 11

  @redis
  Scenario: memory storage - geospatial
    Given I call the geoadd method of the memory storage with arguments
      """
      {
        "_id": "#prefix#geo",
        "body": {
          "points": [
              {"lon": 13.361389, "lat": 38.115556, "name": "Palermo"},
              {"lon": 15.087269, "lat": 37.502669, "name": "Catania"}
          ]
        }
      }
      """
    Then The ms result should match the json 2
    When I call the geodist method of the memory storage with arguments
      """
      {
        "_id": "#prefix#geo",
        "args": { "member1": "Palermo", "member2": "Catania" }
      }
      """
    Then The ms result should match the json "166274.1516"
    When I call the geohash method of the memory storage with arguments
      """
      {
        "_id": "#prefix#geo",
        "args": { "members": ["Palermo", "Catania"] }
      }
      """
    Then The ms result should match the json ["sqc8b49rny0","sqdtr74hyu0"]
    When I call the geopos method of the memory storage with arguments
      """
      {
        "_id": "#prefix#geo",
        "args": { "members": ["Palermo", "Catania"] }
      }
      """
    Then The ms result should match the json [["13.36138933897018433","38.11555639549629859"],["15.08726745843887329","37.50266842333162032"]]
    When I call the georadius method of the memory storage with arguments
      """
      {
        "_id": "#prefix#geo",
        "args": { "lon": 15, "lat": 37, "distance": 100, "unit": "km" }
      }
      """
    Then The ms result should match the json ["Catania"]
    When I call the geoadd method of the memory storage with arguments
      """
      {
        "_id": "#prefix#geo",
        "body": {
          "points": [
              {"lon": 13.583333, "lat": 37.316667, "name": "Agrigento"}
          ]
        }
      }
      """
    When I call the georadiusbymember method of the memory storage with arguments
      """
      {
        "_id": "#prefix#geo",
        "args": { "member": "Agrigento", "distance": 100, "unit": "km" }
      }
      """
    Then The ms result should match the json ["Agrigento", "Palermo"]


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

  @validation
  Scenario: Validation - getSpecification & updateSpecification
    When There is no specifications for index "kuzzle-test-index" and collection "kuzzle-collection-test"
    Then I put a not valid specification for index "kuzzle-test-index" and collection "kuzzle-collection-test"
    And There is an error message
    When There is no specifications for index "kuzzle-test-index" and collection "kuzzle-collection-test"
    Then I put a valid specification for index "kuzzle-test-index" and collection "kuzzle-collection-test"
    And There is no error message
    And There is a specification for index "kuzzle-test-index" and collection "kuzzle-collection-test"

  @validation
  Scenario: Validation - validateSpecification
    When I post a valid specification
    Then There is no error message
    When I post an invalid specification
    Then There is an error message in the response body

  @validation
  Scenario: Validation - validateDocument
    When I put a valid specification for index "kuzzle-test-index" and collection "kuzzle-collection-test"
    Then There is no error message
    When I post a valid document
    Then There is no error message
    When I post an invalid document
    Then There is an error message

  @validation
  Scenario: Validation - searchSpecifications
    Then I put a valid specification for index "kuzzle-test-index" and collection "kuzzle-collection-test"
    Then I find 1 specifications

  @validation
  Scenario: Validation - scrollSpecifications
    Then I put a valid specification for index "kuzzle-test-index" and collection "kuzzle-collection-test"
    Then I find 1 specifications with scroll "1m"
    Then I am able to perform a scrollSpecifications request

  @validation
  Scenario: Validation - validateDocument
    When I put a valid specification for index "kuzzle-test-index" and collection "kuzzle-collection-test"
    Then There is no error message
    When I post a valid document
    Then There is no error message
    When I post an invalid document
    Then There is an error message

  @validation
  Scenario: Validation - deleteSpecifications
    When I put a valid specification for index "kuzzle-test-index" and collection "kuzzle-collection-test"
    Then There is no error message
    When I delete the specifications for index "kuzzle-test-index" and collection "kuzzle-collection-test"
    Then There is no error message
    And There is no specifications for index "kuzzle-test-index" and collection "kuzzle-collection-test"
    When I delete the specifications again for index "kuzzle-test-index" and collection "kuzzle-collection-test"
    Then There is no error message

  Scenario: Get authentication strategies
    Then I get the registrated authentication strategies

  @firstAdmin
  Scenario: Create First Admin
    Given I create a new role "foo" with id "foo"
    And I update the default profile with id "admin" by adding the role "foo"
    And I update the default profile with id "default" by adding the role "foo"
    And I update the default profile with id "anonymous" by adding the role "foo"
    And I'm able to find the default profile with id "admin" with profile "adminfoo"
    Then I create the first admin with id "useradmin-id"
    And I log in as useradmin:testpwd expiring in 1h
    And I'm able to find the default profile with id "admin" with profile "adminfoo"
    And I'm able to find the default profile with id "default" with profile "defaultfoo"
    And I'm able to find the default profile with id "anonymous" with profile "anonymousfoo"
    Then I'm able to find a default role with id "admin" equivalent to role "admin"
    And I'm able to find a default role with id "default" equivalent to role "admin"
    And I'm able to find a default role with id "anonymous" equivalent to role "admin"

  @firstAdmin
  Scenario: Create First Admin and reset profiles and roles
    Given I create a new role "foo" with id "foo"
    And I update the default profile with id "admin" by adding the role "foo"
    And I update the default profile with id "default" by adding the role "foo"
    And I update the default profile with id "anonymous" by adding the role "foo"
    Then I create the first admin with id "useradmin-id" and reset profiles and roles
    And I log in as useradmin:testpwd expiring in 1h
    And I'm able to find the default profile with id "admin" with profile "admin"
    And I'm able to find the default profile with id "default" with profile "default"
    And I'm able to find the default profile with id "anonymous" with profile "anonymous"
    Then I'm able to find a default role with id "admin" equivalent to role "admin"
    And I'm able to find a default role with id "default" equivalent to role "default"
    And I'm able to find a default role with id "anonymous" equivalent to role "anonymous"
