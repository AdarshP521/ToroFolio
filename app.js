/* ==========================================
   TOROFOLIO - CLIENT ORCHESTRATOR
   Implements pristine 0-balance personal ledger tracking,
   auto-login session persistence, real-time Finnhub APIs,
   and dynamic technical charting dashboards.
   ========================================== */

// --- Firebase Live Integration Global States ---
let isFirebaseConnected = false;
let authFirebase = null;
let dbFirestore = null;

// --- Local SQLite Backend Integration Global States ---
let isLocalBackendActive = false;

async function checkLocalBackendActive() {
    try {
        const res = await fetch('/api/health');
        if (res.ok) {
            const data = await res.json();
            if (data.status === "ok" && data.database === "sqlite") {
                isLocalBackendActive = true;
                console.log("Connected to dynamic SQLite Local Database Server!");
            }
        }
    } catch (err) {
        console.log("SQLite backend not detected. Reverting to Simulated Mode.");
        isLocalBackendActive = false;
    }
}

let USD_TO_INR = 83.50;

async function fetchLiveExchangeRate() {
    // Pure Indian Rupee (₹) ledger exclusivity
    console.log("System initialized with native Indian Rupee (₹) exclusivity.");
}

function getConvertedValue(val) {
    return val;
}

function formatCurrency(val, excludeSymbol = false) {
    if (excludeSymbol) {
        return val.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    }
    return "₹" + val.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function initializeFirebaseIfConfigured() {
    const configStr = localStorage.getItem("ToroFolio_firebase_config");
    const statusBadge = document.getElementById("firebase-status-badge");
    const configTextarea = document.getElementById("firebase-config-input");
    
    if (configTextarea && configStr) {
        configTextarea.value = configStr;
    }

    if (isLocalBackendActive) {
        isFirebaseConnected = false;
        if (statusBadge) {
            statusBadge.className = "fb-badge fb-badge-live";
            statusBadge.textContent = "Live Mode (SQLite Server Connected)";
        }
        return;
    }

    if (!configStr) {
        isFirebaseConnected = false;
        if (statusBadge) {
            statusBadge.className = "fb-badge fb-badge-simulated";
            statusBadge.textContent = "Simulated Mode (Local DB)";
        }
        return;
    }
    
    try {
        const config = JSON.parse(configStr);
        if (!firebase.apps.length) {
            firebase.initializeApp(config);
        }
        authFirebase = firebase.auth();
        dbFirestore = firebase.firestore();
        isFirebaseConnected = true;
        
        if (statusBadge) {
            statusBadge.className = "fb-badge fb-badge-live";
            statusBadge.textContent = "Live Mode (Firebase Connected)";
        }
        console.log("Firebase dynamic sync engine initialized successfully!");
    } catch (e) {
        console.error("Firebase dynamic sync engine failed:", e);
        isFirebaseConnected = false;
        if (statusBadge) {
            statusBadge.className = "fb-badge fb-badge-simulated";
            statusBadge.textContent = "Failed to Connect (JSON Error)";
        }
    }
}

function setupFirebaseConfigActions() {
    const btnConnect = document.getElementById("btn-connect-firebase");
    const btnDisconnect = document.getElementById("btn-disconnect-firebase");
    const configInput = document.getElementById("firebase-config-input");
    
    if (btnConnect && configInput) {
        btnConnect.addEventListener("click", () => {
            const rawVal = configInput.value.trim();
            if (!rawVal) {
                showNotificationToast("Connection Failed", "Firebase config cannot be empty.");
                return;
            }
            
            try {
                let parsedConfig = null;
                if (rawVal.includes("{") && rawVal.includes("}")) {
                    const startIdx = rawVal.indexOf("{");
                    const endIdx = rawVal.lastIndexOf("}") + 1;
                    const jsonStr = rawVal.slice(startIdx, endIdx);
                    // Safe parsing supporting standard JS configurations pasted directly from the console
                    parsedConfig = eval('(' + jsonStr + ')');
                } else {
                    parsedConfig = JSON.parse(rawVal);
                }
                
                if (!parsedConfig || !parsedConfig.apiKey || !parsedConfig.projectId) {
                    showNotificationToast("Invalid Config", "Config missing apiKey or projectId.");
                    return;
                }
                
                localStorage.setItem("ToroFolio_firebase_config", JSON.stringify(parsedConfig));
                showNotificationToast("Firebase Config Saved", "Configuration saved! Reloading live sync engine...");
                
                setTimeout(() => {
                    window.location.reload();
                }, 1200);
            } catch (err) {
                console.error(err);
                showNotificationToast("Invalid JSON Format", "Failed to parse config. Please paste the exact object.");
            }
        });
    }
    
    if (btnDisconnect) {
        btnDisconnect.addEventListener("click", () => {
            if (confirm("Disconnect Firebase? The platform will revert back to simulated local database mode.")) {
                localStorage.removeItem("ToroFolio_firebase_config");
                showNotificationToast("Firebase Disconnected", "Reverted to Simulated Mode. Reloading...");
                setTimeout(() => {
                    window.location.reload();
                }, 1200);
            }
        });
    }
}

function renderOtpDigitsMarkup() {
    const container = document.querySelector(".otp-digit-inputs");
    if (!container) return;
    
    const digitsCount = isFirebaseConnected ? 6 : 4;
    container.innerHTML = "";
    
    for (let i = 1; i <= digitsCount; i++) {
        const input = document.createElement("input");
        input.type = "text";
        input.maxLength = 1;
        input.className = "otp-digit-input";
        input.id = `otp-d${i}`;
        if (isFirebaseConnected) {
            // Equalize size for 6 digits fits inside the card
            input.style.width = "40px";
            input.style.height = "48px";
            input.style.fontSize = "1.2rem";
        }
        container.appendChild(input);
    }
    
    bindOtpInputFocusJump();
}

function bindOtpInputFocusJump() {
    const otpInputs = document.querySelectorAll(".otp-digit-input");
    otpInputs.forEach((input, index) => {
        input.addEventListener("input", (e) => {
            input.value = input.value.replace(/[^0-9]/g, "");
            if (input.value && index < otpInputs.length - 1) {
                otpInputs[index + 1].focus();
            } else if (input.value && index === otpInputs.length - 1) {
                const allFilled = Array.from(otpInputs).every(i => i.value.trim() !== "");
                if (allFilled) {
                    const form = document.getElementById("login-form");
                    if (form) {
                        form.dispatchEvent(new Event("submit"));
                    }
                }
            }
        });
        
        input.addEventListener("keydown", (e) => {
            if (e.key === "Backspace" && !input.value && index > 0) {
                otpInputs[index - 1].focus();
            }
        });
    });
}

// --- Global Application State (Seeded as Pristine Multi-User Dictionary Slate) ---
let state = {
    db: {
        registeredUsers: {
            "guest@ToroFolio.com": {
                name: "Guest User",
                email: "guest@ToroFolio.com",
                password: "admin",
                avatar: "https://ui-avatars.com/api/?name=Guest+User&background=0381FE&color=fff&size=150",
                walletBalance: 0.00, 
                investedValue: 0.00,  
                riskProfile: "conservative",
                biometricsEnabled: true,
                currency: "INR",
                holdings: [],        
                watchlist: ["RELIANCE", "TCS", "INFY", "SBIN"],
                ordersHistory: [],
                aiRules: [],
                aiExecutionLogs: []
            }
        }
    },
    currentUserKey: "", // Actively logged-in user key (email/phone/googleID)
    user: {
        name: "Guest User",
        email: "guest@ToroFolio.com",
        avatar: "https://ui-avatars.com/api/?name=Guest+User&background=0381FE&color=fff&size=150",
        walletBalance: 0.00, // Fresh slate starts at zero
        investedValue: 0.00,  
        riskProfile: "conservative",
        biometricsEnabled: true,
        currency: "INR",
        holdings: [],        
        watchlist: ["RELIANCE", "TCS", "INFY", "SBIN"],
        ordersHistory: []    
    },
    stocks: {
        "RELIANCE": { name: "Reliance Industries Ltd", price: 1323.10, change: 0.0, pctChange: 0.0, data: [] },
        "TCS": { name: "Tata Consultancy Services Ltd", price: 2251.10, change: 0.0, pctChange: 0.0, data: [] },
        "INFY": { name: "Infosys Ltd", price: 1087.10, change: 0.0, pctChange: 0.0, data: [] },
        "SBIN": { name: "State Bank of India", price: 1060.00, change: 0.0, pctChange: 0.0, data: [] },
        "HDFCBANK": { name: "HDFC Bank Ltd", price: 777.60, change: 0.0, pctChange: 0.0, data: [] },
        "ICICIBANK": { name: "ICICI Bank Ltd", price: 1460.20, change: 0.0, pctChange: 0.0, data: [] },
        "ITC": { name: "ITC Ltd", price: 282.70, change: 0.0, pctChange: 0.0, data: [] },
        "TATASTEEL": { name: "Tata Steel Ltd", price: 186.41, change: 0.0, pctChange: 0.0, data: [] },
        "WIPRO": { name: "Wipro Ltd", price: 176.38, change: 0.0, pctChange: 0.0, data: [] }
    },
    chart: {
        selectedStock: "RELIANCE",
        timeframe: "1D",
        type: "candles",
        indicators: { ema: true, rsi: true, macd: false },
        hoveredDataPoint: null
    },
    order: { mode: "BUY", type: "MARKET", qty: 5, limitPrice: 180.00 },
    aiRules: [],             
    aiExecutionLogs: [],     
    currentTab: "dashboard", 
    isDarkTheme: true,
    apiSettings: { provider: "finnhub", key: "", geminiKey: "" }  // Keys should be set via the Settings UI at runtime
};

// --- Stock Fundamentals Database & Calculation Logic ---
const BASE_FUNDAMENTALS = {
    "RELIANCE": { mcapCr: 1764228.28, pb: 1.95, divYield: 0.45, roe: 9.40, eps: 55.17, basePrice: 1323.10, industryPe: 25.99, debtToEquity: 0.37, bookValue: 668.04, faceValue: 10.00 },
    "TCS": { mcapCr: 803613.44, pb: 7.33, divYield: 2.89, roe: 47.74, eps: 137.54, basePrice: 2251.10, industryPe: 30.10, debtToEquity: 0.10, bookValue: 303.01, faceValue: 1.00 },
    "INFY": { mcapCr: 434652.42, pb: 4.60, divYield: 4.60, roe: 31.44, eps: 75.44, basePrice: 1087.10, industryPe: 25.40, debtToEquity: 0.10, bookValue: 233.15, faceValue: 5.00 },
    "SBIN": { mcapCr: 964045.67, pb: 1.62, divYield: 1.64, roe: 15.48, eps: 91.16, basePrice: 1060.00, industryPe: 12.60, debtToEquity: 1.25, bookValue: 645.82, faceValue: 1.00 },
    "HDFCBANK": { mcapCr: 1172724.88, pb: 1.93, divYield: 1.67, roe: 13.84, eps: 44.79, basePrice: 777.60, industryPe: 19.82, debtToEquity: 0.95, bookValue: 393.81, faceValue: 1.00 },
    "ICICIBANK": { mcapCr: 1049522.13, pb: 2.76, divYield: 0.82, roe: 16.07, eps: 77.39, basePrice: 1460.20, industryPe: 20.80, debtToEquity: 0.88, bookValue: 530.38, faceValue: 2.00 },
    "ITC": { mcapCr: 352078.06, pb: 4.86, divYield: 5.66, roe: 29.34, eps: 16.51, basePrice: 282.70, industryPe: 18.72, debtToEquity: 0.03, bookValue: 57.87, faceValue: 1.00 },
    "TATASTEEL": { mcapCr: 233522.88, pb: 2.29, divYield: 2.15, roe: 11.16, eps: 8.65, basePrice: 186.41, industryPe: 23.81, debtToEquity: 0.89, bookValue: 81.84, faceValue: 1.00 },
    "WIPRO": { mcapCr: 173084.40, pb: 2.07, divYield: 4.54, roe: 16.13, eps: 12.59, basePrice: 176.38, industryPe: 15.29, debtToEquity: 0.27, bookValue: 84.51, faceValue: 2.00 }
};

function formatMcap(mcapCr) {
    if (!mcapCr) return "--";
    if (mcapCr >= 100000) {
        const lakhCr = mcapCr / 100000;
        return `₹${lakhCr.toFixed(2)} Lakh Cr`;
    } else {
        return `₹${Math.round(mcapCr).toLocaleString('en-IN')} Cr`;
    }
}

function getStockFundamentals(ticker, price) {
    const stock = state.stocks[ticker.toUpperCase()];
    if (stock && stock.fundamentals) {
        const base = stock.fundamentals;
        const eps = base.eps;
        const pe = base.pe || parseFloat((price / eps).toFixed(2));
        const pb = base.pb;
        const divYield = base.divYield;
        const mcap = base.mcapCr;
        const bookValue = base.bookValue;
        
        return {
            mcap: formatMcap(mcap),
            pe: pe > 0 ? parseFloat(pe).toFixed(2) : "--",
            pb: pb > 0 ? parseFloat(pb).toFixed(2) : "--",
            divYield: divYield > 0 ? parseFloat(divYield).toFixed(2) + "%" : "--",
            roe: base.roe ? parseFloat(base.roe).toFixed(2) + "%" : "--",
            eps: formatCurrency(eps),
            industryPe: base.industryPe ? parseFloat(base.industryPe).toFixed(2) : "--",
            debtToEquity: base.debtToEquity ? parseFloat(base.debtToEquity).toFixed(2) : "--",
            bookValue: formatCurrency(bookValue),
            faceValue: formatCurrency(base.faceValue)
        };
    }

    const base = BASE_FUNDAMENTALS[ticker.toUpperCase()];
    if (base) {
        // Use ratio of 1.0 to show the exact static database fundamentals without wiggling
        const ratio = 1.0;
        const eps = base.eps;
        const pe = parseFloat((base.basePrice / eps).toFixed(2));
        const pb = base.pb;
        const divYield = base.divYield;
        const mcap = base.mcapCr;
        const bookValue = base.bookValue;
        
        return {
            mcap: formatMcap(mcap),
            pe: pe > 0 ? pe.toFixed(2) : "--",
            pb: pb > 0 ? pb.toFixed(2) : "--",
            divYield: divYield > 0 ? divYield.toFixed(2) + "%" : "--",
            roe: base.roe.toFixed(2) + "%",
            eps: formatCurrency(eps),
            industryPe: base.industryPe.toFixed(2),
            debtToEquity: base.debtToEquity.toFixed(2),
            bookValue: formatCurrency(bookValue),
            faceValue: formatCurrency(base.faceValue)
        };
    } else {
        // Generate dynamic deterministic values based on ticker string hash
        let hash = 0;
        for (let i = 0; i < ticker.length; i++) {
            hash = ticker.charCodeAt(i) + ((hash << 5) - hash);
        }
        hash = Math.abs(hash);

        const basePE = 10 + (hash % 40); // 10 to 50
        const basePB = 1 + ((hash % 150) / 10); // 1 to 16
        const roe = 5 + (hash % 45); // 5% to 50%
        const divYield = ((hash % 50) / 10); // 0% to 5%
        const industryPe = 12 + (hash % 30); // 12 to 42
        const debtToEquity = ((hash % 150) / 100); // 0 to 1.5
        const faceValue = [1, 2, 5, 10][hash % 4];
        
        const eps = parseFloat((price / basePE).toFixed(2));
        const pe = parseFloat((price / eps).toFixed(2));
        const bookValue = parseFloat((price / basePB).toFixed(2));
        
        const sharesOutstanding = 100000000 + (hash % 900000000); // 10Cr to 100Cr shares
        const mcapCr = parseFloat(((price * sharesOutstanding) / 10000000).toFixed(2));
        
        return {
            mcap: formatMcap(mcapCr),
            pe: pe > 0 ? pe.toFixed(2) : "--",
            pb: basePB.toFixed(2),
            divYield: divYield > 0 ? divYield.toFixed(2) + "%" : "0.00%",
            roe: roe.toFixed(2) + "%",
            eps: formatCurrency(eps),
            industryPe: industryPe.toFixed(2),
            debtToEquity: debtToEquity.toFixed(2),
            bookValue: formatCurrency(bookValue),
            faceValue: formatCurrency(faceValue)
        };
    }
}

// --- LocalStorage + IndexedDB Dual Persistence Layer (Multi-User Resilient Database) ---
const STORAGE_KEYS = {
    DB: "ToroFolio_users_database",     // Full registered users db
    CURRENT_USER: "ToroFolio_active_user_key", // Current email/phone key
    THEME: "ToroFolio_theme_db",
    STOCKS: "ToroFolio_customstocks_db",
    SESSION: "ToroFolio_session_active", // Permanent Session Key
    API_SETTINGS: "ToroFolio_api_settings"
};

// --- IndexedDB Core Configuration & Utility routines ---
const IDB_CONFIG = {
    DB_NAME: "ToroFolioDB",
    DB_VERSION: 1,
    STORE_NAME: "portfolioStore"
};

function openIndexedDB() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(IDB_CONFIG.DB_NAME, IDB_CONFIG.DB_VERSION);
        request.onupgradeneeded = (event) => {
            const db = event.target.result;
            if (!db.objectStoreNames.contains(IDB_CONFIG.STORE_NAME)) {
                db.createObjectStore(IDB_CONFIG.STORE_NAME);
            }
        };
        request.onsuccess = (event) => resolve(event.target.result);
        request.onerror = (event) => reject(event.target.error);
    });
}

async function saveToIndexedDB(key, data) {
    try {
        const db = await openIndexedDB();
        return new Promise((resolve, reject) => {
            const transaction = db.transaction(IDB_CONFIG.STORE_NAME, "readwrite");
            const store = transaction.objectStore(IDB_CONFIG.STORE_NAME);
            const request = store.put(data, key);
            request.onsuccess = () => resolve(true);
            request.onerror = (event) => reject(event.target.error);
        });
    } catch (e) {
        console.error("IndexedDB write failed:", e);
        return false;
    }
}

async function getFromIndexedDB(key) {
    try {
        const db = await openIndexedDB();
        return new Promise((resolve, reject) => {
            const transaction = db.transaction(IDB_CONFIG.STORE_NAME, "readonly");
            const store = transaction.objectStore(IDB_CONFIG.STORE_NAME);
            const request = store.get(key);
            request.onsuccess = (event) => resolve(event.target.result);
            request.onerror = (event) => reject(event.target.error);
        });
    } catch (e) {
        console.error("IndexedDB read failed:", e);
        return null;
    }
}

async function loadStateFromStorage() {
    try {
        // --- Dynamic Database Cache Invalidation & Version Migration ---
        const CURRENT_DB_VERSION = "2.3";
        const savedVersion = localStorage.getItem("ToroFolio_db_version");
        if (savedVersion !== CURRENT_DB_VERSION) {
            localStorage.removeItem(STORAGE_KEYS.DB);
            localStorage.removeItem(STORAGE_KEYS.CURRENT_USER);
            localStorage.removeItem(STORAGE_KEYS.STOCKS);
            localStorage.removeItem(STORAGE_KEYS.SESSION);
            
            // Clean IndexedDB fallback store
            try {
                const db = await openIndexedDB();
                const transaction = db.transaction(IDB_CONFIG.STORE_NAME, "readwrite");
                const store = transaction.objectStore(IDB_CONFIG.STORE_NAME);
                store.clear();
            } catch (idbErr) {
                console.warn("IndexedDB fallback cache clear bypassed:", idbErr);
            }
            
            localStorage.setItem("ToroFolio_db_version", CURRENT_DB_VERSION);
            console.log("Upgraded database caches successfully to version", CURRENT_DB_VERSION);
        }

        // 1. Initial LocalStorage fetch
        const cachedDb = localStorage.getItem(STORAGE_KEYS.DB);
        const cachedUserKey = localStorage.getItem(STORAGE_KEYS.CURRENT_USER);
        const cachedTheme = localStorage.getItem(STORAGE_KEYS.THEME);
        const cachedStocks = localStorage.getItem(STORAGE_KEYS.STOCKS);
        const cachedApiSettings = localStorage.getItem(STORAGE_KEYS.API_SETTINGS);

        if (cachedDb) state.db = JSON.parse(cachedDb);
        if (cachedApiSettings) state.apiSettings = JSON.parse(cachedApiSettings);
        // geminiKey must be set by the user via the Settings panel at runtime
        if (cachedUserKey) state.currentUserKey = cachedUserKey;
        if (cachedTheme) {
            state.isDarkTheme = JSON.parse(cachedTheme);
            document.body.className = state.isDarkTheme ? "dark-theme" : "light-theme";
        }
        if (cachedStocks) {
            const list = JSON.parse(cachedStocks);
            Object.keys(list).forEach(ticker => {
                if (!state.stocks[ticker]) {
                    state.stocks[ticker] = list[ticker];
                }
            });
        }

        // 2. High-resiliency IndexedDB backup read (Wipe Protection)
        try {
            const idbDb = await getFromIndexedDB(STORAGE_KEYS.DB);
            const idbUserKey = await getFromIndexedDB(STORAGE_KEYS.CURRENT_USER);
            const idbStocks = await getFromIndexedDB(STORAGE_KEYS.STOCKS);

            if (!cachedDb && idbDb) {
                state.db = idbDb;
                localStorage.setItem(STORAGE_KEYS.DB, JSON.stringify(idbDb));
            }
            if (!cachedUserKey && idbUserKey) {
                state.currentUserKey = idbUserKey;
                localStorage.setItem(STORAGE_KEYS.CURRENT_USER, idbUserKey);
            }
            if (!cachedStocks && idbStocks) {
                Object.keys(idbStocks).forEach(ticker => {
                    if (!state.stocks[ticker]) {
                        state.stocks[ticker] = idbStocks[ticker];
                    }
                });
                localStorage.setItem(STORAGE_KEYS.STOCKS, JSON.stringify(idbStocks));
            }
        } catch (dbErr) {
            console.warn("IndexedDB sync-restore bypass:", dbErr);
        }

        // 3. Load active user profile details from Cloud Firestore, local SQLite server, or offline cache
        if (state.currentUserKey) {
            if (isLocalBackendActive) {
                try {
                    const res = await fetch(`/api/user/profile?email=${encodeURIComponent(state.currentUserKey)}`);
                    if (res.ok) {
                        const body = await res.json();
                        if (body.status === "success") {
                            const s = body.state;
                            state.user = s.profile;
                            state.user.holdings = s.holdings || [];
                            state.user.watchlist = s.watchlist || [];
                            state.user.ordersHistory = s.ordersHistory || [];
                            state.aiRules = s.aiRules || [];
                            state.aiExecutionLogs = s.aiExecutionLogs || [];
                            
                            // Cache in memory
                            state.db.registeredUsers[state.currentUserKey] = state.user;
                        }
                    }
                } catch (sqliteErr) {
                    console.error("Local SQLite backend profile fetch failed. Falling back to local offline cache:", sqliteErr);
                    if (state.db.registeredUsers[state.currentUserKey]) {
                        const profile = state.db.registeredUsers[state.currentUserKey];
                        state.user = profile;
                        state.aiRules = profile.aiRules || [];
                        state.aiExecutionLogs = profile.aiExecutionLogs || [];
                    }
                }
            } else if (isFirebaseConnected && dbFirestore) {
                try {
                    const doc = await dbFirestore.collection("users").doc(state.currentUserKey).get();
                    if (doc.exists) {
                        const profile = doc.data();
                        state.user = profile;
                        state.aiRules = profile.aiRules || [];
                        state.aiExecutionLogs = profile.aiExecutionLogs || [];
                    }
                } catch (fsErr) {
                    console.error("Firestore cloud sync failed. Falling back to local offline cache:", fsErr);
                    if (state.db.registeredUsers[state.currentUserKey]) {
                        const profile = state.db.registeredUsers[state.currentUserKey];
                        state.user = profile;
                        state.aiRules = profile.aiRules || [];
                        state.aiExecutionLogs = profile.aiExecutionLogs || [];
                    }
                }
            } else if (state.db.registeredUsers[state.currentUserKey]) {
                const profile = state.db.registeredUsers[state.currentUserKey];
                state.user = profile;
                state.aiRules = profile.aiRules || [];
                state.aiExecutionLogs = profile.aiExecutionLogs || [];
            }
            if (!state.user) {
                // Instantly construct fallback Guest User object to prevent crashes
                const guestEmail = "guest@ToroFolio.com";
                state.user = (state.db.registeredUsers && state.db.registeredUsers[guestEmail]) || {
                    name: "Guest User",
                    email: guestEmail,
                    password: "admin",
                    avatar: "https://ui-avatars.com/api/?name=Guest+User&background=0381FE&color=fff&size=150",
                    walletBalance: 0.00,
                    investedValue: 0.00,
                    riskProfile: "conservative",
                    biometricsEnabled: true,
                    currency: "INR",
                    holdings: [],
                    watchlist: [],
                    ordersHistory: [],
                    aiRules: [],
                    aiExecutionLogs: []
                };
            }
            state.user.holdings = state.user.holdings || [];
            state.user.watchlist = state.user.watchlist || [];
            state.user.ordersHistory = state.user.ordersHistory || [];
            state.user.currency = state.user.currency || "INR";
            state.user.name = state.user.name || "Guest User";
            state.user.riskProfile = state.user.riskProfile || "conservative";
            state.user.avatar = state.user.avatar || "https://ui-avatars.com/api/?name=Guest+User&background=0381FE&color=fff&size=150";
            state.aiRules = state.user.aiRules || [];
            state.aiExecutionLogs = state.user.aiExecutionLogs || [];
        }
        // Apply updated totals
        recalculatePortfolioVal();
    } catch (e) {
        console.error("Database load failure:", e);
    }
}

