import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts';

export interface ComplianceCategoryChartProps {
  data: { category: string; count: number }[];
}

const COLORS = [
  '#6366F1', '#F59E42', '#10B981', '#EF4444', '#FBBF24', '#3B82F6', '#8B5CF6', '#EC4899', '#22D3EE', '#F472B6'
];

export default function ComplianceCategoryChart({ data }: ComplianceCategoryChartProps) {
  if (!data || data.length === 0) {
    return <div className="h-full flex items-center justify-center text-gray-500">No category data available</div>;
  }
  return (
    <ResponsiveContainer width="100%" height={320}>
      <PieChart>
        <Pie
          data={data}
          cx="50%"
          cy="50%"
          innerRadius={60}
          outerRadius={120}
          paddingAngle={5}
          dataKey="count"
          nameKey="category"
        >
          {data.map((entry, index) => (
            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
          ))}
        </Pie>
        <Tooltip 
          formatter={(value: number) => [value, 'Issues']}
          contentStyle={{
            backgroundColor: 'white',
            border: '1px solid #e5e7eb',
            borderRadius: '8px',
            boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
          }}
        />
        <Legend 
          verticalAlign="bottom" 
          height={36}
          iconType="circle"
          wrapperStyle={{ paddingTop: '20px' }}
        />
      </PieChart>
    </ResponsiveContainer>
  );
}
