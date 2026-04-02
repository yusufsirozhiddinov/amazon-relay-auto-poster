// =============================================
// PT POSTER — content.js — FINAL VERSION (2025)
// =============================================
// Features:
// • Dual Copy Button Mode (Popup + Card)
// • Perfect Load ID detection (inner div[id])
// • Only clicked button says "Copied!"
// • No ghost buttons
// • No "Extension context invalidated"
// • Safe storage
// • Font errors silenced
// • Future load blocking + checkbox
// • Auto driver type ready
// =============================================
window.__ALLOW_FUTURE_LOAD_ONCE__ = false;
// === PREVENT CRASHES WHEN EXTENSION RELOADS ===
chrome.runtime.onConnect.addListener(() => { });
chrome.runtime.onMessage.addListener(() => true); // keep port alive
// === 1. SILENCE AMAZON'S GARBAGE FONT ERRORS ===
(() => {
  const origError = console.error;
  console.error = (...args) => {
    if (typeof args[0] === 'string' && (
      args[0].includes('OTS parsing error') ||
      args[0].includes('Failed to decode downloaded font') ||
      args[0].includes('invalid sfntVersion')
    )) {
      return;
    }
    origError.apply(console, args);
  };
})();
// === 2. SAFE STORAGE GET (NO CRASHES EVER) ===
async function getSetting(key, defaultValue) {
  return new Promise((resolve) => {
    try {
      chrome.storage.sync.get({ [key]: defaultValue }, (result) => {
        if (chrome.runtime.lastError) {
          resolve(defaultValue);
        } else {
          resolve(result[key]);
        }
      });
    } catch {
      resolve(defaultValue);
    }
  });
}
getSetting("blockFutureLoads", true).then(value => {
  window.FUTURE_LOAD_BLOCKING_ENABLED = value;

  console.log("%c[PT POSTER] Future Load Blocking (loaded): " + value,
              "color:#e67e22;font-weight:bold");

  // Run immediately using correct setting
  runDateBlocking();
});
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === "FUTURE_BLOCK_TOGGLE") {
    window.FUTURE_LOAD_BLOCKING_ENABLED = message.enabled;
    console.log('%c[PT POSTER] Future Load Blocking →', 'color: #e74c3c; font-weight: bold', message.enabled ? 'ON' : 'OFF');
    
    // Re-run blocking on all current cards
    runDateBlocking();
    return true;
  }
  return false;
});
// === 3. CREATE UNIQUE BUTTON (NO SHARED STATE) ===
function createFreshCopyButton() {
  const btn = document.createElement("button");
  btn.textContent = "Copy";
  btn.classList.add("my-copy-btn");
  Object.assign(btn.style, {
    height: "38px",
    fontSize: "13.5px",
    fontWeight: "700",
    borderRadius: "10px",
    background: "#09FF74",
    color: "black",
    border: "none",
    cursor: "pointer",
    boxShadow: "0 3px 8px rgba(9,255,116,0.3)",
    transition: "all 0.2s",
    fontFamily: "inherit",
    zIndex: "10"
  });


const style = document.createElement('style');
style.textContent = `
.css-1jxh1bg > :nth-child(2) {
  width: calc(32.41%) !important;
}
.css-1jxh1bg > :nth-child(3) {
  width: calc(8.33%) !important;
}
.css-1jxh1bg > :nth-child(5) {
  width: calc(11.11%) !important;
}
.css-1jxh1bg > :nth-child(6) {
  width: calc(9.26%) !important;
}
.css-1jxh1bg > :nth-child(7) {
  width: calc(13.89%) !important;
}
.css-1jxh1bg > .my-copy-btn {
  width: calc(6%) !important;
}
`;
document.head.appendChild(style);

  return btn;
}

