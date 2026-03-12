import * as React from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

type ReportItem = {
  id: string;
  label: string;
};

function ReportRow({
  item,
  onOpen,
}: {
  item: ReportItem;
  onOpen: (id: string) => void;
}) {
  return (
    <div className="flex items-center gap-3 px-4 py-3 min-w-0">
      <button
        type="button"
        onClick={() => onOpen(item.id)}
        className="flex-1 min-w-0 h-9 flex items-center text-left text-sm font-medium text-indigo-700 hover:text-indigo-900 underline underline-offset-2 truncate whitespace-nowrap"
      >
        {item.label}
      </button>
    </div>
  );
}

type ReportCategory = "all" | "subscription" | "compliance" | "renewal";

export default function Reports() {
  const navigate = useNavigate();
  const [activeCategory, setActiveCategory] = React.useState<ReportCategory>("all");

  const subscriptionReports: ReportItem[] = Array.from({ length: 5 }).map((_, idx) => ({
    id: `sub-${idx}`,
    label:
      idx === 0
        ? "Upcoming Renewal"
        : idx === 1
          ? "Spending Analysis"
          : idx === 2
            ? "Card Wise"
          : `Report ${idx + 1}`,
  }));

  const complianceReports: ReportItem[] = Array.from({ length: 5 }).map((_, idx) => ({
    id: `comp-${idx}`,
    label:
      idx === 0
        ? "Upcoming Filing"
        : idx === 1
          ? "Compliance Spend & Audit History"
          : idx === 2
            ? "Departmental Compliance Scorecard"
          : `Report ${idx + 1}`,
  }));

  const renewalReports: ReportItem[] = [
    { id: "ren-0", label: "Department-wise Renewals Report" },
    { id: "ren-1", label: "Renewal Lead Time Analysis" },
    { id: "ren-2", label: "Renewal Responsibility Report" },
    { id: "ren-3", label: "Expired Renewals Report" },
    { id: "ren-4", label: "Upcoming Renewals Report" },
  ];

  const openReport = (id: string) => {
    if (id === "sub-0") {
      navigate("/reports/upcoming-renewal");
      return;
    }

    if (id === "sub-1") {
      navigate("/reports/spending-analysis");
      return;
    }

    if (id === "sub-2") {
      navigate("/reports/card-wise");
      return;
    }

    if (id === "comp-0") {
      navigate("/reports/upcoming-filings");
      return;
    }

    if (id === "comp-1") {
      navigate("/reports/compliance-spend");
      return;
    }

    if (id === "comp-2") {
      navigate("/reports/departmental-scorecard");
      return;
    }

    if (id === "ren-0") {
      navigate("/reports/department-wise-renewals");
      return;
    }

    if (id === "ren-1") {
      navigate("/reports/renewal-lead-time-analysis");
      return;
    }

    if (id === "ren-2") {
      navigate("/reports/renewal-responsibility");
      return;
    }

    if (id === "ren-3") {
      navigate("/reports/expired-renewals");
      return;
    }

    if (id === "ren-4") {
      navigate("/reports/upcoming-renewals");
      return;
    }

    // Keep other reports clickable for now.
    console.log("Open report", id);
  };

  const splitForTwoColumns = (items: ReportItem[]) => {
    const leftCount = Math.ceil(items.length / 2);
    return { left: items.slice(0, leftCount), right: items.slice(leftCount) };
  };

  const sub = splitForTwoColumns(subscriptionReports);
  const comp = splitForTwoColumns(complianceReports);
  const ren = splitForTwoColumns(renewalReports);

  const shouldShowCategory = (category: ReportCategory) => {
    return activeCategory === "all" || activeCategory === category;
  };

  return (
    <div className="p-8">
      <div className="mb-8 flex items-center justify-between gap-4">
        <h2 className="text-3xl font-bold text-gray-900">Reports</h2>
      </div>

      <div className="mb-6 flex gap-3 flex-wrap">
        <Button
          onClick={() => setActiveCategory("all")}
          variant={activeCategory === "all" ? "default" : "outline"}
          className={activeCategory === "all" ? "bg-gradient-to-br from-indigo-500 to-blue-600 text-white hover:text-white" : ""}
        >
          All
        </Button>
        <Button
          onClick={() => setActiveCategory("subscription")}
          variant={activeCategory === "subscription" ? "default" : "outline"}
          className={activeCategory === "subscription" ? "bg-gradient-to-br from-indigo-500 to-blue-600 text-white hover:text-white" : ""}
        >
          Subscription Reports
        </Button>
        <Button
          onClick={() => setActiveCategory("compliance")}
          variant={activeCategory === "compliance" ? "default" : "outline"}
          className={activeCategory === "compliance" ? "bg-gradient-to-br from-indigo-500 to-blue-600 text-white hover:text-white" : ""}
        >
          Compliance Reports
        </Button>
        <Button
          onClick={() => setActiveCategory("renewal")}
          variant={activeCategory === "renewal" ? "default" : "outline"}
          className={activeCategory === "renewal" ? "bg-gradient-to-br from-indigo-500 to-blue-600 text-white hover:text-white" : ""}
        >
          Renewal Reports
        </Button>
      </div>

      {/* All Reports */}
      <Card className="mb-8">
        <CardContent className="pt-6">
          <div className="space-y-10">
            {shouldShowCategory("subscription") && (
            <div>
              <h3 className="text-base font-semibold text-gray-900">Subscription Reports</h3>
              <div className="mt-4 grid grid-cols-1 gap-6 lg:grid-cols-2">
                <Card>
                  <CardContent className="p-0">
                    <div className="divide-y">
                      {sub.left.map((item) => (
                        <div key={item.id} className="hover:bg-accent/40">
                          <ReportRow
                            item={item}
                            onOpen={openReport}
                          />
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-0">
                    <div className="divide-y">
                      {sub.right.map((item) => (
                        <div key={item.id} className="hover:bg-accent/40">
                          <ReportRow
                            item={item}
                            onOpen={openReport}
                          />
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>
            )}

            {shouldShowCategory("compliance") && (
            <div>
              <h3 className="text-base font-semibold text-gray-900">Compliance Reports</h3>
              <div className="mt-4 grid grid-cols-1 gap-6 lg:grid-cols-2">
                <Card>
                  <CardContent className="p-0">
                    <div className="divide-y">
                      {comp.left.map((item) => (
                        <div key={item.id} className="hover:bg-accent/40">
                          <ReportRow
                            item={item}
                            onOpen={openReport}
                          />
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-0">
                    <div className="divide-y">
                      {comp.right.map((item) => (
                        <div key={item.id} className="hover:bg-accent/40">
                          <ReportRow
                            item={item}
                            onOpen={openReport}
                          />
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>
            )}

            {shouldShowCategory("renewal") && (
            <div>
              <h3 className="text-base font-semibold text-gray-900">Renewal Reports</h3>
              <div className="mt-4 grid grid-cols-1 gap-6 lg:grid-cols-2">
                <Card>
                  <CardContent className="p-0">
                    <div className="divide-y">
                      {ren.left.map((item) => (
                        <div key={item.id} className="hover:bg-accent/40">
                          <ReportRow
                            item={item}
                            onOpen={openReport}
                          />
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-0">
                    <div className="divide-y">
                      {ren.right.map((item) => (
                        <div key={item.id} className="hover:bg-accent/40">
                          <ReportRow
                            item={item}
                            onOpen={openReport}
                          />
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
