const STORAGE_KEY = 'connected.auth.event';

export function createSessionSync(ownTabId) {
  let channel = null;
  try {
    channel = new BroadcastChannel('auth');
  } catch {
    channel = null;
  }

  function publish(type) {
    const event = { type, tabId: ownTabId, at: Date.now() };
    try { channel?.postMessage(event); } catch { /* ignore */ }
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(event)); } catch { /* ignore */ }
  }

  function listen(onEvent) {
    const take = (event) => {
      if (!event || event.tabId === ownTabId) return;
      if (event.type !== 'LOGOUT' && event.type !== 'LOGIN' && event.type !== 'PING' && event.type !== 'PONG') return;
      onEvent(event.type);
    };
    channel?.addEventListener('message', (message) => take(message.data));
    window.addEventListener('storage', (storageEvent) => {
      if (storageEvent.key !== STORAGE_KEY || !storageEvent.newValue) return;
      try { take(JSON.parse(storageEvent.newValue)); } catch { /* ignore */ }
    });
  }

  return { publish, listen };
}
