import React from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { apiFetch } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";

type OrgUser = {
  _id: string;
  email?: string;
  fullName?: string;
  role?: string;
  status?: string;
  createdAt?: string;
  lastLogin?: string;
};

type OrgDetailResponse = {
  company: {
    tenantId: string;
    companyName: string;
    createdAt: string | null;
    users: number;
    status: string | null;
    plan: string | null;
    stripeCustomerId?: string | null;
    stripeSubscriptionId?: string | null;
    subscriptionCurrentPeriodEnd: string | null;
    trialEndsAt?: string | null;
    planActivatedAt?: string | null;
    planExpiredAt?: string | null;
  };
  users: OrgUser[];
};

type TenantUsageResponse = {
  tenantId: string;
  usersTotal: number;
  usersActive: number;
  licensesTotal: number;
  complianceTotal: number;
};

type PlatformBillingResponse = {
  subscriptions?: Array<{
    id: string;
    tenantId?: string | null;
    status?: string | null;
    currentPeriodEnd?: string | null;
    planName?: string | null;
    amountMonthly?: number | null;
  }>;
  invoices?: Array<{
    id: string;
    tenantId?: string | null;
    status?: string | null;
    amount?: number | null;
    createdAt?: string | null;
    invoiceUrl?: string | null;
  }>;
  payments?: Array<{
    id: string;
    tenantId?: string | null;
    status?: string | null;
    amount?: number | null;
    paidAt?: string | null;
  }>;
};

function formatDate(dateLike: string | null | undefined) {
  if (!dateLike) return "—";
  const d = new Date(dateLike);
  return Number.isFinite(d.getTime()) ? d.toLocaleString() : "—";
}

