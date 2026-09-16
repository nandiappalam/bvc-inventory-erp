const express = require('express');
const router = express.Router();
const db = require('../config/database');

// GET Compliance Dashboard Metrics & Summary
router.get('/dashboard', async (req, res) => {
  try {
    const today = new Date().toISOString().split('T')[0];

    // Auto-update task status to Overdue if due_date < today and status is Scheduled or In Progress
    await db.run(`
      UPDATE compliance_tasks
      SET status = 'Overdue', updated_at = CURRENT_TIMESTAMP
      WHERE due_date < ? AND status IN ('Scheduled', 'In Progress')
    `, [today]);

    const statusCounts = await db.query(`
      SELECT status, COUNT(*) as count 
      FROM compliance_tasks 
      GROUP BY status
    `);

    const deptCounts = await db.query(`
      SELECT module as dept, COUNT(*) as total,
             SUM(CASE WHEN status = 'Approved' THEN 1 ELSE 0 END) as approved,
             SUM(CASE WHEN status = 'Overdue' THEN 1 ELSE 0 END) as overdue,
             SUM(CASE WHEN status IN ('Scheduled', 'In Progress', 'Pending Approval') THEN 1 ELSE 0 END) as pending
      FROM compliance_tasks
      GROUP BY module
    `);

    const recentAudit = await db.query(`
      SELECT l.*, t.task_name, t.task_code
      FROM compliance_audit_logs l
      LEFT JOIN compliance_tasks t ON l.task_id = t.id
      ORDER BY l.id DESC
      LIMIT 10
    `);

    const summary = {
      completed: 0,
      approved: 0,
      pending: 0,
      overdue: 0,
      inProgress: 0,
      scheduled: 0,
      rejected: 0,
      total: 0
    };

    (statusCounts.rows || []).forEach(row => {
      const cnt = parseInt(row.count, 10);
      summary.total += cnt;
      if (row.status === 'Completed') summary.completed += cnt;
      else if (row.status === 'Approved') summary.approved += cnt;
      else if (row.status === 'Overdue') summary.overdue += cnt;
      else if (row.status === 'In Progress') summary.inProgress += cnt;
      else if (row.status === 'Scheduled') summary.scheduled += cnt;
      else if (row.status === 'Pending Approval') summary.pending += cnt;
      else if (row.status === 'Rejected') summary.rejected += cnt;
    });

    res.json({
      success: true,
      summary,
      departmentBreakdown: deptCounts.rows || [],
      auditTrail: recentAudit.rows || []
    });
  } catch (err) {
    console.error('Error fetching compliance dashboard:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET Schedule Master
router.get('/schedules', async (req, res) => {
  try {
    const result = await db.query(`SELECT * FROM compliance_schedules ORDER BY id DESC`);
    res.json({ success: true, data: result.rows || [] });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST Schedule Master
router.post('/schedules', async (req, res) => {
  try {
    const { task_name, task_type, module, frequency, responsible_dept, assigned_to, priority } = req.body;
    const schedule_code = `SCH-${Date.now().toString().slice(-5)}`;

    const result = await db.run(`
      INSERT INTO compliance_schedules (schedule_code, task_name, task_type, module, frequency, responsible_dept, assigned_to, priority)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `, [schedule_code, task_name, task_type || 'CLEANING', module || 'Production', frequency || 'Daily', responsible_dept || module, assigned_to || 'Operator', priority || 'Medium']);

    res.json({ success: true, message: 'Compliance schedule created successfully', schedule_code });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET Compliance Tasks with filtering
router.get('/tasks', async (req, res) => {
  try {
    const { status, module, priority } = req.query;
    let query = `SELECT * FROM compliance_tasks WHERE 1=1`;
    const params = [];

    if (status) {
      query += ` AND status = ?`;
      params.push(status);
    }
    if (module) {
      query += ` AND module = ?`;
      params.push(module);
    }
    if (priority) {
      query += ` AND priority = ?`;
      params.push(priority);
    }

    query += ` ORDER BY due_date ASC, id DESC`;
    const result = await db.query(query, params);
    res.json({ success: true, data: result.rows || [] });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST Create Single Compliance Task
router.post('/tasks', async (req, res) => {
  try {
    const { task_name, task_type, module, frequency, scheduled_date, due_date, assigned_to, priority, remarks } = req.body;
    const task_code = `TSK-${Date.now().toString().slice(-6)}`;

    await db.run(`
      INSERT INTO compliance_tasks (task_code, task_name, task_type, module, frequency, scheduled_date, due_date, assigned_to, priority, status, remarks)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'Scheduled', ?)
    `, [task_code, task_name, task_type || 'INSPECTION', module || 'Production', frequency || 'Daily', scheduled_date || new Date().toISOString().split('T')[0], due_date || new Date().toISOString().split('T')[0], assigned_to || 'Assignee', priority || 'Medium', remarks || '']);

    res.json({ success: true, message: 'Compliance task created successfully', task_code });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// PUT Update Task Status & Audit Log
router.put('/tasks/:id/status', async (req, res) => {
  try {
    const { id } = req.params;
    const { status, completed_by, approved_by, remarks } = req.body;

    const taskRes = await db.query(`SELECT * FROM compliance_tasks WHERE id = ?`, [id]);
    if (!taskRes.rows || taskRes.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Task not found' });
    }
    const oldTask = taskRes.rows[0];

    let updateSql = `UPDATE compliance_tasks SET status = ?, remarks = ?, updated_at = CURRENT_TIMESTAMP`;
    const params = [status, remarks || oldTask.remarks];

    if (status === 'Completed' || status === 'Pending Approval') {
      updateSql += `, completed_at = CURRENT_TIMESTAMP, completed_by = ?`;
      params.push(completed_by || 'User');
    }
    if (status === 'Approved') {
      updateSql += `, approved_at = CURRENT_TIMESTAMP, approved_by = ?`;
      params.push(approved_by || 'Manager');
    }

    updateSql += ` WHERE id = ?`;
    params.push(id);

    await db.run(updateSql, params);

    // Audit Log
    await db.run(`
      INSERT INTO compliance_audit_logs (task_id, action, changed_by, old_value, new_value, remarks)
      VALUES (?, ?, ?, ?, ?, ?)
    `, [id, `STATUS_CHANGE_TO_${status.toUpperCase()}`, approved_by || completed_by || 'Operator', oldTask.status, status, remarks || 'Status updated']);

    res.json({ success: true, message: `Task status updated to ${status}` });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST Generate Tasks From Active Schedules
router.post('/generate-tasks', async (req, res) => {
  try {
    const schedules = await db.query(`SELECT * FROM compliance_schedules WHERE is_active = 1`);
    const today = new Date().toISOString().split('T')[0];
    let count = 0;

    for (const sch of schedules.rows || []) {
      const task_code = `TSK-GEN-${Date.now().toString().slice(-4)}-${Math.floor(Math.random() * 100)}`;
      await db.run(`
        INSERT INTO compliance_tasks (task_code, task_name, task_type, module, frequency, scheduled_date, due_date, assigned_to, priority, status)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'Scheduled')
      `, [task_code, sch.task_name, sch.task_type, sch.module, sch.frequency, today, today, sch.assigned_to, sch.priority]);
      count++;
    }

    res.json({ success: true, message: `Generated ${count} automated compliance tasks for today.`, count });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