// === 4. DATE BLOCKING (FUTURE LOADS) ===
function checkAndDisable(timeString) {
  const btn = document.getElementById("rlb-book-btn");
  if (!btn) return;

  const shouldBlock = window.FUTURE_LOAD_BLOCKING_ENABLED !== false;
  if (window.__ALLOW_FUTURE_LOAD_ONCE__ === true) {
  return;
}
  if (!isWithin12Hours(timeString) && shouldBlock) {
    btn.disabled = true;
    btn.style.backgroundColor = "gray";
    btn.style.color = "white";
    btn.style.cursor = "not-allowed";
    btn.style.opacity = "0.6";
    btn.textContent = "⚠️ BOOK"; // updated text with warning

    // Only inject checkbox if load is more than 12 hours away
    injectFutureLoadCheckbox(timeString);
  } else {
    btn.disabled = false;
    btn.style.backgroundColor = "";
    btn.style.color = "";
    btn.style.cursor = "";
    btn.style.opacity = "";
    btn.textContent = "Book"; // reset text
  }
}

function injectFutureLoadCheckbox(timeString) {
  // Only inject if button is disabled (future load)
  const btn = document.getElementById("rlb-book-btn");
  if (!btn || !btn.disabled) return;

  const container = document.querySelector(".css-8ubre6");
  if (!container) return;

  // Prevent double injection
  if (document.getElementById("future-load-checkbox")) return;

  // Create checkbox + label
  const label = document.createElement("label");
  label.style.display = "flex";
  label.style.alignItems = "center";
  label.style.gap = "10px";
  label.style.fontSize = "18px";
  label.style.fontWeight = "600";
  label.style.marginTop = "12px";
  label.style.cursor = "pointer";

  const checkbox = document.createElement("input");
  checkbox.type = "checkbox";
  checkbox.id = "future-load-checkbox";
  checkbox.style.width = "22px";
  checkbox.style.height = "22px";
  checkbox.style.cursor = "pointer";

  const text = document.createTextNode("BOOK FUTURE LOAD");

  label.appendChild(checkbox);
  label.appendChild(text);
  container.appendChild(label);

  // Handle checkbox toggle
  checkbox.addEventListener("change", () => {
  const card = btn.closest(".load-card, .load-card__selected");

  if (checkbox.checked) {
    window.__ALLOW_FUTURE_LOAD_ONCE__ = true;

    btn.disabled = false;
    btn.style.backgroundColor = "";
    btn.style.color = "";
    btn.style.cursor = "";
    btn.style.opacity = "";
    btn.textContent = "Book";
  } else {
    window.__ALLOW_FUTURE_LOAD_ONCE__ = false;
    checkAndDisable(timeString);
  }
});

}

function runDateBlocking() {
  document.querySelectorAll(".css-5e70kp").forEach(block => {
    try {
      // walk exactly as your architecture
      const outerDiv = block.querySelector(":scope > div:nth-child(2)");
      const dateP = outerDiv?.querySelector(":scope > p.css-1maqsxd.css-1gmvhuf");
      const innerDiv = dateP?.querySelector(":scope > div.css-163ns6o");
      const dateSpan = innerDiv?.querySelector(":scope > span.wo-card-header__components");

      if (!dateSpan) return; // nothing to do for this block

      const dateText = dateSpan.textContent.trim();
      console.log(dateText);
      // DEBUG (uncomment to inspect): console.log(dateText, isTodayRobust(dateText))
      checkAndDisable(dateText);
    } catch (err) {
      console.error("Error processing block:", err);
    }
  });
}

// === 5. MAIN ATTACH LISTENER ===
let firstEntity = null;

