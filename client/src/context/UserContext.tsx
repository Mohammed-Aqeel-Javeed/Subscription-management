import React, { createContext, useContext, useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";
import { defineAbilityFor, type AppAbility } from "@/lib/ability";

interface User {
  userId: string;
  email: string;
  fullName: string | null;
  companyName: string | null;
  tenantId: string | null;
  defaultCurrency: string | null;
  role: string;
  department?: string;
}

interface UserContextType {
  user: User | null;
  isLoading: boolean;
  ability: AppAbility;
}

const UserContext = createContext<UserContextType | undefined>(undefined);

export const UserProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { data: user, isLoading } = useQuery<User>({
    queryKey: ["/api/me"],
    queryFn: async () => {
      const response = await apiFetch("/api/me");
      if (!response.ok) {
        throw new Error("Failed to fetch user");
      }
      return response.json();
    },
    retry: false,
    refetchOnWindowFocus: false,
  });

  const [ability, setAbility] = useState<AppAbility>(
    defineAbilityFor({ role: "viewer", userId: "", department: undefined })
  );

  useEffect(() => {
    if (user) {
      const newAbility = defineAbilityFor({
        role: user.role || "viewer",
        userId: user.userId,
        department: user.department,
      });
      setAbility(newAbility);
    }
  }, [user]);

  return (
    <UserContext.Provider value={{ user: user || null, isLoading, ability }}>
      {children}
    </UserContext.Provider>
  );
};

export const useUser = () => {
  const context = useContext(UserContext);
  if (context === undefined) {
    throw new Error("useUser must be used within a UserProvider");
  }
  return context;
};
