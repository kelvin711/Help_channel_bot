const { Client } = require("pg");
require('dotenv').config({ path: '../.env'});

const client = new Client(process.env.DATABASE_URL);

// Add this line
client.connect();

module.exports = client;