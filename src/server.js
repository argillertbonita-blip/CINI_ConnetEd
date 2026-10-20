require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const authRoutes = require('./routes/auth');

const app = express();

app.use(cors());
app.use(express.json());

// Prefer fresh HTML so phones pick up new CSS/JS links; static assets use ?v= cache bust
app.use((req, res, next) => {
  if (req.method === 'GET' && (req.path === '/' || req.path.endsWith('.html'))) {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
    res.setHeader('Pragma', 'no-cache');
  }
  next();
});

const indexHtmlPath = path.join(__dirname, '../public/index.html');
const { portalRoot, portalPages, unknownPage } = require('./auth/portalPages');
app.use(portalRoot());

// Serve static files (HTML, CSS, JS, images, avatars)
app.use(express.static(path.join(__dirname, '../public')));

// API Routes
const { schoolYear } = require('./config');
const { getPublicConfig } = require('./utils/schoolSettings');

app.get('/api/config', async (_req, res) => {
  try {
    const config = await getPublicConfig();
    res.json({ ...config, routingV2: require('./auth/flags').routingV2Enabled() });
  } catch (error) {
    console.error('Get config error:', error);
    res.json({ schoolYear, currentQuarter: 'Q1', unlockedQuarters: ['Q1'], routingV2: false });
  }
});

app.use('/api/auth', require('./routes/auth'));
app.use('/api/admin', require('./routes/admin'));
app.use('/api/admin', require('./routes/students'));
app.use('/api/teacher', require('./routes/teacher'));
app.use('/api/parent', require('./routes/parent'));
app.use('/api/student', require('./routes/student'));
app.use('/api/upload', require('./routes/upload'));
app.use('/api/subjects', require('./routes/subjects'));
app.use('/api/quiz', require('./routes/quizPublic'));
app.use('/api/inbox', require('./routes/inbox'));

// Public shared classwork page (students — no login). /quiz/ stays so older links still open.
function sendSharedClassworkPage(_req, res) {
  res.sendFile(path.join(__dirname, '../public/quiz.html'));
}
app.get('/quiz/:token', sendSharedClassworkPage);
app.get('/activity/:token', sendSharedClassworkPage);
app.get('/exam/:token', sendSharedClassworkPage);

// Path portals (/login, /admin, /teacher, /parent) when ROUTING_V2_ENABLED is on.
app.use(portalPages(indexHtmlPath));
app.use(unknownPage(indexHtmlPath));

// Flag off: previous fallback for non-API paths.
app.use((req, res) => {
  if (req.path.startsWith('/api/')) {
    return res.status(404).json({ error: `API route not found: ${req.method} ${req.path}` });
  }
  res.sendFile(path.join(__dirname, '../public/index.html'));
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, async () => {
  console.log(`Server running on http://localhost:${PORT}`);
  try {
    const { ensureTeachingModeEnum } = require('./utils/teachingMode');
    await ensureTeachingModeEnum();
  } catch (e) {
    console.error('[startup] teachingMode:', e.message);
  }
  try {
    const { ensureAttendanceSchema } = require('./utils/attendanceSchema');
    await ensureAttendanceSchema();
  } catch (e) {
    console.error('[startup] attendanceSchema:', e.message);
  }
  try {
    const { ensureSoftDeleteSchema } = require('./utils/softDeleteSchema');
    await ensureSoftDeleteSchema();
  } catch (e) {
    console.error('[startup] softDelete:', e.message);
  }
  try {
    const { ensureQuizAttendanceSchema } = require('./utils/quizAttendance');
    await ensureQuizAttendanceSchema();
  } catch (e) {
    console.error('[startup] quizAttendance:', e.message);
  }
  try {
    const { ensureSmsSchema, startSmsWorker } = require('./utils/sms');
    await ensureSmsSchema();
    startSmsWorker();
  } catch (e) {
    console.error('[startup] sms:', e.message);
  }
  try {
    const { ensureAiRecommendationsSchema } = require('./utils/aiRecommendations');
    await ensureAiRecommendationsSchema();
  } catch (e) {
    console.error('[startup] aiRecommendations:', e.message);
  }
  try {
    const { ensureQuestionBankSchema } = require('./utils/questionBank');
    await ensureQuestionBankSchema();
  } catch (e) {
    console.error('[startup] questionBank:', e.message);
  }
  try {
    const { ensureQuizShareSchema } = require('./utils/quizShare');
    await ensureQuizShareSchema();
  } catch (e) {
    console.error('[startup] quizShare:', e.message);
  }
});