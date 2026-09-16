import db from '../db.js';

export async function logActivity(userId, action, entityType, entityId, entityName, details) {
  try {
    await db.prepare(
      `INSERT INTO activity_log (user_id, action, entity_type, entity_id, entity_name, details)
       VALUES (?, ?, ?, ?, ?, ?)`
    ).run(
      userId || null,
      action,
      entityType,
      entityId != null ? entityId : null,
      entityName != null ? entityName : null,
      details != null ? JSON.stringify(details) : null
    );
  } catch (err) {
    console.error('logActivity failed:', err.message);
  }
}
