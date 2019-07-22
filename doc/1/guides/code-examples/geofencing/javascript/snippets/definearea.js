const bigBen = {
  lat: 51.510357,
  lon: -0.116773
};
// Create a filter that defines the circular area around Big Ben
const filter = {
  geoDistance: {
    location: bigBen,
    distance: '2km'
  }
};