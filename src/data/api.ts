// FinMind API wrapper for Taiwan ETF data
// Optimized for rate-limit friendly batch loading with persistent cache

const BASE = 'https://api.finmindtrade.com/api/v4/data';

// ────────────────────── Infrastructure ──────────────────────

const fetchWithTimeout = async (url: string, timeout = 8000): Promise<Response> => {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeout);
  try {
    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(id);
    if (res.status === 402) throw new Error('Rate limited');
    return res;
  } catch (e) {
    clearTimeout(id);
    throw e instanceof Error ? e : new Error('Request timeout');
  }
};

// Persistent cache using localStorage + in-memory fallback
const CACHE_TTL = 10 * 60_000; // 10 minutes for price data
const LONG_CACHE_TTL = 60 * 60_000; // 1 hour for historical/yield data

const memCache: Record<string, { data: any; ts: number }> = {};

const getCache = (key: string, ttl: number): any | null => {
  // Try memory first
  if (memCache[key] && Date.now() - memCache[key].ts < ttl) return memCache[key].data;
  // Try localStorage
  try {
    const stored = localStorage.getItem(`etf_${key}`);
    if (stored) {
      const parsed = JSON.parse(stored);
      if (Date.now() - parsed.ts < ttl) {
        memCache[key] = parsed;
        return parsed.data;
      }
    }
  } catch { /* localStorage unavailable */ }
  return null;
};

const setCache = (key: string, data: any) => {
  const entry = { data, ts: Date.now() };
  memCache[key] = entry;
  try {
    localStorage.setItem(`etf_${key}`, JSON.stringify(entry));
  } catch { /* quota exceeded, ignore */ }
};

// Rate-limit friendly sequential fetcher with delay
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// ────────────────────── Types ──────────────────────

export interface PriceData {
  date: string;
  close: number;
  change: number;
  changePercent: number;
}

export interface ReturnData {
  threeMonth: number | null;
  sixMonth: number | null;
  oneYear: number | null;
  threeYear: number | null;
}

export interface Holding {
  symbol: string;
  name: string;
  weight: number;
  todayChange?: number;
  weightChange?: number;
  shares?: number;
  sharesChange?: number;
  sharesChangePercent?: number;
}

export interface HoldingChange {
  symbol: string;
  name: string;
  currentWeight: number;
  previousWeight: number;
  change: number;
  status: 'new' | 'removed' | 'increased' | 'decreased' | 'unchanged';
}

export interface ETFFullData {
  symbol: string;
  price: PriceData | null;
  nav: number | null;
  premiumDiscount: number | null;
  returns: ReturnData;
  dividendYield: number | null;
}

// ────────────────────── NAV (Static) ──────────────────────

// Static NAV reference data — updated from fund company disclosures
// Last updated: 2026-05-15
const STATIC_NAV: Record<string, number> = {
  '0050': 95.68, '006208': 221.15, '0056': 44.82,
  '00878': 28.05, '00919': 25.88, '00929': 25.95,
  '00940': 11.02, '00939': 18.28, '00713': 55.62,
  '00850': 81.25, '00881': 49.78,
  '00946': 12.95, '00944': 18.68, '00947': 35.85,
  '00981A': 10.00, '00991A': 10.00, '00992A': 10.00, '00987A': 10.00,
  '00982A': 10.00, '00985A': 10.00, '00980A': 10.00, '00984A': 10.00, '00403A': 9.63,
};

const STATIC_PRICE: Record<string, number> = {
  '00981A': 10.00, '00991A': 10.00, '00992A': 10.00, '00987A': 10.00,
  '00982A': 10.00, '00985A': 10.00, '00980A': 10.00, '00984A': 10.00, '00403A': 9.66,
};

export const fetchNAV = async (symbol: string): Promise<number | null> => {
  return STATIC_NAV[symbol] || null;
};

let liveNavCache: any = null;
const fetchLiveNavData = async () => {
  if (liveNavCache) return liveNavCache;
  try {
    const baseUrl = import.meta.env?.BASE_URL || '/';
    const res = await fetch(`${baseUrl}live_nav.json`);
    const json = await res.json();
    liveNavCache = json.data;
    return liveNavCache;
  } catch {
    return null;
  }
};

// ────────────────────── Batch Fetch All ──────────────────────

