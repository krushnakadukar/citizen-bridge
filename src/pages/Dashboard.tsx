import { useState, useEffect, useCallback } from "react";
import { 
  FileText, 
  CheckCircle2, 
  Clock, 
  TrendingUp, 
  Plus, 
  Eye,
  Bell,
  ChevronRight,
  Loader2,
  AlertCircle
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Link } from "react-router-dom";
import DashboardLayout from "@/components/layouts/DashboardLayout";
import { supabase } from "@/integrations/supabase/client";
import { formatDistanceToNow } from "date-fns";
import { toast } from "sonner";

interface Report {
  id: string;
  title: string;
  status: string;
  category: string;
  created_at: string;
}

interface Notification {
  id: string;
  title: string;
  body: string | null;
  created_at: string;
  is_read: boolean;
}

interface Stats {
  total: number;
  resolved: number;
  inProgress: number;
  pending: number;
}

const Dashboard = () => {
  const [loading, setLoading] = useState(true);
  const [userName, setUserName] = useState("User");
  const [profileId, setProfileId] = useState<string | null>(null);
  const [stats, setStats] = useState<Stats>({ total: 0, resolved: 0, inProgress: 0, pending: 0 });
  const [recentReports, setRecentReports] = useState<Report[]>([]);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);

  const calculateStats = useCallback((reports: Report[]) => {
    const total = reports.length;
    const resolved = reports.filter(r => r.status === "resolved").length;
    const inProgress = reports.filter(r => ["in_progress", "under_review", "assigned"].includes(r.status)).length;
    const pending = reports.filter(r => r.status === "submitted").length;
    return { total, resolved, inProgress, pending };
  }, []);

  const fetchDashboardData = useCallback(async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        setLoading(false);
        return;
      }

      // Fetch user profile
      const { data: profile } = await supabase
        .from("profiles")
        .select("id, full_name")
        .eq("auth_user_id", user.id)
        .maybeSingle();

      if (profile?.full_name) {
        setUserName(profile.full_name.split(" ")[0]);
      }

      if (!profile?.id) {
        setLoading(false);
        return;
      }

      setProfileId(profile.id);

      // Fetch reports for this user
      const { data: reports } = await supabase
        .from("reports")
        .select("id, title, status, category, created_at")
        .eq("reporter_user_id", profile.id)
        .eq("is_anonymous", false)
        .order("created_at", { ascending: false });

      if (reports) {
        setStats(calculateStats(reports));
        setRecentReports(reports.slice(0, 5));
      }

      // Fetch notifications
      const { data: notifs } = await supabase
        .from("notifications")
        .select("id, title, body, created_at, is_read")
        .eq("user_id", profile.id)
        .order("created_at", { ascending: false })
        .limit(5);

      if (notifs) {
        setNotifications(notifs);
        setUnreadCount(notifs.filter(n => !n.is_read).length);
      }

    } catch (error) {
      console.error("Error fetching dashboard data:", error);
    } finally {
      setLoading(false);
    }
  }, [calculateStats]);

  // Initial data fetch
  useEffect(() => {
    fetchDashboardData();
  }, [fetchDashboardData]);

  // Real-time subscriptions
  useEffect(() => {
    if (!profileId) return;

    // Subscribe to report changes (new reports, status updates)
    const reportsChannel = supabase
      .channel('dashboard-reports')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'reports',
          filter: `reporter_user_id=eq.${profileId}`
        },
        (payload) => {
          console.log('New report:', payload);
          const newReport = payload.new as Report;
          setRecentReports(prev => [newReport, ...prev].slice(0, 5));
          setStats(prev => ({
            ...prev,
            total: prev.total + 1,
            pending: prev.pending + 1
          }));
          toast.info("New report submitted");
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'reports',
          filter: `reporter_user_id=eq.${profileId}`
        },
        (payload) => {
          console.log('Report updated:', payload);
          const updatedReport = payload.new as Report;
          setRecentReports(prev => 
            prev.map(r => r.id === updatedReport.id ? updatedReport : r)
          );
          // Refetch to update stats correctly
          fetchDashboardData();
        }
      )
      .subscribe();

    // Subscribe to new notifications
    const notificationsChannel = supabase
      .channel('dashboard-notifications')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${profileId}`
        },
        (payload) => {
          console.log('New notification:', payload);
          const newNotif = payload.new as Notification;
          setNotifications(prev => [newNotif, ...prev].slice(0, 5));
          setUnreadCount(prev => prev + 1);
          toast.info(newNotif.title);
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${profileId}`
        },
        (payload) => {
          console.log('Notification updated:', payload);
          const updatedNotif = payload.new as Notification;
          setNotifications(prev =>
            prev.map(n => n.id === updatedNotif.id ? updatedNotif : n)
          );
          // Recalculate unread count
          setNotifications(prev => {
            setUnreadCount(prev.filter(n => !n.is_read).length);
            return prev;
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(reportsChannel);
      supabase.removeChannel(notificationsChannel);
    };
  }, [profileId, fetchDashboardData]);

  const getStatusBadge = (status: string) => {
    const statusMap: Record<string, { label: string; variant: "default" | "secondary" | "outline"; className: string }> = {
      submitted: { label: "Pending", variant: "outline", className: "" },
      under_review: { label: "Under Review", variant: "secondary", className: "bg-accent text-accent-foreground" },
      assigned: { label: "Assigned", variant: "secondary", className: "bg-accent text-accent-foreground" },
      in_progress: { label: "In Progress", variant: "secondary", className: "bg-accent text-accent-foreground" },
      resolved: { label: "Resolved", variant: "default", className: "bg-success text-success-foreground" },
      rejected: { label: "Rejected", variant: "outline", className: "bg-destructive/10 text-destructive" },
    };
    return statusMap[status] || { label: status, variant: "outline", className: "" };
  };

  const formatDate = (dateString: string) => {
    try {
      return formatDistanceToNow(new Date(dateString), { addSuffix: true });
    } catch {
      return dateString;
    }
  };

  const statsData = [
    { label: "Total Reports", value: stats.total.toString(), icon: FileText, color: "text-primary" },
    { label: "Resolved", value: stats.resolved.toString(), icon: CheckCircle2, color: "text-success" },
    { label: "In Progress", value: stats.inProgress.toString(), icon: Clock, color: "text-accent" },
    { label: "Pending", value: stats.pending.toString(), icon: AlertCircle, color: "text-muted-foreground" },
  ];

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center min-h-[60vh]">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-8">
        {/* Welcome Section */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="font-heading text-3xl font-bold text-foreground">Welcome back, {userName}</h1>
            <p className="text-muted-foreground mt-1">Here's what's happening with your reports</p>
          </div>
          <Link to="/submit-report">
            <Button size="lg" className="gap-2">
              <Plus className="w-5 h-5" />
              Submit New Report
            </Button>
          </Link>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {statsData.map((stat) => (
            <Card key={stat.label} className="border-border/50">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">{stat.label}</p>
                    <p className="text-3xl font-bold text-foreground mt-1">{stat.value}</p>
                  </div>
                  <div className={`w-12 h-12 rounded-xl bg-muted flex items-center justify-center ${stat.color}`}>
                    <stat.icon className="w-6 h-6" />
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Main Content Grid */}
        <div className="grid lg:grid-cols-3 gap-6">
          {/* Recent Reports */}
          <Card className="lg:col-span-2 border-border/50">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="font-heading text-xl">Recent Reports</CardTitle>
              <Link to="/my-reports">
                <Button variant="ghost" size="sm" className="gap-1">
                  View All <ChevronRight className="w-4 h-4" />
                </Button>
              </Link>
            </CardHeader>
            <CardContent>
              {recentReports.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <FileText className="w-12 h-12 mx-auto mb-3 opacity-50" />
                  <p>No reports yet</p>
                  <Link to="/submit-report">
                    <Button variant="link" className="mt-2">Submit your first report</Button>
                  </Link>
                </div>
              ) : (
                <div className="space-y-4">
                  {recentReports.map((report) => {
                    const badge = getStatusBadge(report.status);
                    return (
                      <div
                        key={report.id}
                        className="flex items-center justify-between p-4 rounded-xl bg-muted/50 hover:bg-muted transition-colors"
                      >
                        <div className="flex items-center gap-4">
                          <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                            <FileText className="w-5 h-5 text-primary" />
                          </div>
                          <div>
                            <p className="font-medium text-foreground">{report.title}</p>
                            <p className="text-sm text-muted-foreground capitalize">
                              {report.category} • {formatDate(report.created_at)}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          <Badge variant={badge.variant} className={badge.className}>
                            {badge.label}
                          </Badge>
                          <Link to={`/reports/${report.id}`}>
                            <Button variant="ghost" size="icon">
                              <Eye className="w-4 h-4" />
                            </Button>
                          </Link>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Notifications */}
          <Card className="border-border/50">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="font-heading text-xl flex items-center gap-2">
                <Bell className="w-5 h-5" />
                Notifications
              </CardTitle>
              {unreadCount > 0 && <Badge variant="secondary">{unreadCount} new</Badge>}
            </CardHeader>
            <CardContent>
              {notifications.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Bell className="w-12 h-12 mx-auto mb-3 opacity-50" />
                  <p>No notifications</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {notifications.map((notification) => (
                    <div
                      key={notification.id}
                      className={`p-3 rounded-lg transition-colors cursor-pointer ${
                        notification.is_read ? "bg-muted/50 hover:bg-muted" : "bg-primary/5 hover:bg-primary/10"
                      }`}
                    >
                      <p className="text-sm font-medium text-foreground">{notification.title}</p>
                      {notification.body && (
                        <p className="text-sm text-muted-foreground mt-1">{notification.body}</p>
                      )}
                      <p className="text-xs text-muted-foreground mt-1">{formatDate(notification.created_at)}</p>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Quick Actions */}
        <Card className="border-border/50">
          <CardHeader>
            <CardTitle className="font-heading text-xl">Quick Actions</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <Link to="/submit-report">
                <Button variant="outline" className="w-full h-20 flex-col gap-2">
                  <Plus className="w-6 h-6" />
                  <span>New Report</span>
                </Button>
              </Link>
              <Link to="/transparency">
                <Button variant="outline" className="w-full h-20 flex-col gap-2">
                  <TrendingUp className="w-6 h-6" />
                  <span>View Budgets</span>
                </Button>
              </Link>
              <Link to="/my-reports">
                <Button variant="outline" className="w-full h-20 flex-col gap-2">
                  <FileText className="w-6 h-6" />
                  <span>My Reports</span>
                </Button>
              </Link>
              <Link to="/profile">
                <Button variant="outline" className="w-full h-20 flex-col gap-2">
                  <Eye className="w-6 h-6" />
                  <span>Profile</span>
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
};

export default Dashboard;
