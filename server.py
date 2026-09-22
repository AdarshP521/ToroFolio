import os
import sqlite3
import hashlib
import secrets
import datetime
import random
import time as _time
from flask import Flask, jsonify, request, send_from_directory
import urllib.request
import json
import yfinance as yf
import math

app = Flask(__name__, static_url_path='', static_folder='.')

@app.after_request
def add_header(r):
    r.headers["Cache-Control"] = "no-cache, no-store, must-revalidate"
    r.headers["Pragma"] = "no-cache"
    r.headers["Expires"] = "0"
    r.headers['Cache-Control'] = 'public, max-age=0'
    return r


DB_FILE = 'torofolio.db'
FINNHUB_KEY = os.environ.get("FINNHUB_KEY", "")  # Set in .env or environment variable

# --- Password Hashing Helper ---
def hash_password(password, salt=None):
    if salt is None:
        salt = secrets.token_hex(16)
    hashed = hashlib.sha256((password + salt).encode('utf-8')).hexdigest()
    return hashed, salt

# --- SQLite Connection Helper ---
def get_db_connection():
    conn = sqlite3.connect(DB_FILE)
    conn.row_factory = sqlite3.Row
    # Check if 'users' table exists, if not initialize database dynamically
    try:
        cursor = conn.cursor()
        cursor.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='users';")
        if not cursor.fetchone():
            init_db(conn)
        else:
            # Upgrade schema dynamically if missing new profile fields
            try:
                cursor.execute("ALTER TABLE users ADD COLUMN phone TEXT;")
            except sqlite3.OperationalError:
                pass
            try:
                cursor.execute("ALTER TABLE users ADD COLUMN dob TEXT;")
            except sqlite3.OperationalError:
                pass
            try:
                cursor.execute("ALTER TABLE users ADD COLUMN city TEXT;")
            except sqlite3.OperationalError:
                pass
            try:
                cursor.execute("ALTER TABLE users ADD COLUMN state TEXT;")
            except sqlite3.OperationalError:
                pass
    except sqlite3.OperationalError:
        init_db(conn)
    return conn

