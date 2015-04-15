var
  _ = require('lodash');

module.export = {

  // Returns true only if the value in field has at least one non-null value
  exists: function () {

  },

  // Return true only if the point in field is in the bouding box
  geoBoundingBox: function () {

  },

  // Return true only if the point in field is in a specific distance from a geo point
  geoDistance: function () {

  },

  // Return true only if the point in field is in a range from a specific point
  geoDistanceRange: function () {

  },

  // Return true only if the point in field is in a polygon of points
  geoPolygon: function () {

  },

  // Return true only if the point in field is in the square
  geoShape: function() {

  },

  // Return true only if the value in field is in a certain range
  range: function () {

  },

  // Return true only if the value in field pass the regexp test
  regexp: function () {

  },

  // Return true only if the value in field match the provided term
  term: function (a, b) {
    return a === b;
  },

  // Return true only if the value in field match on any (configurable) of the provided terms
  terms: function () {

  }

};