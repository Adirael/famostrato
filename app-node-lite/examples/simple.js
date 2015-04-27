
var CartoDB = require('../');
var secret = require('./secret.js');


// please, fill secret.js using secret.js.example before launch the demo
var client = new CartoDB({user:secret.USER, api_key:secret.API_KEY});


var outputRows = function(err, data) {
  console.log(data.rows);
};


client.on('connect', function() {
  client
  .query("select * from {table} ", {table: 'calles_1'}, outputRows)
});

client.connect();