function saveStateToStorage() {
    try {
        // 1. Sync active user variables back to their registration record slot
        if (state.currentUserKey) {
            if (!state.db.registeredUsers[state.currentUserKey]) {
                state.db.registeredUsers[state.currentUserKey] = {};
            }
            const profile = state.db.registeredUsers[state.currentUserKey];
            
            // Mirror current values
            profile.name = state.user.name;
            profile.email = state.user.email;
            profile.password = state.user.password || profile.password;
            profile.avatar = state.user.avatar;
            profile.walletBalance = state.user.walletBalance;
            profile.investedValue = state.user.investedValue;
            profile.riskProfile = state.user.riskProfile;
            profile.biometricsEnabled = state.user.biometricsEnabled;
            profile.holdings = state.user.holdings;
            profile.watchlist = state.user.watchlist;
            profile.ordersHistory = state.user.ordersHistory;
            profile.phone = state.user.phone || "";
            profile.dob = state.user.dob || "";
            profile.city = state.user.city || "";
            profile.state = state.user.state || "";
            profile.aiRules = state.aiRules;
            profile.aiExecutionLogs = state.aiExecutionLogs;
        }

        // 2. Save full registered users database & active key to LocalStorage
        localStorage.setItem(STORAGE_KEYS.DB, JSON.stringify(state.db));
        localStorage.setItem(STORAGE_KEYS.CURRENT_USER, state.currentUserKey);
        localStorage.setItem(STORAGE_KEYS.THEME, JSON.stringify(state.isDarkTheme));
        localStorage.setItem(STORAGE_KEYS.API_SETTINGS, JSON.stringify(state.apiSettings));

        // Backup custom imported tickers
        const customList = {};
        const defaultTickers = ["RELIANCE", "TCS", "INFY", "SBIN", "HDFCBANK", "ICICIBANK", "ITC", "TATASTEEL", "WIPRO"];
        Object.keys(state.stocks).forEach(ticker => {
            if (!defaultTickers.includes(ticker)) {
                customList[ticker] = {
                    name: state.stocks[ticker].name,
                    price: state.stocks[ticker].price,
                    change: state.stocks[ticker].change,
                    pctChange: state.stocks[ticker].pctChange,
                    data: [] // don't cache big history arrays
                };
            }
        });
        localStorage.setItem(STORAGE_KEYS.STOCKS, JSON.stringify(customList));

        // 3. Mirror asynchronous saves to IndexedDB fallback
        saveToIndexedDB(STORAGE_KEYS.DB, state.db);
        saveToIndexedDB(STORAGE_KEYS.CURRENT_USER, state.currentUserKey);
        saveToIndexedDB(STORAGE_KEYS.STOCKS, customList);

        // 4. Mirror profile properties to SQLite backend if active
        if (isLocalBackendActive && state.currentUserKey) {
            fetch('/api/user/profile/update', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    email: state.currentUserKey,
                    name: state.user.name,
                    avatar: state.user.avatar,
                    riskProfile: state.user.riskProfile,
                    biometricsEnabled: state.user.biometricsEnabled
                })
            })
            .catch(err => console.warn("Local SQLite backend sync deferred:", err));
            
            // Also trigger a full database update to persist watchlist, holdings, orders, etc.
            saveStateToServer();
        }

        // 5. Mirror asynchronous saves to Firebase Cloud Database if Connected
        if (isFirebaseConnected && dbFirestore && state.currentUserKey) {
            const profile = state.db.registeredUsers[state.currentUserKey];
            if (profile) {
                dbFirestore.collection("users").doc(state.currentUserKey).set(profile)
                .catch(fsErr => console.warn("Firestore cloud mirror sync deferred:", fsErr));
            }
        }
    } catch (e) {
        console.error("Database save failure:", e);
    }
}

async function saveStateToServer() {
    if (!isLocalBackendActive || !state.currentUserKey) return;
    try {
        const profile = state.db.registeredUsers[state.currentUserKey];
        if (profile) {
            fetch('/api/user/profile/update_all', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    email: state.currentUserKey,
                    name: profile.name,
                    avatar: profile.avatar,
                    phone: profile.phone || "",
                    dob: profile.dob || "",
                    city: profile.city || "",
                    state: profile.state || "",
                    walletBalance: profile.walletBalance,
                    investedValue: profile.investedValue,
                    holdings: profile.holdings,
                    watchlist: profile.watchlist,
                    ordersHistory: profile.ordersHistory,
                    aiRules: profile.aiRules,
                    aiExecutionLogs: profile.aiExecutionLogs
                })
            })
            .catch(err => console.warn("Local SQLite backend full sync deferred:", err));
        }
    } catch (e) {
        console.error("Database saveToServer failure:", e);
    }
}

function exportPortfolioDatabase() {
    try {
        // Sync first to guarantee up-to-date values are bundled
        saveStateToStorage();

        const backupBundle = {
            version: "2.0",
            timestamp: new Date().toISOString(),
            db: state.db,
            customStocks: {}
        };

        const defaultTickers = ["RELIANCE", "TCS", "INFY", "SBIN", "HDFCBANK", "ICICIBANK", "ITC", "TATASTEEL", "WIPRO"];
        Object.keys(state.stocks).forEach(ticker => {
            if (!defaultTickers.includes(ticker)) {
                backupBundle.customStocks[ticker] = {
                    name: state.stocks[ticker].name,
                    price: state.stocks[ticker].price,
                    change: state.stocks[ticker].change,
                    pctChange: state.stocks[ticker].pctChange,
                    data: [] // don't cache big history arrays
                };
            }
        });

        const jsonStr = JSON.stringify(backupBundle, null, 2);
        const dataUri = "data:application/json;charset=utf-8," + encodeURIComponent(jsonStr);
        
        const anchor = document.createElement("a");
        anchor.setAttribute("href", dataUri);
        anchor.setAttribute("download", `ToroFolio_backup_${Date.now()}.json`);
        document.body.appendChild(anchor);
        anchor.click();
        anchor.remove();

        showNotificationToast("Backup Success", "Database physical JSON backup downloaded successfully!");
    } catch (e) {
        console.error("Backup failed:", e);
        showNotificationToast("Backup Failed", "Unable to export database backup.");
    }
}

function importPortfolioDatabase(event) {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (e) => {
        try {
            const backup = JSON.parse(e.target.result);
            
            if (!backup.db || !backup.db.registeredUsers) {
                showNotificationToast("Import Failed", "Invalid backup structure. Users index missing.");
                return;
            }

            state.db = backup.db;

            // Load custom backup tickers
            if (backup.customStocks) {
                Object.keys(backup.customStocks).forEach(ticker => {
                    state.stocks[ticker] = {
                        name: backup.customStocks[ticker].name,
                        price: backup.customStocks[ticker].price,
                        change: backup.customStocks[ticker].change,
                        pctChange: backup.customStocks[ticker].pctChange,
                        data: generateHistoricalData(ticker, 250)
                    };
                });
            }

            // Reload actively logged-in user profile if still active BEFORE saving
            let userLoaded = false;
            if (state.currentUserKey && state.db.registeredUsers[state.currentUserKey]) {
                const profile = state.db.registeredUsers[state.currentUserKey];
                state.user = profile;
                state.aiRules = profile.aiRules || [];
                state.aiExecutionLogs = profile.aiExecutionLogs || [];
                userLoaded = true;
            } else {
                // Find any valid user in the restored database
                const keys = Object.keys(state.db.registeredUsers);
                if (keys.length > 0) {
                    state.currentUserKey = keys[0];
                    const profile = state.db.registeredUsers[state.currentUserKey];
                    state.user = profile;
                    state.aiRules = profile.aiRules || [];
                    state.aiExecutionLogs = profile.aiExecutionLogs || [];
                    userLoaded = true;
                }
            }

            if (!userLoaded) {
                // Seed guest user fallback
                const guestEmail = "guest@ToroFolio.com";
                state.db.registeredUsers[guestEmail] = {
                    name: "Guest User",
                    email: guestEmail,
                    password: "admin",
                    avatar: "https://ui-avatars.com/api/?name=Guest+User&background=0381FE&color=fff&size=150",
                    walletBalance: 0.00,
                    investedValue: 0.00,
                    riskProfile: "conservative",
                    biometricsEnabled: true,
                    currency: "INR",
                    holdings: [],
                    watchlist: ["RELIANCE", "TCS", "INFY", "SBIN"],
                    ordersHistory: [],
                    aiRules: [],
                    aiExecutionLogs: []
                };
                state.currentUserKey = guestEmail;
                state.user = state.db.registeredUsers[guestEmail];
                state.aiRules = [];
                state.aiExecutionLogs = [];
            }

            // Sync and save to local storage
            saveStateToStorage();
            
            // Fetch real live prices for all imported/restored stocks
            await reloadAllHistoricalData();

            // Sync to backend SQLite server if active
            await saveStateToServer();
            
            recalculatePortfolioVal();

            // Re-render whole panel layout
            syncProfileFieldsToUI();
            updateDetailedStockHeader();
            renderDashboardPortfolio();
            renderDashboardWatchlist();
            renderMarketTickers();
            renderActiveRulesList();
            renderExecutionLogsList();
            renderUserHistoryTable();
            loadSavedAPISettingsToUI();

            showNotificationToast("Import Success", "Multi-user account database successfully restored!");
        } catch (err) {
            console.error("Import crash:", err);
            showNotificationToast("Import Failed", "Failed to parse JSON backup. Format invalid.");
        } finally {
            event.target.value = ""; // Reset file input value to allow importing the same file again
        }
    };
    reader.readAsText(file);
}

function resetEntireDatabase() {
    if (confirm("Are you sure you want to clear your persistent portfolio database? This resets all balances, Groww imports, and AI rules back to default settings.")) {
        localStorage.clear();
        
        // Clean IndexedDB fallback store
        openIndexedDB().then(db => {
            const transaction = db.transaction(IDB_CONFIG.STORE_NAME, "readwrite");
            const store = transaction.objectStore(IDB_CONFIG.STORE_NAME);
            store.clear();
        }).catch(err => console.warn("IndexedDB clear error:", err));

        showNotificationToast("Database Cleared", "Portfolio successfully re-seeded. Reloading page...");
        setTimeout(() => {
            window.location.reload();
        }, 1200);
    }
}


// --- Technical Indicator Calculations ---
function calculateEMA(data, period = 20) {
    if (!data || data.length === 0) return [];
    const k = 2 / (period + 1);
    let emaVal = data[0].close;
    const emaArray = [emaVal];
    
    for (let i = 1; i < data.length; i++) {
        emaVal = data[i].close * k + emaVal * (1 - k);
        emaArray.push(parseFloat(emaVal.toFixed(2)));
    }
    return emaArray;
}

function calculateRSI(data, period = 14) {
    if (!data || data.length <= period) return Array(data.length).fill(50);
    const rsiArray = Array(data.length).fill(50);
    let avgGain = 0;
    let avgLoss = 0;
    
    for (let i = 1; i <= period; i++) {
        const diff = data[i].close - data[i-1].close;
        if (diff > 0) avgGain += diff;
        else avgLoss += Math.abs(diff);
    }
    
    avgGain /= period;
    avgLoss /= period;
    
    let rs = avgLoss === 0 ? 100 : avgGain / avgLoss;
    rsiArray[period] = avgLoss === 0 ? 100 : 100 - (100 / (1 + rs));
    
    for (let i = period + 1; i < data.length; i++) {
        const diff = data[i].close - data[i-1].close;
        let gain = 0;
        let loss = 0;
        if (diff > 0) gain = diff;
        else loss = Math.abs(diff);
        
        avgGain = (avgGain * (period - 1) + gain) / period;
        avgLoss = (avgLoss * (period - 1) + loss) / period;
        
        rs = avgLoss === 0 ? 100 : avgGain / avgLoss;
        rsiArray[i] = parseFloat((avgLoss === 0 ? 100 : 100 - (100 / (1 + rs))).toFixed(2));
    }
    return rsiArray;
}

function calculateMACD(data, shortP = 12, longP = 26, signalP = 9) {
    if (!data || data.length === 0) return { macd: [], signal: [], histogram: [] };
    const macdLine = [];
    const signalLine = [];
    const histogram = [];
    
    const emaShort = calculateEMA(data, shortP);
    const emaLong = calculateEMA(data, longP);
    
    for (let i = 0; i < data.length; i++) {
        macdLine.push(parseFloat((emaShort[i] - emaLong[i]).toFixed(2)));
    }
    
    const k = 2 / (signalP + 1);
    let sigVal = macdLine[0];
    signalLine.push(sigVal);
    
    for (let i = 1; i < macdLine.length; i++) {
        sigVal = macdLine[i] * k + sigVal * (1 - k);
        signalLine.push(parseFloat(sigVal.toFixed(2)));
    }
    
    for (let i = 0; i < macdLine.length; i++) {
        histogram.push(parseFloat((macdLine[i] - signalLine[i]).toFixed(2)));
    }
    return { macd: macdLine, signal: signalLine, histogram: histogram };
}


// --- Technical Chart Render Engine (Canvas) ---
function getVisibleChartDataSlice(stock) {
    if (!stock || !stock.data || stock.data.length === 0) return [];
    let fullData = stock.data;
    let timeframe = (state && state.chart && state.chart.timeframe) ? state.chart.timeframe : "1D";
    
    if (timeframe === "1D" || timeframe === "1H" || timeframe === "1m" || timeframe === "5m" || timeframe === "30m" || timeframe === "1W") {
        return fullData; // Show all intraday/weekly candles without truncating
    } else if (timeframe === "1M") {
        return fullData.slice(-Math.min(30, fullData.length));
    } else if (timeframe === "1Y") {
        return fullData.slice(-Math.min(250, fullData.length));
    } else {
        return fullData;
    }
}

function drawTechnicalCharts() {
    const primaryCanvas = document.getElementById("primary-chart-canvas");
    if (!primaryCanvas) return;
    
    const ctx = primaryCanvas.getContext("2d");
    const container = document.getElementById("chart-draw-area");
    if (!container) return;
    
    const width = container.clientWidth;
    const height = container.clientHeight;
    if (width <= 0 || height <= 0) return;
    
    let indicatorAreaActive = state.chart.indicators.rsi || state.chart.indicators.macd;
    let primaryHeight = indicatorAreaActive ? height * 0.72 : height;
    
    primaryCanvas.width = width;
    primaryCanvas.height = height;
    
    ctx.clearRect(0, 0, width, height);
    
    const stock = state.stocks[state.chart.selectedStock];
    if (!stock || !stock.data || stock.data.length === 0) return;
    let fullData = stock.data;
    
    const rawDataSlice = getVisibleChartDataSlice(stock);
    if (rawDataSlice.length === 0) return;
    let sliceCount = rawDataSlice.length;
    
    let pricesHigh = Math.max(...rawDataSlice.map(d => d.high));
    let pricesLow = Math.min(...rawDataSlice.map(d => d.low));
    
    const emaArray = calculateEMA(fullData, 20).slice(-sliceCount);
    const rsiArray = calculateRSI(fullData, 14).slice(-sliceCount);
    const macdResults = calculateMACD(fullData);
    const macdLine = macdResults.macd.slice(-sliceCount);
    const macdSignal = macdResults.signal.slice(-sliceCount);
    const macdHist = macdResults.histogram.slice(-sliceCount);
    
    if (state.chart.indicators.ema) {
        pricesHigh = Math.max(pricesHigh, ...emaArray);
        pricesLow = Math.min(pricesLow, ...emaArray);
    }
    
    const paddingMultiplier = 0.05;
    const priceDiff = pricesHigh - pricesLow;
    const scaledHigh = pricesHigh + priceDiff * paddingMultiplier;
    const scaledLow = Math.max(0.1, pricesLow - priceDiff * paddingMultiplier);
    const scaledPriceRange = (scaledHigh - scaledLow) || 1.0;
    
    const chartMarginLeft = 12;
    const chartMarginRight = 65;
    const chartMarginTop = 25;
    const chartMarginBottom = 15;
    const activeWidth = width - chartMarginLeft - chartMarginRight;
    const candleWidth = activeWidth / rawDataSlice.length;
    
    ctx.strokeStyle = state.isDarkTheme ? "rgba(255, 255, 255, 0.05)" : "rgba(0, 0, 0, 0.05)";
    ctx.lineWidth = 1.0;
    ctx.fillStyle = state.isDarkTheme ? "#9CA3AF" : "#4B5563";
    ctx.font = "10px Inter";
    
    const gridRows = 4;
    for (let r = 0; r <= gridRows; r++) {
        const y = chartMarginTop + (r / gridRows) * (primaryHeight - chartMarginTop - chartMarginBottom);
        ctx.beginPath();
        ctx.moveTo(chartMarginLeft, y);
        ctx.lineTo(width - chartMarginRight, y);
        ctx.stroke();
        
        const gridPriceVal = scaledHigh - (r / gridRows) * scaledPriceRange;
        ctx.fillText(`₹${gridPriceVal.toLocaleString('en-IN', {minimumFractionDigits: 2, maximumFractionDigits: 2})}`, width - chartMarginRight + 8, y + 4);
    }
    
    if (state.chart.type === "candles") {
        rawDataSlice.forEach((d, idx) => {
            const x = chartMarginLeft + idx * candleWidth;
            const xCenter = x + candleWidth / 2;
            
            const openY = primaryHeight - chartMarginBottom - ((d.open - scaledLow) / scaledPriceRange) * (primaryHeight - chartMarginTop - chartMarginBottom);
            const closeY = primaryHeight - chartMarginBottom - ((d.close - scaledLow) / scaledPriceRange) * (primaryHeight - chartMarginTop - chartMarginBottom);
            const highY = primaryHeight - chartMarginBottom - ((d.high - scaledLow) / scaledPriceRange) * (primaryHeight - chartMarginTop - chartMarginBottom);
            const lowY = primaryHeight - chartMarginBottom - ((d.low - scaledLow) / scaledPriceRange) * (primaryHeight - chartMarginTop - chartMarginBottom);
            
            const isBullish = d.close >= d.open;
            const accentColor = isBullish ? "#10B981" : "#EF4444";
            
            ctx.strokeStyle = accentColor;
            ctx.fillStyle = accentColor;
            ctx.lineWidth = 1.5;
            
            ctx.beginPath();
            ctx.moveTo(xCenter, highY);
            ctx.lineTo(xCenter, lowY);
            ctx.stroke();
            
            const bodyH = Math.max(2.0, Math.abs(closeY - openY));
            const bodyY = Math.min(openY, closeY);
            const bodyW = Math.max(2.0, candleWidth * 0.72);
            const bodyX = xCenter - bodyW / 2;
            
            ctx.beginPath();
            ctx.rect(bodyX, bodyY, bodyW, bodyH);
            ctx.fill();
        });
    } else {
        ctx.beginPath();
        ctx.lineWidth = 2.5;
        ctx.strokeStyle = "#0381FE";
        
        const gradFill = ctx.createLinearGradient(0, chartMarginTop, 0, primaryHeight);
        gradFill.addColorStop(0, "rgba(3, 129, 254, 0.25)");
        gradFill.addColorStop(1, "rgba(3, 129, 254, 0)");
        
        rawDataSlice.forEach((d, idx) => {
            const x = chartMarginLeft + idx * candleWidth + candleWidth / 2;
            const y = primaryHeight - chartMarginBottom - ((d.close - scaledLow) / scaledPriceRange) * (primaryHeight - chartMarginTop - chartMarginBottom);
            if (idx === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
        });
        ctx.stroke();
        
        ctx.lineTo(chartMarginLeft + (rawDataSlice.length - 1) * candleWidth + candleWidth / 2, primaryHeight - chartMarginBottom);
        ctx.lineTo(chartMarginLeft + candleWidth / 2, primaryHeight - chartMarginBottom);
        ctx.closePath();
        ctx.fillStyle = gradFill;
        ctx.fill();
    }
    
    if (state.chart.indicators.ema) {
        ctx.beginPath();
        ctx.lineWidth = 1.8;
        ctx.strokeStyle = "#FBBF24";
        emaArray.forEach((val, idx) => {
            const x = chartMarginLeft + idx * candleWidth + candleWidth / 2;
            const y = primaryHeight - chartMarginBottom - ((val - scaledLow) / scaledPriceRange) * (primaryHeight - chartMarginTop - chartMarginBottom);
            if (idx === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
        });
        ctx.stroke();
    }
    
    if (indicatorAreaActive) {
        const secTop = primaryHeight + 10;
        const secBottom = height - 12;
        const secActH = secBottom - secTop;
        
        ctx.strokeStyle = varColor("--border-color");
        ctx.lineWidth = 1.0;
        ctx.beginPath();
        ctx.moveTo(chartMarginLeft, secTop - 5);
        ctx.lineTo(width - chartMarginRight, secTop - 5);
        ctx.stroke();
        
        if (state.chart.indicators.rsi) {
            ctx.fillStyle = "rgba(167, 139, 250, 0.05)";
            const rsiOverboughtY = secBottom - (70 / 100) * secActH;
            const rsiOversoldY = secBottom - (30 / 100) * secActH;
            ctx.fillRect(chartMarginLeft, rsiOverboughtY, activeWidth, rsiOversoldY - rsiOverboughtY);
            
            ctx.strokeStyle = "rgba(167, 139, 250, 0.3)";
            ctx.lineWidth = 1.0;
            ctx.setLineDash([5, 5]);
            ctx.beginPath();
            ctx.moveTo(chartMarginLeft, rsiOverboughtY);
            ctx.lineTo(width - chartMarginRight, rsiOverboughtY);
            ctx.moveTo(chartMarginLeft, rsiOversoldY);
            ctx.lineTo(width - chartMarginRight, rsiOversoldY);
            ctx.stroke();
            ctx.setLineDash([]);
            
            ctx.fillStyle = state.isDarkTheme ? "#9CA3AF" : "#4B5563";
            ctx.fillText("70", width - chartMarginRight + 8, rsiOverboughtY + 4);
            ctx.fillText("30", width - chartMarginRight + 8, rsiOversoldY + 4);
            
            ctx.beginPath();
            ctx.strokeStyle = "#A78BFA";
            ctx.lineWidth = 1.8;
            rsiArray.forEach((rsi, idx) => {
                const x = chartMarginLeft + idx * candleWidth + candleWidth / 2;
                const y = secBottom - (rsi / 100) * secActH;
                if (idx === 0) ctx.moveTo(x, y);
                else ctx.lineTo(x, y);
            });
            ctx.stroke();
            
            ctx.fillStyle = "#A78BFA";
            ctx.font = "700 9px Outfit";
            ctx.fillText(`RSI (14): ${rsiArray[rsiArray.length - 1].toFixed(1)}`, chartMarginLeft + 8, secTop + 14);
            
        } else if (state.chart.indicators.macd) {
            const allMacdVals = [...macdLine, ...macdSignal, ...macdHist];
            const maxMacdBound = Math.max(...allMacdVals.map(Math.abs)) || 1.0;
            const zeroY = secTop + secActH / 2;
            
            ctx.strokeStyle = "rgba(255, 255, 255, 0.1)";
            ctx.beginPath();
            ctx.moveTo(chartMarginLeft, zeroY);
            ctx.lineTo(width - chartMarginRight, zeroY);
            ctx.stroke();
            
            macdHist.forEach((val, idx) => {
                const x = chartMarginLeft + idx * candleWidth + candleWidth * 0.15;
                const barW = candleWidth * 0.7;
                const valH = (val / maxMacdBound) * (secActH / 2);
                ctx.fillStyle = val >= 0 ? "rgba(16, 185, 129, 0.4)" : "rgba(239, 68, 68, 0.4)";
                ctx.fillRect(x, zeroY - valH, barW, valH);
            });
            
            ctx.beginPath();
            ctx.strokeStyle = "#0088FF";
            ctx.lineWidth = 1.2;
            macdLine.forEach((val, idx) => {
                const x = chartMarginLeft + idx * candleWidth + candleWidth / 2;
                const y = zeroY - (val / maxMacdBound) * (secActH / 2);
                if (idx === 0) ctx.moveTo(x, y);
                else ctx.lineTo(x, y);
            });
            ctx.stroke();
            
            ctx.beginPath();
            ctx.strokeStyle = "#FF9900";
            ctx.lineWidth = 1.2;
            macdSignal.forEach((val, idx) => {
                const x = chartMarginLeft + idx * candleWidth + candleWidth / 2;
                const y = zeroY - (val / maxMacdBound) * (secActH / 2);
                if (idx === 0) ctx.moveTo(x, y);
                else ctx.lineTo(x, y);
            });
            ctx.stroke();
            
            ctx.fillStyle = state.isDarkTheme ? "#9CA3AF" : "#4B5563";
            ctx.font = "9px Inter";
            ctx.fillText(`0.00`, width - chartMarginRight + 8, zeroY + 3);
            
            ctx.fillStyle = "#0088FF";
            ctx.font = "700 9px Outfit";
            ctx.fillText(`MACD: ${macdLine[macdLine.length - 1].toFixed(2)}`, chartMarginLeft + 8, secTop + 14);
            ctx.fillStyle = "#FF9900";
            ctx.fillText(`Signal: ${macdSignal[macdSignal.length - 1].toFixed(2)}`, chartMarginLeft + 100, secTop + 14);
        }
    }
    
    if (state.chart.hoveredDataPoint !== null) {
        const hoverIdx = state.chart.hoveredDataPoint;
        if (hoverIdx >= 0 && hoverIdx < rawDataSlice.length) {
            const hoverData = rawDataSlice[hoverIdx];
            const hoverX = chartMarginLeft + hoverIdx * candleWidth + candleWidth / 2;
            
            // Draw Vertical Crosshair Line
            ctx.strokeStyle = "rgba(3, 129, 254, 0.6)";
            ctx.lineWidth = 1.0;
            ctx.setLineDash([4, 4]);
            ctx.beginPath();
            ctx.moveTo(hoverX, 0);
            ctx.lineTo(hoverX, height);
            ctx.stroke();
            
            // Draw Horizontal Crosshair Line & Price Badge on Y-Axis
            if (state.chart.hoveredMouseY !== null && state.chart.hoveredMouseY !== undefined) {
                const hoverY = state.chart.hoveredMouseY;
                ctx.beginPath();
                ctx.moveTo(chartMarginLeft, hoverY);
                ctx.lineTo(width - chartMarginRight, hoverY);
                ctx.stroke();
                
                if (hoverY >= chartMarginTop && hoverY <= primaryHeight - chartMarginBottom) {
                    const priceRatio = (primaryHeight - chartMarginBottom - hoverY) / (primaryHeight - chartMarginTop - chartMarginBottom);
                    const hoverPriceVal = scaledLow + priceRatio * scaledPriceRange;
                    
                    ctx.fillStyle = "#0381FE";
                    ctx.fillRect(width - chartMarginRight + 2, hoverY - 9, chartMarginRight - 4, 18);
                    ctx.fillStyle = "#FFFFFF";
                    ctx.font = "bold 9px Inter";
                    ctx.fillText(`₹${hoverPriceVal.toFixed(2)}`, width - chartMarginRight + 6, hoverY + 3);
                }
            }
            ctx.setLineDash([]);
            
            const tooltip = document.getElementById("chart-tooltip");
            if (tooltip) {
                tooltip.style.opacity = "1";
                tooltip.style.left = `${Math.min(width - 165, Math.max(10, hoverX - 75))}px`;
                tooltip.style.top = `${chartMarginTop + 10}px`;
                tooltip.innerHTML = `
                    <div style="font-weight: 700; color: var(--primary-blue); font-family: var(--font-heading); margin-bottom: 4px;">${hoverData.date}</div>
                    <div>O: ₹${hoverData.open.toFixed(2)}</div>
                    <div>H: ₹${hoverData.high.toFixed(2)}</div>
                    <div>L: ₹${hoverData.low.toFixed(2)}</div>
                    <div style="font-weight: 600;">C: ₹${hoverData.close.toFixed(2)}</div>
                    <div style="color: var(--text-secondary); font-size: 0.65rem; margin-top: 2px;">Vol: ${(hoverData.volume / 1000).toFixed(1)}k</div>
                `;
            }
        }
    }
}

// Fetch browser theme state variables directly
function varColor(cssVarName) {
    return getComputedStyle(document.documentElement).getPropertyValue(cssVarName).trim();
}

// Setup Canvas Hover Handlers
function initChartHoverEngine() {
    const primaryCanvas = document.getElementById("primary-chart-canvas");
    if (!primaryCanvas) return;
    
    const handleMouseMove = (e) => {
        const rect = primaryCanvas.getBoundingClientRect();
        if (rect.width <= 0 || rect.height <= 0) return;
        
        const scaleX = primaryCanvas.width / rect.width;
        const scaleY = primaryCanvas.height / rect.height;
        
        const mouseX = (e.clientX - rect.left) * scaleX;
        const mouseY = (e.clientY - rect.top) * scaleY;
        
        const chartMarginLeft = 12;
        const chartMarginRight = 65;
        const activeWidth = primaryCanvas.width - chartMarginLeft - chartMarginRight;
        
        const stock = state.stocks[state.chart.selectedStock];
        if (!stock || !stock.data || stock.data.length === 0) return;
        
        const rawDataSlice = getVisibleChartDataSlice(stock);
        if (rawDataSlice.length === 0) return;
        
        const candleWidth = activeWidth / rawDataSlice.length;
        const relativeX = mouseX - chartMarginLeft;
        
        let hoverIdx = Math.floor(relativeX / candleWidth);
        if (hoverIdx >= 0 && hoverIdx < rawDataSlice.length && relativeX >= 0 && mouseX <= primaryCanvas.width - chartMarginRight) {
            state.chart.hoveredDataPoint = hoverIdx;
            state.chart.hoveredMouseY = mouseY;
        } else {
            state.chart.hoveredDataPoint = null;
            state.chart.hoveredMouseY = null;
        }
        drawTechnicalCharts();
    };
    
    const handleMouseLeave = () => {
        state.chart.hoveredDataPoint = null;
        state.chart.hoveredMouseY = null;
        const tooltip = document.getElementById("chart-tooltip");
        if (tooltip) tooltip.style.opacity = "0";
        drawTechnicalCharts();
    };
    
    primaryCanvas.addEventListener("mousemove", handleMouseMove);
    primaryCanvas.addEventListener("mouseleave", handleMouseLeave);
}


// --- Groww-style Order execution ---
function updateOrderConsoleCalculator() {
    const stock = state.stocks[state.chart.selectedStock];
    if (!stock) return;
    
    const qtyInput = document.getElementById("order-qty");
    const requiredFundsLabel = document.getElementById("order-required-funds");
    const availablePowerLabel = document.getElementById("order-available-power");
    const executeBtn = document.getElementById("btn-execute-order");
    const limitPriceInput = document.getElementById("order-limit-price");
    
    if (!qtyInput || !requiredFundsLabel) return;
    
    let qty = parseInt(qtyInput.value) || 0;
    let priceVal = state.order.type === "MARKET" ? stock.price : parseFloat(limitPriceInput.value) || stock.price;
    let total = qty * priceVal;
    
    requiredFundsLabel.textContent = formatCurrency(total);
    if (availablePowerLabel) {
        availablePowerLabel.textContent = "Unlimited (Analysis Mode)";
    }
    
    if (state.order.mode === "BUY") {
        executeBtn.className = "btn btn-primary buy btn-block";
        executeBtn.textContent = `Swipe to Track Purchase of ${state.chart.selectedStock}`;
        executeBtn.classList.remove("disabled");
    } else {
        executeBtn.className = "btn btn-primary sell btn-block";
        executeBtn.classList.add("sell-mode");
        executeBtn.textContent = `Swipe to Track Sale of ${state.chart.selectedStock}`;
        
        const activeHolding = state.user.holdings.find(h => h.symbol === state.chart.selectedStock);
        if (!activeHolding || activeHolding.shares < qty) {
            executeBtn.textContent = `Not Enough Shares (Tracked: ${activeHolding ? activeHolding.shares : 0})`;
            executeBtn.classList.add("disabled");
        } else {
            executeBtn.classList.remove("disabled");
        }
    }
}

function handleTradeExecution() {
    const stock = state.stocks[state.chart.selectedStock];
    const qtyInput = document.getElementById("order-qty");
    const limitPriceInput = document.getElementById("order-limit-price");
    
    let qty = parseInt(qtyInput.value) || 0;
    if (qty <= 0) return;
    
    let price = state.order.type === "MARKET" ? stock.price : parseFloat(limitPriceInput.value) || stock.price;
    let totalCost = qty * price;
    const displayPrice = formatCurrency(price);
    
    if (isLocalBackendActive) {
        showNotificationToast("Tracking Transaction", "Submitting track order to SQLite server...");
        fetch('/api/user/trade', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                email: state.currentUserKey,
                symbol: state.chart.selectedStock,
                qty: qty,
                price: price,
                type: state.order.mode
            })
        })
        .then(res => res.json())
        .then(body => {
            if (body.status === "success") {
                const s = body.state;
                state.user = s.profile;
                state.user.holdings = s.holdings || [];
                state.user.watchlist = s.watchlist || [];
                state.user.ordersHistory = s.ordersHistory || [];
                state.aiRules = s.aiRules || [];
                state.aiExecutionLogs = s.aiExecutionLogs || [];
                
                recalculatePortfolioVal();
                updateDetailedStockHeader();
                updateOrderConsoleCalculator();
                renderUserHistoryTable();
                showNotificationToast("Track Successful", `${state.order.mode === "BUY" ? "Tracked purchase of" : "Tracked sale of"} ${qty} shares of ${state.chart.selectedStock} at ${displayPrice}`);
            } else {
                showNotificationToast("Track Failed", body.message || "Failed to track transaction.");
            }
        })
        .catch(err => {
            console.error(err);
            showNotificationToast("Server Error", "Unable to execute track on SQLite backend.");
        });
        return;
    }
    
    if (state.order.mode === "BUY") {
        const existingPos = state.user.holdings.find(h => h.symbol === state.chart.selectedStock);
        
        if (existingPos) {
            const totalShares = existingPos.shares + qty;
            existingPos.avgPrice = parseFloat(((existingPos.shares * existingPos.avgPrice + totalCost) / totalShares).toFixed(6));
            existingPos.shares = totalShares;
        } else {
            state.user.holdings.push({
                symbol: state.chart.selectedStock,
                shares: qty,
                avgPrice: price,
                currentPrice: stock.price
            });
        }
        
        state.user.ordersHistory.unshift({
            timestamp: new Date().toLocaleString(),
            type: "BUY",
            symbol: state.chart.selectedStock,
            shares: qty,
            price: price,
            total: totalCost,
            status: "COMPLETED"
        });
        
        showNotificationToast("Track Successful", `Tracked purchase of ${qty} shares of ${state.chart.selectedStock} at ${displayPrice}`);
    } else {
        const holding = state.user.holdings.find(h => h.symbol === state.chart.selectedStock);
        if (!holding || holding.shares < qty) {
            showNotificationToast("Transaction Failed", "Insufficient stock shares held.");
            return;
        }
        
        holding.shares -= qty;
        
        if (holding.shares === 0) {
            state.user.holdings = state.user.holdings.filter(h => h.symbol !== state.chart.selectedStock);
        }
        
        state.user.ordersHistory.unshift({
            timestamp: new Date().toLocaleString(),
            type: "SELL",
            symbol: state.chart.selectedStock,
            shares: qty,
            price: price,
            total: totalCost,
            status: "COMPLETED"
        });
        
        showNotificationToast("Track Successful", `Tracked sale of ${qty} shares of ${state.chart.selectedStock} at ${displayPrice}`);
    }
    
    recalculatePortfolioVal();
    updateDetailedStockHeader();
    updateOrderConsoleCalculator();
    renderUserHistoryTable();
    
    saveStateToStorage();
}

