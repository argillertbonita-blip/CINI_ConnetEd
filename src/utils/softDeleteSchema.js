'use strict';

const db = require('../../db');

let schemaPromise = null;

/** Adds students.deleted_at and subjects.deleted_at when missing. */
async function ensureSoftDeleteSchema(conn = db) {
  if (schemaPromise) return schemaPromise;
  schemaPromise = (async () => {
    try {
      const [cols] = await conn.query(
        `SELECT TABLE_NAME, COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
         WHERE TABLE_SCHEMA = DATABASE()
           AND TABLE_NAME IN ('students', 'subjects')
           AND COLUMN_NAME = 'deleted_at'`
      );
      const have = new Set(cols.map((c) => c.TABLE_NAME));
      if (!have.has('students')) {
        await conn.query('ALTER TABLE students ADD COLUMN deleted_at TIMESTAMP NULL DEFAULT NULL');
      }
      if (!have.has('subjects')) {
        await conn.query('ALTER TABLE subjects ADD COLUMN deleted_at TIMESTAMP NULL DEFAULT NULL');
      }
    } catch (error) {
      schemaPromise = null;
      throw error;
    }
  })();
  return schemaPromise;
}

module.exports = { ensureSoftDeleteSchema };
