const db = require('../../db');
const { schoolYear, currentQuarter: envQuarter } = require('../config');

const QUARTERS = ['Q1', 'Q2', 'Q3', 'Q4'];

let schemaPromise = null;
let cachedQuarter = null;

function normalizeQuarter(value) {
  const q = String(value || 'Q1').toUpperCase();
  return QUARTERS.includes(q) ? q : 'Q1';
}

function quarterRank(value) {
  return QUARTERS.indexOf(normalizeQuarter(value));
}

function unlockedQuarters(current) {
  const max = quarterRank(current);
  return QUARTERS.slice(0, max + 1);
}

function isQuarterUnlocked(quarter, current) {
  return quarterRank(quarter) <= quarterRank(current);
}

async function ensureSettingsTable() {
  if (schemaPromise) return schemaPromise;
  schemaPromise = (async () => {
    await db.query(
      `CREATE TABLE IF NOT EXISTS app_settings (
        setting_key VARCHAR(64) PRIMARY KEY,
        setting_value VARCHAR(255) NOT NULL,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      )`
    );
    const [rows] = await db.query(
      `SELECT setting_value FROM app_settings WHERE setting_key = 'current_quarter' LIMIT 1`
    );
    if (!rows.length) {
      await db.query(
        `INSERT INTO app_settings (setting_key, setting_value) VALUES ('current_quarter', ?)`,
        [normalizeQuarter(envQuarter)]
      );
    }
  })();
  try {
    await schemaPromise;
  } catch (e) {
    schemaPromise = null;
    throw e;
  }
}

async function getCurrentQuarter() {
  await ensureSettingsTable();
  if (cachedQuarter) return cachedQuarter;
  const [rows] = await db.query(
    `SELECT setting_value FROM app_settings WHERE setting_key = 'current_quarter' LIMIT 1`
  );
  cachedQuarter = normalizeQuarter(rows[0]?.setting_value || envQuarter);
  return cachedQuarter;
}

async function setCurrentQuarter(value) {
  await ensureSettingsTable();
  const quarter = normalizeQuarter(value);
  await db.query(
    `INSERT INTO app_settings (setting_key, setting_value)
     VALUES ('current_quarter', ?)
     ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value)`,
    [quarter]
  );
  cachedQuarter = quarter;
  return quarter;
}

async function getPublicConfig() {
  const currentQuarter = await getCurrentQuarter();
  return {
    schoolYear,
    currentQuarter,
    unlockedQuarters: unlockedQuarters(currentQuarter)
  };
}

module.exports = {
  QUARTERS,
  normalizeQuarter,
  quarterRank,
  unlockedQuarters,
  isQuarterUnlocked,
  getCurrentQuarter,
  setCurrentQuarter,
  getPublicConfig
};
