import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { useQuery } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { motion, AnimatePresence } from "framer-motion";
import { useToast } from "@/hooks/use-toast";

// Dummy fallback for company name
const COMPANY_NAME = "Your Company";

// Safe error to message helper to handle 'unknown' catch variables
function getErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  try {
    return JSON.stringify(error);
  } catch {
    return String(error);
  }
}

// Get subscription name from query param (e.g. /subscription-user?name=ChatGPT&id=123)
function getSubscriptionFromUrl() {
  const params = new URLSearchParams(window.location.search);
  return {
    name: params.get("name") || "Subscription",
    id: params.get("id") || null
  };
}

export default function SubscriptionUserPage() {
  const { name: subscriptionName, id: subscriptionId } = getSubscriptionFromUrl();
  const { toast } = useToast();

  // Fetch all employees
  const { data: employees = [], isLoading: employeesLoading } = useQuery({
    queryKey: ["/api/employees"],
    queryFn: async () => {
      const res = await fetch("/api/employees", { credentials: "include" });
      const data = await res.json();
      return Array.isArray(data) ? data : [];
    },
  });

  // Fetch users already added to this subscription
  const { data: subscriptionUsers = [], refetch: refetchSubscriptionUsers } = useQuery({
    queryKey: ["/api/subscriptions", subscriptionId, "users"],
    enabled: !!subscriptionId,
    queryFn: async () => {
      if (!subscriptionId) return [];
      const res = await fetch(`/api/subscriptions/${subscriptionId}/users`, { credentials: "include" });
      const data = await res.json();
      return Array.isArray(data) ? data : [];
    },
  });

  // Local state
  const [selectedUsers, setSelectedUsers] = useState<any[]>([]);
  const [searchLeft, setSearchLeft] = useState("");
  const [searchRight, setSearchRight] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  // On initial mount, set selectedUsers from backend
  useEffect(() => {
    if (Array.isArray(subscriptionUsers) && subscriptionUsers.length > 0) {
      setSelectedUsers(subscriptionUsers);
    }
  }, [subscriptionUsers]);

  // Filtered employees (not already added)
  const availableEmployees = useMemo(() => {
    return employees.filter((emp) => {
      const empId = emp.id || emp._id;
      const searchTerm = searchLeft.toLowerCase();
      return (
        !selectedUsers.some((u) => (u.id || u._id) === empId) &&
        (emp.name?.toLowerCase().includes(searchTerm) || 
         emp.department?.toLowerCase().includes(searchTerm) || 
         emp.email?.toLowerCase().includes(searchTerm))
      );
    });
  }, [employees, selectedUsers, searchLeft]);

  // Filtered selected users
  const filteredSelectedUsers = useMemo(() => {
    const searchTerm = searchRight.toLowerCase();
    return selectedUsers.filter((u) =>
      u.name?.toLowerCase().includes(searchTerm) ||
      u.department?.toLowerCase().includes(searchTerm) ||
      u.email?.toLowerCase().includes(searchTerm)
    );
  }, [selectedUsers, searchRight]);

  // Add user
  const handleAddUser = (emp: any) => {
    const empId = emp.id || emp._id;
    setSelectedUsers((prev) => {
      if (prev.some((u) => (u.id || u._id) === empId)) return prev;
      return [...prev, emp];
    });
  };

  // Remove user
  const handleRemoveUser = (user: any) => {
    const userId = user.id || user._id;
    setSelectedUsers((prev) => prev.filter((u) => (u.id || u._id) !== userId));
  };

  // Add all users
  const handleAddAll = () => {
    setSelectedUsers((prev) => {
      const newUsers = availableEmployees.filter((emp) => {
        const empId = emp.id || emp._id;
        return !prev.some((u) => (u.id || u._id) === empId);
      });
      return [...prev, ...newUsers];
    });
  };

  // Remove all
  const handleRemoveAll = () => {
    setSelectedUsers([]);
  };

  // Save handler
  const handleSave = async () => {
    if (!subscriptionId) {
      toast({
        title: "Error",
        description: "No subscription ID available. Cannot save users.",
        variant: "destructive",
      });
      return;
    }

    setIsSaving(true);
    try {
      const payload = {
        users: selectedUsers.map(user => ({
          id: user.id || user._id,
          name: user.name,
          email: user.email,
          role: user.role,
          department: user.department
        }))
      };

      console.log("Saving to subscription ID:", subscriptionId);
      console.log("Payload:", payload);

      const response = await fetch(`/api/subscriptions/${subscriptionId}/users`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify(payload),
      });

      console.log("Response status:", response.status);
      console.log("Response headers:", response.headers);

      if (!response.ok) {
        const errorText = await response.text();
        console.error("Error response:", errorText);
        throw new Error(`Failed to save: ${response.status} ${response.statusText} - ${errorText}`);
      }

      const result = await response.json();
      console.log("Users saved successfully:", result);
      
      toast({
        title: "Success",
        description: "Subscription users updated successfully.",
      });
      
      // Refetch to ensure data is up to date
      await refetchSubscriptionUsers();
      
      // Immediately redirect to subscriptions card/modal (fast close)
      window.location.href = `/subscriptions?open=${subscriptionId}`;
    } catch (error: unknown) {
      console.error("Error saving users:", error);
      toast({
        title: "Error",
        description: `Failed to save users: ${getErrorMessage(error)}`,
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  // Cancel handler
  const handleCancel = () => {
    // Redirect back to the subscription modal page
    if (subscriptionId) {
      window.location.href = `/subscriptions?open=${subscriptionId}`;
    } else {
      window.history.back();
    }
  };

  // Animation variants
  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.05
      }
    }
  };

  const itemVariants = {
    hidden: { y: 20, opacity: 0 },
    visible: {
      y: 0,
      opacity: 1,
      transition: {
        type: "spring",
        stiffness: 300,
        damping: 24
      }
    },
    exit: { 
      y: -20, 
      opacity: 0,
      transition: {
        duration: 0.6  // Slower exit animation (was 0.2)
      }
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 to-blue-100 p-4 md:p-8">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <motion.div 
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="text-center mb-10"
        >
          <h1 className="text-3xl md:text-4xl font-bold text-gray-800 mb-2">
            Manage Subscription Users
          </h1>
          <p className="text-gray-600 max-w-2xl mx-auto">
            Add or remove team members from the <span className="font-semibold text-indigo-600">{subscriptionName}</span> subscription.
          </p>
        </motion.div>

        <div className="flex flex-col lg:flex-row gap-8">
          {/* Team Members Panel (will appear second on large screens) */}
          <motion.div 
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.5, delay: 0.2 }}
            className="flex-1 bg-white rounded-2xl shadow-xl overflow-hidden order-2 lg:order-2"
          >
            <div className="p-6 border-b border-gray-200">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-bold text-gray-800">
                  {COMPANY_NAME}'s Team Members
                </h2>
                <Badge variant="secondary" className="bg-blue-100 text-blue-800">
                  {availableEmployees.length} available
                </Badge>
              </div>
              <div className="flex gap-3">
                <div className="relative flex-1">
                  <Input
                    placeholder="Search team members..."
                    value={searchLeft}
                    onChange={(e) => setSearchLeft(e.target.value)}
                    className="pl-10 border-gray-300 focus:border-indigo-500 focus:ring-indigo-500"
                  />
                  <svg 
                    className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" 
                    fill="none" 
                    stroke="currentColor" 
                    viewBox="0 0 24 24" 
                    xmlns="http://www.w3.org/2000/svg"
                  >
                    <path 
                      strokeLinecap="round" 
                      strokeLinejoin="round" 
                      strokeWidth={2} 
                      d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" 
                    />
                  </svg>
                </div>
                <Button
                  onClick={handleAddAll}
                  className="bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white font-semibold shadow-md transition-all duration-300 transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed"
                  disabled={availableEmployees.length === 0}
                >
                  Add All
                </Button>
              </div>
            </div>
            
            <div className="p-4 max-h-[500px] overflow-y-auto">
              {employeesLoading ? (
                <div className="flex justify-center items-center h-64">
                  <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-indigo-500"></div>
                </div>
              ) : (
                <motion.div 
                  variants={containerVariants}
                  initial="hidden"
                  animate="visible"
                  className="space-y-3"
                >
                  <AnimatePresence>
                    {availableEmployees.length > 0 ? (
                      availableEmployees.map((emp) => (
                        <motion.div
                          key={emp.id || emp._id}
                          variants={itemVariants}
                          layout
                          exit="exit"
                          className="flex items-center justify-between bg-gray-50 hover:bg-indigo-50 rounded-xl px-4 py-3 transition-colors duration-200 border border-gray-200"
                        >
                          <div className="flex items-center gap-4">
                            <div className="w-12 h-12 rounded-full bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center text-white font-bold text-lg shadow-md">
                              {emp.name?.split(" ").map((n: string) => n[0]).join("")}
                            </div>
                            <div>
                              <span className="text-lg font-medium text-gray-800">{emp.name}</span>
                              <div className="text-sm text-gray-500">
                                {emp.email && <div>{emp.email}</div>}
                                {emp.department && <div className="text-indigo-600 font-medium">{emp.department}</div>}
                                {!emp.email && !emp.department && <div>Team Member</div>}
                              </div>
                            </div>
                          </div>
                          <Button
                            onClick={() => handleAddUser(emp)}
                            className="bg-gradient-to-r from-green-400 to-emerald-500 hover:from-green-500 hover:to-emerald-600 text-white font-semibold shadow-md transition-all duration-300 transform hover:scale-105"
                          >
                            Add
                          </Button>
                        </motion.div>
                      ))
                    ) : (
                      <motion.div 
                        variants={itemVariants}
                        className="text-center py-12"
                      >
                        <div className="text-gray-400 mb-2">No team members found</div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.div>
              )}
            </div>
          </motion.div>

          {/* Users in Subscription Panel (will appear first on large screens) */}
          <motion.div 
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.5, delay: 0.4 }}
            className="flex-1 bg-white rounded-2xl shadow-xl overflow-hidden order-1 lg:order-1"
          >
            <div className="p-6 border-b border-gray-200">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-bold text-gray-800">
                  Users in <span className="text-indigo-600">{subscriptionName}</span>
                </h2>
                <Badge variant="secondary" className="bg-purple-100 text-purple-800">
                  {selectedUsers.length} added
                </Badge>
              </div>
              <div className="flex gap-3">
                <div className="relative flex-1">
                  <Input
                    placeholder="Search added users..."
                    value={searchRight}
                    onChange={(e) => setSearchRight(e.target.value)}
                    className="pl-10 border-gray-300 focus:border-indigo-500 focus:ring-indigo-500"
                  />
                  <svg 
                    className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" 
                    fill="none" 
                    stroke="currentColor" 
                    viewBox="0 0 24 24" 
                    xmlns="http://www.w3.org/2000/svg"
                  >
                    <path 
                      strokeLinecap="round" 
                      strokeLinejoin="round" 
                      strokeWidth={2} 
                      d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" 
                    />
                  </svg>
                </div>
                <Button
                  onClick={handleRemoveAll}
                  className="bg-gradient-to-r from-red-500 to-rose-600 hover:from-red-600 hover:to-rose-700 text-white font-semibold shadow-md transition-all duration-300 transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed"
                  disabled={selectedUsers.length === 0}
                >
                  Remove All
                </Button>
              </div>
            </div>
            
            <div className="p-4 max-h-[500px] overflow-y-auto">
              <motion.div 
                variants={containerVariants}
                initial="hidden"
                animate="visible"
                className="space-y-3"
              >
                <AnimatePresence>
                  {filteredSelectedUsers.length > 0 ? (
                    filteredSelectedUsers.map((user) => (
                      <motion.div
                        key={user.id || user._id}
                        variants={itemVariants}
                        layout
                        exit="exit"
                        className="flex items-center justify-between bg-gray-50 hover:bg-purple-50 rounded-xl px-4 py-3 transition-colors duration-200 border border-gray-200"
                      >
                        <div className="flex items-center gap-4">
                          <div className="w-12 h-12 rounded-full bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center text-white font-bold text-lg shadow-md">
                            {user.name?.split(" ").map((n: string) => n[0]).join("")}
                          </div>
                          <div>
                            <span className="text-lg font-medium text-gray-800">{user.name}</span>
                            <div className="text-sm text-gray-500">
                              {user.email && <div>{user.email}</div>}
                              {user.department && <div className="text-indigo-600 font-medium">{user.department}</div>}
                              {!user.email && !user.department && <div>Team Member</div>}
                            </div>
                          </div>
                        </div>
                        <Button
                          onClick={() => handleRemoveUser(user)}
                          className="bg-gradient-to-r from-red-400 to-rose-500 hover:from-red-500 hover:to-rose-600 text-white font-semibold shadow-md transition-all duration-300 transform hover:scale-105"
                        >
                          Remove
                        </Button>
                      </motion.div>
                    ))
                  ) : (
                    <motion.div 
                      variants={itemVariants}
                      className="text-center py-12"
                    >
                      <div className="text-gray-400 mb-2">No users added yet</div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            </div>
          </motion.div>
        </div>

        {/* Bottom buttons */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.6 }}
          className="flex justify-end gap-4 mt-10"
        >
          <Button
            variant="outline"
            className="border-gray-300 text-gray-700 px-8 py-3 text-lg font-medium rounded-xl shadow-sm hover:bg-gray-50 transition-colors duration-300"
            onClick={handleCancel}
          >
            Cancel
          </Button>
          <Button
            className="bg-gradient-to-r from-indigo-600 to-purple-700 hover:from-indigo-700 hover:to-purple-800 text-white px-8 py-3 text-lg font-semibold rounded-xl shadow-lg transition-all duration-300 transform hover:scale-105 disabled:opacity-75 disabled:cursor-not-allowed"
            onClick={handleSave}
            disabled={isSaving}
          >
            {isSaving ? (
              <div className="flex items-center gap-2">
                <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Saving...
              </div>
            ) : (
              "Save Changes"
            )}
          </Button>
        </motion.div>
      </div>
    </div>
  );
}