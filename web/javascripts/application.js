$(function(){
	var pos;
	
	//this function tries to get the location of user in order tu center the map there
	function getLocation() {
		if (navigator.geolocation) {
			navigator.geolocation.getCurrentPosition(successGeo, createMap);
		} else {
			console.log("not geolocated");
			createMap();
		}
	};
	
	//if is geolocated creates the map after getting coords
	function successGeo(position) { 
		pos = position;
		console.log("geolocated at: " + position.coords.latitude + ", " + position.coords.longitude);
		createMap();
	};
	
	//checks if the point is geoLocated inside the points of Madrid comunity
	function isInsideMadrid(position) { 
		var result = false;
		if ((position.coords.latitude < 40.81) && (position.coords.latitude >39.95) 
			&& (position.coords.longitude < -3.4 ) && (position.coords.longitude > -4.31)) { 
			result = true;
			console.log("user inside madrid");
		}
		return result;
	}
	
	//renders the cartodb map in #map
	function createMap() { 
		var url = 'http://tecnilogica.cartodb.com/api/v2/viz/99ef5f18-9b3c-11e4-93a7-0e853d047bba/viz.json';
		// if ((pos !== undefined) && (isInsideMadrid(pos))) {
		// 	console.log("mapa con geoloc");
			var options = { 
				center_lat: 40.416876,//pos.coords.latitude,
				center_lon: -3.703305//pos.coords.longitude
			}
			cartodb.createVis('map', url, options)
				.done(function(vis, layers) {
			});
		// }
		// else{
		// 	cartodb.createVis('map', url)
		// 		.done(function(vis, layers) {
		// 	});	
		// }
	};
  
  $( document ).ready(function() {
		// getLocation();
		createMap();
	});
		
});