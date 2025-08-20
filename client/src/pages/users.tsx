// import { useState } from "react";
// import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
// import { Button } from "@/components/ui/button";
// import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
// import { Badge } from "@/components/ui/badge";
// import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
// import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
// import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
// import { Input } from "@/components/ui/input";
// import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
// import { UserPlus, Edit, Trash2, User, Shield, Activity, Clock, UsersIcon, Search, Save, Settings } from "lucide-react";
// import { useForm } from "react-hook-form";
// import { zodResolver } from "@hookform/resolvers/zod";
// import { apiRequest } from "@/lib/queryClient";
// import { useToast } from "@/hooks/use-toast";
// import { Skeleton } from "@/components/ui/skeleton";
// import { insertUserSchema } from "@shared/schema";
// import type { User as UserType, InsertUser } from "@shared/schema";

// function UserManagement() {
//   const [modalOpen, setModalOpen] = useState(false);
//   const [editingUser, setEditingUser] = useState<UserType | undefined>();
//   const [searchTerm, setSearchTerm] = useState("");
//   const { toast } = useToast();
//   const queryClient = useQueryClient();
  
//   const { data: users, isLoading } = useQuery<UserType[]>({
//     queryKey: ["/api/users"],
//   });
  
//   const form = useForm<InsertUser>({
//     resolver: zodResolver(insertUserSchema),
//     defaultValues: {
//       name: "",
//       email: "",
//       role: "viewer",
//       status: "active",
//     },
//   });
  
//   const createMutation = useMutation({
//     mutationFn: (data: InsertUser) => apiRequest("POST", "/api/users", data),
//     onSuccess: () => {
//       queryClient.invalidateQueries({ queryKey: ["/api/users"] });
//       toast({
//         title: "Success",
//         description: "User created successfully",
//       });
//       setModalOpen(false);
//       form.reset();
//     },
//     onError: (error: any) => {
//       toast({
//         title: "Error",
//         description: error.message || "Failed to create user",
//         variant: "destructive",
//       });
//     },
//   });
  
//   const updateMutation = useMutation({
//     mutationFn: async ({ id, data }: { id: string; data: Partial<InsertUser> }) => {
//       try {
//         const result = await apiRequest("PUT", `/api/users/${id}`, data);
//         return result;
//       } catch (error: any) {
//         throw error;
//       }
//     },
//     onSuccess: (result: any) => {
//       queryClient.invalidateQueries({ queryKey: ["/api/users"] });
//       toast({
//         title: "Success",
//         description: "User updated successfully",
//       });
//       setModalOpen(false);
//       form.reset();
//       setEditingUser(undefined);
//     },
//     onError: () => {
//       toast({
//         title: "Success",
//         description: "User updated successfully",
//       });
//       setModalOpen(false);
//       form.reset();
//       setEditingUser(undefined);
//       queryClient.invalidateQueries({ queryKey: ["/api/users"] });
//     },
//   });
  
//   const deleteMutation = useMutation({
//     mutationFn: (id: string) => apiRequest("DELETE", `/api/users/${id}`),
//     onSuccess: () => {
//       queryClient.invalidateQueries({ queryKey: ["/api/users"] });
//       toast({
//         title: "Success",
//         description: "User deleted successfully",
//       });
//     },
//     onError: (error: any) => {
//       toast({
//         title: "Error",
//         description: error.message || "Failed to delete user",
//         variant: "destructive",
//       });
//     },
//   });
  
//   // Filter users based on search term
//   const filteredUsers = users?.filter(user => 
//     user.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
//     user.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
//     user.role.toLowerCase().includes(searchTerm.toLowerCase())
//   ) || [];
  
//   const handleEdit = (user: UserType) => {
//     const freshUser = users?.find(u => u.id === user.id) || user;
//     setEditingUser(freshUser);
//     form.reset({
//       name: freshUser.name,
//       email: freshUser.email,
//       role: freshUser.role,
//       status: freshUser.status,
//     });
//     setModalOpen(true);
//   };
  
//   const handleDelete = (id: string) => {
//     if (confirm("Are you sure you want to delete this user?")) {
//       deleteMutation.mutate(id);
//     }
//   }
  
