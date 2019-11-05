const
  { Given } = require('cucumber');

Given('an index {string}', async function (index, ) {
  this.props.result = await this.sdk.index.create(index);

  this.props.index = index;
});
