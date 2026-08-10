import React, { useEffect, useMemo, useState } from 'react';
import { collection, onSnapshot, doc, setDoc, deleteDoc, updateDoc, deleteField } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType, storage, storageRef, deleteObject } from '../firebase';
import { getAuth, createUserWithEmailAndPassword } from 'firebase/auth';
import { initializeApp } from 'firebase/app';
import { firebaseConfig } from '../firebase';
import { UserPlus, Shield, Users, Shirt, Grid3x3, ImageIcon, DollarSign, MousePointerClick, Sparkles, Wand2, Wallet, RotateCw, Clock, Download, Trash2, ZoomIn, PieChart as PieChartIcon, List as ListIcon, Copy, Check, ChevronDown, ChevronUp } from 'lucide-react';
import { Button, Pill, Switch, Segmented } from './ui';
import { apiFetch } from '../utils/apiFetch';

const FEATURE_LABELS: Record<string, string> = {
  'clothing-gen': 'Quần áo · Gen',
  'analyze': 'Quần áo · Phân tích',
  'ecom-gen-new': 'Ecom · Gen new',
  'ecom-clone': 'Ecom · Clone',
  'ecom-pattern': 'Ecom · Pattern',
  'ecom-enhance': 'Ecom · Tách/Enhance',
  'ecom-thay': 'Ecom · Thay',
  'ecom-compose': 'Ecom · Ghép ảnh',
};
const MODEL_LABELS: Record<string, string> = {
  'nano-banana-pro': 'Banana Pro',
  'nano-banana-2': 'Banana 2',
  'gemini-3-pro-image-preview': 'Banana Pro (Google)',
  'gemini-3.1-flash-image-preview': 'Banana 2 (Google)',
  'gpt-image-2-image-to-image': 'GPT2 (Kie)',
  'gemini-3-flash-preview': 'Phân tích (text)',
};

const decryptedPromptCache = new Map<string, string>();

async function revealProtectedPrompt(item: any): Promise<any> {
  const encryptedPrompt = typeof item.prompt === 'string' && item.prompt.startsWith('enc:v1:')
    ? item.prompt
    : '';
  const cacheKey = encryptedPrompt || (item.promptSource === 'saved' && item.promptId ? `id:${item.promptId}` : '');
  if (!cacheKey) return item;
  const cached = decryptedPromptCache.get(cacheKey);
  if (cached !== undefined) return { ...item, prompt: cached };

  const response = await apiFetch('/api/kie-credits', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(encryptedPrompt
      ? { action: 'decrypt', prompt: encryptedPrompt }
      : { action: 'resolve', promptId: item.promptId }),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || typeof data.prompt !== 'string') return { ...item, prompt: '' };
  decryptedPromptCache.set(cacheKey, data.prompt);
  return { ...item, prompt: data.prompt };
}

// Color palette for pie slices — Apple system colors, cycled in order
const PIE_COLORS = [
  'var(--color-accent)',     // blue
  'var(--color-success)',    // green
  'var(--color-warning)',    // orange
  'var(--color-pink)',       // pink
  'var(--color-purple)',     // purple
  'var(--color-indigo)',     // indigo
  'var(--color-teal)',       // teal
  'var(--color-danger)',     // red
];

interface PieSlice { label: string; value: number; sub?: string; }

interface EmployeeSummary {
  key: string;
  email: string;
  uid?: string;
  images: number;
  credits: number;
  cost: number;
  genEvents: number;
  views: number;
  activeDays: number;
  lastActive: number;
  topModel: string;
  topFeature: string;
}

type EmployeeChartMetric = 'credits' | 'cost' | 'images';
type DailyChartSeries = 'images' | 'cost';

interface DailyUsagePoint {
  day: string;
  count: number;
  cost: number;
}

function usageTsMillis(entry: any): number {
  const timestamp = entry?.ts;
  if (!timestamp) return 0;
  if (typeof timestamp.toMillis === 'function') return timestamp.toMillis();
  if (typeof timestamp.seconds === 'number') return timestamp.seconds * 1000;
  return 0;
}

function usageEmployeeKey(entry: any): string {
  return entry?.email || entry?.uid || 'ẩn danh';
}

