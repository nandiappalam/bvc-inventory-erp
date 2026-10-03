const db = require('../config/database');

async function logUserActivity(req, activityType, remarks, companyId = 1) {
  try {
    let userName = 'admin';
    if (req) {
      if (req.user && req.user.username) {
        userName = req.user.username;
      } else if (req.headers && (req.headers['x-user-name'] || req.headers['username'])) {
        userName = req.headers['x-user-name'] || req.headers['username'];
      } else if (req.body && (req.body.userName || req.body.user_name)) {
        userName = req.body.userName || req.body.user_name;
      } else if (req.query && (req.query.userName || req.query.user_name)) {
        userName = req.query.userName || req.query.user_name;
      }
    }

    const now = new Date();
    // Record explicit date & time in Indian Standard Time (Asia/Kolkata - IST UTC+5:30)
    const activity_date = now.toLocaleDateString('en-GB', { timeZone: 'Asia/Kolkata' }).replace(/\//g, '-'); // DD-MM-YYYY
    const activity_time = now.toLocaleTimeString('en-US', { timeZone: 'Asia/Kolkata', hour: 'numeric', minute: '2-digit', second: '2-digit', hour12: true });
    const iso_created = now.toISOString();

    await db.run(`
      CREATE TABLE IF NOT EXISTS user_activities (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_name TEXT NOT NULL,
        activity_type TEXT NOT NULL,
        activity_date TEXT NOT NULL,
        activity_time TEXT NOT NULL,
        remarks TEXT,
        company_id INTEGER,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await db.run(
      `INSERT INTO user_activities (user_name, activity_type, activity_date, activity_time, remarks, company_id, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [userName, activityType, activity_date, activity_time, remarks || '', companyId, iso_created]
    );
  } catch (err) {
    console.error('Error in logUserActivity:', err.message);
  }
}

module.exports = { logUserActivity };
