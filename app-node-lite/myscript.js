
var http = require('http');

var async = require("async");
var osm_wiki = require("./my_modules/osm_wiki");
var carto = require("./my_modules/carto");

var my_db = [];
var queries = ['/api/v2/sql?format=json&q=SELECT%20*%20FROM%20planet%20WHERE%20tags%40%3E%27highway%3D%3Eresidential%27%20ORDER%20BY%20the_geom%20%3C-%3E%20CDB_LatLng(40.4081%2C-3.69569)%20LIMIT%20105%20OFFSET%201000'];
var outputRows = function(err, data) {
  console.log(data.rows);
};

//this function fills the table in the model based in OSM cartodb api
function fill_objects () {
    async.each(queries, function(row, next){ 
        osm_wiki.osm_bulk(queries[1]);
        next();
    });
}

//this function fills the table in the model based in a prefilled table with streets, 
//and completes the table with the info of the wikipedia API 
function get_wiki_info (){
    carto.update_carto_wiki();
}
//this function queries cartodb in order to get all the street with wikipedia person represntation
//gets the thumbnail url from wikipedia and inserts in cartodb database
function add_wiki_thumbnail(){
	carto.insert_wiki_thumbnail();
}

function remove_rivers(){
	carto.remove_rivers();
}
//this call is the function that we wanna run, it must be changed if is necesary to run other function
add_wiki_thumbnail();



