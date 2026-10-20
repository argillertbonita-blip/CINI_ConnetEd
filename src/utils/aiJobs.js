const crypto = require('crypto');

const jobs = new Map();
const runningByKey = new Map();
const waiters = [];
let busy = false;

function createJob(teacherId, key) {
  const tid = Number(teacherId);
  if (key) {
    const existingId = runningByKey.get(key);
    const existing = existingId ? jobs.get(existingId) : null;
    if (existing && existing.status === 'running' && Number(existing.teacherId) === tid) {
      return { id: existing.id, reused: true };
    }
  }
  const id = crypto.randomBytes(8).toString('hex');
  jobs.set(id, {
    id,
    teacherId: tid,
    key: key || null,
    status: 'running',
    error: null,
    result: null,
    progress: { step: 1, total: 3, label: 'Reading the lesson' },
    createdAt: Date.now()
  });
  if (key) runningByKey.set(key, id);
  return { id, reused: false };
}

function getJobForTeacher(jobId, teacherId) {
  const job = jobs.get(String(jobId || ''));
  if (!job || Number(job.teacherId) !== Number(teacherId)) return null;
  return job;
}

function finishJob(jobId, patch) {
  const job = jobs.get(String(jobId || ''));
  if (!job) return;
  if (job.status === 'done') return;
  Object.assign(job, patch);
  if (job.status !== 'running' && job.key) runningByKey.delete(job.key);
}

function setJobProgress(jobId, progress) {
  const job = jobs.get(String(jobId || ''));
  if (!job || job.status !== 'running') return;
  const step = Number(progress?.step) || 1;
  const total = Number(progress?.total) || 3;
  job.progress = {
    step,
    total,
    label: String(progress?.label || '').trim() || 'Please wait...'
  };
}

function publicJob(job) {
  if (!job) return null;
  return {
    jobId: job.id,
    status: job.status,
    error: job.error || null,
    progress: job.progress || null,
    id: job.result?.id ?? null,
    message: job.result?.message || null,
    provider: job.result?.provider || null
  };
}

function runExclusive(task) {
  return new Promise((resolve, reject) => {
    waiters.push({ task, resolve, reject });
    drainExclusive();
  });
}

async function drainExclusive() {
  if (busy) return;
  const next = waiters.shift();
  if (!next) return;
  busy = true;
  try {
    next.resolve(await next.task());
  } catch (err) {
    next.reject(err);
  } finally {
    busy = false;
    drainExclusive();
  }
}

setInterval(() => {
  const cutoff = Date.now() - 30 * 60 * 1000;
  for (const [id, job] of jobs) {
    if (job.createdAt < cutoff) {
      if (job.key && runningByKey.get(job.key) === id) runningByKey.delete(job.key);
      jobs.delete(id);
    }
  }
}, 5 * 60 * 1000).unref();

module.exports = { createJob, getJobForTeacher, finishJob, setJobProgress, publicJob, runExclusive };
