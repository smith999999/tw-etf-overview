export interface ETFInfo {
  symbol: string;
  name: string;
  category: '市值型' | '高息型' | 'ESG型' | '科技型' | '主動型';
  expenseRatio: number; // 管理費 %
  issuer: string;
  launchDate: string;
}

export const ETF_LIST: ETFInfo[] = [
  // 市值型
  { symbol: '0050', name: '元大台灣50', category: '市值型', expenseRatio: 0.355, issuer: '元大', launchDate: '2003-06-30' },
  { symbol: '006208', name: '富邦台50', category: '市值型', expenseRatio: 0.302, issuer: '富邦', launchDate: '2012-07-17' },
  // 高息型
  { symbol: '0056', name: '元大高股息', category: '高息型', expenseRatio: 0.66, issuer: '元大', launchDate: '2007-12-26' },
  { symbol: '00878', name: '國泰永續高股息', category: '高息型', expenseRatio: 0.57, issuer: '國泰', launchDate: '2020-07-20' },
  { symbol: '00919', name: '群益台灣精選高息', category: '高息型', expenseRatio: 0.62, issuer: '群益', launchDate: '2022-10-20' },
  { symbol: '00929', name: '復華台灣科技優息', category: '高息型', expenseRatio: 0.54, issuer: '復華', launchDate: '2023-06-09' },
  { symbol: '00940', name: '元大台灣價值高息', category: '高息型', expenseRatio: 0.58, issuer: '元大', launchDate: '2024-03-20' },
  { symbol: '00939', name: '統一台灣高息動能', category: '高息型', expenseRatio: 0.55, issuer: '統一', launchDate: '2024-03-12' },
  { symbol: '00713', name: '元大台灣高息低波', category: '高息型', expenseRatio: 0.53, issuer: '元大', launchDate: '2017-09-19' },
  // ESG 型
  { symbol: '00850', name: '元大臺灣ESG永續', category: 'ESG型', expenseRatio: 0.46, issuer: '元大', launchDate: '2019-08-23' },
  // 科技型
  { symbol: '00881', name: '國泰台灣5G+', category: '科技型', expenseRatio: 0.50, issuer: '國泰', launchDate: '2020-12-10' },
  // 主動型 ETF
  { symbol: '00946', name: '群益台ESG主動優選', category: '主動型', expenseRatio: 1.15, issuer: '群益', launchDate: '2024-08-12' },
  { symbol: '00944', name: '野村臺灣趨勢動能', category: '主動型', expenseRatio: 1.10, issuer: '野村', launchDate: '2024-07-22' },
  { symbol: '00945', name: '凱基臺灣優選高息', category: '主動型', expenseRatio: 1.13, issuer: '凱基', launchDate: '2024-07-29' },
  { symbol: '00947', name: '安聯台灣智慧趨勢', category: '主動型', expenseRatio: 1.20, issuer: '安聯', launchDate: '2024-09-02' },
  { symbol: '00981A', name: '統一台股增長', category: '主動型', expenseRatio: 0.95, issuer: '統一', launchDate: '2024-10-01' },
  { symbol: '00991A', name: '復華未來50', category: '主動型', expenseRatio: 0.99, issuer: '復華', launchDate: '2024-10-01' },
  { symbol: '00992A', name: '群益科技創新', category: '主動型', expenseRatio: 0.95, issuer: '群益', launchDate: '2024-10-01' },
  { symbol: '00987A', name: '台新優勢成長', category: '主動型', expenseRatio: 0.99, issuer: '台新', launchDate: '2024-10-01' },
  { symbol: '00982A', name: '群益台灣精選強棒', category: '主動型', expenseRatio: 0.95, issuer: '群益', launchDate: '2024-10-01' },
  { symbol: '00985A', name: '野村台灣增強50', category: '主動型', expenseRatio: 0.99, issuer: '野村', launchDate: '2024-10-01' },
  { symbol: '00980A', name: '野村臺灣智慧優選', category: '主動型', expenseRatio: 0.99, issuer: '野村', launchDate: '2024-10-01' },
  { symbol: '00984A', name: '安聯台灣高息成長', category: '主動型', expenseRatio: 0.95, issuer: '安聯', launchDate: '2024-10-01' },
  { symbol: '00403A', name: '統一升級50', category: '主動型', expenseRatio: 0.95, issuer: '統一', launchDate: '2024-10-01' },
];

export const CATEGORY_COLORS: Record<string, string> = {
  '市值型': '#60a5fa',
  '高息型': '#f59e0b',
  'ESG型': '#34d399',
  '科技型': '#a78bfa',
  '主動型': '#f472b6',
};
