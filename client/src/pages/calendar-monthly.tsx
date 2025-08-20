import React, { useState, useMemo } from "react";
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";

const CalendarMonthly: React.FC = () => {
  const navigate = useNavigate();
  // Fetch compliance data
  const { data: complianceList, isLoading: complianceLoading } = useQuery({
    queryKey: ["/api/compliance/list"],
    queryFn: async () => {
      const res = await fetch("/api/compliance/list", { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch compliance data");
      return res.json();
    },
    refetchOnWindowFocus: true,
    staleTime: 10000,
  });

  // Build events for current and next month from complianceList
  const getMonthEvents = (year: number, month: number) => {
    if (!complianceList) return {};
    const events: Record<number, string[]> = {};
    complianceList.forEach((c: any) => {
      if (!c.submissionDeadline) return;
      const deadline = new Date(c.submissionDeadline);
      if (deadline.getFullYear() === year && deadline.getMonth() + 1 === month) {
        const day = deadline.getDate();
        if (!events[day]) events[day] = [];
        // Show by filing name (e.g., 'gst', 'cpf')
        events[day].push(c.filingName || c.policy || "Compliance Task");
      }
    });
    return events;
  };
  // State for current month/year
  const [date, setDate] = useState(new Date(2025, 7, 1)); // August is month 7 (0-indexed)
  const currentYear = date.getFullYear();
  const currentMonth = date.getMonth() + 1;

  // Helper to get month name
  const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

  // Helper to get days in month
  function getDaysInMonth(year: number, month: number) {
    return new Date(year, month, 0).getDate();
  }

  // Helper to render a month grid
  function renderMonthGrid(year: number, month: number, events: Record<number, string[]>) {
    const days = getDaysInMonth(year, month);
    const firstDay = new Date(`${year}-${String(month).padStart(2, "0")}-01`).getDay();
    const weeks: JSX.Element[][] = [];
    let day = 1;
    for (let w = 0; w < 6; w++) {
      const week: JSX.Element[] = [];
      for (let d = 0; d < 7; d++) {
        if ((w === 0 && d < firstDay) || day > days) {
          week.push(<td key={d} className="h-16 w-16"></td>);
        } else {
          const eventList = events[day] || [];
          week.push(
            <td key={d} className={`h-16 w-16 align-top relative ${eventList.length ? "bg-red-100" : ""}`}> 
              <div className="font-semibold text-center">{day}</div>
              {eventList.map((ev, idx) => (
                <div key={idx} className="bg-red-600 text-white text-xs rounded px-1 py-0.5 mt-1 truncate">{ev}</div>
              ))}
            </td>
          );
          day++;
        }
      }
      weeks.push(week);
    }
    return (
      <table className="w-full border-separate border-spacing-1">
        <thead>
          <tr className="text-xs text-gray-500">
            <th>Sun</th><th>Mon</th><th>Tue</th><th>Wed</th><th>Thu</th><th>Fri</th><th>Sat</th>
          </tr>
        </thead>
        <tbody>
          {weeks.map((week, i) => <tr key={i}>{week}</tr>)}
        </tbody>
      </table>
    );
  }

  // Handlers for previous/next
  function handlePrevious() {
    let newMonth = currentMonth - 1;
    let newYear = currentYear;
    if (newMonth < 1) {
      newMonth = 12;
      newYear--;
    }
    setDate(new Date(newYear, newMonth - 1, 1));
  }
  function handleNext() {
    let newMonth = currentMonth + 1;
    let newYear = currentYear;
    if (newMonth > 12) {
      newMonth = 1;
      newYear++;
    }
    setDate(new Date(newYear, newMonth - 1, 1));
  }

  // Next month calculation
  let nextMonth = currentMonth + 1;
  let nextYear = currentYear;
  if (nextMonth > 12) {
    nextMonth = 1;
    nextYear++;
  }

  if (complianceLoading) {
    return (
      <div className="p-8">
        <div className="mb-8">
          <div className="h-8 w-48 mb-2 bg-gray-200 animate-pulse rounded" />
          <div className="h-4 w-96 bg-gray-200 animate-pulse rounded" />
        </div>
        <div className="grid grid-cols-2 gap-8">
          <div className="h-96 bg-gray-100 animate-pulse rounded" />
          <div className="h-96 bg-gray-100 animate-pulse rounded" />
        </div>
      </div>
    );
  }

  return (
    <div className="p-8">
      <div className="flex items-center gap-4 mb-4">
        <Button variant="outline" onClick={() => navigate("/compliance-dashboard")}>Back to Dashboard</Button>
        <h1 className="text-3xl font-bold">Monthly Calendar View</h1>
        <div className="ml-auto flex gap-2 items-center">
          <Button variant="outline" onClick={handlePrevious}>&lt; Previous</Button>
          <Button variant="outline" onClick={handleNext}>Next &gt;</Button>
          <label className="font-medium ml-4 mr-2">Year:</label>
          <DatePicker
            selected={date}
            onChange={d => d && setDate(new Date(d.getFullYear(), currentMonth - 1, 1))}
            showYearPicker
            dateFormat="yyyy"
            className="border rounded px-2 py-1"
          />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-8">
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-semibold mb-4">Current Month - {monthNames[currentMonth - 1]} {currentYear}</h2>
          {renderMonthGrid(currentYear, currentMonth, getMonthEvents(currentYear, currentMonth))}
        </div>
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-semibold mb-4">Next Month - {monthNames[nextMonth - 1]} {nextYear}</h2>
          {renderMonthGrid(nextYear, nextMonth, getMonthEvents(nextYear, nextMonth))}
        </div>
      </div>
    </div>
  );
}

export default CalendarMonthly;
