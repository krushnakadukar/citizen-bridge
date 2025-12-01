import { 
  FileText, 
  CheckCircle2, 
  Clock, 
  TrendingUp, 
  Plus, 
  Eye,
  Bell,
  ChevronRight
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Link } from "react-router-dom";
import DashboardLayout from "@/components/layouts/DashboardLayout";

const Dashboard = () => {
  const stats = [
    { label: "Total Reports", value: "12", icon: FileText, color: "text-primary" },
    { label: "Resolved", value: "8", icon: CheckCircle2, color: "text-success" },
    { label: "In Progress", value: "3", icon: Clock, color: "text-accent" },
    { label: "Impact Score", value: "847", icon: TrendingUp, color: "text-primary" },
  ];

  const recentReports = [
    { id: 1, title: "Pothole on Main Street", status: "In Progress", date: "2 days ago", category: "Roads" },
    { id: 2, title: "Broken Street Light", status: "Resolved", date: "5 days ago", category: "Lighting" },
    { id: 3, title: "Water Leak near Park", status: "Pending", date: "1 week ago", category: "Water" },
  ];

  const notifications = [
    { id: 1, message: "Your report #1234 has been assigned to the Roads Department", time: "2 hours ago" },
    { id: 2, message: "Budget update: New road repair fund released", time: "1 day ago" },
    { id: 3, message: "Your report #1232 has been resolved", time: "3 days ago" },
  ];

  return (
    <DashboardLayout>
      <div className="space-y-8">
        {/* Welcome Section */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="font-heading text-3xl font-bold text-foreground">Welcome back, John</h1>
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
          {stats.map((stat) => (
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
              <div className="space-y-4">
                {recentReports.map((report) => (
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
                        <p className="text-sm text-muted-foreground">{report.category} • {report.date}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <Badge
                        variant={
                          report.status === "Resolved"
                            ? "default"
                            : report.status === "In Progress"
                            ? "secondary"
                            : "outline"
                        }
                        className={
                          report.status === "Resolved"
                            ? "bg-success text-success-foreground"
                            : report.status === "In Progress"
                            ? "bg-accent text-accent-foreground"
                            : ""
                        }
                      >
                        {report.status}
                      </Badge>
                      <Button variant="ghost" size="icon">
                        <Eye className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Notifications */}
          <Card className="border-border/50">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="font-heading text-xl flex items-center gap-2">
                <Bell className="w-5 h-5" />
                Notifications
              </CardTitle>
              <Badge variant="secondary">3 new</Badge>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {notifications.map((notification) => (
                  <div
                    key={notification.id}
                    className="p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors cursor-pointer"
                  >
                    <p className="text-sm text-foreground">{notification.message}</p>
                    <p className="text-xs text-muted-foreground mt-1">{notification.time}</p>
                  </div>
                ))}
              </div>
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
