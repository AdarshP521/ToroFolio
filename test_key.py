import os
import urllib.request
import urllib.error
import json
import ssl

key = os.environ.get("GROQ_API_KEY", "")  # Set your Groq API key in environment or .env
url = "https://api.groq.com/openai/v1/chat/completions"
payload = json.dumps({
    "model": "llama-3.3-70b-versatile",
    "messages": [{"role": "user", "content": "Hi, what is today's date? Reply in one sentence."}],
    "max_tokens": 200
}).encode()

# Create SSL context
ctx = ssl.create_default_context()

req = urllib.request.Request(url, data=payload, headers={
    "Content-Type": "application/json",
    "Authorization": f"Bearer {key}",
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
}, method="POST")

try:
    resp = urllib.request.urlopen(req, timeout=30, context=ctx)
    data = json.loads(resp.read().decode())
    print("SUCCESS!")
    print(data["choices"][0]["message"]["content"])
except urllib.error.HTTPError as e:
    body = e.read().decode()
    print(f"HTTP ERROR {e.code}:")
    print(body[:500])
except Exception as e:
    print(f"OTHER ERROR: {e}")

# Also try with requests if available
print("\n--- Trying with requests library ---")
try:
    import requests
    resp = requests.post(url, json={
        "model": "llama-3.3-70b-versatile",
        "messages": [{"role": "user", "content": "Say hello in one word"}],
        "max_tokens": 50
    }, headers={
        "Authorization": f"Bearer {key}",
        "Content-Type": "application/json"
    }, timeout=30)
    print(f"Status: {resp.status_code}")
    print(resp.text[:500])
except ImportError:
    print("requests library not installed")
except Exception as e:
    print(f"Error: {e}")
