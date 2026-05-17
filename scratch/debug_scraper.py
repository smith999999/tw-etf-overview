import requests
from bs4 import BeautifulSoup
import sys

def debug_scrape(symbol):
    url = f"https://www.moneydj.com/etf/x/basic/basic0007.xdjpy?etfid={symbol}.TW"
    print(f"Fetching {url}...")
    headers = {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
    }
    response = requests.get(url, headers=headers)
    if response.status_code != 200:
        print(f"Error: {response.status_code}")
        return
    
    soup = BeautifulSoup(response.text, 'html.parser')
    table = soup.find('table', {'class': 'table_b'})
    if not table:
        # Try another selector
        table = soup.find('table', id='CommonGridView1')
    
    if not table:
        print("Table not found")
        return
        
    rows = table.find_all('tr')
    for i, row in enumerate(rows[:5]):
        tds = row.find_all(['td', 'th'])
        cols = [td.get_text(strip=True) for td in tds]
        print(f"Row {i}: {cols}")

if __name__ == "__main__":
    debug_scrape("0050")
