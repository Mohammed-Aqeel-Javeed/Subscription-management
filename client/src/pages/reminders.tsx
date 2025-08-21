import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Clock, TriangleAlert, Calendar, Settings, Plus } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { Subscription, Reminder } from "@shared/types";

export default function Reminders() {
  // Category configuration with visibility settings
  const [categories, setCategories] = useState([
    { name: 'Software', visible: true, defaultDays: 7 },
    { name: 'Music', visible: true, defaultDays: 7 },
    { name: 'News', visible: true, defaultDays: 7 },
    { name: 'Business Tool', visible: true, defaultDays: 7 },
    { name: 'Cloud Storage', visible: true, defaultDays: 7 },
    { name: 'Regulatory', visible: true, defaultDays: 7 },
    { name: 'Entertainment', visible: true, defaultDays: 7 },
    { name: 'Others', visible: true, defaultDays: 7 },
  ]);

  // State for regulatory monthly day
  const [regulatoryMonthlyDay, setRegulatoryMonthlyDay] = useState(14);
  
  const [newCategoryName, setNewCategoryName] = useState('');

  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: subscriptions, isLoading: subscriptionsLoading } = useQuery<Subscription[]>({
    queryKey: ["/api/subscriptions"],
  });

  const { data: reminders, isLoading: remindersLoading } = useQuery<Reminder[]>({
    queryKey: ["/api/reminders"],
  });

  const updateReminderMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<Reminder> }) => 
      apiRequest("PUT", `/api/reminders/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/reminders"] });
      toast({
        title: "Success",
        description: "Reminder settings updated successfully",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update reminder",
        variant: "destructive",
      });
    },
  });

  // Calculate upcoming renewals with reminder details
  const subscriptionsWithReminders = subscriptions?.map(sub => {
    const reminder = reminders?.find(r => r.subscriptionId === sub.id);
    return { ...sub, reminder };
  }) || [];

  const upcomingRenewals = subscriptionsWithReminders.filter(sub => {
    const now = new Date();
    const renewalDate = new Date(sub.nextRenewal);
    const diffTime = renewalDate.getTime() - now.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays <= 30 && diffDays > 0;
  }).sort((a, b) => new Date(a.nextRenewal).getTime() - new Date(b.nextRenewal).getTime());

  const addNewCategory = () => {
    if (newCategoryName.trim() && !categories.find(c => c.name.toLowerCase() === newCategoryName.toLowerCase())) {
      setCategories(prev => [...prev, {
        name: newCategoryName.trim(),
        visible: true,
        defaultDays: 7,
      }]);
      setNewCategoryName('');
      toast({
        title: "Category Added",
        description: `${newCategoryName} category has been added successfully`,
      });
    }
  };
  // State for global email and WhatsApp notifications
  const [emailEnabled, setEmailEnabled] = useState(false);
  const [whatsappEnabled, setWhatsappEnabled] = useState(false);


  const updateCategoryVisibility = (categoryName: string, visible: boolean) => {
    setCategories(prev => prev.map(cat => 
      cat.name === categoryName ? { ...cat, visible } : cat
    ));
  };

  // Add missing updateCategoryDays function
  const updateCategoryDays = (categoryName: string, days: number) => {
    setCategories(prev => prev.map(cat =>
      cat.name === categoryName ? { ...cat, defaultDays: days } : cat
    ));
  };

  const saveCategorySettings = () => {
    toast({
      title: "Settings Saved",
      description: "Category configuration has been saved successfully",
    });
  };

  // Get visible categories for use in dropdowns and cards
  const visibleCategories = categories.filter(cat => cat.visible);

  const handleReminderUpdate = (reminderId: number, updates: Partial<Reminder>) => {
    updateReminderMutation.mutate({ id: reminderId, data: updates });
  };

  const getDaysUntilRenewal = (renewalDate: string) => {
    const now = new Date();
    const renewal = new Date(renewalDate);
    const diffTime = renewal.getTime() - now.getTime();
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  };

  const getRenewalBadge = (days: number) => {
    if (days <= 7) {
      return (
        <Badge className="bg-red-100 text-red-800">
          <TriangleAlert className="w-3 h-3 mr-1" />
          {days} days
        </Badge>
      );
    } else {
      return (
        <Badge className="bg-yellow-100 text-yellow-800">
          <Clock className="w-3 h-3 mr-1" />
          {days} days
        </Badge>
      );
    }
  };

  if (subscriptionsLoading || remindersLoading) {
    return (
      <div className="p-8">
        <div className="mb-8">
          <Skeleton className="h-8 w-48 mb-2" />
          <Skeleton className="h-4 w-96" />
        </div>
        <Card className="mb-8">
          <CardContent className="p-6">
            <Skeleton className="h-6 w-48 mb-4" />
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <Skeleton className="h-20" />
              <Skeleton className="h-20" />
              <Skeleton className="h-20" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <Skeleton className="h-6 w-48 mb-6" />
            <div className="space-y-4">
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-24 w-full" />
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-8">
      <div className="mb-8">
        <h2 className="text-3xl font-bold text-gray-900">Reminders</h2>
        <p className="text-gray-600 mt-2">Manage renewal reminders and notifications</p>
      </div>

      {/* Category-Based Settings */}
      <Card className="mb-8">
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Settings className="w-5 h-5" />
            <span>Category-Based Reminder Settings</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-6">
            <div className="space-y-6">
              {/* Add New Category */}
              <div className="flex items-center space-x-4">
                <Input
                  placeholder="Enter new category name"
                  value={newCategoryName}
                  onChange={(e) => setNewCategoryName(e.target.value)}
                  className="flex-1"
                />
                <Button onClick={addNewCategory} disabled={!newCategoryName.trim()}>
                  <span className="w-4 h-4 mr-2">+</span>
                  Add Category
                </Button>
              </div>

              {/* Category Management Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {categories.map((category) => {
                  const isRegulatory = category.name === 'Regulatory';
                  const cardColor = isRegulatory ? 'border-red-200 bg-red-50' : 
                                   category.name === 'Business Tools' ? 'border-blue-200 bg-blue-50' :
                                   'border-gray-200 bg-gray-50';
                  const textColor = isRegulatory ? 'text-red-900' : 
                                   category.name === 'Business Tools' ? 'text-blue-900' : 
                                   'text-gray-900';
                  const inputColor = isRegulatory ? 'text-red-700' : 
                                    category.name === 'Business Tools' ? 'text-blue-700' : 
                                    'text-gray-700';

                  return (
                    <Card key={category.name} className={`p-4 ${cardColor}`}>
                      <div className="flex items-center justify-between mb-3">
                        <h4 className={`font-medium ${textColor}`}>{category.name}</h4>
                        <div className="flex items-center space-x-2">
                          {isRegulatory && (
                            <Badge className="bg-red-100 text-red-800 text-xs">Special</Badge>
                          )}
                          <Checkbox
                            checked={category.visible}
                          onCheckedChange={(checked: boolean) => updateCategoryVisibility(category.name, checked)}
                            className="w-4 h-4"
                          />
                          <Label className="text-xs text-gray-600">Visible</Label>
                        </div>
                      </div>
                      
                      <div className="space-y-3">
                        <div className="flex items-center space-x-2">
                          <Label className={`text-sm ${inputColor} flex-1`}>
                            Default alert period:
                          </Label>
                          <div className="flex items-center space-x-1">
                            <Input
                              type="number"
                              min="1"
                              max="365"
                              value={category.defaultDays}
                              onChange={(e) => updateCategoryDays(category.name, parseInt(e.target.value) || 7)}
                              className="w-16 h-8 text-xs"
                            />
                            <span className="text-xs text-gray-600">days</span>
                          </div>
                        </div>
                        
                        {isRegulatory && (
                          <>
                            <div className="flex items-center space-x-2">
                              <Label className="text-sm text-red-700 flex-1">
                                Monthly reminder day:
                              </Label>
                              <div className="flex items-center space-x-1">
                                <Input
                                  type="number"
                                  min="1"
                                  max="31"
                                  value={regulatoryMonthlyDay}
                                  onChange={(e) => setRegulatoryMonthlyDay(parseInt(e.target.value) || 14)}
                                  className="w-16 h-8 text-xs"
                                />
                                <span className="text-xs text-gray-600">th</span>
                              </div>
                            </div>
                            <div className="text-xs text-red-600">
                              <Calendar className="w-3 h-3 inline mr-1" />
                              Monthly recurring alerts for compliance tracking
                            </div>
                          </>
                        )}
                      </div>
                    </Card>
                  );
                })}
              </div>
            </div>

            <div className="flex justify-between items-center pt-4 border-t">
              <div className="text-sm text-gray-600">
                These settings will automatically apply to new subscriptions based on their category.
              </div>
              <Button onClick={saveCategorySettings} className="flex items-center space-x-2">
                <Settings className="w-4 h-4" />
                <span>Save Category Settings</span>
              </Button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4 border-t">
              <div>
                <Label className="text-sm font-medium text-gray-700 mb-2 block">
                  Global Email Notifications
                </Label>
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="email-notifications"
                    checked={emailEnabled}
                    onCheckedChange={(checked: boolean) => setEmailEnabled(checked === true)}
                  />
                  <Label htmlFor="email-notifications" className="text-sm text-gray-700">
                    Enable email alerts for all subscriptions
                  </Label>
                </div>
              </div>

              <div>
                <Label className="text-sm font-medium text-gray-700 mb-2 block">
                  Global WhatsApp Notifications
                </Label>
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="whatsapp-notifications"
                    checked={whatsappEnabled}
                    onCheckedChange={(checked: boolean) => setWhatsappEnabled(checked === true)}
                  />
                  <Label htmlFor="whatsapp-notifications" className="text-sm text-gray-700">
                    Enable WhatsApp alerts (recommended for regulatory)
                  </Label>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Upcoming Renewals */}
      <Card>
        <CardHeader>
          <CardTitle>Upcoming Renewals</CardTitle>
        </CardHeader>
        <CardContent>
          {upcomingRenewals.length > 0 ? (
            <div className="space-y-6">
              {upcomingRenewals.map((subscription) => {
                const daysUntil = getDaysUntilRenewal(subscription.nextRenewal.toString());
                const reminder = subscription.reminder;
                const categoryConfig = categories.find(c => c.name === subscription.category);
                const defaultDays = categoryConfig?.defaultDays || 7;
                
                return (
                  <div key={subscription.id} className="p-6 hover:bg-gray-50 rounded-lg border border-gray-200">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-4">
                        <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center">
                          <div className="w-6 h-6 bg-primary rounded text-white text-xs flex items-center justify-center font-bold">
                            {subscription.serviceName.charAt(0)}
                          </div>
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center space-x-2">
                            <h4 className="text-sm font-medium text-gray-900">{subscription.serviceName}</h4>
                            <Badge className={subscription.category === 'Regulatory' ? 'bg-red-100 text-red-800' : 'bg-gray-100 text-gray-800'}>
                              {subscription.category}
                            </Badge>
                          </div>
                          <p className="text-sm text-gray-500">
                            Renews on {new Date(subscription.nextRenewal).toLocaleDateString()}
                          </p>
                          <p className="text-sm text-gray-500">
                            {parseFloat(String(subscription.amount)).toFixed(2)}/{subscription.billingCycle}
                          </p>
                          {reminder?.reminderType === 'monthly_recurring' && (
                            <div className="flex items-center space-x-1 mt-1">
                              <Calendar className="w-3 h-3 text-blue-600" />
                              <span className="text-xs text-blue-600">
                                Monthly reminder on {reminder.monthlyDay}th
                              </span>
                            </div>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center space-x-4">
                        <div className="text-right space-y-2">
                          {getRenewalBadge(daysUntil)}
                          <div className="text-xs text-gray-500">
                            Alert: {reminder?.alertDays || defaultDays} days
                          </div>
                        </div>
                        <div className="flex flex-col space-y-2">
                          <div className="flex items-center space-x-2">
                            <Input
                              type="number"
                              min="1"
                              max="365"
                              value={reminder?.alertDays || defaultDays}
                              onChange={(e) => reminder && handleReminderUpdate(reminder.id, { alertDays: Number(e.target.value) })}
                              className="w-16 h-8 text-xs"
                              placeholder="Days"
                            />
                            <span className="text-xs text-gray-600">days</span>
                          </div>
                          <div className="flex items-center space-x-2">
                            <Label className="flex items-center space-x-1">
                              <Checkbox 
                                checked={reminder?.emailEnabled || false}
                                onCheckedChange={(checked: boolean) => reminder && handleReminderUpdate(reminder.id, { emailEnabled: Boolean(checked) })}
                              />
                              <span className="text-xs text-gray-600">Email</span>
                            </Label>
                            <Label className="flex items-center space-x-1">
                              <Checkbox 
                                checked={reminder?.whatsappEnabled || false}
                                onCheckedChange={(checked: boolean) => reminder && handleReminderUpdate(reminder.id, { whatsappEnabled: Boolean(checked) })}
                              />
                              <span className="text-xs text-gray-600">WhatsApp</span>
                            </Label>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="text-center py-12 text-gray-500">
              <Clock className="w-12 h-12 mx-auto mb-4 text-gray-300" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">No Upcoming Renewals</h3>
              <p className="text-gray-600">
                You don't have any subscriptions renewing in the next 30 days.
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
