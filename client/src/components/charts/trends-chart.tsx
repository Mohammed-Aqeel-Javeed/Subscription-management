import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import type { SpendingTrend } from '@shared/schema';

interface TrendsChartProps {
  data: SpendingTrend[];
}

export default function TrendsChart({ data }: TrendsChartProps) {
  return (
    <ResponsiveContainer width="100%" height={320}>
      <LineChart data={data}>
        <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
        <XAxis 
          dataKey="month" 
          axisLine={false}
          tickLine={false}
          className="text-sm text-gray-600"
        />
        <YAxis 
          axisLine={false}
          tickLine={false}
          className="text-sm text-gray-600"
          tickFormatter={(value) => `$${value.toLocaleString()}`}
        />
        <Tooltip 
          formatter={(value: number) => [`$${value.toLocaleString()}`, 'Monthly Spend']}
          labelClassName="text-gray-900"
          contentStyle={{
            backgroundColor: 'white',
            border: '1px solid #e5e7eb',
            borderRadius: '8px',
            boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
          }}
        />
        <Line 
          type="monotone" 
          dataKey="amount" 
          stroke="hsl(221, 83%, 53%)"
          strokeWidth={3}
          dot={{ fill: 'hsl(221, 83%, 53%)', strokeWidth: 2, r: 4 }}
          activeDot={{ r: 6 }}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}
