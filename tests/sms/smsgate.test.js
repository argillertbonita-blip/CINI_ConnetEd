'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const db = require('../../db');
const { toSmsgateRecipient, scoreNoticeBody, ANNOUNCEMENT_SMS_BODY } = require('../../src/utils/sms');

test('SMSGate numbers use +63 and reject non-mobile values', () => {
  assert.equal(toSmsgateRecipient('09171234567'), '+639171234567');
  assert.equal(toSmsgateRecipient('9171234567'), '+639171234567');
  assert.equal(toSmsgateRecipient('+639171234567'), '+639171234567');
  assert.equal(toSmsgateRecipient('639171234567'), '+639171234567');
  assert.equal(toSmsgateRecipient('021234567'), null);
  assert.equal(toSmsgateRecipient('not-a-phone'), null);
  assert.equal(toSmsgateRecipient(''), null);
  assert.equal(toSmsgateRecipient(null), null);
});

test('score texts include the result and announcements stay generic', () => {
  assert.equal(
    scoreNoticeBody({
      firstName: 'Ana',
      lastName: 'Cruz',
      score: 8,
      maxScore: 10,
      title: 'Nouns Sorting Game'
    }),
    'ConnectED: Ana Cruz scored 8/10 on Nouns Sorting Game.'
  );
  assert.equal(ANNOUNCEMENT_SMS_BODY, 'ConnectED: New Announcement Posted');
});

test.after(async () => {
  await new Promise((resolve) => setTimeout(resolve, 200));
  await db.end();
});
