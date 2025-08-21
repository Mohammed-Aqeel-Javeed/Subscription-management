var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g = Object.create((typeof Iterator === "function" ? Iterator : Object).prototype);
    return g.next = verb(0), g["throw"] = verb(1), g["return"] = verb(2), typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState, useMemo } from "react";
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
var CalendarYearly = function () {
    var navigate = useNavigate();
    var _a = useState(new Date(2025, 0, 1)), date = _a[0], setDate = _a[1];
    var year = date.getFullYear();
    var monthNames = [
        "January", "February", "March", "April", "May", "June", "July", "August",
        "September", "October", "November", "December"
    ];
    // Fetch compliance data
    var _b = useQuery({
        queryKey: ["/api/compliance/list"],
        queryFn: function () { return __awaiter(void 0, void 0, void 0, function () {
            var res;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, fetch("/api/compliance/list", { credentials: "include" })];
                    case 1:
                        res = _a.sent();
                        if (!res.ok)
                            throw new Error("Failed to fetch compliance data");
                        return [2 /*return*/, res.json()];
                }
            });
        }); },
        refetchOnWindowFocus: true,
        staleTime: 10000,
    }), complianceList = _b.data, complianceLoading = _b.isLoading;
    // Build month events for selected year
    var complianceMonths = useMemo(function () {
        var months = {
            January: [], February: [], March: [], April: [], May: [], June: [],
            July: [], August: [], September: [], October: [], November: [], December: []
        };
        if (!complianceList)
            return months;
        complianceList.forEach(function (c) {
            if (!c.submissionDeadline)
                return;
            var deadline = new Date(c.submissionDeadline);
            if (deadline.getFullYear() === year) {
                var monthIdx = deadline.getMonth();
                var day = deadline.getDate();
                var label = "".concat(day, " ").concat(monthNames[monthIdx].slice(0, 3), " - ").concat(c.filingName || c.policy || "Compliance Task");
                months[monthNames[monthIdx]].push(label);
            }
        });
        return months;
    }, [complianceList, year]);
    var complianceMonthNames = monthNames.filter(function (m) { return complianceMonths[m].length > 0; });
    function handlePrevYear() {
        setDate(function (prev) { return new Date(prev.getFullYear() - 1, 0, 1); });
    }
    function handleNextYear() {
        setDate(function (prev) { return new Date(prev.getFullYear() + 1, 0, 1); });
    }
    if (complianceLoading) {
        return (_jsxs("div", { className: "p-8", children: [_jsxs("div", { className: "mb-8", children: [_jsx("div", { className: "h-8 w-48 mb-2 bg-gray-200 animate-pulse rounded" }), _jsx("div", { className: "h-4 w-96 bg-gray-200 animate-pulse rounded" })] }), _jsx("div", { className: "grid grid-cols-4 gap-8 mb-8", children: monthNames.map(function (month) { return (_jsx("div", { className: "h-24 bg-gray-100 animate-pulse rounded" }, month)); }) })] }));
    }
    return (_jsxs("div", { className: "p-8", children: [_jsxs("div", { className: "flex items-center justify-between mb-4", children: [_jsx(Button, { variant: "outline", onClick: function () { return navigate("/compliance-dashboard"); }, children: "Back to Dashboard" }), _jsxs("div", { className: "flex gap-2 items-center", children: [_jsx("label", { className: "font-medium mr-2", children: "Year:" }), _jsx(DatePicker, { selected: date, onChange: function (d) { return d && setDate(d); }, showYearPicker: true, dateFormat: "yyyy", className: "border rounded px-2 py-1" })] })] }), _jsxs("h1", { className: "text-3xl font-bold mb-8", children: ["Yearly Calendar View - ", year] }), _jsx("div", { className: "grid grid-cols-4 gap-8 mb-8", children: monthNames.map(function (month) { return (_jsxs("div", { className: "rounded-lg shadow p-6 min-h-[120px] flex flex-col justify-start items-start border\n              ".concat(complianceMonths[month].length > 0 ? "bg-red-50 border-red-200" : "bg-white border-gray-200"), children: [_jsx("h2", { className: "text-xl font-semibold mb-2 ".concat(complianceMonths[month].length > 0 ? "text-red-700" : "text-gray-900"), children: month }), complianceMonths[month].map(function (event, idx) { return (_jsx("div", { className: "text-sm text-red-700 mb-1", children: event }, idx)); })] }, month)); }) }), _jsxs("div", { className: "bg-white rounded-lg shadow p-6 mt-8", children: [_jsx("h3", { className: "text-lg font-semibold mb-2", children: "Compliance Overview" }), _jsxs("div", { className: "flex items-center gap-4 mb-2", children: [_jsxs("div", { className: "flex items-center gap-2", children: [_jsx("span", { className: "inline-block w-4 h-4 bg-red-200 border border-red-400 rounded" }), _jsx("span", { children: "Months with Compliance Requirements" })] }), _jsxs("div", { className: "flex items-center gap-2", children: [_jsx("span", { className: "inline-block w-4 h-4 bg-gray-200 border border-gray-400 rounded" }), _jsx("span", { children: "Regular Months" })] })] }), _jsx("div", { className: "mt-2 text-sm", children: complianceMonthNames.length === 0 ? (_jsxs("span", { children: ["No compliance events for ", year, "."] })) : (complianceMonthNames.map(function (month) { return (_jsxs("div", { children: [_jsxs("strong", { children: [month, ":"] }), " ", complianceMonths[month].join(", ")] }, month)); })) })] })] }));
};
export default CalendarYearly;
