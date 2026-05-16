import json
import os
import requests
from bs4 import BeautifulSoup
import yfinance as yf
from datetime import datetime
import re
import time

# 目標 ETF 列表
ETF_LIST = [
    '0050', '006208', '0056', '00878', '00919', '00929', '00940', '00939', '00713', '00850', '00881',
    '00946', '00944', '00947', 
    '00981A', '00991A', '00992A', '00987A', '00982A', '00985A', '00980A', '00984A'
]

OUTPUT_FILE = os.path.join(os.path.dirname(__file__), '../public/live_nav.json')

def get_symbol_suffix(symbol):
    if symbol == '00945':
        return '00945B'
    return symbol

def scrape_moneydj(symbol_with_suffix):
    url = f'https://www.moneydj.com/ETF/X/Basic/Basic0003.xdjhtm?etfid={symbol_with_suffix}.TW'
    try:
        res = requests.get(url, headers={'User-Agent': 'Mozilla/5.0'}, timeout=10)
        res.encoding = 'utf-8'
        soup = BeautifulSoup(res.text, 'html.parser')
        
        for tr in soup.find_all('tr'):
            tds = tr.find_all('td')
            if len(tds) == 4:
                text0 = tds[0].text.strip()
                if re.match(r'^20\d\d/\d\d/\d\d$', text0):
                    nav_val = float(tds[1].text.strip())
                    price_val = float(tds[2].text.strip())
                    return nav_val, price_val
    except Exception as e:
        print(f"  Moneydj 抓取失敗: {e}")
    return None, None

def get_yfinance_data(symbol_with_suffix):
    yf_symbol = f"{symbol_with_suffix}.TW"
    try:
        ticker = yf.Ticker(yf_symbol)
        info = ticker.info
        nav = info.get('navPrice')
        price = info.get('regularMarketPrice') or info.get('currentPrice')
        if nav is not None and price is not None:
            return float(nav), float(price)
    except Exception as e:
        pass
    return None, None

def main():
    print(f"[{datetime.now()}] 開始爬取真實 ETF 淨值與報價資料...")
    results = {
        "updateTime": datetime.now().isoformat(),
        "data": {}
    }

    for symbol in ETF_LIST:
        sym = get_symbol_suffix(symbol)
        print(f"正在抓取 {symbol} ({sym}) ...")
        
        # 1. 優先嘗試 MoneyDJ，因為它能提供投信最新的真實收盤淨值 (yfinance 有時會延遲或不準確)
        nav, price = scrape_moneydj(sym)
        
        # 2. 如果 MoneyDJ 失敗，退回到 yfinance
        if nav is None or price is None:
            print("  MoneyDJ 失敗，嘗試使用 yfinance...")
            nav, price = get_yfinance_data(sym)
            
        if nav is not None and price is not None:
            results["data"][symbol] = {
                "nav": round(float(nav), 4),
                "price": round(float(price), 4)
            }
            print(f"  成功: NAV={nav}, Price={price}")
        else:
            print(f"  警告: 無法取得 {symbol} 的完整數據")
            
        time.sleep(1) # 避免請求過快被封鎖

    os.makedirs(os.path.dirname(OUTPUT_FILE), exist_ok=True)
    
    with open(OUTPUT_FILE, 'w', encoding='utf-8') as f:
        json.dump(results, f, ensure_ascii=False, indent=2)

    print(f"更新完成！真實淨值資料已寫入: {OUTPUT_FILE}")

if __name__ == '__main__':
    main()