function recalculatePortfolioVal() {
    let totalInvested = 0;
    let currentValue = 0;
    let oneDayReturns = 0;
    
    const holdings = (state.user && state.user.holdings) ? state.user.holdings : [];
    holdings.forEach(hold => {
        const stock = state.stocks[hold.symbol];
        if (!stock) return;
        
        hold.currentPrice = stock.price;
        totalInvested += hold.shares * hold.avgPrice;
        currentValue += hold.shares * stock.price;
        oneDayReturns += hold.shares * stock.change;
    });
    
    if (state.user) {
        state.user.investedValue = parseFloat(totalInvested.toFixed(2));
        state.user.walletBalance = 0.00; // Always keep cash at 0 in this pure analysis app
    }
    
    const dashPortVal = document.getElementById("dash-portfolio-value");
    const dashInvVal = document.getElementById("dash-invested-value");
    const dashTotalReturns = document.getElementById("dash-total-returns");
    const dashDayReturns = document.getElementById("dash-day-returns");
    
    if (dashPortVal) {
        dashPortVal.textContent = formatCurrency(currentValue);
    }
    if (dashInvVal) {
        dashInvVal.textContent = formatCurrency(totalInvested);
    }
    
    if (dashTotalReturns) {
        const absoluteReturns = currentValue - totalInvested;
        const pctReturns = totalInvested > 0 ? (absoluteReturns / totalInvested) * 100 : 0;
        const isUp = absoluteReturns >= 0;
        dashTotalReturns.className = `stat-val ${isUp ? 'positive' : 'negative'}`;
        dashTotalReturns.textContent = `${isUp ? '+' : ''}${formatCurrency(absoluteReturns)} (${isUp ? '+' : ''}${pctReturns.toFixed(2)}%)`;
    }
    
    if (dashDayReturns) {
        const isUp = oneDayReturns >= 0;
        const baseValue = currentValue - oneDayReturns;
        const pctDay = baseValue > 0 ? (oneDayReturns / baseValue) * 100 : 0;
        dashDayReturns.className = `stat-val ${isUp ? 'positive' : 'negative'}`;
        dashDayReturns.textContent = `${isUp ? '+' : ''}${formatCurrency(oneDayReturns)} (${isUp ? '+' : ''}${pctDay.toFixed(2)}%)`;
    }
}

function generateHistoricalData(ticker, dataCount = 200, timeframe = null) {
    if (!timeframe) {
        timeframe = (state && state.chart && state.chart.timeframe) ? state.chart.timeframe : "1D";
    }
    let basePrice = 1500;
    let volatility = 0.015;
    let trend = 0.0005;
    switch (ticker) {
        case "RELIANCE": basePrice = 1323.10; volatility = 0.012; trend = 0.0003; break;
        case "TCS":      basePrice = 2251.10; volatility = 0.011; trend = 0.0004; break;
        case "INFY":     basePrice = 1087.10; volatility = 0.014; trend = 0.0005; break;
        case "SBIN":     basePrice = 1060.00; volatility = 0.016; trend = 0.0006; break;
        case "HDFCBANK": basePrice = 777.60; volatility = 0.013; trend = 0.0003; break;
        case "ICICIBANK":basePrice = 1460.20; volatility = 0.014; trend = 0.0004; break;
        case "BHARTIALRT":basePrice = 1300; volatility = 0.015; trend = 0.0005; break;
        case "ITC":      basePrice = 282.70; volatility = 0.011; trend = 0.0003; break;
        case "TATASTEEL": basePrice = 186.41; volatility = 0.018; trend = 0.0002; break;
        case "WIPRO":    basePrice = 176.38; volatility = 0.015; trend = 0.0004; break;
        default:
            const seed = ticker.charCodeAt(0) ? ticker.charCodeAt(0) * 12 : 1500;
            basePrice = (seed % 4000) + 100;
            volatility = 0.015;
            trend = 0.0004;
            break;
    }
    const data = [];
    let currentPrice = basePrice;

    let timeStepMs = 24 * 3600 * 1000;
    switch (timeframe) {
        case "1m":  timeStepMs = 60 * 1000; break;
        case "5m":  timeStepMs = 5 * 60 * 1000; break;
        case "30m": timeStepMs = 30 * 60 * 1000; break;
        case "1H":  timeStepMs = 3600 * 1000; break;
        case "1D":  timeStepMs = 5 * 60 * 1000; break; // 5-minute candles for TODAY
        case "1W":  timeStepMs = 30 * 60 * 1000; break; // 30-minute candles
        case "1M":  timeStepMs = 24 * 3600 * 1000; break; // 1-day candles
        case "1Y":  timeStepMs = 7 * 24 * 3600 * 1000; break; // 1-week candles
        case "ALL": timeStepMs = 30 * 24 * 3600 * 1000; break; // 1-month candles
    }

    let candleCount = (timeframe === "1D") ? 45 : (timeframe === "1W" ? 60 : 75);
    let time = new Date(Date.now() - candleCount * timeStepMs);
    for (let i = 0; i < candleCount; i++) {
        const change = currentPrice * (volatility * (Math.random() - 0.48) + trend);
        const open = currentPrice;
        const close = currentPrice + change;
        const maxRange = Math.abs(change) * (1.1 + Math.random() * 0.8);
        const high = Math.max(open, close) + maxRange * 0.4;
        const low = Math.min(open, close) - maxRange * 0.4;
        currentPrice = close;
        time = new Date(time.getTime() + timeStepMs);

        let dateStr = "";
        if (timeframe === "1D" || timeframe === "1m" || timeframe === "5m" || timeframe === "30m") {
            dateStr = time.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
        } else if (timeframe === "1W" || timeframe === "1H") {
            dateStr = time.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) + " " + time.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
        } else if (timeframe === "1M") {
            dateStr = time.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
        } else {
            dateStr = time.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
        }

        data.push({
            date: dateStr,
            open: parseFloat(open.toFixed(2)),
            high: parseFloat(high.toFixed(2)),
            low: parseFloat(low.toFixed(2)),
            close: parseFloat(close.toFixed(2)),
            volume: Math.round(100000 + Math.random() * 900000)
        });
    }
    return data;
}

async function fetchLiveMarketData(symbol, timeframe = null) {
    if (!timeframe) {
        timeframe = (state && state.chart && state.chart.timeframe) ? state.chart.timeframe : "1D";
    }
    try {
        if (isLocalBackendActive) {
            const quoteUrl = `/api/yahoo/quote?symbol=${symbol}`;
            const quoteRes = await fetch(quoteUrl);
            const quoteData = await quoteRes.json();
            if (quoteData.status !== "success" || !quoteData.data) {
                console.warn(`Empty quote from Yahoo proxy for ${symbol}`);
                return null;
            }
            const quote = quoteData.data;

            let period = "1d";
            let interval = "5m";
            switch (timeframe) {
                case "1m":  period = "1d";  interval = "1m";  break;
                case "5m":  period = "1d";  interval = "5m";  break;
                case "30m": period = "5d";  interval = "30m"; break;
                case "1H":  period = "5d";  interval = "1h";  break;
                case "1D":  period = "1d";  interval = "5m";  break;
                case "1W":  period = "5d";  interval = "15m"; break;
                case "1M":  period = "1mo"; interval = "1d";  break;
                case "1Y":  period = "1y";  interval = "1d";  break;
                case "ALL": period = "max"; interval = "1mo"; break;
                default:    period = "1d";  interval = "5m";  break;
            }

            const historyUrl = `/api/yahoo/history?symbol=${symbol}&period=${period}&interval=${interval}`;
            const historyRes = await fetch(historyUrl);
            const historyData = await historyRes.json();
            if (historyData.status !== "success" || !historyData.data) {
                console.warn(`Historical history query failed for ${symbol}`);
                return null;
            }
            const historyList = historyData.data;
            const mappedData = historyList.map(item => ({
                date: item.date,
                open: parseFloat(item.open.toFixed(2)),
                high: parseFloat(item.high.toFixed(2)),
                low: parseFloat(item.low.toFixed(2)),
                close: parseFloat(item.close.toFixed(2)),
                volume: item.volume
            }));

            return {
                price: parseFloat(quote.price.toFixed(2)),
                change: parseFloat((quote.change || 0).toFixed(2)),
                pctChange: parseFloat((quote.pctChange || 0).toFixed(2)),
                open: quote.open,
                volume: quote.volume,
                previousClose: quote.previousClose,
                dayHigh: quote.dayHigh,
                dayLow: quote.dayLow,
                high52w: quote.high52w,
                low52w: quote.low52w,
                data: mappedData
            };
        } else {
            const tokenParam = state.apiSettings.key ? `&token=${encodeURIComponent(state.apiSettings.key)}` : "";
            const quoteUrl = `/api/market/quote?symbol=${symbol}${tokenParam}`;
            const quoteRes = await fetch(quoteUrl);
            const quoteData = await quoteRes.json();
            if (quoteData.status !== "success" || !quoteData.data) {
                console.warn(`Empty quote from server proxy for ${symbol}`);
                return null;
            }
            const quote = quoteData.data;
            if (!quote || quote.c === 0) {
                console.warn(`Empty Finnhub quote for ${symbol}`);
                return null;
            }

            let resolution = "D";
            let lookbackDays = 270;
            switch (timeframe) {
                case "1m":  resolution = "1";  lookbackDays = 1;    break;
                case "5m":  resolution = "5";  lookbackDays = 5;    break;
                case "30m": resolution = "30"; lookbackDays = 10;   break;
                case "1H":  resolution = "60"; lookbackDays = 30;   break;
                case "1D":  resolution = "D";  lookbackDays = 270;  break;
                case "1W":  resolution = "W";  lookbackDays = 730;  break;
                case "1M":  resolution = "M";  lookbackDays = 1825; break;
                case "3M":  resolution = "W";  lookbackDays = 1095; break;
                case "6M":  resolution = "W";  lookbackDays = 1825; break;
                case "1Y":  resolution = "M";  lookbackDays = 1825; break;
                case "3Y":  resolution = "M";  lookbackDays = 3650; break;
                case "5Y":  resolution = "M";  lookbackDays = 3650; break;
                case "ALL": resolution = "M";  lookbackDays = 5475; break;
            }

            const to = Math.floor(Date.now() / 1000);
            const from = to - (lookbackDays * 24 * 3600);
            const candleUrl = `/api/market/candles?symbol=${symbol}&resolution=${resolution}&from=${from}&to=${to}${tokenParam}`;
            const candleRes = await fetch(candleUrl);
            const candleData = await candleRes.json();
            if (candleData.status !== "success" || !candleData.data || candleData.data.s !== "ok") {
                console.warn(`Historical candles query failed for ${symbol}`);
                return null;
            }
            const candles = candleData.data;
            const mappedData = [];
            for (let i = 0; i < candles.c.length; i++) {
                const time = new Date(candles.t[i] * 1000);
                
                let dateStr = "";
                if (timeframe === "1m" || timeframe === "5m" || timeframe === "30m") {
                    dateStr = time.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
                } else if (timeframe === "1H") {
                    dateStr = time.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) + " " + time.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
                } else if (timeframe === "1M" || timeframe === "1Y" || timeframe === "3Y" || timeframe === "5Y" || timeframe === "ALL") {
                    dateStr = time.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
                } else {
                    dateStr = time.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
                }

                mappedData.push({
                    date: dateStr,
                    open: parseFloat(candles.o[i].toFixed(2)),
                    high: parseFloat(candles.h[i].toFixed(2)),
                    low: parseFloat(candles.l[i].toFixed(2)),
                    close: parseFloat(candles.c[i].toFixed(2)),
                    volume: Math.round(candles.v[i] || 50000)
                });
            }
            let low52w = quote.l || quote.c * 0.75;
            let high52w = quote.h || quote.c * 1.25;
            if (mappedData.length > 0) {
                low52w = Math.min(...mappedData.map(c => c.low));
                high52w = Math.max(...mappedData.map(c => c.high));
            }
            return {
                price: parseFloat(quote.c.toFixed(2)),
                change: parseFloat((quote.d || 0).toFixed(2)),
                pctChange: parseFloat((quote.dp || 0).toFixed(2)),
                open: quote.o || quote.c,
                previousClose: quote.pc || quote.c,
                dayHigh: quote.h || quote.c,
                dayLow: quote.l || quote.c,
                volume: mappedData.length > 0 ? mappedData[mappedData.length - 1].volume : 1500000,
                high52w: high52w,
                low52w: low52w,
                data: mappedData
            };
        }
    } catch (e) {
        console.error(`Local proxy query crash on ${symbol}:`, e);
        return null;
    }
}

async function reloadSingleStockHistory(symbol, timeframe) {
    if (!symbol) return;
    const isLive = isLocalBackendActive || (state.apiSettings.provider === "finnhub" && state.apiSettings.key);
    if (isLive) {
        const liveResult = await fetchLiveMarketData(symbol, timeframe);
        if (liveResult) {
            state.stocks[symbol].price = liveResult.price;
            state.stocks[symbol].change = liveResult.change;
            state.stocks[symbol].pctChange = liveResult.pctChange;
            state.stocks[symbol].open = liveResult.open;
            state.stocks[symbol].volume = liveResult.volume;
            state.stocks[symbol].previousClose = liveResult.previousClose;
            state.stocks[symbol].dayHigh = liveResult.dayHigh;
            state.stocks[symbol].dayLow = liveResult.dayLow;
            state.stocks[symbol].high52w = liveResult.high52w;
            state.stocks[symbol].low52w = liveResult.low52w;
            state.stocks[symbol].data = liveResult.data;

            if (isLocalBackendActive) {
                try {
                    const fundRes = await fetch(`/api/yahoo/fundamentals?symbol=${encodeURIComponent(symbol)}`);
                    const fundData = await fundRes.json();
                    if (fundData.status === "success" && fundData.data) {
                        state.stocks[symbol].fundamentals = fundData.data;
                    }
                } catch (fundErr) {
                    console.warn("Failed to fetch dynamic fundamentals for", symbol, fundErr);
                }
            }
        } else {
            state.stocks[symbol].data = generateHistoricalData(symbol, 250, timeframe);
            if (!state.stocks[symbol].open) {
                const price = state.stocks[symbol].price;
                state.stocks[symbol].open = price * (0.99 + Math.random() * 0.02);
                state.stocks[symbol].previousClose = price * (0.985 + Math.random() * 0.03);
                state.stocks[symbol].dayHigh = Math.max(price, state.stocks[symbol].open) * (1.0 + Math.random() * 0.02);
                state.stocks[symbol].dayLow = Math.min(price, state.stocks[symbol].open) * (1.0 - Math.random() * 0.02);
                state.stocks[symbol].volume = Math.round(500000 + Math.random() * 2000000);
                state.stocks[symbol].high52w = price * (1.1 + Math.random() * 0.4);
                state.stocks[symbol].low52w = price * (0.6 + Math.random() * 0.3);
            }
        }
    } else {
        state.stocks[symbol].data = generateHistoricalData(symbol, 250, timeframe);
        if (!state.stocks[symbol].open) {
            const price = state.stocks[symbol].price;
            state.stocks[symbol].open = price * (0.99 + Math.random() * 0.02);
            state.stocks[symbol].previousClose = price * (0.985 + Math.random() * 0.03);
            state.stocks[symbol].dayHigh = Math.max(price, state.stocks[symbol].open) * (1.0 + Math.random() * 0.02);
            state.stocks[symbol].dayLow = Math.min(price, state.stocks[symbol].open) * (1.0 - Math.random() * 0.02);
            state.stocks[symbol].volume = Math.round(500000 + Math.random() * 2000000);
            state.stocks[symbol].high52w = price * (1.1 + Math.random() * 0.4);
            state.stocks[symbol].low52w = price * (0.6 + Math.random() * 0.3);
        }
    }
}

