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
import { useState } from "react";
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
var CalendarMonthly = function () {
    var navigate = useNavigate();
    // Fetch compliance data
    var _a = useQuery({
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
    }), complianceList = _a.data, complianceLoading = _a.isLoading;
    // Build events for current and next month from complianceList
    var getMonthEvents = function (year, month) {
        if (!complianceList)
            return {};
        var events = {};
        complianceList.forEach(function (c) {
            if (!c.submissionDeadline)
                return;
            var deadline = new Date(c.submissionDeadline);
            if (deadline.getFullYear() === year && deadline.getMonth() + 1 === month) {
                var day = deadline.getDate();
                if (!events[day])
                    events[day] = [];
                // Show by filing name (e.g., 'gst', 'cpf')
                events[day].push(c.filingName || c.policy || "Compliance Task");
            }
        });
        return events;
    };
    // State for current month/year
    var _b = useState(new Date(2025, 7, 1)), date = _b[0], setDate = _b[1]; // August is month 7 (0-indexed)
    var currentYear = date.getFullYear();
    var currentMonth = date.getMonth() + 1;
    // Helper to get month name
    var monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
    // Helper to get days in month
    function getDaysInMonth(year, month) {
        return new Date(year, month, 0).getDate();
    }
    // Helper to render a month grid
    function renderMonthGrid(year, month, events) {
        var days = getDaysInMonth(year, month);
        var firstDay = new Date("".concat(year, "-").concat(String(month).padStart(2, "0"), "-01")).getDay();
        var weeks = [];
        var day = 1;
        for (var w = 0; w < 6; w++) {
            var week = [];
            for (var d = 0; d < 7; d++) {
                if ((w === 0 && d < firstDay) || day > days) {
                    week.push(_jsx("td", { className: "h-16 w-16" }, d));
                }
                else {
                    var eventList = events[day] || [];
                    week.push(_jsxs("td", { className: "h-16 w-16 align-top relative ".concat(eventList.length ? "bg-red-100" : ""), children: [_jsx("div", { className: "font-semibold text-center", children: day }), eventList.map(function (ev, idx) { return (_jsx("div", { className: "bg-red-600 text-white text-xs rounded px-1 py-0.5 mt-1 truncate", children: ev }, idx)); })] }, d));
                    day++;
                }
            }
            weeks.push(week);
        }
        return (_jsxs("table", { className: "w-full border-separate border-spacing-1", children: [_jsx("thead", { children: _jsxs("tr", { className: "text-xs text-gray-500", children: [_jsx("th", { children: "Sun" }), _jsx("th", { children: "Mon" }), _jsx("th", { children: "Tue" }), _jsx("th", { children: "Wed" }), _jsx("th", { children: "Thu" }), _jsx("th", { children: "Fri" }), _jsx("th", { children: "Sat" })] }) }), _jsx("tbody", { children: weeks.map(function (week, i) { return _jsx("tr", { children: week }, i); }) })] }));
    }
    // Handlers for previous/next
    function handlePrevious() {
        var newMonth = currentMonth - 1;
        var newYear = currentYear;
        if (newMonth < 1) {
            newMonth = 12;
            newYear--;
        }
        setDate(new Date(newYear, newMonth - 1, 1));
    }
    function handleNext() {
        var newMonth = currentMonth + 1;
        var newYear = currentYear;
        if (newMonth > 12) {
            newMonth = 1;
            newYear++;
        }
        setDate(new Date(newYear, newMonth - 1, 1));
    }
    // Next month calculation
    var nextMonth = currentMonth + 1;
    var nextYear = currentYear;
    if (nextMonth > 12) {
        nextMonth = 1;
        nextYear++;
    }
    if (complianceLoading) {
        return (_jsxs("div", { className: "p-8", children: [_jsxs("div", { className: "mb-8", children: [_jsx("div", { className: "h-8 w-48 mb-2 bg-gray-200 animate-pulse rounded" }), _jsx("div", { className: "h-4 w-96 bg-gray-200 animate-pulse rounded" })] }), _jsxs("div", { className: "grid grid-cols-2 gap-8", children: [_jsx("div", { className: "h-96 bg-gray-100 animate-pulse rounded" }), _jsx("div", { className: "h-96 bg-gray-100 animate-pulse rounded" })] })] }));
    }
    return (_jsxs("div", { className: "p-8", children: [_jsxs("div", { className: "flex items-center gap-4 mb-4", children: [_jsx(Button, { variant: "outline", onClick: function () { return navigate("/compliance-dashboard"); }, children: "Back to Dashboard" }), _jsx("h1", { className: "text-3xl font-bold", children: "Monthly Calendar View" }), _jsxs("div", { className: "ml-auto flex gap-2 items-center", children: [_jsx(Button, { variant: "outline", onClick: handlePrevious, children: "< Previous" }), _jsx(Button, { variant: "outline", onClick: handleNext, children: "Next >" }), _jsx("label", { className: "font-medium ml-4 mr-2", children: "Year:" }), _jsx(DatePicker, { selected: date, onChange: function (d) { return d && setDate(new Date(d.getFullYear(), currentMonth - 1, 1)); }, showYearPicker: true, dateFormat: "yyyy", className: "border rounded px-2 py-1" })] })] }), _jsxs("div", { className: "grid grid-cols-2 gap-8", children: [_jsxs("div", { className: "bg-white rounded-lg shadow p-6", children: [_jsxs("h2", { className: "text-xl font-semibold mb-4", children: ["Current Month - ", monthNames[currentMonth - 1], " ", currentYear] }), renderMonthGrid(currentYear, currentMonth, getMonthEvents(currentYear, currentMonth))] }), _jsxs("div", { className: "bg-white rounded-lg shadow p-6", children: [_jsxs("h2", { className: "text-xl font-semibold mb-4", children: ["Next Month - ", monthNames[nextMonth - 1], " ", nextYear] }), renderMonthGrid(nextYear, nextMonth, getMonthEvents(nextYear, nextMonth))] })] })] }));
};
export default CalendarMonthly;
