const db = require('../../db');

let schemaReady = null;

function ignoreDup(error) {
  if (!error) return;
  if (error.code === 'ER_DUP_FIELDNAME' || error.errno === 1060) return;
  throw error;
}

function ensurePortalClassworkSchema() {
  if (!schemaReady) {
    schemaReady = (async () => {
      await db.query(
        'ALTER TABLE assessments ADD COLUMN portal_posted TINYINT(1) NOT NULL DEFAULT 0'
      ).catch(ignoreDup);
      await db.query(
        'ALTER TABLE assessments ADD COLUMN portal_due_at DATETIME NULL'
      ).catch(ignoreDup);
      await db.query(
        "ALTER TABLE lesson_plans ADD COLUMN quarter VARCHAR(10) DEFAULT 'Q1'"
      ).catch(ignoreDup);
    })().catch((error) => {
      schemaReady = null;
      throw error;
    });
  }
  return schemaReady;
}

module.exports = { ensurePortalClassworkSchema };
