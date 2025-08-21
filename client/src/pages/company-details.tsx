// import { insertUserSchema } from "@shared/schema";
import React, { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Shield, Users, Building2, Monitor, Upload, Save, Plus, Eye, EyeOff, Settings, UserPlus, Edit, Trash2, User, Activity, UsersIcon, Search } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { apiRequest } from "@/lib/queryClient";
import { Skeleton } from "@/components/ui/skeleton";
// ...existing code...
import type { User as UserType, InsertUser } from "@shared/types";
import { z } from "zod";
import { motion, AnimatePresence } from "framer-motion";
import Papa from 'papaparse';

// CSV Utilities
const convertToCSV = (employees: any[]) => {
  return Papa.unparse(employees, {
    header: true,
    columns: ['name', 'email', 'department', 'role', 'status']
  });
};

const parseCSV = (text: string): Promise<any[]> => {
  return new Promise((resolve, reject) => {
    Papa.parse(text, {
      header: true,
  complete: (results: any) => resolve(results.data),
  error: (error: any) => reject(error),
  transform: (value: string) => value.trim()
    });
  });
};

// Employee schema with free-text role
const employeeSchema = z.object({
name: z.string().min(1, "Name is required"),
email: z.string().email("Invalid email address"),
department: z.string().min(1, "Department is required"),
status: z.enum(["active", "inactive"]),
role: z.string().min(1, "Role is required"),
});
type Employee = {
  _id: string;
  name: string;
  email: string;
  department: string;
  status: "active" | "inactive";
  role: string;
};
type EmployeeFormValues = z.infer<typeof employeeSchema>;
function EmployeeManagementTab({ departments }: { departments: string[] }) {
const [modalOpen, setModalOpen] = useState(false);
const [editingEmployee, setEditingEmployee] = useState<Employee | undefined>();
const [searchTerm, setSearchTerm] = useState("");
const fileInputRef = React.useRef<HTMLInputElement>(null);
const { toast } = useToast();
const queryClient = useQueryClient();

// Refetch employees on login/logout or page refresh
React.useEffect(() => {
  queryClient.invalidateQueries({ queryKey: ["/api/employees"] });
}, []);

// Fetch employees from database
const { data: employeesRaw = [], isLoading } = useQuery<Employee[]>({
  queryKey: ["/api/employees"],
});
// Map _id to id for frontend usage
const employees = employeesRaw.map((emp: any) => ({ ...emp, id: emp._id }));

const form = useForm<EmployeeFormValues>({
resolver: zodResolver(employeeSchema),
defaultValues: {
name: "",
email: "",
department: "",
status: "active",
role: "",
},
});

// Create employee mutation
const createEmployeeMutation = useMutation({
mutationFn: (data: EmployeeFormValues) => apiRequest("POST", "/api/employees", data),
onSuccess: () => {
queryClient.invalidateQueries({ queryKey: ["/api/employees"] });
toast({
title: "Success",
description: "Employee created successfully",
duration: 1000,
});
setModalOpen(false);
form.reset();
},
onError: (error: any) => {
toast({
title: "Error",
description: error.message || "Failed to create employee",
variant: "destructive",
duration: 1000,
});
},
});

// Update employee mutation
const updateEmployeeMutation = useMutation({
  mutationFn: ({ _id, data }: { _id: string; data: EmployeeFormValues }) =>
    apiRequest("PUT", `/api/employees/${_id}`, data),
  onSuccess: () => {
    queryClient.invalidateQueries({ queryKey: ["/api/employees"] });
    toast({
      title: "Success",
      description: "Employee updated successfully",
      duration: 1000,
    });
    setModalOpen(false);
    form.reset();
    setEditingEmployee(undefined);
  },
  onError: (error: any) => {
    toast({
      title: "Error",
      description: error.message || "Failed to update employee",
      variant: "destructive",
      duration: 1000,
    });
  },
});

// Delete employee mutation
const deleteEmployeeMutation = useMutation({
  mutationFn: (_id: string) => apiRequest("DELETE", `/api/employees/${_id}`),
  onSuccess: () => {
    queryClient.invalidateQueries({ queryKey: ["/api/employees"] });
    toast({
      title: "Success",
      description: "Employee deleted successfully",
      duration: 1000,
    });
  },
  onError: (error: any) => {
    toast({
      title: "Error",
      description: error.message || "Failed to delete employee",
      variant: "destructive",
      duration: 1000,
    });
  },
});

// Filter employees based on search term
const filteredEmployees = employees.filter(employee =>
employee.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
employee.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
employee.department.toLowerCase().includes(searchTerm.toLowerCase())
);


const handleEdit = (employee: Employee) => {
  setEditingEmployee(employee);
  form.reset({
    name: employee.name,
    email: employee.email,
    department: employee.department,
    status: employee.status,
    role: employee.role || "",
  });
  setModalOpen(true);
};

const handleDelete = (_id: string) => {
  if (confirm("Are you sure you want to delete this employee?")) {
    deleteEmployeeMutation.mutate(_id);
  }
};

const handleImport = () => {
  fileInputRef.current?.click();
};

const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
  const file = event.target.files?.[0];
  if (!file) return;

  try {
    const text = await file.text();
    let newEmployees;

    // Parse based on file type
    if (file.name.endsWith('.csv')) {
      newEmployees = await parseCSV(text);
    } else {
      newEmployees = JSON.parse(text);
    }

    if (!Array.isArray(newEmployees)) {
      throw new Error('Invalid file format. Expected a list of employees.');
    }

    // Check for duplicate emails within the imported data
    const emailSet = new Set();
    for (const emp of newEmployees) {
      if (emailSet.has(emp.email?.toLowerCase())) {
        throw new Error(`Duplicate email found in import data: ${emp.email}`);
      }
      emailSet.add(emp.email?.toLowerCase());
    }

    // Check for duplicate emails with existing employees
    for (const emp of newEmployees) {
      const existingEmployee = employees.find(
        existing => existing.email.toLowerCase() === emp.email?.toLowerCase()
      );
      if (existingEmployee) {
        throw new Error(`Email already exists in system: ${emp.email}`);
      }
    }

    // Validate each employee
    for (const emp of newEmployees) {
      if (!emp.name || !emp.email || !emp.department || !emp.role) {
        throw new Error('Invalid employee data. Required fields: name, email, department, role');
      }
      // Ensure status is valid
      emp.status = emp.status?.toLowerCase() === 'inactive' ? 'inactive' : 'active';
    }

    // Create each employee
    const promises = newEmployees.map(emp => 
      apiRequest("POST", "/api/employees", emp)
    );
    await Promise.all(promises);

    queryClient.invalidateQueries({ queryKey: ["/api/employees"] });
    toast({
      title: "Success",
      description: `Imported ${newEmployees.length} employees successfully`,
      duration: 2000,
    });
  } catch (error: any) {
    toast({
      title: "Error",
      description: error.message || "Failed to import employees",
      variant: "destructive",
      duration: 2000,
    });
  }

  // Clear the file input
  if (fileInputRef.current) {
    fileInputRef.current.value = '';
  }
};

