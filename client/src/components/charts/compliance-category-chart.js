import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts';
var COLORS = [
    '#6366F1', '#F59E42', '#10B981', '#EF4444', '#FBBF24', '#3B82F6', '#8B5CF6', '#EC4899', '#22D3EE', '#F472B6'
];
export default function ComplianceCategoryChart(_a) {
    var data = _a.data;
    if (!data || data.length === 0) {
        return _jsx("div", { className: "h-full flex items-center justify-center text-gray-500", children: "No category data available" });
    }
    return (_jsx(ResponsiveContainer, { width: "100%", height: 320, children: _jsxs(PieChart, { children: [_jsx(Pie, { data: data, cx: "50%", cy: "50%", innerRadius: 60, outerRadius: 120, paddingAngle: 5, dataKey: "count", nameKey: "category", children: data.map(function (entry, index) { return (_jsx(Cell, { fill: COLORS[index % COLORS.length] }, "cell-".concat(index))); }) }), _jsx(Tooltip, { formatter: function (value) { return [value, 'Issues']; }, contentStyle: {
                        backgroundColor: 'white',
                        border: '1px solid #e5e7eb',
                        borderRadius: '8px',
                        boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
                    } }), _jsx(Legend, { verticalAlign: "bottom", height: 36, iconType: "circle", wrapperStyle: { paddingTop: '20px' } })] }) }));
}
