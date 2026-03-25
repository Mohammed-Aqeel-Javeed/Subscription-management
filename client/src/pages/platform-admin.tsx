import React from "react";
import { useUser } from "@/context/UserContext";

export default function PlatformAdminPage() {
  const { user } = useUser();

  return (
    <div className="p-8">
      <div className="rounded-2xl border border-indigo-200/60 bg-white/70 p-6 text-indigo-900">
        <div className="text-2xl font-bold">Platform Admin</div>
        <div className="text-sm text-indigo-700/80 mt-1">
          Logged in as {user?.email || "global admin"}. Company data is hidden.
        </div>
      </div>
    </div>
  );
}
