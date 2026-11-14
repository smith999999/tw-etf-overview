"""Build the Telegram text for the daily investment dashboard and send it."""
import json
import os
import sys
import urllib.parse
import urllib.request
from datetime import datetime, timedelta, timezone

URL = "https://smith999999.github.io/tw-etf-overview/daily/"
token = os.environ.get("TELEGRAM_BOT_TOKEN", "")
chat_id = os.environ.get("TELEGRAM_CHAT_ID", "")
if not token or not chat_id:
    sys.exit("TELEGRAM_BOT_TOKEN or TELEGRAM_CHAT_ID secret is not set")

try:
    with open("public/daily/data/summary.json", encoding="utf-8") as f:
        s = json.load(f)[0]
except Exception as e:  # still send the link if the data file is unreadable
    s = {}
    print(f"could not read summary.json: {e}")

today = datetime.now(timezone(timedelta(hours=8))).strftime("%Y/%m/%d")
updated = str(s.get("updated_at", ""))
if updated.startswith(today):
    lines = ["📈 今日投資儀表板已更新"]
else:
    lines = ["⚠️ 投資儀表板：今日資料尚未更新" + (f"（目前是 {updated} 的內容）" if updated else "")]
if s.get("stance"):
    lines.append(f"整體判讀：{s['stance']}")
if s.get("headline"):
    lines.append(str(s["headline"]))
lines.append(URL)

data = urllib.parse.urlencode({
    "chat_id": chat_id,
    "text": "\n".join(lines),
    "disable_web_page_preview": "true",
}).encode()
req = urllib.request.Request(f"https://api.telegram.org/bot{token}/sendMessage", data=data)
try:
    with urllib.request.urlopen(req, timeout=30) as r:
        ok = json.load(r).get("ok")
except Exception as e:
    sys.exit(f"Telegram request failed: {type(e).__name__}")
if not ok:
    sys.exit("Telegram API did not return ok")
print("sent")
