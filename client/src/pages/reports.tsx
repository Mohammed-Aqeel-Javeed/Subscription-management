import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export default function Reports() {
  return (
    <div className="p-8">
      <div className="mb-8">
        <h2 className="text-3xl font-bold text-gray-900">Reports</h2>
      </div>

      {/* All Reports */}
      <Card className="mb-8">
        <CardHeader>
          <div className="flex items-center justify-between gap-4">
            <Button
              className="w-full sm:w-auto bg-gradient-to-br from-indigo-500 to-blue-600 text-white hover:text-white focus:text-white active:text-white shadow-lg hover:shadow-xl border border-white/20 backdrop-blur-md transition-all"
            >
              All Reports
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-6">
            <div>
              <h3 className="text-sm font-semibold text-gray-900">Subscription Reports</h3>
              <div className="mt-3 flex flex-wrap gap-3">
                {Array.from({ length: 5 }).map((_, idx) => (
                  <Button key={`sub-${idx}`} variant="outline">
                    Report {idx + 1}
                  </Button>
                ))}
              </div>
            </div>

            <div>
              <h3 className="text-sm font-semibold text-gray-900">Compliance Reports</h3>
              <div className="mt-3 flex flex-wrap gap-3">
                {Array.from({ length: 5 }).map((_, idx) => (
                  <Button key={`comp-${idx}`} variant="outline">
                    Report {idx + 1}
                  </Button>
                ))}
              </div>
            </div>

            <div>
              <h3 className="text-sm font-semibold text-gray-900">Renewal Reports</h3>
              <div className="mt-3 flex flex-wrap gap-3">
                {Array.from({ length: 5 }).map((_, idx) => (
                  <Button key={`ren-${idx}`} variant="outline">
                    Report {idx + 1}
                  </Button>
                ))}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
