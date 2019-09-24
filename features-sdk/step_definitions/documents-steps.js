const
  _ = require('lodash'),
  should = require('should'),
  {
    Given,
    Then
  } = require('cucumber');

Given('I create the following document:', async function (dataTable) {
  const document = this.parseDataTable(dataTable);

  const
    index = document.index || this.props.index,
    collection = document.collection || this.props.collection;

  this.props.result = await this.sdk.document.create(
    index,
    collection,
    document.body,
    document.id);

  this.props.documentId = this.props.result._id;
});
