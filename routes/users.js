'use strict';

const express = require('express');
const db = require('../db');

const router = express.Router();

// GET /users/:id/sales
// Query params: granularity (day/week/month, defaults to month), start, end (both YYYY-MM-DD)
router.get('/:id/sales', async (req, res) => {
  const { id } = req.params;
  const { start, end, granularity = 'month' } = req.query;

  const validGranularities = ['day', 'week', 'month'];
  if (!validGranularities.includes(granularity)) {
    return res.status(400).json({ error: 'granularity must be day, week, or month' });
  }

  // build date filter dynamically based on what was passed in
  // params array keeps us safe from sql injection
  const params = [id];
  let dateFilter = '';

  if (start) {
    params.push(start);
    dateFilter += ` AND date >= $${params.length}`;
  }
  if (end) {
    params.push(end);
    dateFilter += ` AND date <= $${params.length}`;
  }

  // DATE_TRUNC buckets each sale into the start of its period (e.g. all of January -> 2021-01-01)
  // so grouping by that gives us one row per window with aggregates
  const query = `
    SELECT
      DATE_TRUNC('${granularity}', date) AS period,
      SUM(amount) AS total_revenue,
      ROUND(AVG(amount)) AS avg_revenue,
      COUNT(*) AS sale_count
    FROM sales
    WHERE user_id = $1
    ${dateFilter}
    GROUP BY period
    ORDER BY period ASC
  `;

  try {
    const result = await db.query(query, params);
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
