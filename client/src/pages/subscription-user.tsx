import { useEffect, useMemo, useState, useRef } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useQuery } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { motion, AnimatePresence } from "framer-motion";
import { useToast } from "@/hooks/use-toast";
import { Download, Upload, FileSpreadsheet } from "lucide-react";
import Papa from 'papaparse';

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
  const navigate = useNavigate();
  const location = useLocation();

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
  const fileInputRef = useRef<HTMLInputElement>(null);

  // On initial mount and when subscriptionUsers changes, update selectedUsers
  useEffect(() => {
    if (Array.isArray(subscriptionUsers)) {
      setSelectedUsers(subscriptionUsers);
    }
  }, [subscriptionUsers]);

  // Download Template
  const handleDownloadTemplate = () => {
    const template = [
      { Name: 'John Doe', Email: 'john@example.com' },
      { Name: 'Jane Smith', Email: 'jane@example.com' }
    ];
    const csv = Papa.unparse(template);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', 'subscription_users_template.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    toast({
      title: 'Template Downloaded',
      description: 'Use this template to bulk import users',
    });
  };

  // Export current assigned users
  const handleExport = () => {
    if (!selectedUsers.length) {
      toast({
        title: 'No users to export',
        description: 'Add users first before exporting',
        variant: 'destructive'
      });
      return;
    }
    const exportData = selectedUsers.map(user => ({
      Name: user.name || '',
      Email: user.email || ''
    }));
    const csv = Papa.unparse(exportData);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `${subscriptionName}_users_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    toast({
      title: 'Exported',
      description: `${selectedUsers.length} users exported successfully`,
      variant: 'success'
    });
  };

  // Import users from CSV
  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        const rows: any[] = results.data as any[];
        if (!rows.length) {
          toast({
            title: 'Empty file',
            description: 'No rows found in file',
            variant: 'destructive'
          });
          return;
        }
        
        let added = 0;
        let skipped = 0;
        const mismatchErrors: string[] = [];
        const notFoundUsers: string[] = [];
        const duplicatesInCSV: string[] = [];
        const seenEmails = new Set<string>();
        
        rows.forEach((row, index) => {
          const email = (row.Email || row.email || '').trim().toLowerCase();
          const name = (row.Name || row.name || '').trim();
          
          if (!email || !name) {
            skipped++;
            notFoundUsers.push(name || email || 'Unknown');
            return;
          }
          
          // Check for duplicates within the CSV
          if (seenEmails.has(email)) {
            duplicatesInCSV.push(`${name} (${email}) on row ${index + 2}`);
            skipped++;
            return;
          }
          seenEmails.add(email);
          
          // Find employee by email
          const employee = employees.find(emp => 
            emp.email?.toLowerCase() === email
          );
          
          if (employee) {
            // Check if name also matches (trim both sides for comparison)
            const employeeName = (employee.name || '').trim().toLowerCase();
            const csvName = name.toLowerCase();
            
            if (employeeName === csvName) {
              const empId = employee.id || employee._id;
              // Check if not already added
              if (!selectedUsers.some(u => (u.id || u._id) === empId)) {
                setSelectedUsers(prev => [...prev, employee]);
                added++;
              } else {
                skipped++;
              }
            } else {
              // Email matches but name doesn't match
              mismatchErrors.push(`${name} (email: ${email}) - Found employee "${employee.name?.trim()}" with this email`);
              skipped++;
            }
          } else {
            // Email not found
            notFoundUsers.push(`${name} (${email})`);
            skipped++;
          }
        });
        
        // Show detailed error message
        if (duplicatesInCSV.length > 0 || mismatchErrors.length > 0 || notFoundUsers.length > 0) {
          let errorMsg = '';
          
          if (duplicatesInCSV.length > 0) {
            const dupList = duplicatesInCSV.slice(0, 3).join('; ');
            const moreCount = duplicatesInCSV.length > 3 ? ` and ${duplicatesInCSV.length - 3} more` : '';
            errorMsg += `Duplicate entries in CSV: ${dupList}${moreCount}. `;
          }
          
          if (mismatchErrors.length > 0) {
            const mismatchList = mismatchErrors.slice(0, 3).join('; ');
            const moreCount = mismatchErrors.length > 3 ? ` and ${mismatchErrors.length - 3} more` : '';
            errorMsg += `Name/Email mismatch: ${mismatchList}${moreCount}. `;
          }
          
          if (notFoundUsers.length > 0) {
            const notFoundList = notFoundUsers.slice(0, 3).join(', ');
            const moreCount = notFoundUsers.length > 3 ? ` and ${notFoundUsers.length - 3} more` : '';
            errorMsg += `Not found: ${notFoundList}${moreCount}.`;
          }
          
          toast({
            title: added > 0 ? 'Import Complete with Errors' : 'Import Failed',
            description: `Added ${added} users. ${skipped} skipped. ${errorMsg}`,
            variant: added === 0 ? 'destructive' : 'default'
          });
        } else {
          toast({
            title: 'Import Complete',
            description: `Added ${added} users successfully`,
            variant: 'success'
          });
        }
        
        e.target.value = '';
      },
      error: () => {
        toast({
          title: 'Import error',
          description: 'Failed to parse file',
          variant: 'destructive'
        });
      }
    });
  };

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

  // Add user - saves immediately to backend
  const handleAddUser = async (emp: any) => {
    const empId = emp.id || emp._id;
    
    // Check if already added
    if (selectedUsers.some((u) => (u.id || u._id) === empId)) return;
    
    // Optimistically update UI
    const newSelectedUsers = [...selectedUsers, emp];
    setSelectedUsers(newSelectedUsers);
    
    // Save to backend immediately
    if (!subscriptionId) {
      toast({
        title: "Error",
        description: "No subscription ID available.",
        variant: "destructive",
      });
      return;
    }
    
    try {
      const payload = {
        users: newSelectedUsers.map(user => ({
          id: user.id || user._id,
          name: user.name,
          email: user.email,
          role: user.role,
          department: user.department
        }))
      };
      
      console.log('Saving user to subscription:', subscriptionId, 'Payload:', payload);
      
      const response = await fetch(`/api/subscriptions/${subscriptionId}/users`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify(payload),
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error('Save failed:', response.status, errorText);
        throw new Error(`Failed to save: ${response.status}`);
      }
      
      const result = await response.json();
      console.log('Save successful:', result);
      
      toast({
        title: "Success",
        description: `${emp.name} added successfully.`,
        variant: "success",
      });
      
      await refetchSubscriptionUsers();
    } catch (error: unknown) {
      console.error("Error adding user:", error);
      // Revert on error
      setSelectedUsers(selectedUsers);
      toast({
        title: "Error",
        description: `Failed to add user: ${getErrorMessage(error)}`,
        variant: "destructive",
      });
    }
  };

  // Remove user - saves immediately to backend
  const handleRemoveUser = async (user: any) => {
    const userId = user.id || user._id;
    
    // Optimistically update UI
    const newSelectedUsers = selectedUsers.filter((u) => (u.id || u._id) !== userId);
    setSelectedUsers(newSelectedUsers);
    
    // Save to backend immediately
    if (!subscriptionId) {
      toast({
        title: "Error",
        description: "No subscription ID available.",
        variant: "destructive",
      });
      return;
    }
    
    try {
      const payload = {
        users: newSelectedUsers.map(u => ({
          id: u.id || u._id,
          name: u.name,
          email: u.email,
          role: u.role,
          department: u.department
        }))
      };
      
      const response = await fetch(`/api/subscriptions/${subscriptionId}/users`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify(payload),
      });
      
      if (!response.ok) {
        throw new Error(`Failed to save: ${response.status}`);
      }
      
      await response.json();
      toast({
        title: "Success",
        description: `${user.name} removed successfully.`,
        variant: "success",
      });
      
      await refetchSubscriptionUsers();
    } catch (error: unknown) {
      console.error("Error removing user:", error);
      // Revert on error
      setSelectedUsers(selectedUsers);
      toast({
        title: "Error",
        description: `Failed to remove user: ${getErrorMessage(error)}`,
        variant: "destructive",
      });
    }
  };

  // Add all users - saves immediately to backend
  const handleAddAll = async () => {
    if (!subscriptionId) {
      toast({
        title: "Error",
        description: "No subscription ID available.",
        variant: "destructive",
      });
      return;
    }
    
    // Calculate new users to add
    const newUsers = availableEmployees.filter((emp) => {
      const empId = emp.id || emp._id;
      return !selectedUsers.some((u) => (u.id || u._id) === empId);
    });
    
    if (newUsers.length === 0) {
      toast({
        title: "Info",
        description: "No new users to add.",
      });
      return;
    }
    
    // Optimistically update UI
    const newSelectedUsers = [...selectedUsers, ...newUsers];
    setSelectedUsers(newSelectedUsers);
    
    try {
      const payload = {
        users: newSelectedUsers.map(user => ({
          id: user.id || user._id,
          name: user.name,
          email: user.email,
          role: user.role,
          department: user.department
        }))
      };
      
      console.log('Adding all users to subscription:', subscriptionId, 'Count:', newUsers.length);
      
      const response = await fetch(`/api/subscriptions/${subscriptionId}/users`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify(payload),
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error('Add all failed:', response.status, errorText);
        throw new Error(`Failed to save: ${response.status}`);
      }
      
      const result = await response.json();
      console.log('Add all successful:', result);
      
      toast({
        title: "Success",
        description: `${newUsers.length} users added successfully.`,
        variant: "success",
      });
      
      await refetchSubscriptionUsers();
    } catch (error: unknown) {
      console.error("Error adding all users:", error);
      // Revert on error
      setSelectedUsers(selectedUsers);
      toast({
        title: "Error",
        description: `Failed to add users: ${getErrorMessage(error)}`,
        variant: "destructive",
      });
    }
  };

  // Remove all - saves immediately to backend
  const handleRemoveAll = async () => {
    if (!subscriptionId) {
      toast({
        title: "Error",
        description: "No subscription ID available.",
        variant: "destructive",
      });
      return;
    }
    
    if (selectedUsers.length === 0) {
      return;
    }
    
    // Optimistically update UI
    const previousUsers = [...selectedUsers];
    setSelectedUsers([]);
    
    try {
      const payload = {
        users: []
      };
      
      console.log('Removing all users from subscription:', subscriptionId);
      
      const response = await fetch(`/api/subscriptions/${subscriptionId}/users`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify(payload),
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error('Remove all failed:', response.status, errorText);
        throw new Error(`Failed to save: ${response.status}`);
      }
      
      const result = await response.json();
      console.log('Remove all successful:', result);
      
      toast({
        title: "Success",
        description: `All users removed successfully.`,
        variant: "success",
      });
      
      await refetchSubscriptionUsers();
    } catch (error: unknown) {
      console.error("Error removing all users:", error);
      // Revert on error
      setSelectedUsers(previousUsers);
      toast({
        title: "Error",
        description: `Failed to remove users: ${getErrorMessage(error)}`,
        variant: "destructive",
      });
    }
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
const response = await fetch(`/api/subscriptions/${subscriptionId}/users`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify(payload),
      });
if (!response.ok) {
        const errorText = await response.text();
        console.error("Error response:", errorText);
        throw new Error(`Failed to save: ${response.status} ${response.statusText} - ${errorText}`);
      }

      await response.json();
      toast({
        title: "Success",
        description: "Subscription users updated successfully.",
        variant: "success",
      });
      
      // Refetch to ensure data is up to date
      await refetchSubscriptionUsers();
      
      // Navigate back to subscriptions page with modal open
      navigate(`/subscriptions?open=${subscriptionId}`, { replace: true });
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
    const state = (location.state || {}) as {
      returnOpenSubscriptionId?: string;
      returnPath?: string;
    };

    const idToOpen = state.returnOpenSubscriptionId || subscriptionId;
    const returnPath = state.returnPath || "/subscriptions";

    // Navigate back to subscriptions and re-open the subscription modal.
    if (idToOpen) {
      navigate(`${returnPath}?open=${idToOpen}`, { replace: true });
      return;
    }

    navigate(returnPath, { replace: true });
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
    <div className="h-screen overflow-hidden bg-gradient-to-br from-indigo-50 to-blue-100 p-4 md:p-8">
      <div className="max-w-[100rem] mx-auto px-4 h-full flex flex-col">
        {/* Header */}
        <motion.div 
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="mb-4"
        >
          <div className="flex flex-col md:flex-row justify-between items-center gap-4 mb-4">
            <div className="text-center md:text-left">
              <h1 className="text-3xl md:text-4xl font-bold text-gray-800 mb-2">
                Manage Subscription Users
              </h1>
            </div>
            <Button
              onClick={handleExport}
              className="bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 text-white font-semibold shadow-md transition-all duration-300 transform hover:scale-105 px-6 py-3"
            >
              <Download className="w-4 h-4 mr-2" />
              Export
            </Button>
          </div>
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
                <h2 className="text-2xl font-bold text-gray-900 flex flex-nowrap items-center gap-2 min-w-0">
                  <span className="whitespace-nowrap">Users in</span>
                  <span className="text-indigo-600 truncate max-w-xs">{subscriptionName}</span>
                </h2>
              </div>
              <div className="flex gap-3">
                <div className="relative flex-1">
                  <Input
                    placeholder="Search users..."
                    value={searchRight}
                    onChange={(e) => setSearchRight(e.target.value)}
                    className="pl-10 h-11 border-gray-300 focus:border-indigo-500 focus:ring-indigo-500 rounded-lg shadow-sm"
                  />
                  <svg 
                    className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" 
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
                    className="bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white font-semibold shadow-md transition-all duration-300 transform hover:scale-105 h-11 px-5 whitespace-nowrap"
                  >
                    <svg 
                      className="w-4 h-4 mr-2" 
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
                    className="bg-gradient-to-r from-red-500 to-rose-600 hover:from-red-600 hover:to-rose-700 text-white font-semibold shadow-md transition-all duration-300 transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed h-11 px-5 whitespace-nowrap"
                    disabled={selectedUsers.length === 0}
                  >
                    Remove All
                  </Button>
                )}
              </div>
            </div>
            
            <div className="overflow-hidden max-h-[350px] overflow-y-auto">
              {filteredSelectedUsers.length > 0 ? (
                <div className="w-full">
                  <table className="w-full table-fixed">
                    <thead className="bg-gray-50 border-b-2 border-gray-200 sticky top-0 z-10">
                      <tr>
                        <th className="px-3 sm:px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider min-w-[120px]">User</th>
                        <th className="px-3 sm:px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider min-w-[100px]">Department</th>
                        <th className="px-3 sm:px-6 py-4 text-center text-xs font-semibold text-gray-600 uppercase tracking-wider min-w-[100px]">Action</th>
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
                            <td className="px-3 sm:px-6 py-4">
                              <div className="flex items-center gap-2 sm:gap-3">
                                <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white font-bold text-xs sm:text-sm shadow-md flex-shrink-0">
                                  {user.name?.split(" ").map((n: string) => n[0]).join("").toUpperCase()}
                                </div>
                                <div className="font-medium text-gray-900 truncate text-sm max-w-[150px]">{user.name || 'Unnamed'}</div>
                              </div>
                            </td>
                            <td className="px-3 sm:px-6 py-4 whitespace-nowrap">
                              {user.department ? (
                                <Badge className="bg-indigo-100 text-indigo-800 hover:bg-indigo-200 font-medium text-xs">
                                  {user.department}
                                </Badge>
                              ) : (
                                <span className="text-xs sm:text-sm text-gray-400">—</span>
                              )}
                            </td>
                            <td className="px-3 sm:px-6 py-4 whitespace-nowrap text-center">
                              <Button
                                onClick={() => handleRemoveUser(user)}
                                size="sm"
                                className="bg-gradient-to-r from-red-500 to-rose-600 hover:from-red-600 hover:to-rose-700 text-white font-semibold shadow-md transition-all duration-200 transform hover:scale-105 text-xs sm:text-sm px-2 sm:px-3"
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
          {showTeamMembers && (
            <div 
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
                      className="relative h-8 w-8 p-0 rounded-xl bg-red-500/20 hover:bg-red-500/30 backdrop-blur-sm border border-red-300/50 shadow-sm transition-all duration-200 hover:scale-105"
                    >
                      <svg 
                        className="w-5 h-5 text-red-600" 
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
                
                <div className="overflow-hidden max-h-[350px] overflow-y-auto scrollbar-hide">
                  {employeesLoading ? (
                    <div className="flex justify-center items-center h-64">
                      <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-emerald-500"></div>
                    </div>
                  ) : availableEmployees.length > 0 ? (
                    <div className="w-full overflow-x-auto">
                      <table className="w-full">
                        <thead className="bg-gray-50 border-b-2 border-gray-200 sticky top-0 z-10">
                          <tr>
                            <th className="px-3 sm:px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider min-w-[120px]">Team Member</th>
                            <th className="px-3 sm:px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider min-w-[100px]">Department</th>
                            <th className="px-3 sm:px-6 py-4 text-center text-xs font-semibold text-gray-600 uppercase tracking-wider min-w-[100px]">Action</th>
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
                                <td className="px-3 sm:px-6 py-4">
                                  <div className="flex items-center gap-2 sm:gap-3">
                                    <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center text-white font-bold text-xs sm:text-sm shadow-md flex-shrink-0">
                                      {emp.name?.split(" ").map((n: string) => n[0]).join("").toUpperCase()}
                                    </div>
                                    <div className="font-medium text-gray-900 truncate text-sm max-w-[150px]">{emp.name || 'Unnamed'}</div>
                                  </div>
                                </td>
                                <td className="px-3 sm:px-6 py-4 whitespace-nowrap">
                                  {emp.department ? (
                                    <Badge className="bg-emerald-100 text-emerald-800 hover:bg-emerald-200 font-medium text-xs">
                                      {emp.department}
                                    </Badge>
                                  ) : (
                                    <span className="text-xs sm:text-sm text-gray-400">—</span>
                                  )}
                                </td>
                                <td className="px-3 sm:px-6 py-4 whitespace-nowrap text-center">
                                  <Button
                                    onClick={() => handleAddUser(emp)}
                                    size="sm"
                                    className="bg-gradient-to-r from-emerald-500 to-green-600 hover:from-emerald-600 hover:to-green-700 text-white font-semibold shadow-md transition-all duration-200 transform hover:scale-105 text-xs sm:text-sm px-2 sm:px-3"
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
              </div>
            )}
        </div>

        {/* Bottom button */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.6 }}
          className="flex flex-col sm:flex-row justify-end gap-3 sm:gap-4 mt-4 px-2 mr-20"
        >
          <Button
            className="w-full sm:w-auto bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 text-white px-6 sm:px-8 py-3 text-base sm:text-lg font-semibold rounded-xl shadow-lg transition-all duration-300 transform hover:scale-105"
            onClick={handleCancel}
          >
            Back
          </Button>
        </motion.div>
      </div>
    </div>
  );
}