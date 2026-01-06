import React from "react";

type SidebarSlotState = {
  active: boolean;
  replaceNav: boolean;
};

type SidebarSlotContextValue = SidebarSlotState & {
  setActive: (active: boolean) => void;
  setReplaceNav: (replaceNav: boolean) => void;
};

const SidebarSlotContext = React.createContext<SidebarSlotContextValue | null>(null);

export function SidebarSlotProvider({ children }: { children: React.ReactNode }) {
  const [active, setActive] = React.useState(false);
  const [replaceNav, setReplaceNav] = React.useState(false);

  const value = React.useMemo(
    () => ({
      active,
      replaceNav,
      setActive,
      setReplaceNav,
    }),
    [active, replaceNav]
  );

  return <SidebarSlotContext.Provider value={value}>{children}</SidebarSlotContext.Provider>;
}

export function useSidebarSlot() {
  const ctx = React.useContext(SidebarSlotContext);
  if (!ctx) {
    throw new Error("useSidebarSlot must be used within SidebarSlotProvider");
  }
  return ctx;
}
