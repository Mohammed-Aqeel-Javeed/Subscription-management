import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import { Card, CardContent } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Textarea } from "../components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../components/ui/table";
import { Badge } from "../components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "../components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "../components/ui/form";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { 
  Plus, 
  Edit, 
  Trash2, 
  Shield, 
  Search, 
  Download, 
  Calendar,
  Building2,
  Users,
  Phone,
  Mail,
  AlertCircle,
  CheckCircle,
  Clock,
  RefreshCw
} from "lucide-react";
import { useToast } from "../hooks/use-toast";
import { API_BASE_URL } from "@/lib/config";

// License interface
interface License {
  id: string;
  licenseName: string;
  issuingAuthorityName: string;
  startDate: string;
  endDate: string;
  details: string;
  renewalFee: number;
  responsiblePerson: string;
  department: string;
  backupContact: string;
  status: 'Active' | 'Pending' | 'Expired' | 'Under Renewal';
  issuingAuthorityEmail: string;
  issuingAuthorityPhone: string;
  createdAt?: string;
  updatedAt?: string;
}

// Form schema
const licenseSchema = z.object({
  licenseName: z.string().min(1, "License name is required"),
  issuingAuthorityName: z.string().min(1, "Issuing authority name is required"),
  startDate: z.string().min(1, "Start date is required"),
  endDate: z.string().min(1, "End date is required"),
  details: z.string().optional(),
  renewalFee: z.number().min(0, "Renewal fee must be positive"),
  responsiblePerson: z.string().min(1, "Responsible person is required"),
  department: z.string().min(1, "Department is required"),
  backupContact: z.string().min(1, "Backup contact is required"),
  status: z.enum(['Active', 'Pending', 'Expired', 'Under Renewal']),
  issuingAuthorityEmail: z.string().email("Valid email is required"),
  issuingAuthorityPhone: z.string().min(1, "Phone number is required"),
});

type LicenseFormData = z.infer<typeof licenseSchema>;