async function reloadAllHistoricalData() {
    showMarketsSkeletonLoader();
    const isLive = isLocalBackendActive || (state.apiSettings.provider === "finnhub" && state.apiSettings.key);
    if (isLive) {
        if (isLocalBackendActive) {
            showNotificationToast("Connecting API", "Fetching live Indian market quotes from Yahoo Finance...");
        } else {
            showNotificationToast("Connecting API", "Fetching live market indices from Finnhub...");
        }
    }
    const loadPromises = Object.keys(state.stocks).map(async (ticker) => {
        await reloadSingleStockHistory(ticker, state.chart.timeframe);
    });
    
    const startTime = Date.now();
    await Promise.all(loadPromises);
    const duration = Date.now() - startTime;
    if (duration < 600) {
        await new Promise(resolve => setTimeout(resolve, 600 - duration));
    }
    
    updateDetailedStockHeader();
    drawTechnicalCharts();
    updateOrderConsoleCalculator();
    updateAnalystConsoleUI();
    hideMarketsSkeletonLoader();
    console.log("Historical data reloaded successfully!");
}

function startLiveMarketFeed() {
    setInterval(async () => {
        const isLive = isLocalBackendActive || (state.apiSettings.provider === "finnhub" && state.apiSettings.key);
        
        if (isLive) {
            if (isLocalBackendActive) {
                const symbols = Object.keys(state.stocks).join(",");
                if (symbols) {
                    try {
                        const batchUrl = `/api/yahoo/batch-quotes?symbols=${symbols}`;
                        const res = await fetch(batchUrl);
                        const data = await res.json();
                        if (data.status === "success" && data.data) {
                            Object.keys(data.data).forEach(ticker => {
                                const quote = data.data[ticker];
                                const stock = state.stocks[ticker];
                                if (stock && quote && !quote.error) {
                                    stock.price = parseFloat(quote.price.toFixed(2));
                                    stock.change = parseFloat((quote.change || 0).toFixed(2));
                                    stock.pctChange = parseFloat((quote.pctChange || 0).toFixed(2));
                                    
                                    const last = stock.data[stock.data.length - 1];
                                    if (last) {
                                        last.close = stock.price;
                                        if (stock.price > last.high) last.high = stock.price;
                                        if (stock.price < last.low) last.low = stock.price;
                                    }
                                }
                            });
                        }
                    } catch (e) {
                        console.warn("Live Yahoo batch-quote tick fetch skipped:", e);
                    }
                }
            } else {
                const activeSymbol = state.chart.selectedStock;
                if (activeSymbol) {
                    try {
                        const quoteUrl = `/api/market/quote?symbol=${activeSymbol}`;
                        const res = await fetch(quoteUrl);
                        const quoteData = await res.json();
                        
                        if (quoteData.status === "success" && quoteData.data) {
                            const quote = quoteData.data;
                            if (quote && quote.c > 0) {
                                const stock = state.stocks[activeSymbol];
                                if (stock) {
                                    stock.price = parseFloat(quote.c.toFixed(2));
                                    stock.change = parseFloat((quote.d || 0).toFixed(2));
                                    stock.pctChange = parseFloat((quote.dp || 0).toFixed(2));
                                    
                                    const last = stock.data[stock.data.length - 1];
                                    if (last) {
                                        last.close = stock.price;
                                        if (stock.price > last.high) last.high = stock.price;
                                        if (stock.price < last.low) last.low = stock.price;
                                    }
                                }
                            }
                        }
                    } catch (e) {
                        console.warn("Live Finnhub tick fetch skipped:", e);
                    }
                }
            }
        } else {
            // Simulated pricing fluctuations
            Object.keys(state.stocks).forEach(ticker => {
                const stock = state.stocks[ticker];
                const volatility = ticker === "BTC" ? 15.0 : ticker === "TSLA" ? 0.35 : ticker === "NVDA" ? 0.65 : 0.15;
                const change = (Math.random() - 0.49) * volatility;
                
                stock.price = parseFloat(Math.max(1.0, stock.price + change).toFixed(2));
                const dayStartPrice = stock.data[stock.data.length - 5].close;
                stock.change = parseFloat((stock.price - dayStartPrice).toFixed(2));
                stock.pctChange = parseFloat(((stock.change / dayStartPrice) * 100).toFixed(2));
                
                const last = stock.data[stock.data.length - 1];
                if (last) {
                    last.close = stock.price;
                    if (stock.price > last.high) last.high = stock.price;
                    if (stock.price < last.low) last.low = stock.price;
                }
            });
        }

        // Run automated rules
        checkAutomatedAIPlans();

        // Update UI
        if (state.currentTab === "dashboard") {
            renderDashboardWatchlist();
            renderDashboardPortfolio();
        } else if (state.currentTab === "markets") {
            renderMarketTickers();
            updateDetailedStockHeader();
            drawTechnicalCharts();
            updateOrderConsoleCalculator();
        }
    }, 3000);
}


// --- Groww Manual Importer Form Handler ---
// --- Groww Manual Importer Form Handler with Unified Autocomplete ---
function bindStockAutocomplete(inputEl, suggestionsEl, isMarketTab = false) {
    if (!inputEl || !suggestionsEl) return;
    
    let debounceTimeout = null;
    
    function getStockExchangeBadge(ticker) {
        return `<span class="exch-badge nse">NSE</span>`;
    }

    function getStockLogoColorClass(ticker) {
        if (ticker === "RELIANCE") return "logo-purple";
        if (ticker === "TCS") return "logo-blue";
        if (ticker === "INFY") return "logo-green";
        if (ticker === "HDFCBANK") return "logo-navy";
        if (ticker === "ICICIBANK") return "logo-orange";
        if (ticker === "SBIN") return "logo-teal";
        if (ticker === "BHARTIALRT") return "logo-red";
        if (ticker === "ITC") return "logo-gold";
        if (ticker === "TATASTEEL") return "logo-darkgrey";
        if (ticker === "WIPRO") return "logo-azure";
        return "logo-blue";
    }

    inputEl.addEventListener("input", () => {
        const query = inputEl.value.trim().toUpperCase();
        if (!query) {
            suggestionsEl.innerHTML = "";
            suggestionsEl.classList.add("hidden");
            if (isMarketTab) {
                renderMarketTickers();
            }
            return;
        }
        
        if (isMarketTab) {
            renderMarketTickers();
        }
        
        // 1. Instantly render local matches from state.stocks (zero lag)
        const availableAssets = Object.keys(state.stocks).map(ticker => ({
            ticker: ticker,
            name: state.stocks[ticker].name,
            price: state.stocks[ticker].price,
            change: state.stocks[ticker].change,
            pctChange: state.stocks[ticker].pctChange
        }));
        
        const localMatches = availableAssets.filter(asset => 
            asset.ticker.startsWith(query) || 
            asset.name.toUpperCase().includes(query)
        );
        
        renderSuggestions(localMatches, query);
        
        // 2. Debounce and fetch additional global matches from Finnhub search + quote API proxy
        clearTimeout(debounceTimeout);
        debounceTimeout = setTimeout(async () => {
            try {
                if (isLocalBackendActive) {
                    const searchRes = await fetch(`/api/yahoo/search?q=${encodeURIComponent(query)}`);
                    const searchData = await searchRes.json();
                    
                    if (inputEl.value.trim().toUpperCase() !== query) return;
                    
                    if (searchData.status === "success" && searchData.data) {
                        const results = searchData.data.slice(0, 5);
                        const fetchedMatches = [];
                        
                        for (const res of results) {
                            const ticker = res.symbol;
                            if (localMatches.some(m => m.ticker === ticker)) continue;
                            
                            const quoteRes = await fetch(`/api/yahoo/quote?symbol=${ticker}`);
                            const quoteData = await quoteRes.json();
                            
                            if (quoteData.status === "success" && quoteData.data) {
                                const quote = quoteData.data;
                                fetchedMatches.push({
                                    ticker: ticker,
                                    name: res.name || `${ticker} Corporation`,
                                    price: quote.price,
                                    change: quote.change || 0,
                                    pctChange: quote.pctChange || 0,
                                    isFetched: true
                                });
                            }
                        }
                        
                        if (fetchedMatches.length > 0) {
                            const combined = [...localMatches, ...fetchedMatches];
                            renderSuggestions(combined, query);
                        }
                    }
                } else {
                    const searchRes = await fetch(`/api/market/search?q=${encodeURIComponent(query)}`);
                    const searchData = await searchRes.json();
                    
                    if (inputEl.value.trim().toUpperCase() !== query) return;
                    
                    if (searchData.status === "success" && searchData.data && searchData.data.result) {
                        const results = searchData.data.result.slice(0, 5);
                        const fetchedMatches = [];
                        
                        for (const res of results) {
                            const ticker = res.symbol;
                            if (localMatches.some(m => m.ticker === ticker)) continue;
                            
                            const quoteRes = await fetch(`/api/market/quote?symbol=${ticker}`);
                            const quoteData = await quoteRes.json();
                            
                            if (quoteData.status === "success" && quoteData.data && quoteData.data.c > 0) {
                                const quote = quoteData.data;
                                fetchedMatches.push({
                                    ticker: ticker,
                                    name: res.description || `${ticker} Corporation`,
                                    price: quote.c,
                                    change: quote.d || 0,
                                    pctChange: quote.dp || 0,
                                    isFetched: true
                                });
                            }
                        }
                        
                        if (fetchedMatches.length > 0) {
                            const combined = [...localMatches, ...fetchedMatches];
                            renderSuggestions(combined, query);
                        }
                    }
                }
            } catch (err) {
                console.error("Autocomplete fetch error:", err);
            }
        }, 350);
    });

    function renderSuggestions(matches, query) {
        suggestionsEl.innerHTML = "";
        
        if (matches.length === 0) {
            const cleanQuery = query.replace(/[^A-Z0-9.\-]/g, "").slice(0, 10);
            if (cleanQuery) {
                const customItem = createCustomItem(cleanQuery, query);
                suggestionsEl.appendChild(customItem);
                suggestionsEl.classList.remove("hidden");
            } else {
                suggestionsEl.classList.add("hidden");
            }
            return;
        }
        
        matches.forEach(match => {
            const item = document.createElement("div");
            item.className = "suggestion-item";
            
            const isUp = match.change >= 0;
            const changeClass = isUp ? "positive" : "negative";
            const changeSign = isUp ? "+" : "";
            
            const logoClass = getStockLogoColorClass(match.ticker);
            const exchBadge = getStockExchangeBadge(match.ticker);
            const initial = match.ticker.charAt(0);
            
            item.innerHTML = `
                <div class="suggestion-meta-box" style="display: flex; align-items: center; gap: 12px;">
                    <div class="stock-logo-circle ${logoClass}">${initial}</div>
                    <div class="suggestion-details" style="display: flex; flex-direction: column; gap: 2px;">
                        <span class="suggestion-ticker" style="font-weight: 700; color: var(--text-primary); font-size: 0.9rem;">${match.ticker} ${exchBadge}</span>
                        <span class="suggestion-name" style="color: var(--text-secondary); font-size: 0.76rem; max-width: 180px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${match.name}</span>
                    </div>
                </div>
                <div class="suggestion-price-area" style="text-align: right; display: flex; flex-direction: column; gap: 2px;">
                    <span class="suggestion-price" style="font-weight: 600; color: var(--text-primary); font-size: 0.9rem;">${formatCurrency(match.price)}</span>
                    <span class="suggestion-pct-change ${changeClass}" style="font-size: 0.76rem; font-weight: 700;">${changeSign}${match.pctChange.toFixed(2)}%</span>
                </div>
            `;
            
            item.addEventListener("click", async () => {
                if (isMarketTab) {
                    inputEl.value = match.ticker;
                    suggestionsEl.innerHTML = "";
                    suggestionsEl.classList.add("hidden");
                    
                    if (!state.stocks[match.ticker]) {
                        state.stocks[match.ticker] = {
                            name: match.name,
                            price: match.price,
                            change: match.change,
                            pctChange: match.pctChange,
                            data: []
                        };
                    }
                    
                    renderMarketTickers();
                    await selectActiveStock(match.ticker);
                    saveStateToStorage();
                } else {
                    inputEl.value = match.ticker;
                    suggestionsEl.innerHTML = "";
                    suggestionsEl.classList.add("hidden");
                    
                    if (!state.stocks[match.ticker]) {
                        state.stocks[match.ticker] = {
                            name: match.name,
                            price: match.price,
                            change: match.change,
                            pctChange: match.pctChange,
                            data: generateHistoricalData(match.ticker, 250)
                        };
                    }
                    
                    const trackInputs = document.getElementById("hero-track-inputs");
                    if (trackInputs) {
                        trackInputs.classList.remove("hidden");
                        const priceInput = document.getElementById("import-price");
                        if (priceInput) priceInput.value = match.price.toFixed(2);
                        const qtyInput = document.getElementById("import-qty");
                        if (qtyInput) {
                            qtyInput.value = "";
                            qtyInput.focus();
                        }
                    }
                }
            });
            
            suggestionsEl.appendChild(item);
        });
        
        const exactMatch = matches.some(m => m.ticker === query);
        const cleanQuery = query.replace(/[^A-Z0-9.\-]/g, "").slice(0, 10);
        if (!exactMatch && cleanQuery) {
            const customItem = createCustomItem(cleanQuery, query);
            suggestionsEl.appendChild(customItem);
        }
        
        suggestionsEl.classList.remove("hidden");
    }
    
    function createCustomItem(cleanTicker, originalQuery) {
        const customItem = document.createElement("div");
        customItem.className = "suggestion-item";
        customItem.innerHTML = `
            <div class="suggestion-meta-box" style="display: flex; align-items: center; gap: 12px;">
                <div class="stock-logo-circle logo-blue">+</div>
                <div class="suggestion-details" style="display: flex; flex-direction: column; gap: 2px;">
                    <span class="suggestion-ticker" style="font-weight: 700; color: var(--text-primary); font-size: 0.9rem;">${cleanTicker} <span class="exch-badge">NEW ASSET</span></span>
                    <span class="suggestion-name" style="color: var(--text-secondary); font-size: 0.76rem;">Track custom stock ticker</span>
                </div>
            </div>
            <div class="suggestion-price-area" style="text-align: right;">
                <span class="suggestion-price" style="font-size: 0.76rem; color: var(--primary-blue); font-weight: 700;">+ Track Asset</span>
            </div>
        `;
        
        customItem.addEventListener("click", async () => {
            if (isMarketTab) {
                inputEl.value = cleanTicker;
                suggestionsEl.innerHTML = "";
                suggestionsEl.classList.add("hidden");
                
                if (!state.stocks[cleanTicker]) {
                    const defaultPrice = 100.00;
                    state.stocks[cleanTicker] = {
                        name: `${cleanTicker} Corporation`,
                        price: defaultPrice,
                        change: 0.00,
                        pctChange: 0.00,
                        data: []
                    };
                }
                
                renderMarketTickers();
                await selectActiveStock(cleanTicker);
                saveStateToStorage();
            } else {
                inputEl.value = cleanTicker;
                suggestionsEl.innerHTML = "";
                suggestionsEl.classList.add("hidden");
                
                const trackInputs = document.getElementById("hero-track-inputs");
                if (trackInputs) {
                    trackInputs.classList.remove("hidden");
                    const priceInput = document.getElementById("import-price");
                    if (priceInput) {
                        priceInput.value = "";
                        priceInput.placeholder = "Enter Buy Price";
                        priceInput.focus();
                    }
                    const qtyInput = document.getElementById("import-qty");
                    if (qtyInput) {
                        qtyInput.value = "";
                    }
                }
            }
        });
        
        return customItem;
    }
    
    document.addEventListener("click", (e) => {
        if (e.target !== inputEl && !suggestionsEl.contains(e.target)) {
            suggestionsEl.innerHTML = "";
            suggestionsEl.classList.add("hidden");
        }
    });
}

function setupTickerSuggestions() {
    const importTickerInput = document.getElementById("import-ticker");
    const importSuggestionsDropdown = document.getElementById("ticker-suggestions");
    if (importTickerInput && importSuggestionsDropdown) {
        bindStockAutocomplete(importTickerInput, importSuggestionsDropdown, false);
    }
}

function handleGrowwManualImport(e) {
    e.preventDefault();
    
    const tickerInput = document.getElementById("import-ticker");
    const priceInput = document.getElementById("import-price");
    const qtyInput = document.getElementById("import-qty");
    
    if (!tickerInput || !priceInput || !qtyInput) return;
    
    const ticker = tickerInput.value.toUpperCase().trim();
    const price = parseFloat(priceInput.value) || 0;
    const qty = parseInt(qtyInput.value) || 0;
    
    if (!ticker || price <= 0 || qty <= 0) {
        showNotificationToast("Import Failed", "Please enter valid ticker, price, and quantity.");
        return;
    }
    
    tickerInput.value = "";
    priceInput.value = "";
    qtyInput.value = "";
    
    if (!state.stocks[ticker]) {
        state.stocks[ticker] = {
            name: `${ticker} Inc.`,
            price: price,
            change: 0,
            pctChange: 0,
            data: generateHistoricalData(ticker, 250)
        };
        state.stocks[ticker].price = state.stocks[ticker].data[state.stocks[ticker].data.length - 1].close;
    }
    
    const liveStock = state.stocks[ticker];
    const existingHolding = state.user.holdings.find(h => h.symbol === ticker);
    const totalCost = qty * price;
    
    if (existingHolding) {
        const totalShares = existingHolding.shares + qty;
        existingHolding.avgPrice = parseFloat(((existingHolding.shares * existingHolding.avgPrice + totalCost) / totalShares).toFixed(2));
        existingHolding.shares = totalShares;
    } else {
        state.user.holdings.push({
            symbol: ticker,
            shares: qty,
            avgPrice: price,
            currentPrice: liveStock.price
        });
    }
    
    if (!state.user.watchlist.includes(ticker)) {
        state.user.watchlist.push(ticker);
    }
    
    state.user.ordersHistory.unshift({
        timestamp: new Date().toLocaleString(),
        type: "IMPORT (GROWW)",
        symbol: ticker,
        shares: qty,
        price: price,
        total: totalCost,
        status: "COMPLETED"
    });
    
    recalculatePortfolioVal();
    renderDashboardWatchlist();
    renderDashboardPortfolio();
    renderUserHistoryTable();
    
    saveStateToStorage();
    
    showNotificationToast("Asset Tracked", `Manually synced ${qty} shares of ${ticker} from Groww!`);
    document.getElementById("dashboard-portfolio-list").scrollIntoView({ behavior: 'smooth' });
}


// --- API settings Saving Panel ---
function handleSaveAPISettings() {
    const feedSelect = document.getElementById("api-feed-select");
    const keyInput = document.getElementById("api-key-input");
    const geminiInput = document.getElementById("gemini-key-input");
    
    if (!feedSelect || !keyInput) return;
    
    state.apiSettings.provider = feedSelect.value;
    state.apiSettings.key = keyInput.value.trim();
    if (geminiInput) {
        state.apiSettings.geminiKey = geminiInput.value.trim();
    }
    
    saveStateToStorage();
    showNotificationToast("Connections Saved", "API and Gemini AI settings saved successfully.");
    
    reloadAllHistoricalData();
}

function loadSavedAPISettingsToUI() {
    const feedSelect = document.getElementById("api-feed-select");
    const keyInput = document.getElementById("api-key-input");
    const geminiInput = document.getElementById("gemini-key-input");
    
    if (feedSelect && keyInput) {
        feedSelect.value = state.apiSettings.provider || "finnhub";
        keyInput.value = state.apiSettings.key || "";
    }
    if (geminiInput) {
        geminiInput.value = state.apiSettings.geminiKey || "";
    }
}


// --- Toro AI Agent Engine (Dynamic Signals & Auto-Planner) ---
const aiKnowledgeBase = {
    rsi: "RSI (Relative Strength Index) measures the speed and change of price movements. Values below 30 suggest oversold conditions (bullish buying opportunities for Conservative risk), while values above 70 suggest overbought conditions (sell or profit-taking zones).",
    macd: "MACD (Moving Average Convergence Divergence) shows momentum trends. An upward crossing of the blue MACD line above the yellow Signal line indicates bullish momentum (Buy), while crossing below signifies high selling pressure.",
    ema: "The Exponential Moving Average (EMA) places a greater weight on the most recent prices. When prices stay above the 20-day EMA, the overall technical trend is strong bullish. Toggling EMA shows custom support dynamic baselines."
};