// Main batch loader: fetches price + returns + yield for ALL symbols
// Uses sequential requests with delays to be rate-limit friendly
export const fetchAllETFData = async (
  symbols: string[],
  onProgress?: (loaded: number, total: number, partialData: Record<string, ETFFullData>) => void,
): Promise<Record<string, ETFFullData>> => {
  const results: Record<string, ETFFullData> = {};
  const total = symbols.length;

  // Check if we have fully cached results for all symbols
  const allCached = symbols.every(s => getCache(`full_${s}`, CACHE_TTL));
  if (allCached) {
    symbols.forEach(s => { results[s] = getCache(`full_${s}`, CACHE_TTL); });
    onProgress?.(total, total, results);
    return results;
  }

  // Pre-fetch live NAV data from scraper output
  await fetchLiveNavData();

  // Process in small batches of 3 with delays between batches
  const BATCH_SIZE = 3;
  const BATCH_DELAY = 800; // ms between batches

  for (let i = 0; i < symbols.length; i += BATCH_SIZE) {
    const batch = symbols.slice(i, i + BATCH_SIZE);

    const batchPromises = batch.map(async (symbol) => {
      // Check cache first
      const cached = getCache(`full_${symbol}`, CACHE_TTL);
      if (cached) return cached as ETFFullData;

      try {
        const liveData = liveNavCache ? liveNavCache[symbol] : null;

        const [price, dividendYield] = await Promise.allSettled([
          fetchLatestPrice(symbol),
          fetchYieldForSymbol(symbol),
        ]);

        let returnsData: ReturnData = { threeMonth: null, sixMonth: null, oneYear: null, threeYear: null };
        if (liveData?.returns && liveData.returns.threeMonth !== undefined) {
          returnsData = liveData.returns;
        } else {
          try { returnsData = await fetchReturns(symbol); } catch {}
        }

        let priceVal = price.status === 'fulfilled' ? price.value : null;
        
        // Use scraper live price or static price fallback if API returns null
        if (!priceVal) {
          const fallbackPrice = liveData?.price || STATIC_PRICE[symbol];
          if (fallbackPrice) {
            priceVal = {
              date: new Date().toISOString().split('T')[0],
              close: fallbackPrice,
              change: 0,
              changePercent: 0
            };
          }
        }

        // Use real live NAV, then fallback to static
        const navVal = liveData?.nav || STATIC_NAV[symbol] || null;
        const premiumDiscount = (priceVal && navVal)
          ? Number(((priceVal.close - navVal) / navVal * 100).toFixed(2))
          : null;

        const result: ETFFullData = {
          symbol,
          price: priceVal,
          nav: navVal,
          premiumDiscount,
          returns: returnsData,
          dividendYield: dividendYield.status === 'fulfilled' ? dividendYield.value : null,
        };

        setCache(`full_${symbol}`, result);
        return result;
      } catch {
        const liveData = liveNavCache ? liveNavCache[symbol] : null;
        const fallbackPrice = liveData?.price || STATIC_PRICE[symbol];
        const fallbackNav = liveData?.nav || STATIC_NAV[symbol];
        
        // Return partial data with live/static NAV and static price
        return {
          symbol,
          price: fallbackPrice ? {
            date: new Date().toISOString().split('T')[0],
            close: fallbackPrice,
            change: 0,
            changePercent: 0
          } : null,
          nav: fallbackNav || null,
          premiumDiscount: (fallbackPrice && fallbackNav) 
            ? Number(((fallbackPrice - fallbackNav) / fallbackNav * 100).toFixed(2)) 
            : null,
          returns: liveData?.returns || { threeMonth: null, sixMonth: null, oneYear: null, threeYear: null },
          dividendYield: null,
        } as ETFFullData;
      }
    });

    const batchResults = await Promise.all(batchPromises);
    batchResults.forEach(r => { results[r.symbol] = r; });

    onProgress?.(Math.min(i + BATCH_SIZE, total), total, results);

    // Delay between batches (skip after last batch)
    if (i + BATCH_SIZE < symbols.length) {
      await delay(BATCH_DELAY);
    }
  }

  return results;
};

// ────────────────────── Price ──────────────────────

