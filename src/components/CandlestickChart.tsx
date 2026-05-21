import React, { useEffect, useRef, useState } from 'react';
import { createChart, ColorType, CandlestickSeries, LineSeries, HistogramSeries } from 'lightweight-charts';
import type { OHLCPoint } from '../data/api';

interface CandlestickChartProps {
  data: OHLCPoint[];
}

export const CandlestickChart: React.FC<CandlestickChartProps> = ({ data }) => {
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const legendRef = useRef<HTMLDivElement>(null);
  const [hoveredData, setHoveredData] = useState<{
    time: string;
    open: number;
    high: number;
    low: number;
    close: number;
    volume: number;
    ma5?: number;
    ma20?: number;
    ma60?: number;
  } | null>(null);

  // Helper to compute Moving Averages
  const computeMA = (points: OHLCPoint[], period: number) => {
    const maData = [];
    for (let i = 0; i < points.length; i++) {
      if (i < period - 1) continue;
      let sum = 0;
      for (let j = 0; j < period; j++) {
        sum += points[i - j].close;
      }
      maData.push({
        time: points[i].time,
        value: Number((sum / period).toFixed(2))
      });
    }
    return maData;
  };

  useEffect(() => {
    if (!chartContainerRef.current || data.length === 0) return;

    // 1. Create Chart Instance
    const chart = createChart(chartContainerRef.current, {
      layout: {
        background: { type: ColorType.Solid, color: 'transparent' },
        textColor: '#94a3b8',
        fontSize: 12,
        fontFamily: 'Inter, system-ui, sans-serif',
      },
      grid: {
        vertLines: { color: 'rgba(148, 163, 184, 0.05)' },
        horzLines: { color: 'rgba(148, 163, 184, 0.05)' },
      },
      crosshair: {
        mode: 1, // Magnet
        vertLine: {
          color: '#64748b',
          width: 1,
          style: 3, // Dotted
          labelBackgroundColor: '#334155',
        },
        horzLine: {
          color: '#64748b',
          width: 1,
          style: 3,
          labelBackgroundColor: '#334155',
        },
      },
      timeScale: {
        borderColor: 'rgba(148, 163, 184, 0.1)',
        rightOffset: 5,
        barSpacing: 8,
      },
      rightPriceScale: {
        borderColor: 'rgba(148, 163, 184, 0.1)',
      },
    });

    // 2. Add Candlestick Series (Taiwan Standard: Red = Up, Green = Down)
    const candlestickSeries = chart.addSeries(CandlestickSeries, {
      upColor: '#ef4444',
      downColor: '#22c55e',
      borderUpColor: '#ef4444',
      borderDownColor: '#22c55e',
      wickUpColor: '#ef4444',
      wickDownColor: '#22c55e',
    });

    candlestickSeries.setData(data);

    // 3. Add MA Line Series
    const ma5Data = computeMA(data, 5);
    const ma20Data = computeMA(data, 20);
    const ma60Data = computeMA(data, 60);

    const ma5Series = chart.addSeries(LineSeries, {
      color: '#f59e0b',
      lineWidth: 2,
      title: 'MA5',
      priceLineVisible: false,
    });
    ma5Series.setData(ma5Data);

    const ma20Series = chart.addSeries(LineSeries, {
      color: '#8b5cf6',
      lineWidth: 2,
      title: 'MA20',
      priceLineVisible: false,
    });
    ma20Series.setData(ma20Data);

    const ma60Series = chart.addSeries(LineSeries, {
      color: '#10b981',
      lineWidth: 2,
      title: 'MA60',
      priceLineVisible: false,
    });
    ma60Series.setData(ma60Data);

    // 4. Add Volume Series (Overlay at bottom pane)
    const volumeSeries = chart.addSeries(HistogramSeries, {
      priceFormat: {
        type: 'volume',
      },
      priceScaleId: '', // Overlay pane
    });

    volumeSeries.priceScale().applyOptions({
      scaleMargins: {
        top: 0.75, // Occupies lower 25% of chart
        bottom: 0,
      },
    });

    const volumeData = data.map(item => ({
      time: item.time,
      value: item.volume,
      color: item.close >= item.open ? 'rgba(239, 68, 68, 0.35)' : 'rgba(34, 197, 94, 0.35)',
    }));

    volumeSeries.setData(volumeData);

    // Set initial legend data to the latest point
    const lastPoint = data[data.length - 1];
    const lastMA5 = ma5Data.find(m => m.time === lastPoint.time)?.value;
    const lastMA20 = ma20Data.find(m => m.time === lastPoint.time)?.value;
    const lastMA60 = ma60Data.find(m => m.time === lastPoint.time)?.value;

    setHoveredData({
      time: lastPoint.time,
      open: lastPoint.open,
      high: lastPoint.high,
      low: lastPoint.low,
      close: lastPoint.close,
      volume: lastPoint.volume,
      ma5: lastMA5,
      ma20: lastMA20,
      ma60: lastMA60,
    });

    // 5. Crosshair / Hover Interaction
    chart.subscribeCrosshairMove(param => {
      if (
        param.point === undefined ||
        !param.time ||
        param.point.x < 0 ||
        param.point.y < 0
      ) {
        // Fallback to latest
        setHoveredData({
          time: lastPoint.time,
          open: lastPoint.open,
          high: lastPoint.high,
          low: lastPoint.low,
          close: lastPoint.close,
          volume: lastPoint.volume,
          ma5: lastMA5,
          ma20: lastMA20,
          ma60: lastMA60,
        });
        return;
      }

      const timeStr = param.time as string;
      const klineData = param.seriesData.get(candlestickSeries) as any;
      const volData = param.seriesData.get(volumeSeries) as any;
      const m5 = param.seriesData.get(ma5Series) as any;
      const m20 = param.seriesData.get(ma20Series) as any;
      const m60 = param.seriesData.get(ma60Series) as any;

      if (klineData) {
        setHoveredData({
          time: timeStr,
          open: klineData.open,
          high: klineData.high,
          low: klineData.low,
          close: klineData.close,
          volume: volData ? volData.value : 0,
          ma5: m5 ? m5.value : undefined,
          ma20: m20 ? m20.value : undefined,
          ma60: m60 ? m60.value : undefined,
        });
      }
    });

    // 6. Responsive Resize Observer
    const resizeObserver = new ResizeObserver(entries => {
      if (entries.length === 0 || !entries[0].contentRect) return;
      const { width, height } = entries[0].contentRect;
      chart.resize(width, height);
    });

    resizeObserver.observe(chartContainerRef.current);

    // Fit Content
    chart.timeScale().fitContent();

    // 7. Cleanup
    return () => {
      resizeObserver.disconnect();
      chart.remove();
    };
  }, [data]);

  // Format volume (e.g. 1,500,000 -> 1,500K or 1.5M, or just 張)
  const formatVol = (shares: number) => {
    const lots = shares / 1000;
    if (lots >= 1000) {
      return `${(lots / 1000).toFixed(1)}M 張`;
    }
    return `${Math.round(lots).toLocaleString()} 張`;
  };

  return (
    <div className="relative w-full h-[420px] bg-slate-900/40 rounded-2xl border border-slate-800/60 p-4 backdrop-blur-md">
      {/* Legend overlay */}
      <div
        ref={legendRef}
        className="absolute top-4 left-4 z-10 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-400 pointer-events-none bg-slate-950/80 p-2.5 rounded-xl border border-slate-800/80 backdrop-blur-md"
      >
        {hoveredData && (
          <>
            <div className="text-slate-200 font-medium mr-2">{hoveredData.time}</div>
            <div>開: <span className={hoveredData.close >= hoveredData.open ? 'text-red-400' : 'text-green-400'}>{hoveredData.open.toFixed(2)}</span></div>
            <div>高: <span className="text-red-400">{hoveredData.high.toFixed(2)}</span></div>
            <div>低: <span className="text-green-400">{hoveredData.low.toFixed(2)}</span></div>
            <div>收: <span className={hoveredData.close >= hoveredData.open ? 'text-red-400' : 'text-green-400'}>{hoveredData.close.toFixed(2)}</span></div>
            <div>量: <span className="text-slate-300">{formatVol(hoveredData.volume)}</span></div>
            <div className="flex gap-x-3 w-full mt-1 border-t border-slate-800/60 pt-1 font-mono">
              {hoveredData.ma5 !== undefined && (
                <span className="text-[#f59e0b]">MA5: {hoveredData.ma5.toFixed(2)}</span>
              )}
              {hoveredData.ma20 !== undefined && (
                <span className="text-[#8b5cf6]">MA20: {hoveredData.ma20.toFixed(2)}</span>
              )}
              {hoveredData.ma60 !== undefined && (
                <span className="text-[#10b981]">MA60: {hoveredData.ma60.toFixed(2)}</span>
              )}
            </div>
          </>
        )}
      </div>
      {/* Chart container */}
      <div ref={chartContainerRef} className="w-full h-full" />
    </div>
  );
};
