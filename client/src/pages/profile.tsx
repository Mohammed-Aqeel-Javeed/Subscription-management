import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { User, Shield, Eye, EyeOff, Lock, Camera } from "lucide-react";
import { useUser } from "@/context/UserContext";
import { apiFetch } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";

export default function Profile() {
  const { user, isLoading } = useUser();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<"profile" | "security">("profile");
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [profileImage, setProfileImage] = useState<string | null>(null);

  const [isEditingName, setIsEditingName] = useState(true);
  const [fullName, setFullName] = useState("");
  const [isEditingEmail, setIsEditingEmail] = useState(false);
  const [email, setEmail] = useState("");
  const [isSavingProfile, setIsSavingProfile] = useState(false);

  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isSavingPassword, setIsSavingPassword] = useState(false);

  useEffect(() => {
    setFullName(user?.fullName || "");
  }, [user?.fullName]);

  useEffect(() => {
    setEmail(user?.email || "");
  }, [user?.email]);

  useEffect(() => {
    // Ensure the displayed image survives navigation and refresh (comes from /api/me)
    setProfileImage(user?.profileImage || null);
  }, [user?.profileImage]);

  const getInitials = (name: string) => {
    if (!name) return "U";
    const parts = name.split(" ");
    if (parts.length >= 2) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return name.substring(0, 2).toUpperCase();
  };

  const formatRole = (role: string) => {
    if (!role) return "Employee";
    return role.split("_").map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(" ");
  };

  const handleImageUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        const dataUrl = reader.result as string;
        setProfileImage(dataUrl);

        // Persist immediately so it shows after refresh
        (async () => {
          try {
            const res = await apiFetch("/api/me", {
              method: "PUT",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ profileImage: dataUrl }),
            });

            if (!res.ok) {
              const data = await res.json().catch(() => null);
              throw new Error(data?.message || "Failed to upload image");
            }

            const updatedUser = await res.json().catch(() => null);
            if (updatedUser) {
              queryClient.setQueryData(["/api/me"], updatedUser);
            } else {
              await queryClient.invalidateQueries({ queryKey: ["/api/me"] });
            }
            toast({ title: "Updated", description: "Profile photo updated" });
          } catch (err: any) {
            toast({
              title: "Upload failed",
              description: err?.message || "Could not upload your photo",
              variant: "destructive",
            });
          }
        })();
      };
      reader.readAsDataURL(file);
    }
  };

  const saveProfile = async () => {
    try {
      const next = fullName.trim();
      const nextEmail = email.trim().toLowerCase();

      const currentName = (user?.fullName || "").trim();
      const currentEmail = (user?.email || "").trim().toLowerCase();

      if (next === currentName && nextEmail === currentEmail) {
        toast({ title: "No changes", description: "Nothing to update" });
        return;
      }

      if (!next) {
        toast({ title: "Invalid name", description: "Full name is required", variant: "destructive" });
        return;
      }
      if (!nextEmail) {
        toast({ title: "Invalid email", description: "Email is required", variant: "destructive" });
        return;
      }

      setIsSavingProfile(true);

      const res = await apiFetch("/api/me", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fullName: next, email: nextEmail }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.message || "Failed to update profile");
      }

      const updatedUser = await res.json().catch(() => null);
      if (updatedUser) {
        queryClient.setQueryData(["/api/me"], updatedUser);
      } else {
        await queryClient.invalidateQueries({ queryKey: ["/api/me"] });
      }
      setIsEditingName(false);
      setIsEditingEmail(false);
      toast({ title: "Updated", description: "Your profile was updated" });
    } catch (err: any) {
      toast({
        title: "Update failed",
        description: err?.message || "Could not update your profile",
        variant: "destructive",
      });
    } finally {
      setIsSavingProfile(false);
    }
  };

  const savePassword = async () => {
    try {
      if (!newPassword || newPassword.length < 6) {
        toast({ title: "Weak password", description: "New password must be at least 6 characters", variant: "destructive" });
        return;
      }
      if (newPassword !== confirmPassword) {
        toast({ title: "Passwords don't match", description: "Confirm password must match", variant: "destructive" });
        return;
      }

      setIsSavingPassword(true);
      const res = await apiFetch("/api/me", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ newPassword }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.message || "Failed to update password");
      }

      setNewPassword("");
      setConfirmPassword("");
      toast({ title: "Updated", description: "Your password was updated" });
    } catch (err: any) {
      toast({
        title: "Update failed",
        description: err?.message || "Could not update your password",
        variant: "destructive",
      });
    } finally {
      setIsSavingPassword(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 p-6">
        <div className="max-w-2xl mx-auto space-y-6">
          <Card className="p-8 rounded-2xl shadow-md">
            <div className="text-sm text-gray-600">Loading profile…</div>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 p-6">
      <div className="max-w-2xl mx-auto space-y-6">
        {/* Header Card with Gradient */}
        <Card className="bg-gradient-to-r from-indigo-500 via-purple-500 to-indigo-600 text-white p-8 rounded-2xl shadow-lg">
          <div className="flex items-center gap-6">
            <div className="relative">
              <div className="h-24 w-24 bg-white rounded-full flex items-center justify-center overflow-hidden border-4 border-white shadow-lg">
                {profileImage ? (
                  <img src={profileImage} alt="Profile" className="h-full w-full object-cover" />
                ) : (
                  <span className="text-4xl font-bold text-indigo-600">
                    {getInitials(user?.fullName || user?.email || "User")}
                  </span>
                )}
              </div>
              
              {/* Active Status Indicator */}
              <div className="absolute bottom-1 right-1 h-6 w-6 bg-emerald-400 rounded-full border-3 border-white"></div>
              
              {/* Camera Upload Button */}
              <label className="absolute bottom-0 right-0 h-8 w-8 bg-indigo-600 rounded-full flex items-center justify-center cursor-pointer hover:bg-indigo-700 transition-colors shadow-lg border-2 border-white">
                <Camera className="h-4 w-4 text-white" />
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleImageUpload}
                  className="hidden"
                />
              </label>
            </div>
            <div className="flex-1">
              <h1 className="text-3xl font-bold mb-2">{user?.fullName || user?.email || "User"}</h1>
              <div className="inline-flex items-center gap-2 px-4 py-1.5 bg-indigo-200 bg-opacity-40 rounded-full">
                <div className="h-5 w-5 bg-emerald-400 rounded-full flex items-center justify-center flex-shrink-0">
                  <svg className="h-3 w-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <span className="text-sm font-medium text-white">Active {formatRole(user?.role || "employee")}</span>
              </div>
            </div>
          </div>
        </Card>

        {/* Tabs */}
        <div className="flex gap-2 border-b border-gray-200">
          <button
            onClick={() => setActiveTab("profile")}
            className={`px-6 py-3 font-medium text-sm transition-colors border-b-2 ${
              activeTab === "profile"
                ? "border-indigo-500 text-indigo-600"
                : "border-transparent text-gray-600 hover:text-gray-900"
            }`}
          >
            <div className="flex items-center gap-2">
              <User className="h-4 w-4" />
              Profile
            </div>
          </button>
          <button
            onClick={() => setActiveTab("security")}
            className={`px-6 py-3 font-medium text-sm transition-colors border-b-2 ${
              activeTab === "security"
                ? "border-indigo-500 text-indigo-600"
                : "border-transparent text-gray-600 hover:text-gray-900"
            }`}
          >
            <div className="flex items-center gap-2">
              <Shield className="h-4 w-4" />
              Security
            </div>
          </button>
        </div>

        {/* Profile Tab */}
        {activeTab === "profile" && (
          <Card className="p-6 rounded-2xl shadow-md">
            <div className="flex items-center gap-2 mb-6">
              <div className="h-8 w-8 bg-indigo-100 rounded-lg flex items-center justify-center">
                <User className="h-4 w-4 text-indigo-600" />
              </div>
              <h2 className="text-lg font-bold text-gray-900">Personal Information</h2>
            </div>

            <div className="space-y-4">
              {/* Full Name */}
              <div>
                <label className="block text-sm font-medium text-gray-600 mb-2">Full Name</label>
                <div className="relative">
                  <Input
                    type="text"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    disabled={!isEditingName}
                    className="bg-gray-50 border-gray-200 text-gray-700 pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setIsEditingName((v) => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  >
                    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                    </svg>
                  </button>
                </div>
              </div>

              {/* Email Address */}
              <div>
                <label className="block text-sm font-medium text-gray-600 mb-2">Email Address</label>
                <div className="relative">
                  <Input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    disabled={!isEditingEmail}
                    className="bg-gray-50 border-gray-200 text-gray-700 pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setIsEditingEmail((v) => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  >
                    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                    </svg>
                  </button>
                </div>
              </div>

              <Button
                onClick={saveProfile}
                disabled={isSavingProfile}
                className="w-full bg-gradient-to-r from-indigo-500 to-indigo-600 hover:from-indigo-600 hover:to-indigo-700 text-white py-6 rounded-xl font-medium text-base shadow-lg"
              >
                <User className="h-4 w-4 mr-2" />
                {isSavingProfile ? "Updating…" : "Update Profile"}
              </Button>
            </div>
          </Card>
        )}

        {/* Security Tab */}
        {activeTab === "security" && (
          <Card className="p-6 rounded-2xl shadow-md">
            <div className="flex items-center gap-2 mb-6">
              <div className="h-8 w-8 bg-indigo-100 rounded-lg flex items-center justify-center">
                <Shield className="h-4 w-4 text-indigo-600" />
              </div>
              <h2 className="text-lg font-bold text-gray-900">Change Password</h2>
            </div>

            <div className="space-y-4">
              {/* New Password */}
              <div>
                <label className="block text-sm font-medium text-gray-600 mb-2">New Password</label>
                <div className="relative">
                  <Input
                    type={showNewPassword ? "text" : "password"}
                    placeholder="Enter new password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    autoComplete="new-password"
                    className="bg-gray-50 border-gray-200 pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowNewPassword(!showNewPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  >
                    {showNewPassword ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </button>
                </div>
              </div>

              {/* Confirm New Password */}
              <div>
                <label className="block text-sm font-medium text-gray-600 mb-2">Confirm New Password</label>
                <div className="relative">
                  <Input
                    type={showConfirmPassword ? "text" : "password"}
                    placeholder="Re-enter new password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    autoComplete="new-password"
                    className="bg-gray-50 border-gray-200 pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  >
                    {showConfirmPassword ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </button>
                </div>
              </div>

              {/* Update Password Button */}
              <Button 
                className="w-full bg-gradient-to-r from-indigo-500 to-indigo-600 hover:from-indigo-600 hover:to-indigo-700 text-white py-6 rounded-xl font-medium text-base shadow-lg"
                onClick={savePassword}
                disabled={isSavingPassword}
              >
                <Lock className="h-4 w-4 mr-2" />
                {isSavingPassword ? "Updating…" : "Update Password"}
              </Button>
            </div>
          </Card>
        )}
      </div>
    </div>
  );
}