const fetchLatestPrice = async (symbol: string): Promise<PriceData | null> => {
  const cached = getCache(`price_${symbol}`, CACHE_TTL);
  if (cached) return cached;

  const d = new Date();
  d.setDate(d.getDate() - 10);
  const startDate = d.toISOString().split('T')[0];
  const res = await fetchWithTimeout(`${BASE}?dataset=TaiwanStockPrice&data_id=${symbol}&start_date=${startDate}`);
  const json = await res.json();
  if (!json.data || json.data.length < 2) return null;
  const last = json.data[json.data.length - 1];
  const prev = json.data[json.data.length - 2];
  const result = {
    date: last.date,
    close: last.close,
    change: Number((last.close - prev.close).toFixed(2)),
    changePercent: Number(((last.close - prev.close) / prev.close * 100).toFixed(2)),
  };
  setCache(`price_${symbol}`, result);
  return result;
};

// ────────────────────── Returns ──────────────────────

const fetchReturns = async (symbol: string): Promise<ReturnData> => {
  const cached = getCache(`returns_${symbol}`, LONG_CACHE_TTL);
  if (cached) return cached;

  const d = new Date();
  d.setFullYear(d.getFullYear() - 3);
  d.setMonth(d.getMonth() - 1);
  const startDate = d.toISOString().split('T')[0];
  const res = await fetchWithTimeout(`${BASE}?dataset=TaiwanStockPrice&data_id=${symbol}&start_date=${startDate}`, 10000);
  const json = await res.json();
  if (!json.data || json.data.length < 2) {
    return { threeMonth: null, sixMonth: null, oneYear: null, threeYear: null };
  }

  const data = json.data;
  const latest = data[data.length - 1].close;
  const now = new Date();

  const findClosestPrice = (monthsAgo: number): number | null => {
    const target = new Date(now);
    target.setMonth(target.getMonth() - monthsAgo);
    const targetStr = target.toISOString().split('T')[0];
    const point = data.find((d: any) => d.date >= targetStr);
    return point ? point.close : null;
  };

  const calc = (monthsAgo: number): number | null => {
    const p = findClosestPrice(monthsAgo);
    return p ? Number(((latest - p) / p * 100).toFixed(2)) : null;
  };

  const result = {
    threeMonth: calc(3),
    sixMonth: calc(6),
    oneYear: calc(12),
    threeYear: calc(36),
  };
  setCache(`returns_${symbol}`, result);
  return result;
};

// ────────────────────── Yield ──────────────────────

const fetchYieldForSymbol = async (symbol: string): Promise<number | null> => {
  const cached = getCache(`yield_${symbol}`, LONG_CACHE_TTL);
  if (cached !== null) return cached;

  const d = new Date();
  d.setFullYear(d.getFullYear() - 1);
  const startDate = d.toISOString().split('T')[0];
  const res = await fetchWithTimeout(`${BASE}?dataset=TaiwanStockDividend&data_id=${symbol}&start_date=${startDate}`);
  const json = await res.json();
  if (json.data && json.data.length > 0) {
    const totalDiv = json.data.reduce((sum: number, item: any) =>
      sum + (item.CashEarningsDistribution || 0) + (item.CashStatutorySurplus || 0), 0);
    // Use static NAV as reference price for yield calculation
    const refPrice = STATIC_NAV[symbol] || 0;
    if (totalDiv > 0 && refPrice > 0) {
      const result = Number((totalDiv / refPrice * 100).toFixed(2));
      setCache(`yield_${symbol}`, result);
      return result;
    }
  }
  setCache(`yield_${symbol}`, null);
  return null;
};

// ────────────────────── Top 5 Holdings ──────────────────────

