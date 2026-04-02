// popup.js — FINAL WITH AUTO-FILL PAYOUT + RATE + ENTER KEY + TEXTAREA → POST BUTTON REPLACEMENT
// === DEFAULT SETTINGS ===
// === LOAD & SAVE COPY MODE ===
async function loadCopyMode() {
  const saved = await chrome.storage.sync.get({ copyButtonMode: "card" });
  const value = saved.copyButtonMode || "card";

  // Set active radio
  document.querySelector(`input[name="copyMode"][value="${value}"]`).checked = true;
}

// Save on change
document.querySelectorAll('input[name="copyMode"]').forEach(radio => {
  radio.addEventListener("change", (e) => {
    const value = e.target.value;
    chrome.storage.sync.set({ copyButtonMode: value });
    
    document.getElementById("output").textContent = 
      value === "card" ? "Now using FAST mode (recommended)" : "Using classic sidebar mode";
    document.getElementById("output").style.color = "#27ae60";
    setTimeout(() => {
      document.getElementById("output").textContent = "";
    }, 2000);
  });
});


// === FUTURE LOAD BLOCKING TOGGLE ===
async function loadFutureBlockSetting() {
  const result = await chrome.storage.sync.get({ blockFutureLoads: true });
  document.getElementById("futureLoadBlockToggle").checked = result.blockFutureLoads;
}

document.getElementById("futureLoadBlockToggle").addEventListener("change", (e) => {
  const enabled = e.target.checked;
  chrome.storage.sync.set({ blockFutureLoads: enabled });

  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    if (tabs[0]?.id) {
      chrome.tabs.sendMessage(tabs[0].id, {
        type: "FUTURE_BLOCK_TOGGLE",
        enabled: enabled
      });
    }
  });
});

// Load on startup
document.addEventListener("DOMContentLoaded", () => {
  loadCopyMode();
  loadFutureBlockSetting();
});
let isFormatted = false;
let dotInterval;
let currentLoad = null;
// Helpers
function convertState(input) {
  const states = { "Alabama": "AL", "Alaska": "AK", "Arizona": "AZ", "Arkansas": "AR", "California": "CA", "Colorado": "CO", "Connecticut": "CT", "Delaware": "DE", "Florida": "FL", "Georgia": "GA", "Hawaii": "HI", "Idaho": "ID", "Illinois": "IL", "Indiana": "IN", "Iowa": "IA", "Kansas": "KS", "Kentucky": "KY", "Louisiana": "LA", "Maine": "ME", "Maryland": "MD", "Massachusetts": "MA", "Michigan": "MI", "Minnesota": "MN", "Mississippi": "MS", "Missouri": "MO", "Montana": "MT", "Nebraska": "NE", "Nevada": "NV", "New Hampshire": "NH", "New Jersey": "NJ", "New Mexico": "NM", "New York": "NY", "North Carolina": "NC", "North Dakota": "ND", "Ohio": "OH", "Oklahoma": "OK", "Oregon": "OR", "Pennsylvania": "PA", "Rhode Island": "RI", "South Carolina": "SC", "South Dakota": "SD", "Tennessee": "TN", "Texas": "TX", "Utah": "UT", "Vermont": "VT", "Virginia": "VA", "Washington": "WA", "West Virginia": "WV", "Wisconsin": "WI", "Wyoming": "WY" };
  const normalized = input?.trim();
  if (states[normalized]) return states[normalized];
  const abbr = normalized?.toUpperCase();
  if (Object.values(states).includes(abbr)) return abbr;
  return input || "";
}

function convertCityName(city) {
  if (!city) return "";
  const replacements = { "MOUNT": "MT.", "SAINT": "ST." };
  const parts = city.toUpperCase().split(" ");
  if (replacements[parts[0]]) parts[0] = replacements[parts[0]];
  return parts.join(" ");
}

// ----------------------------
// CSRF Token
// ----------------------------
function getToken(callback) {
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    chrome.scripting.executeScript(
      {
        target: { tabId: tabs[0].id },
        function: () => {
          const metaTag = document.querySelector(
            "meta[name='x-owp-csrf-token']"
          );
          return metaTag ? metaTag.getAttribute("content") : null;
        },
      },
      (results) => {
        const token = results?.[0]?.result;
        callback(token);
      }
    );
  });
}

// === TAB SWITCHING LOGIC ===
document.querySelectorAll('.tab').forEach(tab => {
  tab.addEventListener('click', () => {
    const target = tab.getAttribute('data-tab');

    // Update active tab
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    tab.classList.add('active');

    // Show correct content
    document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
    document.getElementById(target).classList.add('active');
  });
});

function showLoadOutput(load, status = "idle") {
  const outputDiv = document.getElementById("output");
  outputDiv.style.color = "green";
outputDiv.innerHTML = `
  <div style="
    font-size: 15px;
    color: green;
  ">
    <strong>Stops:</strong> ${load.stops}<br>
    <strong>Pick up address:</strong> ${load.pickupCity}, ${load.pickupState}<br>
    <strong>Delivery address:</strong> ${load.deliveryCity}, ${load.deliveryState}<br>
    <strong>Total price:</strong> $${load.payout}<br>
    <strong>Rate per mile:</strong> $${load.ratePerMile}<br>
    <strong>Driver type:</strong> ${load.driverType}<br>
    <strong>Total miles:</strong> ${load.miles} mi<br>
  </div>
`;
}

