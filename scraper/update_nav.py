import json
import os
import requests
from bs4 import BeautifulSoup
from datetime import datetime

# 目標 ETF 列表
ETF_LIST = [
    '0050', '006208', '0056', '00878', '00919', '00929', '00940', '00939', '00713', '00850', '00881',
    '00946', '00944', '00945', '00947', 
    '00981A', '00991A', '00992A', '00987A', '00982A', '00985A', '00980A', '00984A', '00403A'
]

# 輸出的 JSON 路徑 (供前端使用)
OUTPUT_FILE = os.path.join(os.path.dirname(__file__), '../public/live_nav.json')

def fetch_nav_from_moneydj(symbol):
    """
    爬取 MoneyDJ 等財經網站的淨值資料作為範例
    (實際專案中，依據各投信官網格式撰寫各自的解析邏輯最為精準)
    """
    try:
        url = f"https://www.moneydj.com/ETF/X/Basic/Basic0003.xdjhtm?etfid={symbol}.TW"
        headers = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        }
        res = requests.get(url, headers=headers, timeout=10)
        res.raise_for_status()
        soup = BeautifulSoup(res.text, 'html.parser')
        
        # 尋找淨值欄位 (依網頁結構而定)
        # 這裡僅為範例框架，實際網頁結構可能需要使用特定的 CSS Selector
        nav_element = soup.select_one('td.nav-value-selector') # 替換為實際 Selector
        if nav_element:
            return float(nav_element.text.strip())
        return None
    except Exception as e:
        print(f"[{symbol}] 爬取失敗: {e}")
        return None

def fetch_from_twse_openapi():
    """
    可選：從 TWSE OpenAPI 抓取大盤 ETF 每日收盤行情
    """
    url = "https://openapi.twse.com.tw/v1/exchangeReport/MI_INDEX"
    try:
        res = requests.get(url, timeout=10)
        return res.json()
    except:
        return []

def main():
    print(f"[{datetime.now()}] 開始爬取 ETF 淨值與報價資料...")
    results = {
        "updateTime": datetime.now().isoformat(),
        "data": {}
    }

    # 模擬爬蟲邏輯 (實際應替換為正式的 HTTP 請求)
    for symbol in ETF_LIST:
        print(f"正在抓取 {symbol} ...")
        # 這裡示範呼叫方法
        # nav = fetch_nav_from_moneydj(symbol)
        
        # 為了展示，這裡放上成功回傳的結構
        results["data"][symbol] = {
            "nav": 15.00,  # 實際填入 nav
            "price": 15.00 # 實際填入 price
        }

    # 確保資料夾存在
    os.makedirs(os.path.dirname(OUTPUT_FILE), exist_ok=True)
    
    with open(OUTPUT_FILE, 'w', encoding='utf-8') as f:
        json.dump(results, f, ensure_ascii=False, indent=2)

    print(f"更新完成！資料已寫入: {OUTPUT_FILE}")

if __name__ == '__main__':
    main()
