This is a SAAS App
build by me - Pandey Adarsh
here is the system design

# 🏗️ System Design & Architecture — ToroFolio

A high-performance, glassmorphic trading terminal and analytics platform designed for desktop and mobile web viewports. This document outlines the system architecture, component layout, data persistence model, and technical specifications for **ToroFolio**.

---

## 📄 Overview

**ToroFolio** is a web-based trading application built with a responsive multi-column layout, real-time market data visualizers, technical indicators, and a composite evaluation engine. The system integrates a client-side state engine with a lightweight backend proxy for live market data extraction and persistence.

---

## 🏛️ High-Level System Architecture

```
+-------------------------------------------------------------------------------+
|                                  CLIENT (UI)                                  |
|                                                                               |
|  +------------------------+  +------------------------+  +-----------------+  |
|  |   Watchlist & Search   |  |   Trading View Chart   |  | Execution Panel |  |
|  |       (Left Col)       |  |      (Middle Col)      |  |   (Right Col)   |  |
|  +------------------------+  +------------------------+  +-----------------+  |
|                                          |                                    |
|                             +--------------------------+                      |
|                             | Smart Trade Advisor Engine|                     |
|                             +--------------------------+                      |
|                                          |                                    |
|                             +--------------------------+                      |
|                             | App State (LocalStorage) |                      |
|                             +--------------------------+                      |
+------------------------------------------|------------------------------------+
                                           | HTTP / REST API
+------------------------------------------v------------------------------------+
|                                Backend Service                                |
|                                                                               |
|  +-----------------------+   +----------------------+   +------------------+  |
|  | Authentication Proxy  |   | Market Data Pipeline |   | SQLite Database  |  |
|  |     (OTP / OAuth)     |   |  (Yahoo / Finnhub)   |   |  (User & State)  |  |
|  +-----------------------+   +----------------------+   +------------------+  |
|                                          |                                    |
|                             +--------------------------+                      |
|                             | CSV Logger & Local Storage|                     |
|                             +--------------------------+                      |
+-------------------------------------------------------------------------------+

```

---

## 🧩 Module Breakdown

### 1. Authentication & Session Subsystem

* **Glassmorphic Authentication Gateway:** A tab-based authentication shell built with frosted glass styling (`blur(30px)` backdrop filter) and active depth effects.
* **OTP Dispatch Engine:** Verification pipeline accepting mobile parameters, logging verification codes to server task logs, and issuing a verification token.
* **SSO Handler:** OAuth 2.0 dynamic prompt modal supporting account login and simulated identity workflows.
* **Session Guard:** Strict access controller checking active session tokens on boot. Invalid or missing tokens clear application state and redirect to the authentication screen.

### 2. UI Layout & Viewport Design

* **Three-Column Desktop Grid System:**
* **Column 1 (`300px`):** Ticker search, filtering, and watchlist sidebar.
* **Column 2 (`1fr`):** Canvas-rendered technical charting, live statistics ribbon, and Stock Fundamentals card.
* **Column 3 (`360px`):** Order execution console, position sizing, and buy/sell transaction controllers.


* **Skeleton Loading Engine:** Pure CSS `@keyframes skeleton-pulse` layout placeholders obscuring raw UI rendering during asynchronous API fetches.

### 3. Market Data & Timeframe Pipeline

* **Multi-Timeframe Controls:** Supports 11 interval definitions: `1m`, `1H`, `1D`, `1W`, `1M`, `3M`, `6M`, `1Y`, `3Y`, `5Y`, and `ALL`.
* **Data Normalization:** Maps interval parameters dynamically to external proxy APIs (Yahoo Finance / Finnhub).
* **Static Quote Isolation:** Preserves static day metrics (Open Price, Previous Close, 52W High/Low) across timeframe switches to prevent metric fluctuation.
* **Real-Time Holdings Banner:** Overlay banner tracking active positions (Shares, Avg Buy Price, Invested Value, Current Value, and P&L color-coding).

### 4. Financial Calculations & Analytics Engine

* **Stock Fundamentals Engine:** Evaluates 10 core fundamental parameters:
* Market Capitalization, P/E Ratio, P/B Ratio, Industry P/E, Debt to Equity, ROE, Book Value, Dividend Yield, EPS, and Face Value.


* **Smart Trade Advisor Engine:** Composite scoring system (0–100%) incorporating:
* **P/E Benchmark Delta:** Valuation comparison against industry standards.
* **Graham Intrinsic Value Equation:**

$$\text{Intrinsic Value} = \sqrt{22.5 \times \text{EPS} \times \text{Book Value}}$$


* **Pivot Support & Resistance Tracker:** Computes entry support ($S1$) and target resistance ($R1$) levels using previous candle metrics.


* **Indian Number Formatting Module:** Formats large financial integers into standard Indian notation with automated scaling for values exceeding 1 Lakh Crore ($\text{Cr}$).

### 5. Backend Persistence & Data Model

* **Database Engine:** SQLite database storing users, watchlists, holdings, active orders, and custom rules.
* **State Synchronization:** Bi-directional syncing between client-side state (`localStorage`) and backend database instances (`saveStateToServer()`).
* **Resilient Phone Lookup:** OTP pipeline maps mobile identifiers directly to active user primary keys in SQLite.
* **Media Asset Storage Pipeline:** Automatically decodes uploaded Base64 profile assets, compresses binary payloads, saves assets locally to `/images/avatar_<hash>.png`, and stores relative paths in SQLite/CSV records.
* **CSV Audit Logger:** Appends profile updates to an offline spreadsheet log (`users_details_sheet.csv`) for record keeping.

---

## 🗄️ Database Schema Representation

### `users` Table

| Column Name | Type | Key | Description |
| --- | --- | --- | --- |
| `id` | INTEGER | Primary Key | Auto-incrementing identifier |
| `email` | TEXT | Unique | Account primary email identifier |
| `phone` | TEXT | Index | Mobile phone number |
| `name` | TEXT | — | Full user display name |
| `avatar` | TEXT | — | Relative path to local image asset |
| `dob` | TEXT | — | Date of birth |
| `city` | TEXT | — | Primary city |
| `state` | TEXT | — | Primary state |

### `holdings` & `watchlist` Tables

| Column Name | Type | Key | Description |
| --- | --- | --- | --- |
| `user_email` | TEXT | Foreign Key | References `users(email)` |
| `symbol` | TEXT | Index | Equity symbol identifier |
| `shares` | REAL | — | Quantity of shares owned |
| `avg_price` | REAL | — | Weighted average entry price |

---

## 🛠️ Verification & Quality Assurance

* **Syntactical Validation:** Confirmed valid syntax across HTML, CSS, and JS modules.
* **Session & Auth Checks:** Tested OTP routing, SMS dispatching, session resets, and persistent logins.
* **API Key Fallback:** Verified API key fallback handling and error states on live proxy pipelines.
* **Cross-Device Responsiveness:** Verified grid layout collapses into a single vertical column on viewports below `768px`.
