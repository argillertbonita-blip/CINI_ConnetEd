'use strict';

function acceptAuthEvent(event, ownTabId) {
  if (!event || typeof event !== 'object') return null;
  if (!event.type || event.tabId === ownTabId) return null;
  if (event.type !== 'LOGOUT' && event.type !== 'LOGIN') return null;
  return event.type;
}

module.exports = { acceptAuthEvent };
