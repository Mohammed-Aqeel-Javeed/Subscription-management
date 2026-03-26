import React, { useMemo } from "react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

type CategoryDatum = {
  category: string;
  count: number;
};

type Props = {
  data: CategoryDatum[];
};

export default function ComplianceCategoryChart({ data }: Props) {
  const normalized = useMemo(() => {
    const rows = (data || [])
      .filter((d) => d && typeof d.category === "string" && d.category.trim().length > 0)
      .map((d) => ({ category: d.category.trim(), count: Number(d.count || 0) }));

    return [...rows].sort((a, b) => b.count - a.count).slice(0, 10);
  }, [data]);

  if (!normalized.length) {
    return <div className="h-[220px] flex items-center justify-center text-sm text-gray-500">No category data</div>;
  }

  return (
    <div className="h-[220px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={normalized} layout="vertical" margin={{ top: 8, right: 16, bottom: 8, left: 16 }}>
          <CartesianGrid strokeDasharray="3 3" vertical horizontal={false} />
          <XAxis type="number" tick={{ fontSize: 12, fill: "#6b7280" }} axisLine={false} tickLine={false} />
          <YAxis
            type="category"
            dataKey="category"
            width={100}
            tick={{ fontSize: 16, fill: "#6b7280", fontWeight: 500 }}
            axisLine={false}
            tickLine={false}
          />
          <Tooltip
            formatter={(value: number) => [`${Number(value).toLocaleString()} filings`, "Filings"]}
            cursor={{ fill: "transparent" }}
            contentStyle={{
              backgroundColor: "var(--card)",
              border: "1px solid var(--border)",
              borderRadius: "8px",
              padding: "12px",
            }}
            labelStyle={{ color: "var(--foreground)", fontWeight: 600, marginBottom: 6 }}
          />
          <Bar
            dataKey="count"
            fill="var(--chart-2)"
            radius={[0, 8, 8, 0]}
            barSize={22}
            barGap={14}
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