function adjustTimeByOneMinute(isoStr, type = "pickup") {
  const date = new Date(isoStr);
  if (type === "pickup") date.setMinutes(date.getMinutes() - 10);
  if (type === "delivery") date.setMinutes(date.getMinutes() + 1);
  return date.toISOString();
}
// Animation
function animateStatus(message) {
  const output = document.getElementById("output");
  let dots = 0;
  clearInterval(dotInterval);
  output.textContent = message;
  dotInterval = setInterval(() => {
    dots = (dots + 1) % 4;
    output.textContent = message + ".".repeat(dots);
  }, 500);
}

// ENTER KEY HANDLER
document.getElementById("inputText").addEventListener("keydown", (e) => {
  if (e.key === "Enter" && !e.shiftKey) {
    e.preventDefault();
    const input = document.getElementById("inputText").value.trim();
    if (!input) {
      document.getElementById("output").textContent = "Input is empty!";
      document.getElementById("output").style.color = "red";
      return;
    }
    if (!isFormatted) {
      document.getElementById("formatBtn").click();
    } else {
      document.getElementById("upsertBtn").click();
    }
  }
});

// FORMAT BUTTON — NOW AUTO-FILLS PAYOUT & RATE FROM JSON
document.getElementById("formatBtn").addEventListener("click", async () => {
  const rawText = document.getElementById("inputText");
  if (!rawText.value.trim()) {
    document.getElementById("output").textContent = "Nothing to format!";
    document.getElementById("output").style.color = "red";
    return;
  }
  
    try{
      const load = JSON.parse(rawText.value);
    // Create variables dynamically
      const {
        pickupCity,
        pickupState,
        pickupLatitude,
        pickupLongitude,
        pickupTime,
        deliveryCity,
        deliveryState,
        deliveryLatitude,
        deliveryLongitude,
        deliveryTime,
        payout,
        stops,
        miles,
        ratePerMile,
        driverType
      } = load;
        currentLoad = load;
        window.currentLoad = load;
        showLoadOutput(load); // show formatted load
        rawText.remove();    // Show payout and rate input fields
        // AUTO-SELECT DRIVER TYPE
        
        const payoutEditor = document.getElementById("payoutEditor");
        payoutEditor.style.display = "block";
        document.getElementById("payoutInput").value = load.payout || 0;
        document.getElementById("rateInput").value = load.ratePerMile || 0;

        // Update global load when inputs change
        document.getElementById("payoutInput").addEventListener("input", (e) => {
            window.currentLoad.totalPrice = parseFloat(e.target.value) || 0;
        });
        document.getElementById("rateInput").addEventListener("input", (e) => {
            window.currentLoad.ratePerMile = parseFloat(e.target.value) || 0;
        });
    } catch (err) {
        document.getElementById("output").textContent = "Invalid JSON!";
        document.getElementById("output").style.color = "red";
        isFormatted = false;
    }
});


