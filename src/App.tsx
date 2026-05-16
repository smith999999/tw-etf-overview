import React, { useState, useEffect, useCallback } from 'react';
import './index.css';
import { ETF_LIST, CATEGORY_COLORS, type ETFInfo } from './data/etfList';
import { fetchAllETFData, fetchTopHoldings, fetchWeeklyChanges, type ETFFullData, type Holding, type HoldingChange } from './data/api';
import { TrendingUp, Search, ChevronDown, BarChart3, Wallet, Percent, Zap, ArrowUpDown } from 'lucide-react';

type SortKey = 'symbol' | 'price' | 'nav' | 'premium' | 'expense' | 'r3m' | 'r6m' | 'r1y' | 'r3y' | 'yield';
type SortDir = 'asc' | 'desc';

function App() {
  const [data, setData] = useState<Record<string, ETFFullData>>({});
  const [loading, setLoading] = useState(true);
  const [loadProgress, setLoadProgress] = useState('');
  const [filter, setFilter] = useState<string>('全部');
  const [search, setSearch] = useState('');
  const [expandedRow, setExpandedRow] = useState<string | null>(null);
  const [holdings, setHoldings] = useState<Record<string, Holding[]>>({});
  const [changes, setChanges] = useState<Record<string, HoldingChange[]>>({});
  const [loadingDetail, setLoadingDetail] = useState<string | null>(null);
  const [sortKey, setSortKey] = useState<SortKey>('symbol');
  const [sortDir, setSortDir] = useState<SortDir>('asc');
  const [mobileReturnPeriod, setMobileReturnPeriod] = useState<SortKey>('r1y');

  const periodOptions: { key: SortKey; label: string }[] = [
    { key: 'r3m', label: '3M' },
    { key: 'r6m', label: '6M' },
    { key: 'r1y', label: '1Y' },
    { key: 'r3y', label: '3Y' },
  ];

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      const symbols = ETF_LIST.map(e => e.symbol);
      const result = await fetchAllETFData(symbols, (loaded, total, partial) => {
        setLoadProgress(`載入中 ${loaded}/${total}...`);
        setData({ ...partial });
      });
      setData(result);
      setLoadProgress('');
      setLoading(false);
    };
    load();
  }, []);

  const handleExpand = useCallback(async (symbol: string) => {
    if (expandedRow === symbol) {
      setExpandedRow(null);
      return;
    }
    setExpandedRow(symbol);
    if (!holdings[symbol]) {
      setLoadingDetail(symbol);
      const [h, c] = await Promise.allSettled([
        fetchTopHoldings(symbol),
        fetchWeeklyChanges(symbol),
      ]);
      setHoldings(prev => ({ ...prev, [symbol]: h.status === 'fulfilled' ? h.value : [] }));
      setChanges(prev => ({ ...prev, [symbol]: c.status === 'fulfilled' ? c.value : [] }));
      setLoadingDetail(null);
    }
  }, [expandedRow, holdings]);

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    } else {
      setSortKey(key);
      setSortDir('desc');
    }
  };

  const categories = ['全部', ...new Set(ETF_LIST.map(e => e.category))];

  const filtered = ETF_LIST.filter(etf => {
    if (filter !== '全部' && etf.category !== filter) return false;
    if (search && !etf.symbol.includes(search) && !etf.name.includes(search)) return false;
    return true;
  });

  const getSortValue = (etf: ETFInfo): number => {
    const d = data[etf.symbol];
    switch (sortKey) {
      case 'symbol': return 0;
      case 'price': return d?.price?.close ?? 0;
      case 'nav': return d?.nav ?? 0;
      case 'premium': return d?.premiumDiscount ?? 0;
      case 'expense': return etf.expenseRatio;
      case 'r3m': return d?.returns.threeMonth ?? -9999;
      case 'r6m': return d?.returns.sixMonth ?? -9999;
      case 'r1y': return d?.returns.oneYear ?? -9999;
      case 'r3y': return d?.returns.threeYear ?? -9999;
      case 'yield': return d?.dividendYield ?? 0;
      default: return 0;
    }
  };

  const sorted = [...filtered].sort((a, b) => {
    if (sortKey === 'symbol') {
      return sortDir === 'asc'
        ? a.symbol.localeCompare(b.symbol)
        : b.symbol.localeCompare(a.symbol);
    }
    const va = getSortValue(a);
    const vb = getSortValue(b);
    return sortDir === 'asc' ? va - vb : vb - va;
  });

  // Summary stats
  const loadedETFs = Object.values(data);
  const avgYield = loadedETFs.filter(d => d.dividendYield).reduce((s, d) => s + (d.dividendYield || 0), 0) / (loadedETFs.filter(d => d.dividendYield).length || 1);
  const avgReturn1Y = loadedETFs.filter(d => d.returns.oneYear !== null).reduce((s, d) => s + (d.returns.oneYear || 0), 0) / (loadedETFs.filter(d => d.returns.oneYear !== null).length || 1);
  const etfsWithPremium = loadedETFs.filter(d => d.premiumDiscount !== null);
  const premiumCount = etfsWithPremium.filter(d => d.premiumDiscount! > 0).length;

  const renderReturn = (val: number | null) => {
    if (val === null) return <span className="na-text">—</span>;
    const cls = val > 0 ? 'positive' : val < 0 ? 'negative' : 'neutral';
    const barWidth = Math.min(Math.abs(val) * 1.5, 50);
    return (
      <span className="return-bar">
        <span className={cls}>{val > 0 ? '+' : ''}{val.toFixed(2)}%</span>
        <span
          className="return-bar-fill"
          style={{
            width: `${barWidth}px`,
            background: val > 0 ? 'var(--accent-red)' : val < 0 ? 'var(--accent-green)' : 'var(--text-muted)',
          }}
        />
      </span>
    );
  };

  const SortHeader = ({ label, sKey, className }: { label: string; sKey: SortKey; className?: string }) => (
    <th onClick={() => handleSort(sKey)} className={`${sortKey === sKey ? 'sorted' : ''} ${className || ''}`}>
      {label}
      {sortKey === sKey && (
        <span className="sort-arrow">{sortDir === 'asc' ? '↑' : '↓'}</span>
      )}
    </th>
  );

  return (
    <div className="app">
      {/* Loading Progress Bar */}
      {loading && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, height: '3px',
          background: 'rgba(96, 165, 250, 0.2)', zIndex: 9999
        }}>
          <div style={{
            height: '100%', background: 'var(--accent-blue)',
            width: `${(loadedETFs.length / ETF_LIST.length) * 100}%`,
            transition: 'width 0.3s ease'
          }} />
        </div>
      )}

      {/* Header */}
      <header className="header">
        <div className="header-top">
          <div>
            <h1>
              <TrendingUp size={28} />
              台灣 ETF 投資資訊總覽
            </h1>
            <p className="header-subtitle">台灣市場主要股票型 ETF 即時比較 · 含首批主動型 ETF</p>
          </div>
          <div className="update-badge">
            <span className="dot" />
            {loading ? (loadProgress || '載入中...') : `資料更新：${loadedETFs[0]?.price?.date || '—'}`}
          </div>
        </div>
      </header>

      {/* Market Insight Banner */}
      {!loading && loadedETFs.length > 0 && (
        <div className="trend-banner" style={{
          background: 'rgba(96, 165, 250, 0.05)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius-md)',
          padding: '12px 20px',
          marginBottom: '20px',
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          fontSize: '0.85rem'
        }}>
          <Zap size={16} style={{ color: 'var(--accent-blue)' }} />
          <span>
            <b>今日亮點：</b>
            {(() => {
              const top = [...loadedETFs].sort((a, b) => (b.price?.changePercent || -99) - (a.price?.changePercent || -99))[0];
              const bestYear = [...loadedETFs].sort((a, b) => (b.returns.oneYear || -999) - (a.returns.oneYear || -999))[0];
              return (
                <>
                  <span style={{ color: 'var(--accent-red)' }}>{top?.symbol} {top?.price?.changePercent}%</span> (今日漲幅最高) · 
                  <span style={{ color: 'var(--accent-red)' }}> {bestYear?.symbol} +{bestYear?.returns.oneYear}%</span> (近一年表現最強)
                </>
              );
            })()}
          </span>
        </div>
      )}

      {/* Filter Bar */}
      <div className="filter-bar">
        {categories.map(cat => (
          <button
            key={cat}
            className={`filter-btn ${filter === cat ? 'active' : ''}`}
            data-cat={cat}
            onClick={() => setFilter(cat)}
          >
            {cat}
            {cat === '主動型' && <span style={{ marginLeft: 4, fontSize: '0.6rem', opacity: 0.8 }}>NEW</span>}
          </button>
        ))}
        <div className="search-box">
          <Search className="search-icon" size={16} />
          <input
            type="text"
            placeholder="搜尋 ETF 代號或名稱..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      {/* Mobile Return Period Selector */}
      <div className="mobile-period-selector show-mobile-only">
        <span className="selector-label">報酬率期間:</span>
        <div className="period-btns">
          {periodOptions.map(opt => (
            <button
              key={opt.key}
              className={`period-btn ${mobileReturnPeriod === opt.key ? 'active' : ''}`}
              onClick={() => setMobileReturnPeriod(opt.key)}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {filter === '主動型' && (
        <div style={{
          fontSize: '0.75rem',
          color: 'var(--text-muted)',
          marginBottom: '16px',
          padding: '10px 16px',
          background: 'rgba(244, 114, 182, 0.05)',
          borderRadius: 'var(--radius-sm)',
          borderLeft: '3px solid var(--accent-pink)'
        }}>
          💡 <b>主動型 ETF (Active ETF)：</b> 不追蹤特定指數，由經理人選股與頻繁換股以追求超越大盤的超額報酬。管理費通常較一般 ETF 高，持股資訊揭露可能具有延遲性。
        </div>
      )}

      {/* Summary Cards */}
      {!loading && (
        <div className="summary-row">
          <div className="summary-card">
            <div className="summary-icon blue"><BarChart3 size={22} /></div>
            <div>
              <div className="summary-label">追蹤 ETF 數</div>
              <div className="summary-value">{ETF_LIST.length}</div>
            </div>
          </div>
          <div className="summary-card">
            <div className="summary-icon amber"><Wallet size={22} /></div>
            <div>
              <div className="summary-label">平均殖利率</div>
              <div className="summary-value">{avgYield.toFixed(2)}%</div>
            </div>
          </div>
          <div className="summary-card">
            <div className="summary-icon green"><Zap size={22} /></div>
            <div>
              <div className="summary-label">平均年報酬</div>
              <div className="summary-value" style={{ color: avgReturn1Y >= 0 ? 'var(--accent-red)' : 'var(--accent-green)' }}>
                {avgReturn1Y >= 0 ? '+' : ''}{avgReturn1Y.toFixed(2)}%
              </div>
            </div>
          </div>
          <div className="summary-card">
            <div className="summary-icon pink"><Percent size={22} /></div>
            <div>
              <div className="summary-label">溢價中 ETF</div>
              <div className="summary-value">{premiumCount} / {etfsWithPremium.length}</div>
            </div>
          </div>
        </div>
      )}

      {/* Main Table */}
      {loading ? (
        <div className="table-wrapper">
          <div className="loading-overlay">
            <div className="spinner" />
            <div className="loading-text">正在載入 {ETF_LIST.length} 支 ETF 資料...</div>
          </div>
        </div>
      ) : (
        <div className="table-wrapper">
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <SortHeader label="ETF" sKey="symbol" />
                  <SortHeader label="市價" sKey="price" />
                  <SortHeader label="淨值" sKey="nav" />
                  <SortHeader label="溢價率" sKey="premium" />
                  <SortHeader label="管理費" sKey="expense" className="hide-mobile" />
                  <SortHeader label="3M" sKey="r3m" className="hide-mobile" />
                  <SortHeader label="6M" sKey="r6m" className="hide-mobile" />
                  <SortHeader 
                    label={periodOptions.find(o => o.key === mobileReturnPeriod)?.label + ' 報酬'} 
                    sKey={mobileReturnPeriod} 
                    className="show-mobile-important"
                  />
                  <SortHeader label="1Y" sKey="r1y" className="hide-mobile" />
                  <SortHeader label="3Y" sKey="r3y" className="hide-mobile" />
                  <SortHeader label="殖利率" sKey="yield" />
                  <th style={{ width: 40, cursor: 'default' }}><ArrowUpDown size={14} /></th>
                </tr>
              </thead>
              <tbody>
                {sorted.map(etf => {
                  const d = data[etf.symbol];
                  const isExpanded = expandedRow === etf.symbol;
                  return (
                    <React.Fragment key={etf.symbol}>
                      <tr
                        className={isExpanded ? 'expanded' : ''}
                        onClick={() => handleExpand(etf.symbol)}
                      >
                        <td>
                          <div className="etf-name-cell">
                            <div>
                              <div className="etf-symbol">{etf.symbol}</div>
                              <div className="etf-name">{etf.name}</div>
                              <div className="show-mobile-only etf-mobile-meta">
                                {etf.expenseRatio.toFixed(2)}% • {etf.category}
                              </div>
                            </div>
                            <span
                              className="category-badge hide-mobile"
                              style={{
                                background: `${CATEGORY_COLORS[etf.category]}20`,
                                color: CATEGORY_COLORS[etf.category],
                              }}
                            >
                              {etf.category}
                            </span>
                          </div>
                        </td>
                        <td>
                          {d?.price ? (
                            <div>
                              <div style={{ fontWeight: 600 }}>{d.price.close.toFixed(2)}</div>
                              <div className={d.price.change >= 0 ? 'positive' : 'negative'} style={{ fontSize: '0.7rem' }}>
                                {d.price.change >= 0 ? '▲' : '▼'} {Math.abs(d.price.change).toFixed(2)}
                                <span className="hide-mobile"> ({d.price.changePercent >= 0 ? '+' : ''}{d.price.changePercent}%)</span>
                              </div>
                            </div>
                          ) : <span className="skeleton" />}
                        </td>
                        <td>{d?.nav ? d.nav.toFixed(2) : <span className="na-text">—</span>}</td>
                        <td>
                          {d?.premiumDiscount !== null && d?.premiumDiscount !== undefined ? (
                            <span className={`premium-chip ${d.premiumDiscount > 0.1 ? 'positive' : d.premiumDiscount < -0.1 ? 'negative' : 'neutral'}`}>
                              {d.premiumDiscount > 0 ? '+' : ''}{d.premiumDiscount.toFixed(2)}%
                            </span>
                          ) : <span className="na-text">—</span>}
                        </td>
                        <td className="hide-mobile" style={{ color: etf.expenseRatio >= 1 ? 'var(--accent-amber)' : 'var(--text-secondary)' }}>
                          {etf.expenseRatio.toFixed(2)}%
                        </td>
                        <td className="hide-mobile">{renderReturn(d?.returns.threeMonth ?? null)}</td>
                        <td className="hide-mobile">{renderReturn(d?.returns.sixMonth ?? null)}</td>
                        <td className="show-mobile-important">
                          {renderReturn(
                            mobileReturnPeriod === 'r3m' ? (d?.returns.threeMonth ?? null) :
                            mobileReturnPeriod === 'r6m' ? (d?.returns.sixMonth ?? null) :
                            mobileReturnPeriod === 'r3y' ? (d?.returns.threeYear ?? null) :
                            (d?.returns.oneYear ?? null)
                          )}
                        </td>
                        <td className="hide-mobile">{renderReturn(d?.returns.oneYear ?? null)}</td>
                        <td className="hide-mobile">{renderReturn(d?.returns.threeYear ?? null)}</td>
                        <td>
                          {d?.dividendYield !== null && d?.dividendYield !== undefined ? (
                            <span style={{ color: 'var(--accent-amber)', fontWeight: 600 }}>
                              {d.dividendYield.toFixed(2)}%
                            </span>
                          ) : <span className="na-text">—</span>}
                        </td>
                        <td>
                          <span className={`expand-arrow ${isExpanded ? 'open' : ''}`}>
                            <ChevronDown size={16} />
                          </span>
                        </td>
                      </tr>
                      {isExpanded && (
                        <tr key={`${etf.symbol}-expanded`} className="expanded-row">
                          <td colSpan={11}>
                            <div className="expanded-content">
                              <div className="etf-meta-row">
                                <div className="meta-card">
                                  <span className="meta-label">經理費 / 管理費</span>
                                  <span className="meta-value">{etf.expenseRatio.toFixed(2)}%</span>
                                </div>
                                <div className="meta-card">
                                  <span className="meta-label">發行券商</span>
                                  <span className="meta-value">{etf.issuer}投信</span>
                                </div>
                                <div className="meta-card">
                                  <span className="meta-label">上市日期</span>
                                  <span className="meta-value">{etf.launchDate}</span>
                                </div>
                                <div className="meta-card">
                                  <span className="meta-label">ETF 類別</span>
                                  <span className="meta-value">{etf.category}</span>
                                </div>
                              </div>

                              {/* Top 10 Holdings */}
                              <div className="expanded-section">
                                <h4>📋 前 10 大持股</h4>
                                <div className="section-subtitle">
                                  <span>與前日變動 (張數)</span>
                                  <span className="hide-mobile"> • 今日個股漲跌 (▲▼)</span>
                                </div>

                                {loadingDetail === etf.symbol ? (
                                  <div className="no-data">
                                    <div className="spinner" style={{ width: 24, height: 24, borderWidth: 2 }} />
                                  </div>
                                ) : holdings[etf.symbol]?.length ? (
                                  <ul className="holdings-list">
                                    {holdings[etf.symbol].slice(0, 10).map((h, i) => (
                                      <li key={h.symbol}>
                                          <div className="holding-info">
                                            <span className="holding-rank">{i + 1}</span>
                                            <span className="holding-name">{h.name}</span>
                                            {h.weightChange !== undefined && h.weightChange !== 0 && (
                                              <span className={`weight-action-badge ${h.weightChange > 0 ? 'plus' : 'minus'}`}>
                                                {h.weightChange > 0 ? '加碼' : '減碼'}
                                              </span>
                                            )}
                                            <span className="holding-symbol">{h.symbol}</span>
                                          </div>
                                          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                                            {h.todayChange !== undefined && h.todayChange !== null && (
                                              <span className={`holding-day-change ${h.todayChange > 0 ? 'positive' : h.todayChange < 0 ? 'negative' : ''}`}>
                                                {h.todayChange > 0 ? '▲' : h.todayChange < 0 ? '▼' : ''}
                                                {Math.abs(h.todayChange).toFixed(2)}%
                                              </span>
                                            )}
                                            <div className="weight-display-group">
                                              <span className="holding-weight">{h.weight.toFixed(2)}%</span>
                                              {h.sharesChange !== undefined && h.sharesChange !== 0 && (
                                                <span className={`weight-change-mini ${h.sharesChange > 0 ? 'positive' : 'negative'}`}>
                                                  {h.sharesChange > 0 ? '+' : ''}{h.sharesChange.toLocaleString()}張
                                                </span>
                                              )}
                                            </div>
                                            <div className="weight-bar">
                                              <div className="weight-bar-fill" style={{ width: `${Math.min(h.weight * 1.8, 100)}%` }} />
                                            </div>
                                          </div>
                                      </li>
                                    ))}
                                  </ul>
                                ) : (
                                  <div className="no-data">暫無持股資料（主動型 ETF 不公開即時成分股）</div>
                                )}
                              </div>

                              {/* Weekly Changes */}
                              <div className="expanded-section">
                                <h4>📊 本週持股變化</h4>
                                {loadingDetail === etf.symbol ? (
                                  <div className="no-data">
                                    <div className="spinner" style={{ width: 24, height: 24, borderWidth: 2 }} />
                                  </div>
                                ) : changes[etf.symbol]?.length ? (
                                  <div>
                                    {changes[etf.symbol].slice(0, 8).map(c => (
                                      <div key={c.symbol} className="change-item">
                                        <div className="holding-info">
                                          <span className="holding-name">{c.name}</span>
                                          <span className="holding-symbol">{c.symbol}</span>
                                        </div>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                          <span className={`change-value ${c.change > 0 ? 'positive' : 'negative'}`}>
                                            {c.change > 0 ? '+' : ''}{c.change.toFixed(2)}%
                                          </span>
                                          <span className={`change-badge ${c.status}`}>
                                            {c.status === 'new' ? '新增' : c.status === 'removed' ? '移除' : c.status === 'increased' ? '增加' : '減少'}
                                          </span>
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                ) : (
                                  <div className="no-data">暫無變化資料或尚未換股</div>
                                )}
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Footer */}
      <footer className="footer">
        <div className="footer-text">
          資料來源：FinMind 台灣股票資料 API<br />
          管理費為經理費+保管費（含規費），數據僅供參考
        </div>
        <div className="footer-disclaimer">
          ⚠️ 免責聲明：本頁面僅供資訊參考，不構成投資建議。投資前請自行評估風險。主動型 ETF 持股資訊可能延遲揭露。
        </div>
      </footer>
    </div>
  );
}

export default App;
