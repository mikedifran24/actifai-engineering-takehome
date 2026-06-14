'use strict';

const express = require('express');
const db = require('../db');

const router = express.Router();

// GET /groups/:id/sales
// same idea as user sales but joined through user_groups so we aggregate across the whole group
// supports granularity (day/week/month), start, end
router.get('/:id/sales', async (req, res) => {
  const { id } = req.params;
  const { start, end, granularity = 'month' } = req.query;

  const validGranularities = ['day', 'week', 'month'];
  if (!validGranularities.includes(granularity)) {
    return res.status(400).json({ error: 'granularity must be day, week, or month' });
  }

  const params = [id];
  let dateFilter = '';

  if (start) {
    params.push(start);
    dateFilter += ` AND s.date >= $${params.length}`;
  }
  if (end) {
    params.push(end);
    dateFilter += ` AND s.date <= $${params.length}`;
  }

  const query = `
    SELECT
      DATE_TRUNC('${granularity}', s.date) AS period,
      SUM(s.amount) AS total_revenue,
      ROUND(AVG(s.amount)) AS avg_revenue,
      COUNT(*) AS sale_count
    FROM sales s
    JOIN user_groups ug ON s.user_id = ug.user_id
    WHERE ug.group_id = $1
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

// GET /groups/:id/leaderboard?month=YYYY-MM
// ranks all users in the group by revenue for that month
// TODO: could add a rolling 3-month average here for better trend visibility
router.get('/:id/leaderboard', async (req, res) => {
  const { id } = req.params;
  const { month } = req.query;

  if (!month) {
    return res.status(400).json({ error: 'month is required (format: YYYY-MM)' });
  }

  // postgres needs a full date to truncate against
  const monthStart = `${month}-01`;

  const query = `
    SELECT
      u.id AS user_id,
      u.name,
      SUM(s.amount) AS total_revenue,
      ROUND(AVG(s.amount)) AS avg_revenue,
      COUNT(*) AS sale_count,
      RANK() OVER (ORDER BY SUM(s.amount) DESC) AS rank
    FROM sales s
    JOIN users u ON s.user_id = u.id
    JOIN user_groups ug ON s.user_id = ug.user_id
    WHERE ug.group_id = $1
      AND DATE_TRUNC('month', s.date) = DATE_TRUNC('month', $2::date)
    GROUP BY u.id, u.name
    ORDER BY total_revenue DESC
  `;

  try {
    const result = await db.query(query, [id, monthStart]);
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