async function processAIChatQuery() {
    const inputField = document.getElementById("ai-chat-input");
    const container = document.getElementById("ai-chat-messages");
    if (!inputField || !inputField.value.trim()) return;
    
    const prompt = inputField.value.trim();
    inputField.value = "";
    
    appendChatMessage(prompt, "user-message");
    
    const selectedTicker = state.chart.selectedStock;
    const stock = state.stocks[selectedTicker];
    if (!stock) {
        appendChatMessage("Please select a valid stock in the Markets tab first.", "ai-message");
        return;
    }
    
    const fullData = stock.data || [];
    const rsiArray = fullData.length > 0 ? calculateRSI(fullData, 14) : [50];
    const activeRsi = rsiArray[rsiArray.length - 1] || 50;

    const tempMsgId = "ai-thinking-" + Date.now();
    appendChatMessage(`<span id="${tempMsgId}">✨ <em>Toro AI (Gemini) is analyzing live market data...</em></span>`, "ai-message");

    const payload = {
        prompt: prompt,
        gemini_key: (state.apiSettings && state.apiSettings.geminiKey) ? state.apiSettings.geminiKey : "",
        context: {
            selectedStock: selectedTicker,
            price: stock.price,
            change: stock.pctChange,
            rsi: activeRsi,
            riskProfile: state.user.riskProfile,
            fundamentals: getStockFundamentals(selectedTicker, stock.price),
            holdings: state.user.holdings
        }
    };

    try {
        const res = await fetch('/api/ai/chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        const data = await res.json();
        
        const tempEl = document.getElementById(tempMsgId);
        if (tempEl && tempEl.parentElement) {
            tempEl.parentElement.parentElement.remove();
        }

        if (data.status === "success" && data.reply) {
            const formattedReply = formatMarkdownToHTML(data.reply);
            const modelBadge = `<div style="margin-top: 8px; font-size: 0.72rem; color: var(--primary-blue); font-weight: 600;">⚡ Powered by ${data.model || 'Toro AI'}</div>`;
            appendChatMessage(formattedReply + modelBadge, "ai-message");
        } else if (data.status === "error") {
            appendChatMessage(`⚠️ ${data.message || "Toro AI is temporarily unavailable. Please try again in a few seconds."}`, "ai-message");
        }
    } catch (err) {
        console.warn("Backend Gemini AI chat endpoint error:", err);
        const tempEl = document.getElementById(tempMsgId);
        if (tempEl && tempEl.parentElement) {
            tempEl.parentElement.parentElement.remove();
        }
        appendChatMessage("⚠️ Could not connect to Toro AI server. Please make sure the server is running.", "ai-message");
    }
}

function formatMarkdownToHTML(md) {
    if (!md) return "";
    let html = md
        .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")
        .replace(/\*(.*?)\*/g, "<em>$1</em>")
        .replace(/^### (.*$)/gim, '<h4 style="margin: 8px 0 4px 0; color: var(--text-primary);">$1</h4>')
        .replace(/^## (.*$)/gim, '<h3 style="margin: 10px 0 5px 0; color: var(--text-primary);">$1</h3>')
        .replace(/^\* (.*$)/gim, '• $1')
        .replace(/\n/g, "<br>");
    return html;
}

function appendChatMessage(text, className) {
    const container = document.getElementById("ai-chat-messages");
    if (!container) return;
    
    const msgDiv = document.createElement("div");
    msgDiv.className = `message ${className}`;
    
    const bubble = document.createElement("div");
    bubble.className = "message-bubble";
    bubble.innerHTML = text;
    
    const timeSpan = document.createElement("span");
    timeSpan.className = "message-time";
    timeSpan.textContent = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    
    msgDiv.appendChild(bubble);
    msgDiv.appendChild(timeSpan);
    container.appendChild(msgDiv);
    
    container.scrollTop = container.scrollHeight;
}

function generateAIAnalysisOutput(ticker, rsi, price) {
    const risk = state.user.riskProfile;
    let signal = "HOLD";
    let explanation = "";
    
    if (rsi < 32) {
        signal = risk === "conservative" ? "BUY" : "STRONG BUY";
        explanation = `RSI indicators are oversold at **${rsi.toFixed(1)}**. Under **${risk}** risk settings, this indicates strong value support.`;
    } else if (rsi > 68) {
        signal = risk === "aggressive" ? "HOLD" : "NEUTRAL / PROFIT-TAKING";
        explanation = `Relative strength is overbought at **${rsi.toFixed(1)}**. Momentum indicators suggest price consolidation.`;
    } else {
        signal = "ACCUMULATE";
        explanation = `Price metrics for **${ticker}** are consolidating inside the neutral band (RSI: ${rsi.toFixed(1)}).`;
    }
    
    return `
        <strong>Toro AI Analysis for ${ticker}</strong><br>
        <span class="ai-badge mini" style="margin-top: 6px; display: inline-block;">Signal: ${signal}</span><br><br>
        • <strong>Current Price:</strong> ${formatCurrency(price)}<br>
        • <strong>RSI (14):</strong> ${rsi.toFixed(1)}<br><br>
        <em>Summary:</em> ${explanation}
    `;
}

function executeFullAIChartAnalysis() {
    const ticker = state.chart.selectedStock;
    const stock = state.stocks[ticker];
    const rsiArray = calculateRSI(stock.data, 14);
    const activeRsi = rsiArray[rsiArray.length - 1];
    
    const analysisMarkup = generateAIAnalysisOutput(ticker, activeRsi, stock.price);
    state.currentTab = "ai-planner";
    updateActiveTabs();
    
    setTimeout(() => {
        appendChatMessage(`Here is my live **technical chart analysis** of **${ticker}** based on your active profile:`, "ai-message");
        setTimeout(() => {
            appendChatMessage(analysisMarkup, "ai-message");
        }, 800);
    }, 400);
}


// --- AI Automated Purchase Rules Engine ---
function createNewAISmartRule() {
    const stockSelect = document.getElementById("planner-stock");
    const indicatorSelect = document.getElementById("planner-indicator");
    const valInput = document.getElementById("planner-value");
    const qtyInput = document.getElementById("planner-shares");
    
    if (!valInput || !qtyInput) return;
    
    const symbol = stockSelect.value;
    const indicator = indicatorSelect.value;
    const value = parseFloat(valInput.value) || 0;
    const shares = parseInt(qtyInput.value) || 0;
    
    if (shares <= 0) {
        showNotificationToast("Invalid Configuration", "Shares count must be 1 or higher.");
        return;
    }
    
    const newRule = {
        id: Date.now(),
        symbol: symbol,
        indicator: indicator,
        value: value,
        shares: shares,
        status: "MONITORING"
    };
    
    state.aiRules.push(newRule);
    renderActiveRulesList();
    showNotificationToast("AI Rule Created", `Toro AI is now actively monitoring ${symbol} triggers.`);
    
    saveStateToStorage();
}

function deleteAISmartRule(id) {
    state.aiRules = state.aiRules.filter(r => r.id !== id);
    renderActiveRulesList();
    showNotificationToast("Plan Suspended", "Automated smart plan successfully removed.");
    
    saveStateToStorage();
}

function checkAutomatedAIPlans() {
    state.aiRules.forEach(rule => {
        if (rule.status !== "MONITORING") return;
        
        const stock = state.stocks[rule.symbol];
        if (!stock) return;
        const rsiArray = calculateRSI(stock.data, 14);
        const currentRsi = rsiArray[rsiArray.length - 1];
        const price = stock.price;
        let isTriggered = false;
        let triggerReason = "";
        
        switch (rule.indicator) {
            case "RSI_BELOW":
                if (currentRsi <= rule.value) {
                    isTriggered = true;
                    triggerReason = `RSI touched ${currentRsi.toFixed(1)} (Threshold: <= ${rule.value})`;
                }
                break;
            case "RSI_ABOVE":
                if (currentRsi >= rule.value) {
                    isTriggered = true;
                    triggerReason = `RSI touched ${currentRsi.toFixed(1)} (Threshold: >= ${rule.value})`;
                }
                break;
            case "PRICE_BELOW":
                if (price <= rule.value) {
                    isTriggered = true;
                    triggerReason = `Price hit ${formatCurrency(price)} (Threshold: <= ${formatCurrency(rule.value)})`;
                }
                break;
            case "EMA_CROSS_UP":
                const emaVal = calculateEMA(stock.data, 20).slice(-1)[0];
                if (price >= emaVal) {
                    isTriggered = true;
                    triggerReason = `Price crossed EMA (${formatCurrency(price)} >= ${formatCurrency(emaVal)})`;
                }
                break;
        }
        
        if (isTriggered) {
            const totalCost = rule.shares * price;
            
            rule.status = "EXECUTED";
            
            const existingPos = state.user.holdings.find(h => h.symbol === rule.symbol);
            if (existingPos) {
                const totalShares = existingPos.shares + rule.shares;
                existingPos.avgPrice = parseFloat(((existingPos.shares * existingPos.avgPrice + totalCost) / totalShares).toFixed(2));
                existingPos.shares = totalShares;
            } else {
                state.user.holdings.push({
                    symbol: rule.symbol,
                    shares: rule.shares,
                    avgPrice: price,
                    currentPrice: price
                });
            }
            
            state.user.ordersHistory.unshift({
                timestamp: new Date().toLocaleString(),
                type: "BUY (AI)",
                symbol: rule.symbol,
                shares: rule.shares,
                price: price,
                total: totalCost,
                status: "COMPLETED"
            });
            
            state.aiExecutionLogs.unshift({
                timestamp: new Date().toLocaleString(),
                title: `${rule.symbol} Auto Tracking Executed`,
                desc: `Tracked purchase of ${rule.shares} shares of ${rule.symbol} at ${formatCurrency(price)} due to ${triggerReason}.`,
                status: "SUCCESS"
            });
            
            showNotificationToast("AI Auto-Execution", `Successfully tracked purchase of ${rule.shares} shares of ${rule.symbol} via automated plan!`);
            recalculatePortfolioVal();
            
            state.aiRules = state.aiRules.filter(r => r.id !== rule.id);
            renderActiveRulesList();
            renderExecutionLogsList();
            renderUserHistoryTable();
            
            saveStateToStorage();
        }
    });
}


// --- Visual rendering & Dynamic Content Updates ---
function renderDashboardWatchlist() {
    const list = document.getElementById("dashboard-watchlist");
    if (!list) return;
    
    list.innerHTML = "";
    if (!state.user.watchlist || state.user.watchlist.length === 0) {
        list.innerHTML = `<div style="text-align: center; color: var(--text-muted); font-size: 0.85rem; padding: 30px 0; background: rgba(255,255,255,0.01); border: 1px dashed var(--border-color); border-radius: 16px; width: 100%; box-sizing: border-box;">Your Wishlist is empty. Search for a stock ticker above and toggle the Star icon to track!</div>`;
        return;
    }
    
    state.user.watchlist.forEach(symbol => {
        const stock = state.stocks[symbol];
        if (!stock) return;
        const isUp = stock.change >= 0;
        
        const item = document.createElement("div");
        item.className = "watchlist-item";
        item.addEventListener("click", async () => {
            state.currentTab = "markets";
            updateActiveTabs();
            await selectActiveStock(symbol);
        });
        
        item.innerHTML = `
            <div class="stock-ident">
                <span class="stock-ticker">${symbol}</span>
                <span class="stock-fullname">${stock.name}</span>
            </div>
            <div class="stock-numbers">
                <span class="stock-price">${formatCurrency(stock.price)}</span>
                <span class="stock-pct-change ${isUp ? 'positive' : 'negative'}">
                    ${isUp ? '+' : ''}${stock.pctChange}%
                </span>
            </div>
        `;
        list.appendChild(item);
    });
}

function renderDashboardPortfolio() {
    const list = document.getElementById("dashboard-portfolio-list");
    if (!list) return;

    list.innerHTML = "";
    if (state.user.holdings.length === 0) {
        list.innerHTML = `<div style="grid-column: 1 / -1; text-align: center; color: var(--text-muted); font-size: 0.85rem; padding: 30px 0; background: rgba(255,255,255,0.01); border: 1px dashed var(--border-color); border-radius: 16px;">No tracked stock assets. Use the Search box above to track your first stock!</div>`;
        return;
    }

    function getStockLogoColorClass(ticker) {
        if (ticker === "RELIANCE") return "logo-purple";
        if (ticker === "TCS") return "logo-blue";
        if (ticker === "INFY") return "logo-green";
        if (ticker === "HDFCBANK") return "logo-navy";
        if (ticker === "ICICIBANK") return "logo-orange";
        if (ticker === "SBIN") return "logo-teal";
        if (ticker === "BHARTIALRT") return "logo-red";
        if (ticker === "ITC") return "logo-gold";
        if (ticker === "TATASTEEL") return "logo-darkgrey";
        if (ticker === "WIPRO") return "logo-azure";
        return "logo-blue";
    }

    function getStockExchangeBadge(ticker) {
        return `<span class="exch-badge nse">NSE</span>`;
    }

    state.user.holdings.forEach(hold => {
        const stock = state.stocks[hold.symbol];
        if (!stock) return;
        
        const currentVal = hold.shares * stock.price;
        const totalCost = hold.shares * hold.avgPrice;
        const gainLoss = currentVal - totalCost;
        const pctGain = totalCost > 0 ? (gainLoss / totalCost) * 100 : 0;
        
        const isUp = gainLoss >= 0;
        const trendClass = isUp ? "positive" : "negative";
        const trendSign = isUp ? "+" : "";

        const logoClass = getStockLogoColorClass(hold.symbol);
        const exchBadge = getStockExchangeBadge(hold.symbol);
        const initial = hold.symbol.charAt(0);

        const card = document.createElement("div");
        card.className = "holdings-card";
        
        card.addEventListener("click", async (e) => {
            // Avoid triggering tab switch if they click the untrack button!
            if (e.target.closest(".btn-untrack-holding")) return;
            
            state.currentTab = "markets";
            updateActiveTabs();
            await selectActiveStock(hold.symbol);
        });

        card.innerHTML = `
            <div class="holdings-card-top">
                <div class="holdings-card-meta">
                    <div class="stock-logo-circle ${logoClass}">${initial}</div>
                    <div class="holdings-card-ident">
                        <span class="holdings-card-ticker">${hold.symbol} ${exchBadge}</span>
                        <span class="holdings-card-name">${stock.name}</span>
                    </div>
                </div>
                <button class="btn-untrack-holding" title="Untrack Stock Asset" data-symbol="${hold.symbol}">&times;</button>
            </div>
            
            <div class="holdings-card-stats">
                <div class="holdings-card-stat-box">
                    <span class="holdings-card-stat-label">Shares Held</span>
                    <span class="holdings-card-stat-val">${hold.shares} (Avg: ${formatCurrency(hold.avgPrice)})</span>
                </div>
                <div class="holdings-card-stat-box" style="text-align: right;">
                    <span class="holdings-card-stat-label">Current Value</span>
                    <span class="holdings-card-total-val">${formatCurrency(currentVal)}</span>
                    <span class="holdings-card-gain-loss ${trendClass}">${trendSign}${formatCurrency(Math.abs(gainLoss))} (${trendSign}${pctGain.toFixed(2)}%)</span>
                </div>
            </div>
        `;
        
        // Bind Untrack (remove) button
        const untrackBtn = card.querySelector(".btn-untrack-holding");
        untrackBtn.addEventListener("click", (e) => {
            e.stopPropagation();
            const symbolToRemove = untrackBtn.getAttribute("data-symbol");
            if (confirm(`Are you sure you want to untrack ${symbolToRemove} from your assets?`)) {
                state.user.holdings = state.user.holdings.filter(h => h.symbol !== symbolToRemove);
                
                // Add untrack transaction log
                state.user.ordersHistory.unshift({
                    timestamp: new Date().toLocaleString(),
                    type: "UNTRACK",
                    symbol: symbolToRemove,
                    shares: hold.shares,
                    price: stock.price,
                    total: hold.shares * stock.price,
                    status: "COMPLETED"
                });
                
                recalculatePortfolioVal();
                renderDashboardPortfolio();
                renderUserHistoryTable();
                saveStateToStorage();
                
                showNotificationToast("Asset Untracked", `Removed ${symbolToRemove} from active tracking.`);
            }
        });
        
        list.appendChild(card);
    });
}

function renderMarketTickers() {
    const container = document.getElementById("markets-ticker-list");
    const query = (document.getElementById("market-search")?.value || "").toUpperCase().trim();
    if (!container) return;
    
    container.innerHTML = "";
    Object.keys(state.stocks).forEach(ticker => {
        const stock = state.stocks[ticker];
        if (query && !ticker.includes(query) && !stock.name.toUpperCase().includes(query)) return;
        
        const row = document.createElement("div");
        row.className = `ticker-row ${state.chart.selectedStock === ticker ? 'active' : ''}`;
        row.style.display = "flex";
        row.style.alignItems = "center";
        row.style.justifyContent = "space-between";
        row.style.width = "100%";
        row.style.boxSizing = "border-box";
        row.style.paddingRight = "8px";
        
        const contentWrapper = document.createElement("div");
        contentWrapper.style.display = "flex";
        contentWrapper.style.alignItems = "center";
        contentWrapper.style.justifyContent = "space-between";
        contentWrapper.style.flex = "1";
        contentWrapper.style.cursor = "pointer";
        
        const isUp = stock.change >= 0;
        contentWrapper.innerHTML = `
            <div class="stock-ident">
                <span class="stock-ticker">${ticker}</span>
                <span class="stock-fullname">${stock.name}</span>
            </div>
            <div class="stock-numbers">
                <span class="stock-price">${formatCurrency(stock.price)}</span>
                <span class="stock-pct-change ${isUp ? 'positive' : 'negative'}">
                    ${isUp ? '+' : ''}${stock.pctChange}%
                </span>
            </div>
        `;
        
        contentWrapper.addEventListener("click", async () => {
            const rows = container.querySelectorAll(".ticker-row");
            rows.forEach(r => r.classList.remove("active"));
            row.classList.add("active");
            await selectActiveStock(ticker);
        });
        
        const deleteBtn = document.createElement("button");
        deleteBtn.className = "btn-delete-ticker";
        deleteBtn.innerHTML = `
            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                <polyline points="3 6 5 6 21 6"></polyline>
                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
            </svg>
        `;
        deleteBtn.title = "Delete stock from market list";
        deleteBtn.style.background = "none";
        deleteBtn.style.border = "none";
        deleteBtn.style.color = "var(--text-muted)";
        deleteBtn.style.cursor = "pointer";
        deleteBtn.style.padding = "6px";
        deleteBtn.style.marginLeft = "8px";
        deleteBtn.style.display = "flex";
        deleteBtn.style.alignItems = "center";
        deleteBtn.style.justifyContent = "center";
        deleteBtn.style.borderRadius = "8px";
        deleteBtn.style.transition = "all 0.2s ease";
        deleteBtn.style.zIndex = "10";
        
        deleteBtn.addEventListener("mouseenter", () => {
            deleteBtn.style.color = "var(--red-down)";
            deleteBtn.style.backgroundColor = "rgba(239, 68, 68, 0.1)";
        });
        deleteBtn.addEventListener("mouseleave", () => {
            deleteBtn.style.color = "var(--text-muted)";
            deleteBtn.style.backgroundColor = "transparent";
        });
        
        deleteBtn.addEventListener("click", (e) => {
            e.stopPropagation();
            
            if (Object.keys(state.stocks).length <= 1) {
                showNotificationToast("Delete Failed", "You must keep at least one stock in the market list.");
                return;
            }
            
            if (confirm(`Are you sure you want to remove ${ticker} from the market list?`)) {
                if (state.chart.selectedStock === ticker) {
                    const otherTickers = Object.keys(state.stocks).filter(t => t !== ticker);
                    state.chart.selectedStock = otherTickers[0];
                }
                
                delete state.stocks[ticker];
                
                const wlIdx = state.user.watchlist.indexOf(ticker);
                if (wlIdx !== -1) {
                    state.user.watchlist.splice(wlIdx, 1);
                }
                
                renderMarketTickers();
                updateDetailedStockHeader();
                drawTechnicalCharts();
                updateOrderConsoleCalculator();
                renderDashboardWatchlist();
                
                saveStateToStorage();
                showNotificationToast("Stock Removed", `${ticker} has been removed from the market list.`);
            }
        });
        
        row.appendChild(contentWrapper);
        row.appendChild(deleteBtn);
        container.appendChild(row);
    });
}

function formatVolume(val) {
    if (!val) return "--";
    return val.toLocaleString('en-IN');
}

function showMarketsSkeletonLoader() {
    const marketsSec = document.getElementById("markets-section");
    if (marketsSec) {
        marketsSec.classList.add("markets-loading");
    }
}

function hideMarketsSkeletonLoader() {
    const marketsSec = document.getElementById("markets-section");
    if (marketsSec) {
        marketsSec.classList.remove("markets-loading");
    }
}

async function selectActiveStock(symbol, timeframe = null) {
    if (!symbol) return;
    state.chart.selectedStock = symbol;
    const targetTimeframe = timeframe || state.chart.timeframe || "1D";
    
    showMarketsSkeletonLoader();
    
    const startTime = Date.now();
    await reloadSingleStockHistory(symbol, targetTimeframe);
    const duration = Date.now() - startTime;
    if (duration < 450) {
        await new Promise(resolve => setTimeout(resolve, 450 - duration));
    }
    
    updateDetailedStockHeader();
    drawTechnicalCharts();
    updateOrderConsoleCalculator();
    updateAnalystConsoleUI();
    
    hideMarketsSkeletonLoader();
}

function updateDetailedStockHeader() {
    const stock = state.stocks[state.chart.selectedStock];
    if (!stock) return;
    const isUp = stock.change >= 0;

    // Initialize stable quote values if not present (simulated mode initialization)
    if (stock.open === undefined) {
        stock.open = stock.price * 0.99;
        stock.previousClose = stock.price * 0.995;
        stock.volume = 1500000;
        stock.dayLow = stock.price * 0.98;
        stock.dayHigh = stock.price * 1.02;
        stock.low52w = stock.price * 0.72;
        stock.high52w = stock.price * 1.28;
    }

    document.getElementById("chart-stock-symbol").textContent = state.chart.selectedStock;
    document.getElementById("chart-stock-name").textContent = stock.name;
    document.getElementById("chart-stock-price").textContent = formatCurrency(stock.price);

    const changePct = document.getElementById("chart-stock-change");
    changePct.className = `price-change-pct ${isUp ? 'positive' : 'negative'}`;
    const changeVal = formatCurrency(stock.change);
    changePct.textContent = `${isUp ? '+' : ''}${changeVal} (${isUp ? '+' : ''}${stock.pctChange.toFixed(2)}%)`;
    
    // Live OHLC and 52-Week Range Calculations
    const openPrice = stock.open;
    const prevClose = stock.previousClose;
    const volume = stock.volume;
    const todayLow = stock.dayLow;
    const todayHigh = stock.dayHigh;
    const low52w = stock.low52w;
    const high52w = stock.high52w;

    let todayProgressPct = 0;
    if (todayHigh > todayLow) {
        todayProgressPct = ((stock.price - todayLow) / (todayHigh - todayLow)) * 100;
        todayProgressPct = Math.max(0, Math.min(100, todayProgressPct));
    }

    let progress52wPct = 0;
    if (high52w > low52w) {
        progress52wPct = ((stock.price - low52w) / (high52w - low52w)) * 100;
        progress52wPct = Math.max(0, Math.min(100, progress52wPct));
    }

    const openEl = document.getElementById("chart-stock-open");
    const prevCloseEl = document.getElementById("chart-stock-prev-close");
    const volEl = document.getElementById("chart-stock-volume");

    const todayLowEl = document.getElementById("chart-stock-today-low");
    const todayHighEl = document.getElementById("chart-stock-today-high");
    const todayProgressEl = document.getElementById("chart-stock-today-progress");
    const todayIndicatorEl = document.getElementById("chart-stock-today-indicator");

    const low52wEl = document.getElementById("chart-stock-52w-low");
    const high52wEl = document.getElementById("chart-stock-52w-high");
    const progress52wEl = document.getElementById("chart-stock-52w-progress");
    const indicator52wEl = document.getElementById("chart-stock-52w-indicator");

    if (openEl) openEl.textContent = formatCurrency(openPrice);
    if (prevCloseEl) prevCloseEl.textContent = formatCurrency(prevClose);
    if (volEl) volEl.textContent = formatVolume(volume);

    if (todayLowEl) todayLowEl.textContent = formatCurrency(todayLow);
    if (todayHighEl) todayHighEl.textContent = formatCurrency(todayHigh);
    if (todayProgressEl) todayProgressEl.style.width = `${todayProgressPct}%`;
    if (todayIndicatorEl) todayIndicatorEl.style.left = `${todayProgressPct}%`;

    if (low52wEl) low52wEl.textContent = formatCurrency(low52w);
    if (high52wEl) high52wEl.textContent = formatCurrency(high52w);
    if (progress52wEl) progress52wEl.style.width = `${progress52wPct}%`;
    if (indicator52wEl) indicator52wEl.style.left = `${progress52wPct}%`;

    // Update Stock Fundamentals card values dynamically
    try {
        const fund = getStockFundamentals(state.chart.selectedStock, prevClose);
        const mcapEl = document.getElementById("fund-mcap");
        const peEl = document.getElementById("fund-pe");
        const pbEl = document.getElementById("fund-pb");
        const industryPeEl = document.getElementById("fund-industry-pe");
        const debtToEquityEl = document.getElementById("fund-debt-to-equity");
        const roeEl = document.getElementById("fund-roe");
        const bookValueEl = document.getElementById("fund-book-value");
        const divYieldEl = document.getElementById("fund-div-yield");
        const epsEl = document.getElementById("fund-eps");
        const faceValueEl = document.getElementById("fund-face-value");

        if (mcapEl) mcapEl.textContent = fund.mcap;
        if (peEl) peEl.textContent = fund.pe;
        if (pbEl) pbEl.textContent = fund.pb;
        if (industryPeEl) industryPeEl.textContent = fund.industryPe;
        if (debtToEquityEl) debtToEquityEl.textContent = fund.debtToEquity;
        if (roeEl) roeEl.textContent = fund.roe;
        if (bookValueEl) bookValueEl.textContent = fund.bookValue;
        if (divYieldEl) divYieldEl.textContent = fund.divYield;
        if (epsEl) epsEl.textContent = fund.eps;
        if (faceValueEl) faceValueEl.textContent = fund.faceValue;

        // Update Smart Trade Advisor details dynamically
        try {
            const activeStockKey = state.chart.selectedStock.toUpperCase();
            const rawFund = (stock.fundamentals) || (BASE_FUNDAMENTALS[activeStockKey]);
            if (rawFund) {
                const eps = rawFund.eps;
                const bookValue = rawFund.bookValue;
                const price = stock.price;

                // 1. Calculate Graham Value
                let grahamValue = null;
                if (eps > 0 && bookValue > 0) {
                    grahamValue = Math.sqrt(22.5 * eps * bookValue);
                }

                const grahamValEl = document.getElementById("advisor-graham-val");
                const grahamDiffEl = document.getElementById("advisor-graham-diff");

                if (grahamValEl) {
                    if (grahamValue) {
                        grahamValEl.textContent = formatCurrency(grahamValue);
                        const diffPct = ((grahamValue - price) / price) * 100;
                        if (price < grahamValue) {
                            grahamDiffEl.textContent = `${diffPct.toFixed(1)}% Under (Discount)`;
                            grahamDiffEl.className = "advisor-metric-sub text-green";
                        } else {
                            grahamDiffEl.textContent = `${Math.abs(diffPct).toFixed(1)}% Over (Premium)`;
                            grahamDiffEl.className = "advisor-metric-sub negative";
                        }
                    } else {
                        grahamValEl.textContent = "N/A";
                        grahamDiffEl.textContent = "Negative EPS/BV";
                        grahamDiffEl.className = "advisor-metric-sub";
                    }
                }

                // 2. Dynamic S1/R1 Pivots based on current daily High/Low/Close
                const high = todayHigh || (price * 1.015);
                const low = todayLow || (price * 0.985);
                const close = price;

                const pivot = (high + low + close) / 3;
                const s1 = (2 * pivot) - high;
                const r1 = (2 * pivot) - low;

                const entryEl = document.getElementById("advisor-entry-price");
                const targetEl = document.getElementById("advisor-target-price");

                if (entryEl) entryEl.textContent = formatCurrency(s1);
                if (targetEl) targetEl.textContent = formatCurrency(r1);

                // 3. Score Speedometer Gauge
                let score = 50; // base score
                
                const pe = rawFund.pe || (price / eps);
                const indPE = rawFund.industryPe || 20;
                if (pe > 0 && indPE > 0) {
                    if (pe < indPE) score += 15;
                    else score -= 15;
                }

                if (grahamValue) {
                    if (price < grahamValue) score += 15;
                    else score -= 15;
                }

                const roe = rawFund.roe;
                if (roe > 15) score += 10;
                if (roe > 25) score += 5;
                if (roe < 10) score -= 10;

                const debt = rawFund.debtToEquity;
                if (debt === 0) score += 10;
                else if (debt > 1.0) score -= 15;
                else if (debt > 0.5) score -= 5;

                score = Math.max(10, Math.min(90, score));

                const deg = ((score - 0) / 100) * 180 - 90;
                const needle = document.getElementById("advisor-gauge-needle");
                if (needle) needle.style.transform = `rotate(${deg}deg)`;

                const scoreEl = document.getElementById("gauge-score");
                if (scoreEl) scoreEl.textContent = `${Math.round(score)}%`;

                const verdictEl = document.getElementById("advisor-verdict");
                const descEl = document.getElementById("advisor-verdict-desc");

                if (verdictEl && descEl) {
                    if (score >= 65) {
                        verdictEl.textContent = "Strong Buy";
                        verdictEl.className = "badge advisor-badge buy";
                        descEl.textContent = `Excellent valuation profiles. Stock is trading at a discount of its intrinsic Graham Value, backed by stable debt ratios and strong return metrics. Perfect entry range is around ${formatCurrency(s1)}.`;
                    } else if (score <= 40) {
                        verdictEl.textContent = "Sell / Avoid";
                        verdictEl.className = "badge advisor-badge sell";
                        descEl.textContent = `Trading at high valuation premiums. Current price exceeds historical or intrinsic levels relative to peer indices. Hold off on buying or consider target profit exits near ${formatCurrency(r1)}.`;
                    } else {
                        verdictEl.textContent = "Accumulate";
                        verdictEl.className = "badge advisor-badge hold";
                        descEl.textContent = `Fairly priced relative to active fundamentals. Accumulate slowly on minor dips in the ${formatCurrency(s1)} zone. Take partial profits if price breaks above ${formatCurrency(r1)}.`;
                    }
                }
            }
        } catch (advisorErr) {
            console.error("Error updating Smart Trade Advisor UI: ", advisorErr);
        }
    } catch (e) {
        console.error("Error updating stock fundamentals UI: ", e);
    }
    
    // Update chart stock holdings tracking banner
    const holdingsBanner = document.getElementById("chart-stock-holdings-banner");
    if (holdingsBanner) {
        const holding = state.user.holdings.find(h => h.symbol === state.chart.selectedStock);
        if (holding && holding.shares > 0) {
            holdingsBanner.classList.remove("hidden");
            
            const sharesVal = holding.shares;
            const avgPriceVal = holding.avgPrice;
            const investedVal = sharesVal * avgPriceVal;
            const currentVal = sharesVal * stock.price;
            const returnsVal = currentVal - investedVal;
            const returnsPctVal = investedVal > 0 ? (returnsVal / investedVal) * 100 : 0;
            const isReturnsPositive = returnsVal >= 0;
            
            document.getElementById("holdings-banner-shares").textContent = `${sharesVal} share${sharesVal > 1 ? 's' : ''}`;
            document.getElementById("holdings-banner-avg").textContent = formatCurrency(avgPriceVal);
            document.getElementById("holdings-banner-invested").textContent = formatCurrency(investedVal);
            document.getElementById("holdings-banner-value").textContent = formatCurrency(currentVal);
            
            const returnsEl = document.getElementById("holdings-banner-returns");
            returnsEl.className = isReturnsPositive ? "positive" : "negative";
            returnsEl.style.color = isReturnsPositive ? "var(--green-up)" : "var(--red-down)";
            returnsEl.textContent = `${isReturnsPositive ? '+' : ''}${formatCurrency(returnsVal)} (${isReturnsPositive ? '+' : ''}${returnsPctVal.toFixed(2)}%)`;
        } else {
            holdingsBanner.classList.add("hidden");
        }
    }
    
    // Dynamically sync analyst console UI text
    updateAnalystConsoleUI();
}

function updateAnalystConsoleUI() {
    const symbol = state.chart.selectedStock;
    const toggleBtnText = document.getElementById("btn-analyst-watchlist-text");
    if (toggleBtnText) {
        if (state.user.watchlist.includes(symbol)) {
            toggleBtnText.textContent = "Untrack Watchlist";
        } else {
            toggleBtnText.textContent = "Track Watchlist";
        }
    }
    
    const chartToggleStar = document.getElementById("chart-toggle-watchlist");
    if (chartToggleStar) {
        if (state.user.watchlist.includes(symbol)) {
            chartToggleStar.classList.add("active");
            chartToggleStar.setAttribute("title", "Remove from Wishlist");
        } else {
            chartToggleStar.classList.remove("active");
            chartToggleStar.setAttribute("title", "Add to Wishlist");
        }
    }
}

function trackAssetManually(ticker, price, qty) {
    const basePrice = price;

    if (!state.stocks[ticker]) {
        state.stocks[ticker] = {
            name: `${ticker} Inc.`,
            price: basePrice,
            change: 0,
            pctChange: 0,
            data: generateHistoricalData(ticker, 250)
        };
        state.stocks[ticker].price = state.stocks[ticker].data[state.stocks[ticker].data.length - 1].close;
    }
    
    const liveStock = state.stocks[ticker];
    const existingHolding = state.user.holdings.find(h => h.symbol === ticker);
    const totalCost = qty * basePrice;
    
    if (existingHolding) {
        const totalShares = existingHolding.shares + qty;
        existingHolding.avgPrice = parseFloat(((existingHolding.shares * existingHolding.avgPrice + totalCost) / totalShares).toFixed(6));
        existingHolding.shares = totalShares;
    } else {
        state.user.holdings.push({
            symbol: ticker,
            shares: qty,
            avgPrice: basePrice,
            currentPrice: liveStock.price
        });
    }
    
    if (!state.user.watchlist.includes(ticker)) {
        state.user.watchlist.push(ticker);
    }
    
    state.user.ordersHistory.unshift({
        timestamp: new Date().toLocaleString(),
        type: "BUY",
        symbol: ticker,
        shares: qty,
        price: basePrice,
        total: totalCost,
        status: "COMPLETED"
    });
    
    recalculatePortfolioVal();
    renderDashboardWatchlist();
    renderDashboardPortfolio();
    renderUserHistoryTable();
    
    saveStateToStorage();
    
    showNotificationToast("Asset Tracked", `Successfully tracked purchase of ${qty} shares of ${ticker} at ${formatCurrency(price)}!`);
}

function renderActiveRulesList() {
    const list = document.getElementById("active-ai-plans-list");
    if (!list) return;
    
    list.innerHTML = "";
    if (state.aiRules.length === 0) {
        list.innerHTML = `<div style="grid-column: span 2; text-align: center; color: var(--text-muted); font-size: 0.82rem; padding: 15px 0;">No active rules. Build one above.</div>`;
        return;
    }
    
    state.aiRules.forEach(rule => {
        const item = document.createElement("div");
        item.className = "plan-rule-card";
        
        let triggerDesc = "";
        switch (rule.indicator) {
            case "RSI_BELOW": triggerDesc = `RSI < ${rule.value}`; break;
            case "RSI_ABOVE": triggerDesc = `RSI > ${rule.value}`; break;
            case "PRICE_BELOW": triggerDesc = `Price < ${formatCurrency(rule.value)}`; break;
            case "EMA_CROSS_UP": triggerDesc = `EMA Cross-Over`; break;
        }
        
        item.innerHTML = `
            <div class="rule-meta">
                <span class="rule-badge">${rule.symbol} auto-buy</span>
                <span class="rule-desc">${triggerDesc} • Purchase ${rule.shares} shares</span>
                <span class="rule-subtext">Toro AI actively scanning...</span>
            </div>
            <button class="delete-rule-btn" onclick="deleteAISmartRule(${rule.id})">&times;</button>
        `;
        list.appendChild(item);
    });
    
    document.getElementById("dash-active-plans-count").textContent = `${state.aiRules.length} Active Rules`;
}

function renderExecutionLogsList() {
    const container = document.getElementById("ai-execution-log-list");
    if (!container) return;
    
    container.innerHTML = "";
    if (state.aiExecutionLogs.length === 0) {
        container.innerHTML = `<div style="text-align: center; color: var(--text-muted); font-size: 0.8rem; padding: 10px 0;">No past actions.</div>`;
        return;
    }
    
    state.aiExecutionLogs.forEach(log => {
        const item = document.createElement("div");
        item.className = `log-item ${log.status === 'FAIL' ? 'fail' : ''}`;
        item.innerHTML = `
            <div class="log-details">
                <span class="log-title">${log.title}</span>
                <span class="log-time">${log.timestamp} • ${log.desc}</span>
            </div>
            <span class="log-status-badge">${log.status}</span>
        `;
        container.appendChild(item);
    });
}

function renderUserHistoryTable() {
    const tbody = document.getElementById("profile-history-table-body");
    if (!tbody) return;
    
    tbody.innerHTML = "";
    if (state.user.ordersHistory.length === 0) {
        tbody.innerHTML = `<tr><td colspan="7" style="text-align: center; color: var(--text-muted); padding: 20px;">No trades executed yet.</td></tr>`;
        return;
    }
    
    state.user.ordersHistory.forEach(order => {
        const row = document.createElement("tr");
        const isBuy = order.type.startsWith("BUY") || order.type.includes("IMPORT") || order.type.includes("DEPOSIT");
        
        row.innerHTML = `
            <td>${order.timestamp}</td>
            <td class="${isBuy ? 'positive' : 'negative'}" style="font-weight: 700;">${order.type}</td>
            <td style="font-weight: 600;">${order.symbol}</td>
            <td>${order.shares}</td>
            <td>${formatCurrency(order.price)}</td>
            <td>${formatCurrency(order.total)}</td>
            <td class="positive">COMPLETED</td>
        `;
        tbody.appendChild(row);
    });
}

function updateActiveTabs() {
    const contents = document.querySelectorAll(".tab-content");
    contents.forEach(c => c.classList.remove("active"));
    
    const activeSection = document.getElementById(`${state.currentTab}-section`);
    if (activeSection) activeSection.classList.add("active");
    
    const sidebarItems = document.querySelectorAll(".sidebar-menu .nav-item");
    sidebarItems.forEach(item => {
        if (item.getAttribute("data-tab") === state.currentTab) {
            item.classList.add("active");
        } else {
            item.classList.remove("active");
        }
    });
    
    const bottomNavItems = document.querySelectorAll(".bottom-nav .bottom-nav-item");
    bottomNavItems.forEach(item => {
        if (item.getAttribute("data-tab") === state.currentTab) {
            item.classList.add("active");
        } else {
            item.classList.remove("active");
        }
    });
    
    const heading = document.getElementById("expanded-title-text");
    const collapsedHeading = document.getElementById("collapsed-title-text");
    const subtitle = document.getElementById("expanded-subtitle-text");
    
    const userName = (state.user && state.user.name) ? state.user.name.split(" ")[0] : "Guest";
    let headingText = "Dashboard";
    let subtitleText = `Hello, ${userName}. Ready to analyze your assets today?`;
    
    switch (state.currentTab) {
        case "dashboard":
            headingText = "Dashboard";
            subtitleText = `Hello, ${userName}. Ready to analyze your assets today?`;
            break;
        case "markets":
            headingText = "Invest Markets";
            subtitleText = "Interactive real-time charting overlays & technical analysis charts.";
            break;
        case "ai-planner":
            headingText = "Toro AI Advisor";
            subtitleText = "Automated trigger execution & interactive strategic rebalancing.";
            break;
        case "profile":
            headingText = "User Profile Hub";
            subtitleText = "Configure preferences, biometric authorizations, risk limits, and database backups.";
            break;
        case "help":
            headingText = "Help & User Guide";
            subtitleText = "Learn how to use ToroFolio, set AI automated trading rules, track stock portfolios, and manage your account.";
            break;
    }
    
    if (heading) heading.textContent = headingText;
    if (collapsedHeading) collapsedHeading.textContent = headingText;
    if (subtitle) subtitle.textContent = subtitleText;
    
    // Show collapsible-header (app-header) ONLY on the dashboard tab
    const headerEl = document.getElementById("app-header");
    if (headerEl) {
        if (state.currentTab === "dashboard") {
            headerEl.style.display = "flex";
        } else {
            headerEl.style.display = "none";
        }
    }
    
    const viewport = document.getElementById("content-viewport");
    if (viewport) viewport.scrollTop = 0;
    
    if (state.currentTab === "markets") {
        setTimeout(drawTechnicalCharts, 100);
    }
}

function showNotificationToast(title, body) {
    const toast = document.getElementById("notification-toast");
    if (!toast) return;
    
    document.getElementById("toast-title").textContent = title;
    document.getElementById("toast-body").textContent = body;
    toast.classList.add("active");
    
    setTimeout(() => {
        toast.classList.remove("active");
    }, 4000);
}


// --- Event Listeners Orchester ---
function setupEventListeners() {
    // Setup Google Firebase dynamic config setup
    setupFirebaseConfigActions();

    // FAQ Accordion Toggle Handlers
    const faqQuestions = document.querySelectorAll(".faq-question");
    faqQuestions.forEach(btn => {
        btn.addEventListener("click", () => {
            const parentItem = btn.closest(".faq-item");
            if (parentItem) {
                const isOpen = parentItem.classList.contains("open");
                document.querySelectorAll(".faq-item").forEach(item => item.classList.remove("open"));
                if (!isOpen) {
                    parentItem.classList.add("open");
                }
            }
        });
    });

    // Live Help Search Filter Handler
    const helpSearchInput = document.getElementById("help-search-input");
    if (helpSearchInput) {
        helpSearchInput.addEventListener("input", (e) => {
            const query = e.target.value.toLowerCase().trim();
            const cards = document.querySelectorAll(".help-guide-card");
            const faqs = document.querySelectorAll(".faq-item");

            cards.forEach(card => {
                const text = card.textContent.toLowerCase();
                const keywords = card.getAttribute("data-keywords") || "";
                if (!query || text.includes(query) || keywords.includes(query)) {
                    card.style.display = "flex";
                } else {
                    card.style.display = "none";
                }
            });

            faqs.forEach(faq => {
                const text = faq.textContent.toLowerCase();
                const keywords = faq.getAttribute("data-keywords") || "";
                if (!query || text.includes(query) || keywords.includes(query)) {
                    faq.style.display = "block";
                } else {
                    faq.style.display = "none";
                }
            });
        });
    }

    const attachNavEvents = (selectors) => {
        const items = document.querySelectorAll(selectors);
        items.forEach(item => {
            item.addEventListener("click", (e) => {
                e.preventDefault();
                const tab = item.getAttribute("data-tab");
                if (tab) {
                    state.currentTab = tab;
                    updateActiveTabs();
                }
            });
        });
    };
    attachNavEvents(".sidebar-menu .nav-item");
    attachNavEvents(".bottom-nav .bottom-nav-item");
    
    const dashAiCta = document.getElementById("dash-ai-action-btn");
    if (dashAiCta) {
        dashAiCta.addEventListener("click", () => {
            state.chart.selectedStock = "RELIANCE";
            state.currentTab = "markets";
            updateActiveTabs();
        });
    }
    
    const viewAllMarketsBtn = document.getElementById("view-all-watchlist");
    if (viewAllMarketsBtn) {
        viewAllMarketsBtn.addEventListener("click", () => {
            state.currentTab = "markets";
            updateActiveTabs();
        });
    }

    // Premium Ticker suggestions & Search Hero manual track buttons
    const importTickerInput = document.getElementById("import-ticker");
    const importSuggestionsDropdown = document.getElementById("ticker-suggestions");
    if (importTickerInput && importSuggestionsDropdown) {
        bindStockAutocomplete(importTickerInput, importSuggestionsDropdown, false);
    }

    const marketSearchInput = document.getElementById("market-search");
    const marketSuggestionsDropdown = document.getElementById("market-suggestions");
    if (marketSearchInput && marketSuggestionsDropdown) {
        bindStockAutocomplete(marketSearchInput, marketSuggestionsDropdown, true);
    }

    // Trending Searches Chip Click Handlers
    const trendingChips = document.querySelectorAll(".popular-tag-chip");
    trendingChips.forEach(chip => {
        chip.addEventListener("click", () => {
            const ticker = chip.getAttribute("data-ticker");
            const tickerInput = document.getElementById("import-ticker");
            if (tickerInput && ticker) {
                tickerInput.value = ticker;
                
                // Fetch stock info and auto-expand track form
                const stock = state.stocks[ticker];
                if (stock) {
                    const trackInputs = document.getElementById("hero-track-inputs");
                    if (trackInputs) {
                        trackInputs.classList.remove("hidden");
                        const priceInput = document.getElementById("import-price");
                        if (priceInput) priceInput.value = stock.price.toFixed(2);
                        const qtyInput = document.getElementById("import-qty");
                        if (qtyInput) {
                            qtyInput.value = "";
                            qtyInput.focus();
                        }
                    }
                }
            }
        });
    });

    const btnHeroAddImported = document.getElementById("btn-hero-add-imported");
    if (btnHeroAddImported) {
        btnHeroAddImported.addEventListener("click", () => {
            const tickerInput = document.getElementById("import-ticker");
            const priceInput = document.getElementById("import-price");
            const qtyInput = document.getElementById("import-qty");
            
            if (!tickerInput || !priceInput || !qtyInput) return;
            
            const ticker = tickerInput.value.toUpperCase().trim();
            const price = parseFloat(priceInput.value) || 0;
            const qty = parseInt(qtyInput.value) || 0;
            
            if (!ticker || price <= 0 || qty <= 0) {
                showNotificationToast("Import Failed", "Please enter valid ticker, price, and quantity.");
                return;
            }
            
            // Wipe inputs & hide panel
            tickerInput.value = "";
            priceInput.value = "";
            qtyInput.value = "";
            const trackInputs = document.getElementById("hero-track-inputs");
            if (trackInputs) trackInputs.classList.add("hidden");
            
            trackAssetManually(ticker, price, qty);
        });
    }

    const btnHeroCancelTrack = document.getElementById("btn-hero-cancel-track");
    if (btnHeroCancelTrack) {
        btnHeroCancelTrack.addEventListener("click", () => {
            const trackInputs = document.getElementById("hero-track-inputs");
            if (trackInputs) trackInputs.classList.add("hidden");
            const tickerInput = document.getElementById("import-ticker");
            if (tickerInput) tickerInput.value = "";
        });
    }

    // Toro AI Ticker Analyst & Watchlist Manager Buttons
    function handleToggleWatchlist() {
        const symbol = state.chart.selectedStock;
        if (!symbol) return;
        
        const idx = state.user.watchlist.indexOf(symbol);
        if (idx !== -1) {
            state.user.watchlist.splice(idx, 1);
            showNotificationToast("Watchlist Updated", `Removed ${symbol} from watchlist.`);
        } else {
            state.user.watchlist.push(symbol);
            showNotificationToast("Watchlist Updated", `Added ${symbol} to watchlist.`);
        }
        
        updateAnalystConsoleUI();
        renderDashboardWatchlist();
        saveStateToStorage();
        saveStateToServer();
    }

    const btnAnalystToggleWatchlist = document.getElementById("btn-analyst-toggle-watchlist");
    if (btnAnalystToggleWatchlist) {
        btnAnalystToggleWatchlist.addEventListener("click", handleToggleWatchlist);
    }

    const chartToggleWatchlist = document.getElementById("chart-toggle-watchlist");
    if (chartToggleWatchlist) {
        chartToggleWatchlist.addEventListener("click", handleToggleWatchlist);
    }

    const btnAnalystSmartTrigger = document.getElementById("btn-analyst-smart-trigger");
    if (btnAnalystSmartTrigger) {
        btnAnalystSmartTrigger.addEventListener("click", () => {
            const symbol = state.chart.selectedStock;
            if (!symbol) return;
            
            // Switch active tabs to ai-planner
            state.currentTab = "ai-planner";
            updateActiveTabs();
            
            // Auto fill stock rule editor selector
            const plannerStockSelect = document.getElementById("planner-stock");
            if (plannerStockSelect) {
                plannerStockSelect.value = symbol;
            }
            showNotificationToast("AI Planner Mode", `Setup automated RSI rules for ${symbol} below!`);
        });
    }

    const btnAnalystExecuteTrack = document.getElementById("btn-analyst-execute-track");
    if (btnAnalystExecuteTrack) {
        btnAnalystExecuteTrack.addEventListener("click", () => {
            const symbol = state.chart.selectedStock;
            const priceInput = document.getElementById("analyst-price");
            const qtyInput = document.getElementById("analyst-qty");
            
            if (!symbol || !priceInput || !qtyInput) return;
            
            const price = parseFloat(priceInput.value) || 0;
            const qty = parseInt(qtyInput.value) || 0;
            
            if (price <= 0 || qty <= 0) {
                showNotificationToast("Track Failed", "Please enter valid buy price and shares quantity.");
                return;
            }
            
            // Wipe inputs
            priceInput.value = "";
            qtyInput.value = "";
            
            trackAssetManually(symbol, price, qty);
        });
    }

    // Save API token triggers
    const saveApiBtn = document.getElementById("btn-save-api-settings");
    if (saveApiBtn) {
        saveApiBtn.addEventListener("click", handleSaveAPISettings);
    }

    // Clear Persistent Database
    const resetDbBtn = document.getElementById("btn-reset-db");
    if (resetDbBtn) {
        resetDbBtn.addEventListener("click", resetEntireDatabase);
    }

    // --- Portfolio Database Backup & Restore Event Listeners ---
    const exportDbBtn = document.getElementById("btn-export-db");
    if (exportDbBtn) {
        exportDbBtn.addEventListener("click", exportPortfolioDatabase);
    }

    const btnImportDb = document.getElementById("btn-import-db");
    const importDbFile = document.getElementById("file-import-db");
    if (btnImportDb && importDbFile) {
        btnImportDb.addEventListener("click", () => {
            importDbFile.click();
        });
        importDbFile.addEventListener("change", importPortfolioDatabase);
    }

    // --- Dynamic Resize Observer for Chart Area ---
    const chartDrawArea = document.getElementById("chart-draw-area");
    if (chartDrawArea) {
        const ro = new ResizeObserver(() => {
            if (state.currentTab === "markets") {
                drawTechnicalCharts();
            }
        });
        ro.observe(chartDrawArea);
    }

    // --- Mode Toggles inside Authentication Card (Mobile OTP vs Google Login) ---
    const newTabOtp = document.getElementById("tab-otp-login");
    const newTabGoogle = document.getElementById("tab-google-login");
    const newOtpPanel = document.getElementById("new-otp-panel");
    const newGooglePanel = document.getElementById("new-google-panel");
    const submitBtn = document.getElementById("btn-login-submit");
    let activeAuthMode = "otp"; // "otp" or "google"
    
    if (newTabOtp && newTabGoogle && newOtpPanel && newGooglePanel) {
        newTabOtp.addEventListener("click", () => {
            newTabOtp.classList.add("active");
            newTabGoogle.classList.remove("active");
            newOtpPanel.classList.remove("hidden");
            newOtpPanel.classList.add("active");
            newGooglePanel.classList.add("hidden");
            newGooglePanel.classList.remove("active");
            activeAuthMode = "otp";
        });
        
        newTabGoogle.addEventListener("click", () => {
            newTabGoogle.classList.add("active");
            newTabOtp.classList.remove("active");
            newGooglePanel.classList.remove("hidden");
            newGooglePanel.classList.add("active");
            newOtpPanel.classList.add("hidden");
            newOtpPanel.classList.remove("active");
            activeAuthMode = "google";
        });
    }

    // --- SMS OTP Verification Countdown & Trigger Mock ---
    const btnSendOtp = document.getElementById("btn-send-otp");
    const otpDigitsArea = document.getElementById("otp-digits-area");
    const otpTimerLabel = document.getElementById("otp-timer");
    const btnResendOtp = document.getElementById("btn-resend-otp");
    let otpCountdownTimer = null;
    
    function startResendCountdown() {
        let seconds = 30;
        btnResendOtp.classList.add("disabled");
        btnResendOtp.disabled = true;
        
        if (otpCountdownTimer) clearInterval(otpCountdownTimer);
        otpCountdownTimer = setInterval(() => {
            seconds--;
            otpTimerLabel.textContent = `Resend OTP in ${seconds}s`;
            if (seconds <= 0) {
                clearInterval(otpCountdownTimer);
                otpTimerLabel.textContent = "Didn't receive SMS?";
                btnResendOtp.classList.remove("disabled");
                btnResendOtp.disabled = false;
            }
        }, 1000);
    }
    
    if (btnSendOtp && otpDigitsArea) {
        btnSendOtp.addEventListener("click", () => {
            const phone = document.getElementById("login-phone").value.trim();
            if (!phone || phone.length < 8) {
                showNotificationToast("Invalid Phone", "Please enter a valid mobile number.");
                return;
            }
            
            btnSendOtp.textContent = "Sending OTP...";
            btnSendOtp.disabled = true;
            
            if (isFirebaseConnected && authFirebase) {
                // Real Firebase SMS verification requires international formatting (+ country code)
                if (!phone.startsWith("+")) {
                    btnSendOtp.textContent = "Send OTP";
                    btnSendOtp.disabled = false;
                    showNotificationToast("Format Required", "Please enter number with country code, e.g. +91XXXXXXXXXX");
                    return;
                }
                
                showNotificationToast("Dispatched", "Contacting SMS Gateway. Please solve reCAPTCHA if prompted...");
                
                try {
                    if (!window.recaptchaVerifier) {
                        window.recaptchaVerifier = new firebase.auth.RecaptchaVerifier('recaptcha-container', {
                            'size': 'invisible'
                        });
                    }
                    
                    authFirebase.signInWithPhoneNumber(phone, window.recaptchaVerifier)
                        .then((result) => {
                            window.confirmationResult = result;
                            btnSendOtp.classList.add("hidden");
                            otpDigitsArea.classList.remove("hidden");
                            submitBtn.textContent = "Verify & Sign In";
                            showNotificationToast("SMS Dispatched", "A real 6-digit login code has been sent to your device.");
                            document.getElementById("otp-d1").focus();
                            startResendCountdown();
                        })
                        .catch((error) => {
                            console.error("SMS dispatch failure:", error);
                            btnSendOtp.textContent = "Send OTP";
                            btnSendOtp.disabled = false;
                            showNotificationToast("Delivery Failed", error.message || "Failed to send text code.");
                        });
                } catch (recaptchaErr) {
                    console.error("Recaptcha error:", recaptchaErr);
                    btnSendOtp.textContent = "Send OTP";
                    btnSendOtp.disabled = false;
                    showNotificationToast("Setup Failed", "Verification widget initialization failed.");
                }
            } else if (isLocalBackendActive) {
                showNotificationToast("Sending OTP", "Generating instant verification code...");
                fetch('/api/auth/otp/send', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ phone: phone })
                })
                .then(res => res.json())
                .then(body => {
                    if (body.status === "success") {
                        btnSendOtp.classList.add("hidden");
                        otpDigitsArea.classList.remove("hidden");
                        submitBtn.textContent = "Verify & Sign In";
                        
                        // Instant Auto-Fill for super fast user experience
                        if (body.code) {
                            const codeStr = String(body.code);
                            for (let i = 0; i < codeStr.length && i < 4; i++) {
                                const inputEl = document.getElementById(`otp-d${i+1}`);
                                if (inputEl) inputEl.value = codeStr[i];
                            }
                            showNotificationToast("OTP Auto-Filled", `Verification code ${body.code} generated & auto-filled!`);
                        } else {
                            showNotificationToast("SMS Dispatched", "A verification code has been dispatched.");
                        }
                        
                        document.getElementById("otp-d4").focus();
                        startResendCountdown();
                    } else {
                        btnSendOtp.textContent = "Send OTP";
                        btnSendOtp.disabled = false;
                        showNotificationToast("Failed", body.message || "Failed to dispatch OTP.");
                    }
                })
                .catch(err => {
                    console.error(err);
                    btnSendOtp.textContent = "Send OTP";
                    btnSendOtp.disabled = false;
                    showNotificationToast("Server Error", "Unable to contact SQLite server.");
                });
            } else {
                // Instant simulated SMS OTP dispatch fallback
                const simulatedCode = "1234";
                btnSendOtp.classList.add("hidden");
                otpDigitsArea.classList.remove("hidden");
                submitBtn.textContent = "Verify & Sign In";
                
                for (let i = 0; i < 4; i++) {
                    const inputEl = document.getElementById(`otp-d${i+1}`);
                    if (inputEl) inputEl.value = simulatedCode[i];
                }
                showNotificationToast("OTP Auto-Filled", `Verification code ${simulatedCode} generated & auto-filled!`);
                document.getElementById("otp-d4").focus();
                startResendCountdown();
            }
        });
    }
    
    if (btnResendOtp) {
        btnResendOtp.addEventListener("click", () => {
            showNotificationToast("OTP Resent", "SMS verification code resubmitted successfully.");
            document.getElementById("otp-d1").focus();
            startResendCountdown();
        });
    }

    // Dynamic OTP focusjump binding
    bindOtpInputFocusJump();

    // --- Google Modal Triggers & Simulated logins ---
    const googleModal = document.getElementById("google-modal");
    const openGoogleBtn = document.getElementById("google-signin-btn");
    const closeGoogleBtn = document.getElementById("close-google-btn");
    
    if (openGoogleBtn && googleModal) {
        openGoogleBtn.addEventListener("click", () => {
            if (isFirebaseConnected && authFirebase) {
                // Actual authentic Google SSO OAuth popup flow
                showNotificationToast("Initializing SSO", "Opening Google Authentication browser window...");
                const provider = new firebase.auth.GoogleAuthProvider();
                
                authFirebase.signInWithPopup(provider)
                    .then((result) => {
                        const user = result.user;
                        const email = user.email;
                        const name = user.displayName || "Google User";
                        const avatar = user.photoURL || `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=0381FE&color=fff&size=150`;
                        
                        showNotificationToast("SSO Verified", "Successfully authenticated Google account.");
                        
                        dbFirestore.collection("users").doc(email).get().then((doc) => {
                            if (doc.exists) {
                                state.currentUserKey = email;
                                state.user = doc.data();
                                state.aiRules = state.user.aiRules || [];
                                state.aiExecutionLogs = state.user.aiExecutionLogs || [];
                                
                                localStorage.setItem(STORAGE_KEYS.SESSION, "true");
                                saveStateToStorage();
                                animateSuccessfulAuth();
                            } else {
                                // Seed pristine profile for new Google SSO user in Cloud Firestore
                                state.db.registeredUsers[email] = {
                                    name: name,
                                    email: email,
                                    password: "", 
                                    avatar: avatar,
                                    walletBalance: 0.00,
                                    investedValue: 0.00,
                                    riskProfile: "balanced",
                                    biometricsEnabled: true,
                                    holdings: [],
                                    watchlist: [],
                                    ordersHistory: [],
                                    aiRules: [],
                                    aiExecutionLogs: []
                                };
                                state.currentUserKey = email;
                                state.user = state.db.registeredUsers[email];
                                
                                dbFirestore.collection("users").doc(email).set(state.user).then(() => {
                                    localStorage.setItem(STORAGE_KEYS.SESSION, "true");
                                    saveStateToStorage();
                                    animateSuccessfulAuth();
                                });
                            }
                        });
                    })
                    .catch((error) => {
                        console.error("Google SSO popup failed:", error);
                        showNotificationToast("SSO Canceled", error.message || "Google popup canceled or blocked.");
                    });
            } else {
                // Local Simulated Chooser overlay fallback
                googleModal.classList.remove("hidden");
            }
        });
    }
    if (closeGoogleBtn && googleModal) {
        closeGoogleBtn.addEventListener("click", () => {
            googleModal.classList.add("hidden");
        });
    }
    
    const googleAccItems = document.querySelectorAll(".google-acc-item:not(#google-use-another-account)");
    googleAccItems.forEach(item => {
        item.addEventListener("click", () => {
            const email = item.getAttribute("data-email");
            const name = item.getAttribute("data-name");
            const avatar = item.getAttribute("data-avatar");
            
            // Visual feedback - show loading spinner in popup
            item.style.backgroundColor = "rgba(3, 129, 254, 0.1)";
            item.querySelector("strong").textContent = "Logging in...";
            
            setTimeout(() => {
                if (isLocalBackendActive) {
                    fetch('/api/auth/google', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ email: email, name: name, avatar: avatar })
                    })
                    .then(res => res.json())
                    .then(body => {
                        if (body.status === "success") {
                            const s = body.state;
                            state.user = s.profile;
                            state.user.holdings = s.holdings || [];
                            state.user.watchlist = s.watchlist || [];
                            state.user.ordersHistory = s.ordersHistory || [];
                            state.aiRules = s.aiRules || [];
                            state.aiExecutionLogs = s.aiExecutionLogs || [];
                            
                            state.currentUserKey = email;
                            
                            googleModal.classList.add("hidden");
                            localStorage.setItem(STORAGE_KEYS.SESSION, "true");
                            saveStateToStorage();
                            animateSuccessfulAuth();
                        } else {
                            showNotificationToast("SSO Failed", body.message || "Failed to authenticate Google account.");
                            item.querySelector("strong").textContent = name;
                            item.style.backgroundColor = "";
                        }
                    })
                    .catch(err => {
                        console.error(err);
                        showNotificationToast("Server Error", "Unable to contact SQLite server.");
                        item.querySelector("strong").textContent = name;
                        item.style.backgroundColor = "";
                    });
                    return;
                }

                // If Google account doesn't exist in registered users db, register it on the fly!
                if (!state.db.registeredUsers[email]) {
                    state.db.registeredUsers[email] = {
                        name: name,
                        email: email,
                        password: "", // Google accounts don't need passwords
                        avatar: avatar,
                        walletBalance: 0.00,
                        investedValue: 0.00,
                        riskProfile: "balanced",
                        biometricsEnabled: true,
                        holdings: [],
                        watchlist: [],
                        ordersHistory: [],
                        aiRules: [],
                        aiExecutionLogs: []
                    };
                }
                
                state.currentUserKey = email;
                state.user = state.db.registeredUsers[email];
                state.aiRules = state.user.aiRules || [];
                state.aiExecutionLogs = state.user.aiExecutionLogs || [];
                
                googleModal.classList.add("hidden");
                localStorage.setItem(STORAGE_KEYS.SESSION, "true");
                
                saveStateToStorage();
                animateSuccessfulAuth();
            }, 1200);
        });
    });
    
    const googleUseAnother = document.getElementById("google-use-another-account");
    const googleCustomArea = document.getElementById("google-custom-input-area");
    if (googleUseAnother && googleCustomArea) {
        googleUseAnother.addEventListener("click", () => {
            googleCustomArea.classList.remove("hidden");
            googleUseAnother.style.display = "none";
        });
    }
    
    const btnGoogleCustomSubmit = document.getElementById("btn-google-custom-submit");
    if (btnGoogleCustomSubmit) {
        btnGoogleCustomSubmit.addEventListener("click", () => {
            const name = document.getElementById("google-custom-name").value.trim();
            const email = document.getElementById("google-custom-email").value.trim();
            
            if (!name || !email || !email.includes("@")) {
                showNotificationToast("Missing details", "Please enter valid Google account details.");
                return;
            }
            
            btnGoogleCustomSubmit.textContent = "Verifying...";
            btnGoogleCustomSubmit.disabled = true;
            
            setTimeout(() => {
                if (isLocalBackendActive) {
                    fetch('/api/auth/google', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            email: email,
                            name: name,
                            avatar: `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=0381FE&color=fff&size=150`
                        })
                    })
                    .then(res => res.json())
                    .then(body => {
                        if (body.status === "success") {
                            const s = body.state;
                            state.user = s.profile;
                            state.user.holdings = s.holdings || [];
                            state.user.watchlist = s.watchlist || [];
                            state.user.ordersHistory = s.ordersHistory || [];
                            state.aiRules = s.aiRules || [];
                            state.aiExecutionLogs = s.aiExecutionLogs || [];
                            
                            state.currentUserKey = email;
                            
                            googleModal.classList.add("hidden");
                            localStorage.setItem(STORAGE_KEYS.SESSION, "true");
                            saveStateToStorage();
                            animateSuccessfulAuth();
                        } else {
                            showNotificationToast("SSO Failed", body.message || "Failed to authenticate Google account.");
                            btnGoogleCustomSubmit.textContent = "Sign In";
                            btnGoogleCustomSubmit.disabled = false;
                        }
                    })
                    .catch(err => {
                        console.error(err);
                        showNotificationToast("Server Error", "Unable to contact SQLite server.");
                        btnGoogleCustomSubmit.textContent = "Sign In";
                        btnGoogleCustomSubmit.disabled = false;
                    });
                    return;
                }

                if (!state.db.registeredUsers[email]) {
                    state.db.registeredUsers[email] = {
                        name: name,
                        email: email,
                        password: "",
                        avatar: `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=0381FE&color=fff&size=150`,
                        walletBalance: 0.00,
                        investedValue: 0.00,
                        riskProfile: "balanced",
                        biometricsEnabled: true,
                        holdings: [],
                        watchlist: [],
                        ordersHistory: [],
                        aiRules: [],
                        aiExecutionLogs: []
                    };
                }
                
                state.currentUserKey = email;
                state.user = state.db.registeredUsers[email];
                state.aiRules = state.user.aiRules || [];
                state.aiExecutionLogs = state.user.aiExecutionLogs || [];
                
                googleModal.classList.add("hidden");
                localStorage.setItem(STORAGE_KEYS.SESSION, "true");
                
                saveStateToStorage();
                animateSuccessfulAuth();
            }, 1200);
        });
    }

    // --- Standard Sign Up and Biometric Auth triggers ---
    const goToSignup = document.getElementById("go-to-signup");
    const goToLogin = document.getElementById("go-to-login");
    const loginPanel = document.getElementById("login-panel");
    const signupPanel = document.getElementById("signup-panel");
    
    if (goToSignup && goToLogin) {
        goToSignup.addEventListener("click", (e) => {
            e.preventDefault();
            // Sliding transitions between panel views
            loginPanel.classList.remove("active");
            loginPanel.classList.add("inactive-left");
            loginPanel.classList.remove("inactive-right");
            
            signupPanel.classList.add("active");
            signupPanel.classList.remove("inactive-left");
            signupPanel.classList.remove("inactive-right");
        });
        
        goToLogin.addEventListener("click", (e) => {
            e.preventDefault();
            signupPanel.classList.remove("active");
            signupPanel.classList.add("inactive-right");
            signupPanel.classList.remove("inactive-left");
            
            loginPanel.classList.add("active");
            loginPanel.classList.remove("inactive-left");
            loginPanel.classList.remove("inactive-right");
        });
    }
    
    const loginForm = document.getElementById("login-form");
    if (loginForm) {
        loginForm.addEventListener("submit", (e) => {
            e.preventDefault();
            
            if (activeAuthMode === "password") {
                const email = document.getElementById("login-email").value.trim().toLowerCase();
                const pass = document.getElementById("login-password").value;
                
                if (!email) {
                    showNotificationToast("Input Missing", "Please enter your email address.");
                    return;
                }
                if (!pass) {
                    showNotificationToast("Input Missing", "Please enter your password.");
                    return;
                }
                
                if (isFirebaseConnected && authFirebase) {
                    showNotificationToast("Verifying", "Authenticating credentials against Google Firebase...");
                    authFirebase.signInWithEmailAndPassword(email, pass)
                        .then(() => {
                            state.currentUserKey = email;
                            showNotificationToast("Syncing Database", "Loading Cloud Firestore database...");
                            
                            dbFirestore.collection("users").doc(email).get().then((doc) => {
                                if (doc.exists) {
                                    state.user = doc.data();
                                } else {
                                    // Seed a fresh slate in Firestore if profile is missing
                                    state.db.registeredUsers[email] = {
                                        name: email.split("@")[0],
                                        email: email,
                                        password: pass,
                                        avatar: `https://ui-avatars.com/api/?name=${encodeURIComponent(email.split("@")[0])}&background=0381FE&color=fff&size=150`,
                                        walletBalance: 0.00,
                                        investedValue: 0.00,
                                        riskProfile: "balanced",
                                        biometricsEnabled: true,
                                        holdings: [],
                                        watchlist: [],
                                        ordersHistory: [],
                                        aiRules: [],
                                        aiExecutionLogs: []
                                    };
                                    state.user = state.db.registeredUsers[email];
                                    dbFirestore.collection("users").doc(email).set(state.user);
                                }
                                state.aiRules = state.user.aiRules || [];
                                state.aiExecutionLogs = state.user.aiExecutionLogs || [];
                                
                                localStorage.setItem(STORAGE_KEYS.SESSION, "true");
                                saveStateToStorage();
                                animateSuccessfulAuth();
                            });
                        })
                        .catch((error) => {
                            console.error("Firebase Login Error:", error);
                            showNotificationToast("Auth Failed", error.message || "Incorrect password or account not found.");
                        });
                } else if (isLocalBackendActive) {
                    showNotificationToast("Verifying", "Authenticating credentials against SQLite database...");
                    fetch('/api/auth/login', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            email: email,
                            password: pass
                        })
                    })
                    .then(res => res.json())
                    .then(body => {
                        if (body.status === "success") {
                            const s = body.state;
                            state.user = s.profile;
                            state.user.holdings = s.holdings || [];
                            state.user.watchlist = s.watchlist || [];
                            state.user.ordersHistory = s.ordersHistory || [];
                            state.aiRules = s.aiRules || [];
                            state.aiExecutionLogs = s.aiExecutionLogs || [];
                            
                            state.currentUserKey = email;
                            
                            localStorage.setItem(STORAGE_KEYS.SESSION, "true");
                            saveStateToStorage();
                            animateSuccessfulAuth();
                        } else {
                            showNotificationToast("Auth Failed", body.message || "Incorrect password or account not found.");
                        }
                    })
                    .catch(err => {
                        console.error(err);
                        showNotificationToast("Server Error", "Unable to connect to SQLite server.");
                    });
                } else {
                    // Local Database password verification
                    if (!state.db.registeredUsers[email]) {
                        showNotificationToast("Authentication Failed", "Account not found. Please sign up first.");
                        return;
                    }
                    
                    if (state.db.registeredUsers[email].password !== pass) {
                        showNotificationToast("Authentication Failed", "Incorrect password. Please try again.");
                        return;
                    }
                    
                    state.currentUserKey = email;
                    state.user = state.db.registeredUsers[state.currentUserKey];
                    state.aiRules = state.user.aiRules || [];
                    state.aiExecutionLogs = state.user.aiExecutionLogs || [];
                    
                    localStorage.setItem(STORAGE_KEYS.SESSION, "true");
                    saveStateToStorage();
                    animateSuccessfulAuth();
                }
            } else {
                // OTP unified handler
                const otpDigitsArea = document.getElementById("otp-digits-area");
                if (otpDigitsArea.classList.contains("hidden")) {
                    const btnSendOtp = document.getElementById("btn-send-otp");
                    if (btnSendOtp) btnSendOtp.click();
                    return;
                }
                
                const digitsCount = isFirebaseConnected ? 6 : 4;
                const digits = [];
                for (let i = 1; i <= digitsCount; i++) {
                    digits.push(document.getElementById(`otp-d${i}`).value.trim());
                }
                const code = digits.join("");
                
                if (code.length < digitsCount) {
                    showNotificationToast("Code Incomplete", `Please fill in all ${digitsCount} verification slots.`);
                    return;
                }
                
                if (isFirebaseConnected && window.confirmationResult) {
                    showNotificationToast("Verifying Code", "Submitting dynamic OTP token...");
                    window.confirmationResult.confirm(code)
                        .then(() => {
                            const phone = document.getElementById("login-phone").value.trim();
                            const mockEmail = `${phone}@mobile-ToroFolio.com`;
                            state.currentUserKey = mockEmail;
                            
                            showNotificationToast("Syncing Database", "Loading Cloud Firestore database...");
                            dbFirestore.collection("users").doc(mockEmail).get().then((doc) => {
                                if (doc.exists) {
                                    state.user = doc.data();
                                } else {
                                    // Seed a fresh phone-linked profile in Firestore
                                    state.db.registeredUsers[mockEmail] = {
                                        name: `User (${phone.slice(-4)})`,
                                        email: mockEmail,
                                        password: "",
                                        avatar: `https://ui-avatars.com/api/?name=${phone.slice(-4)}&background=0381FE&color=fff&size=150`,
                                        walletBalance: 0.00,
                                        investedValue: 0.00,
                                        riskProfile: "balanced",
                                        biometricsEnabled: true,
                                        holdings: [],
                                        watchlist: [],
                                        ordersHistory: [],
                                        aiRules: [],
                                        aiExecutionLogs: []
                                    };
                                    state.user = state.db.registeredUsers[mockEmail];
                                    dbFirestore.collection("users").doc(mockEmail).set(state.user);
                                }
                                state.aiRules = state.user.aiRules || [];
                                state.aiExecutionLogs = state.user.aiExecutionLogs || [];
                                
                                localStorage.setItem(STORAGE_KEYS.SESSION, "true");
                                saveStateToStorage();
                                animateSuccessfulAuth();
                            });
                        })
                        .catch((error) => {
                            console.error("OTP verification error:", error);
                            showNotificationToast("Code Failed", "Incorrect SMS code. Please request a new one.");
                        });
                } else if (isLocalBackendActive) {
                    showNotificationToast("Verifying Code", "Submitting secure OTP code to SQLite backend...");
                    fetch('/api/auth/otp/verify', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            phone: document.getElementById("login-phone").value.trim(),
                            code: code
                        })
                    })
                    .then(res => res.json())
                    .then(body => {
                        if (body.status === "success") {
                            const s = body.state;
                            state.user = s.profile;
                            state.user.holdings = s.holdings || [];
                            state.user.watchlist = s.watchlist || [];
                            state.user.ordersHistory = s.ordersHistory || [];
                            state.aiRules = s.aiRules || [];
                            state.aiExecutionLogs = s.aiExecutionLogs || [];
                            
                            state.currentUserKey = state.user.email;
                            
                            localStorage.setItem(STORAGE_KEYS.SESSION, "true");
                            saveStateToStorage();
                            animateSuccessfulAuth();
                        } else {
                            showNotificationToast("Code Failed", body.message || "Incorrect verification code.");
                        }
                    })
                    .catch(err => {
                        console.error(err);
                        showNotificationToast("Server Error", "Unable to contact SQLite server.");
                    });
                } else {
                    // Local Simulated OTP verification
                    if (code !== "1234") {
                        showNotificationToast("Verification Failed", "Incorrect OTP code. Try entering 1234.");
                        return;
                    }
                    
                    const phone = document.getElementById("login-phone").value.trim();
                    const mockEmail = `${phone}@mobile-ToroFolio.com`;
                    
                    if (!state.db.registeredUsers[mockEmail]) {
                        state.db.registeredUsers[mockEmail] = {
                            name: `User (${phone.slice(-4)})`,
                            email: mockEmail,
                            password: "",
                            avatar: `https://ui-avatars.com/api/?name=${phone.slice(-4)}&background=0381FE&color=fff&size=150`,
                            walletBalance: 0.00,
                            investedValue: 0.00,
                            riskProfile: "balanced",
                            biometricsEnabled: true,
                            holdings: [],
                            watchlist: [],
                            ordersHistory: [],
                            aiRules: [],
                            aiExecutionLogs: []
                        };
                    }
                    
                    state.currentUserKey = mockEmail;
                    state.user = state.db.registeredUsers[state.currentUserKey];
                    state.aiRules = state.user.aiRules || [];
                    state.aiExecutionLogs = state.user.aiExecutionLogs || [];
                    
                    localStorage.setItem(STORAGE_KEYS.SESSION, "true");
                    saveStateToStorage();
                    animateSuccessfulAuth();
                }
            }
        });
    }
    
    const signupForm = document.getElementById("signup-form");
    if (signupForm) {
        signupForm.addEventListener("submit", (e) => {
            e.preventDefault();
            const name = document.getElementById("signup-name").value.trim();
            const email = document.getElementById("signup-email").value.trim().toLowerCase();
            const pass = document.getElementById("signup-password").value;
            const confirmPass = document.getElementById("signup-confirm").value;
            const risk = document.querySelector('input[name="signup-risk"]:checked').value;
            
            if (!name) {
                showNotificationToast("Registration Failed", "Please enter your full name.");
                return;
            }
            if (!email || !email.includes("@") || !email.includes(".")) {
                showNotificationToast("Registration Failed", "Please enter a valid email address.");
                return;
            }
            if (pass.length < 4) {
                showNotificationToast("Registration Failed", "Password must be at least 4 characters.");
                return;
            }
            if (pass !== confirmPass) {
                showNotificationToast("Registration Failed", "Passwords do not match.");
                return;
            }
            
            if (isFirebaseConnected && authFirebase) {
                showNotificationToast("Registering", "Creating account on Cloud Firebase Auth...");
                authFirebase.createUserWithEmailAndPassword(email, pass)
                    .then(() => {
                        state.db.registeredUsers[email] = {
                            name: name,
                            email: email,
                            password: pass,
                            avatar: `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=0381FE&color=fff&size=150`,
                            walletBalance: 0.00,
                            investedValue: 0.00,
                            riskProfile: risk,
                            biometricsEnabled: true,
                            holdings: [],
                            watchlist: [],
                            ordersHistory: [],
                            aiRules: [],
                            aiExecutionLogs: []
                        };
                        
                        state.currentUserKey = email;
                        state.user = state.db.registeredUsers[email];
                        state.aiRules = state.user.aiRules || [];
                        state.aiExecutionLogs = state.user.aiExecutionLogs || [];
                        
                        // Seed directly into Cloud Firestore
                        dbFirestore.collection("users").doc(email).set(state.user).then(() => {
                            const riskRads = document.querySelectorAll('input[name="profile-risk-select"]');
                            riskRads.forEach(rad => {
                                if (rad.value === risk) rad.checked = true;
                            });
                            
                            localStorage.setItem(STORAGE_KEYS.SESSION, "true");
                            saveStateToStorage();
                            animateSuccessfulAuth();
                        });
                    })
                    .catch((error) => {
                        console.error("Firebase registration failed:", error);
                        showNotificationToast("Register Failed", error.message || "Failed to create cloud account.");
                    });
            } else if (isLocalBackendActive) {
                showNotificationToast("Registering", "Submitting account registration to SQLite server...");
                fetch('/api/auth/signup', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        name: name,
                        email: email,
                        password: pass,
                        riskProfile: risk
                    })
                })
                .then(res => res.json())
                .then(body => {
                    if (body.status === "success") {
                        const s = body.state;
                        state.user = s.profile;
                        state.user.holdings = s.holdings || [];
                        state.user.watchlist = s.watchlist || [];
                        state.user.ordersHistory = s.ordersHistory || [];
                        state.aiRules = s.aiRules || [];
                        state.aiExecutionLogs = s.aiExecutionLogs || [];
                        
                        state.currentUserKey = email;
                        
                        const riskRads = document.querySelectorAll('input[name="profile-risk-select"]');
                        riskRads.forEach(rad => {
                            if (rad.value === risk) rad.checked = true;
                        });
                        
                        localStorage.setItem(STORAGE_KEYS.SESSION, "true");
                        saveStateToStorage();
                        animateSuccessfulAuth();
                    } else {
                        showNotificationToast("Register Failed", body.message || "Failed to create account.");
                    }
                })
                .catch(err => {
                    console.error(err);
                    showNotificationToast("Server Error", "Unable to contact SQLite server.");
                });
            } else {
                // Local registration fallback
                if (state.db.registeredUsers[email]) {
                    showNotificationToast("Registration Failed", "Email address is already registered.");
                    return;
                }
                
                state.db.registeredUsers[email] = {
                    name: name,
                    email: email,
                    password: pass,
                    avatar: `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=0381FE&color=fff&size=150`,
                    walletBalance: 0.00,
                    investedValue: 0.00,
                    riskProfile: risk,
                    biometricsEnabled: true,
                    holdings: [],
                    watchlist: [],
                    ordersHistory: [],
                    aiRules: [],
                    aiExecutionLogs: []
                };
                
                state.currentUserKey = email;
                state.user = state.db.registeredUsers[email];
                state.aiRules = state.user.aiRules || [];
                state.aiExecutionLogs = state.user.aiExecutionLogs || [];
                
                const riskRads = document.querySelectorAll('input[name="profile-risk-select"]');
                riskRads.forEach(rad => {
                    if (rad.value === risk) rad.checked = true;
                });
                
                localStorage.setItem(STORAGE_KEYS.SESSION, "true");
                saveStateToStorage();
                animateSuccessfulAuth();
            }
        });
    }
    
    const scanner = document.getElementById("biometric-trigger");
    if (scanner) {
        scanner.addEventListener("click", () => {
            if (scanner.classList.contains("scanning")) return;
            scanner.classList.add("scanning");
            document.querySelector(".scanner-label").textContent = "Analyzing biometrics fingerprint...";
            setTimeout(() => {
                scanner.classList.remove("scanning");
                document.querySelector(".scanner-label").textContent = "Ultrasonic verification complete!";
                setTimeout(() => {
                    // Biometrics login defaults to Guest User's portfolio!
                    const guestEmail = "guest@ToroFolio.com";

                    // Re-seed Guest User's account if it was deleted or database cleared
                    if (!state.db.registeredUsers[guestEmail]) {
                        state.db.registeredUsers[guestEmail] = {
                            name: "Guest User",
                            email: "guest@ToroFolio.com",
                            password: "admin",
                            avatar: "https://ui-avatars.com/api/?name=Guest+User&background=0381FE&color=fff&size=150",
                            walletBalance: 0.00,
                            investedValue: 0.00,
                            riskProfile: "conservative",
                            biometricsEnabled: true,
                            holdings: [],
                            watchlist: ["RELIANCE", "TCS", "INFY", "SBIN"],
                            ordersHistory: [],
                            aiRules: [],
                            aiExecutionLogs: []
                        };
                    }

                    state.currentUserKey = guestEmail;
                    state.user = state.db.registeredUsers[guestEmail];
                    state.aiRules = state.user.aiRules || [];
                    state.aiExecutionLogs = state.user.aiExecutionLogs || [];
                    
                    // Mark session active and SAVE state immediately!
                    localStorage.setItem(STORAGE_KEYS.SESSION, "true");
                    saveStateToStorage();
                    animateSuccessfulAuth();
                }, 400);
            }, 1800);
        });
    }
    
    const logoutBtn = document.getElementById("logout-btn");
    if (logoutBtn) {
        logoutBtn.addEventListener("click", () => {
            // Since the login page is removed, logout resets user state back to a clean guest profile
            localStorage.removeItem(STORAGE_KEYS.SESSION);
            localStorage.removeItem(STORAGE_KEYS.CURRENT_USER);
            location.reload();
        });
    }

    const viewport = document.getElementById("content-viewport");
    const header = document.getElementById("app-header");
    if (viewport && header) {
        viewport.addEventListener("scroll", () => {
            if (viewport.scrollTop > 50) {
                header.classList.add("collapsed");
            } else {
                header.classList.remove("collapsed");
            }
        });
    }

    // Chart Options Timeframes
    const timeBtns = document.querySelectorAll(".timeframe-selector .time-btn");
    timeBtns.forEach(btn => {
        btn.addEventListener("click", async () => {
            timeBtns.forEach(b => b.classList.remove("active"));
            btn.classList.add("active");
            const newTimeframe = btn.getAttribute("data-time") || "1D";
            state.chart.timeframe = newTimeframe;
            
            const activeSymbol = state.chart.selectedStock;
            if (activeSymbol) {
                await selectActiveStock(activeSymbol, newTimeframe);
            }
        });
    });
    
    const typeCandles = document.getElementById("chart-type-candles");
    const typeLine = document.getElementById("chart-type-line");
    if (typeCandles && typeLine) {
        typeCandles.addEventListener("click", () => {
            typeCandles.classList.add("active");
            typeLine.classList.remove("active");
            state.chart.type = "candles";
            drawTechnicalCharts();
        });
        typeLine.addEventListener("click", () => {
            typeLine.classList.add("active");
            typeCandles.classList.remove("active");
            state.chart.type = "line";
            drawTechnicalCharts();
        });
    }
    
    const toggleEma = document.getElementById("indicator-ema");
    const toggleRsi = document.getElementById("indicator-rsi");
    const toggleMacd = document.getElementById("indicator-macd");
    
    if (toggleEma && toggleRsi && toggleMacd) {
        toggleEma.addEventListener("change", () => {
            state.chart.indicators.ema = toggleEma.checked;
            drawTechnicalCharts();
        });
        
        toggleRsi.addEventListener("change", () => {
            state.chart.indicators.rsi = toggleRsi.checked;
            if (toggleRsi.checked) {
                toggleMacd.checked = false;
                state.chart.indicators.macd = false;
            }
            drawTechnicalCharts();
        });
        
        toggleMacd.addEventListener("change", () => {
            state.chart.indicators.macd = toggleMacd.checked;
            if (toggleMacd.checked) {
                toggleRsi.checked = false;
                state.chart.indicators.rsi = false;
            }
            drawTechnicalCharts();
        });
    }
    
    const runAiBtn = document.getElementById("run-ai-chart-analysis");
    if (runAiBtn) {
        runAiBtn.addEventListener("click", executeFullAIChartAnalysis);
    }

    // Buy/Sell Console
    const buyTab = document.getElementById("btn-buy-mode");
    const sellTab = document.getElementById("btn-sell-mode");
    if (buyTab && sellTab) {
        buyTab.addEventListener("click", () => {
            buyTab.classList.add("active");
            sellTab.classList.remove("active");
            state.order.mode = "BUY";
            updateOrderConsoleCalculator();
        });
        sellTab.addEventListener("click", () => {
            sellTab.classList.add("active");
            buyTab.classList.remove("active");
            state.order.mode = "SELL";
            updateOrderConsoleCalculator();
        });
    }
    
    const marketSubTab = document.getElementById("order-type-market");
    const clientLimitTab = document.getElementById("order-type-limit");
    const limitGroup = document.getElementById("limit-price-group");
    const limitInput = document.getElementById("order-limit-price");
    
    if (marketSubTab && clientLimitTab && limitGroup) {
        marketSubTab.addEventListener("click", () => {
            marketSubTab.classList.add("active");
            clientLimitTab.classList.remove("active");
            limitGroup.classList.add("disabled");
            limitInput.disabled = true;
            state.order.type = "MARKET";
            updateOrderConsoleCalculator();
        });
        
        clientLimitTab.addEventListener("click", () => {
            clientLimitTab.classList.add("active");
            marketSubTab.classList.remove("active");
            limitGroup.classList.remove("disabled");
            limitInput.disabled = false;
            const activeStock = state.stocks[state.chart.selectedStock];
            if (activeStock) limitInput.value = getConvertedValue(activeStock.price);
            state.order.type = "LIMIT";
            updateOrderConsoleCalculator();
        });
        
        limitInput.addEventListener("input", updateOrderConsoleCalculator);
    }
    
    const qtyInput = document.getElementById("order-qty");
    if (qtyInput) {
        qtyInput.addEventListener("input", updateOrderConsoleCalculator);
    }
    
    const executeOrderBtn = document.getElementById("btn-execute-order");
    if (executeOrderBtn) {
        executeOrderBtn.addEventListener("click", handleTradeExecution);
    }

    // AI Conversations
    const sendChatBtn = document.getElementById("send-ai-chat-btn");
    const chatInput = document.getElementById("ai-chat-input");
    if (sendChatBtn && chatInput) {
        sendChatBtn.addEventListener("click", processAIChatQuery);
        chatInput.addEventListener("keypress", (e) => {
            if (e.key === "Enter") processAIChatQuery();
        });
    }
    
    const sugChips = document.querySelectorAll(".suggestion-chip");
    sugChips.forEach(chip => {
        chip.addEventListener("click", () => {
            chatInput.value = chip.textContent;
            processAIChatQuery();
        });
    });

    const addRuleBtn = document.getElementById("btn-create-ai-plan");
    if (addRuleBtn) {
        addRuleBtn.addEventListener("click", createNewAISmartRule);
    }

    // Risk profiles
    const riskRads = document.querySelectorAll('input[name="profile-risk-select"]');
    riskRads.forEach(rad => {
        rad.addEventListener("change", () => {
            state.user.riskProfile = rad.value;
            const badge = document.getElementById("profile-risk-tag");
            const sidebarBadge = document.querySelector(".sidebar-footer .user-badge");
            
            const riskName = rad.value.charAt(0).toUpperCase() + rad.value.slice(1);
            if (badge) badge.textContent = `${riskName} Risk`;
            if (sidebarBadge) sidebarBadge.textContent = riskName;
            
            showNotificationToast("AI Recalibrated", `Toro AI is now tuned to ${riskName} parameters.`);
            updateAiAdviceCardDashboard();
            saveStateToStorage();
            saveStateToServer();
        });
    });

    // Preferred display currency
    const currencySelect = document.getElementById("profile-currency-select");
    if (currencySelect) {
        currencySelect.addEventListener("change", () => {
            state.user.currency = currencySelect.value;
            showNotificationToast("Currency Changed", `Display currency is now set to ${state.user.currency === "INR" ? "Indian Rupees (₹)" : "US Dollars ($)"}.`);
            
            // Re-render all elements that display prices/currency!
            recalculatePortfolioVal();
            renderDashboardPortfolio();
            renderDashboardWatchlist();
            renderMarketTickers();
            updateDetailedStockHeader();
            renderUserHistoryTable();
            
            saveStateToStorage();
            saveStateToServer();
        });
    }
    
    // Deposit funds sheet
    const depositTriggers = document.querySelectorAll(".deposit-trigger");
    const depositModal = document.getElementById("deposit-modal");
    const closeDeposit = document.getElementById("close-deposit-btn");
    const executeDeposit = document.getElementById("execute-deposit-btn");
    const depositAmount = document.getElementById("deposit-amount");
    
    depositTriggers.forEach(trig => {
        trig.addEventListener("click", () => {
            if (depositModal) depositModal.classList.remove("hidden");
        });
    });
    
    if (closeDeposit && depositModal) {
        closeDeposit.addEventListener("click", () => {
            depositModal.classList.add("hidden");
        });
    }

    const cashChips = document.querySelectorAll(".cash-suggestions .cash-chip");
    cashChips.forEach(chip => {
        chip.addEventListener("click", () => {
            if (depositAmount) {
                depositAmount.value = chip.getAttribute("data-amount");
            }
        });
    });
    
    if (executeDeposit && depositModal && depositAmount) {
        executeDeposit.addEventListener("click", () => {
            const amt = parseFloat(depositAmount.value) || 0;
            if (amt <= 0) {
                showNotificationToast("Transfer Failed", "Invalid deposit amount.");
                return;
            }
            
            if (isLocalBackendActive) {
                showNotificationToast("Processing Deposit", "Submitting secure transfer to SQLite database...");
                fetch('/api/user/add-funds', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        email: state.currentUserKey,
                        amount: amt
                    })
                })
                .then(res => res.json())
                .then(body => {
                    if (body.status === "success") {
                        const s = body.state;
                        state.user = s.profile;
                        state.user.holdings = s.holdings || [];
                        state.user.watchlist = s.watchlist || [];
                        state.user.ordersHistory = s.ordersHistory || [];
                        state.aiRules = s.aiRules || [];
                        state.aiExecutionLogs = s.aiExecutionLogs || [];
                        
                        depositModal.classList.add("hidden");
                        recalculatePortfolioVal();
                        renderUserHistoryTable();
                        showNotificationToast("Funds Added", `Successfully transferred ${formatCurrency(amt)} to trading balance.`);
                    } else {
                        showNotificationToast("Transfer Failed", body.message || "Failed to add funds.");
                    }
                })
                .catch(err => {
                    console.error(err);
                    showNotificationToast("Server Error", "Unable to contact SQLite server.");
                });
                return;
            }

            state.user.walletBalance += amt;
            depositModal.classList.add("hidden");
            recalculatePortfolioVal();
            
            state.user.ordersHistory.unshift({
                timestamp: new Date().toLocaleString(),
                type: "DEPOSIT",
                symbol: "INR",
                shares: 1,
                price: amt,
                total: amt,
                status: "COMPLETED"
            });
            
            showNotificationToast("Funds Added", `Successfully transferred ${formatCurrency(amt)} to trading balance.`);
            renderUserHistoryTable();
            saveStateToStorage();
        });
    }
    
    // Edit Profile Modal listeners
    const editProfileBtn = document.getElementById("btn-edit-profile");
    const editProfileModal = document.getElementById("edit-profile-modal");
    const closeEditProfile = document.getElementById("close-edit-profile-btn");
    const submitEditProfile = document.getElementById("btn-edit-profile-submit");
    const editProfileName = document.getElementById("edit-profile-name");
    const editProfileAvatarPreview = document.getElementById("edit-profile-avatar-preview");
    const editProfileAvatarFile = document.getElementById("edit-profile-avatar-file");
    const editProfileEmail = document.getElementById("edit-profile-email");
    const editProfilePhone = document.getElementById("edit-profile-phone");
    const editProfileDob = document.getElementById("edit-profile-dob");
    const editProfileCity = document.getElementById("edit-profile-city");
    const editProfileState = document.getElementById("edit-profile-state");

    let selectedAvatarBase64 = "";

    if (editProfileAvatarFile) {
        editProfileAvatarFile.addEventListener("change", (e) => {
            const file = e.target.files[0];
            if (file) {
                const reader = new FileReader();
                reader.onload = (event) => {
                    selectedAvatarBase64 = event.target.result;
                    if (editProfileAvatarPreview) {
                        editProfileAvatarPreview.src = selectedAvatarBase64;
                    }
                };
                reader.readAsDataURL(file);
            }
        });
    }

    if (editProfileBtn && editProfileModal) {
        editProfileBtn.addEventListener("click", () => {
            if (editProfileName) editProfileName.value = state.user.name || "";
            
            selectedAvatarBase64 = state.user.avatar || "";
            if (editProfileAvatarPreview) {
                editProfileAvatarPreview.src = state.user.avatar || "https://ui-avatars.com/api/?name=Guest+User&background=0381FE&color=fff&size=150";
            }
            if (editProfileAvatarFile) {
                editProfileAvatarFile.value = "";
            }

            if (editProfileEmail) editProfileEmail.value = state.user.email || "";
            if (editProfilePhone) editProfilePhone.value = state.user.phone || "";
            if (editProfileDob) editProfileDob.value = state.user.dob || "";
            if (editProfileCity) editProfileCity.value = state.user.city || "";
            if (editProfileState) editProfileState.value = state.user.state || "";
            editProfileModal.classList.remove("hidden");
        });
    }

    if (closeEditProfile && editProfileModal) {
        closeEditProfile.addEventListener("click", () => {
            editProfileModal.classList.add("hidden");
        });
    }

    if (submitEditProfile && editProfileModal && editProfileName && editProfileEmail && editProfilePhone && editProfileDob && editProfileCity && editProfileState) {
        submitEditProfile.addEventListener("click", () => {
            const newName = editProfileName.value.trim();
            const newAvatar = selectedAvatarBase64;
            const newEmail = editProfileEmail.value.trim().toLowerCase();
            const newPhone = editProfilePhone.value.trim();
            const newDob = editProfileDob.value;
            const newCity = editProfileCity.value.trim();
            const newStateVal = editProfileState.value.trim();

            if (!newName) {
                showNotificationToast("Edit Failed", "Full Name cannot be empty.");
                return;
            }
            if (!newEmail) {
                showNotificationToast("Edit Failed", "Email Address cannot be empty.");
                return;
            }

            submitEditProfile.disabled = true;
            submitEditProfile.textContent = "Saving...";

            const oldEmail = state.currentUserKey;

            fetch('/api/user/profile/update', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    email: oldEmail,
                    email_new: newEmail,
                    name: newName,
                    avatar: newAvatar,
                    phone: newPhone,
                    dob: newDob,
                    city: newCity,
                    state: newStateVal
                })
            })
            .then(res => res.json())
            .then(body => {
                submitEditProfile.disabled = false;
                submitEditProfile.textContent = "Save Changes";

                if (body.status === "success") {
                    state.user.name = newName;
                    state.user.avatar = newAvatar;
                    state.user.email = newEmail;
                    state.user.phone = newPhone;
                    state.user.dob = newDob;
                    state.user.city = newCity;
                    state.user.state = newStateVal;

                    if (newEmail !== oldEmail) {
                        state.db.registeredUsers[newEmail] = state.db.registeredUsers[oldEmail] || {};
                        delete state.db.registeredUsers[oldEmail];
                        state.currentUserKey = newEmail;
                    }

                    const profile = state.db.registeredUsers[newEmail];
                    if (profile) {
                        profile.name = newName;
                        profile.avatar = newAvatar;
                        profile.email = newEmail;
                        profile.phone = newPhone;
                        profile.dob = newDob;
                        profile.city = newCity;
                        profile.state = newStateVal;
                    }

                    syncProfileFieldsToUI();
                    saveStateToStorage();

                    editProfileModal.classList.add("hidden");
                    showNotificationToast("Profile Updated", "Your changes have been saved successfully.");
                } else {
                    showNotificationToast("Update Failed", body.message || "Failed to update profile details.");
                }
            })
            .catch(err => {
                submitEditProfile.disabled = false;
                submitEditProfile.textContent = "Save Changes";
                console.error(err);
                showNotificationToast("Server Error", "Unable to sync profile edits with SQLite server.");
            });
        });
    }

    const themeBtn = document.getElementById("theme-toggle-btn");
    if (themeBtn) {
        themeBtn.addEventListener("click", () => {
            const body = document.body;
            state.isDarkTheme = !state.isDarkTheme;
            if (state.isDarkTheme) {
                body.className = "dark-theme";
                themeBtn.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="5"/><path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/></svg>`;
            } else {
                body.className = "light-theme";
                themeBtn.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>`;
            }
            drawTechnicalCharts();
            
            saveStateToStorage();
        });
    }
    
    const bioToggle = document.getElementById("biometric-toggle-checkbox");
    if (bioToggle) {
        bioToggle.addEventListener("change", () => {
            state.user.biometricsEnabled = bioToggle.checked;
            const scanner = document.getElementById("biometric-trigger");
            if (scanner) {
                scanner.style.display = bioToggle.checked ? "flex" : "none";
            }
            showNotificationToast("Biometrics Updated", `Ultrasonic verification is now ${bioToggle.checked ? 'Enabled' : 'Disabled'}.`);
            
            saveStateToStorage();
        });
    }
}

