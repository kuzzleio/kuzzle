module.exports = [

  {
    //emit when a request is received by server http (/lib/api/private/servers.js)
    'data:create': ['write:add']
  }

];