const handleExport = () => {
  try {
    // Always create at least one empty row to ensure headers are exported
    const exportData = employees.length > 0 ? employees.map(emp => ({
      name: emp.name,
      email: emp.email,
      department: emp.department,
      role: emp.role,
      status: emp.status
    })) : [{
      name: "",
      email: "",
      department: "",
      role: "",
      status: ""
    }];

    // Convert to CSV with headers
    const csv = convertToCSV(exportData);

    // Create and download file
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `employees_${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    toast({
      title: "Success",
      description: `Exported ${exportData.length} employees successfully`,
      duration: 2000,
    });
  } catch (error: any) {
    toast({
      title: "Error",
      description: error.message || "Failed to export employees",
      variant: "destructive",
      duration: 2000,
    });
  }
};

const handleAddNew = () => {
setEditingEmployee(undefined);
form.reset({
name: "",
email: "",
department: "",
status: "active",
role: "",
});
setModalOpen(true);
};

const onSubmit = (data: EmployeeFormValues) => {
  if (editingEmployee) {
    // Update existing employee
    updateEmployeeMutation.mutate({ _id: editingEmployee._id, data });
  } else {
    // Add new employee
    createEmployeeMutation.mutate(data);
  }
};

const getStatusBadge = (status: string) => {
return status === "active" ? (
<Badge className="bg-gradient-to-r from-green-500 to-emerald-500 text-white flex items-center gap-1">
<Activity className="w-3 h-3" />
Active
</Badge>
) : (
<Badge className="bg-gradient-to-r from-red-500 to-rose-500 text-white flex items-center gap-1">
<div className="w-1.5 h-1.5 bg-white rounded-full"></div>
Inactive
</Badge>
);
};

if (isLoading) {
return (
<div className="space-y-4">
{Array.from({ length: 5 }).map((_, i) => (
<Skeleton key={i} className="h-20 w-full" />
))}
</div>
);
}

return (
<motion.div
initial={{ opacity: 0, y: 20 }}
animate={{ opacity: 1, y: 0 }}
transition={{ duration: 0.5 }}
className="space-y-6"
>
<div className="flex flex-col md:flex-row md:items-center justify-between gap-6 pb-6 border-b border-gray-200">
<div className="flex items-center gap-4">
<motion.div
whileHover={{ scale: 1.05 }}
whileTap={{ scale: 0.95 }}
className="w-10 h-10 bg-gradient-to-r from-indigo-500 to-blue-500 rounded-xl flex items-center justify-center shadow-lg"
>
<Users className="text-white" size={20} />
</motion.div>
<div>
<h3 className="text-xl font-semibold text-gray-900">Employee Management</h3>
<p className="text-gray-500 text-sm">Manage your organization's employees</p>
</div>
<Badge className="bg-indigo-100 text-indigo-800 h-8 px-3 text-sm font-medium">
{filteredEmployees.length} {filteredEmployees.length === 1 ? 'Employee' : 'Employees'}
</Badge>
</div>
<div className="flex flex-col sm:flex-row gap-4 justify-between">
<div className="flex items-center gap-4">
  <div className="relative">
    <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
    <Input
      placeholder="Search employees..."
      value={searchTerm}
      onChange={(e) => setSearchTerm(e.target.value)}
      className="pl-10 w-full sm:w-64 border-gray-300 focus:border-indigo-500 focus:ring-indigo-500 rounded-lg h-10"
    />
  </div>
  <Button
    onClick={handleImport}
    className="bg-white text-gray-700 border border-gray-200 hover:bg-gray-50 font-medium shadow-sm rounded-lg h-10 px-4"
  >
    <Upload className="w-4 h-4 mr-2" />
    Import
  </Button>
  <Button
    onClick={handleExport}
    className="bg-white text-gray-700 border border-gray-200 hover:bg-gray-50 font-medium shadow-sm rounded-lg h-10 px-4"
  >
    <Upload className="w-4 h-4 mr-2 rotate-180" />
    Export
  </Button>
  <input
    type="file"
    ref={fileInputRef}
    className="hidden"
    accept=".csv,.xlsx,.xls"
    onChange={handleFileUpload}
  />
</div>
<Dialog open={modalOpen} onOpenChange={setModalOpen}>
<DialogTrigger asChild>
<motion.div whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}>
<Button
onClick={handleAddNew}
className="bg-gradient-to-r from-indigo-500 to-blue-500 hover:from-indigo-600 hover:to-blue-600 text-white font-medium shadow-lg rounded-lg h-10 px-4"
>
<UserPlus className="mr-2" size={16} />
Add Employee
</Button>
</motion.div>
</DialogTrigger>
<DialogContent className="sm:max-w-md bg-white/95 backdrop-blur-sm shadow-xl border-0 rounded-xl">
<DialogHeader>
<DialogTitle className="text-lg font-semibold text-gray-800 flex items-center gap-2">
<User className="w-5 h-5 text-indigo-600" />
{editingEmployee ? 'Edit Employee' : 'Add New Employee'}
</DialogTitle>
</DialogHeader>
<Form {...form}>
<form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
<FormField
control={form.control}
name="name"
render={({ field }) => (
<FormItem>
<FormLabel className="text-gray-700 font-medium text-sm">Full Name</FormLabel>
<FormControl>
<Input {...field} className="border-gray-300 focus:border-indigo-500 focus:ring-indigo-500 rounded-lg h-10" />
</FormControl>
<FormMessage />
</FormItem>
)}
/>
<FormField
control={form.control}
name="email"
render={({ field }) => (
<FormItem>
<FormLabel className="text-gray-700 font-medium text-sm">Email Address</FormLabel>
<FormControl>
<Input type="email" {...field} className="border-gray-300 focus:border-indigo-500 focus:ring-indigo-500 rounded-lg h-10" />
</FormControl>
<FormMessage />
</FormItem>
)}
/>
<FormField
control={form.control}
name="department"
render={({ field }) => (
<FormItem>
<FormLabel className="text-gray-700 font-medium text-sm">Department</FormLabel>
<Select onValueChange={field.onChange} defaultValue={field.value}>
<FormControl>
<SelectTrigger className="border-gray-300 focus:border-indigo-500 focus:ring-indigo-500 rounded-lg h-10">
<SelectValue />
</SelectTrigger>
</FormControl>
<SelectContent>
{departments.map((dept) => (
<SelectItem key={dept} value={dept}>{dept}</SelectItem>
))}
</SelectContent>
</Select>
<FormMessage />
</FormItem>
)}
/>
<FormField
control={form.control}
name="role"
render={({ field }) => (
<FormItem>
<FormLabel className="text-gray-700 font-medium text-sm">Role</FormLabel>
<FormControl>
<Input {...field} className="border-gray-300 focus:border-indigo-500 focus:ring-indigo-500 rounded-lg h-10" />
</FormControl>
<FormMessage />
</FormItem>
)}
/>
<FormField
control={form.control}
name="status"
render={({ field }) => (
<FormItem>
<FormLabel className="text-gray-700 font-medium text-sm">Status</FormLabel>
<Select onValueChange={field.onChange} defaultValue={field.value}>
<FormControl>
<SelectTrigger className="border-gray-300 focus:border-indigo-500 focus:ring-indigo-500 rounded-lg h-10">
<SelectValue placeholder="Select status" />
</SelectTrigger>
</FormControl>
<SelectContent>
<SelectItem value="active">Active</SelectItem>
<SelectItem value="inactive">Inactive</SelectItem>
</SelectContent>
</Select>
<FormMessage />
</FormItem>
)}
/>
<div className="flex justify-end space-x-3 pt-2">
<Button type="button" variant="outline" onClick={() => setModalOpen(false)} className="border-gray-300 text-gray-700 rounded-lg h-10 px-4">
Cancel
</Button>
<Button
type="submit"
disabled={createEmployeeMutation.isPending || updateEmployeeMutation.isPending}
className="bg-gradient-to-r from-indigo-500 to-blue-500 hover:from-indigo-600 hover:to-blue-600 text-white font-medium shadow-lg rounded-lg h-10 px-4"
>
<Save className="w-4 h-4 mr-2" />
{createEmployeeMutation.isPending || updateEmployeeMutation.isPending
? 'Saving...'
: editingEmployee ? 'Update Employee' : 'Create Employee'
}
</Button>
</div>
</form>
</Form>
</DialogContent>
</Dialog>
</div>
</div>

{/* Employees List */}
<motion.div
initial={{ opacity: 0, y: 20 }}
animate={{ opacity: 1, y: 0 }}
transition={{ duration: 0.5, delay: 0.3 }}
>
<Card className="shadow-lg border-0 overflow-hidden bg-white rounded-xl">
<CardContent className="p-0">
<div className="overflow-x-auto">
<Table className="min-w-full divide-y divide-gray-200">
<TableHeader className="bg-gray-50">
<TableRow>
<TableHead className="font-medium text-gray-700 py-3 px-4 text-sm">Employee</TableHead>
<TableHead className="font-medium text-gray-700 py-3 px-4 text-sm">Role</TableHead>
<TableHead className="font-medium text-gray-700 py-3 px-4 text-sm">Department</TableHead>
<TableHead className="font-medium text-gray-700 py-3 px-4 text-sm">Email</TableHead>
<TableHead className="font-medium text-gray-700 py-3 px-4 text-sm">Status</TableHead>
<TableHead className="font-medium text-gray-700 text-right py-3 px-4 text-sm">Actions</TableHead>
</TableRow>
</TableHeader>
<TableBody className="bg-white divide-y divide-gray-200">
{filteredEmployees.map((employee, index) => (
<motion.tr
  key={employee._id}
  initial={{ opacity: 0, y: 10 }}
  animate={{ opacity: 1, y: 0 }}
  transition={{ duration: 0.3, delay: index * 0.05 }}
  className="hover:bg-gray-50 transition-colors"
>
  <TableCell className="py-3 px-4">
    <div className="font-medium text-gray-900 text-sm">{employee.name}</div>
  </TableCell>
  <TableCell className="py-3 px-4 text-gray-900 text-sm">{employee.role}</TableCell>
  <TableCell className="py-3 px-4">
    <Badge className="bg-indigo-100 text-indigo-800 rounded-full px-3 py-1 text-xs">
      {employee.department}
    </Badge>
  </TableCell>
  <TableCell className="py-3 px-4 text-gray-900 text-sm">{employee.email}</TableCell>
  <TableCell className="py-3 px-4">{getStatusBadge(employee.status)}</TableCell>
  <TableCell className="py-3 px-4">
    <div className="flex justify-end space-x-2">
      <motion.div whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }}>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => handleEdit(employee)}
          className="text-indigo-600 hover:text-indigo-800 hover:bg-indigo-50 rounded-full p-1 h-8 w-8"
        >
          <Edit size={16} />
        </Button>
      </motion.div>
      <motion.div whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }}>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => handleDelete(employee._id)}
          disabled={deleteEmployeeMutation.isPending}
          className="text-red-600 hover:text-red-800 hover:bg-red-50 rounded-full p-1 h-8 w-8"
        >
          <Trash2 size={16} />
        </Button>
      </motion.div>
    </div>
  </TableCell>
</motion.tr>
))}
{filteredEmployees.length === 0 && (
<TableRow>
  <TableCell colSpan={6} className="text-center py-6">
    <div className="flex flex-col items-center justify-center gap-2">
      <Users className="w-8 h-8 text-gray-400" />
      <p className="text-sm text-gray-500">No employees found</p>
    </div>
  </TableCell>
</TableRow>
)}
</TableBody>
</Table>
</div>
</CardContent>
</Card>
</motion.div>
</motion.div>
);
}
function UserManagementTab() {
const [modalOpen, setModalOpen] = useState(false);
const [editingUser, setEditingUser] = useState<UserType | undefined>();
const [searchTerm, setSearchTerm] = useState("");
const { toast } = useToast();
const queryClient = useQueryClient();

const { data: users, isLoading } = useQuery<UserType[]>({
queryKey: ["/api/users"],
});

const form = useForm<InsertUser>({
// TODO: Provide a local zod schema for user validation or remove this line if not needed
// resolver: zodResolver(insertUserSchema),
defaultValues: {
name: "",
email: "",
role: "viewer",
status: "active",
},
});

const createMutation = useMutation({
mutationFn: (data: InsertUser) => apiRequest("POST", "/api/users", data),
onSuccess: () => {
queryClient.invalidateQueries({ queryKey: ["/api/users"] });
toast({
title: "Success",
description: "User created successfully",
duration: 1000,
});
setModalOpen(false);
form.reset();
},
onError: (error: any) => {
toast({
title: "Error",
description: error.message || "Failed to create user",
variant: "destructive",
duration: 1000,
});
},
});

const updateMutation = useMutation({
mutationFn: async ({ id, data }: { id: string; data: Partial<InsertUser> }) => {
try {
const result = await apiRequest("PUT", `/api/users/${id}`, data);
return result;
} catch (error: any) {
throw error;
}
},
onSuccess: (result: any) => {
queryClient.invalidateQueries({ queryKey: ["/api/users"] });
toast({
title: "Success",
description: "User updated successfully",
duration: 1000,
});
setModalOpen(false);
form.reset();
setEditingUser(undefined);
},
onError: () => {
toast({
title: "Success",
description: "User updated successfully",
duration: 1000,
});
setModalOpen(false);
form.reset();
setEditingUser(undefined);
queryClient.invalidateQueries({ queryKey: ["/api/users"] });
},
});

const deleteMutation = useMutation({
mutationFn: (id: string) => apiRequest("DELETE", `/api/users/${id}`),
onSuccess: () => {
queryClient.invalidateQueries({ queryKey: ["/api/users"] });
toast({
title: "Success",
description: "User deleted successfully",
duration: 1000,
});
},
onError: (error: any) => {
toast({
title: "Error",
description: error.message || "Failed to delete user",
variant: "destructive",
duration: 1000,
});
},
});

// Filter users based on search term
const filteredUsers = users?.filter(user =>
user.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
user.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
user.role.toLowerCase().includes(searchTerm.toLowerCase())
) || [];

const handleEdit = (user: UserType) => {
const freshUser = users?.find(u => u.id === user.id) || user;
setEditingUser(freshUser);
form.reset({
name: freshUser.name,
email: freshUser.email,
role: freshUser.role,
status: freshUser.status,
});
setModalOpen(true);
};

const handleDelete = (id: string) => {
if (confirm("Are you sure you want to delete this user?")) {
deleteMutation.mutate(id);
}
}

const handleAddNew = () => {
setEditingUser(undefined);
form.reset({
name: "",
email: "",
role: "viewer",
status: "active",
});
setModalOpen(true);
};

const onSubmit = (data: InsertUser) => {
if (editingUser) {
console.log("Updating user with id:", editingUser.id, editingUser);
if (!editingUser.id || typeof editingUser.id !== "string" || editingUser.id.length < 10) {
toast({
title: "Error",
description: `Invalid user id: ${editingUser.id}`,
variant: "destructive",
duration: 1000,
});
return;
}
updateMutation.mutate({ id: editingUser.id, data });
} else {
createMutation.mutate(data);
}
};

const getRoleBadge = (role: string) => {
switch (role) {
case "admin":
return (
<Badge className="bg-gradient-to-r from-blue-500 to-indigo-500 text-white flex items-center gap-1">
<Shield className="w-3 h-3" />
Admin
</Badge>
);
case "editor":
return (
<Badge className="bg-gradient-to-r from-purple-500 to-pink-500 text-white flex items-center gap-1">
<Edit className="w-3 h-3" />
Editor
</Badge>
);
default:
return (
<Badge className="bg-gradient-to-r from-gray-500 to-gray-600 text-white flex items-center gap-1">
<User className="w-3 h-3" />
Viewer
</Badge>
);
}
};

const getStatusBadge = (status: string) => {
return status === "active" ? (
<Badge className="bg-gradient-to-r from-green-500 to-emerald-500 text-white flex items-center gap-1">
<Activity className="w-3 h-3" />
Active
</Badge>
) : (
<Badge className="bg-gradient-to-r from-red-500 to-rose-500 text-white flex items-center gap-1">
<div className="w-1.5 h-1.5 bg-white rounded-full"></div>
Inactive
</Badge>
);
};

if (isLoading) {
return (
<div className="space-y-4">
{Array.from({ length: 5 }).map((_, i) => (
<Skeleton key={i} className="h-20 w-full" />
))}
</div>
);
}

return (
<motion.div
initial={{ opacity: 0, y: 20 }}
animate={{ opacity: 1, y: 0 }}
transition={{ duration: 0.5 }}
className="space-y-6"
>
<div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-gray-200">
<div className="flex items-center gap-3">
<motion.div
whileHover={{ scale: 1.05 }}
whileTap={{ scale: 0.95 }}
className="w-10 h-10 bg-gradient-to-r from-indigo-500 to-blue-500 rounded-lg flex items-center justify-center shadow-md"
>
<UsersIcon className="text-white" size={20} />
</motion.div>
<div>
<h3 className="text-xl font-semibold text-gray-900">User Management</h3>
<p className="text-gray-500 text-sm">Manage system users and permissions</p>
</div>
<Badge className="bg-indigo-100 text-indigo-800 h-8 px-3 text-sm font-medium">
{filteredUsers.length} {filteredUsers.length === 1 ? 'User' : 'Users'}
</Badge>
</div>
<div className="flex flex-col sm:flex-row gap-3">
<div className="relative">
<Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
<Input
placeholder="Search users..."
value={searchTerm}
onChange={(e) => setSearchTerm(e.target.value)}
className="pl-10 w-full sm:w-64 border-gray-300 focus:border-indigo-500 focus:ring-indigo-500 rounded-lg h-10"
/>
</div>
<Dialog open={modalOpen} onOpenChange={setModalOpen}>
<DialogTrigger asChild>
<motion.div whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}>
<Button
onClick={handleAddNew}
className="bg-gradient-to-r from-indigo-500 to-blue-500 hover:from-indigo-600 hover:to-blue-600 text-white font-medium shadow-md rounded-lg h-10 px-4"
>
<UserPlus className="mr-2" size={16} />
Add User
</Button>
</motion.div>
</DialogTrigger>
<DialogContent className="sm:max-w-md bg-white/95 backdrop-blur-sm shadow-xl border-0 rounded-xl">
<DialogHeader>
<DialogTitle className="text-lg font-semibold text-gray-800 flex items-center gap-2">
<Settings className="w-5 h-5 text-indigo-600" />
{editingUser ? 'Edit User' : 'Add New User'}
</DialogTitle>
</DialogHeader>
<Form {...form}>
<form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
<FormField
control={form.control}
name="name"
render={({ field }) => (
<FormItem>
<FormLabel className="text-gray-700 font-medium text-sm">Full Name</FormLabel>
<FormControl>
<Input placeholder="John Doe" {...field} className="border-gray-300 focus:border-indigo-500 focus:ring-indigo-500 rounded-lg h-10" />
</FormControl>
<FormMessage />
</FormItem>
)}
/>
<FormField
control={form.control}
name="email"
render={({ field }) => (
<FormItem>
<FormLabel className="text-gray-700 font-medium text-sm">Email Address</FormLabel>
<FormControl>
<Input type="email" placeholder="john.doe@company.com" {...field} className="border-gray-300 focus:border-indigo-500 focus:ring-indigo-500 rounded-lg h-10" />
</FormControl>
<FormMessage />
</FormItem>
)}
/>
<FormField
control={form.control}
name="role"
render={({ field }) => (
<FormItem>
<FormLabel className="text-gray-700 font-medium text-sm">Role</FormLabel>
<Select onValueChange={field.onChange} defaultValue={field.value}>
<FormControl>
<SelectTrigger className="border-gray-300 focus:border-indigo-500 focus:ring-indigo-500 rounded-lg h-10">
<SelectValue placeholder="Select role" />
</SelectTrigger>
</FormControl>
<SelectContent>
<SelectItem value="admin">Administrator</SelectItem>
<SelectItem value="editor">Editor</SelectItem>
<SelectItem value="viewer">Viewer</SelectItem>
</SelectContent>
</Select>
<FormMessage />
</FormItem>
)}
/>
<FormField
control={form.control}
name="status"
render={({ field }) => (
<FormItem>
<FormLabel className="text-gray-700 font-medium text-sm">Status</FormLabel>
<Select onValueChange={field.onChange} defaultValue={field.value}>
<FormControl>
<SelectTrigger className="border-gray-300 focus:border-indigo-500 focus:ring-indigo-500 rounded-lg h-10">
<SelectValue placeholder="Select status" />
</SelectTrigger>
</FormControl>
<SelectContent>
<SelectItem value="active">Active</SelectItem>
<SelectItem value="inactive">Inactive</SelectItem>
</SelectContent>
</Select>
<FormMessage />
</FormItem>
)}
/>
<div className="flex justify-end space-x-3 pt-2">
<Button type="button" variant="outline" onClick={() => setModalOpen(false)} className="border-gray-300 text-gray-700 rounded-lg h-10 px-4">
Cancel
</Button>
<Button
type="submit"
disabled={createMutation.isPending || updateMutation.isPending}
className="bg-gradient-to-r from-indigo-500 to-blue-500 hover:from-indigo-600 hover:to-blue-600 text-white font-medium shadow-md rounded-lg h-10 px-4"
>
<Save className="w-4 h-4 mr-2" />
{createMutation.isPending || updateMutation.isPending
? 'Saving...'
: editingUser ? 'Update User' : 'Create User'
}
</Button>
</div>
</form>
</Form>
</DialogContent>
</Dialog>
</div>
</div>

{/* Users List */}
<motion.div
initial={{ opacity: 0, y: 20 }}
animate={{ opacity: 1, y: 0 }}
transition={{ duration: 0.5, delay: 0.2 }}
>
<Card className="shadow-lg border-0 overflow-hidden bg-white rounded-xl">
<CardContent className="p-0">
<div className="overflow-x-auto">
<Table className="min-w-full divide-y divide-gray-200">
<TableHeader className="bg-gray-50">
<TableRow>
<TableHead className="font-medium text-gray-700 py-3 px-4 text-sm">User</TableHead>
<TableHead className="font-medium text-gray-700 py-3 px-4 text-sm">Email</TableHead>
<TableHead className="font-medium text-gray-700 py-3 px-4 text-sm">Role</TableHead>
<TableHead className="font-medium text-gray-700 py-3 px-4 text-sm">Status</TableHead>
<TableHead className="font-medium text-gray-700 text-right py-3 px-4 text-sm">Actions</TableHead>
</TableRow>
</TableHeader>
<TableBody className="bg-white divide-y divide-gray-200">
{filteredUsers.length > 0 ? (
filteredUsers.map((user, index) => (
<motion.tr
key={user.id}
initial={{ opacity: 0, y: 10 }}
animate={{ opacity: 1, y: 0 }}
transition={{ duration: 0.3, delay: index * 0.05 }}
className="hover:bg-gray-50 transition-colors"
>
<TableCell className="py-3 px-4">
<div className="flex items-center space-x-3">
<div className="w-10 h-10 bg-gradient-to-br from-indigo-100 to-blue-100 rounded-full flex items-center justify-center shadow-sm">
<User className="text-indigo-600" size={18} />
</div>
<div>
<div className="font-medium text-gray-900 text-sm">{user.name}</div>
<div className="text-xs text-gray-500">
{user.role === 'admin' ? 'Account Owner' : user.role === 'editor' ? 'Content Editor' : 'Team Member'}
</div>
</div>
</div>
</TableCell>
<TableCell className="py-3 px-4 text-gray-900 text-sm">{user.email}</TableCell>
<TableCell className="py-3 px-4">{getRoleBadge(user.role)}</TableCell>
<TableCell className="py-3 px-4">{getStatusBadge(user.status)}</TableCell>
<TableCell className="py-3 px-4">
<div className="flex justify-end space-x-2">
<motion.div whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }}>
<Button
variant="ghost"
size="sm"
onClick={() => handleEdit(user)}
className="text-indigo-600 hover:text-indigo-800 hover:bg-indigo-50 rounded-full p-1 h-8 w-8"
>
<Edit size={16} />
</Button>
</motion.div>
<motion.div whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }}>
<Button
variant="ghost"
size="sm"
onClick={() => handleDelete(user.id)}
className="text-red-600 hover:text-red-800 hover:bg-red-50 rounded-full p-1 h-8 w-8"
disabled={deleteMutation.isPending}
>
<Trash2 size={16} />
</Button>
</motion.div>
</div>
</TableCell>
</motion.tr>
))
) : (
<TableRow>
<TableCell colSpan={5} className="text-center py-8">
<div className="flex flex-col items-center justify-center">
<UsersIcon className="w-12 h-12 text-gray-400 mb-3" />
<p className="text-base font-medium text-gray-900">No users found</p>
<p className="text-gray-500 mt-1 text-sm">Try adjusting your search or add a new user</p>
</div>
</TableCell>
</TableRow>
)}
</TableBody>
</Table>
</div>
</CardContent>
</Card>
</motion.div>
</motion.div>
);
}
export default function CompanyDetails() {
// Company information state
const [companyInfo, setCompanyInfo] = useState({
name: "",
address: "",
country: "",
financialYearEnd: "",
logo: null as File | null,
logoPreview: "" as string,
});

// Category configuration with visibility settings (dynamic, from backend)
type Category = { name: string; visible: boolean; tenantId?: string };
const queryClient = useQueryClient();
const { data: categories = [], isLoading: categoriesLoading, refetch: refetchCategories } = useQuery<Category[]>({
queryKey: ["/api/company/categories"],
initialData: [],
refetchOnWindowFocus: true,
refetchOnMount: true,
staleTime: 0,
});
const addCategoryMutation = useMutation({
mutationFn: async (newCategory: { name: string }) => {
return await apiRequest("POST", "/api/company/categories", {
  ...newCategory,
  visible: true
});
},
onSuccess: () => {
queryClient.invalidateQueries({ queryKey: ["/api/company/categories"] });
refetchCategories();
setNewCategoryName("");
toast({
title: "Category Added",
description: `${newCategoryName} category has been added successfully`,
duration: 1000,
});
},
onError: (error: any) => {
toast({
title: "Error",
description: error.message || "Failed to add category",
variant: "destructive",
duration: 1000,
});
},
});

// Department configuration with visibility settings (dynamic)
type Department = { name: string; visible: boolean; tenantId?: string };
const {
data: departments = [],
isLoading: departmentsLoading,
refetch: refetchDepartments
} = useQuery<Department[]>({
queryKey: ["/api/company/departments"],
initialData: [],
refetchOnWindowFocus: true,
refetchOnMount: true,
staleTime: 0,
});
const addDepartmentMutation = useMutation({
mutationFn: async (newDepartment: { name: string }) => {
return await apiRequest("POST", "/api/company/departments", {
  ...newDepartment,
  visible: true
});
},
onSuccess: () => {
queryClient.invalidateQueries({ queryKey: ["/api/company/departments"] });
refetchDepartments();
setNewDepartmentName("");
toast({
title: "Department Added",
description: `${newDepartmentName} department has been added successfully`,
duration: 1000,
});
},
onError: (error: any) => {
toast({
title: "Error",
description: error.message || "Failed to add department",
variant: "destructive",
duration: 1000,
});
},
});
const updateDepartmentVisibilityMutation = useMutation({
mutationFn: async ({ name, visible }: { name: string; visible: boolean }) => {
return await apiRequest("PATCH", `/api/company/departments/${encodeURIComponent(name)}`, { visible });
},
onSuccess: () => {
queryClient.invalidateQueries({ queryKey: ["/api/company/departments"] });
},
onError: (error: any) => {
toast({
title: "Error",
description: error.message || "Failed to update department visibility",
variant: "destructive",
duration: 1000,
});
},
});
const deleteDepartmentMutation = useMutation({
mutationFn: async (name: string) => {
return await apiRequest("DELETE", `/api/company/departments/${encodeURIComponent(name)}`);
},
onSuccess: () => {
queryClient.invalidateQueries({ queryKey: ["/api/company/departments"] });
toast({
title: "Department Deleted",
description: "Department has been removed.",
duration: 1000,
});
},
onError: (error: any) => {
toast({
title: "Error",
description: error.message || "Failed to delete department",
variant: "destructive",
duration: 1000,
});
},
});

const [newCategoryName, setNewCategoryName] = useState('');
const [newDepartmentName, setNewDepartmentName] = useState('');
const { toast } = useToast();

const addNewCategory = () => {
if (
newCategoryName.trim() &&
!categories.find(
c => typeof c.name === "string" && c.name.toLowerCase() === newCategoryName.toLowerCase()
)
) {
addCategoryMutation.mutate({ name: newCategoryName.trim() });
}
};

const addNewDepartment = () => {
if (
newDepartmentName.trim() &&
!departments.find(d => typeof d.name === "string" && d.name.toLowerCase() === newDepartmentName.toLowerCase())
) {
addDepartmentMutation.mutate({ name: newDepartmentName.trim() });
}
};

const updateCategoryVisibilityMutation = useMutation({
mutationFn: async ({ name, visible }: { name: string; visible: boolean }) => {
return await apiRequest("PATCH", `/api/company/categories/${encodeURIComponent(name)}`, { visible });
},
onSuccess: () => {
queryClient.invalidateQueries({ queryKey: ["/api/company/categories"] });
// No toast for category visibility update
},
onError: (error: any) => {
toast({
title: "Error",
description: error.message || "Failed to update category visibility",
variant: "destructive",
duration: 1000,
});
},
});
const updateCategoryVisibility = (categoryName: string, visible: boolean) => {
updateCategoryVisibilityMutation.mutate({ name: categoryName, visible });
};
const deleteCategoryMutation = useMutation({
mutationFn: async (name: string) => {
return await apiRequest("DELETE", `/api/company/categories/${encodeURIComponent(name)}`);
},
onSuccess: () => {
queryClient.invalidateQueries({ queryKey: ["/api/company/categories"] });
setTimeout(() => {
queryClient.invalidateQueries({ queryKey: ["/api/company/categories"] });
}, 300);
toast({
title: "Category Deleted",
description: "Category has been removed.",
duration: 1000,
});
},
onError: (error: any) => {
toast({
title: "Error",
description: error.message || "Failed to delete category",
variant: "destructive",
duration: 1000,
});
},
});

const updateDepartmentVisibility = (departmentName: string, visible: boolean) => {
updateDepartmentVisibilityMutation.mutate({ name: departmentName, visible });
};

const saveCategorySettings = () => {
toast({
title: "Settings Saved",
description: "Category configuration has been saved successfully (local only)",
duration: 1000,
});
};

const saveDepartmentSettings = () => {
toast({
title: "Settings Saved",
description: "Department configuration has been saved successfully",
duration: 1000,
});
};

// Get visible categories for use in dropdowns and cards (as objects)
const visibleCategoryObjects = categories.filter(cat => cat.visible);
const hiddenCategoryObjects = categories.filter(cat => !cat.visible);
// Get visible category names (strings) for dropdowns and forms
const visibleCategoryNames = visibleCategoryObjects.map(cat => cat.name).filter(name => typeof name === "string" && name.trim());

// Get visible departments for use in dropdowns and cards
const visibleDepartments = departments.filter(dept => dept.visible);
const hiddenDepartments = departments.filter(dept => !dept.visible);

// Handle input changes
const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
const { name, value } = e.target;
setCompanyInfo(prev => ({ ...prev, [name]: value }));
};

// Handle logo upload
const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
const file = e.target.files?.[0];
if (file) {
setCompanyInfo(prev => ({
...prev,
logo: file,
logoPreview: URL.createObjectURL(file)
}));
}
};

// Handle form submission
const handleSubmit = (e: React.FormEvent) => {
e.preventDefault();
// Here you would typically send the data to your backend
console.log("Company Information:", companyInfo);
alert("Company information saved successfully!");
};

return (
<div className="min-h-screen p-4 bg-gray-50">
<div className="mb-6">
<h2 className="text-2xl font-bold text-gray-900 tracking-tight">Company Details</h2>
<p className="text-base text-gray-600 mt-1 font-light">Manage company information, departments, employees, and system settings</p>
<div className="mt-4">
<Tabs defaultValue="company" className="mb-6">
<TabsList className="flex w-full bg-white rounded-lg p-1 shadow-sm mb-6">
<motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} className="flex-1">
<TabsTrigger
value="company"
className="w-full flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium rounded-md focus:outline-none transition-all duration-300
data-[state=active]:bg-indigo-500 data-[state=active]:text-white data-[state=active]:shadow-inner
text-gray-600 hover:text-gray-900 hover:bg-gray-100"
>
<Building2 className="w-4 h-4" />
<span>Company Information</span>
</TabsTrigger>
</motion.div>

<motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} className="flex-1">
<TabsTrigger
value="department"
className="w-full flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium rounded-md focus:outline-none transition-all duration-300
data-[state=active]:bg-indigo-500 data-[state=active]:text-white data-[state=active]:shadow-inner
text-gray-600 hover:text-gray-900 hover:bg-gray-100"
>
<Shield className="w-4 h-4" />
<span>Department</span>
</TabsTrigger>
</motion.div>

<motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} className="flex-1">
<TabsTrigger
value="employee"
className="w-full flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium rounded-md focus:outline-none transition-all duration-300
data-[state=active]:bg-indigo-500 data-[state=active]:text-white data-[state=active]:shadow-inner
text-gray-600 hover:text-gray-900 hover:bg-gray-100"
>
<Users className="w-4 h-4" />
<span>Employees</span>
</TabsTrigger>
</motion.div>

<motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} className="flex-1">
<TabsTrigger
value="subscription"
className="w-full flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium rounded-md focus:outline-none transition-all duration-300
data-[state=active]:bg-indigo-500 data-[state=active]:text-white data-[state=active]:shadow-inner
text-gray-600 hover:text-gray-900 hover:bg-gray-100"
>
<Settings className="w-4 h-4" />
<span>Subscription Category</span>
</TabsTrigger>
</motion.div>

<motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} className="flex-1">
<TabsTrigger
value="users"
className="w-full flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium rounded-md focus:outline-none transition-all duration-300
data-[state=active]:bg-indigo-500 data-[state=active]:text-white data-[state=active]:shadow-inner
text-gray-600 hover:text-gray-900 hover:bg-gray-100"
>
<Users className="w-4 h-4" />
<span>User Management</span>
</TabsTrigger>
</motion.div>
</TabsList>

<AnimatePresence mode="wait">
<TabsContent value="company" className="mt-6">
<motion.div
initial={{ opacity: 0, y: 20 }}
animate={{ opacity: 1, y: 0 }}
exit={{ opacity: 0, y: -20 }}
transition={{ duration: 0.3 }}
>
<Card className="bg-white border border-gray-200 shadow-sm p-6 rounded-xl">
<div className="flex items-center gap-4 mb-6">
<motion.div
whileHover={{ scale: 1.05 }}
whileTap={{ scale: 0.95 }}
className="w-10 h-10 bg-gradient-to-r from-indigo-500 to-blue-500 rounded-xl flex items-center justify-center shadow-md"
>
<Building2 className="text-white" size={20} />
</motion.div>
<div>
<h3 className="text-lg font-semibold text-gray-900">Company Information</h3>
<p className="text-gray-500 text-sm">Update your company details and branding</p>
</div>
</div>
<form onSubmit={handleSubmit} className="space-y-6">
<div className="grid grid-cols-1 md:grid-cols-2 gap-6">
{/* Company Name */}
<div className="space-y-2">
<Label htmlFor="name" className="text-sm font-medium text-gray-700">Company Name</Label>
<Input
id="name"
name="name"
value={companyInfo.name}
onChange={handleInputChange}
placeholder="Enter company name"
className="border-gray-300 focus:border-indigo-500 focus:ring-indigo-500 rounded-lg h-10"
/>
</div>

{/* Company Logo */}
<div className="space-y-2">
<Label htmlFor="logo" className="text-sm font-medium text-gray-700">Company Logo</Label>
<div className="flex items-center gap-4">
{companyInfo.logoPreview ? (
<div className="w-20 h-20 rounded-xl border-2 border-gray-200 overflow-hidden shadow-sm">
<img
src={companyInfo.logoPreview}
alt="Company Logo"
className="w-full h-full object-cover"
/>
</div>
) : (
<div className="w-20 h-20 rounded-xl border-2 border-dashed border-gray-300 flex items-center justify-center bg-gray-50">
<Upload className="w-6 h-6 text-gray-400" />
</div>
)}
<div>
<Button
type="button"
variant="outline"
className="relative overflow-hidden rounded-lg h-10"
onClick={() => document.getElementById('logo-upload')?.click()}
>
<Upload className="w-4 h-4 mr-2" />
Upload Logo
</Button>
<input
id="logo-upload"
type="file"
accept="image/*"
className="hidden"
onChange={handleLogoUpload}
/>
<p className="text-xs text-gray-500 mt-1">PNG, JPG up to 5MB</p>
</div>
</div>
</div>

{/* Address */}
<div className="space-y-2">
<Label htmlFor="address" className="text-sm font-medium text-gray-700">Address</Label>
<Input
id="address"
name="address"
value={companyInfo.address}
onChange={handleInputChange}
placeholder="Enter company address"
className="border-gray-300 focus:border-indigo-500 focus:ring-indigo-500 rounded-lg h-10"
/>
</div>

{/* Country */}
<div className="space-y-2">
<Label htmlFor="country" className="text-sm font-medium text-gray-700">Country</Label>
<Input
id="country"
name="country"
value={companyInfo.country}
onChange={handleInputChange}
placeholder="Enter country"
className="border-gray-300 focus:border-indigo-500 focus:ring-indigo-500 rounded-lg h-10"
/>
</div>

{/* Financial Year End */}
<div className="space-y-2">
<Label htmlFor="financialYearEnd" className="text-sm font-medium text-gray-700">Financial Year End</Label>
<Input
id="financialYearEnd"
name="financialYearEnd"
type="date"
value={companyInfo.financialYearEnd}
onChange={handleInputChange}
className="border-gray-300 focus:border-indigo-500 focus:ring-indigo-500 rounded-lg h-10"
/>
</div>
</div>

{/* Save Button */}
<div className="pt-2 flex justify-end">
<motion.div whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}>
<Button
type="submit"
className="bg-gradient-to-r from-indigo-500 to-blue-500 hover:from-indigo-600 hover:to-blue-600 text-white font-semibold shadow-md py-2 px-6 rounded-lg"
>
<Save className="w-4 h-4 mr-2" />
Save Company Information
</Button>
</motion.div>
</div>
</form>
</Card>
</motion.div>
</TabsContent>

<TabsContent value="department" className="mt-6">
<motion.div
initial={{ opacity: 0, y: 20 }}
animate={{ opacity: 1, y: 0 }}
exit={{ opacity: 0, y: -20 }}
transition={{ duration: 0.3 }}
>
<Card className="bg-white border border-gray-200 shadow-sm p-6 rounded-xl">
<div className="flex items-center gap-4 mb-6">
<motion.div
whileHover={{ scale: 1.05 }}
whileTap={{ scale: 0.95 }}
className="w-10 h-10 bg-gradient-to-r from-indigo-500 to-blue-500 rounded-xl flex items-center justify-center shadow-md"
>
<Shield className="text-white" size={20} />
</motion.div>
<div>
<h3 className="text-lg font-semibold text-gray-900">Department</h3>
<p className="text-gray-500 text-sm">Manage your organization's departments</p>
</div>
</div>
<div className="space-y-6">
{/* Add New Department */}
<div className="flex items-center space-x-4 p-4 bg-gray-50 rounded-xl">
<Input
placeholder="Enter new department name"
value={newDepartmentName}
onChange={(e) => setNewDepartmentName(e.target.value)}
className="flex-1 border-gray-300 focus:border-indigo-500 focus:ring-indigo-500 rounded-lg h-10"
onKeyPress={(e) => e.key === 'Enter' && addNewDepartment()}
/>
<motion.div whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}>
<Button
onClick={addNewDepartment}
disabled={!newDepartmentName.trim()}
className="bg-gradient-to-r from-indigo-500 to-blue-500 hover:from-indigo-600 hover:to-blue-600 text-white font-semibold shadow-md py-2 px-4 rounded-lg"
>
<Plus className="w-4 h-4 mr-2" />
Add Department
</Button>
</motion.div>
</div>

{/* Department List */}
<div className="space-y-4">
<h3 className="text-base font-semibold text-gray-900">Available Departments</h3>
<div className="grid grid-cols-1 md:grid-cols-3 gap-4">
{departmentsLoading ? (
<div className="text-gray-500">Loading departments...</div>
) : (
departments.map((department, idx) => {
const displayName = typeof department.name === "string" && department.name.trim() ? department.name : `Unnamed Department ${idx + 1}`;
return (
<motion.div
key={displayName + idx}
whileHover={{ y: -5 }}
className={`p-4 border rounded-xl transition-all duration-300 ${
department.visible
? 'border-indigo-200 bg-indigo-50 shadow-sm'
: 'border-gray-200 bg-gray-50'
}`}
>
<div className="flex items-center justify-between">
<div className="flex items-center space-x-3 w-full">
<Checkbox
checked={!!department.visible}
onCheckedChange={(checked: boolean) => updateDepartmentVisibility(department.name, checked)}
disabled={updateDepartmentVisibilityMutation.isPending || !department.name}
className="w-4 h-4 text-indigo-600 border-gray-300 focus:ring-indigo-500 rounded"
/>
<span className="text-sm font-medium text-gray-900 truncate w-full">{String(displayName)}</span>
</div>
<div className="flex items-center space-x-2">
{department.visible && (
<Badge className="bg-indigo-100 text-indigo-800 text-xs font-semibold py-1 px-3 rounded-full">
<Eye className="w-3 h-3 mr-1" />
Visible
</Badge>
)}
<Button
variant="ghost"
size="sm"
onClick={() => {
if (department.name && window.confirm(`Delete department '${displayName}'?`)) {
deleteDepartmentMutation.mutate(department.name);
}
}}
disabled={deleteDepartmentMutation.isPending || !department.name}
className="text-red-600 hover:text-red-800 hover:bg-red-50 rounded-full p-1 h-8 w-8"
title="Delete Department"
>
<Trash2 size={16} />
</Button>
</div>
</div>
</motion.div>
);
})
)}
</div>
</div>

{/* Summary */}
<div className="flex items-center justify-between pt-4 border-t border-gray-200">
<div className="text-sm text-gray-600">
<span className="font-semibold">{visibleDepartments.length}</span> visible departments,
<span className="font-semibold ml-1">{hiddenDepartments.length}</span> hidden departments
</div>
<motion.div whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}>
<Button
onClick={saveDepartmentSettings}
className="flex items-center space-x-2 bg-gradient-to-r from-indigo-500 to-blue-500 hover:from-indigo-600 hover:to-blue-600 text-white font-semibold shadow-md py-2 px-4 rounded-lg"
>
<Settings className="w-4 h-4" />
<span>Save Configuration</span>
</Button>
</motion.div>
</div>
</div>
</Card>
</motion.div>
</TabsContent>

<TabsContent value="employee" className="mt-6">
<motion.div
initial={{ opacity: 0, y: 20 }}
animate={{ opacity: 1, y: 0 }}
exit={{ opacity: 0, y: -20 }}
transition={{ duration: 0.3 }}
>
<EmployeeManagementTab departments={visibleDepartments.map(d => d.name)} />
</motion.div>
</TabsContent>

<TabsContent value="subscription" className="mt-6">
<motion.div
initial={{ opacity: 0, y: 20 }}
animate={{ opacity: 1, y: 0 }}
exit={{ opacity: 0, y: -20 }}
transition={{ duration: 0.3 }}
>
<Card className="bg-white border border-gray-200 shadow-sm p-6 rounded-xl">
<div className="flex items-center gap-4 mb-6">
<motion.div
whileHover={{ scale: 1.05 }}
whileTap={{ scale: 0.95 }}
className="w-10 h-10 bg-gradient-to-r from-indigo-500 to-blue-500 rounded-xl flex items-center justify-center shadow-md"
>
<Settings className="text-white" size={20} />
</motion.div>
<div>
<h3 className="text-lg font-semibold text-gray-900">Subscription Categories</h3>
<p className="text-gray-500 text-sm">Manage subscription categories for your services</p>
</div>
</div>
<div className="space-y-6">
{/* Add New Category */}
<div className="flex items-center space-x-4 p-4 bg-gray-50 rounded-xl">
<Input
placeholder="Enter new category name"
value={newCategoryName}
onChange={(e) => setNewCategoryName(e.target.value)}
className="flex-1 border-gray-300 focus:border-indigo-500 focus:ring-indigo-500 rounded-lg h-10"
onKeyPress={(e) => e.key === 'Enter' && addNewCategory()}
/>
<motion.div whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}>
<Button
onClick={addNewCategory}
disabled={!newCategoryName.trim() || addCategoryMutation.isPending}
className="bg-gradient-to-r from-indigo-500 to-blue-500 hover:from-indigo-600 hover:to-blue-600 text-white font-semibold shadow-md py-2 px-4 rounded-lg"
>
<Plus className="w-4 h-4 mr-2" />
{addCategoryMutation.isPending ? "Adding..." : "Add Category"}
</Button>
</motion.div>
</div>
{/* Category List */}
<div className="space-y-4">
<h3 className="text-base font-semibold text-gray-900">Available Categories</h3>
{categoriesLoading ? (
<div className="text-gray-500">Loading categories...</div>
) : (
<div className="grid grid-cols-1 md:grid-cols-3 gap-4">
{categories.map((category, idx) => {
// Only render if name is present or fallback
const displayName = typeof category.name === "string" && category.name.trim() ? category.name : `Unnamed Category ${idx + 1}`;
return (
<motion.div
key={displayName + idx}
whileHover={{ y: -5 }}
className={`p-4 border rounded-xl transition-all duration-300 ${
category.visible
? 'border-indigo-200 bg-indigo-50 shadow-sm'
: 'border-gray-200 bg-gray-50'
}`}
>
<div className="flex items-center justify-between">
<div className="flex items-center space-x-3 w-full">
<Checkbox
checked={!!category.visible}
onCheckedChange={(checked: boolean) => updateCategoryVisibility(category.name, checked)}
disabled={updateCategoryVisibilityMutation.isPending || !category.name}
className="w-4 h-4 text-indigo-600 border-gray-300 focus:ring-indigo-500 rounded"
/>
<span className="text-sm font-medium text-gray-900 truncate w-full">{String(displayName)}</span>
</div>
<div className="flex items-center space-x-2">
{category.visible && (
<Badge className="bg-indigo-100 text-indigo-800 text-xs font-semibold py-1 px-3 rounded-full">
<Eye className="w-3 h-3 mr-1" />
Visible
</Badge>
)}
<motion.div whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }}>
<Button
variant="ghost"
size="sm"
onClick={() => {
if (category.name && window.confirm(`Delete category '${displayName}'?`)) {
deleteCategoryMutation.mutate(category.name);
}
}}
disabled={deleteCategoryMutation.isPending || !category.name}
className="text-red-600 hover:text-red-800 hover:bg-red-50 rounded-full p-1 h-8 w-8"
title="Delete Category"
>
<Trash2 size={16} />
</Button>
</motion.div>
</div>
</div>
</motion.div>
);
})}
</div>
)}
</div>
{/* Summary */}
<div className="flex items-center justify-between pt-4 border-t border-gray-200">
<div className="text-sm text-gray-600">
<span className="font-semibold">{visibleCategoryObjects.length}</span> visible categories,
<span className="font-semibold ml-1">{hiddenCategoryObjects.length}</span> hidden categories
</div>
<motion.div whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}>
<Button
onClick={saveCategorySettings}
className="flex items-center space-x-2 bg-gradient-to-r from-indigo-500 to-blue-500 hover:from-indigo-600 hover:to-blue-600 text-white font-semibold shadow-md py-2 px-4 rounded-lg"
>
<Settings className="w-4 h-4" />
<span>Save Configuration</span>
</Button>
</motion.div>
</div>
</div>
</Card>
</motion.div>
</TabsContent>

<TabsContent value="users" className="mt-6">
<motion.div
initial={{ opacity: 0, y: 20 }}
animate={{ opacity: 1, y: 0 }}
exit={{ opacity: 0, y: -20 }}
transition={{ duration: 0.3 }}
>
<UserManagementTab />
</motion.div>
</TabsContent>
</AnimatePresence>
</Tabs>
</div>
</div>
</div>
);
}