async function attachListener() {
  const mode = await getSetting("copyButtonMode", "popup");

  // === CARD MODE ===
  if (mode === "card") {
    const loadList = document.querySelector(".load-list");
    if (!loadList) return;

    const cards = loadList.querySelectorAll(".load-card, .load-card__selected");
    runDateBlocking();
    cards.forEach(card => {
      if (card.querySelector(".my-copy-btn")) return;

      const idDiv = card.querySelector("div[id]");
      if (!idDiv?.id || idDiv.id.length < 10) return;

      const milesRow = card.querySelector(".css-8a5j1c");
      const driverRow = card.querySelector(".css-3kf4i7");
      if (!milesRow || !driverRow) return;

      const btn = createFreshCopyButton();
      milesRow.parentNode.insertBefore(btn, driverRow);

      btn.addEventListener("click", async (e) => {
        e.stopPropagation();
        e.preventDefault();

        btn.textContent = "Copying...";
        btn.style.background = "#00aaff";

        await new Promise(r => setTimeout(r, 80));

        const currentIdDiv = card.querySelector("div[id]");
        if (!currentIdDiv?.id) {
          btn.textContent = "No ID";
          btn.style.background = "#ff4444";
          setTimeout(() => {
            btn.textContent = "Copy";
            btn.style.background = "#09FF74";
          }, 1500);
          return;
        }

        const loadId = currentIdDiv.id;
        console.log("%c[COPY] Load ID → " + loadId, "background:#000;color:#0f0;font-size:14px;font-weight:bold");

        try {
          const resp = await chrome.runtime.sendMessage({
            type: "COPY_LOAD_ID",
            loadId: loadId
          });

          if (resp?.success) {
            btn.textContent = "Copied!";
            btn.style.background = "#00D15E";
            setTimeout(() => {
              btn.textContent = "Copy";
              btn.style.background = "#09FF74";
            }, 1200);
          } else {
            btn.textContent = "Not Found";
            btn.style.background = "#ff4444";
            setTimeout(() => {
              btn.textContent = "Copy";
              btn.style.background = "#09FF74";
            }, 1500);
          }
        } catch (err) {
          btn.textContent = "Error";
          btn.style.background = "#ff0000";
          setTimeout(() => {
            btn.textContent = "Copy";
            btn.style.background = "#09FF74";
          }, 1500);
        }
      });
    });

    return;
  }

  // === POPUP MODE (original) ===
  const entities = Array.from(document.querySelectorAll(".entity-id"))
    .filter(el => el && el.offsetParent !== null);

  if (entities.length === 0) return;
  if (firstEntity === entities[0]) return;
  firstEntity = entities[0];

  const targetDiv = [...document.querySelectorAll("div.css-1q48g4q")]
    .find(div => div && div.querySelector("p.css-1nws0dp"));

  if (targetDiv && !targetDiv.querySelector(".my-copy-btn")) {
    const btn = createFreshCopyButton();
    btn.style.width = "110px";
    btn.style.height = "40px";
    const ref = targetDiv.querySelector("p.css-1nws0dp");
    if (ref) {
      targetDiv.insertBefore(btn, ref);
    } else {
      targetDiv.appendChild(btn);
    }

    btn.addEventListener("click", async () => {
      const loadId = getInfo();
      if (!loadId) return;

      btn.textContent = "Copying...";
      try {
        const resp = await chrome.runtime.sendMessage({
          type: "COPY_LOAD_ID",
          loadId: loadId
        });
        if (resp?.success) {
          btn.textContent = "Copied!";
          btn.style.background = "#00D15E";
          setTimeout(() => {
            btn.textContent = "Copy";
            btn.style.background = "#09FF74";
          }, 1500);
        }
      } catch (err) {
        btn.textContent = "Error";
        btn.style.background = "#ff0000";
      }
    });
  }

  runDateBlocking();
}

// === 6. OBSERVER ===
const observer = new MutationObserver(attachListener);
observer.observe(document.body, { childList: true, subtree: true });
attachListener();

// === 7. FORWARD MESSAGES FROM INPAGE ===
// === 7. FORWARD MESSAGES FROM INPAGE — NEVER CRASHES ===
window.addEventListener('message', (event) => {
  if (event.data?.__RELAY_MONITOR__) {
    // SAFE SEND — checks if runtime exists
    try {
      if (chrome.runtime?.id) {
        chrome.runtime.sendMessage({
          type: 'relay-capture',
          payload: event.data
        });
      }
    } catch (err) {
      // Silently ignore — extension is reloading
      console.log('%c[PT POSTER] Background unavailable (reloading?) — message skipped', 'color: #999');
    }
  }
});

// === 8. REQUEST INPAGE INJECTION ===
try {
  chrome.runtime.sendMessage({ type: 'inject-request' });
} catch (e) { }

// === 9. CLIPBOARD FROM BACKGROUND ===
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === "COPY_TO_CLIPBOARD") {
    navigator.clipboard.writeText(message.data).then(() => {
      sendResponse({ success: true });
    }).catch(() => {
      sendResponse({ success: false });
    });
    return true;
  }
  return false;
});

