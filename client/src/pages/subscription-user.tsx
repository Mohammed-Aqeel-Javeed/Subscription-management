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
  const [showTeamMembers, setShowTeamMembers] = useState(false);

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
      <div className="max-w-[100rem] mx-auto px-4">
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

        <div className={`grid gap-6 ${showTeamMembers ? 'grid-cols-1 lg:grid-cols-2' : 'grid-cols-1'}`}>
          {/* Users in Subscription Panel (always visible on left) */}
          <motion.div 
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.5, delay: 0.2 }}
            className="w-full bg-white rounded-2xl shadow-xl overflow-hidden"
          >
            <div className="p-6 border-b border-gray-200 bg-gradient-to-r from-indigo-50 to-blue-50">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-2xl font-bold text-gray-900">
                  Users in <span className="text-indigo-600">{subscriptionName}</span>
                </h2>
              </div>
              <div className="flex gap-3">
                <div className="relative flex-1">
                  <Input
                    placeholder=""
                    value={searchRight}
                    onChange={(e) => setSearchRight(e.target.value)}
                    className="pl-10 h-11 border-gray-300 focus:border-indigo-500 focus:ring-indigo-500 rounded-lg shadow-sm"
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
                {!showTeamMembers ? (
                  <Button
                    onClick={() => setShowTeamMembers(true)}
                    className="bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white font-semibold shadow-md transition-all duration-300 transform hover:scale-105 h-11 px-6"
                  >
                    <svg 
                      className="w-5 h-5 mr-2" 
                      fill="none" 
                      stroke="currentColor" 
                      viewBox="0 0 24 24" 
                      xmlns="http://www.w3.org/2000/svg"
                    >
                      <path 
                        strokeLinecap="round" 
                        strokeLinejoin="round" 
                        strokeWidth={2} 
                        d="M12 6v6m0 0v6m0-6h6m-6 0H6" 
                      />
                    </svg>
                    Add Team Member
                  </Button>
                ) : (
                  <Button
                    onClick={handleRemoveAll}
                    className="bg-gradient-to-r from-red-500 to-rose-600 hover:from-red-600 hover:to-rose-700 text-white font-semibold shadow-md transition-all duration-300 transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed h-11 px-6"
                    disabled={selectedUsers.length === 0}
                  >
                    Remove All
                  </Button>
                )}
              </div>
            </div>
            
            <div className="overflow-hidden max-h-[600px] overflow-y-auto">
              {filteredSelectedUsers.length > 0 ? (
                <div className="w-full">
                  <table className="w-full table-fixed">
                    <thead className="bg-gray-50 border-b-2 border-gray-200 sticky top-0 z-10">
                      <tr>
                        <th className="w-[30%] px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">User</th>
                        <th className="w-[30%] px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Email</th>
                        <th className="w-[20%] px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Department</th>
                        <th className="w-[20%] px-6 py-4 text-center text-xs font-semibold text-gray-600 uppercase tracking-wider">Action</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      <AnimatePresence>
                        {filteredSelectedUsers.map((user, index) => (
                          <motion.tr
                            key={user.id || user._id}
                            variants={itemVariants}
                            initial="hidden"
                            animate="visible"
                            exit="exit"
                            layout
                            className="hover:bg-indigo-50 transition-colors duration-150"
                            style={{ 
                              transitionDelay: `${index * 30}ms` 
                            }}
                          >
                            <td className="px-6 py-4">
                              <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white font-bold text-sm shadow-md flex-shrink-0">
                                  {user.name?.split(" ").map((n: string) => n[0]).join("").toUpperCase()}
                                </div>
                                <div className="font-medium text-gray-900 truncate">{user.name || 'Unnamed'}</div>
                              </div>
                            </td>
                            <td className="px-6 py-4">
                              <div className="text-sm text-gray-600 truncate">{user.email || '—'}</div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              {user.department ? (
                                <Badge className="bg-indigo-100 text-indigo-800 hover:bg-indigo-200 font-medium">
                                  {user.department}
                                </Badge>
                              ) : (
                                <span className="text-sm text-gray-400">—</span>
                              )}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-center">
                              <Button
                                onClick={() => handleRemoveUser(user)}
                                size="sm"
                                className="bg-gradient-to-r from-red-500 to-rose-600 hover:from-red-600 hover:to-rose-700 text-white font-semibold shadow-md transition-all duration-200 transform hover:scale-105"
                              >
                                Remove
                              </Button>
                            </td>
                          </motion.tr>
                        ))}
                      </AnimatePresence>
                    </tbody>
                  </table>
                </div>
              ) : (
                <motion.div 
                  variants={itemVariants}
                  initial="hidden"
                  animate="visible"
                  className="text-center py-16"
                >
                  <svg className="mx-auto h-16 w-16 text-gray-300 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                  </svg>
                  <p className="text-gray-400 text-lg font-medium">No users added yet</p>
                  <p className="text-gray-400 text-sm mt-1">Click "Add Team Member" to get started</p>
                </motion.div>
              )}
            </div>
          </motion.div>

          {/* Team Members Panel (conditionally shown on right) */}
          <AnimatePresence>
            {showTeamMembers && (
              <motion.div 
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                transition={{ duration: 0.5 }}
                className="w-full bg-white rounded-2xl shadow-xl overflow-hidden"
              >
                <div className="p-6 border-b border-gray-200 bg-gradient-to-r from-emerald-50 to-green-50">
                  <div className="flex justify-between items-center mb-4">
                    <h2 className="text-2xl font-bold text-gray-900">
                      {COMPANY_NAME}'s Team Members
                    </h2>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setShowTeamMembers(false)}
                      className="text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-full h-8 w-8 p-0"
                    >
                      <svg 
                        className="w-5 h-5" 
                        fill="none" 
                        stroke="currentColor" 
                        viewBox="0 0 24 24" 
                        xmlns="http://www.w3.org/2000/svg"
                      >
                        <path 
                          strokeLinecap="round" 
                          strokeLinejoin="round" 
                          strokeWidth={2} 
                          d="M6 18L18 6M6 6l12 12" 
                        />
                      </svg>
                    </Button>
                  </div>
                  <div className="flex gap-3">
                    <div className="relative flex-1">
                      <Input
                        placeholder=""
                        value={searchLeft}
                        onChange={(e) => setSearchLeft(e.target.value)}
                        className="pl-10 h-11 border-gray-300 focus:border-emerald-500 focus:ring-emerald-500 rounded-lg shadow-sm"
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
                      className="bg-gradient-to-r from-emerald-500 to-green-600 hover:from-emerald-600 hover:to-green-700 text-white font-semibold shadow-md transition-all duration-300 transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed h-11 px-6"
                      disabled={availableEmployees.length === 0}
                    >
                      Add All
                    </Button>
                  </div>
                </div>
                
                <div className="overflow-hidden max-h-[600px] overflow-y-auto">
                  {employeesLoading ? (
                    <div className="flex justify-center items-center h-64">
                      <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-emerald-500"></div>
                    </div>
                  ) : availableEmployees.length > 0 ? (
                    <div className="w-full">
                      <table className="w-full table-fixed">
                        <thead className="bg-gray-50 border-b-2 border-gray-200 sticky top-0 z-10">
                          <tr>
                            <th className="w-[30%] px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Team Member</th>
                            <th className="w-[30%] px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Email</th>
                            <th className="w-[20%] px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Department</th>
                            <th className="w-[20%] px-6 py-4 text-center text-xs font-semibold text-gray-600 uppercase tracking-wider">Action</th>
                          </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                          <AnimatePresence>
                            {availableEmployees.map((emp, index) => (
                              <motion.tr
                                key={emp.id || emp._id}
                                variants={itemVariants}
                                initial="hidden"
                                animate="visible"
                                exit="exit"
                                layout
                                className="hover:bg-emerald-50 transition-colors duration-150"
                                style={{ 
                                  transitionDelay: `${index * 30}ms` 
                                }}
                              >
                                <td className="px-6 py-4">
                                  <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center text-white font-bold text-sm shadow-md flex-shrink-0">
                                      {emp.name?.split(" ").map((n: string) => n[0]).join("").toUpperCase()}
                                    </div>
                                    <div className="font-medium text-gray-900 truncate">{emp.name || 'Unnamed'}</div>
                                  </div>
                                </td>
                                <td className="px-6 py-4">
                                  <div className="text-sm text-gray-600 truncate">{emp.email || '—'}</div>
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap">
                                  {emp.department ? (
                                    <Badge className="bg-emerald-100 text-emerald-800 hover:bg-emerald-200 font-medium">
                                      {emp.department}
                                    </Badge>
                                  ) : (
                                    <span className="text-sm text-gray-400">—</span>
                                  )}
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-center">
                                  <Button
                                    onClick={() => handleAddUser(emp)}
                                    size="sm"
                                    className="bg-gradient-to-r from-emerald-500 to-green-600 hover:from-emerald-600 hover:to-green-700 text-white font-semibold shadow-md transition-all duration-200 transform hover:scale-105"
                                  >
                                    Add
                                  </Button>
                                </td>
                              </motion.tr>
                            ))}
                          </AnimatePresence>
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <motion.div 
                      variants={itemVariants}
                      initial="hidden"
                      animate="visible"
                      className="text-center py-16"
                    >
                      <svg className="mx-auto h-16 w-16 text-gray-300 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                      </svg>
                      <p className="text-gray-400 text-lg font-medium">
                        {searchLeft ? 'No team members found' : 'All team members have been added'}
                      </p>
                      <p className="text-gray-400 text-sm mt-1">
                        {searchLeft ? 'Try adjusting your search terms' : 'Great! Everyone is included'}
                      </p>
                    </motion.div>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
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