import { useState, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import { Card, CardContent } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Textarea } from "../components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue, SelectGroup, SelectLabel } from "../components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../components/ui/table";
import { Badge } from "../components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "../components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "../components/ui/form";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { 
  Plus, Edit, Trash2, Shield, Search, Download, Calendar, Building2, Users, Phone, Mail, AlertCircle, CheckCircle, Clock, RefreshCw, Upload, Maximize2, Minimize2
} from "lucide-react";
import { useToast } from "../hooks/use-toast";
import { API_BASE_URL } from "@/lib/config";

// Predefined Issuing Authorities (ordered to match provided screenshot)
const ISSUING_AUTHORITIES = [
  "Government Electronic Business (GeBIZ)",
  "Ministry of Manpower (MOM) Employment Pass (EP) Online",
  "Accounting and Corporate Regulatory Authority (ACRA)",
  "Enterprise Singapore (via GoBusiness Licensing)",
  "Singapore Civil Defence Force (SCDF)",
  "National Environment Agency (NEA)",
  "Singapore Police Force (SPF)",
  "Building and Construction Authority (BCA)",
  "Singapore Food Agency (SFA)",
];

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
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingLicense, setEditingLicense] = useState<License | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);

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

  // Summary stats similar to subscriptions
  const total = licenses.length;
  const active = licenses.filter(l => l.status === 'Active').length;
  // const expiringSoon = licenses.filter(l => {
  //   const end = new Date(l.endDate).getTime();
  //   const now = Date.now();
  //   const diff = end - now;
  //   return diff > 0 && diff < 1000 * 60 * 60 * 24 * 30; // within 30 days
  // }).length; // Future enhancement: show expiring soon card

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-slate-50 to-indigo-100 p-4 md:p-6 relative">
      <div className="max-w-7xl mx-auto">
        {/* Header Section (mirroring subscriptions) */}
        <div className="bg-white rounded-2xl shadow-xl p-4 mb-6 border border-slate-200">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
            <div className="flex-1">
              <div className="flex items-center gap-4 mb-3">
                <div className="p-3 bg-gradient-to-br from-indigo-500 to-indigo-600 rounded-xl shadow-md">
                  <Shield className="h-7 w-7 text-white" />
                </div>
                <div>
                  <h1 className="text-3xl md:text-4xl font-bold text-slate-900 tracking-tight">Government License Management</h1>
                  <p className="text-slate-600 text-lg mt-1">Manage all your regulatory and statutory licenses</p>
                </div>
              </div>
            </div>
            <div className="flex flex-row gap-4 items-center">
              <Button
                variant="default"
                className="bg-gradient-to-r from-indigo-600 to-indigo-700 text-white font-semibold shadow-md hover:scale-105 transition-transform"
                onClick={handleAddNew}
                title="Add License"
              >
                <Plus className="h-5 w-5 mr-2" /> Add New License
              </Button>
            </div>
          </div>
          {/* --- Summary Stats --- */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
            <Card className="bg-gradient-to-r from-indigo-500 to-indigo-600 shadow-sm rounded-lg p-3 flex items-center gap-3">
              <div className="p-2 bg-white/20 rounded-lg">
                <Shield className="h-6 w-6 text-white" />
              </div>
              <div>
                <div className="text-2xl font-bold text-white">{total}</div>
                <div className="text-white/90 text-sm">Total Licenses</div>
              </div>
            </Card>
            <Card className="bg-gradient-to-r from-emerald-500 to-emerald-600 shadow-sm rounded-lg p-3 flex items-center gap-3">
              <div className="p-2 bg-white/20 rounded-lg">
                <CheckCircle className="h-6 w-6 text-white" />
              </div>
              <div>
                <div className="text-2xl font-bold text-white">{active}</div>
                <div className="text-white/90 text-sm">Active</div>
              </div>
            </Card>
            <div className="flex flex-row items-center justify-start md:justify-end gap-6 px-2 py-1 bg-white rounded-lg shadow-sm border border-slate-100">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {/* TODO export */}}
                className="border-slate-200 text-slate-700 hover:bg-slate-50 shadow-sm min-w-[110px]"
                title="Export to CSV"
              >
                <Download className="h-4 w-4 mr-2" /> Export
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => fileInputRef.current?.click()}
                className="border-slate-200 text-slate-700 hover:bg-slate-50 shadow-sm min-w-[110px]"
                title="Import from CSV"
              >
                <Upload className="h-4 w-4 mr-2" /> Import
              </Button>
            </div>
          </div>
        </div>

        {/* Filters Section */}
        <Card className="mb-6 border-slate-200 shadow-md rounded-xl">
          <CardContent className="p-6">
            <div className="flex flex-col md:flex-row gap-4">
              {/* Search Input */}
              <div className="relative flex-1">
                <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 text-slate-400 h-5 w-5" />
                <Input
                  placeholder="Search licenses..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-12 border-slate-300 bg-white text-slate-900 placeholder-slate-400 rounded-lg h-10"
                />
              </div>
              {/* Status Filter */}
              <div className="w-full sm:w-48">
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="border-slate-300 bg-white text-slate-900 rounded-lg h-10 w-full">
                    <SelectValue placeholder="All Statuses" />
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
            </div>
          </CardContent>
        </Card>

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
        <Dialog open={isModalOpen} onOpenChange={(v) => { if (!v) setIsFullscreen(false); setIsModalOpen(v); }}>
          <DialogContent className={`${isFullscreen ? 'max-w-[98vw] w-[98vw] h-[95vh] max-h-[95vh]' : 'max-w-4xl min-w-[400px] max-h-[80vh]'} overflow-y-auto rounded-2xl border-slate-200 shadow-2xl p-0 bg-white transition-[width,height] duration-300`}>
            <DialogHeader className={`bg-gradient-to-r from-indigo-500 to-indigo-600 text-white px-6 py-3 rounded-t-2xl flex flex-row items-center justify-between border-b border-indigo-400/20 ${isFullscreen ? 'h-[76px] min-h-[76px]' : 'h-[64px] min-h-[64px]'}`}>
              <div className="flex items-center gap-3">
                <Shield className="h-6 w-6" />
                <DialogTitle className="text-xl font-bold leading-none">
                  {editingLicense ? 'Edit License' : 'Add New License'}
                </DialogTitle>
              </div>
              <div className="flex gap-3 items-center ml-auto mr-6">
                <Button
                  type="button"
                  variant="outline"
                  title={isFullscreen ? 'Exit Fullscreen' : 'Expand'}
                  className={`bg-white text-indigo-600 hover:bg-indigo-50 font-semibold px-3 py-2 rounded-lg shadow-md transition-all duration-300 hover:scale-105 focus:ring-2 focus:ring-white/50 border-indigo-200 h-10 w-10 p-0 flex items-center justify-center`}
                  onClick={() => setIsFullscreen(f => !f)}
                >
                  {isFullscreen ? <Minimize2 className="h-5 w-5" /> : <Maximize2 className="h-5 w-5" />}
                </Button>
              </div>
            </DialogHeader>
            
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className={`px-6 pb-6 ${isFullscreen ? 'pt-1' : 'pt-2'}`}>
                <div className={`grid gap-6 mb-6 ${isFullscreen ? 'grid-cols-1 md:grid-cols-5 lg:grid-cols-6' : 'grid-cols-1 md:grid-cols-3'}`}>
                  {/* License Name */}
                  <FormField
                    control={form.control}
                    name="licenseName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="block text-sm font-medium text-slate-700">License Name</FormLabel>
                        <FormControl>
                          <Input 
                            className="w-full border-slate-300 rounded-lg px-3 py-2 text-base focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                            {...field} 
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {/* Issuing Authority Name (Dropdown) */}
                  <FormField
                    control={form.control}
                    name="issuingAuthorityName"
                    render={({ field }) => {
                      const valueInList = ISSUING_AUTHORITIES.includes(field.value || "");
                      return (
                        <FormItem>
                          <FormLabel className="block text-sm font-medium text-slate-700">Issuing Authority Name</FormLabel>
                          <Select
                            value={field.value || ''}
                            onValueChange={(val) => field.onChange(val)}
                          >
                            <FormControl>
                              <SelectTrigger className="w-full border-slate-300 rounded-lg px-3 py-2 text-base focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500">
                                <SelectValue placeholder="Select issuing authority" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent className="bg-white border border-slate-200 rounded-md shadow-lg max-h-[260px] overflow-hidden">
                              <div className="max-h-[240px] overflow-y-auto custom-scrollbar p-1">
                                <SelectGroup>
                                  <SelectLabel className="text-xs font-semibold tracking-wide text-slate-500 px-2 py-1 uppercase">Portal / System</SelectLabel>
                                  {ISSUING_AUTHORITIES.map(name => (
                                    <SelectItem key={name} value={name} className="pl-8 pr-3 py-2 text-sm data-[state=checked]:bg-indigo-50 data-[state=checked]:text-indigo-700">
                                      <span className="border-b border-dotted border-slate-300 pb-0.5 leading-snug inline-block w-full">{name}</span>
                                    </SelectItem>
                                  ))}
                                </SelectGroup>
                                {!valueInList && field.value && (
                                  <SelectItem value={field.value} className="pl-8 pr-3 py-2 text-sm italic text-slate-600 bg-amber-50">
                                    {field.value} (custom)
                                  </SelectItem>
                                )}
                              </div>
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      );
                    }}
                  />

                  {/* Start Date */}
                  <FormField
                    control={form.control}
                    name="startDate"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="block text-sm font-medium text-slate-700">Start Date</FormLabel>
                        <FormControl>
                          <Input 
                            type="date" 
                            className="w-full border-slate-300 rounded-lg px-3 py-2 text-base focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                            {...field} 
                          />
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
                        <FormLabel className="block text-sm font-medium text-slate-700">End Date</FormLabel>
                        <FormControl>
                          <Input 
                            type="date" 
                            className="w-full border-slate-300 rounded-lg px-3 py-2 text-base focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                            {...field} 
                          />
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
                        <FormLabel className="block text-sm font-medium text-slate-700">Renewal Fee</FormLabel>
                        <FormControl>
                          <Input 
                            type="number" 
                            min="0" 
                            step="0.01"
                            className="w-full border-slate-300 rounded-lg px-3 py-2 text-base text-right font-semibold focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
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
                        <FormLabel className="block text-sm font-medium text-slate-700">Status</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger className="w-full border-slate-300 rounded-lg px-3 py-2 text-base focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500">
                              <SelectValue placeholder="Select status" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent className="bg-white border border-slate-200 rounded-md shadow-lg p-0 overflow-hidden">
                            <div className="py-1">
                              <SelectItem value="Active" className="pl-8 pr-3 py-2 text-sm data-[state=checked]:bg-indigo-50 data-[state=checked]:text-indigo-700">Active</SelectItem>
                              <SelectItem value="Pending" className="pl-8 pr-3 py-2 text-sm data-[state=checked]:bg-indigo-50 data-[state=checked]:text-indigo-700">Pending</SelectItem>
                              <SelectItem value="Expired" className="pl-8 pr-3 py-2 text-sm data-[state=checked]:bg-indigo-50 data-[state=checked]:text-indigo-700">Expired</SelectItem>
                              <SelectItem value="Under Renewal" className="pl-8 pr-3 py-2 text-sm data-[state=checked]:bg-indigo-50 data-[state=checked]:text-indigo-700">Under Renewal</SelectItem>
                            </div>
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
                        <FormLabel className="block text-sm font-medium text-slate-700">Responsible Person</FormLabel>
                        <FormControl>
                          <Input 
                            className="w-full border-slate-300 rounded-lg px-3 py-2 text-base focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                            {...field} 
                          />
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
                        <FormLabel className="block text-sm font-medium text-slate-700">Department</FormLabel>
                        <FormControl>
                          <Input 
                            className="w-full border-slate-300 rounded-lg px-3 py-2 text-base focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                            {...field} 
                          />
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
                        <FormLabel className="block text-sm font-medium text-slate-700">Backup Contact</FormLabel>
                        <FormControl>
                          <Input 
                            className="w-full border-slate-300 rounded-lg px-3 py-2 text-base focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                            {...field} 
                          />
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
                        <FormLabel className="block text-sm font-medium text-slate-700">Issuing Authority Email</FormLabel>
                        <FormControl>
                          <Input 
                            type="email" 
                            className="w-full border-slate-300 rounded-lg px-3 py-2 text-base focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                            {...field} 
                          />
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
                        <FormLabel className="block text-sm font-medium text-slate-700">Issuing Authority Phone</FormLabel>
                        <FormControl>
                          <Input 
                            className="w-full border-slate-300 rounded-lg px-3 py-2 text-base focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                            {...field} 
                          />
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
                    <FormItem className="mb-6">
                      <FormLabel className="block text-sm font-medium text-slate-700">Details</FormLabel>
                      <FormControl>
                        <Textarea 
                          className="w-full border border-slate-400 rounded-lg px-3 py-2 text-base min-h-[100px] max-h-[140px] focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Form Actions */}
                <div className="flex justify-end gap-3 pt-4 border-t border-slate-200">
                  <Button 
                    type="button" 
                    variant="outline" 
                    className="border-slate-300 text-slate-700 hover:bg-slate-50 font-medium px-4 py-2"
                    onClick={() => setIsModalOpen(false)}
                  >
                    Cancel
                  </Button>
                  <Button 
                    type="submit" 
                    disabled={licenseMutation.isPending}
                    className="bg-gradient-to-r from-indigo-600 to-indigo-700 text-white font-medium px-4 py-2 shadow-md hover:shadow-lg"
                  >
                    {licenseMutation.isPending ? 'Saving...' : (editingLicense ? 'Update License' : 'Create License')}
                  </Button>
                </div>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}