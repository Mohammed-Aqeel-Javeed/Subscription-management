import React, { useState, useMemo } from "react";
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";

const CalendarYearly: React.FC = () => {
  const navigate = useNavigate();
  const [date, setDate] = useState(new Date(2025, 0, 1));
  const year = date.getFullYear();
  type MonthName =
    | "January" | "February" | "March" | "April"
    | "May" | "June" | "July" | "August"
    | "September" | "October" | "November" | "December";
  const monthNames: MonthName[] = [
    "January", "February", "March", "April", "May", "June", "July", "August",
    "September", "October", "November", "December"
  ];

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

  // Build month events for selected year
  const complianceMonths: Record<MonthName, string[]> = useMemo(() => {
    const months: Record<MonthName, string[]> = {
      January: [], February: [], March: [], April: [], May: [], June: [],
      July: [], August: [], September: [], October: [], November: [], December: []
    };
    if (!complianceList) return months;
    complianceList.forEach((c: any) => {
      if (!c.submissionDeadline) return;
      const deadline = new Date(c.submissionDeadline);
      if (deadline.getFullYear() === year) {
        const monthIdx = deadline.getMonth();
        const day = deadline.getDate();
        const label = `${day} ${monthNames[monthIdx].slice(0,3)} - ${c.filingName || c.policy || "Compliance Task"}`;
        months[monthNames[monthIdx]].push(label);
      }
    });
    return months;
  }, [complianceList, year]);

  const complianceMonthNames = monthNames.filter(m => complianceMonths[m].length > 0);
  function handlePrevYear() {
    setDate(prev => new Date(prev.getFullYear() - 1, 0, 1));
  }
  function handleNextYear() {
    setDate(prev => new Date(prev.getFullYear() + 1, 0, 1));
  }
  if (complianceLoading) {
    return (
      <div className="p-8">
        <div className="mb-8">
          <div className="h-8 w-48 mb-2 bg-gray-200 animate-pulse rounded" />
          <div className="h-4 w-96 bg-gray-200 animate-pulse rounded" />
        </div>
        <div className="grid grid-cols-4 gap-8 mb-8">
          {monthNames.map(month => (
            <div key={month} className="h-24 bg-gray-100 animate-pulse rounded" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-4">
        <Button variant="outline" onClick={() => navigate("/compliance-dashboard")}>Back to Dashboard</Button>
        <div className="flex gap-2 items-center">
          <label className="font-medium mr-2">Year:</label>
          <DatePicker
            selected={date}
            onChange={d => d && setDate(d)}
            showYearPicker
            dateFormat="yyyy"
            className="border rounded px-2 py-1"
          />
        </div>
      </div>
      <h1 className="text-3xl font-bold mb-8">Yearly Calendar View - {year}</h1>
      <div className="grid grid-cols-4 gap-8 mb-8">
        {monthNames.map(month => (
          <div
            key={month}
            className={`rounded-lg shadow p-6 min-h-[120px] flex flex-col justify-start items-start border
              ${complianceMonths[month].length > 0 ? "bg-red-50 border-red-200" : "bg-white border-gray-200"}`}
          >
            <h2 className={`text-xl font-semibold mb-2 ${complianceMonths[month].length > 0 ? "text-red-700" : "text-gray-900"}`}>{month}</h2>
            {complianceMonths[month].map((event, idx) => (
              <div key={idx} className="text-sm text-red-700 mb-1">
                {event}
              </div>
            ))}
          </div>
        ))}
      </div>
      {/* Compliance Overview Legend */}
      <div className="bg-white rounded-lg shadow p-6 mt-8">
        <h3 className="text-lg font-semibold mb-2">Compliance Overview</h3>
        <div className="flex items-center gap-4 mb-2">
          <div className="flex items-center gap-2">
            <span className="inline-block w-4 h-4 bg-red-200 border border-red-400 rounded"></span>
            <span>Months with Compliance Requirements</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="inline-block w-4 h-4 bg-gray-200 border border-gray-400 rounded"></span>
            <span>Regular Months</span>
          </div>
        </div>
        <div className="mt-2 text-sm">
          {complianceMonthNames.length === 0 ? (
            <span>No compliance events for {year}.</span>
          ) : (
            complianceMonthNames.map(month => (
              <div key={month}>
                <strong>{month}:</strong> {complianceMonths[month].join(", ")}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};

export default CalendarYearly;
