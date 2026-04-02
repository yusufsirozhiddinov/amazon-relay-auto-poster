// background.js — FINAL VERSION (copy-paste this entire file)
// === KEEP BACKGROUND ALIVE FOREVER — POPUP OPENS INSTANTLY ===
chrome.runtime.onInstalled.addListener(() => {
  chrome.alarms.create("keepAlive", { delayInMinutes: 0.5, periodInMinutes: 0.5 });
});

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === "keepAlive") {
    // This does nothing but keeps service worker awake
    console.log('%c[PT POSTER] Keep-alive ping', 'color: #0f0');
  }
});
const TARGET_HOST = 'relay.amazon.com';
const INJECT_FILE = 'inpage.js';

// Keep loads in chrome.storage.session (survives sleep, per-tab)
const loadMaps = {}; // in-memory cache
async function getLoadMap(tabId) {
  if (loadMaps[tabId]) return loadMaps[tabId];
  const result = await chrome.storage.session.get(tabId.toString());
  loadMaps[tabId] = result[tabId] || {};
  return loadMaps[tabId];
}
async function setLoadMap(tabId, map) {
  loadMaps[tabId] = map;
  await chrome.storage.session.set({ [tabId]: map });
}
async function clearLoadMap(tabId) {
  delete loadMaps[tabId];
  await chrome.storage.session.remove(tabId.toString());
}

function findLoadByPartialId(loadMap, partialId) {
  for (const fullId in loadMap) {
    if (fullId.includes(partialId)) {
      return loadMap[fullId];
    }
  }
  return null;
}

function extractLoadInfo(load) {
  if (!load) return null;
  const stops = Array.isArray(load.loads) ? load.loads.length + 1 : load.stopCount || 1;
  const payoutRaw = load.payout?.value || 0;
  const milesRaw = load.totalDistance?.value || 1;
  const ratePerMile = Math.floor((payoutRaw / milesRaw) * 100) / 100;

  return {
    pickupCity: load.startLocation?.city || null,
    pickupState: load.startLocation?.state || null,
    pickupLatitude: load.startLocation?.latitude || null,
    pickupLongitude: load.startLocation?.longitude || null,
    pickupTime: load.firstPickupTime || null,
    deliveryCity: load.endLocation?.city || null,
    deliveryState: load.endLocation?.state || null,
    deliveryLatitude: load.endLocation?.latitude || null,
    deliveryLongitude: load.endLocation?.longitude || null,
    deliveryTime: load.lastDeliveryTime || null,
    payout: Math.trunc(payoutRaw),
    stops: stops,
    miles: Math.trunc(milesRaw),
    ratePerMile: ratePerMile,
    driverType: load.transitOperatorType === "TEAM_DRIVER" ? "TEAM" : "SOLO"
  };
}

// COPY_LOAD_ID — now works even after service worker sleep
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type !== "COPY_LOAD_ID") return false;

  (async () => {
    const tabId = sender.tab?.id;
    if (!tabId || !msg.loadId) {
      sendResponse({ success: false, error: "Invalid request" });
      return;
    }

    const loadMap = await getLoadMap(tabId);
    const matchedLoad = findLoadByPartialId(loadMap, msg.loadId);

    if (!matchedLoad) {
      sendResponse({ success: false, error: "Load not found (maybe old search)" });
      return;
    }

    const loadInfo = extractLoadInfo(matchedLoad);
    const jsonToCopy = JSON.stringify(loadInfo, null, 2);

    chrome.tabs.sendMessage(tabId, { action: "COPY_TO_CLIPBOARD", data: jsonToCopy }, () => {
      if (chrome.runtime.lastError) {
        console.warn("Content script unreachable:", chrome.runtime.lastError.message);
      }
      sendResponse({ success: true, data: loadInfo });
    });
  })();

  return true; // async response
});

// Capture API responses and store all loads
chrome.runtime.onMessage.addListener((msg, sender) => {
  if (msg.type !== 'relay-capture') return;
  const payload = msg.payload;
  const tabId = sender.tab?.id;
  if (!tabId || payload.type !== 'request-end') return;

  const opportunities = payload.responseBody?.workOpportunities || {};
  (async () => {
    const map = await getLoadMap(tabId);
    for (const key in opportunities) {
      const load = opportunities[key];
      if (load.id) map[load.id] = load;
    }
    await setLoadMap(tabId, map);
  })();
});

// === ULTIMATE INJECTION CONTROL — NO ERRORS, NO DOUBLE INJECTION ===
const injectedTabs = new Set();

const tryInject = async (tabId) => {
  if (injectedTabs.has(tabId)) {
    console.log('[PT POSTER] Already injected → tab', tabId);
    return;
  }

  try {
    await chrome.scripting.executeScript({
      target: { tabId, allFrames: false },
      files: ['inpage.js'],
      world: 'MAIN'
    });
    injectedTabs.add(tabId);
    console.log('[PT POSTER] inpage.js injected → tab', tabId);
  } catch (err) {
    console.warn('[PT POSTER] Injection failed:', err.message);
  }
};

// 1. Inject on page load
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete' && tab.url?.includes('relay.amazon.com')) {
    tryInject(tabId);
  }
});

// 2. Backup: content script request
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type === 'inject-request' && sender.tab?.id) {
    tryInject(sender.tab.id);
    sendResponse({ ok: true });
    return true;
  }
});

// 3. CRITICAL: Handle SPA navigation (Relay is React SPA)
if (chrome.webNavigation) {
  chrome.webNavigation.onCommitted.addListener((details) => {
    if (details.frameId === 0 && details.url.includes('relay.amazon.com')) {
      injectedTabs.delete(details.tabId);
      console.log('[PT POSTER] SPA navigation detected → allowing re-injection for tab', details.tabId);
    }
  });
} else {
    console.warn('[PT POSTER] chrome.webNavigation not available (missing permission)');
}

// 4. Cleanup
chrome.tabs.onRemoved.addListener((tabId) => {
  injectedTabs.delete(tabId);
});

// Cleanup on tab close
chrome.tabs.onRemoved.addListener((tabId) => {
  clearLoadMap(tabId);
});





console.log('[relay-monitor] background ready');