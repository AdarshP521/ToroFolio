import urllib.request
import json

token = "d89vtrhr01qhi7ru7ul0d89vtrhr01qhi7ru7ulg"
url = f"https://finnhub.io/api/v1/quote?symbol=AAPL&token={token}"

try:
    req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
    with urllib.request.urlopen(req) as response:
        data = json.loads(response.read().decode())
        print("Finnhub response:", data)
except Exception as e:
    print("Error querying Finnhub:", e)
