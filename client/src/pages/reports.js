import { jsxs as _jsxs, jsx as _jsx } from "react/jsx-runtime";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { FileText, Download, FileSpreadsheet, FileImage } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
// Mock monthly data
var monthlyData = [
    {
        month: "November 2024",
        totalSpend: 2847.32,
        activeSubscriptions: 24,
        newSubscriptions: 2,
        cancelled: 0,
        growth: 8.3,
    },
    {
        month: "October 2024",
        totalSpend: 2631.18,
        activeSubscriptions: 22,
        newSubscriptions: 1,
        cancelled: 1,
        growth: -2.1,
    },
    {
        month: "September 2024",
        totalSpend: 2687.45,
        activeSubscriptions: 22,
        newSubscriptions: 0,
        cancelled: 0,
        growth: 0,
    },
    {
        month: "August 2024",
        totalSpend: 2687.45,
        activeSubscriptions: 22,
        newSubscriptions: 3,
        cancelled: 1,
        growth: 12.5,
    },
    {
        month: "July 2024",
        totalSpend: 2389.73,
        activeSubscriptions: 20,
        newSubscriptions: 1,
        cancelled: 0,
        growth: 5.2,
    },
    {
        month: "June 2024",
        totalSpend: 2271.15,
        activeSubscriptions: 19,
        newSubscriptions: 2,
        cancelled: 1,
        growth: 3.8,
    },
];
export default function Reports() {
    var toast = useToast().toast;
    var handleExport = function (format) {
        toast({
            title: "Export Started",
            description: "Generating ".concat(format.toUpperCase(), " report. You'll receive a download link shortly."),
        });
        // Simulate export functionality
        setTimeout(function () {
            toast({
                title: "Export Complete",
                description: "".concat(format.toUpperCase(), " report has been generated successfully."),
            });
        }, 2000);
    };
    var getGrowthBadge = function (growth) {
        if (growth > 0) {
            return (_jsxs(Badge, { className: "bg-green-100 text-green-800", children: ["+", growth, "%"] }));
        }
        else if (growth < 0) {
            return (_jsxs(Badge, { className: "bg-red-100 text-red-800", children: [growth, "%"] }));
        }
        else {
            return (_jsx(Badge, { className: "bg-gray-100 text-gray-800", children: "0%" }));
        }
    };
    return (_jsxs("div", { className: "p-8", children: [_jsxs("div", { className: "mb-8", children: [_jsx("h2", { className: "text-3xl font-bold text-gray-900", children: "Reports" }), _jsx("p", { className: "text-gray-600 mt-2", children: "Generate and export subscription reports" })] }), _jsxs(Card, { className: "mb-8", children: [_jsx(CardHeader, { children: _jsx(CardTitle, { children: "Export Options" }) }), _jsx(CardContent, { children: _jsxs("div", { className: "flex flex-wrap gap-4", children: [_jsxs(Button, { variant: "outline", onClick: function () { return handleExport('pdf'); }, className: "flex items-center", children: [_jsx(FileText, { className: "text-red-500 mr-2", size: 16 }), "Export as PDF"] }), _jsxs(Button, { variant: "outline", onClick: function () { return handleExport('excel'); }, className: "flex items-center", children: [_jsx(FileSpreadsheet, { className: "text-green-500 mr-2", size: 16 }), "Export as Excel"] }), _jsxs(Button, { variant: "outline", onClick: function () { return handleExport('csv'); }, className: "flex items-center", children: [_jsx(FileImage, { className: "text-blue-500 mr-2", size: 16 }), "Export as CSV"] })] }) })] }), _jsxs(Card, { children: [_jsx(CardHeader, { children: _jsxs("div", { className: "flex justify-between items-center", children: [_jsx(CardTitle, { children: "Monthly Summary" }), _jsxs(Button, { onClick: function () { return handleExport('full-report'); }, children: [_jsx(Download, { className: "mr-2", size: 16 }), "Download Report"] })] }) }), _jsx(CardContent, { className: "p-0", children: _jsx("div", { className: "overflow-x-auto", children: _jsxs(Table, { children: [_jsx(TableHeader, { children: _jsxs(TableRow, { className: "bg-gray-50", children: [_jsx(TableHead, { children: "Month" }), _jsx(TableHead, { children: "Total Spend" }), _jsx(TableHead, { children: "Active Subscriptions" }), _jsx(TableHead, { children: "New Subscriptions" }), _jsx(TableHead, { children: "Cancelled" }), _jsx(TableHead, { children: "Growth" })] }) }), _jsx(TableBody, { children: monthlyData.map(function (month, index) { return (_jsxs(TableRow, { className: "hover:bg-gray-50", children: [_jsx(TableCell, { className: "font-medium text-gray-900", children: month.month }), _jsxs(TableCell, { className: "text-gray-900", children: ["$", month.totalSpend.toLocaleString(undefined, { minimumFractionDigits: 2 })] }), _jsx(TableCell, { className: "text-gray-900", children: month.activeSubscriptions }), _jsx(TableCell, { className: "text-gray-900", children: month.newSubscriptions }), _jsx(TableCell, { className: "text-gray-900", children: month.cancelled }), _jsx(TableCell, { children: getGrowthBadge(month.growth) })] }, index)); }) })] }) }) })] })] }));
}