function PieChart({ data, unit = 'ảnh' }: { data: PieSlice[]; unit?: string }) {
  const [hovered, setHovered] = useState<number | null>(null);
  const filtered = data.filter((d) => d.value > 0);
  const total = filtered.reduce((s, d) => s + d.value, 0);
  if (total === 0) return <p style={{ fontSize: 12, color: 'var(--color-text-tertiary)' }}>—</p>;
  // Hard-cap at 8 slices, group the rest as "Khác"
  const top = filtered.slice(0, 8);
  const rest = filtered.slice(8);
  const slices = rest.length > 0
    ? [...top, { label: `Khác (${rest.length})`, value: rest.reduce((s, d) => s + d.value, 0) }]
    : top;
  let cumulative = 0;
  const hoveredSlice = hovered !== null ? slices[hovered] : null;
  return (
    <div className="flex items-center gap-4 flex-wrap">
      <div style={{ position: 'relative', width: 140, height: 140, flexShrink: 0 }}>
        <svg width="140" height="140" viewBox="0 0 100 100" onMouseLeave={() => setHovered(null)}>
          {slices.map((d, i) => {
            const portion = d.value / total;
            const start = cumulative * 2 * Math.PI;
            cumulative += portion;
            const end = cumulative * 2 * Math.PI;
            const isHover = hovered === i;
            const fill = PIE_COLORS[i % PIE_COLORS.length];
            const commonProps = {
              fill,
              stroke: 'var(--color-card)',
              strokeWidth: 0.7,
              onMouseEnter: () => setHovered(i),
              style: {
                cursor: 'pointer',
                opacity: hovered !== null && !isHover ? 0.55 : 1,
                transition: 'opacity 120ms',
              } as React.CSSProperties,
            };
            // Single-slice (100%) special case — draw a full circle
            if (slices.length === 1) {
              return <circle key={i} cx="50" cy="50" r="45" {...commonProps} />;
            }
            const x1 = 50 + 45 * Math.sin(start);
            const y1 = 50 - 45 * Math.cos(start);
            const x2 = 50 + 45 * Math.sin(end);
            const y2 = 50 - 45 * Math.cos(end);
            const large = portion > 0.5 ? 1 : 0;
            return (
              <path
                key={i}
                d={`M50,50 L${x1.toFixed(3)},${y1.toFixed(3)} A45,45 0 ${large},1 ${x2.toFixed(3)},${y2.toFixed(3)} Z`}
                {...commonProps}
              />
            );
          })}
        </svg>
        {hoveredSlice && (
          <div
            className="pointer-events-none"
            style={{
              position: 'absolute',
              left: '50%',
              bottom: -8,
              transform: 'translate(-50%, 100%)',
              background: 'var(--color-text)',
              color: 'var(--color-bg-elevated)',
              padding: '6px 10px',
              borderRadius: 8,
              fontSize: 11,
              fontWeight: 600,
              whiteSpace: 'nowrap',
              boxShadow: '0 4px 12px rgba(0,0,0,0.2)',
              zIndex: 10,
            }}
          >
            {hoveredSlice.label} · {hoveredSlice.value} {unit} · {Math.round((hoveredSlice.value / total) * 100)}%
          </div>
        )}
      </div>
      <div className="flex-1 min-w-[160px] flex flex-col gap-1.5">
        {slices.map((d, i) => {
          const isHover = hovered === i;
          return (
            <div
              key={d.label}
              className="flex items-center gap-2 cursor-pointer"
              style={{
                fontSize: 12,
                padding: '3px 6px',
                marginLeft: -6,
                marginRight: -6,
                borderRadius: 6,
                background: isHover ? 'var(--color-fill)' : 'transparent',
                transition: 'background 120ms',
              }}
              onMouseEnter={() => setHovered(i)}
              onMouseLeave={() => setHovered(null)}
            >
              <span className="shrink-0 rounded" style={{ width: 10, height: 10, background: PIE_COLORS[i % PIE_COLORS.length] }} />
              <span className="flex-1 truncate" style={{ color: 'var(--color-text-secondary)' }}>{d.label}</span>
              <span className="font-semibold" style={{ color: 'var(--color-text)' }}>{d.value} {unit}</span>
              <span style={{ color: 'var(--color-text-tertiary)', minWidth: 32, textAlign: 'right' }}>{Math.round((d.value / total) * 100)}%</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function EmployeeDistributionChart({
  rows,
  metric,
  activeKey,
  onSelect,
}: {
  rows: EmployeeSummary[];
  metric: EmployeeChartMetric;
  activeKey: string;
  onSelect: (key: string) => void;
}) {
  const [hovered, setHovered] = useState<number | null>(null);
  const [tooltip, setTooltip] = useState<{ index: number; x: number; y: number } | null>(null);
  const config = {
    credits: {
      label: 'Credits',
      shortLabel: 'credits',
      value: (row: EmployeeSummary) => row.credits,
      format: (value: number) => `${Math.round(value).toLocaleString()} credits`,
      total: (value: number) => Math.round(value).toLocaleString(),
    },
    cost: {
      label: 'Chi phí',
      shortLabel: 'USD',
      value: (row: EmployeeSummary) => row.cost,
      format: (value: number) => `$${value.toFixed(2)}`,
      total: (value: number) => `$${value.toFixed(2)}`,
    },
    images: {
      label: 'Số ảnh',
      shortLabel: 'ảnh',
      value: (row: EmployeeSummary) => row.images,
      format: (value: number) => `${Math.round(value).toLocaleString()} ảnh`,
      total: (value: number) => Math.round(value).toLocaleString(),
    },
  }[metric];
  const slices = rows
    .map((row) => ({ key: row.key, label: row.email, value: config.value(row) }))
    .filter((slice) => slice.value > 0)
    .sort((a, b) => b.value - a.value);
  const total = slices.reduce((sum, slice) => sum + slice.value, 0);
  const radius = 38;
  const circumference = 2 * Math.PI * radius;
  let cumulative = 0;

  if (total <= 0) {
    return (
      <div className="flex min-h-[250px] items-center justify-center text-center">
        <div>
          <PieChartIcon size={26} className="mx-auto mb-2" style={{ color: 'var(--color-text-tertiary)' }} />
          <p style={{ fontSize: 12, color: 'var(--color-text-tertiary)' }}>Chưa có dữ liệu {config.label.toLowerCase()}.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-[190px_minmax(0,1fr)] items-center gap-4">
      <div className="relative mx-auto" style={{ width: 188, height: 188 }}>
        <svg
          width="188"
          height="188"
          viewBox="0 0 100 100"
          onMouseLeave={() => {
            setHovered(null);
            setTooltip(null);
          }}
        >
          <circle cx="50" cy="50" r={radius} fill="none" stroke="var(--color-fill)" strokeWidth="12" />
          {slices.map((slice, index) => {
            const portion = slice.value / total;
            const dash = Math.max(portion * circumference - 1.15, 0.4);
            const offset = -cumulative * circumference;
            cumulative += portion;
            const active = activeKey === slice.key;
            const isHovered = hovered === index;
            return (
              <circle
                key={slice.key}
                cx="50"
                cy="50"
                r={radius}
                fill="none"
                stroke={PIE_COLORS[index % PIE_COLORS.length]}
                strokeWidth={active || isHovered ? 14 : 11}
                strokeDasharray={`${dash} ${circumference - dash}`}
                strokeDashoffset={offset}
                transform="rotate(-90 50 50)"
                role="button"
                tabIndex={0}
                aria-label={`${slice.label}: ${config.format(slice.value)}`}
                onMouseEnter={() => setHovered(index)}
                onMouseMove={(event) => {
                  const bounds = event.currentTarget.ownerSVGElement?.getBoundingClientRect();
                  if (!bounds) return;
                  setTooltip({
                    index,
                    x: event.clientX - bounds.left,
                    y: event.clientY - bounds.top,
                  });
                }}
                onMouseLeave={() => setTooltip(null)}
                onFocus={() => setHovered(index)}
                onBlur={() => setHovered(null)}
                onClick={() => onSelect(slice.key)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' || event.key === ' ') onSelect(slice.key);
                }}
                style={{
                  cursor: 'pointer',
                  opacity: hovered !== null && !isHovered ? 0.45 : 1,
                  transition: 'stroke-width 180ms ease, opacity 180ms ease',
                  outline: 'none',
                }}
              />
            );
          })}
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none text-center px-8">
          <span className="font-bold" style={{ fontSize: metric === 'cost' ? 20 : 24, color: 'var(--color-text)', letterSpacing: '-0.04em', fontVariantNumeric: 'tabular-nums' }}>
            {config.total(total)}
          </span>
          <span className="uppercase font-semibold" style={{ marginTop: 2, fontSize: 9, color: 'var(--color-text-tertiary)', letterSpacing: '0.08em' }}>
            {config.shortLabel}
          </span>
        </div>
        {tooltip && (() => {
          const slice = slices[tooltip.index];
          const alignRight = tooltip.x > 94;
          return (
            <div
              className="absolute pointer-events-none"
              style={{
                left: tooltip.x + (alignRight ? -10 : 10),
                top: tooltip.y - 8,
                transform: `translate(${alignRight ? '-100%' : '0'}, -100%)`,
                zIndex: 20,
                minWidth: 150,
                maxWidth: 210,
                padding: '9px 10px',
                borderRadius: 10,
                color: 'var(--color-bg-elevated)',
                background: 'var(--color-text)',
                boxShadow: '0 10px 28px rgba(15, 23, 42, 0.24)',
                fontVariantNumeric: 'tabular-nums',
              }}
            >
              <p className="truncate font-semibold" style={{ fontSize: 10.5, opacity: 0.72 }}>{slice.label}</p>
              <div className="flex items-end justify-between gap-3 mt-1">
                <span className="font-semibold whitespace-nowrap" style={{ fontSize: 11 }}>{config.format(slice.value)}</span>
                <span className="font-bold" style={{ fontSize: 18, lineHeight: 1, letterSpacing: '-0.04em' }}>
                  {Math.round((slice.value / total) * 100)}%
                </span>
              </div>
            </div>
          );
        })()}
      </div>

      <div className="space-y-1 overflow-y-auto pr-1" style={{ maxHeight: 240 }}>
        {slices.map((slice, index) => {
          const active = activeKey === slice.key;
          const isHovered = hovered === index;
          return (
            <button
              key={slice.key}
              type="button"
              onClick={() => onSelect(slice.key)}
              onMouseEnter={() => setHovered(index)}
              onMouseLeave={() => setHovered(null)}
              className="w-full grid grid-cols-[10px_minmax(0,1fr)_auto] items-center gap-2 text-left transition-colors"
              style={{
                padding: '6px 7px',
                borderRadius: 8,
                background: active || isHovered ? 'var(--color-fill)' : 'transparent',
              }}
              title={`Lọc theo ${slice.label}`}
            >
              <span className="rounded-sm" style={{ width: 9, height: 9, background: PIE_COLORS[index % PIE_COLORS.length] }} />
              <span className="truncate" style={{ fontSize: 11, color: 'var(--color-text-secondary)' }}>{slice.label}</span>
              <span className="font-semibold whitespace-nowrap" style={{ fontSize: 11, color: 'var(--color-text)', fontVariantNumeric: 'tabular-nums' }}>
                {config.format(slice.value)}
                <span style={{ color: 'var(--color-text-tertiary)', marginLeft: 6, fontWeight: 500 }}>
                  {Math.round((slice.value / total) * 100)}%
                </span>
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function DailyUsageLineChart({ data }: { data: DailyUsagePoint[] }) {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const [visibleSeries, setVisibleSeries] = useState<Record<DailyChartSeries, boolean>>({
    images: true,
    cost: true,
  });

  const chartWidth = 1000;
  const chartHeight = 270;
  const plot = { left: 58, right: 72, top: 28, bottom: 46 };
  const plotWidth = chartWidth - plot.left - plot.right;
  const plotHeight = chartHeight - plot.top - plot.bottom;
  const maxImages = Math.max(...data.map((point) => point.count), 1);
  const maxCost = Math.max(...data.map((point) => point.cost), 0.01);
  const selectedCount = Number(visibleSeries.images) + Number(visibleSeries.cost);
  const labelEvery = Math.max(1, Math.ceil((data.length - 1) / 6));

  const xFor = (index: number) => data.length <= 1
    ? plot.left + plotWidth / 2
    : plot.left + (index / (data.length - 1)) * plotWidth;
  const yFor = (value: number, max: number) => plot.top + plotHeight - (value / max) * plotHeight;
  const imagePoints = data.map((point, index) => ({ x: xFor(index), y: yFor(point.count, maxImages) }));
  const costPoints = data.map((point, index) => ({ x: xFor(index), y: yFor(point.cost, maxCost) }));
  const toPath = (points: { x: number; y: number }[]) => points
    .map((point, index) => `${index === 0 ? 'M' : 'L'} ${point.x.toFixed(2)} ${point.y.toFixed(2)}`)
    .join(' ');

  const toggleSeries = (series: DailyChartSeries) => {
    setVisibleSeries((current) => {
      if (current[series] && selectedCount === 1) return current;
      return { ...current, [series]: !current[series] };
    });
  };

  const hoveredPoint = hoveredIndex === null ? null : data[hoveredIndex];
  const hoveredX = hoveredIndex === null ? 0 : xFor(hoveredIndex);
  const tooltipWidth = 184;
  const tooltipX = hoveredX > chartWidth - tooltipWidth - 12
    ? hoveredX - tooltipWidth - 10
    : hoveredX + 10;

  return (
    <div>
      <div className="flex items-start justify-between gap-4 mb-3 flex-wrap">
        <div>
          <p className="font-semibold" style={{ fontSize: 13, color: 'var(--color-text)' }}>Hoạt động theo ngày</p>
          <p style={{ fontSize: 10, color: 'var(--color-text-tertiary)', marginTop: 2 }}>
            So sánh số ảnh và chi phí trong khoảng thời gian đã chọn
          </p>
        </div>
        <div className="flex items-center gap-3 flex-wrap" aria-label="Chọn dữ liệu hiển thị">
          <button
            type="button"
            onClick={() => toggleSeries('images')}
            className="inline-flex items-center gap-1.5 transition-opacity"
            style={{ fontSize: 11, color: 'var(--color-text-secondary)', opacity: visibleSeries.images ? 1 : 0.42 }}
            aria-pressed={visibleSeries.images}
          >
            <span className="rounded-full" style={{ width: 8, height: 8, background: 'var(--color-accent)' }} />
            Số ảnh
          </button>
          <button
            type="button"
            onClick={() => toggleSeries('cost')}
            className="inline-flex items-center gap-1.5 transition-opacity"
            style={{ fontSize: 11, color: 'var(--color-text-secondary)', opacity: visibleSeries.cost ? 1 : 0.42 }}
            aria-pressed={visibleSeries.cost}
          >
            <span className="rounded-full" style={{ width: 8, height: 8, background: 'var(--color-teal)' }} />
            Chi phí
          </button>
          <span style={{ fontSize: 10, color: 'var(--color-text-tertiary)' }}>Đã chọn {selectedCount}/2</span>
        </div>
      </div>

      <div className="overflow-x-auto" onMouseLeave={() => setHoveredIndex(null)}>
        <svg
          viewBox={`0 0 ${chartWidth} ${chartHeight}`}
          preserveAspectRatio="xMidYMid meet"
          role="img"
          aria-label="Biểu đồ đường số ảnh và chi phí theo ngày"
          style={{ display: 'block', width: '100%', minWidth: 680, height: 'auto', aspectRatio: `${chartWidth} / ${chartHeight}` }}
        >
          {Array.from({ length: 5 }, (_, index) => {
            const ratio = index / 4;
            const y = plot.top + ratio * plotHeight;
            const imageValue = Math.round(maxImages * (1 - ratio));
            const costValue = maxCost * (1 - ratio);
            return (
              <g key={index}>
                <line
                  x1={plot.left}
                  x2={chartWidth - plot.right}
                  y1={y}
                  y2={y}
                  stroke="var(--color-border-soft)"
                  strokeDasharray="4 4"
                />
                <text x={plot.left - 10} y={y + 3} textAnchor="end" fill="var(--color-text-tertiary)" fontSize="9">
                  {imageValue}
                </text>
                <text x={chartWidth - plot.right + 10} y={y + 3} textAnchor="start" fill="var(--color-text-tertiary)" fontSize="9">
                  ${costValue.toFixed(costValue >= 10 ? 0 : 2)}
                </text>
              </g>
            );
          })}

          <line
            x1={plot.left}
            x2={chartWidth - plot.right}
            y1={plot.top + plotHeight}
            y2={plot.top + plotHeight}
            stroke="var(--color-border)"
          />

          {visibleSeries.images && (
            <path
              d={toPath(imagePoints)}
              fill="none"
              stroke="var(--color-accent)"
              strokeWidth="2.5"
              vectorEffect="non-scaling-stroke"
              strokeLinejoin="round"
              strokeLinecap="round"
            />
          )}
          {visibleSeries.cost && (
            <path
              d={toPath(costPoints)}
              fill="none"
              stroke="var(--color-teal)"
              strokeWidth="2.5"
              vectorEffect="non-scaling-stroke"
              strokeLinejoin="round"
              strokeLinecap="round"
            />
          )}

          {hoveredIndex !== null && (
            <line
              x1={hoveredX}
              x2={hoveredX}
              y1={plot.top}
              y2={plot.top + plotHeight}
              stroke="var(--color-text-tertiary)"
              strokeDasharray="3 4"
              opacity="0.7"
            />
          )}

          {data.map((point, index) => {
            const x = xFor(index);
            const zoneStart = index === 0 ? plot.left : (xFor(index - 1) + x) / 2;
            const zoneEnd = index === data.length - 1 ? chartWidth - plot.right : (x + xFor(index + 1)) / 2;
            const [, month, day] = point.day.split('-');
            const showLabel = index % labelEvery === 0 || index === data.length - 1;
            const active = hoveredIndex === index;
            return (
              <g key={point.day}>
                {visibleSeries.images && (
                  <circle
                    cx={x}
                    cy={imagePoints[index].y}
                    r={active ? 4.5 : 2.8}
                    fill="var(--color-card)"
                    stroke="var(--color-accent)"
                    strokeWidth="2"
                    vectorEffect="non-scaling-stroke"
                  />
                )}
                {visibleSeries.cost && (
                  <circle
                    cx={x}
                    cy={costPoints[index].y}
                    r={active ? 4.5 : 2.8}
                    fill="var(--color-card)"
                    stroke="var(--color-teal)"
                    strokeWidth="2"
                    vectorEffect="non-scaling-stroke"
                  />
                )}
                {showLabel && (
                  <text x={x} y={chartHeight - 17} textAnchor="middle" fill="var(--color-text-tertiary)" fontSize="9">
                    {day}/{month}
                  </text>
                )}
                <rect
                  x={zoneStart}
                  y={plot.top}
                  width={Math.max(1, zoneEnd - zoneStart)}
                  height={plotHeight}
                  fill="transparent"
                  tabIndex={0}
                  role="button"
                  aria-label={`${day}/${month}: ${point.count} ảnh, $${point.cost.toFixed(2)}`}
                  onMouseEnter={() => setHoveredIndex(index)}
                  onFocus={() => setHoveredIndex(index)}
                  onBlur={() => setHoveredIndex(null)}
                  onTouchStart={() => setHoveredIndex(index)}
                  style={{ cursor: 'crosshair', outline: 'none' }}
                />
              </g>
            );
          })}

          {hoveredPoint && (
            <g pointerEvents="none">
              <rect
                x={tooltipX}
                y={plot.top + 8}
                width={tooltipWidth}
                height="68"
                rx="10"
                fill="var(--color-text)"
                opacity="0.96"
              />
              <text x={tooltipX + 12} y={plot.top + 27} fill="var(--color-bg-elevated)" fontSize="10" fontWeight="600">
                {hoveredPoint.day.split('-').reverse().join('/')}
              </text>
              <circle cx={tooltipX + 14} cy={plot.top + 43} r="3" fill="var(--color-accent)" />
              <text x={tooltipX + 23} y={plot.top + 46} fill="var(--color-bg-elevated)" fontSize="10">
                {hoveredPoint.count.toLocaleString()} ảnh
              </text>
              <circle cx={tooltipX + 14} cy={plot.top + 60} r="3" fill="var(--color-teal)" />
              <text x={tooltipX + 23} y={plot.top + 63} fill="var(--color-bg-elevated)" fontSize="10">
                ${hoveredPoint.cost.toFixed(2)} chi phí
              </text>
            </g>
          )}
        </svg>
      </div>
      <div className="flex items-center justify-between gap-4 flex-wrap mt-1">
        <span style={{ fontSize: 9.5, color: 'var(--color-text-tertiary)' }}>Trục trái: số ảnh</span>
        <span style={{ fontSize: 9.5, color: 'var(--color-text-tertiary)' }}>Trục phải: chi phí (USD)</span>
      </div>
    </div>
  );
}

export default function AdminPanel({ currentUser }: { currentUser: any }) {
  const [adminTab, setAdminTab] = useState<'users' | 'stats' | 'history'>('users');
  const [history, setHistory] = useState<any[]>([]);
  const [historyEmployeeFilter, setHistoryEmployeeFilter] = useState<string>('all');
  const [expandedHistoryPrompts, setExpandedHistoryPrompts] = useState<Record<string, boolean>>({});
  const [copiedHistoryPromptId, setCopiedHistoryPromptId] = useState<string | null>(null);
  const [zoomUrl, setZoomUrl] = useState<string | null>(null);
  const [timeFilter, setTimeFilter] = useState<'7d' | '15d' | '30d' | 'custom'>('30d');
  const [employeeFilter, setEmployeeFilter] = useState<string>('all');
  const [employeeChartMetric, setEmployeeChartMetric] = useState<EmployeeChartMetric>('cost');
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo] = useState('');
  // Per-panel chart view mode: 'list' (default) | 'pie'
  const [chartView, setChartView] = useState<Record<string, 'list' | 'pie'>>({});
  const isPie = (key: string) => chartView[key] === 'pie';
  const toggleChartView = (key: string) => setChartView((p) => ({ ...p, [key]: p[key] === 'pie' ? 'list' : 'pie' }));
  const [kieCredits, setKieCredits] = useState<number | null>(null);
  const [kieCreditsLoading, setKieCreditsLoading] = useState(false);
  const [users, setUsers] = useState<any[]>([]);
  const [usage, setUsage] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // New user form
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [creating, setCreating] = useState(false);
  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'users'), (snap) => {
      const nextUsers = snap.docs.map(d => d.data());
      setUsers(nextUsers);
      // One-time cleanup for accounts created by older builds. Passwords belong
      // in Firebase Authentication and must never remain readable in Firestore.
      snap.docs.forEach((snapshot) => {
        const data = snapshot.data();
        const migration: Record<string, unknown> = {};
        if ('password' in data) migration.password = deleteField();
        if (typeof data.canUseClothing !== 'boolean') migration.canUseClothing = false;
        if (typeof data.canUseEcom !== 'boolean') migration.canUseEcom = false;
        if (typeof data.canUseOfa !== 'boolean') migration.canUseOfa = false;
        if (typeof data.canUsePicset !== 'boolean') migration.canUsePicset = false;
        if (typeof data.canUseRunninghub !== 'boolean') migration.canUseRunninghub = data.canUsePicset === true;
        if (Object.keys(migration).length > 0) {
          updateDoc(doc(db, 'users', snapshot.id), migration)
            .catch((cleanupError) => console.warn('user security migration failed', cleanupError));
        }
      });
      setLoading(false);
    }, (err) => {
      setError(err.message);
      setLoading(false);
    });
    return () => unsub();
  }, []);

  // Subscribe usage logs only when on stats tab
  useEffect(() => {
    if (adminTab !== 'stats') return;
    const unsub = onSnapshot(collection(db, 'usage'), (snap) => {
      setUsage(snap.docs.map(d => d.data()));
    }, (err) => console.warn('usage subscribe error', err));
    return () => unsub();
  }, [adminTab]);

  // Lấy số dư credit Kie.ai khi vào tab Thống kê
  const fetchKieCredits = async () => {
    setKieCreditsLoading(true);
    try {
      const r = await apiFetch('/api/kie-credits');
      const data = await r.json();
      setKieCredits(typeof data.credits === 'number' ? data.credits : null);
    } catch (e) {
      console.warn('fetch kie credits failed', e);
    } finally {
      setKieCreditsLoading(false);
    }
  };
  useEffect(() => {
    if (adminTab === 'stats') fetchKieCredits();
  }, [adminTab]);

  const employeeOptions = useMemo(() => {
    const options = new Map<string, { key: string; email: string }>();
    users.forEach((user) => {
      const key = user.email || user.uid;
      if (key) options.set(key, { key, email: user.email || user.uid });
    });
    usage.forEach((entry) => {
      const key = usageEmployeeKey(entry);
      if (key !== 'ẩn danh' && !options.has(key)) {
        options.set(key, { key, email: entry.email || entry.uid || key });
      }
    });
    return Array.from(options.values()).sort((a, b) => a.email.localeCompare(b.email));
  }, [users, usage]);

  // Lịch sử ảnh đã gen
  useEffect(() => {
    if (adminTab !== 'history') return;
    let active = true;
    const unsub = onSnapshot(collection(db, 'history'), (snap) => {
      void Promise.all(snap.docs.map(d => revealProtectedPrompt(d.data()))).then((items) => {
        if (!active) return;
        items.sort((a, b) => {
          const ta = a.ts?.toMillis ? a.ts.toMillis() : (a.ts?.seconds || 0) * 1000;
          const tb = b.ts?.toMillis ? b.ts.toMillis() : (b.ts?.seconds || 0) * 1000;
          return tb - ta;
        });
        setHistory(items);
      }).catch((err) => console.warn('history prompt decrypt error', err));
    }, (err) => console.warn('history subscribe error', err));
    return () => { active = false; unsub(); };
  }, [adminTab]);

  const historyEmployeeOptions = useMemo(() => {
    const employees = new Map<string, { key: string; email: string; count: number }>();
    history.forEach((item) => {
      const key = usageEmployeeKey(item);
      const existing = employees.get(key);
      if (existing) {
        existing.count += 1;
      } else {
        employees.set(key, {
          key,
          email: item.email || item.uid || 'Ẩn danh',
          count: 1,
        });
      }
    });
    return Array.from(employees.values()).sort((a, b) => a.email.localeCompare(b.email));
  }, [history]);

  const visibleAdminHistory = useMemo(() => (
    historyEmployeeFilter === 'all'
      ? history
      : history.filter((item) => usageEmployeeKey(item) === historyEmployeeFilter)
  ), [history, historyEmployeeFilter]);

  const copyAdminHistoryPrompt = async (prompt: string, itemId: string) => {
    try {
      await navigator.clipboard.writeText(prompt);
      setCopiedHistoryPromptId(itemId);
      window.setTimeout(() => setCopiedHistoryPromptId((current) => current === itemId ? null : current), 1400);
    } catch (e) {
      console.warn('copy history prompt failed', e);
    }
  };

  const deleteHistoryItem = async (item: any) => {
    if (!window.confirm('Xóa ảnh này khỏi lịch sử?')) return;
    try {
      if (item.path) await deleteObject(storageRef(storage, item.path)).catch(() => {});
      await deleteDoc(doc(db, 'history', item.id));
    } catch (e) {
      console.warn('delete history failed', e);
    }
  };

  const analytics = useMemo(() => {
    // Lọc theo thời gian dựa trên ts (Firestore Timestamp)
    const now = Date.now();
    let lo = 0;
    let hi = Infinity;
    if (timeFilter === '7d') lo = now - 7 * 24 * 3600 * 1000;
    else if (timeFilter === '15d') lo = now - 15 * 24 * 3600 * 1000;
    else if (timeFilter === '30d') lo = now - 30 * 24 * 3600 * 1000;
    else if (timeFilter === 'custom') {
      if (customFrom) lo = new Date(customFrom + 'T00:00:00').getTime();
      if (customTo) hi = new Date(customTo + 'T23:59:59').getTime();
    }
    const inRange = usage.filter(u => { const m = usageTsMillis(u); return m >= lo && m <= hi; });
    const allGens = inRange.filter(u => u.type === 'gen');

    // Build a full employee ledger before applying the selected employee.
    // This keeps the comparison table intact while every other chart follows
    // the active employee filter.
    const employeeLedger = new Map<string, {
      key: string;
      email: string;
      uid?: string;
      images: number;
      credits: number;
      cost: number;
      genEvents: number;
      views: number;
      activeDays: Set<string>;
      lastActive: number;
      models: Record<string, number>;
      features: Record<string, number>;
    }>();
    const ensureEmployee = (entry: any) => {
      const key = usageEmployeeKey(entry);
      if (!employeeLedger.has(key)) {
        employeeLedger.set(key, {
          key,
          email: entry.email || entry.uid || 'ẩn danh',
          uid: entry.uid,
          images: 0,
          credits: 0,
          cost: 0,
          genEvents: 0,
          views: 0,
          activeDays: new Set<string>(),
          lastActive: 0,
          models: {},
          features: {},
        });
      }
      return employeeLedger.get(key)!;
    };
    inRange.forEach((entry) => {
      if (entry.type !== 'gen' && entry.type !== 'view' && entry.type !== 'gemini_direct') return;
      const employee = ensureEmployee(entry);
      const timestamp = usageTsMillis(entry);
      if (timestamp > 0) {
        employee.activeDays.add(new Date(timestamp).toISOString().slice(0, 10));
        employee.lastActive = Math.max(employee.lastActive, timestamp);
      }
      if (entry.type === 'view') {
        employee.views += 1;
        return;
      }
      if (entry.type === 'gen') {
        const count = entry.count || 0;
        employee.images += count;
        employee.credits += entry.credits || 0;
        employee.cost += entry.cost || 0;
        employee.genEvents += 1;
        const model = entry.model || 'unknown';
        const feature = entry.feature || 'unknown';
        employee.models[model] = (employee.models[model] || 0) + count;
        employee.features[feature] = (employee.features[feature] || 0) + count;
      }
    });
    const employeeSummaries: EmployeeSummary[] = Array.from(employeeLedger.values())
      .map((employee) => ({
        key: employee.key,
        email: employee.email,
        uid: employee.uid,
        images: employee.images,
        credits: employee.credits,
        cost: employee.cost,
        genEvents: employee.genEvents,
        views: employee.views,
        activeDays: employee.activeDays.size,
        lastActive: employee.lastActive,
        topModel: Object.entries(employee.models).sort((a, b) => b[1] - a[1])[0]?.[0] || '—',
        topFeature: Object.entries(employee.features).sort((a, b) => b[1] - a[1])[0]?.[0] || '—',
      }))
      .sort((a, b) => b.cost - a.cost || b.images - a.images);

    const scopedRange = employeeFilter === 'all'
      ? inRange
      : inRange.filter((entry) => usageEmployeeKey(entry) === employeeFilter);
    const gens = scopedRange.filter(u => u.type === 'gen');
    const views = scopedRange.filter(u => u.type === 'view');
    const geminiDirect = scopedRange.filter(u => u.type === 'gemini_direct');
    // Theo ngày (cho biểu đồ)
    const byDay: Record<string, { count: number; cost: number }> = {};
    gens.forEach(g => {
      const d = new Date(usageTsMillis(g));
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      byDay[key] = byDay[key] || { count: 0, cost: 0 };
      byDay[key].count += g.count || 0;
      byDay[key].cost += g.cost || 0;
    });
    const totalImages = gens.reduce((s, g) => s + (g.count || 0), 0);
    const totalCost = gens.reduce((s, g) => s + (g.cost || 0), 0);
    const totalCredits = gens.reduce((s, g) => s + (g.credits || 0), 0);
    const byModel: Record<string, { count: number; cost: number }> = {};
    // Chi tiết: model → size → { count, cost }
    const byModelSize: Record<string, Record<string, { count: number; cost: number }>> = {};
    const byFeature: Record<string, number> = {};
    const byUser: Record<string, { count: number; cost: number }> = {};
    const byView: Record<string, number> = {};
    allGens.forEach(g => {
      const u = usageEmployeeKey(g);
      byUser[u] = byUser[u] || { count: 0, cost: 0 };
      byUser[u].count += g.count || 0;
      byUser[u].cost += g.cost || 0;
    });
    gens.forEach(g => {
      const m = g.model || 'unknown';
      const size = (g.size || '—').toString().toUpperCase();
      byModel[m] = byModel[m] || { count: 0, cost: 0 };
      byModel[m].count += g.count || 0;
      byModel[m].cost += g.cost || 0;
      byModelSize[m] = byModelSize[m] || {};
      byModelSize[m][size] = byModelSize[m][size] || { count: 0, cost: 0 };
      byModelSize[m][size].count += g.count || 0;
      byModelSize[m][size].cost += g.cost || 0;
      byFeature[g.feature || 'unknown'] = (byFeature[g.feature || 'unknown'] || 0) + (g.count || 0);
    });
    views.forEach(v => { byView[v.view || 'unknown'] = (byView[v.view || 'unknown'] || 0) + 1; });
    // Gemini direct calls (billed to GEMINI_API_KEY, not Kie) — split by feature + model
    const geminiByFeature: Record<string, number> = {};
    const geminiByModel: Record<string, number> = {};
    let geminiTotal = 0;
    geminiDirect.forEach(g => {
      const c = g.count || 1;
      geminiTotal += c;
      geminiByFeature[g.feature || 'unknown'] = (geminiByFeature[g.feature || 'unknown'] || 0) + c;
      geminiByModel[g.model || 'unknown'] = (geminiByModel[g.model || 'unknown'] || 0) + c;
    });
    // Build the daily series WITH zero-count days so today (and any quiet day)
    // is always present in the chart instead of silently dropping out.
    const dayKey = (d: Date) =>
      `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    const startDay = new Date();
    const endDay = new Date();
    if (timeFilter === '7d') startDay.setDate(startDay.getDate() - 6);
    else if (timeFilter === '15d') startDay.setDate(startDay.getDate() - 14);
    else if (timeFilter === '30d') startDay.setDate(startDay.getDate() - 29);
    else if (timeFilter === 'custom') {
      if (customFrom) startDay.setTime(new Date(customFrom + 'T00:00:00').getTime());
      if (customTo) endDay.setTime(new Date(customTo + 'T23:59:59').getTime());
    }
    startDay.setHours(0, 0, 0, 0);
    endDay.setHours(23, 59, 59, 999);
    const dailySeries: { day: string; count: number; cost: number }[] = [];
    for (let d = new Date(startDay); d.getTime() <= endDay.getTime(); d.setDate(d.getDate() + 1)) {
      const key = dayKey(d);
      const v = byDay[key] || { count: 0, cost: 0 };
      dailySeries.push({ day: key, ...v });
    }
    return { totalImages, totalCost, totalCredits, totalViews: views.length, byModel, byModelSize, byFeature, byUser, byView, dailySeries, geminiTotal, geminiByFeature, geminiByModel, employeeSummaries };
  }, [usage, timeFilter, customFrom, customTo, employeeFilter]);

  const employeeRows = useMemo(() => {
    const summaries = new Map(analytics.employeeSummaries.map((employee) => [employee.key, employee]));
    return employeeOptions
      .map((option) => summaries.get(option.key) || ({
        key: option.key,
        email: option.email,
        images: 0,
        credits: 0,
        cost: 0,
        genEvents: 0,
        views: 0,
        activeDays: 0,
        lastActive: 0,
        topModel: '—',
        topFeature: '—',
      } satisfies EmployeeSummary))
      .sort((a, b) => b.cost - a.cost || b.images - a.images || a.email.localeCompare(b.email));
  }, [analytics.employeeSummaries, employeeOptions]);

  const selectedEmployeeSummary = employeeFilter === 'all'
    ? null
    : employeeRows.find((employee) => employee.key === employeeFilter) || null;
  const selectedEmployeeUser = employeeFilter === 'all'
    ? null
    : users.find((user) => (user.email || user.uid) === employeeFilter) || null;

  const stats = useMemo(() => ({
    total: users.length,
    admins: users.filter(u => u.role === 'admin').length,
    clothing: users.filter(u => u.canUseClothing).length,
    ecom: users.filter(u => u.canUseEcom).length,
    ofa: users.filter(u => u.canUseOfa).length,
    picset: users.filter(u => u.canUsePicset).length,
    runninghub: users.filter(u => u.canUseRunninghub).length,
  }), [users]);

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) return;
    setCreating(true);
    setError(null);
    try {
      const secondaryApp = initializeApp(firebaseConfig, "Secondary");
      const secondaryAuth = getAuth(secondaryApp);
      const userCredential = await createUserWithEmailAndPassword(secondaryAuth, email, password);
      await setDoc(doc(db, 'users', userCredential.user.uid), {
        uid: userCredential.user.uid,
        email: userCredential.user.email,
        role: 'user',
        canUseClothing: true,
        canUseEcom: true,
        canUseOfa: true,
        canUsePicset: true,
        canUseRunninghub: true,
        createdAt: new Date(),
      });
      await secondaryAuth.signOut();
      setEmail('');
      setPassword('');
      alert("Tạo tài khoản thành công!");
    } catch (err: any) {
      setError(err.message);
    } finally {
      setCreating(false);
    }
  };

  const togglePermission = async (uid: string, field: string, currentValue: boolean) => {
    try {
      await setDoc(doc(db, 'users', uid), { [field]: !currentValue }, { merge: true });
    } catch (err: any) {
      handleFirestoreError(err, OperationType.UPDATE, `users/${uid}`);
    }
  };

  const inputStyle: React.CSSProperties = {
    height: 44,
    padding: '0 14px',
    borderRadius: 10,
    background: 'var(--color-fill)',
    color: 'var(--color-text)',
    fontSize: 14,
    border: '0.5px solid transparent',
    outline: 'none',
    width: '100%',
    letterSpacing: '-0.01em',
  };

  const statCards = [
    { label: 'Tổng người dùng', value: stats.total, icon: Users, color: 'var(--color-accent)' },
    { label: 'Quản trị viên', value: stats.admins, icon: Shield, color: 'var(--color-indigo)' },
    { label: 'Có quyền Quần áo', value: stats.clothing, icon: Shirt, color: 'var(--color-success)' },
    { label: 'Có quyền Ecom', value: stats.ecom, icon: Grid3x3, color: 'var(--color-warning)' },
    { label: 'Có quyền OFA', value: stats.ofa, icon: Sparkles, color: 'var(--color-danger)' },
    { label: 'Có quyền Picset', value: stats.picset, icon: Wand2, color: 'var(--color-accent)' },
  ];

  return (
    <div className="py-2 max-w-[1600px] mx-auto space-y-5" style={{ color: 'var(--color-text)' }}>
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
        <p className="uppercase font-semibold mb-1" style={{ fontSize: 10, color: 'var(--color-accent)', letterSpacing: '0.1em' }}>Control center</p>
        <h2 className="font-bold flex items-center gap-2" style={{ fontSize: 28, letterSpacing: '-0.04em' }}>
          <Shield size={24} style={{ color: 'var(--color-accent)' }} /> Quản trị viên
        </h2>
        <p style={{ fontSize: 14, color: 'var(--color-text-secondary)', marginTop: 2 }}>
          Quản lý người dùng và phân quyền sử dụng các tính năng.
        </p>
        </div>
      </div>

      {error && (
        <div
          className="p-4 rounded-xl"
          style={{
            fontSize: 13,
            background: 'color-mix(in srgb, var(--color-danger) 12%, transparent)',
            border: '0.5px solid color-mix(in srgb, var(--color-danger) 30%, transparent)',
            color: 'var(--color-danger)',
          }}
        >
          {error}
        </div>
      )}

      <Segmented<'users' | 'stats' | 'history'>
        value={adminTab}
        onChange={(v) => setAdminTab(v)}
        size="lg"
        options={[
          { value: 'users', label: 'Người dùng', icon: Users },
          { value: 'stats', label: 'Thống kê', icon: Sparkles },
          { value: 'history', label: 'Lịch sử', icon: Clock },
        ]}
      />

      {adminTab === 'history' ? (
        <div className="space-y-4">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div>
              <p className="font-semibold" style={{ fontSize: 13, color: 'var(--color-text)' }}>
                {visibleAdminHistory.length.toLocaleString()} ảnh đang hiển thị
              </p>
              <p style={{ fontSize: 10.5, color: 'var(--color-text-tertiary)', marginTop: 1 }}>
                {history.length.toLocaleString()} ảnh trong lịch sử tổng
              </p>
            </div>
            <label
              className="flex items-center gap-2"
              style={{
                height: 38,
                padding: '0 10px',
                borderRadius: 10,
                background: historyEmployeeFilter === 'all' ? 'var(--color-fill)' : 'var(--color-accent-soft)',
                border: `1px solid ${historyEmployeeFilter === 'all' ? 'var(--color-border-soft)' : 'var(--color-accent-muted)'}`,
                color: historyEmployeeFilter === 'all' ? 'var(--color-text-secondary)' : 'var(--color-accent)',
              }}
            >
              <Users size={14} className="shrink-0" />
              <select
                value={historyEmployeeFilter}
                onChange={(event) => setHistoryEmployeeFilter(event.target.value)}
                aria-label="Lọc lịch sử theo nhân viên"
                className="outline-none min-w-0"
                style={{
                  width: 250,
                  maxWidth: '70vw',
                  border: 'none',
                  background: 'transparent',
                  color: 'var(--color-text)',
                  fontSize: 12,
                  fontWeight: 600,
                }}
              >
                <option value="all">Tất cả nhân viên ({history.length})</option>
                {historyEmployeeOptions.map((employee) => (
                  <option key={employee.key} value={employee.key}>{employee.email} ({employee.count})</option>
                ))}
              </select>
            </label>
          </div>
          {history.length === 0 ? (
            <p style={{ fontSize: 13, color: 'var(--color-text-tertiary)', textAlign: 'center', padding: '40px 0' }}>
              Chưa có ảnh nào trong lịch sử. Ảnh sẽ tự lưu sau mỗi lần gen.
            </p>
          ) : visibleAdminHistory.length === 0 ? (
            <div className="rounded-2xl text-center" style={{ padding: '48px 20px', background: 'var(--color-card)', border: '0.5px solid var(--color-border-soft)' }}>
              <Users size={24} className="mx-auto mb-2" style={{ color: 'var(--color-text-tertiary)' }} />
              <p className="font-semibold" style={{ fontSize: 13, color: 'var(--color-text)' }}>Nhân viên này chưa có lịch sử gen.</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
              {visibleAdminHistory.map((h) => {
                const d = h.ts?.toMillis ? new Date(h.ts.toMillis()) : h.ts?.seconds ? new Date(h.ts.seconds * 1000) : null;
                const itemId = h.id || `${h.uid || h.email || 'history'}-${h.url}`;
                const basePrompt = String(h.prompt || '').trim();
                const supplementaryPrompt = String(h.supplementaryPrompt || '').trim();
                const historyPrompt = [basePrompt, supplementaryPrompt ? `[YÊU CẦU BỔ SUNG]:\n${supplementaryPrompt}` : '']
                  .filter(Boolean)
                  .join('\n\n');
                const promptExpanded = Boolean(expandedHistoryPrompts[itemId]);
                const canExpandPrompt = historyPrompt.length > 145;
                return (
                  <article key={itemId} className="relative group overflow-hidden flex flex-col" style={{ background: 'var(--color-card)', borderRadius: 14, border: '0.5px solid var(--color-border-soft)', boxShadow: 'var(--shadow-card)' }}>
                    <div className="aspect-square overflow-hidden" style={{ background: 'var(--color-card-secondary)' }}>
                      <img src={h.url} alt={`Ảnh lịch sử do ${h.email || h.uid || 'nhân viên'} tạo`} className="w-full h-full object-cover" loading="lazy" />
                    </div>
                    <div className="p-3 flex-1 flex flex-col gap-2.5">
                      <div>
                        <p className="font-semibold truncate" style={{ fontSize: 12, color: 'var(--color-text)' }}>{MODEL_LABELS[h.model] || h.model || 'Không rõ model'}</p>
                        <p className="truncate" style={{ fontSize: 10.5, color: 'var(--color-text-tertiary)' }}>
                          {FEATURE_LABELS[h.feature] || h.feature || 'Không rõ tính năng'}{h.size ? ` · ${String(h.size).toUpperCase()}` : ''}
                        </p>
                        <p className="truncate" style={{ fontSize: 10, color: 'var(--color-text-tertiary)', marginTop: 2 }} title={h.email || h.uid}>
                          {h.email || h.uid || 'Ẩn danh'}{d ? ` · ${d.toLocaleDateString('vi-VN')} ${d.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}` : ''}
                        </p>
                      </div>

                      <div className="mt-auto rounded-xl" style={{ padding: '9px 10px', background: 'var(--color-fill)' }}>
                        <div className="flex items-center justify-between gap-2 mb-1.5">
                          <span className="uppercase font-semibold" style={{ fontSize: 8.5, color: 'var(--color-text-tertiary)', letterSpacing: '0.06em' }}>Prompt đã dùng</span>
                          {historyPrompt && (
                            <button
                              type="button"
                              onClick={() => void copyAdminHistoryPrompt(historyPrompt, itemId)}
                              className="inline-flex items-center gap-1 transition-colors"
                              style={{ fontSize: 9.5, fontWeight: 600, color: copiedHistoryPromptId === itemId ? 'var(--color-success)' : 'var(--color-accent)' }}
                              title="Copy prompt"
                            >
                              {copiedHistoryPromptId === itemId ? <Check size={11} /> : <Copy size={11} />}
                              {copiedHistoryPromptId === itemId ? 'Đã copy' : 'Copy'}
                            </button>
                          )}
                        </div>
                        {historyPrompt ? (
                          <>
                            <p
                              style={{
                                fontSize: 10.5,
                                lineHeight: 1.5,
                                color: 'var(--color-text-secondary)',
                                display: promptExpanded ? 'block' : '-webkit-box',
                                WebkitBoxOrient: 'vertical',
                                WebkitLineClamp: promptExpanded ? undefined : 3,
                                overflow: promptExpanded ? 'visible' : 'hidden',
                                whiteSpace: 'pre-wrap',
                                overflowWrap: 'anywhere',
                              }}
                              title={historyPrompt}
                            >
                              {historyPrompt}
                            </p>
                            {canExpandPrompt && (
                              <button
                                type="button"
                                onClick={() => setExpandedHistoryPrompts((current) => ({ ...current, [itemId]: !current[itemId] }))}
                                className="inline-flex items-center gap-1 mt-1.5 transition-colors"
                                style={{ fontSize: 9.5, fontWeight: 600, color: 'var(--color-text-tertiary)' }}
                              >
                                {promptExpanded ? <ChevronUp size={11} /> : <ChevronDown size={11} />}
                                {promptExpanded ? 'Thu gọn' : 'Xem đầy đủ'}
                              </button>
                            )}
                          </>
                        ) : (
                          <p style={{ fontSize: 10.5, lineHeight: 1.45, color: 'var(--color-text-tertiary)', fontStyle: 'italic' }}>
                            Dữ liệu cũ chưa lưu prompt.
                          </p>
                        )}
                      </div>
                    </div>
                    <div className="absolute top-2 right-2 flex gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button onClick={() => setZoomUrl(h.url)} className="rounded-lg flex items-center justify-center" style={{ width: 28, height: 28, background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(12px)', color: '#fff', boxShadow: 'var(--shadow-pop)' }} title="Phóng to"><ZoomIn size={14} /></button>
                      <button onClick={() => { const a = document.createElement('a'); a.href = h.url; a.download = `${h.id}.jpg`; a.target = '_blank'; a.click(); }} className="rounded-lg flex items-center justify-center" style={{ width: 28, height: 28, background: 'var(--color-accent)', color: '#fff', boxShadow: 'var(--shadow-pop)' }} title="Tải về"><Download size={14} /></button>
                      <button onClick={() => deleteHistoryItem(h)} className="rounded-lg flex items-center justify-center" style={{ width: 28, height: 28, background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(12px)', color: '#fff', boxShadow: 'var(--shadow-pop)' }} title="Xóa"><Trash2 size={14} /></button>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
          {zoomUrl && (
            <div className="fixed inset-0 z-[80] flex items-center justify-center p-6" style={{ background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(8px)' }} onClick={() => setZoomUrl(null)}>
              <img src={zoomUrl} alt="" className="max-w-full max-h-full object-contain rounded-xl" onClick={(e) => e.stopPropagation()} />
            </div>
          )}
        </div>
      ) : adminTab === 'stats' ? (
        <div className="space-y-6">
          {/* Số dư Kie.ai */}
          <div className="p-5 flex items-center justify-between" style={{ background: 'linear-gradient(135deg, var(--color-accent-soft), transparent)', borderRadius: 18, border: '0.5px solid var(--color-border-soft)', boxShadow: 'var(--shadow-card)' }}>
            <div className="flex items-center gap-3">
              <div className="flex items-center justify-center rounded-full" style={{ width: 40, height: 40, background: 'var(--color-accent)', color: '#fff' }}>
                <Wallet size={20} />
              </div>
              <div>
                <p className="uppercase font-semibold" style={{ fontSize: 10, color: 'var(--color-text-tertiary)', letterSpacing: '0.06em' }}>Số dư Kie.ai</p>
                <div className="font-bold" style={{ fontSize: 26, color: 'var(--color-text)', letterSpacing: '-0.02em' }}>
                  {kieCreditsLoading ? '…' : kieCredits !== null ? `${kieCredits.toLocaleString()} credits` : 'Không lấy được'}
                </div>
              </div>
            </div>
            <button
              onClick={fetchKieCredits}
              disabled={kieCreditsLoading}
              className="rounded-full p-2 transition-colors"
              style={{ color: 'var(--color-text-secondary)', background: 'var(--color-fill)' }}
              title="Làm mới số dư"
            >
              <RotateCw size={16} className={kieCreditsLoading ? 'animate-spin' : ''} />
            </button>
          </div>

          {/* Top stats — handoff order: label top / value mid / sub bottom */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {[
              {
                label: 'Tổng ảnh đã gen',
                value: analytics.totalImages.toLocaleString(),
                sub: null,
                mono: false,
                color: 'var(--color-accent)',
              },
              {
                label: 'Chi phí ước tính',
                value: `$${analytics.totalCost.toFixed(2)}`,
                sub: { text: `${analytics.totalCredits.toLocaleString()} credits`, color: 'var(--color-text-tertiary)' },
                mono: true,
                color: 'var(--color-success)',
              },
              {
                label: 'Lượt truy cập tab',
                value: analytics.totalViews.toLocaleString(),
                sub: null,
                mono: false,
                color: 'var(--color-warning)',
              },
            ].map((s) => (
              <div
                key={s.label}
                className="p-5 flex flex-col gap-2"
                style={{
                  background: 'var(--color-card)',
                  borderRadius: 16,
                  border: '0.5px solid var(--color-border-soft)',
                  boxShadow: 'var(--shadow-card)',
                }}
              >
                <div className="uppercase font-semibold" style={{ fontSize: 10, color: 'var(--color-text-tertiary)', letterSpacing: '0.06em' }}>
                  {s.label}
                </div>
                <div
                  className="font-bold"
                  style={{
                    fontSize: 24,
                    letterSpacing: '-0.02em',
                    color: 'var(--color-text)',
                    fontFamily: s.mono ? 'var(--font-mono)' : undefined,
                  }}
                >
                  {s.value}
                </div>
                <div style={{ fontSize: 10.5, fontWeight: 600, color: s.sub?.color ?? 'var(--color-text-tertiary)', minHeight: 14 }}>
                  {s.sub?.text ?? ''}
                </div>
              </div>
            ))}
          </div>

          {/* Time filter — moved below the headline stats */}
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div className="flex items-center gap-3 flex-wrap min-w-0">
              <Segmented<'7d' | '15d' | '30d' | 'custom'>
                value={timeFilter}
                onChange={(v) => setTimeFilter(v)}
                size="sm"
                options={[
                  { value: '7d', label: '7 ngày' },
                  { value: '15d', label: '15 ngày' },
                  { value: '30d', label: '30 ngày' },
                  { value: 'custom', label: 'Tùy chọn' },
                ]}
              />
              <label
                className="flex items-center gap-2 min-w-0"
                style={{
                  height: 38,
                  padding: '0 10px',
                  borderRadius: 10,
                  background: employeeFilter === 'all' ? 'var(--color-fill)' : 'var(--color-accent-soft)',
                  border: `1px solid ${employeeFilter === 'all' ? 'var(--color-border-soft)' : 'var(--color-accent-muted)'}`,
                  color: employeeFilter === 'all' ? 'var(--color-text-secondary)' : 'var(--color-accent)',
                }}
              >
                <Users size={14} className="shrink-0" />
                <select
                  value={employeeFilter}
                  onChange={(event) => setEmployeeFilter(event.target.value)}
                  aria-label="Lọc thống kê theo nhân viên"
                  className="outline-none min-w-0"
                  style={{
                    width: 230,
                    maxWidth: '52vw',
                    background: 'transparent',
                    color: 'var(--color-text)',
                    border: 'none',
                    fontSize: 12,
                    fontWeight: 600,
                  }}
                >
                  <option value="all">Tất cả nhân viên</option>
                  {employeeOptions.map((employee) => (
                    <option key={employee.key} value={employee.key}>{employee.email}</option>
                  ))}
                </select>
              </label>
              {employeeFilter !== 'all' && (
                <button
                  type="button"
                  onClick={() => setEmployeeFilter('all')}
                  className="transition-colors"
                  style={{ fontSize: 11, fontWeight: 600, color: 'var(--color-text-tertiary)' }}
                >
                  Bỏ lọc
                </button>
              )}
            </div>
            {timeFilter === 'custom' ? (
              <div className="flex items-center gap-2">
                <input
                  type="date"
                  value={customFrom}
                  onChange={(e) => setCustomFrom(e.target.value)}
                  className="outline-none"
                  style={{ background: 'var(--color-fill)', color: 'var(--color-text)', borderRadius: 8, padding: '4px 8px', fontSize: 12, border: '0.5px solid var(--color-border-soft)' }}
                />
                <span style={{ fontSize: 12, color: 'var(--color-text-tertiary)' }}>→</span>
                <input
                  type="date"
                  value={customTo}
                  onChange={(e) => setCustomTo(e.target.value)}
                  className="outline-none"
                  style={{ background: 'var(--color-fill)', color: 'var(--color-text)', borderRadius: 8, padding: '4px 8px', fontSize: 12, border: '0.5px solid var(--color-border-soft)' }}
                />
              </div>
            ) : (
              <span style={{ fontSize: 12, color: 'var(--color-text-tertiary)' }}>
                {timeFilter === '7d' ? '7 ngày qua' : timeFilter === '15d' ? '15 ngày qua' : '30 ngày qua'}
              </span>
            )}
          </div>

          {/* Employee ledger + distribution. The compact table keeps the core
              comparison visible; selecting a row exposes the deeper metrics. */}
          <section
            className="p-4 sm:p-5"
            style={{
              background: 'var(--color-card)',
              borderRadius: 18,
              border: '0.5px solid var(--color-border-soft)',
              boxShadow: 'var(--shadow-card)',
            }}
          >
            <div className="flex items-start justify-between gap-3 flex-wrap mb-4">
              <div>
                <p className="font-bold" style={{ fontSize: 16, color: 'var(--color-text)', letterSpacing: '-0.02em' }}>
                  Hiệu suất theo nhân viên
                </p>
                <p style={{ fontSize: 11, color: 'var(--color-text-tertiary)', marginTop: 2 }}>
                  Bấm vào bảng hoặc biểu đồ để lọc toàn bộ dashboard.
                </p>
              </div>
              <span style={{ fontSize: 11, color: 'var(--color-text-tertiary)' }}>
                {employeeRows.length} nhân viên · {timeFilter === '7d' ? '7 ngày' : timeFilter === '15d' ? '15 ngày' : timeFilter === '30d' ? '30 ngày' : 'khoảng đã chọn'}
              </span>
            </div>

            {selectedEmployeeSummary && (
              <div
                className="mb-4 p-3 flex flex-col xl:flex-row xl:items-center gap-3"
                style={{ background: 'var(--color-accent-soft)', borderRadius: 13, border: '1px solid var(--color-accent-muted)' }}
              >
                <div className="flex items-center gap-2.5 xl:min-w-[250px]">
                  <div
                    className="flex items-center justify-center rounded-lg font-bold shrink-0"
                    style={{ width: 34, height: 34, background: 'var(--color-accent)', color: '#fff', fontSize: 13 }}
                  >
                    {selectedEmployeeSummary.email.slice(0, 1).toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <p className="font-semibold truncate" style={{ fontSize: 12, color: 'var(--color-text)' }}>{selectedEmployeeSummary.email}</p>
                    <p style={{ fontSize: 9.5, color: 'var(--color-text-tertiary)' }}>
                      {selectedEmployeeUser?.role === 'admin' ? 'Quản trị viên' : 'Nhân viên'} · đang xem chi tiết
                    </p>
                  </div>
                </div>
                <div className="grid flex-1 grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-1.5">
                  {[
                    ['Số lần gen', selectedEmployeeSummary.genEvents.toLocaleString()],
                    ['Ảnh / lần gen', selectedEmployeeSummary.genEvents > 0 ? (selectedEmployeeSummary.images / selectedEmployeeSummary.genEvents).toFixed(1) : '0'],
                    ['Chi phí / ảnh', selectedEmployeeSummary.images > 0 ? `$${(selectedEmployeeSummary.cost / selectedEmployeeSummary.images).toFixed(3)}` : '$0.000'],
                    ['Ngày hoạt động', selectedEmployeeSummary.activeDays.toLocaleString()],
                    ['Model dùng nhiều', MODEL_LABELS[selectedEmployeeSummary.topModel] || selectedEmployeeSummary.topModel],
                    ['Tính năng chính', FEATURE_LABELS[selectedEmployeeSummary.topFeature] || selectedEmployeeSummary.topFeature],
                  ].map(([label, value]) => (
                    <div key={label} className="px-2.5 py-2 rounded-lg" style={{ background: 'var(--color-card)' }}>
                      <p className="uppercase font-semibold" style={{ fontSize: 8, color: 'var(--color-text-tertiary)', letterSpacing: '0.05em' }}>{label}</p>
                      <p className="font-semibold truncate mt-0.5" style={{ fontSize: 11, color: 'var(--color-text)' }} title={value}>{value}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1.25fr)_minmax(390px,0.75fr)] gap-4 items-stretch">
              <div className="overflow-hidden rounded-xl" style={{ border: '0.5px solid var(--color-border-soft)' }}>
                <div className="overflow-x-auto">
                  <table className="w-full" style={{ minWidth: 620, borderCollapse: 'collapse', fontVariantNumeric: 'tabular-nums' }}>
                    <thead>
                      <tr style={{ background: 'var(--color-fill)', borderBottom: '1px solid var(--color-border-soft)' }}>
                        {['Nhân viên', 'Lần gen', 'Số ảnh', 'Credits', 'Chi phí'].map((heading) => (
                          <th
                            key={heading}
                            className="text-left uppercase font-semibold"
                            style={{ padding: '8px 10px', fontSize: 8.5, color: 'var(--color-text-tertiary)', letterSpacing: '0.05em', whiteSpace: 'nowrap' }}
                          >
                            {heading}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {employeeRows.map((employee, index) => {
                        const active = employeeFilter === employee.key;
                        const employeeUser = users.find((user) => (user.email || user.uid) === employee.key);
                        return (
                          <tr
                            key={employee.key}
                            onClick={() => setEmployeeFilter(active ? 'all' : employee.key)}
                            className="transition-colors"
                            style={{
                              borderBottom: index === employeeRows.length - 1 ? 'none' : '1px solid var(--color-border-soft)',
                              background: active ? 'var(--color-accent-soft)' : 'transparent',
                              cursor: 'pointer',
                            }}
                            title={active ? 'Bấm để bỏ lọc nhân viên này' : `Xem chi tiết ${employee.email}`}
                          >
                            <td style={{ padding: '8px 10px' }}>
                              <div className="flex items-center gap-2 min-w-0">
                                <span
                                  className="flex items-center justify-center rounded-md font-bold shrink-0"
                                  style={{ width: 26, height: 26, background: active ? 'var(--color-accent)' : 'var(--color-fill-strong)', color: active ? '#fff' : 'var(--color-text-secondary)', fontSize: 9.5 }}
                                >
                                  {employee.email.slice(0, 1).toUpperCase()}
                                </span>
                                <div className="min-w-0">
                                  <p className="font-semibold truncate" style={{ maxWidth: 210, fontSize: 11, color: 'var(--color-text)' }}>{employee.email}</p>
                                  <p style={{ fontSize: 8.5, color: 'var(--color-text-tertiary)' }}>{employeeUser?.role === 'admin' ? 'admin' : 'nhân viên'}</p>
                                </div>
                              </div>
                            </td>
                            <td style={{ padding: '8px 10px', fontSize: 11, color: 'var(--color-text-secondary)' }}>{employee.genEvents.toLocaleString()}</td>
                            <td className="font-semibold" style={{ padding: '8px 10px', fontSize: 11, color: 'var(--color-text)' }}>{employee.images.toLocaleString()}</td>
                            <td style={{ padding: '8px 10px', fontSize: 11, color: 'var(--color-text-secondary)' }}>{employee.credits.toLocaleString()}</td>
                            <td className="font-semibold" style={{ padding: '8px 10px', fontSize: 11, color: 'var(--color-success)' }}>${employee.cost.toFixed(2)}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                {employeeRows.length === 0 && (
                  <p className="text-center py-8" style={{ fontSize: 12, color: 'var(--color-text-tertiary)' }}>Chưa có nhân viên hoặc dữ liệu sử dụng.</p>
                )}
              </div>

              <aside
                className="p-4 rounded-xl min-w-0"
                style={{ background: 'var(--color-card-secondary)', border: '0.5px solid var(--color-border-soft)' }}
              >
                <div className="flex items-center justify-between gap-3 mb-3 flex-wrap">
                  <div>
                    <p className="font-semibold" style={{ fontSize: 12, color: 'var(--color-text)' }}>Tỷ trọng nhân viên</p>
                    <p style={{ fontSize: 9.5, color: 'var(--color-text-tertiary)', marginTop: 1 }}>Theo dữ liệu trong khoảng thời gian đã chọn</p>
                  </div>
                  <Segmented<EmployeeChartMetric>
                    value={employeeChartMetric}
                    onChange={setEmployeeChartMetric}
                    size="sm"
                    options={[
                      { value: 'credits', label: 'Credits' },
                      { value: 'cost', label: 'Chi phí' },
                      { value: 'images', label: 'Số ảnh' },
                    ]}
                  />
                </div>
                <EmployeeDistributionChart
                  rows={employeeRows}
                  metric={employeeChartMetric}
                  activeKey={employeeFilter}
                  onSelect={(key) => setEmployeeFilter(employeeFilter === key ? 'all' : key)}
                />
              </aside>
            </div>
          </section>

          {usage.length === 0 && (
            <p style={{ fontSize: 13, color: 'var(--color-text-tertiary)', textAlign: 'center', padding: '24px 0' }}>
              Chưa có dữ liệu. Số liệu sẽ xuất hiện khi nhân viên bắt đầu gen ảnh.
            </p>
          )}

          {/* Biểu đồ đường theo ngày. Vẫn render cả ngày không có ảnh để xu hướng không bị đứt đoạn. */}
          {(analytics.totalImages > 0 || analytics.geminiTotal > 0) && (
            <div className="p-5" style={{ background: 'var(--color-card)', borderRadius: 18, border: '0.5px solid var(--color-border-soft)', boxShadow: 'var(--shadow-card)' }}>
              <DailyUsageLineChart data={analytics.dailySeries.slice(-30)} />
            </div>
          )}

          {/* Master toggle — flips all 4 breakdown panels at once */}
          {(() => {
            const PANEL_KEYS = ['model', 'feature', 'user', 'view'] as const;
            const allPie = PANEL_KEYS.every((k) => chartView[k] === 'pie');
            return (
              <div className="flex items-center justify-end">
                <button
                  type="button"
                  onClick={() => {
                    const nextMode = allPie ? 'list' : 'pie';
                    const next: Record<string, 'list' | 'pie'> = {};
                    PANEL_KEYS.forEach((k) => { next[k] = nextMode; });
                    setChartView(next);
                  }}
                  className="inline-flex items-center gap-1.5 transition-colors hover:opacity-80"
                  style={{
                    padding: '6px 12px',
                    borderRadius: 9,
                    background: 'var(--color-fill)',
                    color: 'var(--color-text)',
                    fontSize: 12,
                    fontWeight: 600,
                    border: '0.5px solid var(--color-border-soft)',
                  }}
                  title="Chuyển dạng hiển thị cho cả 4 ô"
                >
                  {allPie ? <ListIcon size={13} /> : <PieChartIcon size={13} />}
                  {allPie ? 'Hiện tất cả dạng list' : 'Hiện tất cả dạng biểu đồ'}
                </button>
              </div>
            );
          })()}

          {/* By model + By feature */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="p-5" style={{ background: 'var(--color-card)', borderRadius: 18, border: '0.5px solid var(--color-border-soft)', boxShadow: 'var(--shadow-card)' }}>
              <div className="flex items-center justify-between mb-3">
                <p className="uppercase font-semibold" style={{ fontSize: 11, color: 'var(--color-text-tertiary)', letterSpacing: '0.06em' }}>Theo model · chất lượng</p>
                <button
                  type="button"
                  onClick={() => toggleChartView('model')}
                  className="p-1.5 rounded transition-colors"
                  style={{ color: 'var(--color-text-tertiary)', background: 'var(--color-fill)' }}
                  title={isPie('model') ? 'Xem dạng list' : 'Xem dạng biểu đồ tròn'}
                >
                  {isPie('model') ? <ListIcon size={14} /> : <PieChartIcon size={14} />}
                </button>
              </div>
              {isPie('model') ? (
                <PieChart
                  data={Object.entries(analytics.byModelSize)
                    .map(([m, sizes]) => ({
                      label: MODEL_LABELS[m] || m,
                      value: Object.values(sizes).reduce((s, x) => s + x.count, 0),
                    }))
                    .sort((a, b) => b.value - a.value)}
                />
              ) : (
                <div className="space-y-3">
                  {Object.entries(analytics.byModelSize).sort((a, b) => {
                    const ca = Object.values(a[1]).reduce((s, x) => s + x.count, 0);
                    const cb = Object.values(b[1]).reduce((s, x) => s + x.count, 0);
                    return cb - ca;
                  }).map(([m, sizes]) => {
                    const modelTotal = Object.values(sizes).reduce((acc, x) => ({ count: acc.count + x.count, cost: acc.cost + x.cost }), { count: 0, cost: 0 });
                    return (
                      <div key={m}>
                        <div className="flex items-center justify-between mb-1.5" style={{ fontSize: 13 }}>
                          <span className="font-semibold" style={{ color: 'var(--color-text)' }}>{MODEL_LABELS[m] || m}</span>
                          <span className="font-semibold" style={{ color: 'var(--color-text-secondary)' }}>{modelTotal.count} ảnh · <span style={{ color: 'var(--color-success)' }}>${modelTotal.cost.toFixed(2)}</span></span>
                        </div>
                        <div className="space-y-1 pl-3" style={{ borderLeft: '2px solid var(--color-border-soft)' }}>
                          {Object.entries(sizes).sort((a, b) => a[0].localeCompare(b[0])).map(([size, v]) => (
                            <div key={size} className="flex items-center justify-between" style={{ fontSize: 12 }}>
                              <span style={{ color: 'var(--color-text-tertiary)' }}>{size}</span>
                              <span style={{ color: 'var(--color-text-secondary)' }}>{v.count} ảnh · <span style={{ color: 'var(--color-success)' }}>${v.cost.toFixed(2)}</span></span>
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                  {Object.keys(analytics.byModelSize).length === 0 && <p style={{ fontSize: 12, color: 'var(--color-text-tertiary)' }}>—</p>}
                </div>
              )}
            </div>
            <div className="p-5" style={{ background: 'var(--color-card)', borderRadius: 18, border: '0.5px solid var(--color-border-soft)', boxShadow: 'var(--shadow-card)' }}>
              <div className="flex items-center justify-between mb-3">
                <p className="uppercase font-semibold" style={{ fontSize: 11, color: 'var(--color-text-tertiary)', letterSpacing: '0.06em' }}>Theo tính năng</p>
                <button
                  type="button"
                  onClick={() => toggleChartView('feature')}
                  className="p-1.5 rounded transition-colors"
                  style={{ color: 'var(--color-text-tertiary)', background: 'var(--color-fill)' }}
                  title={isPie('feature') ? 'Xem dạng list' : 'Xem dạng biểu đồ tròn'}
                >
                  {isPie('feature') ? <ListIcon size={14} /> : <PieChartIcon size={14} />}
                </button>
              </div>
              {isPie('feature') ? (
                <PieChart
                  data={Object.entries(analytics.byFeature)
                    .map(([f, c]) => ({ label: FEATURE_LABELS[f] || f, value: c }))
                    .sort((a, b) => b.value - a.value)}
                />
              ) : (
                <div className="space-y-2">
                  {Object.entries(analytics.byFeature).sort((a, b) => b[1] - a[1]).map(([f, c]) => (
                    <div key={f} className="flex items-center justify-between" style={{ fontSize: 13 }}>
                      <span style={{ color: 'var(--color-text)' }}>{FEATURE_LABELS[f] || f}</span>
                      <span style={{ color: 'var(--color-text-secondary)' }}>{c} ảnh</span>
                    </div>
                  ))}
                  {Object.keys(analytics.byFeature).length === 0 && <p style={{ fontSize: 12, color: 'var(--color-text-tertiary)' }}>—</p>}
                </div>
              )}
            </div>
          </div>

          {/* By user + tab views */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="p-5" style={{ background: 'var(--color-card)', borderRadius: 18, border: '0.5px solid var(--color-border-soft)', boxShadow: 'var(--shadow-card)' }}>
              <div className="flex items-center justify-between mb-3">
                <p className="uppercase font-semibold" style={{ fontSize: 11, color: 'var(--color-text-tertiary)', letterSpacing: '0.06em' }}>Theo nhân viên</p>
                <button
                  type="button"
                  onClick={() => toggleChartView('user')}
                  className="p-1.5 rounded transition-colors"
                  style={{ color: 'var(--color-text-tertiary)', background: 'var(--color-fill)' }}
                  title={isPie('user') ? 'Xem dạng list' : 'Xem dạng biểu đồ tròn'}
                >
                  {isPie('user') ? <ListIcon size={14} /> : <PieChartIcon size={14} />}
                </button>
              </div>
              {isPie('user') ? (
                <PieChart
                  data={Object.entries(analytics.byUser)
                    .map(([u, v]) => ({ label: u, value: v.count }))
                    .sort((a, b) => b.value - a.value)}
                />
              ) : (
                <div className="space-y-2">
                  {Object.entries(analytics.byUser).sort((a, b) => b[1].count - a[1].count).map(([u, v]) => (
                    <div key={u} className="flex items-center justify-between" style={{ fontSize: 13 }}>
                      <span className="truncate" style={{ color: 'var(--color-text)', maxWidth: 200 }}>{u}</span>
                      <span style={{ color: 'var(--color-text-secondary)' }}>{v.count} ảnh · <span style={{ color: 'var(--color-success)' }}>${v.cost.toFixed(2)}</span></span>
                    </div>
                  ))}
                  {Object.keys(analytics.byUser).length === 0 && <p style={{ fontSize: 12, color: 'var(--color-text-tertiary)' }}>—</p>}
                </div>
              )}
            </div>
            <div className="p-5" style={{ background: 'var(--color-card)', borderRadius: 18, border: '0.5px solid var(--color-border-soft)', boxShadow: 'var(--shadow-card)' }}>
              <div className="flex items-center justify-between mb-3">
                <p className="uppercase font-semibold" style={{ fontSize: 11, color: 'var(--color-text-tertiary)', letterSpacing: '0.06em' }}>Lượt truy cập tab</p>
                <button
                  type="button"
                  onClick={() => toggleChartView('view')}
                  className="p-1.5 rounded transition-colors"
                  style={{ color: 'var(--color-text-tertiary)', background: 'var(--color-fill)' }}
                  title={isPie('view') ? 'Xem dạng list' : 'Xem dạng biểu đồ tròn'}
                >
                  {isPie('view') ? <ListIcon size={14} /> : <PieChartIcon size={14} />}
                </button>
              </div>
              {isPie('view') ? (
                <PieChart
                  unit="lượt"
                  data={Object.entries(analytics.byView)
                    .map(([v, c]) => ({ label: FEATURE_LABELS[v] || v, value: c }))
                    .sort((a, b) => b.value - a.value)}
                />
              ) : (
                <div className="space-y-2">
                  {Object.entries(analytics.byView).sort((a, b) => b[1] - a[1]).map(([v, c]) => (
                    <div key={v} className="flex items-center justify-between" style={{ fontSize: 13 }}>
                      <span style={{ color: 'var(--color-text)' }}>{FEATURE_LABELS[v] || v}</span>
                      <span style={{ color: 'var(--color-text-secondary)' }}>{c} lượt</span>
                    </div>
                  ))}
                  {Object.keys(analytics.byView).length === 0 && <p style={{ fontSize: 12, color: 'var(--color-text-tertiary)' }}>—</p>}
                </div>
              )}
            </div>
          </div>

          {/* Gemini direct calls (billed to GEMINI_API_KEY, not Kie) */}
          <div className="p-5" style={{ background: 'var(--color-card)', borderRadius: 18, border: '0.5px solid var(--color-border-soft)', boxShadow: 'var(--shadow-card)' }}>
            <div className="flex items-center justify-between mb-3">
              <div>
                <p className="uppercase font-semibold" style={{ fontSize: 11, color: 'var(--color-text-tertiary)', letterSpacing: '0.06em' }}>Gemini direct (không qua Kie)</p>
                <p style={{ fontSize: 11, color: 'var(--color-text-tertiary)', marginTop: 2 }}>
                  Các call tính vào <code>GEMINI_API_KEY</code>. Sau migrate chỉ còn Try-on white-bg — con số này phải ≈ 0 nếu không dùng Thay đồ.
                </p>
              </div>
              <div className="font-bold" style={{ fontSize: 22, letterSpacing: '-0.02em', color: analytics.geminiTotal > 0 ? 'var(--color-warning)' : 'var(--color-text-tertiary)' }}>
                {analytics.geminiTotal}
              </div>
            </div>
            {analytics.geminiTotal > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-3">
                <div>
                  <p className="uppercase font-semibold mb-2" style={{ fontSize: 10, color: 'var(--color-text-tertiary)', letterSpacing: '0.06em' }}>Theo tính năng</p>
                  <div className="space-y-1.5">
                    {(Object.entries(analytics.geminiByFeature) as [string, number][]).sort((a, b) => b[1] - a[1]).map(([f, c]) => (
                      <div key={f} className="flex items-center justify-between" style={{ fontSize: 12 }}>
                        <span style={{ color: 'var(--color-text)' }}>{f}</span>
                        <span style={{ color: 'var(--color-text-secondary)' }}>{c} call</span>
                      </div>
                    ))}
                  </div>
                </div>
                <div>
                  <p className="uppercase font-semibold mb-2" style={{ fontSize: 10, color: 'var(--color-text-tertiary)', letterSpacing: '0.06em' }}>Theo model</p>
                  <div className="space-y-1.5">
                    {(Object.entries(analytics.geminiByModel) as [string, number][]).sort((a, b) => b[1] - a[1]).map(([m, c]) => (
                      <div key={m} className="flex items-center justify-between" style={{ fontSize: 12 }}>
                        <span style={{ color: 'var(--color-text)' }}>{m}</span>
                        <span style={{ color: 'var(--color-text-secondary)' }}>{c} call</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              <p style={{ fontSize: 12, color: 'var(--color-text-tertiary)', marginTop: 8 }}>Không có call Gemini direct nào trong khoảng thời gian này. ✓</p>
            )}
          </div>

          <p style={{ fontSize: 11, color: 'var(--color-text-tertiary)' }}>
            * Tính theo số credit thật của Kie.ai (1 credit = $0.005). Tổng credit đã dùng khớp với mức trừ trên số dư.
          </p>
        </div>
      ) : (
        <>
      {/* Stats cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        {statCards.map((s) => (
          <div
            key={s.label}
            className="p-4 flex flex-col gap-2"
            style={{ background: 'var(--color-card)', borderRadius: 16, border: '0.5px solid var(--color-border-soft)', boxShadow: 'var(--shadow-card)' }}
          >
            <div
              className="flex items-center justify-center rounded-full"
              style={{ width: 32, height: 32, background: `color-mix(in srgb, ${s.color} 14%, transparent)`, color: s.color }}
            >
              <s.icon size={16} />
            </div>
            <div className="font-bold" style={{ fontSize: 24, letterSpacing: '-0.02em' }}>{s.value}</div>
            <div className="uppercase font-semibold" style={{ fontSize: 10, color: 'var(--color-text-tertiary)', letterSpacing: '0.06em' }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* Create User Form */}
      <div className="p-6" style={{ background: 'var(--color-card)', borderRadius: 18, border: '0.5px solid var(--color-border-soft)', boxShadow: 'var(--shadow-card)' }}>
        <h3 className="font-bold flex items-center gap-2 mb-4" style={{ fontSize: 17, letterSpacing: '-0.02em' }}>
          <UserPlus size={18} style={{ color: 'var(--color-accent)' }} /> Tạo tài khoản mới
        </h3>
        <form onSubmit={handleCreateUser} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block uppercase font-semibold mb-1.5" style={{ fontSize: 11, color: 'var(--color-text-tertiary)', letterSpacing: '0.06em' }}>Email</label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                style={inputStyle}
                onFocus={(e) => (e.currentTarget.style.borderColor = 'var(--color-accent)')}
                onBlur={(e) => (e.currentTarget.style.borderColor = 'transparent')}
                placeholder="user@example.com"
                required
              />
            </div>
            <div>
              <label className="block uppercase font-semibold mb-1.5" style={{ fontSize: 11, color: 'var(--color-text-tertiary)', letterSpacing: '0.06em' }}>Mật khẩu</label>
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                style={inputStyle}
                onFocus={(e) => (e.currentTarget.style.borderColor = 'var(--color-accent)')}
                onBlur={(e) => (e.currentTarget.style.borderColor = 'transparent')}
                placeholder="Tối thiểu 6 ký tự"
                minLength={6}
                required
              />
            </div>
          </div>
          <Button type="submit" variant="filled" size="md" icon={UserPlus} disabled={creating}>
            {creating ? 'Đang tạo…' : 'Tạo tài khoản'}
          </Button>
        </form>
      </div>

      {/* Users list — Apple Mail style rows */}
      <div style={{ background: 'var(--color-card)', borderRadius: 18, border: '0.5px solid var(--color-border-soft)', boxShadow: 'var(--shadow-card)', overflow: 'hidden' }}>
        <div className="px-6 py-4 flex items-center justify-between" style={{ borderBottom: '0.5px solid var(--color-border-soft)' }}>
          <h3 className="font-bold" style={{ fontSize: 17, letterSpacing: '-0.02em' }}>Danh sách người dùng</h3>
          <span style={{ fontSize: 12, color: 'var(--color-text-tertiary)' }}>{users.length} tài khoản</span>
        </div>

        {loading ? (
          <div className="py-12 text-center" style={{ fontSize: 13, color: 'var(--color-text-tertiary)' }}>Đang tải…</div>
        ) : users.length === 0 ? (
          <div className="py-12 text-center" style={{ fontSize: 13, color: 'var(--color-text-tertiary)' }}>Chưa có người dùng nào.</div>
        ) : (
          <div>
            {users.map((u, idx) => {
              const isAdmin = u.role === 'admin';
              const initial = (u.email || '?').slice(0, 1).toUpperCase();
              return (
                <div
                  key={u.uid}
                  className="px-6 py-4 flex items-center gap-4 flex-wrap transition-colors"
                  style={{ borderTop: idx === 0 ? 'none' : '0.5px solid var(--color-border-soft)' }}
                >
                  {/* Avatar */}
                  <div
                    className="flex items-center justify-center text-white font-bold shrink-0 rounded-full"
                    style={{
                      width: 40,
                      height: 40,
                      fontSize: 16,
                      background: isAdmin
                        ? 'linear-gradient(135deg, var(--color-indigo), var(--color-purple))'
                        : 'linear-gradient(135deg, var(--color-pink), var(--color-warning))',
                    }}
                  >
                    {initial}
                  </div>

                  {/* Email + authentication status */}
                  <div className="flex-1 min-w-[180px]">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold" style={{ fontSize: 14, color: 'var(--color-text)' }}>{u.email}</span>
                      {isAdmin
                        ? <Pill tone="accent">admin</Pill>
                        : <Pill tone="secondary">user</Pill>}
                    </div>
                    <div className="mt-1" style={{ fontSize: 11, color: 'var(--color-text-tertiary)' }}>
                      Mật khẩu được Firebase Authentication quản lý
                    </div>
                  </div>

                  {/* Permission switches */}
                  {!isAdmin && (
                    <div className="flex items-center gap-5">
                      <div className="flex flex-col items-center gap-1">
                        <span className="uppercase font-semibold" style={{ fontSize: 9, color: 'var(--color-text-tertiary)', letterSpacing: '0.06em' }}>Quần áo</span>
                        <Switch size="sm" checked={!!u.canUseClothing} onChange={() => togglePermission(u.uid, 'canUseClothing', !!u.canUseClothing)} ariaLabel="Quyền Quần áo" />
                      </div>
                      <div className="flex flex-col items-center gap-1">
                        <span className="uppercase font-semibold" style={{ fontSize: 9, color: 'var(--color-text-tertiary)', letterSpacing: '0.06em' }}>Ecom</span>
                        <Switch size="sm" checked={!!u.canUseEcom} onChange={() => togglePermission(u.uid, 'canUseEcom', !!u.canUseEcom)} ariaLabel="Quyền Ecom" />
                      </div>
                      <div className="flex flex-col items-center gap-1">
                        <span className="uppercase font-semibold" style={{ fontSize: 9, color: 'var(--color-text-tertiary)', letterSpacing: '0.06em' }}>OFA</span>
                        <Switch size="sm" checked={!!u.canUseOfa} onChange={() => togglePermission(u.uid, 'canUseOfa', !!u.canUseOfa)} ariaLabel="Quyền OFA" />
                      </div>
                      <div className="flex flex-col items-center gap-1">
                        <span className="uppercase font-semibold" style={{ fontSize: 9, color: 'var(--color-text-tertiary)', letterSpacing: '0.06em' }}>Picset</span>
                        <Switch size="sm" checked={!!u.canUsePicset} onChange={() => togglePermission(u.uid, 'canUsePicset', !!u.canUsePicset)} ariaLabel="Quyền Picset" />
                      </div>
                      <div className="flex flex-col items-center gap-1">
                        <span className="uppercase font-semibold" style={{ fontSize: 9, color: 'var(--color-text-tertiary)', letterSpacing: '0.06em' }}>RH</span>
                        <Switch size="sm" checked={!!u.canUseRunninghub} onChange={() => togglePermission(u.uid, 'canUseRunninghub', !!u.canUseRunninghub)} ariaLabel="Quyền Runninghub" />
                      </div>
                    </div>
                  )}
                  {isAdmin && (
                    <Pill tone="accent">Toàn quyền</Pill>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
        </>
      )}
    </div>
  );
}