# --- Database Schema Initialization ---
def init_db(existing_conn=None):
    if existing_conn is not None:
        conn = existing_conn
    else:
        conn = sqlite3.connect(DB_FILE)
        conn.row_factory = sqlite3.Row
        
    cursor = conn.cursor()
    
    # Enable foreign keys
    cursor.execute("PRAGMA foreign_keys = ON;")
    
    # Users Table
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS users (
        email TEXT PRIMARY KEY,
        password_hash TEXT,
        salt TEXT,
        name TEXT,
        avatar TEXT,
        wallet_balance REAL DEFAULT 0.0,
        invested_value REAL DEFAULT 0.0,
        risk_profile TEXT DEFAULT 'conservative',
        biometrics_enabled INTEGER DEFAULT 1,
        phone TEXT,
        dob TEXT,
        city TEXT,
        state TEXT
    );
    """)
    
    # Holdings Table
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS holdings (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_email TEXT,
        symbol TEXT,
        shares REAL,
        avg_price REAL,
        FOREIGN KEY(user_email) REFERENCES users(email) ON DELETE CASCADE
    );
    """)
    
    # Watchlist Table
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS watchlist (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_email TEXT,
        symbol TEXT,
        FOREIGN KEY(user_email) REFERENCES users(email) ON DELETE CASCADE,
        UNIQUE(user_email, symbol)
    );
    """)
    
    # Orders Table
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS orders (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_email TEXT,
        timestamp TEXT,
        type TEXT,
        symbol TEXT,
        shares REAL,
        price REAL,
        total REAL,
        status TEXT,
        FOREIGN KEY(user_email) REFERENCES users(email) ON DELETE CASCADE
    );
    """)
    
    # AI Rules Table
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS ai_rules (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_email TEXT,
        symbol TEXT,
        type TEXT,
        target_price REAL,
        shares REAL,
        is_active INTEGER DEFAULT 1,
        created_at TEXT,
        FOREIGN KEY(user_email) REFERENCES users(email) ON DELETE CASCADE
    );
    """)
    
    # AI Logs Table
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS ai_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_email TEXT,
        timestamp TEXT,
        message TEXT,
        status TEXT,
        FOREIGN KEY(user_email) REFERENCES users(email) ON DELETE CASCADE
    );
    """)
    
    # Active OTPs Table
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS active_otps (
        phone TEXT PRIMARY KEY,
        code TEXT,
        expires_at TEXT
    );
    """)
    
    # Pre-seed Guest User if not already present
    default_email = "guest@torofolio.com"
    cursor.execute("SELECT 1 FROM users WHERE email = ?;", (default_email,))
    if not cursor.fetchone():
        hashed_pass, salt = hash_password("admin")
        cursor.execute("""
        INSERT INTO users (email, password_hash, salt, name, avatar, wallet_balance, invested_value, risk_profile, biometrics_enabled)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?);
        """, (
            default_email,
            hashed_pass,
            salt,
            "Guest User",
            "https://ui-avatars.com/api/?name=Guest+User&background=0381FE&color=fff&size=150",
            0.0,
            0.0,
            "conservative",
            1
        ))
        
        # Seed watchlist
        for sym in ["RELIANCE", "TCS", "INFY", "SBIN"]:
            cursor.execute("INSERT INTO watchlist (user_email, symbol) VALUES (?, ?);", (default_email, sym))
        
    conn.commit()
    if existing_conn is None:
        conn.close()

# Initialize tables
init_db()

# --- Helper to serialize full user state ---
def get_user_state(email):
    conn = get_db_connection()
    cursor = conn.cursor()
    
    # 1. Fetch user profile
    cursor.execute("SELECT * FROM users WHERE email = ?;", (email,))
    user_row = cursor.fetchone()
    if not user_row:
        conn.close()
        return None
        
    user_data = dict(user_row)
    # Remove security tokens
    user_data.pop('password_hash', None)
    user_data.pop('salt', None)
    # Boolean conversions
    user_data['biometricsEnabled'] = bool(user_data['biometrics_enabled'])
    user_data['walletBalance'] = user_data['wallet_balance']
    user_data['investedValue'] = user_data['invested_value']
    user_data['riskProfile'] = user_data['risk_profile']
    
    # 2. Fetch holdings
    cursor.execute("SELECT symbol, shares, avg_price as avgPrice FROM holdings WHERE user_email = ?;", (email,))
    holdings = [dict(r) for r in cursor.fetchall()]
    
    # 3. Fetch watchlist
    cursor.execute("SELECT symbol FROM watchlist WHERE user_email = ?;", (email,))
    watchlist = [r['symbol'] for r in cursor.fetchall()]
    
    # 4. Fetch orders history (most recent first)
    cursor.execute("SELECT timestamp, type, symbol, shares, price, total, status FROM orders WHERE user_email = ? ORDER BY id DESC;", (email,))
    orders_history = [dict(r) for r in cursor.fetchall()]
    
    # 5. Fetch AI rules
    cursor.execute("SELECT id, symbol, type, target_price as targetPrice, shares, is_active as isActive, created_at as createdAt FROM ai_rules WHERE user_email = ?;", (email,))
    ai_rules = []
    for r in cursor.fetchall():
        rule = dict(r)
        rule['isActive'] = bool(rule['isActive'])
        ai_rules.append(rule)
        
    # 6. Fetch AI execution logs
    cursor.execute("SELECT timestamp, message, status FROM ai_logs WHERE user_email = ? ORDER BY id DESC LIMIT 50;", (email,))
    ai_logs = [dict(r) for r in cursor.fetchall()]
    
    conn.close()
    
    return {
        "profile": user_data,
        "holdings": holdings,
        "watchlist": watchlist,
        "ordersHistory": orders_history,
        "aiRules": ai_rules,
        "aiExecutionLogs": ai_logs
    }

# --- STATICS HOSTING ---
@app.route('/')
def serve_root():
    return send_from_directory('.', 'index.html')

# --- HEALTH API ---
@app.route('/api/health', methods=['GET'])
def health_check():
    return jsonify({
        "status": "ok",
        "message": "TOROFOLIO Python backend is active!",
        "database": "sqlite"
    })

# --- GOOGLE SHEETS WEBHOOK INTEGRATION CONFIG ---
# If you set a live Google Apps Script Web App URL here, signups will also automatically append to your live Google Sheet!
GOOGLE_SHEETS_WEBHOOK = ""

# Helper to convert Base64 avatars to local files and store the path
def save_avatar_base64_to_file(email, avatar_str):
    if not avatar_str or not avatar_str.startswith("data:image/"):
        return avatar_str
    try:
        import base64
        import re
        header, encoded = avatar_str.split(",", 1)
        match = re.search(r'data:image/(\w+);base64', header)
        ext = match.group(1) if match else 'png'
        if ext not in ['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg']:
            ext = 'png'
        data = base64.b64decode(encoded)
        os.makedirs("images", exist_ok=True)
        email_hash = hashlib.md5(email.encode('utf-8')).hexdigest()
        filename = f"avatar_{email_hash}.{ext}"
        filepath = os.path.join("images", filename)
        with open(filepath, "wb") as f:
            f.write(data)
        return f"images/{filename}"
    except Exception as e:
        print(f"[AVATAR SAVE ERROR] Failed to save base64 avatar: {e}", flush=True)
        return avatar_str

# CSV Profile Details Logger Helper (Google Sheet simulation/fallback)
def log_profile_to_csv(email, name, avatar, phone, dob, city, state):
    csv_file = "users_details_sheet.csv"
    import csv
    file_exists = os.path.exists(csv_file)
    try:
        with open(csv_file, mode='a', newline='', encoding='utf-8') as f:
            writer = csv.writer(f)
            if not file_exists:
                writer.writerow(["Timestamp", "Email", "Name", "Avatar", "Phone", "DOB", "City", "State"])
            now = datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S")
            writer.writerow([now, email, name, avatar, phone, dob, city, state])
        print("\n" + "="*50, flush=True)
        print(" TOROFOLIO - PROFILE DETAILS SHEET CSV LOGGER ", flush=True)
        print("="*50, flush=True)
        print(f" LOGGED PROFILE UPDATE TO : {csv_file}", flush=True)
        print(f" NAME                     : {name}", flush=True)
        print(f" EMAIL                    : {email}", flush=True)
        print("="*50 + "\n", flush=True)
    except Exception as e:
        print(f"[CSV LOGGER ERROR] Failed to write CSV: {e}", flush=True)

# CSV Sheet Logger Helper (Google Sheet simulation/fallback)
def log_to_google_sheet_fallback(email, name, password):
    csv_file = "users_google_sheet.csv"
    import csv
    file_exists = os.path.exists(csv_file)
    try:
        with open(csv_file, mode='a', newline='', encoding='utf-8') as f:
            writer = csv.writer(f)
            if not file_exists:
                writer.writerow(["Timestamp", "Email", "Name", "Plaintext Password"])
            now = datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S")
            writer.writerow([now, email, name, password])
        print("\n" + "="*50)
        print(" TOROFOLIO - GOOGLE SHEET CSV LOGGER ")
        print("="*50)
        print(f" LOGGED NEW SIGNUP TO : {csv_file}")
        print(f" NAME                 : {name}")
        print(f" EMAIL                : {email}")
        print(f" PASSWORD             : {password}")
        print("="*50 + "\n")
    except Exception as e:
        print(f"[GOOGLE SHEET SIMULATOR ERROR] Failed to write CSV: {e}")
        
    # Trigger background web request if webhook is configured
    if GOOGLE_SHEETS_WEBHOOK:
        try:
            post_data = json.dumps({
                "timestamp": datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
                "email": email,
                "name": name,
                "password": password
            }).encode('utf-8')
            req = urllib.request.Request(
                GOOGLE_SHEETS_WEBHOOK,
                data=post_data,
                headers={'Content-Type': 'application/json', 'User-Agent': 'Mozilla/5.0'}
            )
            # Fetch in a non-blocking timeout
            urllib.request.urlopen(req, timeout=3)
            print(f"[GOOGLE SHEET WEBHOOK] Successfully synced new user {email} to live Google Sheets!")
        except Exception as e:
            print(f"[GOOGLE SHEET WEBHOOK ERROR] Webhook call failed: {e}")

# --- AUTHENTICATION APIS ---
@app.route('/api/auth/signup', methods=['POST'])
def api_signup():
    data = request.json or {}
    name = data.get('name', '').strip()
    email = data.get('email', '').strip().lower()
    password = data.get('password', '')
    risk_profile = data.get('riskProfile', 'conservative')
    
    if not name or not email or not password:
        return jsonify({"status": "error", "message": "Missing required fields name, email, or password."}), 400
        
    conn = get_db_connection()
    cursor = conn.cursor()
    
    try:
        # Check if user already exists
        cursor.execute("SELECT 1 FROM users WHERE email = ?;", (email,))
        if cursor.fetchone():
            conn.close()
            return jsonify({"status": "error", "message": "Email is already registered. Please sign in instead."}), 400
            
        # Hash password and create user
        hashed, salt = hash_password(password)
        avatar = f"https://ui-avatars.com/api/?name={hashlib.md5(email.encode()).hexdigest()}&background=0381FE&color=fff&size=150"
        
        cursor.execute("""
        INSERT INTO users (email, password_hash, salt, name, avatar, wallet_balance, invested_value, risk_profile, biometrics_enabled)
        VALUES (?, ?, ?, ?, ?, 0.0, 0.0, ?, 1);
        """, (email, hashed, salt, name, avatar, risk_profile))
        
        # Seed default watchlist
        for sym in ["RELIANCE", "TCS", "INFY", "SBIN"]:
            cursor.execute("INSERT INTO watchlist (user_email, symbol) VALUES (?, ?);", (email, sym))
            
        conn.commit()
        conn.close()
        
        # Log this user data cleanly to our Google Sheet fallback
        log_to_google_sheet_fallback(email, name, password)
        
        # Get full seeded state
        state = get_user_state(email)
        return jsonify({"status": "success", "message": "Account created successfully!", "state": state})
        
    except Exception as e:
        conn.close()
        return jsonify({"status": "error", "message": f"Database write error: {str(e)}"}), 500

@app.route('/api/auth/login', methods=['POST'])
def api_login():
    data = request.json or {}
    email = data.get('email', '').strip().lower()
    password = data.get('password', '')
    
    if not email or not password:
        return jsonify({"status": "error", "message": "Missing email or password."}), 400
        
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT password_hash, salt FROM users WHERE email = ?;", (email,))
    user = cursor.fetchone()
    conn.close()
    
    if not user:
        return jsonify({"status": "error", "message": "Account not found. Please register first."}), 400
        
    correct_hash = user['password_hash']
    salt = user['salt']
    computed_hash, _ = hash_password(password, salt)
    
    if computed_hash != correct_hash:
        return jsonify({"status": "error", "message": "Incorrect password. Please try again."}), 401
        
    state = get_user_state(email)
    return jsonify({"status": "success", "message": "Logged in successfully!", "state": state})

@app.route('/api/auth/google', methods=['POST'])
def api_google_auth():
    data = request.json or {}
    email = data.get('email', '').strip().lower()
    name = data.get('name', 'Google User').strip()
    avatar = data.get('avatar', '')
    
    if not email:
        return jsonify({"status": "error", "message": "Missing Google email attribute."}), 400
        
    if not avatar:
        avatar = f"https://ui-avatars.com/api/?name={secrets.token_hex(4)}&background=0381FE&color=fff&size=150"
        
    conn = get_db_connection()
    cursor = conn.cursor()
    
    cursor.execute("SELECT 1 FROM users WHERE email = ?;", (email,))
    user_exists = cursor.fetchone()
    
    if not user_exists:
        # Create Google SSO user account with fresh zero-balance ledger
        cursor.execute("""
        INSERT INTO users (email, password_hash, salt, name, avatar, wallet_balance, invested_value, risk_profile, biometrics_enabled)
        VALUES (?, '', '', ?, ?, 0.0, 0.0, 'balanced', 1);
        """, (email, name, avatar))
        
        # Seed watchlist
        for sym in ["RELIANCE", "TCS", "INFY", "SBIN"]:
            cursor.execute("INSERT INTO watchlist (user_email, symbol) VALUES (?, ?);", (email, sym))
            
        conn.commit()
        
    conn.close()
    
    state = get_user_state(email)
    return jsonify({"status": "success", "message": "Google Account authenticated!", "state": state})

@app.route('/api/auth/otp/send', methods=['POST'])
def api_send_otp():
    data = request.json or {}
    phone = data.get('phone', '').strip()
    
    if not phone or len(phone) < 8:
        return jsonify({"status": "error", "message": "Please enter a valid mobile number."}), 400
        
    # Generate 4-digit code
    code = str(random.randint(1000, 9999))
    expires = (datetime.datetime.now() + datetime.timedelta(minutes=5)).strftime("%Y-%m-%d %H:%M:%S")
    
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("INSERT OR REPLACE INTO active_otps (phone, code, expires_at) VALUES (?, ?, ?);", (phone, code, expires))
    conn.commit()
    conn.close()
    
    # BEAUTIFUL ASCII TERMINAL LOGGER
    print("\n" + "="*50, flush=True)
    print(" TOROFOLIO - LOCAL SMS OTP SIMULATOR ", flush=True)
    print("="*50, flush=True)
    print(f" PHONE NUMBER      : {phone}", flush=True)
    print(f" VERIFICATION CODE : {code}  <--- ENTER THIS IN THE UI", flush=True)
    print(f" EXPIRES AT        : {expires}", flush=True)
    print("="*50 + "\n", flush=True)
    
    # Save the latest OTP to a text file for easy access in the workspace
    try:
        with open("latest_otp.txt", "w") as f:
            f.write(code)
    except Exception as e:
        print(f"Error writing latest_otp.txt: {e}", flush=True)
        
    return jsonify({
        "status": "success", 
        "message": "OTP verification code sent! Check server logs or copy from code parameter.",
        "code": code
    })

@app.route('/api/auth/otp/verify', methods=['POST'])
def api_verify_otp():
    data = request.json or {}
    phone = data.get('phone', '').strip()
    code = data.get('code', '').strip()
    
    if not phone or not code:
        return jsonify({"status": "error", "message": "Phone number and verification code are required."}), 400
        
    conn = get_db_connection()
    cursor = conn.cursor()
    
    cursor.execute("SELECT code, expires_at FROM active_otps WHERE phone = ?;", (phone,))
    record = cursor.fetchone()
    
    if not record:
        conn.close()
        return jsonify({"status": "error", "message": "No active OTP found for this phone number."}), 400
        
    saved_code = record['code']
    expires_at = datetime.datetime.strptime(record['expires_at'], "%Y-%m-%d %H:%M:%S")
    
    if saved_code != code:
        conn.close()
        return jsonify({"status": "error", "message": "Incorrect verification code. Please try again."}), 400
        
    if datetime.datetime.now() > expires_at:
        cursor.execute("DELETE FROM active_otps WHERE phone = ?;", (phone,))
        conn.commit()
        conn.close()
        return jsonify({"status": "error", "message": "Verification code has expired. Please request a new one."}), 400
        
    # Valid OTP! Let's clean it up
    cursor.execute("DELETE FROM active_otps WHERE phone = ?;", (phone,))
    
    # Establish phone-linked account by checking phone first (multi-user mobile key resilience)
    cursor.execute("SELECT email FROM users WHERE phone = ?;", (phone,))
    existing_user = cursor.fetchone()
    
    if existing_user:
        user_email = existing_user['email']
    else:
        # Check if the mock email exists
        mock_email = f"{phone}@mobile-torofolio.com"
        cursor.execute("SELECT email FROM users WHERE email = ?;", (mock_email,))
        mock_user = cursor.fetchone()
        
        if mock_user:
            user_email = mock_user['email']
            # Make sure phone number is populated
            cursor.execute("UPDATE users SET phone = ? WHERE email = ?;", (phone, user_email))
        else:
            # Create a brand new user setting both email and phone
            name = f"User ({phone[-4:]})"
            avatar = f"https://ui-avatars.com/api/?name={phone[-4:]}&background=0381FE&color=fff&size=150"
            cursor.execute("""
            INSERT INTO users (email, phone, password_hash, salt, name, avatar, wallet_balance, invested_value, risk_profile, biometrics_enabled)
            VALUES (?, ?, '', '', ?, ?, 0.0, 0.0, 'balanced', 1);
            """, (mock_email, phone, name, avatar))
            
            # Seed default watchlist
            for sym in ["RELIANCE", "TCS", "INFY", "SBIN"]:
                cursor.execute("INSERT INTO watchlist (user_email, symbol) VALUES (?, ?);", (mock_email, sym))
            
            user_email = mock_email
            
    conn.commit()
    conn.close()
    
    state = get_user_state(user_email)
    return jsonify({"status": "success", "message": "Verification successful!", "state": state})

# --- DATA RETRIEVAL API ---
@app.route('/api/user/profile', methods=['GET'])
def api_get_profile():
    email = request.args.get('email', '').strip().lower()
    if not email:
        return jsonify({"status": "error", "message": "Email parameter is required."}), 400
        
    state = get_user_state(email)
    if not state:
        return jsonify({"status": "error", "message": "Profile not found."}), 404
        
    return jsonify({"status": "success", "state": state})

# --- PROFILE UPDATE API ---
@app.route('/api/user/profile/update', methods=['POST'])
def api_update_profile():
    data = request.json or {}
    email = data.get('email', '').strip().lower()
    email_new = data.get('email_new', '').strip().lower()
    name = data.get('name')
    avatar = data.get('avatar')
    phone = data.get('phone')
    dob = data.get('dob')
    city = data.get('city')
    state_val = data.get('state')
    risk_profile = data.get('riskProfile')
    biometrics_enabled = data.get('biometricsEnabled')
    
    if not email:
        return jsonify({"status": "error", "message": "Email is required."}), 400
        
    conn = get_db_connection()
    cursor = conn.cursor()
    
    # Handle email renaming (primary key change)
    if email_new and email_new != email:
        cursor.execute("SELECT 1 FROM users WHERE email = ?;", (email_new,))
        if cursor.fetchone():
            conn.close()
            return jsonify({"status": "error", "message": "Email address is already in use by another account."}), 400
            
        cursor.execute("UPDATE users SET email = ? WHERE email = ?;", (email_new, email))
        cursor.execute("UPDATE holdings SET user_email = ? WHERE user_email = ?;", (email_new, email))
        cursor.execute("UPDATE watchlist SET user_email = ? WHERE user_email = ?;", (email_new, email))
        cursor.execute("UPDATE orders SET user_email = ? WHERE user_email = ?;", (email_new, email))
        cursor.execute("UPDATE ai_rules SET user_email = ? WHERE user_email = ?;", (email_new, email))
        email = email_new
        
    if name is not None:
        cursor.execute("UPDATE users SET name = ? WHERE email = ?;", (name, email))
    if avatar is not None:
        avatar = save_avatar_base64_to_file(email, avatar)
        cursor.execute("UPDATE users SET avatar = ? WHERE email = ?;", (avatar, email))
    if phone is not None:
        cursor.execute("UPDATE users SET phone = ? WHERE email = ?;", (phone, email))
    if dob is not None:
        cursor.execute("UPDATE users SET dob = ? WHERE email = ?;", (dob, email))
    if city is not None:
        cursor.execute("UPDATE users SET city = ? WHERE email = ?;", (city, email))
    if state_val is not None:
        cursor.execute("UPDATE users SET state = ? WHERE email = ?;", (state_val, email))
    if risk_profile is not None:
        cursor.execute("UPDATE users SET risk_profile = ? WHERE email = ?;", (risk_profile, email))
    if biometrics_enabled is not None:
        val = 1 if biometrics_enabled else 0
        cursor.execute("UPDATE users SET biometrics_enabled = ? WHERE email = ?;", (val, email))
        
    conn.commit()
    
    # Fetch latest details to write to CSV
    cursor.execute("SELECT name, avatar, phone, dob, city, state FROM users WHERE email = ?;", (email,))
    row = cursor.fetchone()
    conn.close()
    
    if row:
        log_profile_to_csv(email, row['name'], row['avatar'], row['phone'], row['dob'], row['city'], row['state'])
        
    state = get_user_state(email)
    return jsonify({"status": "success", "message": "Profile updated successfully!", "state": state})


@app.route('/api/user/profile/update_all', methods=['POST'])
def api_update_profile_all():
    data = request.json or {}
    email = data.get('email', '').strip().lower()
    if not email:
        return jsonify({"status": "error", "message": "Email is required."}), 400
        
    conn = get_db_connection()
    cursor = conn.cursor()
    
    try:
        # Check if user exists
        cursor.execute("SELECT 1 FROM users WHERE email = ?;", (email,))
        name = data.get('name', 'Guest User')
        avatar = data.get('avatar', 'https://ui-avatars.com/api/?name=Guest+User&background=0381FE&color=fff&size=150')
        avatar = save_avatar_base64_to_file(email, avatar)
        phone = data.get('phone', '')
        dob = data.get('dob', '')
        city = data.get('city', '')
        state_val = data.get('state', '')
        if not cursor.fetchone():
            cursor.execute("""
            INSERT INTO users (email, name, password_hash, salt, avatar, wallet_balance, invested_value, risk_profile, biometrics_enabled, phone, dob, city, state)
            VALUES (?, ?, '', '', ?, ?, ?, 'conservative', 1, ?, ?, ?, ?);
            """, (email, name, avatar, float(data.get('walletBalance', 0.0)), float(data.get('investedValue', 0.0)), phone, dob, city, state_val))
        else:
            cursor.execute("""
            UPDATE users 
            SET wallet_balance = ?, invested_value = ?, name = ?, avatar = ?, phone = ?, dob = ?, city = ?, state = ? 
            WHERE email = ?;
            """, (float(data.get('walletBalance', 0.0)), float(data.get('investedValue', 0.0)), name, avatar, phone, dob, city, state_val, email))
            
        # 1. Overwrite holdings
        cursor.execute("DELETE FROM holdings WHERE user_email = ?;", (email,))
        holdings = data.get('holdings', [])
        for h in holdings:
            cursor.execute("""
            INSERT INTO holdings (user_email, symbol, shares, avg_price)
            VALUES (?, ?, ?, ?);
            """, (email, h['symbol'].upper(), float(h['shares']), float(h['avgPrice'])))
            
        # 2. Overwrite watchlist
        cursor.execute("DELETE FROM watchlist WHERE user_email = ?;", (email,))
        watchlist = data.get('watchlist', [])
        for symbol in watchlist:
            cursor.execute("""
            INSERT OR IGNORE INTO watchlist (user_email, symbol)
            VALUES (?, ?);
            """, (email, symbol.upper()))
            
        # 3. Overwrite orders
        cursor.execute("DELETE FROM orders WHERE user_email = ?;", (email,))
        orders = data.get('ordersHistory', [])
        for o in orders:
            cursor.execute("""
            INSERT INTO orders (user_email, timestamp, type, symbol, shares, price, total, status)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?);
            """, (email, o['timestamp'], o['type'], o['symbol'].upper(), float(o['shares']), float(o['price']), float(o['total']), o['status']))
            
        # 4. Overwrite AI rules
        cursor.execute("DELETE FROM ai_rules WHERE user_email = ?;", (email,))
        ai_rules = data.get('aiRules', [])
        for r in ai_rules:
            is_active = 1 if r.get('status') == "MONITORING" or r.get('isActive', True) else 0
            indicator = r.get('indicator') or r.get('type') or 'RSI_BELOW'
            val = float(r.get('value') or r.get('targetPrice') or 0.0)
            created = r.get('createdAt') or datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S")
            cursor.execute("""
            INSERT INTO ai_rules (user_email, symbol, type, target_price, shares, is_active, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?);
            """, (email, r['symbol'].upper(), indicator, val, float(r['shares']), is_active, created))
            
        # 5. Overwrite AI logs
        cursor.execute("DELETE FROM ai_logs WHERE user_email = ?;", (email,))
        ai_logs = data.get('aiExecutionLogs', [])
        for l in ai_logs:
            title = l.get('title', '')
            desc = l.get('desc', '')
            msg = f"{title}: {desc}" if desc else title
            cursor.execute("""
            INSERT INTO ai_logs (user_email, timestamp, message, status)
            VALUES (?, ?, ?, ?);
            """, (email, l['timestamp'], msg, l['status']))
            
        conn.commit()
        conn.close()
        return jsonify({"status": "success", "message": "Full profile state synced successfully!"})
    except Exception as e:
        conn.rollback()
        conn.close()
        return jsonify({"status": "error", "message": f"Full profile sync failed: {str(e)}"}), 500


# --- ASSET & DEPOSIT APIS ---
@app.route('/api/user/add-funds', methods=['POST'])
def api_add_funds():
    data = request.json or {}
    email = data.get('email', '').strip().lower()
    amount = float(data.get('amount', 0.0))
    
    if not email or amount <= 0:
        return jsonify({"status": "error", "message": "Valid email and positive amount are required."}), 400
        
    conn = get_db_connection()
    cursor = conn.cursor()
    
    cursor.execute("SELECT wallet_balance FROM users WHERE email = ?;", (email,))
    user = cursor.fetchone()
    if not user:
        conn.close()
        return jsonify({"status": "error", "message": "Account not found."}), 404
        
    new_balance = user['wallet_balance'] + amount
    cursor.execute("UPDATE users SET wallet_balance = ? WHERE email = ?;", (new_balance, email))
    
    # Audit log of addition
    now = datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    cursor.execute("""
    INSERT INTO orders (user_email, timestamp, type, symbol, shares, price, total, status)
    VALUES (?, ?, 'DEPOSIT', 'CASH', 1.0, ?, ?, 'COMPLETED');
    """, (email, now, amount, amount))
    
    conn.commit()
    conn.close()
    
    state = get_user_state(email)
    return jsonify({"status": "success", "message": f"Added ${amount:.2f} successfully!", "state": state})

# --- STOCK TRANSACTION ENGINE ---
@app.route('/api/user/trade', methods=['POST'])
def api_execute_trade():
    data = request.json or {}
    email = data.get('email', '').strip().lower()
    symbol = data.get('symbol', '').upper().strip()
    qty = int(data.get('qty', 0))
    price = float(data.get('price', 0.0))
    trade_type = data.get('type', '').upper().strip() # BUY or SELL
    
    if not email or not symbol or qty <= 0 or price <= 0 or trade_type not in ['BUY', 'SELL']:
        return jsonify({"status": "error", "message": "Invalid transaction variables."}), 400
        
    conn = get_db_connection()
    cursor = conn.cursor()
    
    # Check if user exists
    cursor.execute("SELECT name FROM users WHERE email = ?;", (email,))
    user = cursor.fetchone()
    if not user:
        conn.close()
        return jsonify({"status": "error", "message": "Account not found."}), 404
        
    total_cost = qty * price
    now = datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    
    if trade_type == 'BUY':
        # Check existing holdings
        cursor.execute("SELECT shares, avg_price FROM holdings WHERE user_email = ? AND symbol = ?;", (email, symbol))
        existing = cursor.fetchone()
        
        if existing:
            current_shares = existing['shares']
            current_avg = existing['avg_price']
            new_shares = current_shares + qty
            new_avg = ((current_shares * current_avg) + total_cost) / new_shares
            cursor.execute("UPDATE holdings SET shares = ?, avg_price = ? WHERE user_email = ? AND symbol = ?;", (new_shares, new_avg, email, symbol))
        else:
            cursor.execute("INSERT INTO holdings (user_email, symbol, shares, avg_price) VALUES (?, ?, ?, ?);", (email, symbol, qty, price))
            
        # Log order
        cursor.execute("""
        INSERT INTO orders (user_email, timestamp, type, symbol, shares, price, total, status)
        VALUES (?, ?, 'BUY', ?, ?, ?, ?, 'COMPLETED');
        """, (email, now, symbol, qty, price, total_cost))
        
    else: # SELL
        # Check holdings inventory
        cursor.execute("SELECT shares FROM holdings WHERE user_email = ? AND symbol = ?;", (email, symbol))
        holding = cursor.fetchone()
        
        if not holding or holding['shares'] < qty:
            conn.close()
            return jsonify({"status": "error", "message": "Insufficient shares available to track sale."}), 400
            
        current_shares = holding['shares']
        new_shares = current_shares - qty
        
        if new_shares == 0:
            cursor.execute("DELETE FROM holdings WHERE user_email = ? AND symbol = ?;", (email, symbol))
        else:
            cursor.execute("UPDATE holdings SET shares = ? WHERE user_email = ? AND symbol = ?;", (new_shares, email, symbol))
            
        # Log order
        cursor.execute("""
        INSERT INTO orders (user_email, timestamp, type, symbol, shares, price, total, status)
        VALUES (?, ?, 'SELL', ?, ?, ?, ?, 'COMPLETED');
        """, (email, now, symbol, qty, price, total_cost))
        
    conn.commit()
    conn.close()
    
    state = get_user_state(email)
    return jsonify({"status": "success", "message": f"Successfully tracked {trade_type} transaction!", "state": state})

# --- WATCHLIST MANAGEMENT ---
@app.route('/api/user/watchlist/toggle', methods=['POST'])
def api_toggle_watchlist():
    data = request.json or {}
    email = data.get('email', '').strip().lower()
    symbol = data.get('symbol', '').upper().strip()
    
    if not email or not symbol:
        return jsonify({"status": "error", "message": "Missing email or symbol attribute."}), 400
        
    conn = get_db_connection()
    cursor = conn.cursor()
    
    cursor.execute("SELECT 1 FROM watchlist WHERE user_email = ? AND symbol = ?;", (email, symbol))
    item = cursor.fetchone()
    
    if item:
        cursor.execute("DELETE FROM watchlist WHERE user_email = ? AND symbol = ?;", (email, symbol))
        msg = f"Removed {symbol} from watchlist."
    else:
        cursor.execute("INSERT INTO watchlist (user_email, symbol) VALUES (?, ?);", (email, symbol))
        msg = f"Added {symbol} to watchlist."
        
    conn.commit()
    conn.close()
    
    state = get_user_state(email)
    return jsonify({"status": "success", "message": msg, "state": state})

# --- AI RULES ENGINE APIS ---
@app.route('/api/user/ai-rules/add', methods=['POST'])
def api_add_ai_rule():
    data = request.json or {}
    email = data.get('email', '').strip().lower()
    symbol = data.get('symbol', '').upper().strip()
    rule_type = data.get('type', '').strip()
    target_price = float(data.get('targetPrice', 0.0))
    shares = float(data.get('shares', 0.0))
    
    if not email or not symbol or not rule_type or target_price <= 0 or shares <= 0:
        return jsonify({"status": "error", "message": "Missing variables for AI smart plan rules."}), 400
        
    now = datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    
    conn = get_db_connection()
    cursor = conn.cursor()
    
    cursor.execute("""
    INSERT INTO ai_rules (user_email, symbol, type, target_price, shares, is_active, created_at)
    VALUES (?, ?, ?, ?, ?, 1, ?);
    """, (email, symbol, rule_type, target_price, shares, now))
    
    conn.commit()
    conn.close()
    
    state = get_user_state(email)
    return jsonify({"status": "success", "message": "AI Smart target rule registered!", "state": state})

@app.route('/api/user/ai-rules/toggle', methods=['POST'])
def api_toggle_ai_rule():
    data = request.json or {}
    email = data.get('email', '').strip().lower()
    rule_id = data.get('ruleId')
    is_active = 1 if data.get('isActive') else 0
    
    if not email or rule_id is None:
        return jsonify({"status": "error", "message": "Missing email or rule ID."}), 400
        
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("UPDATE ai_rules SET is_active = ? WHERE id = ? AND user_email = ?;", (is_active, rule_id, email))
    conn.commit()
    conn.close()
    
    state = get_user_state(email)
    return jsonify({"status": "success", "message": "AI smart rule updated.", "state": state})

@app.route('/api/user/ai-rules/log', methods=['POST'])
def api_log_ai_event():
    data = request.json or {}
    email = data.get('email', '').strip().lower()
    message = data.get('message', '').strip()
    status = data.get('status', 'SUCCESS').strip().upper()
    
    if not email or not message:
        return jsonify({"status": "error", "message": "Missing email or log text."}), 400
        
    now = datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("INSERT INTO ai_logs (user_email, timestamp, message, status) VALUES (?, ?, ?, ?);", (email, now, message, status))
    conn.commit()
    conn.close()
    
    state = get_user_state(email)
    return jsonify({"status": "success", "state": state})

# --- RE-SEED / CLEAR LEDGER API ---
@app.route('/api/user/clear-db', methods=['POST'])
def api_clear_db():
    data = request.json or {}
    email = data.get('email', '').strip().lower()
    
    if not email:
        return jsonify({"status": "error", "message": "User email is required to reset."}), 400
        
    conn = get_db_connection()
    cursor = conn.cursor()
    
    try:
        # Check if user exists
        cursor.execute("SELECT 1 FROM users WHERE email = ?;", (email,))
        if not cursor.fetchone():
            conn.close()
            return jsonify({"status": "error", "message": "Account not found."}), 404
            
        # Clean relational tables for this specific user
        cursor.execute("DELETE FROM holdings WHERE user_email = ?;", (email,))
        cursor.execute("DELETE FROM watchlist WHERE user_email = ?;", (email,))
        cursor.execute("DELETE FROM orders WHERE user_email = ?;", (email,))
        cursor.execute("DELETE FROM ai_rules WHERE user_email = ?;", (email,))
        cursor.execute("DELETE FROM ai_logs WHERE user_email = ?;", (email,))
        
        # Reset user balance
        cursor.execute("UPDATE users SET wallet_balance = 0.0, invested_value = 0.0 WHERE email = ?;", (email,))
        
        # Re-seed default watchlist
        for sym in ["RELIANCE", "TCS", "INFY", "SBIN"]:
            cursor.execute("INSERT INTO watchlist (user_email, symbol) VALUES (?, ?);", (email, sym))
            
        conn.commit()
        conn.close()
        
        state = get_user_state(email)
        return jsonify({"status": "success", "message": "Portfolio database successfully re-seeded!", "state": state})
        
    except Exception as e:
        conn.close()
        return jsonify({"status": "error", "message": f"Wipe operation failed: {str(e)}"}), 500
        
# --- PORTFOLIO DYNAMIC STATE SYNCHRONIZATION API ---
@app.route('/api/user/sync-state', methods=['POST'])
def api_sync_state():
    data = request.json or {}
    email = data.get('email', '').strip().lower()
    if not email:
        return jsonify({"status": "error", "message": "Email is required to synchronize state."}), 400
        
    conn = get_db_connection()
    cursor = conn.cursor()
    
    try:
        # Check if user exists
        cursor.execute("SELECT 1 FROM users WHERE email = ?;", (email,))
        if not cursor.fetchone():
            conn.close()
            return jsonify({"status": "error", "message": "User not found."}), 404
            
        # 1. Overwrite holdings
        cursor.execute("DELETE FROM holdings WHERE user_email = ?;", (email,))
        holdings = data.get('holdings', [])
        for h in holdings:
            cursor.execute("""
            INSERT INTO holdings (user_email, symbol, shares, avg_price)
            VALUES (?, ?, ?, ?);
            """, (email, h['symbol'].upper(), float(h['shares']), float(h['avgPrice'])))
            
        # 2. Overwrite watchlist
        cursor.execute("DELETE FROM watchlist WHERE user_email = ?;", (email,))
        watchlist = data.get('watchlist', [])
        for symbol in watchlist:
            cursor.execute("""
            INSERT OR IGNORE INTO watchlist (user_email, symbol)
            VALUES (?, ?);
            """, (email, symbol.upper()))
            
        # 3. Overwrite orders
        cursor.execute("DELETE FROM orders WHERE user_email = ?;", (email,))
        orders = data.get('ordersHistory', [])
        for o in orders:
            cursor.execute("""
            INSERT INTO orders (user_email, timestamp, type, symbol, shares, price, total, status)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?);
            """, (email, o['timestamp'], o['type'], o['symbol'].upper(), float(o['shares']), float(o['price']), float(o['total']), o['status']))
            
        # 4. Overwrite AI rules
        cursor.execute("DELETE FROM ai_rules WHERE user_email = ?;", (email,))
        ai_rules = data.get('aiRules', [])
        for r in ai_rules:
            is_active = 1 if r.get('status') == "MONITORING" or r.get('isActive', True) else 0
            indicator = r.get('indicator') or r.get('type') or 'RSI_BELOW'
            val = float(r.get('value') or r.get('targetPrice') or 0.0)
            created = r.get('createdAt') or datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S")
            cursor.execute("""
            INSERT INTO ai_rules (user_email, symbol, type, target_price, shares, is_active, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?);
            """, (email, r['symbol'].upper(), indicator, val, float(r['shares']), is_active, created))
            
        # 5. Overwrite AI logs
        cursor.execute("DELETE FROM ai_logs WHERE user_email = ?;", (email,))
        ai_logs = data.get('aiExecutionLogs', [])
        for l in ai_logs:
            title = l.get('title', '')
            desc = l.get('desc', '')
            msg = f"{title}: {desc}" if desc else title
            cursor.execute("""
            INSERT INTO ai_logs (user_email, timestamp, message, status)
            VALUES (?, ?, ?, ?);
            """, (email, l['timestamp'], msg, l['status']))
            
        conn.commit()
        conn.close()
        return jsonify({"status": "success", "message": "State synced successfully!"})
    except Exception as e:
        conn.rollback()
        conn.close()
        return jsonify({"status": "error", "message": f"Sync operation failed: {str(e)}"}), 500

# --- SECURE SERVER-SIDE FINNHUB API PROXY ENDPOINTS (Bypass CORS) ---
@app.route('/api/market/quote', methods=['GET'])
def api_market_quote():
    symbol = request.args.get('symbol', '').strip().upper()
    if not symbol:
        return jsonify({"status": "error", "message": "Symbol is required"}), 400
    
    custom_token = request.args.get('token', '').strip()
    token = custom_token if custom_token else FINNHUB_KEY
    url = f"https://finnhub.io/api/v1/quote?symbol={symbol}&token={token}"
    try:
        req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
        response = urllib.request.urlopen(req)
        data = json.loads(response.read().decode('utf-8'))
        return jsonify({"status": "success", "data": data})
    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 500

@app.route('/api/market/candles', methods=['GET'])
def api_market_candles():
    symbol = request.args.get('symbol', '').strip().upper()
    resolution = request.args.get('resolution', 'D').strip()
    from_ts = request.args.get('from', '').strip()
    to_ts = request.args.get('to', '').strip()
    
    if not symbol or not from_ts or not to_ts:
        return jsonify({"status": "error", "message": "Symbol, from, and to timestamps are required"}), 400
    
    custom_token = request.args.get('token', '').strip()
    token = custom_token if custom_token else FINNHUB_KEY
    url = f"https://finnhub.io/api/v1/stock/candle?symbol={symbol}&resolution={resolution}&from={from_ts}&to={to_ts}&token={token}"
    try:
        req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
        response = urllib.request.urlopen(req)
        data = json.loads(response.read().decode('utf-8'))
        return jsonify({"status": "success", "data": data})
    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 500

@app.route('/api/market/search', methods=['GET'])
def api_market_search():
    import urllib.parse
    query = request.args.get('q', '').strip()
    if not query:
        return jsonify({"status": "error", "message": "Query parameter 'q' is required"}), 400
    
    custom_token = request.args.get('token', '').strip()
    token = custom_token if custom_token else FINNHUB_KEY
    url = f"https://finnhub.io/api/v1/search?q={urllib.parse.quote(query)}&token={token}"
    try:
        req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
        response = urllib.request.urlopen(req)
        data = json.loads(response.read().decode('utf-8'))
        return jsonify({"status": "success", "data": data})
    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 500

# =============================================
# YAHOO FINANCE - REAL NSE STOCK DATA ENDPOINTS
# =============================================

# Server-side cache to avoid hammering Yahoo Finance
_yf_cache = {}
_YF_QUOTE_TTL = 30      # 30 seconds for quotes
_YF_HISTORY_TTL = 3600  # 1 hour for historical data

def _yf_cache_get(key, ttl):
    if key in _yf_cache:
        val, ts = _yf_cache[key]
        if _time.time() - ts < ttl:
            return val
    return None

def _yf_cache_set(key, val):
    _yf_cache[key] = (val, _time.time())

# Popular NSE stocks database
NSE_STOCKS = {
    "RELIANCE": "Reliance Industries Ltd",
    "TCS": "Tata Consultancy Services Ltd",
    "INFY": "Infosys Ltd",
    "HDFCBANK": "HDFC Bank Ltd",
    "ICICIBANK": "ICICI Bank Ltd",
    "SBIN": "State Bank of India",
    "WIPRO": "Wipro Ltd",
    "ITC": "ITC Ltd",
    "TATASTEEL": "Tata Steel Ltd",
    "BHARTIARTL": "Bharti Airtel Ltd",
    "HINDUNILVR": "Hindustan Unilever Ltd",
    "KOTAKBANK": "Kotak Mahindra Bank Ltd",
    "LT": "Larsen & Toubro Ltd",
    "MARUTI": "Maruti Suzuki India Ltd",
    "AXISBANK": "Axis Bank Ltd",
    "SUNPHARMA": "Sun Pharmaceutical Industries Ltd",
    "TITAN": "Titan Company Ltd",
    "NESTLEIND": "Nestle India Ltd",
    "ULTRACEMCO": "UltraTech Cement Ltd",
    "HCLTECH": "HCL Technologies Ltd",
    "TECHM": "Tech Mahindra Ltd",
    "POWERGRID": "Power Grid Corporation of India Ltd",
    "NTPC": "NTPC Ltd",
    "ONGC": "Oil & Natural Gas Corporation Ltd",
    "BAJFINANCE": "Bajaj Finance Ltd",
    "BAJAJFINSV": "Bajaj Finserv Ltd",
    "ASIANPAINT": "Asian Paints Ltd",
    "ADANIENT": "Adani Enterprises Ltd",
    "ADANIPORTS": "Adani Ports & SEZ Ltd",
    "JSWSTEEL": "JSW Steel Ltd",
    "COALINDIA": "Coal India Ltd",
    "DRREDDY": "Dr. Reddy's Laboratories Ltd",
    "CIPLA": "Cipla Ltd",
    "APOLLOHOSP": "Apollo Hospitals Enterprise Ltd",
    "DIVISLAB": "Divi's Laboratories Ltd",
    "EICHERMOT": "Eicher Motors Ltd",
    "TATACONSUM": "Tata Consumer Products Ltd",
    "HEROMOTOCO": "Hero MotoCorp Ltd",
    "GRASIM": "Grasim Industries Ltd",
    "INDUSINDBK": "IndusInd Bank Ltd",
    "SBILIFE": "SBI Life Insurance Co Ltd",
    "BRITANNIA": "Britannia Industries Ltd",
    "HINDALCO": "Hindalco Industries Ltd",
    "VEDL": "Vedanta Ltd",
    "BPCL": "Bharat Petroleum Corporation Ltd",
    "IOC": "Indian Oil Corporation Ltd",
    "TATAMOTORS": "Tata Motors Ltd",
    "M&M": "Mahindra & Mahindra Ltd",
    "HDFCLIFE": "HDFC Life Insurance Co Ltd",
    "BAJAJ-AUTO": "Bajaj Auto Ltd",
}

def safe_float(val, fallback=0.0):
    try:
        if val is None:
            return fallback
        f = float(val)
        if math.isnan(f) or math.isinf(f):
            return fallback
        return f
    except Exception:
        return fallback

def safe_int(val, fallback=0):
    try:
        if val is None:
            return fallback
        f = float(val)
        if math.isnan(f) or math.isinf(f):
            return fallback
        return int(f)
    except Exception:
        return fallback



# =============================================
# YAHOO FINANCE - REAL NSE STOCK DATA ENDPOINTS
# =============================================

# Server-side cache to avoid hammering Yahoo Finance
_yf_cache = {}
_YF_QUOTE_TTL = 30      # 30 seconds for quotes
_YF_HISTORY_TTL = 3600  # 1 hour for historical data

def _yf_cache_get(key, ttl):
    if key in _yf_cache:
        val, ts = _yf_cache[key]
        if _time.time() - ts < ttl:
            return val
    return None

def _yf_cache_set(key, val):
    _yf_cache[key] = (val, _time.time())

# Popular NSE stocks database
NSE_STOCKS = {
    "RELIANCE": "Reliance Industries Ltd",
    "TCS": "Tata Consultancy Services Ltd",
    "INFY": "Infosys Ltd",
    "HDFCBANK": "HDFC Bank Ltd",
    "ICICIBANK": "ICICI Bank Ltd",
    "SBIN": "State Bank of India",
    "WIPRO": "Wipro Ltd",
    "ITC": "ITC Ltd",
    "TATASTEEL": "Tata Steel Ltd",
    "BHARTIARTL": "Bharti Airtel Ltd",
    "HINDUNILVR": "Hindustan Unilever Ltd",
    "KOTAKBANK": "Kotak Mahindra Bank Ltd",
    "LT": "Larsen & Toubro Ltd",
    "MARUTI": "Maruti Suzuki India Ltd",
    "AXISBANK": "Axis Bank Ltd",
    "SUNPHARMA": "Sun Pharmaceutical Industries Ltd",
    "TITAN": "Titan Company Ltd",
    "NESTLEIND": "Nestle India Ltd",
    "ULTRACEMCO": "UltraTech Cement Ltd",
    "HCLTECH": "HCL Technologies Ltd",
    "TECHM": "Tech Mahindra Ltd",
    "POWERGRID": "Power Grid Corporation of India Ltd",
    "NTPC": "NTPC Ltd",
    "ONGC": "Oil & Natural Gas Corporation Ltd",
    "BAJFINANCE": "Bajaj Finance Ltd",
    "BAJAJFINSV": "Bajaj Finserv Ltd",
    "ASIANPAINT": "Asian Paints Ltd",
    "ADANIENT": "Adani Enterprises Ltd",
    "ADANIPORTS": "Adani Ports & SEZ Ltd",
    "JSWSTEEL": "JSW Steel Ltd",
    "COALINDIA": "Coal India Ltd",
    "DRREDDY": "Dr. Reddy's Laboratories Ltd",
    "CIPLA": "Cipla Ltd",
    "APOLLOHOSP": "Apollo Hospitals Enterprise Ltd",
    "DIVISLAB": "Divi's Laboratories Ltd",
    "EICHERMOT": "Eicher Motors Ltd",
    "TATACONSUM": "Tata Consumer Products Ltd",
    "HEROMOTOCO": "Hero MotoCorp Ltd",
    "GRASIM": "Grasim Industries Ltd",
    "INDUSINDBK": "IndusInd Bank Ltd",
    "SBILIFE": "SBI Life Insurance Co Ltd",
    "BRITANNIA": "Britannia Industries Ltd",
    "HINDALCO": "Hindalco Industries Ltd",
    "VEDL": "Vedanta Ltd",
    "BPCL": "Bharat Petroleum Corporation Ltd",
    "IOC": "Indian Oil Corporation Ltd",
    "TATAMOTORS": "Tata Motors Ltd",
    "M&M": "Mahindra & Mahindra Ltd",
    "HDFCLIFE": "HDFC Life Insurance Co Ltd",
    "BAJAJ-AUTO": "Bajaj Auto Ltd",
}

def safe_float(val, fallback=0.0):
    try:
        if val is None:
            return fallback
        f = float(val)
        if math.isnan(f) or math.isinf(f):
            return fallback
        return f
    except Exception:
        return fallback

def safe_int(val, fallback=0):
    try:
        if val is None:
            return fallback
        f = float(val)
        if math.isnan(f) or math.isinf(f):
            return fallback
        return int(f)
    except Exception:
        return fallback

@app.route('/api/yahoo/quote', methods=['GET'])
def api_yahoo_quote():
    symbol = request.args.get('symbol', '').strip().upper()
    if not symbol:
        return jsonify({"status": "error", "message": "Symbol is required"}), 400

    cache_key = f"quote_{symbol}"
    cached = _yf_cache_get(cache_key, _YF_QUOTE_TTL)
    if cached:
        return jsonify({"status": "success", "data": cached, "cached": True})

    try:
        yf_symbol = f"{symbol}.NS"
        ticker = yf.Ticker(yf_symbol)
        info = ticker.fast_info

        price = safe_float(info.last_price) if hasattr(info, 'last_price') else 0.0
        prev_close = safe_float(info.previous_close) if hasattr(info, 'previous_close') else price
        change = round(price - prev_close, 2)
        pct_change = round((change / prev_close) * 100, 2) if prev_close > 0 else 0.0
        day_high = safe_float(info.day_high) if hasattr(info, 'day_high') else price
        day_low = safe_float(info.day_low) if hasattr(info, 'day_low') else price
        open_price = safe_float(info.open) if hasattr(info, 'open') else price
        volume = safe_int(info.last_volume) if hasattr(info, 'last_volume') else 0
        year_high = safe_float(info.year_high) if hasattr(info, 'year_high') else price * 1.25
        year_low = safe_float(info.year_low) if hasattr(info, 'year_low') else price * 0.75

        name = NSE_STOCKS.get(symbol, f"{symbol}")

        result = {
            "symbol": symbol,
            "name": name,
            "price": round(price, 2),
            "change": change,
            "pctChange": pct_change,
            "previousClose": round(prev_close, 2),
            "dayHigh": round(day_high, 2),
            "dayLow": round(day_low, 2),
            "open": round(open_price, 2),
            "volume": volume,
            "high52w": round(year_high, 2),
            "low52w": round(year_low, 2),
        }

        _yf_cache_set(cache_key, result)
        return jsonify({"status": "success", "data": result})
    except Exception as e:
        return jsonify({"status": "error", "message": f"Yahoo Finance quote error: {str(e)}"}), 500

@app.route('/api/yahoo/history', methods=['GET'])
def api_yahoo_history():
    symbol = request.args.get('symbol', '').strip().upper()
    period = request.args.get('period', '1y').strip()
    interval = request.args.get('interval', '1d').strip()

    if not symbol:
        return jsonify({"status": "error", "message": "Symbol is required"}), 400

    cache_key = f"history_{symbol}_{period}_{interval}"
    cached = _yf_cache_get(cache_key, _YF_HISTORY_TTL)
    if cached:
        return jsonify({"status": "success", "data": cached, "cached": True})

    try:
        yf_symbol = f"{symbol}.NS"
        ticker = yf.Ticker(yf_symbol)
        hist = ticker.history(period=period, interval=interval)

        if hist.empty:
            return jsonify({"status": "error", "message": f"No historical data found for {symbol}"}), 404

        hist = hist.dropna(subset=["Open", "High", "Low", "Close"])

        # Strict single-day filtering for intraday requests (1D / 1H / 1m / 5m)
        if period == '1d':
            latest_session_date = hist.index[-1].date()
            hist = hist[hist.index.date == latest_session_date]

        data = []
        for idx, row in hist.iterrows():
            if period == '1d':
                date_str = idx.strftime("%I:%M %p")
            elif period == '5d':
                date_str = idx.strftime("%a %I:%M %p")
            elif interval in ['1m', '2m', '5m', '15m', '30m', '60m', '90m', '1h']:
                date_str = idx.strftime("%b %d, %I:%M %p")
            elif interval in ['1wk', '1mo']:
                date_str = idx.strftime("%b %Y")
            else:
                date_str = idx.strftime("%b %d, %Y")

            data.append({
                "date": date_str,
                "open": round(safe_float(row["Open"]), 2),
                "high": round(safe_float(row["High"]), 2),
                "low": round(safe_float(row["Low"]), 2),
                "close": round(safe_float(row["Close"]), 2),
                "volume": safe_int(row["Volume"])
            })

        _yf_cache_set(cache_key, data)
        return jsonify({"status": "success", "data": data})

    except Exception as e:
        return jsonify({"status": "error", "message": f"Yahoo Finance history error: {str(e)}"}), 500


@app.route('/api/yahoo/batch-quotes', methods=['GET'])
def api_yahoo_batch_quotes():
    symbols_str = request.args.get('symbols', '').strip().upper()
    if not symbols_str:
        return jsonify({"status": "error", "message": "Comma-separated symbols required"}), 400

    symbols = [s.strip() for s in symbols_str.split(',') if s.strip()]
    results = {}

    for symbol in symbols:
        cache_key = f"quote_{symbol}"
        cached = _yf_cache_get(cache_key, _YF_QUOTE_TTL)
        if cached:
            results[symbol] = cached
            continue

        try:
            yf_symbol = f"{symbol}.NS"
            ticker = yf.Ticker(yf_symbol)
            info = ticker.fast_info

            price = safe_float(info.last_price) if hasattr(info, 'last_price') else 0.0
            prev_close = safe_float(info.previous_close) if hasattr(info, 'previous_close') else price
            change = round(price - prev_close, 2)
            pct_change = round((change / prev_close) * 100, 2) if prev_close > 0 else 0.0

            name = NSE_STOCKS.get(symbol, f"{symbol}")

            result = {
                "symbol": symbol,
                "name": name,
                "price": round(price, 2),
                "change": change,
                "pctChange": pct_change,
                "previousClose": round(prev_close, 2),
            }

            _yf_cache_set(cache_key, result)
            results[symbol] = result

        except Exception as e:
            results[symbol] = {"error": str(e)}

    return jsonify({"status": "success", "data": results})


BASE_FUNDAMENTALS_PY = {
    "RELIANCE": { "mcapCr": 1764228.28, "pb": 1.95, "divYield": 0.45, "roe": 9.40, "eps": 55.17, "basePrice": 1323.10, "industryPe": 25.99, "debtToEquity": 0.37, "bookValue": 668.04, "faceValue": 10.00 },
    "TCS": { "mcapCr": 803613.44, "pb": 7.33, "divYield": 2.89, "roe": 47.74, "eps": 137.54, "basePrice": 2251.10, "industryPe": 30.10, "debtToEquity": 0.10, "bookValue": 303.01, "faceValue": 1.00 },
    "INFY": { "mcapCr": 434652.42, "pb": 4.60, "divYield": 4.60, "roe": 31.44, "eps": 75.44, "basePrice": 1087.10, "industryPe": 25.40, "debtToEquity": 0.10, "bookValue": 233.15, "faceValue": 5.00 },
    "SBIN": { "mcapCr": 964045.67, "pb": 1.62, "divYield": 1.64, "roe": 15.48, "eps": 91.16, "basePrice": 1060.00, "industryPe": 12.60, "debtToEquity": 1.25, "bookValue": 645.82, "faceValue": 1.00 },
    "HDFCBANK": { "mcapCr": 1172724.88, "pb": 1.93, "divYield": 1.67, "roe": 13.84, "eps": 44.79, "basePrice": 777.60, "industryPe": 19.82, "debtToEquity": 0.95, "bookValue": 393.81, "faceValue": 1.00 },
    "ICICIBANK": { "mcapCr": 1049522.13, "pb": 2.76, "divYield": 0.82, "roe": 16.07, "eps": 77.39, "basePrice": 1460.20, "industryPe": 20.80, "debtToEquity": 0.88, "bookValue": 530.38, "faceValue": 2.00 },
    "ITC": { "mcapCr": 352078.06, "pb": 4.86, "divYield": 5.66, "roe": 29.34, "eps": 16.51, "basePrice": 282.70, "industryPe": 18.72, "debtToEquity": 0.03, "bookValue": 57.87, "faceValue": 1.00 },
    "TATASTEEL": { "mcapCr": 233522.88, "pb": 2.29, "divYield": 2.15, "roe": 11.16, "eps": 8.65, "basePrice": 186.41, "industryPe": 23.81, "debtToEquity": 0.89, "bookValue": 81.84, "faceValue": 1.00 },
    "WIPRO": { "mcapCr": 173084.40, "pb": 2.07, "divYield": 4.54, "roe": 16.13, "eps": 12.59, "basePrice": 176.38, "industryPe": 15.29, "debtToEquity": 0.27, "bookValue": 84.51, "faceValue": 2.00 }
}

@app.route('/api/yahoo/fundamentals', methods=['GET'])
def api_yahoo_fundamentals():
    symbol = request.args.get('symbol', '').strip().upper()
    if not symbol:
        return jsonify({"status": "error", "message": "Symbol is required"}), 400

    cache_key = f"fundamentals_{symbol}"
    cached = _yf_cache_get(cache_key, _YF_QUOTE_TTL)
    if cached:
        return jsonify({"status": "success", "data": cached, "cached": True})

    try:
        yf_symbol = f"{symbol}.NS"
        ticker = yf.Ticker(yf_symbol)
        info = ticker.info

        # Extract fields
        mcap = info.get("marketCap", 0)
        mcap_cr = round(mcap / 10000000, 2) if mcap else 0

        pe = info.get("trailingPE") or info.get("forwardPE")
        pb = info.get("priceToBook")
        eps = info.get("trailingEps")
        book_value = info.get("bookValue")

        div_yield = info.get("dividendYield")
        if div_yield:
            if div_yield < 0.15:
                div_pct = round(div_yield * 100, 2)
            else:
                div_pct = round(div_yield, 2)
        else:
            div_pct = 0.0

        roe = info.get("returnOnEquity")
        if roe:
            roe_pct = round(roe * 100, 2)
        elif eps and book_value and book_value > 0:
            roe_pct = round((eps / book_value) * 100, 2)
        else:
            roe_pct = 0.0

        debt_to_equity = info.get("debtToEquity", 0)
        debt_ratio = round(debt_to_equity / 100, 2) if debt_to_equity else 0.0

        face_value = info.get("faceValue")
        if not face_value or face_value == 'None':
            face_value = 1.00

        price = info.get("previousClose") or info.get("regularMarketPreviousClose") or 1.0
        if not pe and eps and eps > 0:
            pe = round(price / eps, 2)

        from_db = BASE_FUNDAMENTALS_PY.get(symbol, {})

        result = {
            "mcapCr": mcap_cr if mcap_cr else from_db.get("mcapCr", 0.0),
            "pb": round(pb, 2) if pb else from_db.get("pb", 0.0),
            "divYield": div_pct if div_pct else from_db.get("divYield", 0.0),
            "roe": roe_pct if roe_pct else from_db.get("roe", 0.0),
            "eps": round(eps, 2) if eps else from_db.get("eps", 0.0),
            "basePrice": round(price, 2) if price else from_db.get("basePrice", 1.0),
            "industryPe": round(pe * 1.05, 2) if pe else from_db.get("industryPe", 20.0),
            "debtToEquity": debt_ratio if debt_ratio else from_db.get("debtToEquity", 0.0),
            "bookValue": round(book_value, 2) if book_value else from_db.get("bookValue", 0.0),
            "faceValue": float(face_value) if face_value else from_db.get("faceValue", 10.0)
        }

        _yf_cache_set(cache_key, result)
        return jsonify({"status": "success", "data": result})
    except Exception as e:
        from_db = BASE_FUNDAMENTALS_PY.get(symbol, {})
        if from_db:
            return jsonify({"status": "success", "data": from_db, "note": "fallback to baseline"})
        return jsonify({"status": "error", "message": str(e)}), 500


@app.route('/api/yahoo/search', methods=['GET'])
def api_yahoo_search():
    query = request.args.get('q', '').strip().upper()
    if not query:
        return jsonify({"status": "error", "message": "Query parameter 'q' is required"}), 400

    matches = []
    for symbol, name in NSE_STOCKS.items():
        if query in symbol or query in name.upper():
            matches.append({"symbol": symbol, "name": name})

    matches = matches[:15]  # Limit results
    return jsonify({"status": "success", "data": matches})

GROQ_API_KEY = os.environ.get("GROQ_API_KEY", "")  # Set in .env or environment variable

# --- GROQ AI ASSISTANT API PROXY (Llama 3.3 70B) ---
@app.route('/api/ai/chat', methods=['POST'])
def api_ai_chat():
    data = request.json or {}
    user_prompt = data.get('prompt', '').strip()
    ctx = data.get('context', {})

    if not user_prompt:
        return jsonify({"status": "error", "message": "Prompt is required"}), 400

    # Construct system context prompt
    ticker = ctx.get('selectedStock', 'N/A')
    price = ctx.get('price', 0.0)
    change = ctx.get('change', 0.0)
    rsi = ctx.get('rsi', 'N/A')
    risk_profile = ctx.get('riskProfile', 'moderate')
    fund = ctx.get('fundamentals', {})
    
    system_message = f"""You are Toro AI, an expert AI trading analyst & portfolio advisor on the ToroFolio platform.

