import { 
  FileText, 
  Search, 
  Filter, 
  Eye,
  Download,
  Plus,
  ChevronDown
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Link } from "react-router-dom";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import DashboardLayout from "@/components/layouts/DashboardLayout";

const MyReports = () => {
  const reports = [
    {
      id: "RPT-1234",
      title: "Pothole on Main Street near City Mall",
      category: "Roads",
      type: "Infrastructure",
      status: "In Progress",
      severity: "High",
      date: "Nov 28, 2024",
      lastUpdate: "2 days ago",
    },
    {
      id: "RPT-1233",
      title: "Broken Street Light at Park Avenue",
      category: "Lighting",
      type: "Infrastructure",
      status: "Resolved",
      severity: "Medium",
      date: "Nov 25, 2024",
      lastUpdate: "5 days ago",
    },
    {
      id: "RPT-1232",
      title: "Water Leak near Central Park",
      category: "Water",
      type: "Infrastructure",
      status: "Pending",
      severity: "Critical",
      date: "Nov 22, 2024",
      lastUpdate: "1 week ago",
    },
    {
      id: "RPT-1231",
      title: "Negligence at Municipal Office",
      category: "Misconduct",
      type: "Misconduct",
      status: "Under Review",
      severity: "High",
      date: "Nov 20, 2024",
      lastUpdate: "1 week ago",
    },
    {
      id: "RPT-1230",
      title: "Damaged Footpath on Market Road",
      category: "Roads",
      type: "Infrastructure",
      status: "Resolved",
      severity: "Low",
      date: "Nov 15, 2024",
      lastUpdate: "2 weeks ago",
    },
  ];

  const getStatusColor = (status: string) => {
    switch (status) {
      case "Resolved":
        return "bg-success text-success-foreground";
      case "In Progress":
        return "bg-accent text-accent-foreground";
      case "Pending":
        return "bg-muted text-muted-foreground";
      case "Under Review":
        return "bg-primary text-primary-foreground";
      default:
        return "bg-muted text-muted-foreground";
    }
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case "Critical":
        return "text-destructive";
      case "High":
        return "text-accent";
      case "Medium":
        return "text-primary";
      case "Low":
        return "text-success";
      default:
        return "text-muted-foreground";
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="font-heading text-3xl font-bold text-foreground">My Reports</h1>
            <p className="text-muted-foreground mt-1">Track and manage all your submitted reports</p>
          </div>
          <div className="flex gap-3">
            <Button variant="outline" className="gap-2">
              <Download className="w-4 h-4" />
              Export
            </Button>
            <Link to="/submit-report">
              <Button className="gap-2">
                <Plus className="w-4 h-4" />
                New Report
              </Button>
            </Link>
          </div>
        </div>

        {/* Filters */}
        <Card className="border-border/50">
          <CardContent className="p-4">
            <div className="flex flex-col md:flex-row gap-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input placeholder="Search by title, ID, or category..." className="pl-10 h-11" />
              </div>
              <Select>
                <SelectTrigger className="w-full md:w-40 h-11">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="in-progress">In Progress</SelectItem>
                  <SelectItem value="resolved">Resolved</SelectItem>
                  <SelectItem value="under-review">Under Review</SelectItem>
                </SelectContent>
              </Select>
              <Select>
                <SelectTrigger className="w-full md:w-40 h-11">
                  <SelectValue placeholder="Type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  <SelectItem value="infrastructure">Infrastructure</SelectItem>
                  <SelectItem value="misconduct">Misconduct</SelectItem>
                </SelectContent>
              </Select>
              <Button variant="outline" className="gap-2 h-11">
                <Filter className="w-4 h-4" />
                More Filters
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Reports List */}
        <Card className="border-border/50">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="font-heading text-xl">All Reports ({reports.length})</CardTitle>
            <Button variant="ghost" size="sm" className="gap-1 text-muted-foreground">
              Sort by Date <ChevronDown className="w-4 h-4" />
            </Button>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {reports.map((report) => (
                <div
                  key={report.id}
                  className="p-4 rounded-xl bg-muted/30 hover:bg-muted/50 transition-colors border border-border/50"
                >
                  <div className="flex flex-col lg:flex-row lg:items-center gap-4">
                    <div className="flex items-start gap-4 flex-1">
                      <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                        <FileText className="w-5 h-5 text-primary" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <p className="font-medium text-foreground">{report.title}</p>
                            <p className="text-sm text-muted-foreground mt-0.5">
                              {report.id} • {report.category} • {report.type}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-3 mt-2 text-sm">
                          <span className="text-muted-foreground">{report.date}</span>
                          <span className="text-muted-foreground">•</span>
                          <span className="text-muted-foreground">Updated {report.lastUpdate}</span>
                          <span className="text-muted-foreground">•</span>
                          <span className={`font-medium ${getSeverityColor(report.severity)}`}>
                            {report.severity} Severity
                          </span>
                        </div>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-3 lg:justify-end">
                      <Badge className={getStatusColor(report.status)}>{report.status}</Badge>
                      <Link to={`/reports/${report.id}`}>
                        <Button variant="outline" size="sm" className="gap-1">
                          <Eye className="w-4 h-4" />
                          View
                        </Button>
                      </Link>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Pagination */}
            <div className="flex items-center justify-between mt-6 pt-4 border-t border-border">
              <p className="text-sm text-muted-foreground">Showing 1-5 of 12 reports</p>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" disabled>Previous</Button>
                <Button variant="outline" size="sm">Next</Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
};

export default MyReports;
