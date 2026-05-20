import { useMemo } from "react";
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";

type CategoryDatum = {
  category: string;
  count: number;
};

type Props = {
  data: CategoryDatum[];
};

export default function ComplianceCategoryChart({ data }: Props) {
  const hashString = (value: string, seed = 0) => {
    let hash = seed | 0;
    for (let i = 0; i < value.length; i++) {
      hash = ((hash << 5) - hash + value.charCodeAt(i)) | 0;
    }
    return hash;
  };

  const hueDistance = (a: number, b: number) => {
    const diff = Math.abs(a - b) % 360;
    return Math.min(diff, 360 - diff);
  };

  const pickDistinctHslColor = (category: string, usedHues: number[]) => {
    const normalized = String(category ?? '').trim().toLowerCase();
    const baseHue = Math.abs(hashString(normalized, 0)) % 360;

    // Stable, visually consistent saturation/lightness.
    const sat = 74;
    const light = 50;

    // Golden angle hop spreads colors well while remaining deterministic.
    const step = 137.508;
    const minHueGap = 26;

    let hue = baseHue;
    for (let i = 0; i < 48; i++) {
      if (usedHues.every((h) => hueDistance(hue, h) >= minHueGap)) {
        usedHues.push(hue);
        return `hsl(${hue.toFixed(1)} ${sat}% ${light}%)`;
      }
      hue = (hue + step) % 360;
    }

    // Fallback: accept base hue even if crowded.
    usedHues.push(baseHue);
    return `hsl(${baseHue.toFixed(1)} ${sat}% ${light}%)`;
  };

  const normalized = useMemo(() => {
    const rows = (data || [])
      .filter((d) => d && typeof d.category === "string" && d.category.trim().length > 0)
      .map((d) => ({ category: d.category.trim(), count: Number(d.count || 0) }));

    return [...rows].sort((a, b) => b.count - a.count).slice(0, 10);
  }, [data]);

  if (!normalized.length) {
    return <div className="h-[220px] flex items-center justify-center text-sm text-gray-500">No category data</div>;
  }

  const donutData = useMemo(
    () => {
      const usedHues: number[] = [];
      return normalized.map((item) => ({
        ...item,
        color: pickDistinctHslColor(item.category, usedHues),
      }));
    },
    [normalized]
  );

  const renderLabel = (props: any) => {
    const { cx, cy, midAngle, innerRadius, outerRadius, percent } = props;
    if (typeof percent !== 'number' || percent < 0.08) return null;

    const cxNum = Number(cx);
    const cyNum = Number(cy);
    if (!Number.isFinite(cxNum) || !Number.isFinite(cyNum)) return null;

    const RADIAN = Math.PI / 180;
    const radius = innerRadius + (outerRadius - innerRadius) * 0.55;
    const rawX = cxNum + radius * Math.cos(-midAngle * RADIAN);
    const rawY = cyNum + radius * Math.sin(-midAngle * RADIAN);

    const pad = 36;
    const x = Math.max(pad, Math.min(rawX, (cxNum * 2) - pad));
    const y = Math.max(pad, Math.min(rawY, (cyNum * 2) - pad));

    return (
      <text x={x} y={y} fill="#ffffff" textAnchor="middle" dominantBaseline="central" fontSize={12} fontWeight={600}>
        {(percent * 100).toFixed(1)}%
      </text>
    );
  };

  return (
    <div className="w-full min-h-[320px] flex flex-col sm:flex-row items-center gap-6">
      <div className="h-[320px] w-full sm:flex-1 min-w-0 flex items-center justify-center">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart margin={{ top: 10, right: 10, bottom: 10, left: 10 }}>
            <Pie
              data={donutData}
              cx="50%"
              cy="50%"
              outerRadius="86%"
              paddingAngle={2}
              dataKey="count"
              nameKey="category"
              label={renderLabel}
              labelLine={false}
            >
              {donutData.map((entry) => (
                <Cell key={`cell-${entry.category}`} fill={entry.color} />
              ))}
            </Pie>
            <Tooltip
              formatter={(value: number) => [`${Number(value).toLocaleString()} filings`, 'Filings']}
              contentStyle={{
                backgroundColor: 'hsl(var(--card))',
                border: '1px solid hsl(var(--border))',
                borderRadius: '8px',
                boxShadow: '0 4px 16px rgba(0,0,0,0.08)',
                padding: '12px',
              }}
              labelStyle={{ color: 'hsl(var(--foreground))', fontWeight: 600, marginBottom: 6 }}
            />
          </PieChart>
        </ResponsiveContainer>
      </div>

      <div className="w-full sm:w-60 sm:max-h-[320px] self-stretch sm:self-auto flex">
        <div className="max-h-[280px] sm:max-h-[320px] overflow-y-auto custom-scrollbar pr-2">
          <div className="space-y-4">
            {donutData.map((item) => (
              <div key={item.category} className="flex items-center gap-3">
                <span className="h-3 w-3 rounded-sm" style={{ backgroundColor: item.color }} />
                <div className="text-sm text-gray-700 break-words">{item.category}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