const FALLBACK_HOLDINGS: Record<string, Holding[]> = {
  '0050': [
    { symbol: '2330', name: '台積電', weight: 52.4 },
    { symbol: '2317', name: '鴻海', weight: 8.2 },
    { symbol: '2454', name: '聯發科', weight: 4.5 },
    { symbol: '2308', name: '台達電', weight: 2.1 },
    { symbol: '2382', name: '廣達', weight: 1.8 },
  ],
  '006208': [
    { symbol: '2330', name: '台積電', weight: 52.3 },
    { symbol: '2317', name: '鴻海', weight: 8.1 },
    { symbol: '2454', name: '聯發科', weight: 4.4 },
    { symbol: '2308', name: '台達電', weight: 2.0 },
    { symbol: '2382', name: '廣達', weight: 1.7 },
  ],
  '0056': [
    { symbol: '2454', name: '聯發科', weight: 6.2 },
    { symbol: '2317', name: '鴻海', weight: 5.8 },
    { symbol: '2382', name: '廣達', weight: 5.5 },
    { symbol: '3231', name: '緯創', weight: 4.8 },
    { symbol: '2301', name: '光寶科', weight: 4.2 },
  ],
  '00878': [
    { symbol: '2382', name: '廣達', weight: 6.5 },
    { symbol: '2357', name: '華碩', weight: 6.1 },
    { symbol: '3231', name: '緯創', weight: 5.8 },
    { symbol: '2317', name: '鴻海', weight: 5.2 },
    { symbol: '2454', name: '聯發科', weight: 4.9 },
  ],
  '00919': [
    { symbol: '2603', name: '長榮', weight: 9.8 },
    { symbol: '2454', name: '聯發科', weight: 9.2 },
    { symbol: '3034', name: '聯詠', weight: 8.5 },
    { symbol: '2379', name: '瑞昱', weight: 7.2 },
    { symbol: '3044', name: '健鼎', weight: 6.8 },
  ],

  '00981A': [
    { symbol: '2330', name: '台積電', weight: 10.0 },
    { symbol: '2454', name: '聯發科', weight: 8.5 },
    { symbol: '2382', name: '廣達', weight: 6.2 },
  ],
  '00991A': [
    { symbol: '2330', name: '台積電', weight: 12.0 },
    { symbol: '2317', name: '鴻海', weight: 8.0 },
    { symbol: '3231', name: '緯創', weight: 6.5 },
  ],
  '00992A': [
    { symbol: '2330', name: '台積電', weight: 9.5 },
    { symbol: '2454', name: '聯發科', weight: 7.8 },
    { symbol: '3711', name: '日月光', weight: 5.5 },
  ],
  '00987A': [
    { symbol: '2330', name: '台積電', weight: 8.5 },
    { symbol: '3661', name: '世芯-KY', weight: 6.0 },
    { symbol: '3324', name: '雙鴻', weight: 5.5 },
  ],
  '00982A': [
    { symbol: '2330', name: '台積電', weight: 11.0 },
    { symbol: '2382', name: '廣達', weight: 7.0 },
    { symbol: '3661', name: '世芯-KY', weight: 6.5 },
  ],
  '00985A': [
    { symbol: '2330', name: '台積電', weight: 10.5 },
    { symbol: '2454', name: '聯發科', weight: 8.0 },
    { symbol: '2317', name: '鴻海', weight: 6.0 },
  ],
  '00980A': [
    { symbol: '2330', name: '台積電', weight: 9.0 },
    { symbol: '2881', name: '富邦金', weight: 6.5 },
    { symbol: '2882', name: '國泰金', weight: 5.5 },
  ],
  '00984A': [
    { symbol: '2454', name: '聯發科', weight: 8.5 },
    { symbol: '2603', name: '長榮', weight: 7.0 },
    { symbol: '2609', name: '陽明', weight: 6.5 },
  ],
  '00403A': [
    { symbol: '2330', name: '台積電', weight: 15.0 },
    { symbol: '2454', name: '聯發科', weight: 8.0 },
    { symbol: '2317', name: '鴻海', weight: 7.5 },
  ],

  '00929': [
    { symbol: '2330', name: '台積電', weight: 15.2 },
    { symbol: '2454', name: '聯發科', weight: 7.8 },
    { symbol: '3034', name: '聯詠', weight: 5.2 },
    { symbol: '2382', name: '廣達', weight: 4.5 },
    { symbol: '2308', name: '台達電', weight: 3.8 },
  ],
};

let liveHoldingsCache: any = null;
const fetchLiveHoldingsData = async () => {
  if (liveHoldingsCache) return liveHoldingsCache;
  try {
    const baseUrl = import.meta.env?.BASE_URL || '/';
    const res = await fetch(`${baseUrl}live_holdings.json`);
    const json = await res.json();
    liveHoldingsCache = json;
    return liveHoldingsCache;
  } catch {
    return null;
  }
};

