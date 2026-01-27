import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { Card } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../components/ui/table";
import { History, ArrowLeft } from "lucide-react";
import { API_BASE_URL } from "@/lib/config";
import { Badge } from "../components/ui/badge";

export default function RenewalLog() {
  const navigate = useNavigate();

  // Fetch logs
  const { data: logs = [], isLoading } = useQuery({
    queryKey: ["/api/logs"],
    queryFn: async () => {
      const res = await fetch(`${API_BASE_URL}/api/logs`, {
        credentials: "include",
      });
      if (!res.ok) return [];
      return res.json();
    },
  });

  const getActionBadgeColor = (action: string) => {
    switch (action?.toLowerCase()) {
      case 'create':
      case 'created':
        return 'bg-blue-100 text-blue-700 border-blue-200';
      case 'update':
      case 'updated':
        return 'bg-amber-100 text-amber-700 border-amber-200';
      case 'delete':
      case 'deleted':
        return 'bg-red-100 text-red-700 border-red-200';
      default:
        return 'bg-slate-100 text-slate-700 border-slate-200';
    }
  };

  const formatTimestamp = (timestamp: string) => {
    if (!timestamp) return { date: 'N/A', time: '' };
    const date = new Date(timestamp);
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    return {
      date: `${day}/${month}/${year}`,
      time: `${hours}:${minutes}`
    };
  };

  return (
    <div className="flex flex-col h-full bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 font-['Inter']">
      <div className="flex-1 overflow-hidden flex flex-col p-6">
        {/* Header */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center space-x-4">
              <div className="h-12 w-12 bg-gradient-to-br from-orange-500 to-amber-600 rounded-lg flex items-center justify-center shadow-lg">
                <History className="h-6 w-6 text-white" />
              </div>
              <div>
                <h1 className="text-2xl font-semibold text-gray-900 tracking-tight">Renewal History Log</h1>
              </div>
            </div>
            
            <Button
              onClick={() => navigate('/government-license')}
              variant="outline"
              className="flex items-center gap-2"
            >
              <ArrowLeft className="h-4 w-4" />
              Back to Renewals
            </Button>
          </div>
        </div>

        {/* Log Table */}
        <Card className="flex-1 overflow-hidden flex flex-col border-slate-200 shadow-lg bg-white">
          <div className="flex-1 overflow-auto relative">
            {isLoading ? (
              <div className="flex items-center justify-center h-full">
                <div className="text-center">
                  <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
                  <p className="text-slate-600">Loading logs...</p>
                </div>
              </div>
            ) : logs && logs.length > 0 ? (
              <div className="h-full overflow-auto">
                <table className="w-full border-collapse">
                  <thead className="sticky top-0 z-10 bg-slate-50">
                    <tr className="border-b border-slate-200">
                      <th className="font-semibold text-slate-700 bg-slate-50 text-left px-4 py-3 w-[200px]">Renewal Name</th>
                      <th className="font-semibold text-slate-700 bg-slate-50 text-left px-4 py-3 w-[180px]">Changed By</th>
                      <th className="font-semibold text-slate-700 bg-slate-50 text-left px-4 py-3 w-[400px]">Changes</th>
                      <th className="font-semibold text-slate-700 bg-slate-50 text-left px-4 py-3 w-[100px]">Action</th>
                      <th className="font-semibold text-slate-700 bg-slate-50 text-left px-4 py-3 w-[140px]">Timestamp</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white">
                  {logs.map((log: any, index: number) => {
                    const timestamp = formatTimestamp(log.timestamp);
                    // Filter out lines that contain "Not Set →" EXCEPT for important reasons
                    let changesText = log.changes || 'No changes recorded';
                    if (changesText.includes('\n')) {
                      const lines = changesText.split('\n').filter((line: string) => {
                        // Keep lines that don't have "Not Set →"
                        if (!line.includes('Not Set →')) return true;
                        // Keep important reason lines even if they have "Not Set →"
                        if (line.includes('Cancellation Reason:') || 
                            line.includes('Rejection Reason:') || 
                            line.includes('Amendment/Appeal Reason:')) {
                          return true;
                        }
                        // Filter out other "Not Set →" lines
                        return false;
                      });
                      changesText = lines.length > 0 ? lines.join('\n') : changesText;
                    }
                    return (
                      <tr key={index} className="hover:bg-slate-50 border-b border-slate-100">
                        <td className="font-medium text-sm text-slate-900 align-top py-3 px-4">
                          {log.licenseName || 'N/A'}
                        </td>
                        <td className="text-sm text-slate-700 align-top py-3 px-4">
                          {log.user || 'System'}
                        </td>
                        <td className="text-sm text-slate-600 align-top py-3 px-4">
                          <div className="whitespace-pre-line leading-relaxed">
                            {changesText}
                          </div>
                        </td>
                        <td className="align-top py-3 px-4">
                          <Badge className={`${getActionBadgeColor(log.action)} px-2 py-1 text-xs font-medium border capitalize`}>
                            {log.action}
                          </Badge>
                        </td>
                        <td className="text-sm text-slate-500 align-top py-3 px-4">
                          <div className="flex flex-col">
                            <span className="font-medium">{timestamp.date}</span>
                            {timestamp.time && <span className="text-xs text-slate-400">{timestamp.time}</span>}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              </div>
            ) : (
              <div className="flex items-center justify-center h-full p-12">
                <div className="flex flex-col items-center gap-3 text-center">
                  <div className="h-16 w-16 bg-slate-100 rounded-full flex items-center justify-center">
                    <History className="h-8 w-8 text-slate-400" />
                  </div>
                  <div>
                    <p className="text-slate-600 font-medium">No history records found</p>
                    <p className="text-sm text-slate-500 mt-1">Logs will appear here when renewals are created, updated, or deleted</p>
                  </div>
                </div>
              </div>
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}
