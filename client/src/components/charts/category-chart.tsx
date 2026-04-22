import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts';
import type { CategoryBreakdown } from '@shared/schema';

interface CategoryChartProps {
  data: CategoryBreakdown[];
}

type DonutItem = {
  category: string;
  amount: number;
  color: string;
};

export default function CategoryChart({ data }: CategoryChartProps) {
  const hashString = (value: string, seed = 0) => {
    let hash = seed | 0;
    for (let i = 0; i < value.length; i++) {
      hash = ((hash << 5) - hash + value.charCodeAt(i)) | 0;
    }
    return hash;
  };

  const pickColorForCategory = (categoryInput: unknown) => {
    const normalized = String(categoryInput ?? 'other').trim().toLowerCase() || 'other';
    const h1 = Math.abs(hashString(normalized, 0));
    const h2 = Math.abs(hashString(normalized, 131));
    const h3 = Math.abs(hashString(normalized, 997));

    const hue = h1 % 360;
    const sat = 62 + (h2 % 18); // 62–79%
    const light = 44 + (h3 % 12); // 44–55%
    return `hsl(${hue} ${sat}% ${light}%)`;
  };

  const sorted = [...data]
    .map((item) => ({
      category: String(item.category ?? 'Other'),
      amount: Number(item.amount) || 0,
      color: String(item.color || ''),
    }))
    .sort((a, b) => b.amount - a.amount);

  const donutData: DonutItem[] = sorted.map((item) => ({
    ...item,
    // Always ensure a stable, non-repeating color per category.
    // If API provides a color, keep it; otherwise compute one.
    color: item.color || pickColorForCategory(item.category),
  }));

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

    // Clamp labels inside the chart to avoid SVG clipping at edges
    // (can happen when only a single slice is rendered).
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
    <div className="h-[320px] w-full flex flex-col sm:flex-row items-start gap-6">
      <div className="h-[320px] w-full sm:flex-1 min-w-0">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={donutData}
              cx="50%"
              cy="50%"
              innerRadius={70}
              outerRadius={110}
              paddingAngle={2}
              dataKey="amount"
              nameKey="category"
              label={renderLabel}
              labelLine={false}
            >
              {donutData.map((entry) => (
                <Cell key={`cell-${entry.category}`} fill={entry.color} />
              ))}
            </Pie>
            <Tooltip
              formatter={(value: number) => [`$${Number(value).toLocaleString()}`, 'Amount']}
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

      <div className="w-full sm:w-60">
        <div className="max-h-[280px] overflow-y-auto custom-scrollbar pr-2">
          <div className="space-y-4">
          {donutData.map((item) => {
            return (
              <div key={item.category} className="flex items-center gap-3">
                <span className="h-3 w-3 rounded-sm" style={{ backgroundColor: item.color }} />
                <div className="text-sm text-gray-700">{item.category}</div>
              </div>
            );
          })}
          </div>
        </div>
      </div>
    </div>
  );
}
