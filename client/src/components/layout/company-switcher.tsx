import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "../../lib/api";
import { Building2, Check, ChevronsUpDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { useToast } from "@/hooks/use-toast";

type Company = {
  tenantId: string;
  companyName: string;
  isActive: boolean;
};

export default function CompanySwitcher() {
  const [open, setOpen] = useState(false);
  const queryClient = useQueryClient();
  const { toast } = useToast();

  // Fetch user's companies
  const { data: companies = [], isLoading } = useQuery<Company[]>({
    queryKey: ["/api/user/companies"],
    queryFn: async () => {
      const res = await apiFetch("/api/user/companies");
      if (!res.ok) throw new Error("Failed to fetch companies");
      return res.json();
    },
    staleTime: 5 * 60 * 1000,
  });

  const activeCompany = companies.find((c) => c.isActive);

  const handleSwitchCompany = async (tenantId: string) => {
    try {
      const res = await apiFetch("/api/user/switch-company", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tenantId }),
      });

      if (!res.ok) {
        throw new Error("Failed to switch company");
      }

      // Invalidate all queries to refetch with new tenantId
      queryClient.clear();
      
      // Reload the page to ensure all components use the new tenantId
      window.location.reload();
      
      toast({
        title: "Company Switched",
        description: "Successfully switched to the selected company",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to switch company. Please try again.",
        variant: "destructive",
      });
    }
  };

  // Don't show if user only has one company or loading
  if (isLoading || companies.length <= 1) {
    return null;
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-full justify-between bg-white/80 hover:bg-white hover:shadow-sm transition-all"
        >
          <div className="flex items-center gap-2 min-w-0 flex-1">
            <Building2 className="h-4 w-4 shrink-0 text-blue-600" />
            <span className="truncate text-sm">
              {activeCompany?.companyName || "Select company..."}
            </span>
          </div>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[240px] p-0 bg-white border border-gray-200 shadow-lg" align="start">
        <Command className="bg-white">
          <CommandInput placeholder="Search company..." className="h-9 bg-white" />
          <CommandList className="bg-white">
            <CommandEmpty className="text-gray-500">No company found.</CommandEmpty>
            <CommandGroup heading="Your Companies" className="bg-white text-gray-900">
              {companies.map((company) => (
                <CommandItem
                  key={company.tenantId}
                  value={company.companyName}
                  onSelect={() => {
                    if (!company.isActive) {
                      handleSwitchCompany(company.tenantId);
                    }
                    setOpen(false);
                  }}
                  className="cursor-pointer bg-white hover:bg-gray-100 text-gray-900"
                >
                  <Building2 className="mr-2 h-4 w-4 text-gray-500" />
                  <span className="flex-1 truncate text-gray-900">{company.companyName}</span>
                  {company.isActive && (
                    <Check className="ml-2 h-4 w-4 text-blue-600" />
                  )}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
