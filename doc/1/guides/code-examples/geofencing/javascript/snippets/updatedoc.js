const bigBen = {
  lat: 51.510357,
  lon: -0.116773
};
const currentLocation = {
  firstName: 'Ada',
  lastName: 'Lovelace',
  location: bigBen
};
const hydePark = {
  lat: 11.507268,
  lon: -0.165730
};
const newLocation = {location: hydePark};
try {
  await kuzzle.document.create(
    'myindex',
    'mycollection',
    currentLocation,
    'ada_lovelace'
  );
  // Update the user's location: now they are outside the circular area
  await kuzzle.document.update(
    'myindex',
    'mycollection',
    'ada_lovelace',
    newLocation
  );
  console.log('document updated');
} catch (error) {
  console.error(error.message);
}