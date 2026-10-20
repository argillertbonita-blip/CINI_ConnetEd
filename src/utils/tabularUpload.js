'use strict';

const ExcelJS = require('exceljs');

const MAX_ROWS = 500;

function cellText(value) {
  if (value == null) return '';
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    const y = value.getFullYear();
    const m = String(value.getMonth() + 1).padStart(2, '0');
    const d = String(value.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }
  if (typeof value === 'number') {
    if (Number.isInteger(value)) return String(value);
    return String(value);
  }
  if (typeof value === 'object') {
    if (value.text != null) return String(value.text).trim();
    if (value.result != null) return cellText(value.result);
    if (Array.isArray(value.richText)) return value.richText.map((t) => t.text || '').join('').trim();
  }
  return String(value).trim();
}

function headerKey(value) {
  return cellText(value).toLowerCase().replace(/[\s-]+/g, '_');
}

function objectsFromMatrix(matrix) {
  if (!matrix.length) return [];
  const headers = matrix[0].map(headerKey);
  const out = [];
  for (let i = 1; i < matrix.length; i++) {
    const cells = matrix[i] || [];
    if (cells.every((c) => !cellText(c))) continue;
    const obj = { __row: i + 1 };
    headers.forEach((h, idx) => {
      if (!h) return;
      obj[h] = cellText(cells[idx]);
    });
    out.push(obj);
  }
  if (out.length > MAX_ROWS) {
    const err = new Error(`A file can contain at most ${MAX_ROWS} rows`);
    err.status = 400;
    throw err;
  }
  return out;
}

function parseCsv(text) {
  const src = String(text || '').replace(/^\uFEFF/, '');
  const matrix = [];
  let row = [];
  let cur = '';
  let inQuotes = false;
  for (let i = 0; i < src.length; i++) {
    const ch = src[i];
    if (inQuotes) {
      if (ch === '"') {
        if (src[i + 1] === '"') {
          cur += '"';
          i += 1;
        } else {
          inQuotes = false;
        }
      } else {
        cur += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ',') {
      row.push(cur);
      cur = '';
    } else if (ch === '\n') {
      row.push(cur);
      matrix.push(row);
      row = [];
      cur = '';
    } else if (ch !== '\r') {
      cur += ch;
    }
  }
  if (cur.length || row.length) {
    row.push(cur);
    matrix.push(row);
  }
  return objectsFromMatrix(matrix);
}

async function parseXlsx(buffer) {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer);
  const sheet = workbook.worksheets[0];
  if (!sheet) return [];
  const matrix = [];
  sheet.eachRow({ includeEmpty: false }, (row) => {
    const values = row.values || [];
    const cells = [];
    for (let i = 1; i < values.length; i++) cells.push(values[i]);
    matrix.push(cells);
  });
  const objects = objectsFromMatrix(matrix);
  // Excel row numbers already include the header; objectsFromMatrix counts the same way.
  return objects;
}

async function parseUpload(file) {
  if (!file || !file.buffer) {
    const err = new Error('Choose an Excel (.xlsx) or CSV file');
    err.status = 400;
    throw err;
  }
  const name = String(file.originalname || '').toLowerCase();
  if (name.endsWith('.csv') || file.mimetype === 'text/csv') {
    return parseCsv(file.buffer.toString('utf8'));
  }
  if (name.endsWith('.xlsx')) {
    return parseXlsx(file.buffer);
  }
  const err = new Error('Upload an Excel (.xlsx) or CSV file');
  err.status = 400;
  throw err;
}

function bulkUpload() {
  const multer = require('multer');
  return multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 2 * 1024 * 1024 }
  }).single('file');
}

module.exports = { parseUpload, bulkUpload, cellText };
