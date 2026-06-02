import { Rocket } from "lucide-react";
import { useNavigate } from "react-router-dom";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { formatPlanLimitMessage } from "@/lib/plan-limit";

export function PlanLimitModal(props: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  message: string;
}) {
  const { open, onOpenChange, message } = props;
  const navigate = useNavigate();
  const { title, detail } = formatPlanLimitMessage(message);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-white border border-gray-200 shadow-2xl max-w-[720px] p-0 overflow-hidden font-inter">
        <div className="p-8">
          <DialogHeader>
            <div className="flex items-start gap-5">
              <div className="shrink-0 rounded-2xl bg-gradient-to-br from-slate-50 via-white to-indigo-50 border border-gray-200 p-3 shadow-sm">
                <div className="rounded-xl bg-gradient-to-br from-indigo-600 to-blue-600 p-3 shadow-md">
                  <Rocket className="h-7 w-7 text-white" />
                </div>
              </div>
              <div className="min-w-0">
                <DialogTitle className="text-[26px] leading-tight font-extrabold tracking-tight text-gray-900">
                  {title}
                </DialogTitle>
                <div className="mt-3 text-sm text-gray-700 leading-relaxed">{detail}</div>
                <div className="mt-3 text-sm text-gray-600">
                  Unlock unlimited records and more powerful features with our Premium Plans.
                </div>
              </div>
            </div>
          </DialogHeader>
        </div>

        <div className="px-8 pb-8">
          <Button
            type="button"
            onClick={() => {
              onOpenChange(false);
              navigate("/upgrade");
            }}
            className="w-full h-14 rounded-xl text-base font-semibold bg-gradient-to-r from-indigo-600 via-blue-600 to-indigo-600 text-white shadow-lg hover:from-indigo-700 hover:via-blue-700 hover:to-indigo-700"
          >
            Upgrade Plan
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
