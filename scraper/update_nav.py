import json
import os
import yfinance as yf
from datetime import datetime

# 目標 ETF 列表
ETF_LIST = [
    '0050', '006208', '0056', '00878', '00919', '00929', '00940', '00939', '00713', '00850', '00881',
    '00946', '00944', '00945', '00947', 
    '00981A', '00991A', '00992A', '00987A', '00982A', '00985A', '00980A', '00984A', '00403A'
]

OUTPUT_FILE = os.path.join(os.path.dirname(__file__), '../public/live_nav.json')

def get_yfinance_symbol(symbol):
    # 處理特殊代號，例如債券 ETF 可能帶有 B
    if symbol == '00945':
        return '00945B.TW'
    return f"{symbol}.TW"

def main():
    print(f"[{datetime.now()}] 開始爬取真實 ETF 淨值與報價資料...")
    results = {
        "updateTime": datetime.now().isoformat(),
        "data": {}
    }

    for symbol in ETF_LIST:
        yf_symbol = get_yfinance_symbol(symbol)
        print(f"正在抓取 {symbol} ({yf_symbol}) ...")
        try:
            ticker = yf.Ticker(yf_symbol)
            info = ticker.info
            
            nav = info.get('navPrice')
            price = info.get('regularMarketPrice') or info.get('currentPrice')
            
            if nav is not None and price is not None:
                results["data"][symbol] = {
                    "nav": round(float(nav), 4),
                    "price": round(float(price), 4)
                }
                print(f"  成功: NAV={nav}, Price={price}")
            else:
                print(f"  警告: 無法取得 {symbol} 的完整數據 (NAV={nav}, Price={price})")
                
        except Exception as e:
            print(f"  [{symbol}] 抓取失敗: {e}")

    os.makedirs(os.path.dirname(OUTPUT_FILE), exist_ok=True)
    
    with open(OUTPUT_FILE, 'w', encoding='utf-8') as f:
        json.dump(results, f, ensure_ascii=False, indent=2)

    print(f"更新完成！真實淨值資料已寫入: {OUTPUT_FILE}")

if __name__ == '__main__':
    main()
