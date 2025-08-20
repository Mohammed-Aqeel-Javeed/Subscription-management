import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

export interface ComplianceTrendsChartProps {
  data: { date: string; submitted: number; total: number }[];
}

export default function ComplianceTrendsChart({ data }: ComplianceTrendsChartProps) {
  if (!data || data.length === 0) {
    return <div className="h-full flex items-center justify-center text-gray-500">No trend data available</div>;
  }
  return (
    <ResponsiveContainer width="100%" height={320}>
      <LineChart data={data}>
        <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
        <XAxis 
          dataKey="date" 
          axisLine={false}
          tickLine={false}
          className="text-sm text-gray-600"
        />
        <YAxis 
          axisLine={false}
          tickLine={false}
          className="text-sm text-gray-600"
          tickFormatter={(value) => value.toLocaleString()}
        />
        <Tooltip 
          formatter={(value: number, name: string) => [value.toLocaleString(), name === 'submitted' ? 'Submitted' : 'Total']}
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
          dataKey="submitted" 
          stroke="hsl(221, 83%, 53%)"
          strokeWidth={3}
          dot={{ fill: 'hsl(221, 83%, 53%)', strokeWidth: 2, r: 4 }}
          activeDot={{ r: 6 }}
          name="Submitted"
        />
      </LineChart>
    </ResponsiveContainer>
  );
}