INSTRUCTIONS:
1. Answer the user's question directly. If the user asks a general question (e.g., today's date, greetings, trading concepts, definitions, strategy, or general advice), answer it directly and naturally like a real AI assistant.
2. If the user says hi/hello, greet them warmly and ask how you can help.
3. If the user mentions a specific stock in their prompt, provide detailed insights for that stock.
4. If the user asks for a trade recommendation, buy/sell signal, or chart breakdown without specifying a stock, you may reference their active workspace stock context:
   - Active Workspace Stock: {ticker} (Live Price: ₹{price}, Today: {change}%, RSI: {rsi})
   - Fundamentals: Market Cap: {fund.get('mcap', 'N/A')}, P/E: {fund.get('pe', 'N/A')} (Industry PE: {fund.get('industryPe', 'N/A')}), P/B: {fund.get('pb', 'N/A')}, ROE: {fund.get('roe', 'N/A')}, EPS: {fund.get('eps', 'N/A')}
   - User Risk Tolerance: {str(risk_profile).upper()}
5. Keep responses professional, clear, and concise (under 250 words) using clean markdown formatting (**bolding**, bullet points).
"""

    try:
        import requests as http_requests
        resp = http_requests.post(
            "https://api.groq.com/openai/v1/chat/completions",
            json={
                "model": "llama-3.3-70b-versatile",
                "messages": [
                    {"role": "system", "content": system_message},
                    {"role": "user", "content": user_prompt}
                ],
                "max_tokens": 500,
                "temperature": 0.7
            },
            headers={
                "Authorization": f"Bearer {GROQ_API_KEY}",
                "Content-Type": "application/json"
            },
            timeout=30
        )

        if resp.status_code == 200:
            res_body = resp.json()
            text_reply = res_body["choices"][0]["message"]["content"]
            model_used = res_body.get("model", "llama-3.3-70b")
            return jsonify({
                "status": "success",
                "reply": text_reply,
                "model": f"Groq ({model_used})"
            })
        else:
            return jsonify({
                "status": "error",
                "message": f"AI service returned error {resp.status_code}. Please try again."
            })

    except Exception as err:
        return jsonify({
            "status": "error",
            "message": f"AI service error: {str(err)}. Please try again."
        })


if __name__ == '__main__':
    # Serve static assets and API routes on Port 8000
    app.run(host='0.0.0.0', port=8000, debug=True)

