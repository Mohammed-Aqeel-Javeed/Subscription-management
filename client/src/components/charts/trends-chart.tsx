import { Area, AreaChart, CartesianGrid, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import type { SpendingTrend } from '@shared/schema';

interface TrendsChartProps {
  data: SpendingTrend[];
}

export default function TrendsChart({ data }: TrendsChartProps) {
  // CSS variables are stored as raw HSL triples (e.g. "221 83% 53%"), so wrap with hsl(...).
  const primary = 'hsl(var(--chart-1))';
  const primaryMuted = 'hsl(var(--muted-foreground))';

  const parseMonth = (value: string) => {
    // API returns YYYY-MM
    const [y, m] = String(value).split('-');
    const year = Number(y);
    const monthIndex = Number(m) - 1;
    if (!Number.isFinite(year) || !Number.isFinite(monthIndex) || monthIndex < 0 || monthIndex > 11) return null;
    return new Date(year, monthIndex, 1);
  };

  const formatMonthTick = (value: string) => {
    const d = parseMonth(value);
    if (!d) return String(value);
    return d.toLocaleString('en-US', { month: 'short' });
  };

  const formatMonthTitle = (value: string) => {
    const d = parseMonth(value);
    if (!d) return String(value);
    return d.toLocaleString('en-US', { month: 'long', year: 'numeric' });
  };

  const formatMoney = (value: number) => {
    const n = Number(value) || 0;
    return `$${n.toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
  };

  const formatAxis = (value: number) => {
    const n = Number(value) || 0;
    if (Math.abs(n) >= 1_000_000) return `$${(n / 1_000_000).toFixed(0)}M`;
    if (Math.abs(n) >= 1_000) return `$${(n / 1_000).toFixed(0)}k`;
    return `$${n.toFixed(0)}`;
  };

  const chartData = data.map((point) => {
    const actual = Number(point.amount) || 0;
    return { ...point, actual };
  });

  const actualSeries = chartData.map((p) => Number(p.actual) || 0);
  const n = actualSeries.length;
  const firstActual = n > 0 ? actualSeries[0] : 0;
  const lastActual = n > 0 ? actualSeries[n - 1] : 0;
  const avgActual = n > 0 ? actualSeries.reduce((a, b) => a + b, 0) / n : 0;

  // Budget line in the reference looks like a steady dotted trend line.
  // If the API doesn't provide budgets, derive a simple linear "target" line.
  const defaultBudgetStart = (firstActual || avgActual || 0) * 1.15;
  const defaultBudgetEnd = (lastActual || avgActual || 0) * 1.05;

  const withBudget = chartData.map((p, i) => {
    const providedBudget = (p as unknown as { budget?: number }).budget;
    const hasProvided = Number.isFinite(Number(providedBudget));

    const t = n > 1 ? i / (n - 1) : 0;
    const linearBudget = defaultBudgetStart + (defaultBudgetEnd - defaultBudgetStart) * t;

    return {
      ...p,
      budget: hasProvided ? Number(providedBudget) : Number.isFinite(linearBudget) ? linearBudget : 0,
    };
  });

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (!active || !payload || payload.length === 0) return null;

    const actual = payload.find((p: any) => p?.dataKey === 'actual');
    const budget = payload.find((p: any) => p?.dataKey === 'budget');

    return (
      <div
        style={{
          background: 'hsl(var(--card))',
          border: '1px solid hsl(var(--border))',
          borderRadius: 8,
          boxShadow: '0 4px 16px rgba(0,0,0,0.08)',
          padding: 12,
          minWidth: 220,
        }}
      >
        <div style={{ color: 'hsl(var(--foreground))', fontWeight: 600, marginBottom: 10 }}>
          {formatMonthTitle(String(label))}
        </div>

        <div style={{ display: 'grid', gap: 8 }}>
          {actual ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ width: 10, height: 10, borderRadius: 999, background: primary }} />
              <div style={{ color: primary, fontWeight: 500 }}>Actual Spend</div>
              <div style={{ marginLeft: 'auto', color: 'hsl(var(--foreground))', fontWeight: 700 }}>{formatMoney(actual.value)}</div>
            </div>
          ) : null}
          {budget ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ width: 10, height: 10, borderRadius: 999, background: primary, opacity: 0.45 }} />
              <div style={{ color: 'hsl(var(--muted-foreground))', fontWeight: 500 }}>Budget</div>
              <div style={{ marginLeft: 'auto', color: 'hsl(var(--foreground))', fontWeight: 700 }}>{formatMoney(budget.value)}</div>
            </div>
          ) : null}
        </div>
      </div>
    );
  };

  return (
    <ResponsiveContainer width="100%" height={320}>
      <AreaChart data={withBudget} margin={{ top: 6, right: 12, left: 6, bottom: 0 }}>
        <defs>
          <linearGradient id="actualGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor={primary} stopOpacity={0.18} />
            <stop offset="95%" stopColor={primary} stopOpacity={0.03} />
          </linearGradient>
        </defs>

        <CartesianGrid strokeDasharray="0" stroke="hsl(var(--border))" strokeOpacity={0.55} vertical={false} />
        <XAxis
          dataKey="month"
          axisLine={false}
          tickLine={false}
          tick={{ fill: primaryMuted, fontSize: 12 }}
          tickFormatter={formatMonthTick}
          dy={10}
        />
        <YAxis
          axisLine={false}
          tickLine={false}
          tick={{ fill: primaryMuted, fontSize: 12 }}
          tickFormatter={formatAxis}
          dx={-8}
        />
        <Tooltip
          content={<CustomTooltip />}
          cursor={{ stroke: 'hsl(var(--border))', strokeWidth: 1 }}
        />

        <Area
          type="monotone"
          dataKey="actual"
          stroke={primary}
          strokeWidth={2.5}
          fill="url(#actualGradient)"
          dot={{ r: 3.5, fill: 'hsl(var(--card))', stroke: primary, strokeWidth: 2 }}
          activeDot={{ r: 6.5, fill: 'hsl(var(--card))', stroke: primary, strokeWidth: 2 }}
        />
        <Line
          type="monotone"
          dataKey="budget"
          stroke={primary}
          strokeOpacity={0.38}
          strokeWidth={2}
          dot={false}
          strokeDasharray="5 5"
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}
