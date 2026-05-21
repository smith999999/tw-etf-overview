import React, { useEffect, useState } from 'react';
import {
  fetchAllETFData,
  fetchOHLCData,
  fetchTopHoldings,
  fetchWeeklyChanges,
  fetchDividendHistory,
  fetchInstitutionalInvestorsData,
  fetchLiveHoldingsData,
} from '../data/api';
import type {
  ETFFullData,
  OHLCPoint,
  Holding,
  HoldingChange,
  DividendPoint,
} from '../data/api';
import { ETF_LIST, CATEGORY_COLORS } from '../data/etfList';
import type { ETFInfo } from '../data/etfList';
import { CandlestickChart } from './CandlestickChart';

interface ETFDetailProps {
  symbol: string;
  isStock?: boolean;
  stockName?: string;
  onBack: () => void;
}

export const ETFDetail: React.FC<ETFDetailProps> = ({ symbol, isStock = false, stockName = '', onBack }) => {
  const [loading, setLoading] = useState(true);
  const [etfInfo, setEtfInfo] = useState<ETFInfo | null>(null);
  const [etfData, setEtfData] = useState<ETFFullData | null>(null);
  const [ohlcData, setOhlcData] = useState<OHLCPoint[]>([]);
  const [holdings, setHoldings] = useState<Holding[]>([]);
  const [changes, setChanges] = useState<HoldingChange[]>([]);
  const [dividends, setDividends] = useState<DividendPoint[]>([]);
  const [chips, setChips] = useState<any[] | null>(null);
  const [period, setPeriod] = useState<string>('1Y');
  const [heldByETFs, setHeldByETFs] = useState<{ symbol: string; name: string; weight: number }[]>([]);

  useEffect(() => {
    if (isStock) {
      setEtfInfo({
        symbol,
        name: stockName || '台股個股',
        category: '個股',
        issuer: '台灣股市',
        expenseRatio: 0,
        launchDate: '—',
      });
    } else {
      const info = ETF_LIST.find((e) => e.symbol === symbol) || null;
      setEtfInfo(info);
    }
  }, [symbol, isStock, stockName]);

  useEffect(() => {
    const loadAllData = async () => {
      setLoading(true);
      try {
        const promises: Promise<any>[] = [
          fetchAllETFData([symbol]),
          fetchOHLCData(symbol, period),
          isStock ? Promise.resolve([]) : fetchTopHoldings(symbol),
          isStock ? Promise.resolve([]) : fetchWeeklyChanges(symbol),
          fetchDividendHistory(symbol),
          fetchInstitutionalInvestorsData(symbol),
        ];

        if (isStock) {
          promises.push(fetchLiveHoldingsData());
        }

        const resolved = await Promise.all(promises);
        const [fullDataMap, ohlc, topHoldings, weeklyChanges, divHist, chipData, liveHoldings] = resolved;

        setEtfData(fullDataMap[symbol] || null);
        setOhlcData(ohlc);
        setHoldings(isStock ? [] : topHoldings);
        setChanges(isStock ? [] : weeklyChanges);
        setDividends(divHist);
        setChips(chipData);

        if (isStock && liveHoldings?.data) {
          const list: { symbol: string; name: string; weight: number }[] = [];
          Object.entries(liveHoldings.data).forEach(([etfSymbol, etfHoldings]: [string, any]) => {
            const h = etfHoldings.find((item: any) => item.symbol === symbol);
            if (h) {
              const etfConf = ETF_LIST.find(e => e.symbol === etfSymbol);
              list.push({
                symbol: etfSymbol,
                name: etfConf?.name || etfSymbol,
                weight: h.weight,
              });
            }
          });
          setHeldByETFs(list.sort((a, b) => b.weight - a.weight));
        }
      } catch (err) {
        console.error('Failed to load ETF detail data', err);
      } finally {
        setLoading(false);
      }
    };

    loadAllData();
  }, [symbol, period, isStock]);

  if (!etfInfo) {
    return (
      <div className="flex flex-col items-center justify-center h-[500px] text-slate-400 bg-slate-900/20 backdrop-blur-md rounded-3xl border border-slate-800/80 p-8">
        <div className="text-xl font-medium mb-4">找不到該 ETF 資訊</div>
        <button onClick={onBack} className="btn-primary">返回總覽</button>
      </div>
    );
  }

  const badgeColor = CATEGORY_COLORS[etfInfo.category] || '#64748b';

  return (
    <div className="space-y-6">
      {/* 1. Header / Navigation */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-slate-900/30 border border-slate-800/50 rounded-2xl p-6 backdrop-blur-md">
        <div className="flex items-center gap-4">
          <button
            onClick={onBack}
            className="flex items-center justify-center w-10 h-10 rounded-xl bg-slate-800/60 hover:bg-slate-700/80 text-slate-300 border border-slate-700/40 hover:border-slate-600 transition-all cursor-pointer"
            title="返回總覽"
          >
            ←
          </button>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-2xl md:text-3xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-slate-100 to-slate-300">
                {etfInfo.name}
              </span>
              <span className="text-lg font-mono text-slate-400">({etfInfo.symbol})</span>
              <span
                className="px-2.5 py-0.5 rounded-full text-xs font-semibold"
                style={{ backgroundColor: `${badgeColor}20`, color: badgeColor, border: `1px solid ${badgeColor}30` }}
              >
                {etfInfo.category}
              </span>
            </div>
            <div className="text-sm text-slate-400 mt-1">
              發行券商：{etfInfo.issuer} ｜ 上市日期：{etfInfo.launchDate}
            </div>
          </div>
        </div>

        {/* Live quote metrics */}
        {etfData?.price && (
          <div className="flex items-center gap-6">
            <div className="text-right">
              <div className="text-sm text-slate-400">最新收盤價</div>
              <div className="text-2xl font-black font-mono text-slate-100">
                {etfData.price.close.toFixed(2)}
              </div>
              <div className={`text-xs font-semibold ${etfData.price.changePercent >= 0 ? 'text-red-400' : 'text-green-400'}`}>
                {etfData.price.changePercent >= 0 ? '+' : ''}{etfData.price.change.toFixed(2)} ({etfData.price.changePercent}%)
              </div>
            </div>

            {!isStock && (
              <>
                <div className="w-[1px] h-10 bg-slate-800" />
                <div className="text-right">
                  <div className="text-sm text-slate-400">最新淨值</div>
                  <div className="text-2xl font-black font-mono text-slate-200">
                    {etfData.nav ? etfData.nav.toFixed(2) : '--'}
                  </div>
                  <div className={`text-xs font-semibold ${etfData.premiumDiscount && etfData.premiumDiscount >= 0 ? 'text-red-400' : 'text-green-400'}`}>
                    {etfData.premiumDiscount !== null
                      ? `${etfData.premiumDiscount >= 0 ? '溢價' : '折價'} ${Math.abs(etfData.premiumDiscount).toFixed(2)}%`
                      : '--'}
                  </div>
                </div>
              </>
            )}
          </div>
        )}
      </div>

      {/* 2. Main Content Grid (K-line & KPI Cards) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* K-line Chart Area */}
        <div className="lg:col-span-2 space-y-4">
          <div className="bg-slate-900/20 border border-slate-800/40 rounded-3xl p-6 backdrop-blur-md space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold text-slate-200 flex items-center gap-2">
                <span className="w-1.5 h-4 bg-blue-500 rounded-full" />
                互動式 K 線技術分析
              </h3>
              <div className="flex bg-slate-950/80 p-1 rounded-xl border border-slate-800/60 font-mono text-xs">
                {['1M', '3M', '6M', '1Y', '3Y'].map((p) => (
                  <button
                    key={p}
                    onClick={() => setPeriod(p)}
                    className={`px-3 py-1.5 rounded-lg font-bold transition-all cursor-pointer ${
                      period === p
                        ? 'bg-blue-600/30 text-blue-400 border border-blue-500/20 shadow-md'
                        : 'text-slate-400 hover:text-slate-200 border border-transparent'
                    }`}
                  >
                    {p}
                  </button>
                ))}
              </div>
            </div>

            {loading ? (
              <div className="flex flex-col items-center justify-center h-[420px] text-slate-500">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mb-3" />
                載入 K 線圖數據中...
              </div>
            ) : ohlcData.length > 0 ? (
              <CandlestickChart data={ohlcData} />
            ) : (
              <div className="flex items-center justify-center h-[420px] text-slate-500 border border-dashed border-slate-800 rounded-2xl">
                無 K 線圖數據
              </div>
            )}
          </div>

          {/* Institutional Investors Panel */}
          {chips && chips.length > 0 && (
            <div className="bg-slate-900/20 border border-slate-800/40 rounded-3xl p-6 backdrop-blur-md">
              <h3 className="text-lg font-bold text-slate-200 flex items-center gap-2 mb-4">
                <span className="w-1.5 h-4 bg-purple-500 rounded-full" />
                三大法人近期買賣超 (張)
              </h3>
              <div className="overflow-x-auto">
                <table className="w-full text-sm text-left">
                  <thead>
                    <tr className="text-xs text-slate-400 border-b border-slate-800/60 pb-2">
                      <th className="py-2">日期</th>
                      <th className="py-2 text-right">外資</th>
                      <th className="py-2 text-right">投信</th>
                      <th className="py-2 text-right">自營商</th>
                      <th className="py-2 text-right">合計</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/40 font-mono">
                    {chips.map((day: any, idx) => {
                      const total = day.foreign + day.investment + day.dealer;
                      return (
                        <tr key={idx} className="hover:bg-slate-800/10">
                          <td className="py-2.5 text-slate-300 font-medium">{day.date}</td>
                          <td className={`py-2.5 text-right font-semibold ${day.foreign >= 0 ? 'text-red-400' : 'text-green-400'}`}>
                            {day.foreign >= 0 ? '+' : ''}{day.foreign.toLocaleString()}
                          </td>
                          <td className={`py-2.5 text-right font-semibold ${day.investment >= 0 ? 'text-red-400' : 'text-green-400'}`}>
                            {day.investment >= 0 ? '+' : ''}{day.investment.toLocaleString()}
                          </td>
                          <td className={`py-2.5 text-right font-semibold ${day.dealer >= 0 ? 'text-red-400' : 'text-green-400'}`}>
                            {day.dealer >= 0 ? '+' : ''}{day.dealer.toLocaleString()}
                          </td>
                          <td className={`py-2.5 text-right font-bold ${total >= 0 ? 'text-red-400' : 'text-green-400'}`}>
                            {total >= 0 ? '+' : ''}{total.toLocaleString()}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        {/* Sidebar Panel (KPIs & Metrics) */}
        <div className="space-y-6">
          {/* Key Parameters Cards */}
          <div className="bg-slate-900/20 border border-slate-800/40 rounded-3xl p-6 backdrop-blur-md space-y-4">
            <h3 className="text-lg font-bold text-slate-200 flex items-center gap-2">
              <span className="w-1.5 h-4 bg-emerald-500 rounded-full" />
              關鍵核心指標
            </h3>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-slate-950/60 border border-slate-800/60 rounded-xl p-3.5">
                <div className="text-xs text-slate-400">殖利率 (1年)</div>
                <div className="text-lg font-black font-mono text-emerald-400 mt-1">
                  {etfData?.dividendYield ? `${etfData.dividendYield.toFixed(2)}%` : '--'}
                </div>
              </div>

              <div className="bg-slate-950/60 border border-slate-800/60 rounded-xl p-3.5">
                {isStock ? (
                  <>
                    <div className="text-xs text-slate-400">個股代號</div>
                    <div className="text-lg font-black font-mono text-indigo-400 mt-1">
                      {symbol}
                    </div>
                  </>
                ) : (
                  <>
                    <div className="text-xs text-slate-400">管理費 (年)</div>
                    <div className="text-lg font-black font-mono text-indigo-400 mt-1">
                      {etfInfo.expenseRatio.toFixed(3)}%
                    </div>
                  </>
                )}
              </div>
            </div>

            {/* Performance Period */}
            {etfData?.returns && (
              <div className="bg-slate-950/60 border border-slate-800/60 rounded-2xl p-4 space-y-3">
                <div className="text-xs font-bold text-slate-300 border-b border-slate-800 pb-1.5">
                  歷史含息報酬率 (含還原)
                </div>
                <div className="grid grid-cols-2 gap-3 text-xs font-mono">
                  <div className="flex justify-between">
                    <span className="text-slate-400">3 個月:</span>
                    <span className={`font-bold ${Number(etfData.returns.threeMonth) >= 0 ? 'text-red-400' : 'text-green-400'}`}>
                      {etfData.returns.threeMonth !== null ? `${etfData.returns.threeMonth}%` : '--'}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">6 個月:</span>
                    <span className={`font-bold ${Number(etfData.returns.sixMonth) >= 0 ? 'text-red-400' : 'text-green-400'}`}>
                      {etfData.returns.sixMonth !== null ? `${etfData.returns.sixMonth}%` : '--'}
                    </span>
                  </div>
                  <div className="flex justify-between border-t border-slate-800/40 pt-1.5">
                    <span className="text-slate-400">1 年 (1Y):</span>
                    <span className={`font-bold ${Number(etfData.returns.oneYear) >= 0 ? 'text-red-400' : 'text-green-400'}`}>
                      {etfData.returns.oneYear !== null ? `${etfData.returns.oneYear}%` : '--'}
                    </span>
                  </div>
                  <div className="flex justify-between border-t border-slate-800/40 pt-1.5">
                    <span className="text-slate-400">3 年 (CAGR):</span>
                    <span className={`font-bold ${Number(etfData.returns.threeYear) >= 0 ? 'text-red-400' : 'text-green-400'}`}>
                      {etfData.returns.threeYear !== null ? `${etfData.returns.threeYear}%` : '--'}
                    </span>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Holdings List Section or Stock Held By ETFs Radar */}
          <div className="bg-slate-900/20 border border-slate-800/40 rounded-3xl p-6 backdrop-blur-md space-y-4">
            {isStock ? (
              <>
                <h3 className="text-lg font-bold text-slate-200 flex items-center gap-2">
                  <span className="w-1.5 h-4 bg-orange-500 rounded-full" />
                  熱門持有此股的 ETF 基金雷達
                </h3>
                {heldByETFs.length > 0 ? (
                  <div className="space-y-3 max-h-[400px] overflow-y-auto pr-1">
                    {heldByETFs.map((e, i) => (
                      <div key={e.symbol} className="bg-slate-950/60 border border-slate-800/40 rounded-xl p-3.5 hover:border-slate-700/60 transition-all">
                        <div className="flex items-center justify-between">
                          <div>
                            <div className="font-bold text-slate-200 text-sm flex items-center gap-1.5">
                              <span className="text-xs text-slate-500 font-mono">#{i + 1}</span>
                              <a href={`#/etf/${e.symbol}`} className="stock-symbol-link hover:underline">
                                {e.name}
                              </a>
                              <span className="text-xs text-slate-500 font-mono">({e.symbol})</span>
                            </div>
                            <div className="text-xs text-slate-400 mt-1">
                              持股權重: <span className="font-bold text-slate-300 font-mono">{e.weight.toFixed(2)}%</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-6 text-slate-500 text-xs border border-dashed border-slate-800 rounded-xl">
                    目前無熱門 ETF 持有此個股之數據
                  </div>
                )}
              </>
            ) : (
              <>
                <h3 className="text-lg font-bold text-slate-200 flex items-center gap-2">
                  <span className="w-1.5 h-4 bg-orange-500 rounded-full" />
                  前 10 大持股與張數變動
                </h3>

                {holdings.length > 0 ? (
                  <div className="space-y-3 max-h-[400px] overflow-y-auto pr-1">
                    {holdings.map((h, i) => {
                      // Find weekly changes if exists
                      const changeItem = changes.find((c) => c.symbol === h.symbol);
                      
                      // Safe shares change handling
                      const sharesChangeVal = h.sharesChange !== undefined ? h.sharesChange : (changeItem ? changeItem.change : undefined);
                      const isIncrease = sharesChangeVal !== undefined && sharesChangeVal > 0;

                      return (
                        <div key={h.symbol} className="bg-slate-950/60 border border-slate-800/40 rounded-xl p-3.5 hover:border-slate-700/60 transition-all">
                          <div className="flex items-center justify-between">
                            <div>
                              <div className="font-bold text-slate-200 text-sm flex items-center gap-1.5">
                                <span className="text-xs text-slate-500 font-mono">#{i + 1}</span>
                                <a href={`#/stock/${h.symbol}?name=${encodeURIComponent(h.name)}`} className="stock-symbol-link hover:underline">
                                  {h.name}
                                </a>
                                <span className="text-xs text-slate-500 font-mono">({h.symbol})</span>
                              </div>
                              <div className="text-xs text-slate-400 mt-1">
                                權重: <span className="font-bold text-slate-300 font-mono">{h.weight.toFixed(2)}%</span>
                              </div>
                            </div>

                            {/* Shares / Changes Badge */}
                            <div className="text-right">
                              {h.shares !== undefined && (
                                <div className="text-xs text-slate-400 font-mono mb-0.5">
                                  {Math.round(h.shares).toLocaleString()} 張
                                </div>
                              )}
                              
                              {h.isNew ? (
                                <span className="px-2 py-0.5 rounded-lg text-xs font-bold font-mono bg-blue-500/15 text-blue-400 border border-blue-500/20">
                                  新進前十
                                </span>
                              ) : (
                                sharesChangeVal !== undefined && sharesChangeVal !== 0 && (
                                  <span
                                    className={`px-2 py-0.5 rounded-lg text-xs font-bold font-mono ${
                                      isIncrease 
                                        ? 'bg-red-500/15 text-red-400 border border-red-500/20' 
                                        : 'bg-green-500/15 text-green-400 border border-green-500/20'
                                    }`}
                                  >
                                    {isIncrease ? '加碼' : '減碼'} {isIncrease ? '+' : ''}{Math.round(sharesChangeVal).toLocaleString()} 張
                                  </span>
                                )
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="text-center py-6 text-slate-500 text-xs border border-dashed border-slate-800 rounded-xl">
                    無持股明細數據
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>

      {/* 3. Dividends History Table (Full Width) */}
      <div className="bg-slate-900/20 border border-slate-800/40 rounded-3xl p-6 backdrop-blur-md">
        <h3 className="text-lg font-bold text-slate-200 flex items-center gap-2 mb-4">
          <span className="w-1.5 h-4 bg-sky-500 rounded-full" />
          近三年歷史配息記錄
        </h3>

        {dividends.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {dividends.map((div, index) => {
              // Yield based on static nav or latest price for simulation reference
              const estYield = etfData?.price?.close 
                ? Number((div.amount / etfData.price.close * 100).toFixed(2))
                : undefined;

              return (
                <div key={index} className="bg-slate-950/60 border border-slate-800/60 rounded-2xl p-4 flex flex-col justify-between">
                  <div className="text-xs text-slate-400">除息日</div>
                  <div className="text-base font-bold font-mono text-slate-200 mt-1">{div.date}</div>
                  
                  <div className="mt-3 pt-3 border-t border-slate-800/50 flex justify-between items-end">
                    <div>
                      <div className="text-[10px] text-slate-400">現金股利 (元)</div>
                      <div className="text-xl font-black font-mono text-sky-400 mt-0.5">
                        {div.amount.toFixed(4)}
                      </div>
                    </div>
                    {estYield && (
                      <div className="text-right">
                        <div className="text-[10px] text-slate-400">當期殖利率</div>
                        <div className="text-xs font-bold text-slate-300 font-mono mt-0.5">
                          ~{estYield}%
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="text-center py-8 text-slate-500 text-sm border border-dashed border-slate-800 rounded-2xl">
            此 ETF 近三年無發放配息記錄或查無配息數據。
          </div>
        )}
      </div>
    </div>
  );
};