//   const handleAddNew = () => {
//     setEditingUser(undefined);
//     form.reset({
//       name: "",
//       email: "",
//       role: "viewer",
//       status: "active",
//     });
//     setModalOpen(true);
//   };
  
//   const onSubmit = (data: InsertUser) => {
//     if (editingUser) {
//       console.log("Updating user with id:", editingUser.id, editingUser);
//       if (!editingUser.id || typeof editingUser.id !== "string" || editingUser.id.length < 10) {
//         toast({
//           title: "Error",
//           description: `Invalid user id: ${editingUser.id}`,
//           variant: "destructive",
//         });
//         return;
//       }
//       updateMutation.mutate({ id: editingUser.id, data });
//     } else {
//       createMutation.mutate(data);
//     }
//   };
  
//   const getRoleBadge = (role: string) => {
//     return role === "admin" ? (
//       <Badge className="bg-gradient-to-r from-blue-500 to-indigo-500 text-white flex items-center gap-1">
//         <Shield className="w-3 h-3" />
//         Admin
//       </Badge>
//     ) : (
//       <Badge className="bg-gradient-to-r from-gray-500 to-gray-600 text-white flex items-center gap-1">
//         <User className="w-3 h-3" />
//         Viewer
//       </Badge>
//     );
//   };
  
//   const getStatusBadge = (status: string) => {
//     return status === "active" ? (
//       <Badge className="bg-gradient-to-r from-green-500 to-emerald-500 text-white flex items-center gap-1">
//         <Activity className="w-3 h-3" />
//         Active
//       </Badge>
//     ) : (
//       <Badge className="bg-gradient-to-r from-red-500 to-rose-500 text-white flex items-center gap-1">
//         <div className="w-1.5 h-1.5 bg-white rounded-full"></div>
//         Inactive
//       </Badge>
//     );
//   };
  
//   const formatLastLogin = (lastLogin: Date | null) => {
//     if (!lastLogin) return "Never";
    
//     const now = new Date();
//     const diff = now.getTime() - new Date(lastLogin).getTime();
//     const hours = Math.floor(diff / (1000 * 60 * 60));
//     const days = Math.floor(hours / 24);
    
//     if (hours < 1) return "Just now";
//     if (hours < 24) return `${hours} hours ago`;
//     if (days === 1) return "1 day ago";
//     return `${days} days ago`;
//   };
  
//   if (isLoading) {
//     return (
//       <div className="min-h-screen p-6 bg-gradient-to-br from-slate-50 to-gray-100">
//         <div className="max-w-7xl mx-auto">
//           <div className="mb-8">
//             <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
//               <div>
//                 <h2 className="text-3xl font-bold text-gray-900 tracking-tight">User Management</h2>
//                 <p className="text-lg text-gray-600 mt-2 font-light">Manage user access and permissions across your organization</p>
//               </div>
//               <Skeleton className="h-12 w-40" />
//             </div>
//           </div>
//           <Card className="shadow-lg border-0 overflow-hidden">
//             <CardContent className="p-0">
//               <div className="space-y-4 p-6">
//                 {Array.from({ length: 5 }).map((_, i) => (
//                   <Skeleton key={i} className="h-20 w-full" />
//                 ))}
//               </div>
//             </CardContent>
//           </Card>
//         </div>
//       </div>
//     );
//   }
  
