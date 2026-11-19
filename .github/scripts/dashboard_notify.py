"""Send the daily investment dashboard message to Telegram.

Triggered by Claude's daily update task (workflow_dispatch with inputs)
after it publishes the dashboard. Skips Sundays (Taiwan time) unless forced.
"""
import json
import os
import sys
import urllib.parse
import urllib.request
from datetime import datetime, timedelta, timezone

URL = "https://claude.ai/artifact/QPtbEdhy8CZb8SX8WrQvcP"
token = os.environ.get("TELEGRAM_BOT_TOKEN", "")
chat_id = os.environ.get("TELEGRAM_CHAT_ID", "")
if not token or not chat_id:
    sys.exit("TELEGRAM_BOT_TOKEN or TELEGRAM_CHAT_ID secret is not set")

status = os.environ.get("STATUS", "").strip()
stance = os.environ.get("STANCE", "").strip()
headline = os.environ.get("HEADLINE", "").strip()
as_of = os.environ.get("DATA_AS_OF", "").strip()
force = os.environ.get("FORCE", "").strip().lower() == "true"

now = datetime.now(timezone(timedelta(hours=8)))
if now.weekday() == 6 and not force:
    print("Sunday in Taiwan: no message sent")
    sys.exit(0)

if status == "updated":
    lines = ["📈 今日投資儀表板已更新"]
elif status == "failed":
    lines = ["⚠️ 投資儀表板：今日資料更新失敗，頁面仍是前一次的內容"]
else:
    lines = ["📈 每日投資儀表板"]
if as_of:
    lines.append(f"行情截至 {as_of}")
if stance:
    lines.append(f"整體判讀：{stance}")
if headline:
    lines.append(headline[:300])
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
