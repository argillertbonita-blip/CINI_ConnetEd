'use strict';

function routingV2Enabled() {
  const value = String(process.env.ROUTING_V2_ENABLED || '').trim().toLowerCase();
  return value === '1' || value === 'true' || value === 'yes';
}

module.exports = { routingV2Enabled };