// Successful auth transitions
function animateSuccessfulAuth() {
    const authScreen = document.getElementById("auth-screen");
    const appShell = document.getElementById("app-shell");
    
    syncProfileFieldsToUI();
    updateAiAdviceCardDashboard();
    
    if (authScreen) authScreen.classList.add("fade-out");
    
    setTimeout(() => {
        if (appShell) appShell.classList.remove("hidden");
        updateActiveTabs();
        
        recalculatePortfolioVal();
        renderDashboardWatchlist();
        renderDashboardPortfolio();
        renderMarketTickers();
        renderActiveRulesList();
        renderExecutionLogsList();
        renderUserHistoryTable();
        loadSavedAPISettingsToUI();
        
        showNotificationToast("Welcome to ToroFolio", `Logged in as ${state.user.name}`);
    }, 450);
}

// Sync logged-in user profile details (inputs, checkboxes, labels) with the DOM
function syncProfileFieldsToUI() {
    const profName = document.getElementById("profile-user-name");
    const profEmail = document.getElementById("profile-user-email");
    const profAvatar = document.querySelector(".profile-avatar");
    const profRisk = document.getElementById("profile-risk-tag");

    const sidebarAvatar = document.querySelector(".sidebar-footer .avatar-img");
    const sidebarName = document.querySelector(".sidebar-footer .username");
    const sidebarBadge = document.querySelector(".sidebar-footer .user-badge");

    if (state.user) {
        if (sidebarAvatar) sidebarAvatar.src = state.user.avatar;
        if (sidebarName) sidebarName.textContent = state.user.name;
        
        const capRisk = state.user.riskProfile.charAt(0).toUpperCase() + state.user.riskProfile.slice(1);
        if (sidebarBadge) sidebarBadge.textContent = capRisk;
        
        if (profName) profName.textContent = state.user.name;
        if (profEmail) profEmail.textContent = state.user.email;
        if (profAvatar) profAvatar.src = state.user.avatar;
        if (profRisk) profRisk.textContent = `${capRisk} Risk`;

        // Sync details labels
        const detailPhone = document.getElementById("profile-detail-phone");
        const detailDob = document.getElementById("profile-detail-dob");
        const detailCity = document.getElementById("profile-detail-city");
        const detailState = document.getElementById("profile-detail-state");

        if (detailPhone) detailPhone.textContent = state.user.phone || "-";
        if (detailDob) detailDob.textContent = state.user.dob || "-";
        if (detailCity) detailCity.textContent = state.user.city || "-";
        if (detailState) detailState.textContent = state.user.state || "-";

        // Sync risk preferences radio buttons
        const riskRads = document.querySelectorAll('input[name="profile-risk-select"]');
        riskRads.forEach(rad => {
            rad.checked = (rad.value === state.user.riskProfile);
        });

        // Sync currency preferred select box
        const currencySelect = document.getElementById("profile-currency-select");
        if (currencySelect) {
            currencySelect.value = state.user.currency || "INR";
        }

        // Sync biometric toggle checkbox
        const bioToggle = document.getElementById("biometric-toggle-checkbox");
        if (bioToggle) {
            bioToggle.checked = !!state.user.biometricsEnabled;
        }

        // Sync biometric scanner on lockscreen
        const scanner = document.getElementById("biometric-trigger");
        if (scanner) {
            scanner.style.display = state.user.biometricsEnabled ? "flex" : "none";
        }
    }
}

