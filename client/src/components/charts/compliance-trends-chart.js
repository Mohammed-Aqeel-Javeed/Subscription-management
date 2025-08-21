import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
export default function ComplianceTrendsChart(_a) {
    var data = _a.data;
    if (!data || data.length === 0) {
        return _jsx("div", { className: "h-full flex items-center justify-center text-gray-500", children: "No trend data available" });
    }
    return (_jsx(ResponsiveContainer, { width: "100%", height: 320, children: _jsxs(LineChart, { data: data, children: [_jsx(CartesianGrid, { strokeDasharray: "3 3", className: "opacity-30" }), _jsx(XAxis, { dataKey: "date", axisLine: false, tickLine: false, className: "text-sm text-gray-600" }), _jsx(YAxis, { axisLine: false, tickLine: false, className: "text-sm text-gray-600", tickFormatter: function (value) { return value.toLocaleString(); } }), _jsx(Tooltip, { formatter: function (value, name) { return [value.toLocaleString(), name === 'submitted' ? 'Submitted' : 'Total']; }, labelClassName: "text-gray-900", contentStyle: {
                        backgroundColor: 'white',
                        border: '1px solid #e5e7eb',
                        borderRadius: '8px',
                        boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
                    } }), _jsx(Line, { type: "monotone", dataKey: "submitted", stroke: "hsl(221, 83%, 53%)", strokeWidth: 3, dot: { fill: 'hsl(221, 83%, 53%)', strokeWidth: 2, r: 4 }, activeDot: { r: 6 }, name: "Submitted" })] }) }));
}
