var http = require('http');
var async = require("async");
var carto = require("./carto");
var osm_wiki = {

//this function checks into the wikipedia API response and figures if is a physical person returning a boolean response
    is_a_person: function(str) {
        var regexps = [/>Nacimiento</,/>Biografía</,/>Desembocadura</];
        var person = 'no';
        
        if (str !== null) { 
            for (var i=0 ; i< regexps.length; i++) {
                var reg = regexps[i];
                var res = reg.exec(str);
                if ((res ==">Nacimiento<") || (res==">Biografía<")) {
                    person = 'yes';
                }
				if (res ==">Desembocadura<") { 
					person = 'no';
				}
				//it must be tested the "desembocadura" behavior, it's supposed to work, but it's not tested
            }
        }else{
            return person;
        }
        return person;
    },

	//this function checks into the wikipedia API response and figures if is a physical person returning a boolean response
    get_wiki_image: function(str) {

    },
//this functions receives the street name from the extracted tags and trims the innecesary characters for sending to wikiPedia
//regexps contains all regular expressions used to trim characters that would make our wikiPedia API call inaccurate
    extract_street_name: function(str) {
        var regexps = [/Calle de los (.+)/i,/Calle de las (.+)/i,/Calle de la (.+)/i, /Calle de (.+)/i, /Calle del (.+)/i, /Calle (.+)/i,
                /Plaza del (.+)/i,/Plaza de las (.+)/i,/Plaza de la (.+)/i,  /Plaza de (.+)/i, /Plaza (.+)/i, 
                /Fray (.+)/i, 
                /Paseo del (.+)/i,/Paseo de la (.+)/i,/Paseo de los (.+)/i,/Paseo de (.+)/i, /Paseo (.+)/,/Glorieta de (.+)/i,/Avenida del (.+)/i, /Avenida de la (.+)/i, /Avenida de (.+)/i,/Avenida (.+)/i];
       var trimmed = 'false';
       var i = 0;
       var trimmedstring = '';
    
       while (trimmed == 'false') {
           var exp = new RegExp(regexps[i]);
           var res = exp.exec(str);
           if (res === null ) {
               i++;
           } else {
               trimmedstring = res[1];
               trimmed = 'true';
           }
       }
       if (trimmedstring !== '') {
           return trimmedstring;
       } else {
           return str;
       }
    },
    
//this function receives a string with the tags from the query to OSM and returns formatted tags for use in other modules
    extract_tags: function(str) {
        var tags = {name: '', type: ''};
        var regularexp = new RegExp(/"name"=>"([(\w|á|é|í|ó|ú|ñ|Á|É|Í|Ó|Ú|ç)\s]*)"/);
        var regularexp2 = new RegExp(/"highway"=>"([(\w|á|é|í|ó|ú|ñ|Á|É|Í|Ó|Ú|ç)\s]*)"/); 
        var name = regularexp.exec(str);

        if (name !== null) { 
            tags.name = name[1];
        }else { 
            tags.name = ' ';
        }
        var type = regularexp2.exec(str);

        if (type !== null) { 
            tags.type = type[1];
        }
        return tags;
    },

//this functions receives the query result and adds the tags name and type as properties of every row of the object
    complete_table: function(str) {
        console.log(str);
        var obj = JSON.parse(str);
        var lenght_json = obj.rows.length;
        var tags, calle;
        var res = {img: '', ambiguous: '', person: ''};
        var calle_barrabaja;
        var i=0,j=0;
        var k = 0;
        //first async: inside theres async eachseries(2nd asyinc) that fills wiki fields one row at a time, 
        //and later gives control to next loop for printing results of filling it.
        async.series([
            function(callback) {
                async.eachSeries(obj.rows, function(row, next){

                        tags = osm_wiki.extract_tags(obj.rows[i].tags);
                        obj.rows[i].name = tags.name;
                        obj.rows[i].type = tags.type;
                        calle = osm_wiki.extract_street_name (tags.name);
                        obj.rows[i].calle = calle;
                        calle_barrabaja = calle.replace(/ /g,"_");
                        obj.rows[i].wiki_title = calle_barrabaja;

                        var path = '/w/api.php?action=parse&redirects=true&format=json&page=' + calle_barrabaja; 
                        var options = {
                              host: 'es.wikipedia.org',
                              path: path,
                            };

                        callback_wiki = function(response) {
                              var str = '';

                              //another chunk of data has been recieved, so append it to `str`
                              response.on('data', function (chunk) {
                                str += chunk;
                              });

                              //the whole response has been recieved, so we just print it out here
                              response.on('end', function () {
                                 //console.log("wiki responde");
                                 var wiki = JSON.parse(str);
                                 if (wiki.parse === undefined){
                                   //console.log("wiki undefined: " + i);
                                   obj.rows[i].person = 'no';
                                 }
                                 else{
                                    wiki = wiki.parse.text["*"];
                                    //console.log("llamando a K: " + i);
                                    res.person = osm_wiki.is_a_person(wiki);
                                    obj.rows[i].person = res.person;
                                 }
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
            function (callback) { 
                console.log("----------_Impresión de las filas:----------");
                /*for(j=0;j<obj.rows.length;j++){
                    console.log("num " +j +": " + obj.rows[j].wiki_title + " es persona: " + obj.rows[j].person);
                }*/
                carto.insert_to_CartoDB(obj);
                callback();  
            }
        ]);
        return obj;
    },

//this functions calls to the OSM CartoDB API to get the info from the streets of madrid
//receives the limit and offset for the OSM API query, and the object where the json will be stored 
    osm_bulk: function(query) {
        var path = '/api/v2/sql?format=json&q=SELECT%20*%20FROM%20planet%20WHERE%20tags%40%3E%27highway%3D%3Eresidential%27%20ORDER%20BY%20the_geom%20%3C-%3E%20CDB_LatLng(40.4081%2C-3.69569)%20LIMIT%20105%20OFFSET%201000'; 
        //var pazo = '/api/v2/sql?format=json&q=SELECT * FROM planet WHERE tags@>"highway=>residential" ORDER BY the_geom <-> CDB_LatLng(40.4081,-3.69569) LIMIT '+limit+' OFFSET '+offset;  
        var options = {
          host: 'osm.cartodb.com',
          path: query,
          port: 80
        };
        callback = function(response) {
          var str = '';

          //another chunk of data has been recieved, so append it to `str`
          response.on('data', function (chunk) {
            str += chunk;
          });

          //the whole response has been recieved, so we just print it out here
          response.on('end', function () {
             osm_wiki.complete_table(str); 
          });
          response.on('error', function () {
            console.log('error on query');
          });
        }

        http.request(options, callback).end();   
    }
};

module.exports = osm_wiki;