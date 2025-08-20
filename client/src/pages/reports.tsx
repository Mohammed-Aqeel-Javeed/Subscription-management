import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { FileText, Download, FileSpreadsheet, FileImage } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

// Mock monthly data
const monthlyData = [
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
  const { toast } = useToast();

  const handleExport = (format: string) => {
    toast({
      title: "Export Started",
      description: `Generating ${format.toUpperCase()} report. You'll receive a download link shortly.`,
    });
    
    // Simulate export functionality
    setTimeout(() => {
      toast({
        title: "Export Complete",
        description: `${format.toUpperCase()} report has been generated successfully.`,
      });
    }, 2000);
  };

  const getGrowthBadge = (growth: number) => {
    if (growth > 0) {
      return (
        <Badge className="bg-green-100 text-green-800">
          +{growth}%
        </Badge>
      );
    } else if (growth < 0) {
      return (
        <Badge className="bg-red-100 text-red-800">
          {growth}%
        </Badge>
      );
    } else {
      return (
        <Badge className="bg-gray-100 text-gray-800">
          0%
        </Badge>
      );
    }
  };

  return (
    <div className="p-8">
      <div className="mb-8">
        <h2 className="text-3xl font-bold text-gray-900">Reports</h2>
        <p className="text-gray-600 mt-2">Generate and export subscription reports</p>
      </div>

      {/* Export Options */}
      <Card className="mb-8">
        <CardHeader>
          <CardTitle>Export Options</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-4">
            <Button
              variant="outline"
              onClick={() => handleExport('pdf')}
              className="flex items-center"
            >
              <FileText className="text-red-500 mr-2" size={16} />
              Export as PDF
            </Button>
            <Button
              variant="outline"
              onClick={() => handleExport('excel')}
              className="flex items-center"
            >
              <FileSpreadsheet className="text-green-500 mr-2" size={16} />
              Export as Excel
            </Button>
            <Button
              variant="outline"
              onClick={() => handleExport('csv')}
              className="flex items-center"
            >
              <FileImage className="text-blue-500 mr-2" size={16} />
              Export as CSV
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Monthly Summary */}
      <Card>
        <CardHeader>
          <div className="flex justify-between items-center">
            <CardTitle>Monthly Summary</CardTitle>
            <Button onClick={() => handleExport('full-report')}>
              <Download className="mr-2" size={16} />
              Download Report
            </Button>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-gray-50">
                  <TableHead>Month</TableHead>
                  <TableHead>Total Spend</TableHead>
                  <TableHead>Active Subscriptions</TableHead>
                  <TableHead>New Subscriptions</TableHead>
                  <TableHead>Cancelled</TableHead>
                  <TableHead>Growth</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {monthlyData.map((month, index) => (
                  <TableRow key={index} className="hover:bg-gray-50">
                    <TableCell className="font-medium text-gray-900">
                      {month.month}
                    </TableCell>
                    <TableCell className="text-gray-900">
                      ${month.totalSpend.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </TableCell>
                    <TableCell className="text-gray-900">
                      {month.activeSubscriptions}
                    </TableCell>
                    <TableCell className="text-gray-900">
                      {month.newSubscriptions}
                    </TableCell>
                    <TableCell className="text-gray-900">
                      {month.cancelled}
                    </TableCell>
                    <TableCell>
                      {getGrowthBadge(month.growth)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