function updateAiAdviceCardDashboard() {
    const aiTitle = document.getElementById("dash-ai-title");
    const aiDesc = document.getElementById("dash-ai-desc");
    if (!aiTitle || !aiDesc) return;
    
    const risk = (state.user && state.user.riskProfile) ? state.user.riskProfile : "conservative";
    
    const reliancePrice = state.stocks["RELIANCE"] ? formatCurrency(state.stocks["RELIANCE"].price) : "₹2,900.00";
    const tcsPrice = state.stocks["TCS"] ? formatCurrency(state.stocks["TCS"].price) : "₹3,800.00";
    const infyPrice = state.stocks["INFY"] ? formatCurrency(state.stocks["INFY"].price) : "₹1,400.00";

    if (risk === "conservative") {
        aiTitle.textContent = "Safe Dividends Opportunity";
        aiDesc.innerHTML = `Based on your <strong>Conservative</strong> risk limits, RELIANCE (${reliancePrice}) is consolidating above the 20-day EMA. Target returns estimated at <strong>8%</strong>. AI rating: <strong>ACCUMULATE</strong>.`;
    } else if (risk === "balanced") {
        aiTitle.textContent = "Technology Rebound Alert";
        aiDesc.innerHTML = `Based on your <strong>Balanced</strong> risk limits, TCS (${tcsPrice}) shows MACD positive crossover support. Target returns estimated at <strong>12%</strong>. AI rating: <strong>BUY</strong>.`;
    } else {
        aiTitle.textContent = "High Volatility Outbreak";
        aiDesc.innerHTML = `Based on your <strong>Aggressive</strong> risk limits, INFY (${infyPrice}) and SBIN are registering deep RSI divergences. Perfect swing range detected. AI rating: <strong>STRONG BUY</strong>.`;
    }
}

