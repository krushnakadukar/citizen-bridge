import { 
  User, 
  Mail, 
  Phone, 
  Shield, 
  Bell, 
  Lock,
  Eye,
  EyeOff,
  Save,
  Loader2
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { useState, useEffect } from "react";
import DashboardLayout from "@/components/layouts/DashboardLayout";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { logger } from "@/lib/logger";

const Profile = () => {
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  // Profile form state
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");

  // Fetch user profile on mount
  useEffect(() => {
    const fetchProfile = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        const { data: profile, error } = await supabase
          .from("profiles")
          .select("*")
          .eq("auth_user_id", user.id)
          .single();

        if (error) throw error;

        if (profile) {
          setFullName(profile.full_name || "");
          setEmail(profile.email || user.email || "");
          setPhone(profile.phone || "");
        }
      } catch (error) {
        logger.error("Error fetching profile", error);
        toast({
          title: "Error",
          description: "Failed to load profile data",
          variant: "destructive",
        });
      } finally {
        setLoading(false);
      }
    };

    fetchProfile();
  }, [toast]);

  const handleSaveProfile = async () => {
    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast({
          title: "Error",
          description: "You must be logged in to save changes",
          variant: "destructive",
        });
        return;
      }

      const { error } = await supabase
        .from("profiles")
        .update({
          full_name: fullName,
          phone: phone,
        })
        .eq("auth_user_id", user.id);

      if (error) throw error;

      toast({
        title: "Success",
        description: "Profile updated successfully",
      });
    } catch (error) {
      logger.error("Error saving profile", error);
      toast({
        title: "Error",
        description: "Failed to save profile changes",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  // Get initials for avatar
  const getInitials = () => {
    if (!fullName) return "U";
    const names = fullName.split(" ");
    if (names.length >= 2) {
      return `${names[0][0]}${names[1][0]}`.toUpperCase();
    }
    return fullName.substring(0, 2).toUpperCase();
  };

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center min-h-[400px]">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="max-w-4xl mx-auto space-y-8">
        {/* Header */}
        <div>
          <h1 className="font-heading text-3xl font-bold text-foreground">Profile Settings</h1>
          <p className="text-muted-foreground mt-1">Manage your account and preferences</p>
        </div>

        {/* Profile Info */}
        <Card className="border-border/50">
          <CardHeader>
            <CardTitle className="font-heading text-xl flex items-center gap-2">
              <User className="w-5 h-5" />
              Personal Information
            </CardTitle>
            <CardDescription>Update your personal details</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="flex items-center gap-6">
              <Avatar className="w-20 h-20">
                <AvatarFallback className="bg-primary text-primary-foreground text-2xl">
                  {getInitials()}
                </AvatarFallback>
              </Avatar>
              <div>
                <Button variant="outline" size="sm">Change Photo</Button>
                <p className="text-xs text-muted-foreground mt-2">JPG, PNG or GIF. Max 2MB.</p>
              </div>
            </div>

            <Separator />

            <div className="space-y-2">
              <Label htmlFor="fullName">Full Name</Label>
              <Input 
                id="fullName" 
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                className="h-11" 
                placeholder="Enter your full name"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="email">Email Address</Label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input 
                  id="email" 
                  type="email" 
                  value={email}
                  disabled
                  className="h-11 pl-10 bg-muted" 
                />
              </div>
              <p className="text-xs text-muted-foreground">Email cannot be changed</p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="phone">Phone Number</Label>
              <div className="relative">
                <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input 
                  id="phone" 
                  type="tel" 
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="+1 (555) 123-4567"
                  className="h-11 pl-10" 
                />
              </div>
            </div>

            <Button onClick={handleSaveProfile} disabled={saving} className="gap-2">
              {saving ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Save className="w-4 h-4" />
              )}
              {saving ? "Saving..." : "Save Changes"}
            </Button>
          </CardContent>
        </Card>

        {/* Security */}
        <Card className="border-border/50">
          <CardHeader>
            <CardTitle className="font-heading text-xl flex items-center gap-2">
              <Lock className="w-5 h-5" />
              Security
            </CardTitle>
            <CardDescription>Manage your password and security settings</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="currentPassword">Current Password</Label>
              <div className="relative">
                <Input
                  id="currentPassword"
                  type={showPassword ? "text" : "password"}
                  placeholder="Enter current password"
                  className="h-11 pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <div className="grid md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="newPassword">New Password</Label>
                <Input id="newPassword" type="password" placeholder="Enter new password" className="h-11" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="confirmPassword">Confirm New Password</Label>
                <Input id="confirmPassword" type="password" placeholder="Confirm new password" className="h-11" />
              </div>
            </div>

            <Separator />

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Shield className="w-5 h-5 text-primary" />
                <div>
                  <p className="font-medium text-foreground">Two-Factor Authentication</p>
                  <p className="text-sm text-muted-foreground">Add an extra layer of security</p>
                </div>
              </div>
              <Switch />
            </div>

            <Button variant="outline" className="gap-2">
              Update Password
            </Button>
          </CardContent>
        </Card>

        {/* Notifications */}
        <Card className="border-border/50">
          <CardHeader>
            <CardTitle className="font-heading text-xl flex items-center gap-2">
              <Bell className="w-5 h-5" />
              Notification Preferences
            </CardTitle>
            <CardDescription>Choose how you want to be notified</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {[
              { label: "Email Notifications", description: "Receive updates via email", defaultChecked: true },
              { label: "SMS Notifications", description: "Get text messages for urgent updates", defaultChecked: false },
              { label: "Report Status Updates", description: "When your report status changes", defaultChecked: true },
              { label: "Budget Transparency Alerts", description: "New project updates in your area", defaultChecked: true },
              { label: "Weekly Digest", description: "Summary of activity in your region", defaultChecked: false },
            ].map((item, index) => (
              <div key={index} className="flex items-center justify-between py-2">
                <div>
                  <p className="font-medium text-foreground">{item.label}</p>
                  <p className="text-sm text-muted-foreground">{item.description}</p>
                </div>
                <Switch defaultChecked={item.defaultChecked} />
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Privacy */}
        <Card className="border-border/50">
          <CardHeader>
            <CardTitle className="font-heading text-xl">Privacy Settings</CardTitle>
            <CardDescription>Control your data and privacy</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between py-2">
              <div>
                <p className="font-medium text-foreground">Default Anonymous Reporting</p>
                <p className="text-sm text-muted-foreground">Always submit reports anonymously</p>
              </div>
              <Switch />
            </div>
            <div className="flex items-center justify-between py-2">
              <div>
                <p className="font-medium text-foreground">Profile Visibility</p>
                <p className="text-sm text-muted-foreground">Allow officials to see your profile when reviewing reports</p>
              </div>
              <Switch defaultChecked />
            </div>

            <Separator />

            <div className="flex flex-col sm:flex-row gap-3">
              <Button variant="outline">Download My Data</Button>
              <Button variant="destructive">Delete Account</Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
};

export default Profile;
