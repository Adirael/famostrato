var http = require('http');
var async = require("async");
var CartoDB = require('../');
var secret = require('../secret.js');
var osm_wiki = require("./osm_wiki");
var client = new CartoDB({user:secret.USER, api_key:secret.API_KEY});

var carto = { 
    insert_to_CartoDB : function (obj) {
                        
        client.on('connect', function() {
                    var i=0;
					var table = 'osm_madrid_lines';
                    async.eachSeries(obj, function(row, next){
                        client.query("INSERT INTO {table} (the_geom,id,name,osm_id,type,wiki_id,isperson  VALUES ({geo},{name},{osm_id},{type},{wiki_id},{isperson})", 
                                     {table: 'osm_madrid_lines', 
                                      geo: obj.rows[i].the_geom,
                                      name: obj.rows[i].name,
                                      osm_id: obj.rows[i].osm_id,
                                      type: obj.rows[i].type,
                                      wiki_id: obj.rows[i].wiki_title,
                                      isperson: obj.rows[i].personwiki});
                        console.log("insertando: " + i);
                        i++;
                        next();
                    });
            
        });
        //client.connect();
    },
	remove_rivers: function (){ 
		var res ;
        var wiki_title;
        var i = 0;
        var updating = 'false';
        var osm = require("./osm_wiki");
        var lenght_json ;
        //first async: inside theres async eachseries(2nd asyinc) that fills wiki fields one row at a time, 
        //and later gives control to next loop for printing results of filling it.
        client.on('connect', function() {
                console.log("conectado a cartodb");
                client.query("select wiki_title, cartodb_id from {table} where person = 'yes'", {table: 'osm_madrid_lines'}, function(err, data){
                console.log("numero de filas: "+ data.rows.length); 
				lenght_json = data.rows.length;
                res = data;
                begin_updating();
            })

        });
        if (updating == 'false') {
            //me aseguro de no volver a entrar por segunda vez
            console.log("lanzo la consulta a cartodb");
            client.connect();
        };
        var begin_updating = function() { 
            async.series([
                function(callback) {
                    async.eachSeries(res.rows, function(row, next){
							//for each one of rows of cartodbquery (res.rows)
                            wiki_title = row.wiki_title;
                           var path = '/w/api.php?action=parse&redirects=true&format=json&page=' + wiki_title;
                            var options = {
                                  host: 'es.wikipedia.org',
                                  path: path,
                                };

                            callback_wiki = function(response) {
                                  var str = '';
                                  console.log("llamada a wiki: " + i);
                                  //another chunk of data has been recieved, so append it to `str`
                                  response.on('data', function (chunk) {
                                    str += chunk;
                                  });

                                  //the whole response has been recieved, so we just print it out here
                                  response.on('end', function () {
									var wiki = JSON.parse(str);
									wiki = wiki.parse.text["*"];
									//console.log("llamando a K: " + i);
									var osm_wiki = require("./osm_wiki");
									res.rows[i].person = osm_wiki.is_a_person(wiki);
									 
									i++;
									console.log(i);
									next();
									if (i == lenght_json) { 
										callback();
									}
								  });
								  response.on('error', function () {
									console.log('error on query');
								  });
                            }

                            http.request(options, callback_wiki).end();
                    });
                            },
                function () { 
                    carto.update_to_CartoDB_isperson(res);
                }
            ]);
        };
	},
    update_carto_wiki : function () {
        var res ;
        var wiki_title;
        var i = 0;
        var updating = 'false';
        var osm = require("./osm_wiki");
        //first async: inside theres async eachseries(2nd asyinc) that fills wiki fields one row at a time, 
        //and later gives control to next loop for printing results of filling it.
        client.on('connect', function() {
                console.log("conectado a cartodb");
			    //query may have changed in each update, please review if scripting is working parcialy.
                client.query("select name, cartodb_id from {table} where person = 'yes'", {table: 'osm_madrid_lines'}, function(err, data){
                console.log("numero de filas: "+ data.rows.length); 
                res = data;
                begin_updating();
            })

        });
        if (updating == 'false') {
            //me aseguro de no volver a entrar por segunda vez
            console.log("lanzo la consulta a cartodb");
            client.connect();
        };
        var begin_updating = function() { 
            async.series([
                function(callback) {
                    async.eachSeries(res.rows, function(row, next){
                            wiki_title = osm.extract_street_name (row.name);
                            if (wiki_title !== undefined) {
                                row.wiki_title = wiki_title.replace(/ /g,"_");
                            }
                            var path = '/w/api.php?action=parse&redirects=true&format=json&page=' + row.wiki_title; 
                            var options = {
                                  host: 'es.wikipedia.org',
                                  path: path,
                                };

                            callback_wiki = function(response) {
                                  var str = '';
                                  console.log("llamada a wiki: " + i);
                                  //another chunk of data has been recieved, so append it to `str`
                                  response.on('data', function (chunk) {
                                    str += chunk;
                                  });

                                  //the whole response has been recieved, so we just print it out here
                                  response.on('end', function () {
                                     
                                     var wiki = JSON.parse(str);
									 //wiki now contains response of wikipedia API
                                     if (wiki.parse === undefined){
                                     	row.person = 'no';
                                     }
                                     else{
										var page_title = wiki.parse.title;
                                        wiki = wiki.parse.text["*"];
                                        row.person = osm.is_a_person(wiki);
										 //this new line updates wiki_title, avoiding redirects in title of page, for correct thumbnail.
										row.wiki_title = page_title.replace(/ /g,"_");
                                     }
                                     i++;
                                     next();
                                     if ((i == (res.rows.length)) && (updating =='false')) { 
                                        updating = 'true';
                                        callback();
                                     }
                                  });
                                  response.on('error', function () {
                                    console.log('error on query');
                                  });
                            }

                            http.request(options, callback_wiki).end();
                    });
                            },
                function () { 
                    carto.update_to_CartoDB(res);
                }
            ]);
        };
    },
    update_to_CartoDB: function (res) { 
        console.log("dentro de update cartodb");
        async.eachSeries(res.rows, function(row, next) { 
        	console.log("cartodbid: " + row.cartodb_id + " person: " + row.person + " wiki_title:" + row.wiki_title ); 
		  	client.query("update {table} SET wiki_title = '{wiki_title}', person = '{person}' WHERE cartodb_id = {cartodb_id} ", 
						 {table: 'osm_madrid_lines', wiki_title: row.wiki_title , person: row.person, cartodb_id: row.cartodb_id }, 
						  function(err, data){

							console.log("error update: " + err);
							next();
						  });
        });     
    },
	update_to_CartoDB_wiki_thumb: function (res) { 
		console.log("dentro de update wiki thumb");
		async.eachSeries(res.rows, function(row, next) { 
			var sql = "update osm_madrid_lines SET thumbnail ='"+ row.thumbnail +"' WHERE wiki_title = '" + row.wiki_title + "'" ;
			console.log(sql);
			client.query(sql, 
						 {table: 'osm_madrid_lines', thumbnail: row.thumbnail, cartodb_id: row.cartodb_id }, 
						  function(err, data){

							console.log("error update: " + data);
							next();
						  });
		
		});
    },
	update_to_CartoDB_isperson: function (res) { 
		console.log("dentro de update is a person");
		async.eachSeries(res.rows, function(row, next) {
			if (row.person == "no"){
				var sql = "update osm_madrid_lines SET person ='no' WHERE cartodb_id = " + row.cartodb_id ;
				console.log(sql);
				console.log("rio eliminado");
				client.query(sql, 
							 {table: 'osm_madrid_lines', thumbnail: row.thumbnail, cartodb_id: row.cartodb_id }, 
							  function(err, data){

								//console.log("error update: " + data);
								next();
							  });
			}
			else{ 
				next();
			}
		
		});
    },
	//this function updates table with thumbnails images
	//uses a wiki_title populated table to make only requests for adding the image thumbnail
	insert_wiki_thumbnail: function (){ 
		var res ;
        var wiki_title;
        var i = 0;
        var updating = 'false';
        var osm = require("./osm_wiki");
        //first async: inside theres async eachseries(2nd asyinc) that fills wiki fields one row at a time, 
        //and later gives control to next loop for printing results of filling it.
        client.on('connect', function() {
                console.log("conectado a cartodb");
                client.query("select wiki_title, cartodb_id from {table} where person = 'yes' and thumbnail = ''", {table: 'osm_madrid_lines'}, function(err, data){
                console.log("numero de filas: "+ data.rows.length); 
                res = data;
                begin_updating();
            })

        });
        if (updating == 'false') {
            //me aseguro de no volver a entrar por segunda vez
            console.log("lanzo la consulta a cartodb");
            client.connect();
        };
        var begin_updating = function() { 
            async.series([
                function(callback) {
                    async.eachSeries(res.rows, function(row, next){
							//for each one of rows of cartodbquery (res.rows)
                            wiki_title = row.wiki_title;
                            var path = '/w/api.php?action=query&format=json&titles=' + wiki_title + '&prop=pageimages&format=json&pithumbsize=100'; 
                            var options = {
                                  host: 'es.wikipedia.org',
                                  path: path,
                                };

                            callback_wiki = function(response) {
                                  var str = '';
                                  console.log("llamada a wiki: " + i);
                                  //another chunk of data has been recieved, so append it to `str`
                                  response.on('data', function (chunk) {
                                    str += chunk;
                                  });

                                  //the whole response has been recieved, so we just print it out here
                                  response.on('end', function () {
                                     
                                     var wiki = JSON.parse(str);
									 //wiki now contains response of wikipedia API		
									 var key = Object.keys(wiki.query.pages);
									 console.log("Getting thumbnail of: " + key[0]);
									 var actual_key = key[0];
									 if (wiki.query.pages[actual_key].thumbnail === undefined){
										 row.thumbnail = "";
									 }
									 else{
									 	row.thumbnail = wiki.query.pages[actual_key].thumbnail.source;
									 }
                                     i++;
                                     next();
                                     if ((i == (res.rows.length)) && (updating =='false')) { 
                                        updating = 'true';
                                        callback();
                                     }
                                  });
                                  response.on('error', function () {
                                    console.log('error on query');
                                  });
                            }

                            http.request(options, callback_wiki).end();
                    });
                            },
                function () { 
                    carto.update_to_CartoDB_wiki_thumb(res);
                }
            ]);
        };
	}
    
}

module.exports = carto;