window.deleteAISmartRule = deleteAISmartRule;

function startSidebarClock() {
    const clockEl = document.getElementById("sidebar-user-clock");
    if (!clockEl) return;
    
    function updateClock() {
        const now = new Date();
        const hrs = String(now.getHours()).padStart(2, '0');
        const mins = String(now.getMinutes()).padStart(2, '0');
        const secs = String(now.getSeconds()).padStart(2, '0');
        clockEl.textContent = `${hrs}:${mins}:${secs}`;
    }
    
    updateClock();
    setInterval(updateClock, 1000);
}

// --- Initialize App ---
document.addEventListener("DOMContentLoaded", async () => {
    try {
        // 1. Check if SQLite Local Backend is active
        await checkLocalBackendActive();
    } catch (e) {
        console.error("Failed to check backend state:", e);
    }

    try {
        // 2. Initialize dynamic Firebase configurations
        initializeFirebaseIfConfigured();
    } catch (e) {
        console.error("Failed to initialize Firebase:", e);
    }
    
    try {
        // 3. Render SMS OTP digits depending on connected mode (4 or 6 slots)
        renderOtpDigitsMarkup();
    } catch (e) {
        console.error("Failed to render OTP markup:", e);
    }

    try {
        // 3.5 Fetch live USD/INR exchange rate
        await fetchLiveExchangeRate();
    } catch (e) {
        console.error("Failed to fetch exchange rate:", e);
    }

    try {
        // 4. Load LocalStorage Database State
        await loadStateFromStorage();
    } catch (e) {
        console.error("Failed to load local storage state:", e);
    }
    
    try {
        // 5. Query historical feeds (Simulated or Live APIs)
        await reloadAllHistoricalData();
    } catch (e) {
        console.error("Failed to reload historical data:", e);
    }
    
    try {
        // 6. Bind UI & Events
        setupEventListeners();
        initChartHoverEngine();
    } catch (e) {
        console.error("Failed to bind event listeners:", e);
    }
    
    // 7. Start session autologin check (Forcefully disabled auto-login)
    const authScreen = document.getElementById("auth-screen");
    const appShell = document.getElementById("app-shell");

    if (authScreen) authScreen.classList.remove("hidden");
    if (appShell) appShell.classList.add("hidden");
    
    // Reset session keys to guarantee manual login
    localStorage.removeItem(STORAGE_KEYS.SESSION);
    localStorage.removeItem(STORAGE_KEYS.CURRENT_USER);
    state.currentUserKey = "";
    
    try {
        // 8. Start ticks fluctuations loops
        startLiveMarketFeed();
    } catch (e) {
        console.error("Failed to start live market feed:", e);
    }

    try {
        // 9. Start live 24-hour sidebar clock
        startSidebarClock();
    } catch (e) {
        console.error("Failed to start sidebar clock:", e);
    }
});

