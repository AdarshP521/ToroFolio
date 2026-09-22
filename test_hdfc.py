import yfinance as yf
t = yf.Ticker("HDFCBANK.NS")
print("HDFCBANK.NS last_price:", t.fast_info.last_price)
print("HDFCBANK.NS previous_close:", t.fast_info.previous_close)
print("HDFCBANK.NS currency:", t.fast_info.currency)
