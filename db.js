'use strict';

const { Pool } = require('pg');

const pool = new Pool({
  host: 'db',
  port: 5432,
  user: 'user',
  password: 'pass',
  database: 'actifai'
});

module.exports = pool;
