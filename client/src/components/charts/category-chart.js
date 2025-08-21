import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts';
export default function CategoryChart(_a) {
    var data = _a.data;
    return (_jsx(ResponsiveContainer, { width: "100%", height: 320, children: _jsxs(PieChart, { children: [_jsx(Pie, { data: data, cx: "50%", cy: "50%", innerRadius: 60, outerRadius: 120, paddingAngle: 5, dataKey: "amount", nameKey: "category", children: data.map(function (entry, index) { return (_jsx(Cell, { fill: entry.color }, "cell-".concat(index))); }) }), _jsx(Tooltip, { formatter: function (value) { return ["$".concat(value.toLocaleString()), 'Amount']; }, contentStyle: {
                        backgroundColor: 'white',
                        border: '1px solid #e5e7eb',
                        borderRadius: '8px',
                        boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
                    } }), _jsx(Legend, { verticalAlign: "bottom", height: 36, iconType: "circle", wrapperStyle: { paddingTop: '20px' } })] }) }));
}