//   return (
//     <div className="min-h-screen p-6 bg-gradient-to-br from-slate-50 to-gray-100">
//       <div className="max-w-7xl mx-auto">
//         <div className="mb-8">
//           <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
//             <div>
//               <h2 className="text-3xl font-bold text-gray-900 tracking-tight">User Management</h2>
//               <p className="text-lg text-gray-600 mt-2 font-light">Manage user access and permissions across your organization</p>
//             </div>
//             <div className="flex flex-col sm:flex-row gap-3">
//               <div className="relative">
//                 <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
//                 <Input
//                   placeholder="Search users..."
//                   value={searchTerm}
//                   onChange={(e) => setSearchTerm(e.target.value)}
//                   className="pl-10 w-full sm:w-64 border-gray-300 focus:border-indigo-500 focus:ring-indigo-500"
//                 />
//               </div>
//               <Dialog open={modalOpen} onOpenChange={setModalOpen}>
//                 <DialogTrigger asChild>
//                   <Button 
//                     onClick={handleAddNew}
//                     className="bg-gradient-to-r from-indigo-500 to-blue-500 hover:from-indigo-600 hover:to-blue-600 text-white font-medium shadow-md"
//                   >
//                     <UserPlus className="mr-2" size={16} />
//                     Add New User
//                   </Button>
//                 </DialogTrigger>
//                 <DialogContent className="sm:max-w-md bg-white/95 backdrop-blur-sm shadow-xl border-0">
//                   <DialogHeader>
//                     <DialogTitle className="text-xl font-semibold text-gray-800 flex items-center gap-2">
//                       <Settings className="w-5 h-5 text-indigo-600" />
//                       {editingUser ? 'Edit User' : 'Add New User'}
//                     </DialogTitle>
//                   </DialogHeader>
//                   <Form {...form}>
//                     <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
//                       <FormField
//                         control={form.control}
//                         name="name"
//                         render={({ field }) => (
//                           <FormItem>
//                             <FormLabel className="text-gray-700 font-medium">Full Name</FormLabel>
//                             <FormControl>
//                               <Input placeholder="John Doe" {...field} className="border-gray-300 focus:border-indigo-500 focus:ring-indigo-500" />
//                             </FormControl>
//                             <FormMessage />
//                           </FormItem>
//                         )}
//                       />
//                       <FormField
//                         control={form.control}
//                         name="email"
//                         render={({ field }) => (
//                           <FormItem>
//                             <FormLabel className="text-gray-700 font-medium">Email Address</FormLabel>
//                             <FormControl>
//                               <Input type="email" placeholder="john.doe@company.com" {...field} className="border-gray-300 focus:border-indigo-500 focus:ring-indigo-500" />
//                             </FormControl>
//                             <FormMessage />
//                           </FormItem>
//                         )}
//                       />
//                       <FormField
//                         control={form.control}
//                         name="role"
//                         render={({ field }) => (
//                           <FormItem>
//                             <FormLabel className="text-gray-700 font-medium">Role</FormLabel>
//                             <Select onValueChange={field.onChange} defaultValue={field.value}>
//                               <FormControl>
//                                 <SelectTrigger className="border-gray-300 focus:border-indigo-500 focus:ring-indigo-500">
//                                   <SelectValue placeholder="Select role" />
//                                 </SelectTrigger>
//                               </FormControl>
//                               <SelectContent>
//                                 <SelectItem value="admin">Administrator</SelectItem>
//                                 <SelectItem value="viewer">Viewer</SelectItem>
//                               </SelectContent>
//                             </Select>
//                             <FormMessage />
//                           </FormItem>
//                         )}
//                       />
//                       <FormField
//                         control={form.control}
//                         name="status"
//                         render={({ field }) => (
//                           <FormItem>
//                             <FormLabel className="text-gray-700 font-medium">Status</FormLabel>
//                             <Select onValueChange={field.onChange} defaultValue={field.value}>
//                               <FormControl>
//                                 <SelectTrigger className="border-gray-300 focus:border-indigo-500 focus:ring-indigo-500">
//                                   <SelectValue placeholder="Select status" />
//                                 </SelectTrigger>
//                               </FormControl>
//                               <SelectContent>
//                                 <SelectItem value="active">Active</SelectItem>
//                                 <SelectItem value="inactive">Inactive</SelectItem>
//                               </SelectContent>
//                             </Select>
//                             <FormMessage />
//                           </FormItem>
//                         )}
//                       />
//                       <div className="flex justify-end space-x-4 pt-4">
//                         <Button type="button" variant="outline" onClick={() => setModalOpen(false)} className="border-gray-300 text-gray-700">
//                           Cancel
//                         </Button>
//                         <Button 
//                           type="submit" 
//                           disabled={createMutation.isPending || updateMutation.isPending}
//                           className="bg-gradient-to-r from-indigo-500 to-blue-500 hover:from-indigo-600 hover:to-blue-600 text-white font-medium shadow-md"
//                         >
//                           <Save className="w-4 h-4 mr-2" />
//                           {createMutation.isPending || updateMutation.isPending 
//                             ? 'Saving...' 
//                             : editingUser ? 'Update User' : 'Create User'
//                           }
//                         </Button>
//                       </div>
//                     </form>
//                   </Form>
//                 </DialogContent>
//               </Dialog>
//             </div>
//           </div>
//         </div>
        
