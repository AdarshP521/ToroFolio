import yfinance as yf

symbol = "BEL.NS"
ticker = yf.Ticker(symbol)
info = ticker.info

mcap = info.get("marketCap", 0)
mcap_cr = round(mcap / 10000000, 2) if mcap else 0
pe = info.get("trailingPE") or info.get("forwardPE")
pb = info.get("priceToBook")
eps = info.get("trailingEps")
book_value = info.get("bookValue")
div_yield = info.get("dividendYield")
div_pct = round(div_yield * 100, 2) if div_yield else 0.0
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

print("BEL.NS Fundamentals:")
print("mcapCr:", mcap_cr)
print("pe:", pe)
print("pb:", pb)
print("divYield:", div_pct)
print("roePct:", roe_pct)
print("eps:", eps)
print("bookValue:", book_value)
print("debtRatio:", debt_ratio)
print("faceValue:", face_value)