export const fetchTopHoldings = async (symbol: string): Promise<Holding[]> => {
  const cached = getCache(`holdings_${symbol}`, LONG_CACHE_TTL);
  if (cached) return cached;

  // Prefer live_holdings.json data
  const liveData = await fetchLiveHoldingsData();
  if (liveData?.data?.[symbol] && liveData.data[symbol].length > 0) {
    const current = liveData.data[symbol];
    setCache(`holdings_${symbol}`, current);
    return current;
  }

  try {
    const res = await fetchWithTimeout(`${BASE}?dataset=TaiwanETFConstituents&data_id=${symbol}`, 8000);
    const json = await res.json();
    if (json.data && json.data.length > 0) {
      const latestDate = json.data[json.data.length - 1].date;
      const current = json.data
        .filter((d: any) => d.date === latestDate)
        .map((h: any) => ({
          symbol: h.constituent_stock_id,
          name: h.constituent_stock_name || h.constituent_stock_id,
          weight: h.proportion,
        }))
        .sort((a: Holding, b: Holding) => b.weight - a.weight)
        .slice(0, 10);
      if (current.length > 0) {
        setCache(`holdings_${symbol}`, current);
        return current;
      }
    }
  } catch {
    // fallback
  }
  const fallback = FALLBACK_HOLDINGS[symbol] || [];
  setCache(`holdings_${symbol}`, fallback);
  return fallback;
};

// ────────────────────── Weekly Holding Changes ──────────────────────

export const fetchWeeklyChanges = async (symbol: string): Promise<HoldingChange[]> => {
  const cached = getCache(`changes_${symbol}`, LONG_CACHE_TTL);
  if (cached) return cached;

  // Prefer live_holdings.json data
  const liveData = await fetchLiveHoldingsData();
  if (liveData?.changes?.[symbol] && liveData.changes[symbol].length > 0) {
    const changes = liveData.changes[symbol].map((c: any) => ({
      ...c,
      status: c.change > 0 ? 'increased' : (c.change < 0 ? 'decreased' : 'new')
    }));
    setCache(`changes_${symbol}`, changes);
    return changes;
  }

  try {
    const res = await fetchWithTimeout(`${BASE}?dataset=TaiwanETFConstituents&data_id=${symbol}`, 8000);
    const json = await res.json();
    if (!json.data || json.data.length === 0) return [];

    const dates = [...new Set(json.data.map((d: any) => d.date))].sort() as string[];
    if (dates.length < 2) return [];

    const latestDate = dates[dates.length - 1];
    const previousDate = dates[dates.length - 2];

    const toMap = (date: string): Record<string, { name: string; weight: number }> => {
      const map: Record<string, { name: string; weight: number }> = {};
      json.data
        .filter((d: any) => d.date === date)
        .forEach((d: any) => {
          map[d.constituent_stock_id] = {
            name: d.constituent_stock_name || d.constituent_stock_id,
            weight: d.proportion,
          };
        });
      return map;
    };

    const currentMap = toMap(latestDate);
    const previousMap = toMap(previousDate);

    const changes: HoldingChange[] = [];
    const allSymbols = new Set([...Object.keys(currentMap), ...Object.keys(previousMap)]);

    allSymbols.forEach(sym => {
      const curr = currentMap[sym];
      const prev = previousMap[sym];

      if (curr && !prev) {
        changes.push({ symbol: sym, name: curr.name, currentWeight: curr.weight, previousWeight: 0, change: curr.weight, status: 'new' });
      } else if (!curr && prev) {
        changes.push({ symbol: sym, name: prev.name, currentWeight: 0, previousWeight: prev.weight, change: -prev.weight, status: 'removed' });
      } else if (curr && prev) {
        const diff = Number((curr.weight - prev.weight).toFixed(4));
        if (Math.abs(diff) > 0.001) {
          changes.push({
            symbol: sym,
            name: curr.name,
            currentWeight: curr.weight,
            previousWeight: prev.weight,
            change: diff,
            status: diff > 0 ? 'increased' : 'decreased',
          });
        }
      }
    });

    const result = changes.sort((a, b) => Math.abs(b.change) - Math.abs(a.change)).slice(0, 10);
    setCache(`changes_${symbol}`, result);
    return result;
  } catch {
    return [];
  }
};
