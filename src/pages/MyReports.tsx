import { useEffect, useState, useCallback } from "react";
import { 
  FileText, 
  Search, 
  Filter, 
  Eye,
  Download,
  Plus,
  ChevronDown,
  Loader2,
  ChevronLeft,
  ChevronRight
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Link, useNavigate } from "react-router-dom";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import DashboardLayout from "@/components/layouts/DashboardLayout";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import type { Tables, Enums } from "@/integrations/supabase/types";
import { logger } from "@/lib/logger";

type Report = Tables<"reports">;
type ReportStatus = Enums<"report_status">;
type ReportType = Enums<"report_type">;

const ITEMS_PER_PAGE = 10;

const MyReports = () => {
  const [reports, setReports] = useState<Report[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<ReportStatus | "all">("all");
  const [typeFilter, setTypeFilter] = useState<ReportType | "all">("all");
  const [currentPage, setCurrentPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [profileId, setProfileId] = useState<string | null>(null);
  const navigate = useNavigate();
  const { toast } = useToast();

  // Debounce search term
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchTerm);
      setCurrentPage(1); // Reset to first page on search
    }, 300);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  // Reset page when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [statusFilter, typeFilter]);

  // Get user profile on mount
  useEffect(() => {
    const getProfile = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        toast({
          title: "Authentication Required",
          description: "Please log in to view your reports.",
          variant: "destructive",
        });
        navigate("/login");
        return;
      }

      const { data: profile } = await supabase
        .from("profiles")
        .select("id")
        .eq("auth_user_id", user.id)
        .maybeSingle();

      if (profile) {
        setProfileId(profile.id);
      } else {
        setIsLoading(false);
      }
    };

    getProfile();
  }, [navigate, toast]);

  const fetchReports = useCallback(async () => {
    if (!profileId) return;

    setIsLoading(true);
    try {
      // Build query with filters
      let query = supabase
        .from("reports")
        .select("*", { count: "exact" })
        .eq("reporter_user_id", profileId);

      // Apply status filter
      if (statusFilter !== "all") {
        query = query.eq("status", statusFilter);
      }

      // Apply type filter
      if (typeFilter !== "all") {
        query = query.eq("type", typeFilter);
      }

      // Apply search filter (title, category, or description)
      if (debouncedSearch) {
        query = query.or(`title.ilike.%${debouncedSearch}%,category.ilike.%${debouncedSearch}%,description.ilike.%${debouncedSearch}%`);
      }

      // Apply pagination
      const from = (currentPage - 1) * ITEMS_PER_PAGE;
      const to = from + ITEMS_PER_PAGE - 1;

      const { data, error, count } = await query
        .order("created_at", { ascending: false })
        .range(from, to);

      if (error) {
        logger.error("Error fetching reports", error);
        throw error;
      }

      setReports(data || []);
      setTotalCount(count || 0);
    } catch (error: any) {
      logger.error("Error fetching reports", error);
      toast({
        title: "Error",
        description: "Failed to load reports.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  }, [profileId, statusFilter, typeFilter, debouncedSearch, currentPage, toast]);

  // Fetch reports when dependencies change
  useEffect(() => {
    fetchReports();
  }, [fetchReports]);

  const totalPages = Math.ceil(totalCount / ITEMS_PER_PAGE);

  const getStatusColor = (status: string) => {
    switch (status) {
      case "resolved":
        return "bg-success text-success-foreground";
      case "in_progress":
        return "bg-accent text-accent-foreground";
      case "submitted":
      case "pending":
        return "bg-muted text-muted-foreground";
      case "under_review":
        return "bg-primary text-primary-foreground";
      case "assigned":
        return "bg-secondary text-secondary-foreground";
      case "rejected":
        return "bg-destructive text-destructive-foreground";
      default:
        return "bg-muted text-muted-foreground";
    }
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case "critical":
        return "text-destructive";
      case "high":
        return "text-accent";
      case "medium":
        return "text-primary";
      case "low":
        return "text-success";
      default:
        return "text-muted-foreground";
    }
  };

  const formatStatus = (status: string) => {
    return status.split("_").map(word => 
      word.charAt(0).toUpperCase() + word.slice(1)
    ).join(" ");
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return "N/A";
    return new Date(dateString).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  const getTimeAgo = (dateString: string | null) => {
    if (!dateString) return "";
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    
    if (diffDays === 0) return "Today";
    if (diffDays === 1) return "Yesterday";
    if (diffDays < 7) return `${diffDays} days ago`;
    if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`;
    return `${Math.floor(diffDays / 30)} months ago`;
  };

  const handleExport = async () => {
    if (!profileId) return;
    
    try {
      // Fetch all reports for export (without pagination)
      let query = supabase
        .from("reports")
        .select("*")
        .eq("reporter_user_id", profileId);

      if (statusFilter !== "all") {
        query = query.eq("status", statusFilter);
      }
      if (typeFilter !== "all") {
        query = query.eq("type", typeFilter);
      }
      if (debouncedSearch) {
        query = query.or(`title.ilike.%${debouncedSearch}%,category.ilike.%${debouncedSearch}%,description.ilike.%${debouncedSearch}%`);
      }

      const { data, error } = await query.order("created_at", { ascending: false });

      if (error) throw error;

      // Convert to CSV
      const headers = ["ID", "Title", "Type", "Category", "Status", "Severity", "Location", "Created At"];
      const csvContent = [
        headers.join(","),
        ...(data || []).map(report => [
          report.id,
          `"${report.title.replace(/"/g, '""')}"`,
          report.type,
          report.category,
          report.status,
          report.severity,
          `"${(report.location_address || "").replace(/"/g, '""')}"`,
          report.created_at
        ].join(","))
      ].join("\n");

      // Download file
      const blob = new Blob([csvContent], { type: "text/csv" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `my-reports-${new Date().toISOString().split("T")[0]}.csv`;
      a.click();
      URL.revokeObjectURL(url);

      toast({
        title: "Export Complete",
        description: `${data?.length || 0} reports exported successfully.`,
      });
    } catch (error) {
      logger.error("Export error", error);
      toast({
        title: "Export Failed",
        description: "Failed to export reports.",
        variant: "destructive",
      });
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
            <Button variant="outline" className="gap-2" onClick={handleExport} disabled={totalCount === 0}>
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
                <Input 
                  placeholder="Search by title, category, or description..." 
                  className="pl-10 h-11"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
              <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as ReportStatus | "all")}>
                <SelectTrigger className="w-full md:w-40 h-11">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="submitted">Submitted</SelectItem>
                  <SelectItem value="under_review">Under Review</SelectItem>
                  <SelectItem value="assigned">Assigned</SelectItem>
                  <SelectItem value="in_progress">In Progress</SelectItem>
                  <SelectItem value="resolved">Resolved</SelectItem>
                  <SelectItem value="rejected">Rejected</SelectItem>
                </SelectContent>
              </Select>
              <Select value={typeFilter} onValueChange={(v) => setTypeFilter(v as ReportType | "all")}>
                <SelectTrigger className="w-full md:w-40 h-11">
                  <SelectValue placeholder="Type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  <SelectItem value="infrastructure">Infrastructure</SelectItem>
                  <SelectItem value="misconduct">Misconduct</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Reports List */}
        <Card className="border-border/50">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="font-heading text-xl">
              All Reports ({totalCount})
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
              </div>
            ) : reports.length === 0 ? (
              <div className="text-center py-12">
                <FileText className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                <h3 className="font-medium text-foreground mb-2">No reports found</h3>
                <p className="text-muted-foreground mb-4">
                  {totalCount === 0 && !debouncedSearch && statusFilter === "all" && typeFilter === "all"
                    ? "You haven't submitted any reports yet." 
                    : "No reports match your filters."}
                </p>
                {totalCount === 0 && !debouncedSearch && statusFilter === "all" && typeFilter === "all" && (
                  <Link to="/submit-report">
                    <Button>Submit Your First Report</Button>
                  </Link>
                )}
              </div>
            ) : (
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
                                {report.id.slice(0, 8)} • {report.category} • {report.type}
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center gap-3 mt-2 text-sm flex-wrap">
                            <span className="text-muted-foreground">{formatDate(report.created_at)}</span>
                            <span className="text-muted-foreground">•</span>
                            <span className="text-muted-foreground">Updated {getTimeAgo(report.updated_at)}</span>
                            <span className="text-muted-foreground">•</span>
                            <span className={`font-medium capitalize ${getSeverityColor(report.severity)}`}>
                              {report.severity} Severity
                            </span>
                          </div>
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-3 lg:justify-end">
                        <Badge className={getStatusColor(report.status)}>
                          {formatStatus(report.status)}
                        </Badge>
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
            )}

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between mt-6 pt-4 border-t border-border">
                <p className="text-sm text-muted-foreground">
                  Page {currentPage} of {totalPages} ({totalCount} reports)
                </p>
                <div className="flex gap-2">
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                    disabled={currentPage === 1}
                  >
                    <ChevronLeft className="w-4 h-4 mr-1" />
                    Previous
                  </Button>
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                    disabled={currentPage === totalPages}
                  >
                    Next
                    <ChevronRight className="w-4 h-4 ml-1" />
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
};

export default MyReports;