export default function PlatformOrgDetailPage() {
  const { tenantId } = useParams();
  const [searchParams] = useSearchParams();
  const editMode = searchParams.get("edit") === "1";

  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [companyNameDraft, setCompanyNameDraft] = React.useState("");
  const [offboardOpen, setOffboardOpen] = React.useState(false);
  const [offboardConfirmText, setOffboardConfirmText] = React.useState("");
  const [impersonateConfirmOpen, setImpersonateConfirmOpen] = React.useState(false);
  const [statusTarget, setStatusTarget] = React.useState<{
    tenantId: string;
    companyName: string;
    nextStatus: "active" | "suspended";
    actionLabel: string;
    description: string;
  } | null>(null);
  const [planOpen, setPlanOpen] = React.useState(false);
  const [planDraft, setPlanDraft] = React.useState<"free" | "professional" | "premium">("free");

  const editCardRef = React.useRef<HTMLDivElement | null>(null);

  const { data, isLoading, error } = useQuery({
    queryKey: ["platform", "company", tenantId],
    queryFn: async () => {
      const res = await apiFetch(`/api/platform/companies/${tenantId}`);
      if (!res.ok) {
        const text = await res.text().catch(() => "");
        throw new Error(text || "Failed to load organization");
      }
      return (await res.json()) as OrgDetailResponse;
    },
    enabled: Boolean(tenantId),
  });

  const companyDisplayName = React.useMemo(() => {
    const name = String(data?.company?.companyName || "").trim();
    if (name && name.toLowerCase() !== "unnamed company") return name;
    const t = String(tenantId || "").trim();
    return t ? `Tenant ${t}` : "Organization";
  }, [data?.company?.companyName, tenantId]);

  const statusBadgeClass = (statusRaw: unknown) => {
    const status = String(statusRaw || "").trim().toLowerCase();
    if (status === "active") return "bg-emerald-100 text-emerald-800 border-emerald-200 hover:bg-emerald-100";
    if (status === "suspended") return "bg-rose-100 text-rose-800 border-rose-200 hover:bg-rose-100";
    return "bg-gray-100 text-gray-700 border-gray-200 hover:bg-gray-100";
  };

  const statusLabel = (statusRaw: unknown) => {
    const value = String(statusRaw || "").trim();
    if (!value) return "Unknown";
    return value[0].toUpperCase() + value.slice(1);
  };

  const planLabel = (planRaw: unknown) => {
    const value = String(planRaw || "").trim().toLowerCase();
    if (!value) return "—";
    if (value === "pro") return "Professional";
    return value[0].toUpperCase() + value.slice(1);
  };

  React.useEffect(() => {
    if (!data?.company?.companyName) return;
    setCompanyNameDraft(String(data.company.companyName || ""));
  }, [data?.company?.companyName]);

  React.useEffect(() => {
    const current = String(data?.company?.plan || "free").trim().toLowerCase();
    if (current === "professional" || current === "pro") setPlanDraft("professional");
    else if (current === "premium") setPlanDraft("premium");
    else setPlanDraft("free");
  }, [data?.company?.plan]);

  React.useEffect(() => {
    if (!editMode) return;
    const el = editCardRef.current;
    if (!el) return;
    const t = window.setTimeout(() => {
      try {
        el.scrollIntoView({ behavior: "smooth", block: "start" });
      } catch {
        // ignore
      }
    }, 0);
    return () => window.clearTimeout(t);
  }, [editMode]);

  const { data: usage } = useQuery<TenantUsageResponse>({
    queryKey: ["platform", "company-usage", tenantId],
    queryFn: async () => {
      const res = await apiFetch(`/api/platform/companies/${tenantId}/usage`);
      if (!res.ok) {
        const text = await res.text().catch(() => "");
        throw new Error(text || "Failed to load tenant usage");
      }
      return res.json();
    },
    enabled: Boolean(tenantId),
    retry: false,
    refetchOnWindowFocus: false,
  });

  const { data: billing } = useQuery<PlatformBillingResponse>({
    queryKey: ["/api/platform/billing"],
    queryFn: async () => {
      const res = await apiFetch("/api/platform/billing");
      if (!res.ok) {
        const text = await res.text().catch(() => "");
        throw new Error(text || "Failed to load billing");
      }
      return res.json();
    },
    enabled: Boolean(tenantId),
    retry: false,
    refetchOnWindowFocus: false,
  });

  const billingForTenant = React.useMemo(() => {
    const tId = String(tenantId || "").trim();
    const subs = (billing?.subscriptions || []).filter((s) => String(s?.tenantId || "") === tId);
    const invoices = (billing?.invoices || []).filter((i) => String(i?.tenantId || "") === tId);
    const payments = (billing?.payments || []).filter((p) => String(p?.tenantId || "") === tId);
    return { subs, invoices, payments };
  }, [billing, tenantId]);

  const updateCompanyMutation = useMutation({
    mutationFn: async (payload: { tenantId: string; companyName: string }) => {
      const res = await apiFetch(`/api/platform/companies/${payload.tenantId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ companyName: payload.companyName }),
      });
      if (!res.ok) {
        const text = await res.text().catch(() => "");
        throw new Error(text || "Failed to update company");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["platform", "company", tenantId] });
      queryClient.invalidateQueries({ queryKey: ["/api/platform/companies"] });
    },
  });

  const updateCompanyStatusMutation = useMutation({
    mutationFn: async (payload: { tenantId: string; status: "active" | "suspended" }) => {
      const res = await apiFetch(`/api/platform/companies/${payload.tenantId}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: payload.status }),
      });
      if (!res.ok) {
        const text = await res.text().catch(() => "");
        throw new Error(text || "Failed to update tenant status");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["platform", "company", tenantId] });
      queryClient.invalidateQueries({ queryKey: ["/api/platform/companies"] });
    },
  });

  const offboardTenantMutation = useMutation({
    mutationFn: async (payload: { tenantId: string }) => {
      const res = await apiFetch(`/api/platform/companies/${payload.tenantId}/offboard`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      if (!res.ok) {
        const text = await res.text().catch(() => "");
        throw new Error(text || "Failed to offboard tenant");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["platform", "company", tenantId] });
      queryClient.invalidateQueries({ queryKey: ["/api/platform/companies"] });
    },
  });

  const impersonateTenantMutation = useMutation({
    mutationFn: async (payload: { tenantId: string }) => {
      const res = await apiFetch(`/api/platform/companies/${payload.tenantId}/impersonate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      if (!res.ok) {
        const text = await res.text().catch(() => "");
        throw new Error(text || "Failed to impersonate tenant");
      }
      return res.json() as Promise<{ token: string }>;
    },
    onSuccess: (data) => {
      const token = String((data as any)?.token || "").trim();
      if (token) {
        try {
          sessionStorage.setItem("token", token);
        } catch {
          // ignore
        }
      }
      window.location.assign("/dashboard");
    },
  });

  const changeStripePlanMutation = useMutation({
    mutationFn: async (payload: { subscriptionId: string; plan: "free" | "professional" | "premium" }) => {
      const res = await apiFetch(`/api/platform/billing/subscriptions/${payload.subscriptionId}/plan`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan: payload.plan }),
      });
      if (!res.ok) {
        const text = await res.text().catch(() => "");
        throw new Error(text || "Failed to change plan");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/platform/billing"] });
      queryClient.invalidateQueries({ queryKey: ["platform", "company", tenantId] });
      queryClient.invalidateQueries({ queryKey: ["/api/platform/companies"] });
      toast({ title: "Successfully plan has changed." });
    },
  });

  const updateCompanyPlanMutation = useMutation({
    mutationFn: async (payload: { tenantId: string; plan: "free" | "professional" | "premium" }) => {
      const res = await apiFetch(`/api/platform/companies/${payload.tenantId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan: payload.plan }),
      });
      if (!res.ok) {
        const text = await res.text().catch(() => "");
        throw new Error(text || "Failed to update plan");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["platform", "company", tenantId] });
      queryClient.invalidateQueries({ queryKey: ["/api/platform/companies"] });
      toast({ title: "Successfully plan has changed." });
    },
  });

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Organization</h1>
          <p className="text-muted-foreground">Tenant: {tenantId}</p>
        </div>
        <Button asChild>
          <Link to="/platform-admin/organizations">Back to Organizations</Link>
        </Button>
      </div>

      {isLoading ? <div>Loading...</div> : null}
      {error ? <div className="text-red-600">Failed to load organization</div> : null}

      {data ? (
        <>
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between gap-3">
                <span>{companyDisplayName}</span>
                <Badge variant="outline" className={statusBadgeClass(data.company.status)}>
                  {statusLabel(data.company.status)}
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                <div>
                  <div className="text-sm text-muted-foreground">Plan</div>
                  <div className="font-medium">{planLabel(data.company.plan)}</div>
                </div>
                <div>
                  <div className="text-sm text-muted-foreground">Users</div>
                  <div className="font-medium">{data.company.users}</div>
                </div>
                <div>
                  <div className="text-sm text-muted-foreground">Created</div>
                  <div className="font-medium">{formatDate(data.company.createdAt)}</div>
                </div>
                <div>
                  <div className="text-sm text-muted-foreground">Period End</div>
                  <div className="font-medium">{formatDate(data.company.subscriptionCurrentPeriodEnd)}</div>
                </div>
                <div>
                  <div className="text-sm text-muted-foreground">Trial Ends</div>
                  <div className="font-medium">{formatDate(data.company.trialEndsAt)}</div>
                </div>
                <div>
                  <div className="text-sm text-muted-foreground">Plan Activated</div>
                  <div className="font-medium">{formatDate(data.company.planActivatedAt)}</div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Usage</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <div>
                  <div className="text-sm text-muted-foreground">Active Users</div>
                  <div className="font-medium">{usage ? usage.usersActive : "—"}</div>
                </div>
                <div>
                  <div className="text-sm text-muted-foreground">Total Users</div>
                  <div className="font-medium">{usage ? usage.usersTotal : "—"}</div>
                </div>
                <div>
                  <div className="text-sm text-muted-foreground">Licenses</div>
                  <div className="font-medium">{usage ? usage.licensesTotal : "—"}</div>
                </div>
                <div>
                  <div className="text-sm text-muted-foreground">Compliance Items</div>
                  <div className="font-medium">{usage ? usage.complianceTotal : "—"}</div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Billing</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <div className="text-sm text-muted-foreground">Subscriptions</div>
                  <div className="font-medium">{billingForTenant.subs.length}</div>
                </div>
                <div>
                  <div className="text-sm text-muted-foreground">Invoices</div>
                  <div className="font-medium">{billingForTenant.invoices.length}</div>
                </div>
                <div>
                  <div className="text-sm text-muted-foreground">Payments</div>
                  <div className="font-medium">{billingForTenant.payments.length}</div>
                </div>
              </div>
              {billingForTenant.subs[0] ? (
                <div className="text-sm text-muted-foreground">
                  Current subscription: <span className="font-medium text-foreground">{billingForTenant.subs[0].status || "—"}</span>
                  {billingForTenant.subs[0].currentPeriodEnd ? (
                    <span className="ml-2">(Renews {formatDate(billingForTenant.subs[0].currentPeriodEnd)})</span>
                  ) : null}
                </div>
              ) : null}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Actions</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-2 md:flex-row md:flex-wrap">
              <Button
                variant="outline"
                disabled={!tenantId || impersonateTenantMutation.isPending}
                onClick={() => setImpersonateConfirmOpen(true)}
              >
                Impersonate
              </Button>
              <Button disabled={!tenantId} onClick={() => setPlanOpen(true)}>
                Change Plan
              </Button>
              <Button
                variant="outline"
                disabled={!tenantId || updateCompanyStatusMutation.isPending}
                onClick={() => {
                  if (!tenantId) return;
                  const current = String(data.company.status || "").toLowerCase();
                  const next = current === "suspended" ? "active" : "suspended";
                  setStatusTarget({
                    tenantId,
                    companyName: companyDisplayName,
                    nextStatus: next as any,
                    actionLabel: next === "active" ? "Reactivate" : "Suspend",
                    description:
                      next === "active"
                        ? "Users will be able to log in again."
                        : "Users will lose access and active sessions will be terminated.",
                  });
                }}
              >
                {String(data.company.status || "").toLowerCase() === "suspended" ? "Reactivate" : "Suspend"}
              </Button>
              <Button
                variant="destructive"
                disabled={!tenantId || offboardTenantMutation.isPending}
                onClick={() => {
                  setOffboardConfirmText("");
                  setOffboardOpen(true);
                }}
              >
                Offboard
              </Button>
            </CardContent>
          </Card>

          {editMode ? (
            <Card ref={editCardRef as any}>
              <CardHeader>
                <CardTitle>Edit Company</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-2">
                  <Label htmlFor="companyName">Company name</Label>
                  <Input
                    id="companyName"
                    value={companyNameDraft}
                    onChange={(e) => setCompanyNameDraft(e.target.value)}
                    placeholder="Enter company name"
                  />
                  <div className="text-sm text-muted-foreground">This name is shown in platform administration and reporting.</div>
                </div>

                <div className="flex flex-col gap-2 sm:flex-row">
                  <Button
                    disabled={updateCompanyMutation.isPending || !tenantId || !companyNameDraft.trim()}
                    onClick={() => {
                      if (!tenantId) return;
                      updateCompanyMutation.mutate({ tenantId, companyName: companyNameDraft.trim() });
                    }}
                  >
                    Save changes
                  </Button>
                  <Button asChild variant="outline">
                    <Link to={`/platform/organizations/${tenantId}`}>Cancel</Link>
                  </Button>
                </div>
                {updateCompanyMutation.isError ? (
                  <div className="text-sm text-red-600">Failed to update company</div>
                ) : null}
                {updateCompanyMutation.isSuccess ? (
                  <div className="text-sm text-emerald-700">Saved</div>
                ) : null}
              </CardContent>
            </Card>
          ) : null}

          <Card>
            <CardHeader>
              <CardTitle>Users</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Email</TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Last Login</TableHead>
                    <TableHead>Created</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.users.map((u) => (
                    <TableRow key={u._id}>
                      <TableCell className="font-medium">{u.email || "—"}</TableCell>
                      <TableCell>{u.fullName || "—"}</TableCell>
                      <TableCell>{u.role || "—"}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className={statusBadgeClass(u.status)}>
                          {statusLabel(u.status)}
                        </Badge>
                      </TableCell>
                      <TableCell>{formatDate(u.lastLogin)}</TableCell>
                      <TableCell>{formatDate(u.createdAt)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          <Dialog open={planOpen} onOpenChange={setPlanOpen}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Change Plan</DialogTitle>
                <DialogDescription>Update the plan for this organization.</DialogDescription>
              </DialogHeader>

              <div className="space-y-2">
                <Label>Plan</Label>
                <Select value={planDraft} onValueChange={(v) => setPlanDraft(v as any)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select plan" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="free">Free</SelectItem>
                    <SelectItem value="professional">Professional</SelectItem>
                    <SelectItem value="premium">Premium</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <DialogFooter>
                <Button variant="outline" onClick={() => setPlanOpen(false)}>
                  Cancel
                </Button>
                <Button
                  disabled={!tenantId || changeStripePlanMutation.isPending || updateCompanyPlanMutation.isPending}
                  onClick={() => {
                    if (!tenantId) return;
                    const subId = String(data.company.stripeSubscriptionId || "").trim();
                    if (subId) {
                      changeStripePlanMutation.mutate({ subscriptionId: subId, plan: planDraft });
                    } else {
                      updateCompanyPlanMutation.mutate({ tenantId, plan: planDraft });
                    }
                    setPlanOpen(false);
                  }}
                >
                  Apply
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          <AlertDialog
            open={impersonateConfirmOpen}
            onOpenChange={(open) => {
              if (!open) setImpersonateConfirmOpen(false);
              else setImpersonateConfirmOpen(true);
            }}
          >
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Enter impersonation mode?</AlertDialogTitle>
                <AlertDialogDescription>
                  You will enter <span className="font-medium text-foreground">{companyDisplayName}</span> as an admin.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel onClick={() => setImpersonateConfirmOpen(false)}>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  disabled={!tenantId || impersonateTenantMutation.isPending}
                  onClick={() => {
                    if (!tenantId) return;
                    impersonateTenantMutation.mutate({ tenantId });
                    setImpersonateConfirmOpen(false);
                  }}
                >
                  Impersonate
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>

          <AlertDialog open={Boolean(statusTarget)} onOpenChange={(open) => (open ? null : setStatusTarget(null))}>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>
                  {statusTarget?.nextStatus === "active" ? "Reactivate organization?" : "Suspend organization?"}
                </AlertDialogTitle>
                <AlertDialogDescription>
                  <div className="space-y-2">
                    <div>
                      Organization: <span className="font-medium text-foreground">{statusTarget?.companyName || "—"}</span>
                    </div>
                    <div className="text-muted-foreground">{statusTarget?.description}</div>
                  </div>
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel onClick={() => setStatusTarget(null)}>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  disabled={!statusTarget || updateCompanyStatusMutation.isPending}
                  onClick={() => {
                    if (!statusTarget) return;
                    updateCompanyStatusMutation.mutate({ tenantId: statusTarget.tenantId, status: statusTarget.nextStatus });
                    setStatusTarget(null);
                  }}
                >
                  {statusTarget?.actionLabel || "Confirm"}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>

          <AlertDialog open={offboardOpen} onOpenChange={setOffboardOpen}>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Offboard Organization</AlertDialogTitle>
                <AlertDialogDescription>
                  <div className="space-y-3">
                    <div>
                      You are about to offboard <span className="font-medium text-foreground">{companyDisplayName}</span>.
                    </div>
                    <ul className="list-disc pl-5 space-y-1">
                      <li>All users will lose access immediately</li>
                      <li>Active sessions will be terminated</li>
                      <li>Data will be retained but inaccessible</li>
                    </ul>
                    <div className="font-medium text-foreground">This action cannot be easily undone.</div>
                  </div>
                </AlertDialogDescription>
              </AlertDialogHeader>

              <div className="space-y-2">
                <Label>Type "OFFBOARD" to confirm</Label>
                <Input value={offboardConfirmText} onChange={(e) => setOffboardConfirmText(e.target.value)} placeholder="OFFBOARD" />
              </div>

              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  disabled={!tenantId || offboardTenantMutation.isPending || offboardConfirmText.trim() !== "OFFBOARD"}
                  onClick={() => {
                    if (!tenantId) return;
                    offboardTenantMutation.mutate({ tenantId });
                  }}
                >
                  Offboard Organization
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </>
      ) : null}
    </div>
  );
}
