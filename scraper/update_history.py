import json
import os
import time
import re
import yfinance as yf
from datetime import datetime

ETF_LIST = [
    '0050', '006208', '0051', '0052', '0056', '00878', '00919', '00929', '00940', '00939', '00713', '00850', '00881',
    '00946', '00944', '00947', 
    '00981A', '00991A', '00992A', '00987A', '00982A', '00985A', '00980A', '00984A', '00403A'
]

HOLDINGS_FILE = os.path.join(os.path.dirname(__file__), '../public/live_holdings.json')
OUTPUT_DIR = os.path.join(os.path.dirname(__file__), '../public/ohlc')

def get_symbol_suffix(symbol):
    if symbol == '00945':
        return '00945B'
    return symbol

def fetch_history(symbol):
    # 1. 嘗試上市 (.TW)
    yf_symbol = f"{symbol}.TW"
    try:
        ticker = yf.Ticker(yf_symbol)
        hist = ticker.history(period="3y", auto_adjust=True)
        if not hist.empty and len(hist) >= 5:
            return hist, "TW"
    except Exception:
        pass

    # 2. 嘗試上櫃 (.TWO)
    yf_symbol = f"{symbol}.TWO"
    try:
        ticker = yf.Ticker(yf_symbol)
        hist = ticker.history(period="3y", auto_adjust=True)
        if not hist.empty and len(hist) >= 5:
            return hist, "TWO"
    except Exception:
        pass

    return None, None

def main():
    print(f"[{datetime.now()}] 開始更新歷史 K 線資料...")
    
    # 收集需要下載的所有代號
    symbols = set()
    for etf in ETF_LIST:
        symbols.add(get_symbol_suffix(etf))
        
    if os.path.exists(HOLDINGS_FILE):
        try:
            with open(HOLDINGS_FILE, 'r', encoding='utf-8') as f:
                holdings_data = json.load(f)
            for etf_symbol, holdings in holdings_data.get('data', {}).items():
                for h in holdings:
                    sym = h.get('symbol')
                    if sym and re.match(r'^\d+$', sym): # 僅抓取數字代號的個股
                        symbols.add(sym)
        except Exception as e:
            print(f"讀取持股資料失敗: {e}")
            
    print(f"共收集到 {len(symbols)} 檔需要下載 K 線的標的")
    os.makedirs(OUTPUT_DIR, exist_ok=True)
    
    success_count = 0
    fail_count = 0
    
    for i, symbol in enumerate(sorted(symbols)):
        print(f"[{i+1}/{len(symbols)}] 正在下載 {symbol} ...")
        hist, market = fetch_history(symbol)
        
        if hist is not None and not hist.empty:
            ohlc_data = []
            for index, row in hist.iterrows():
                date_str = index.strftime("%Y-%m-%d")
                
                open_val = float(row["Open"])
                high_val = float(row["High"])
                low_val = float(row["Low"])
                close_val = float(row["Close"])
                volume_val = float(row["Volume"])
                
                # 0050 價格除法還原 (1 拆 4，針對 2025-06-18 之前)
                if symbol == '0050' and date_str < '2025-06-18':
                    open_val = open_val / 4.0
                    high_val = high_val / 4.0
                    low_val = low_val / 4.0
                    close_val = close_val / 4.0
                    volume_val = volume_val * 4
                    
                # 0052 價格除法還原 (1 拆 7，針對 2025-11-26 之前)
                if symbol == '0052' and date_str < '2025-11-26':
                    open_val = open_val / 7.0
                    high_val = high_val / 7.0
                    low_val = low_val / 7.0
                    close_val = close_val / 7.0
                    volume_val = volume_val * 7
                
                ohlc_data.append({
                    "time": date_str,
                    "open": round(open_val, 2),
                    "high": round(high_val, 2),
                    "low": round(low_val, 2),
                    "close": round(close_val, 2),
                    "volume": int(volume_val)
                })
                
            output_file = os.path.join(OUTPUT_DIR, f"{symbol}.json")
            with open(output_file, 'w', encoding='utf-8') as f:
                json.dump(ohlc_data, f, ensure_ascii=False, indent=2)
                
            print(f"  成功: {market} 市場，共 {len(ohlc_data)} 筆交易日資料")
            success_count += 1
        else:
            print(f"  失敗: 無法取得 {symbol} 歷史 K 線數據")
            fail_count += 1
            
        time.sleep(0.3) # 微小延遲防止被 Yahoo 封鎖
        
    print(f"[{datetime.now()}] 歷史 K 線資料更新完畢！成功: {success_count} 檔，失敗: {fail_count} 檔。")

if __name__ == '__main__':
    main()