// === 10. HELPER: GET INFO FROM POPUP MODE ===
function getInfo() {
  const entityDivs = document.querySelectorAll(".entity-id");
  const p = entityDivs[0]?.querySelector("p");
  if (!p) return null;
  const text = p.textContent.trim();
  const parts = text.split("...");
  return parts.length > 1 ? parts[1] : null;
}

// === 11. TIMEZONE LOGIC (isWithin12Hours) ===
function isWithin12Hours(timeStr) {
  try {
    // -------------------------------------------------
    // 1. Parse the input string
    // -------------------------------------------------
    const m = timeStr.match(
      /^(\w{3})\s+(\w{3})\s+(\d{1,2})\s+(\d{2}):(\d{2})\s+(\w{3,4})$/
    );
    if (!m) throw new Error('Invalid format – expected "Tue Nov 4 01:43 MST"');

    const [, dow, monAbbr, dayStr, hourStr, minStr, tz] = m;
    const day   = Number(dayStr);
    const hour  = Number(hourStr);
    const minute = Number(minStr);

    // -------------------------------------------------
    // 2. Map 3-letter code → IANA zone (DST-aware)
    // -------------------------------------------------
    const zoneMap = {
      CST: 'America/Chicago', CDT: 'America/Chicago',
      MST: 'America/Denver',  MDT: 'America/Denver',
      PST: 'America/Los_Angeles', PDT: 'America/Los_Angeles',
      EST: 'America/New_York', EDT: 'America/New_York',
    };
    const iana = zoneMap[tz];
    if (!iana) throw new Error(`Unsupported timezone: ${tz}`);

    // -------------------------------------------------
    // 3. Build the target moment (current year)
    // -------------------------------------------------
    const now = new Date();                     // local “now”
    let year = now.getFullYear();               // <-- keep this, but mutable

    const monthNames = ['Jan','Feb','Mar','Apr','May','Jun',
                        'Jul','Aug','Sep','Oct','Nov','Dec'];
    const month = monthNames.indexOf(monAbbr);
    if (month === -1) throw new Error(`Invalid month: ${monAbbr}`);

    // Create a Date object that *represents* the target time **in the target zone**
    let targetLocal = new Date(year, month, day, hour, minute, 0);

    // -------------------------------------------------
    // 🔑 YEAR ROLLOVER FIX (ONLY ADDITION)
    // -------------------------------------------------
    // If the parsed date is clearly in the past, assume next year
    if (targetLocal.getTime() < now.getTime() - (12 * 60 * 60 * 1000)) {
      year += 1;
      targetLocal = new Date(year, month, day, hour, minute, 0);
    }

    // -------------------------------------------------
    // 4. Convert targetLocal → UTC using the IANA zone (DST handled)
    // -------------------------------------------------
    const targetUTC = targetLocal.getTime() -
                      targetLocal.getTimezoneOffset() * 60_000 +   // local offset of this machine
                      getTargetOffsetMs(targetLocal, iana);       // offset of the *target* zone

    // -------------------------------------------------
    // 5. Compare with real “now” (UTC)
    // -------------------------------------------------
    const nowUTC = Date.now();                     // milliseconds since epoch (UTC)
    const twelveHoursMs = 12 * 60 * 60 * 1000;

    // -------------------------------------------------

    return (targetUTC - nowUTC) <= twelveHoursMs;
  } catch (e) {
    console.error('isWithin12Hours error:', e.message);
    return false;   // safe fallback
  }
}

function getTargetOffsetMs(localDate, ianaZone) {
  const fmt = new Intl.DateTimeFormat('en-CA', {
    timeZone: ianaZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });

  const parts = fmt.formatToParts(localDate);
  const obj = parts.reduce((acc, p) => (acc[p.type] = p.value, acc), {});

  const utc = Date.UTC(
    +obj.year,
    +obj.month - 1,
    +obj.day,
    +obj.hour,
    +obj.minute,
    +obj.second || 0
  );

  // offset = localDate.getTime() - utc
  return localDate.getTime() - utc;
}

console.log('%c[PT POSTER] DOMINATION COMPLETE', 'color: #0f0; font-weight: bold; font-size: 16px;');