// ----------------------------
// Build Upsert Body (with safe values)
// ----------------------------
async function buildUpsertBody(load, shiftHours = 0) {
  // Optionally destructure variables if needed
const {
  pickupCity,
  pickupState,
  pickupLatitude,
  pickupLongitude,
  pickupTime,
  deliveryCity,
  deliveryState,
  deliveryLatitude,
  deliveryLongitude,
  deliveryTime,
  payout,
  stops,
  miles,
  ratePerMile,
  driverType
} = load;

    // --- Safe values from inputs ---
  let payoutInput = ((parseFloat(document.getElementById("payoutInput").value) - 1).toFixed(2)) || payout.toString();
  let rateInput = ((parseFloat(document.getElementById("rateInput").value) - 0.01).toFixed(2)) || ratePerMile.toFixed(2);


  const minDistanceValue = Math.floor(miles - 10); // min miles
  const maxDistanceValue = Math.ceil(miles + 10);  // max miles

  // --- Dropdowns ---
  const equipmentType = document.getElementById("equipmentType").value;
  const pickupTimeISO = adjustTimeByOneMinute(pickupTime, "pickup"); // now includes +5h
  const deliveryTimeISO = adjustTimeByOneMinute(deliveryTime, "delivery");
  // --- Equipment JSON ---
  let visibleEquipmentTypes = "";
  let equipmentTypes = [];

  if (equipmentType === "FIFTY_THREE_FOOT_TRUCK") {
    visibleEquipmentTypes = "FIFTY_THREE_FOOT_TRUCK";
    equipmentTypes = [
      "FIFTY_THREE_FOOT_TRUCK",
      "SKIRTED_FIFTY_THREE_FOOT_TRUCK",
      "FIFTY_THREE_FOOT_DRY_VAN",
      "FIFTY_THREE_FOOT_A5_AIR_TRAILER",
      "FORTY_FIVE_FOOT_TRUCK",
    ];
  } else if (equipmentType === "FIFTY_THREE_FOOT_CONTAINER") {
    visibleEquipmentTypes = "FIFTY_THREE_FOOT_CONTAINER";
    equipmentTypes = ["FIFTY_THREE_FOOT_CONTAINER"];
  }
  return {
  runType: "ONE_WAY",
  originCityInfo: {
    name: convertCityName(pickupCity),
    stateCode: convertState(load.pickupState),
    country: "US",
    latitude: pickupLatitude,
    longitude: pickupLongitude,
    displayValue: `${convertCityName(pickupCity)}, ${convertState(pickupState)}`,
    isCityLive: false,
    isAnywhere: false,
    uniqueKey: `${pickupLatitude}${pickupCity}`,
  },
  originCityRadius: { value: 15, unit: "mi" },
  destinationCityInfo: null,
  destinationCityRadius: { value: 25, unit: "mi" },
  startTime: pickupTimeISO,
  endTime: deliveryTimeISO,
  distanceOrDuration: "DISTANCE",
  minDistance: { value: minDistanceValue, unit: "mi" },
  maxDistance: { value: maxDistanceValue, unit: "mi" },
  driverTypes: [driverType],
  payoutType: "FLAT_RATE",
  totalCost: { value: payoutInput, unit: "USD" },
  costPerDistance: {
    value: rateInput,
    currencyUnit: "USD",
    distanceUnit: "mi",
  },
  visibleProvidedTrailerType: "AMAZON_PROVIDED",
  providedTrailerType: "AMAZON_PROVIDED",
  visibleEquipmentTypes,
  equipmentTypes,
  maxNumberOfStops: stops,
  minPickUpBufferInMinutes: "5",
  exclusionCityList: [],
  endLocationList: [
    {
      name: convertCityName(deliveryCity),
      stateCode: convertState(deliveryState),
      country: "US",
      latitude: deliveryLatitude,
      longitude: deliveryLongitude,
      displayValue: `${convertCityName(deliveryCity)}, ${convertState(deliveryState)}`,
      uniqueKey: `${deliveryLatitude}${deliveryCity}`,
    },
  ],
  endRegionList: [],
  supplyDriverIdList: [],
  supplyTransientDriverIdList: [],
  loadingTypeList: ["LIVE"],
  matchingDemands: [],
  matchingWork: 0,
  isCheckingMatchingWork: false,
  isMatchingWorkLoaded: false,
  auditMetaData: { suggestedCostPerDistance: null, matchOutlookScore: "LOW" },
  patOrderContext: null,
  cancellationDetails: null,
};

}



// POST BUTTON (unchanged)
document.getElementById("upsertBtn").addEventListener("click", async () => {
// const rawText = document.getElementById("inputText").value;

// // Parse the JSON from input
// const load = JSON.parse(rawText);

  const body = await buildUpsertBody(currentLoad);

  getToken((csrfToken) => {
    if (!csrfToken) {
      clearInterval(dotInterval);
      document.getElementById("output").textContent =
        "❌ CSRF token not found. Reload Amazon Relay.";
      document.getElementById("output").style.color = "red";
      return;
    }



// Send it via executeScript
chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
  chrome.scripting.executeScript(
    {
      target: { tabId: tabs[0].id },
      func: (csrfToken, body) => {
        return fetch(
          "https://relay.amazon.com/api/loadboard/orders/upsert",
          {
            method: "POST",
            headers: {
              "content-type": "application/json",
              accept: "application/json",
              "x-csrf-token": csrfToken,
              origin: "https://relay.amazon.com",
              referer: "https://relay.amazon.com/loadboard/search",
            },
            body: JSON.stringify(body), // <- use parsed load from input
            credentials: "include",
          }
        )
          .then(async (res) => {
            const text = await res.text();
            try {
              return {
                ok: res.ok,
                status: res.status,
                data: JSON.parse(text),
              };
            } catch {
              return { ok: res.ok, status: res.status, raw: text };
            }
          })
          .catch((err) => ({ ok: false, error: err.message }));
      },
      args: [csrfToken, body], // <- pass load from input here
    },
    (results) => {
      const result = results?.[0]?.result;
      clearInterval(dotInterval);

      if (result?.ok) {
        document.getElementById("output").textContent = "DONE";
        document.getElementById("output").style.color = "green";
        document.getElementById("output").style.fontWeight = 600;
        setTimeout(() => showLoadOutput(window.currentLoad, "success"), 1000);
      } else {
        document.getElementById("output").textContent = "❌ Failed to put post!";
        document.getElementById("output").style.color = "red";
        console.error("Upsert failed:", result);
      }
    }
  );
});
  });
});


// Reset on input change
document.getElementById("inputText").addEventListener("input", () => {
  isFormatted = false;
  document.getElementById("payoutEditor").style.display = "none";
  document.getElementById("output").textContent = "";
});

window.onload = () => document.getElementById("inputText").focus();