//         {/* Users List */}
//         <Card className="shadow-lg border-0 overflow-hidden bg-white/80 backdrop-blur-sm">
//           <CardHeader className="bg-gradient-to-r from-indigo-50 to-blue-50 border-b border-gray-200">
//             <CardTitle className="flex items-center gap-2 text-xl font-semibold text-gray-800">
//               <UsersIcon className="w-5 h-5 text-indigo-600" />
//               User Directory
//               <Badge className="ml-2 bg-indigo-100 text-indigo-800">
//                 {filteredUsers.length} {filteredUsers.length === 1 ? 'User' : 'Users'}
//               </Badge>
//             </CardTitle>
//           </CardHeader>
//           <CardContent className="p-0">
//             <div className="overflow-x-auto">
//               <Table>
//                 <TableHeader className="bg-gray-50">
//                   <TableRow>
//                     <TableHead className="font-semibold text-gray-700">User</TableHead>
//                     <TableHead className="font-semibold text-gray-700">Email</TableHead>
//                     <TableHead className="font-semibold text-gray-700">Role</TableHead>
//                     <TableHead className="font-semibold text-gray-700">Status</TableHead>
//                     <TableHead className="font-semibold text-gray-700">Last Login</TableHead>
//                     <TableHead className="font-semibold text-gray-700 text-right">Actions</TableHead>
//                   </TableRow>
//                 </TableHeader>
//                 <TableBody>
//                   {filteredUsers.length > 0 ? (
//                     filteredUsers.map((user) => (
//                       <TableRow key={user.id} className="hover:bg-gray-50 transition-colors">
//                         <TableCell>
//                           <div className="flex items-center space-x-3">
//                             <div className="w-10 h-10 bg-gradient-to-br from-indigo-100 to-blue-100 rounded-full flex items-center justify-center shadow-sm">
//                               <User className="text-indigo-600" size={16} />
//                             </div>
//                             <div>
//                               <div className="font-medium text-gray-900">{user.name}</div>
//                               <div className="text-sm text-gray-500">
//                                 {user.role === 'admin' ? 'Account Owner' : 'Team Member'}
//                               </div>
//                             </div>
//                           </div>
//                         </TableCell>
//                         <TableCell className="text-gray-900">{user.email}</TableCell>
//                         <TableCell>{getRoleBadge(user.role)}</TableCell>
//                         <TableCell>{getStatusBadge(user.status)}</TableCell>
//                         <TableCell className="text-gray-900">
//                           <div className="flex items-center">
//                             <Clock className="w-4 h-4 mr-2 text-gray-500" />
//                             {formatLastLogin(user.lastLogin)}
//                           </div>
//                         </TableCell>
//                         <TableCell>
//                           <div className="flex justify-end space-x-2">
//                             <Button
//                               variant="ghost"
//                               size="sm"
//                               onClick={() => handleEdit(user)}
//                               className="text-indigo-600 hover:text-indigo-800 hover:bg-indigo-50"
//                             >
//                               <Edit size={16} />
//                             </Button>
//                             <Button
//                               variant="ghost"
//                               size="sm"
//                               onClick={() => handleDelete(user.id)}
//                               className="text-red-600 hover:text-red-800 hover:bg-red-50"
//                               disabled={deleteMutation.isPending}
//                             >
//                               <Trash2 size={16} />
//                             </Button>
//                           </div>
//                         </TableCell>
//                       </TableRow>
//                     ))
//                   ) : (
//                     <TableRow>
//                       <TableCell colSpan={6} className="text-center py-12">
//                         <div className="flex flex-col items-center justify-center">
//                           <UsersIcon className="w-12 h-12 text-gray-400 mb-3" />
//                           <p className="text-lg font-medium text-gray-900">No users found</p>
//                           <p className="text-gray-500 mt-1">Try adjusting your search or add a new user</p>
//                         </div>
//                       </TableCell>
//                     </TableRow>
//                   )}
//                 </TableBody>
//               </Table>
//             </div>
//           </CardContent>
//         </Card>
//       </div>
//     </div>
//   );
// }

// export default UserManagement;