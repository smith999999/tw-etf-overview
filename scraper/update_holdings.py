import json
import os
import requests
from bs4 import BeautifulSoup
from datetime import datetime, timedelta
import time
import re

ETF_LIST = [
    '0050', '006208', '0056', '00878', '00919', '00929', '00940', '00939', '00713', '00850', '00881',
    '00946', '00944', '00947', 
    '00981A', '00991A', '00992A', '00987A', '00982A', '00985A', '00980A', '00984A'
]

OUTPUT_FILE = os.path.join(os.path.dirname(__file__), '../public/live_holdings.json')

def get_symbol_suffix(symbol):
    if symbol == '00945':
        return '00945B'
    return symbol

def scrape_holdings(symbol_with_suffix):
    url = f'https://www.moneydj.com/ETF/X/Basic/Basic0007.xdjhtm?etfid={symbol_with_suffix}.TW'
    try:
        res = requests.get(url, headers={'User-Agent': 'Mozilla/5.0'}, timeout=10)
        res.encoding = 'utf-8'
        soup = BeautifulSoup(res.text, 'html.parser')
        
        tables = soup.find_all('table')
        holdings_table = None
        for t in tables:
            if '個股名稱' in t.text and '投資比例' in t.text:
                holdings_table = t
                break
                
        if holdings_table:
            holdings = []
            for tr in holdings_table.find_all('tr')[1:]: # skip header
                tds = tr.find_all('td')
                if len(tds) >= 3:
                    name_raw = tds[0].text.strip()
                    weight_raw = tds[1].text.strip()
                    
                    # parse name (e.g., "台積電(2330.TW)" -> "2330 台積電")
                    match = re.search(r'(.*?)\((.*?)\.TW\)', name_raw)
                    if match:
                        name = match.group(1).strip()
                        stock_id = match.group(2).strip()
                    else:
                        stock_id = name_raw
                        name = name_raw
                        
                    try:
                        weight = float(weight_raw)
                    except ValueError:
                        continue
                        
                    holdings.append({
                        "symbol": stock_id,
                        "name": name,
                        "weight": weight
                    })
            # Sort by weight descending just to be sure
            holdings = sorted(holdings, key=lambda x: x['weight'], reverse=True)
            return holdings[:10] # Top 10
    except Exception as e:
        print(f"  抓取失敗: {e}")
    return []

def main():
    print(f"[{datetime.now()}] 開始爬取 MoneyDJ ETF 持股資料...")
    
    # Load history to compute weekly changes
    history = {}
    if os.path.exists(OUTPUT_FILE):
        try:
            with open(OUTPUT_FILE, 'r', encoding='utf-8') as f:
                history = json.load(f)
        except Exception:
            pass

    if "history" not in history:
        history["history"] = {}
        
    today = datetime.now().strftime("%Y-%m-%d")
    if today not in history["history"]:
        history["history"][today] = {}

    current_data = {}
    changes_data = {}

    for symbol in ETF_LIST:
        sym = get_symbol_suffix(symbol)
        print(f"正在抓取 {symbol} ({sym}) 持股...")
        holdings = scrape_holdings(sym)
        
        if holdings:
            history["history"][today][symbol] = holdings
            current_data[symbol] = holdings
            print(f"  成功取得 {len(holdings)} 檔持股")
        else:
            print(f"  警告: 無法取得 {symbol} 持股資料")
            
        # Calculate weekly changes
        # Find the closest date around 7 days ago
        target_date = datetime.now() - timedelta(days=7)
        closest_date = None
        min_diff = 999
        
        for past_date_str in history["history"].keys():
            if past_date_str == today:
                continue
            past_date = datetime.strptime(past_date_str, "%Y-%m-%d")
            diff = abs((past_date - target_date).days)
            if diff <= 3 and diff < min_diff:
                min_diff = diff
                closest_date = past_date_str
                
        if closest_date and symbol in history["history"][closest_date] and holdings:
            past_holdings = history["history"][closest_date][symbol]
            past_dict = {h["symbol"]: h["weight"] for h in past_holdings}
            
            changes = []
            for h in holdings:
                past_w = past_dict.get(h["symbol"])
                if past_w is not None:
                    diff = round(h["weight"] - past_w, 2)
                    if diff != 0:
                        changes.append({
                            "symbol": h["symbol"],
                            "name": h["name"],
                            "change": diff
                        })
                else:
                    # New holding
                    changes.append({
                        "symbol": h["symbol"],
                        "name": h["name"],
                        "change": h["weight"]
                    })
            
            # Find removed holdings
            curr_dict = {h["symbol"]: h["weight"] for h in holdings}
            for ph in past_holdings:
                if ph["symbol"] not in curr_dict:
                    changes.append({
                        "symbol": ph["symbol"],
                        "name": ph["name"],
                        "change": -ph["weight"]
                    })
                    
            # Sort by absolute change
            changes = sorted(changes, key=lambda x: abs(x["change"]), reverse=True)[:5]
            changes_data[symbol] = changes
        else:
            changes_data[symbol] = []
            
        time.sleep(1)

    # Save to JSON
    output_data = {
        "updateTime": datetime.now().isoformat(),
        "data": current_data,
        "changes": changes_data,
        "history": history["history"]
    }
    
    os.makedirs(os.path.dirname(OUTPUT_FILE), exist_ok=True)
    with open(OUTPUT_FILE, 'w', encoding='utf-8') as f:
        json.dump(output_data, f, ensure_ascii=False, indent=2)

    print(f"更新完成！持股資料已寫入: {OUTPUT_FILE}")

if __name__ == '__main__':
    main()