export default function GovernmentLicense() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingLicense, setEditingLicense] = useState<License | null>(null);

  const form = useForm<LicenseFormData>({
    resolver: zodResolver(licenseSchema),
    defaultValues: {
      licenseName: "",
      issuingAuthorityName: "",
      startDate: "",
      endDate: "",
      details: "",
      renewalFee: 0,
      responsiblePerson: "",
      department: "",
      backupContact: "",
      status: "Active",
      issuingAuthorityEmail: "",
      issuingAuthorityPhone: "",
    },
  });

  // Fetch licenses
  const { data: licenses = [], isLoading, error } = useQuery<License[]>({
    queryKey: ["/api/licenses"],
    queryFn: async () => {
      const res = await fetch(`${API_BASE_URL}/api/licenses`, {
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to fetch licenses");
      return res.json();
    },
  });

  // Create/Update license mutation
  const licenseMutation = useMutation({
    mutationFn: async (data: LicenseFormData) => {
      const url = editingLicense 
        ? `${API_BASE_URL}/api/licenses/${editingLicense.id}`
        : `${API_BASE_URL}/api/licenses`;
      
      const res = await fetch(url, {
        method: editingLicense ? "PUT" : "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify(data),
      });
      
      if (!res.ok) throw new Error("Failed to save license");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/licenses"] });
      toast({
        title: "Success",
        description: `License ${editingLicense ? 'updated' : 'created'} successfully`,
      });
      setIsModalOpen(false);
      setEditingLicense(null);
      form.reset();
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to save license",
        variant: "destructive",
      });
    },
  });

  // Delete license mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`${API_BASE_URL}/api/licenses/${id}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to delete license");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/licenses"] });
      toast({
        title: "Success",
        description: "License deleted successfully",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to delete license",
        variant: "destructive",
      });
    },
  });

  // Filter licenses based on search and status
  const filteredLicenses = licenses.filter((license) => {
    const matchesSearch = 
      license.licenseName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      license.issuingAuthorityName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      license.responsiblePerson.toLowerCase().includes(searchTerm.toLowerCase()) ||
      license.department.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesStatus = statusFilter === "all" || license.status === statusFilter;
    
    return matchesSearch && matchesStatus;
  });

  // Handle form submission
  const onSubmit = (data: LicenseFormData) => {
    licenseMutation.mutate(data);
  };

  // Handle edit
  const handleEdit = (license: License) => {
    setEditingLicense(license);
    form.reset({
      licenseName: license.licenseName,
      issuingAuthorityName: license.issuingAuthorityName,
      startDate: license.startDate,
      endDate: license.endDate,
      details: license.details,
      renewalFee: license.renewalFee,
      responsiblePerson: license.responsiblePerson,
      department: license.department,
      backupContact: license.backupContact,
      status: license.status,
      issuingAuthorityEmail: license.issuingAuthorityEmail,
      issuingAuthorityPhone: license.issuingAuthorityPhone,
    });
    setIsModalOpen(true);
  };

  // Handle add new
  const handleAddNew = () => {
    setEditingLicense(null);
    form.reset();
    setIsModalOpen(true);
  };

  // Handle delete
  const handleDelete = (id: string) => {
    if (confirm("Are you sure you want to delete this license?")) {
      deleteMutation.mutate(id);
    }
  };

  // Get status color
  const getStatusColor = (status: string) => {
    switch (status) {
      case "Active":
        return "bg-green-100 text-green-800 hover:bg-green-200";
      case "Pending":
        return "bg-yellow-100 text-yellow-800 hover:bg-yellow-200";
      case "Expired":
        return "bg-red-100 text-red-800 hover:bg-red-200";
      case "Under Renewal":
        return "bg-blue-100 text-blue-800 hover:bg-blue-200";
      default:
        return "bg-gray-100 text-gray-800 hover:bg-gray-200";
    }
  };

  // Get status icon
  const getStatusIcon = (status: string) => {
    switch (status) {
      case "Active":
        return <CheckCircle className="h-4 w-4" />;
      case "Pending":
        return <Clock className="h-4 w-4" />;
      case "Expired":
        return <AlertCircle className="h-4 w-4" />;
      case "Under Renewal":
        return <RefreshCw className="h-4 w-4" />;
      default:
        return <AlertCircle className="h-4 w-4" />;
    }
  };

  // Format date
  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  return (
    <motion.div 
      className="min-h-screen p-4 md:p-8 bg-white"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.5 }}
    >
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <motion.div 
          className="mb-8"
          initial={{ y: -20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.2, duration: 0.5 }}
        >
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6">
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-xl shadow-sm bg-slate-100 border border-slate-200">
                <Shield className="h-8 w-8 text-indigo-600" />
              </div>
              <div>
                <h1 className="text-3xl md:text-4xl font-bold text-slate-900">
                  Government Licenses
                </h1>
                <p className="text-slate-600 mt-2">Manage your government licenses and compliance requirements</p>
              </div>
            </div>
            
            <div className="flex gap-3 mt-4 md:mt-0">
              <Button 
                variant="outline" 
                size="sm"
                className="flex items-center gap-1.5 border-indigo-200 text-indigo-700 hover:bg-indigo-50 shadow-sm"
              >
                <Download className="h-4 w-4" />
                Export
              </Button>
              <Button 
                onClick={handleAddNew}
                className="flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-700 text-white shadow-md"
              >
                <Plus className="h-4 w-4" />
                Add New License
              </Button>
            </div>
          </div>
          
          {/* Filters */}
          <div className="flex flex-col md:flex-row gap-4">
            <div className="relative flex-1">
              <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
                <Search className="h-5 w-5 text-slate-400" />
              </div>
              <Input
                type="text"
                className="w-full pl-10 pr-4 py-3 border border-slate-200 rounded-xl bg-white focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-slate-800 placeholder-slate-400 shadow-sm"
                placeholder="Search licenses..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full md:w-48 border border-slate-200 rounded-xl bg-white shadow-sm">
                <SelectValue placeholder="Filter by status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="Active">Active</SelectItem>
                <SelectItem value="Pending">Pending</SelectItem>
                <SelectItem value="Expired">Expired</SelectItem>
                <SelectItem value="Under Renewal">Under Renewal</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </motion.div>

        {/* Main Content */}
        <motion.div
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.3, duration: 0.5 }}
        >
          <Card className="shadow-xl border border-slate-100 rounded-2xl bg-white overflow-hidden">
            <CardContent className="p-0">
              {isLoading ? (
                <div className="flex flex-col items-center justify-center py-20">
                  <motion.div
                    animate={{ rotate: 360 }}
                    transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                  >
                    <Shield className="w-12 h-12 text-indigo-500" />
                  </motion.div>
                  <p className="text-slate-600 mt-4">Loading licenses...</p>
                </div>
              ) : error ? (
                <div className="flex flex-col items-center justify-center py-20">
                  <div className="bg-rose-50 rounded-full p-4 mb-4">
                    <AlertCircle className="w-10 h-10 text-rose-500" />
                  </div>
                  <p className="text-rose-500 font-medium text-lg">Failed to load licenses</p>
                  <p className="text-slate-500 mt-2">Please try again later</p>
                </div>
              ) : filteredLicenses.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-20">
                  <div className="bg-slate-100 rounded-full p-5 mb-5">
                    <Shield className="w-12 h-12 text-slate-400" />
                  </div>
                  <h3 className="text-xl font-medium text-slate-800 mb-2">
                    {searchTerm || statusFilter !== "all" ? "No matching licenses found" : "No licenses found"}
                  </h3>
                  <p className="text-slate-600 max-w-md text-center">
                    {searchTerm || statusFilter !== "all" 
                      ? "Try adjusting your search or filter criteria" 
                      : "Get started by adding your first government license"
                    }
                  </p>
                  {!searchTerm && statusFilter === "all" && (
                    <Button 
                      onClick={handleAddNew}
                      className="mt-4 bg-indigo-600 hover:bg-indigo-700 text-white"
                    >
                      <Plus className="h-4 w-4 mr-2" />
                      Add First License
                    </Button>
                  )}
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table className="w-full">
                    <TableHeader className="bg-slate-50">
                      <TableRow>
                        <TableHead className="font-semibold text-slate-800 py-4 px-6">License Name</TableHead>
                        <TableHead className="font-semibold text-slate-800 py-4 px-6">Issuing Authority</TableHead>
                        <TableHead className="font-semibold text-slate-800 py-4 px-6">Start Date</TableHead>
                        <TableHead className="font-semibold text-slate-800 py-4 px-6">End Date</TableHead>
                        <TableHead className="font-semibold text-slate-800 py-4 px-6">Department</TableHead>
                        <TableHead className="font-semibold text-slate-800 py-4 px-6">Responsible Person</TableHead>
                        <TableHead className="font-semibold text-slate-800 py-4 px-6">Renewal Fee</TableHead>
                        <TableHead className="font-semibold text-slate-800 py-4 px-6">Status</TableHead>
                        <TableHead className="font-semibold text-slate-800 py-4 px-6">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      <AnimatePresence>
                        {filteredLicenses.map((license, index) => (
                          <motion.tr 
                            key={license.id}
                            className="hover:bg-slate-50 transition-colors"
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0 }}
                            transition={{ delay: 0.05 * index }}
                          >
                            <TableCell className="py-4 px-6 font-medium text-slate-800">
                              {license.licenseName}
                            </TableCell>
                            <TableCell className="py-4 px-6 text-slate-700">
                              <div>
                                <div className="font-medium">{license.issuingAuthorityName}</div>
                                <div className="text-sm text-slate-500 flex items-center gap-1 mt-1">
                                  <Mail className="h-3 w-3" />
                                  {license.issuingAuthorityEmail}
                                </div>
                                <div className="text-sm text-slate-500 flex items-center gap-1">
                                  <Phone className="h-3 w-3" />
                                  {license.issuingAuthorityPhone}
                                </div>
                              </div>
                            </TableCell>
                            <TableCell className="py-4 px-6 text-slate-600">
                              <div className="flex items-center gap-1">
                                <Calendar className="h-4 w-4" />
                                {formatDate(license.startDate)}
                              </div>
                            </TableCell>
                            <TableCell className="py-4 px-6 text-slate-600">
                              <div className="flex items-center gap-1">
                                <Calendar className="h-4 w-4" />
                                {formatDate(license.endDate)}
                              </div>
                            </TableCell>
                            <TableCell className="py-4 px-6 text-slate-700">
                              <div className="flex items-center gap-1">
                                <Building2 className="h-4 w-4" />
                                {license.department}
                              </div>
                            </TableCell>
                            <TableCell className="py-4 px-6 text-slate-700">
                              <div>
                                <div className="font-medium flex items-center gap-1">
                                  <Users className="h-4 w-4" />
                                  {license.responsiblePerson}
                                </div>
                                <div className="text-sm text-slate-500">
                                  Backup: {license.backupContact}
                                </div>
                              </div>
                            </TableCell>
                            <TableCell className="py-4 px-6 text-slate-700 font-semibold">
                              ${license.renewalFee.toLocaleString()}
                            </TableCell>
                            <TableCell className="py-4 px-6">
                              <Badge className={`flex items-center gap-1 ${getStatusColor(license.status)}`}>
                                {getStatusIcon(license.status)}
                                {license.status}
                              </Badge>
                            </TableCell>
                            <TableCell className="py-4 px-6">
                              <div className="flex gap-2">
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => handleEdit(license)}
                                  className="hover:bg-indigo-50 hover:border-indigo-300"
                                >
                                  <Edit className="h-4 w-4" />
                                </Button>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => handleDelete(license.id)}
                                  className="hover:bg-red-50 hover:border-red-300 text-red-600"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </div>
                            </TableCell>
                          </motion.tr>
                        ))}
                      </AnimatePresence>
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>

        {/* Add/Edit License Modal */}
        <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto bg-white">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-xl font-bold">
                <Shield className="h-6 w-6 text-indigo-600" />
                {editingLicense ? 'Edit License' : 'Add New License'}
              </DialogTitle>
            </DialogHeader>
            
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* License Name */}
                  <FormField
                    control={form.control}
                    name="licenseName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="font-medium text-slate-700">License Name *</FormLabel>
                        <FormControl>
                          <Input placeholder="Enter license name" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {/* Issuing Authority Name */}
                  <FormField
                    control={form.control}
                    name="issuingAuthorityName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="font-medium text-slate-700">Issuing Authority Name *</FormLabel>
                        <FormControl>
                          <Input placeholder="Enter issuing authority name" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {/* Start Date */}
                  <FormField
                    control={form.control}
                    name="startDate"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="font-medium text-slate-700">Start Date *</FormLabel>
                        <FormControl>
                          <Input type="date" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {/* End Date */}
                  <FormField
                    control={form.control}
                    name="endDate"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="font-medium text-slate-700">End Date *</FormLabel>
                        <FormControl>
                          <Input type="date" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {/* Renewal Fee */}
                  <FormField
                    control={form.control}
                    name="renewalFee"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="font-medium text-slate-700">Renewal Fee *</FormLabel>
                        <FormControl>
                          <Input 
                            type="number" 
                            min="0" 
                            step="0.01"
                            placeholder="0.00"
                            {...field}
                            onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {/* Status */}
                  <FormField
                    control={form.control}
                    name="status"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="font-medium text-slate-700">Status *</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select status" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="Active">Active</SelectItem>
                            <SelectItem value="Pending">Pending</SelectItem>
                            <SelectItem value="Expired">Expired</SelectItem>
                            <SelectItem value="Under Renewal">Under Renewal</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {/* Responsible Person */}
                  <FormField
                    control={form.control}
                    name="responsiblePerson"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="font-medium text-slate-700">Responsible Person *</FormLabel>
                        <FormControl>
                          <Input placeholder="Enter responsible person name" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {/* Department */}
                  <FormField
                    control={form.control}
                    name="department"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="font-medium text-slate-700">Department *</FormLabel>
                        <FormControl>
                          <Input placeholder="Enter department name" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {/* Backup Contact */}
                  <FormField
                    control={form.control}
                    name="backupContact"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="font-medium text-slate-700">Backup Contact *</FormLabel>
                        <FormControl>
                          <Input placeholder="Enter backup contact name" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {/* Issuing Authority Email */}
                  <FormField
                    control={form.control}
                    name="issuingAuthorityEmail"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="font-medium text-slate-700">Issuing Authority Email *</FormLabel>
                        <FormControl>
                          <Input type="email" placeholder="Enter email address" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {/* Issuing Authority Phone */}
                  <FormField
                    control={form.control}
                    name="issuingAuthorityPhone"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="font-medium text-slate-700">Issuing Authority Phone *</FormLabel>
                        <FormControl>
                          <Input placeholder="Enter phone number" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                {/* Details */}
                <FormField
                  control={form.control}
                  name="details"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="font-medium text-slate-700">Details</FormLabel>
                      <FormControl>
                        <Textarea 
                          placeholder="Enter additional details about the license..."
                          className="min-h-[100px]"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Form Actions */}
                <div className="flex justify-end gap-3 pt-4 border-t">
                  <Button 
                    type="button" 
                    variant="outline" 
                    onClick={() => setIsModalOpen(false)}
                  >
                    Cancel
                  </Button>
                  <Button 
                    type="submit" 
                    disabled={licenseMutation.isPending}
                    className="bg-indigo-600 hover:bg-indigo-700 text-white"
                  >
                    {licenseMutation.isPending ? 'Saving...' : (editingLicense ? 'Update License' : 'Create License')}
                  </Button>
                </div>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>
    </motion.div>
  );
}