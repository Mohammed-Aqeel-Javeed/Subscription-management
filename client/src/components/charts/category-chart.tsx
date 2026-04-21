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
  const themeFallbackColors = [
    'hsl(var(--chart-5))',
    'hsl(var(--chart-1))',
    'hsl(var(--chart-2))',
    'hsl(var(--chart-3))',
    'hsl(var(--chart-4))',
  ];

  const stableFallbackColorForCategory = (category: string) => {
    const token = String(category || 'Other').trim().toLowerCase() || 'other';
    let hash = 0;
    for (let i = 0; i < token.length; i++) {
      hash = (hash * 31 + token.charCodeAt(i)) >>> 0;
    }
    return themeFallbackColors[hash % themeFallbackColors.length];
  };

  const sorted = [...data]
    .map((item) => ({
      category: String(item.category ?? 'Other'),
      amount: Number(item.amount) || 0,
      color: String(item.color || ''),
    }))
    .sort((a, b) => b.amount - a.amount);

  const donutData: DonutItem[] = sorted.map((item, index) => ({
    ...item,
    color: item.color || stableFallbackColorForCategory(item.category) || themeFallbackColors[index % themeFallbackColors.length],
  }));

  const renderLabel = (props: any) => {
    const { cx, cy, midAngle, innerRadius, outerRadius, percent } = props;
    if (typeof percent !== 'number' || percent < 0.08) return null;
    // If the user filters down to a single category, the default label can look like "00.0%"
    // because the tooltip/positioning hides the leading digit. Put it in the center.
    if (donutData.length === 1) {
      return (
        <text x={cx} y={cy} fill="#ffffff" textAnchor="middle" dominantBaseline="central" fontSize={14} fontWeight={700}>
          {(percent * 100).toFixed(1)}%
        </text>
      );
    }
    const RADIAN = Math.PI / 180;
    const radius = innerRadius + (outerRadius - innerRadius) * 0.55;
    const x = cx + radius * Math.cos(-midAngle * RADIAN);
    const y = cy + radius * Math.sin(-midAngle * RADIAN);
    return (
      <text x={x} y={y} fill="#ffffff" textAnchor="middle" dominantBaseline="central" fontSize={12} fontWeight={600}>
        {(percent * 100).toFixed(1)}%
      </text>
    );
  };

  return (
    <div className="h-[320px] w-full flex flex-col sm:flex-row items-start gap-6 [&_.recharts-wrapper:focus]:outline-none [&_.recharts-wrapper:focus-visible]:outline-none [&_.recharts-surface]:outline-none">
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
              {donutData.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.color} />
              ))}
            </Pie>
            <Tooltip
              cursor={false}
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
          {donutData.map((item, index) => {
            return (
              <div key={`${item.category}-${index}`} className="flex items-center gap-3">
                <span className="h-3 w-3 rounded-sm" style={{ backgroundColor: item.color }} />
                <div className="text-sm text-muted-foreground">{item.category}</div>
              </div>
            );
          })}
          </div>
        </div>
      </div>
    </div>
  );
}
