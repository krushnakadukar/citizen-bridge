import { useState, useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import { 
  ArrowLeft, 
  FileText, 
  MapPin, 
  Calendar, 
  AlertTriangle, 
  Loader2,
  Image as ImageIcon,
  Video,
  File,
  Download,
  Clock
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import DashboardLayout from "@/components/layouts/DashboardLayout";
import { supabase } from "@/integrations/supabase/client";
import { formatDistanceToNow, format } from "date-fns";

interface Report {
  id: string;
  title: string;
  description: string;
  status: string;
  severity: string;
  category: string;
  type: string;
  location_address: string | null;
  location_lat: number | null;
  location_lng: number | null;
  created_at: string;
  updated_at: string;
  is_anonymous: boolean;
  ai_category_suggestion: string | null;
  ai_sentiment: string | null;
}

interface Evidence {
  id: string;
  file_url: string;
  file_type: string;
  original_filename: string | null;
  created_at: string;
}

interface TimelineEvent {
  id: string;
  event_type: string;
  from_status: string | null;
  to_status: string | null;
  created_at: string;
  metadata: unknown;
}

const ReportDetails = () => {
  const { id } = useParams<{ id: string }>();
  const [loading, setLoading] = useState(true);
  const [report, setReport] = useState<Report | null>(null);
  const [evidence, setEvidence] = useState<Evidence[]>([]);
  const [timeline, setTimeline] = useState<TimelineEvent[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (id) {
      fetchReportData();
    }
  }, [id]);

  const fetchReportData = async () => {
    try {
      setLoading(true);
      setError(null);

      // Fetch report details
      const { data: reportData, error: reportError } = await supabase
        .from("reports")
        .select("*")
        .eq("id", id)
        .maybeSingle();

      if (reportError) throw reportError;
      
      if (!reportData) {
        setError("Report not found");
        setLoading(false);
        return;
      }

      setReport(reportData);

      // Fetch evidence
      const { data: evidenceData } = await supabase
        .from("report_evidence")
        .select("*")
        .eq("report_id", id)
        .order("created_at", { ascending: false });

      if (evidenceData) {
        setEvidence(evidenceData);
      }

      // Fetch timeline events
      const { data: timelineData } = await supabase
        .from("report_timeline_events")
        .select("*")
        .eq("report_id", id)
        .order("created_at", { ascending: true });

      if (timelineData) {
        setTimeline(timelineData);
      }

    } catch (err) {
      console.error("Error fetching report:", err);
      setError("Failed to load report details");
    } finally {
      setLoading(false);
    }
  };

  const getSignedUrl = async (fileUrl: string) => {
    const { data } = await supabase.storage
      .from("evidence-media")
      .createSignedUrl(fileUrl, 3600);
    return data?.signedUrl;
  };

  const handleDownload = async (fileUrl: string, filename: string | null) => {
    const signedUrl = await getSignedUrl(fileUrl);
    if (signedUrl) {
      window.open(signedUrl, "_blank");
    }
  };

  const getStatusBadge = (status: string) => {
    const statusMap: Record<string, { label: string; className: string }> = {
      submitted: { label: "Submitted", className: "bg-muted text-muted-foreground" },
      under_review: { label: "Under Review", className: "bg-accent text-accent-foreground" },
      assigned: { label: "Assigned", className: "bg-accent text-accent-foreground" },
      in_progress: { label: "In Progress", className: "bg-accent text-accent-foreground" },
      resolved: { label: "Resolved", className: "bg-success text-success-foreground" },
      rejected: { label: "Rejected", className: "bg-destructive/10 text-destructive" },
    };
    return statusMap[status] || { label: status, className: "bg-muted text-muted-foreground" };
  };

  const getSeverityBadge = (severity: string) => {
    const severityMap: Record<string, { label: string; className: string }> = {
      low: { label: "Low", className: "bg-muted text-muted-foreground" },
      medium: { label: "Medium", className: "bg-warning/20 text-warning-foreground" },
      high: { label: "High", className: "bg-accent text-accent-foreground" },
      critical: { label: "Critical", className: "bg-destructive text-destructive-foreground" },
    };
    return severityMap[severity] || { label: severity, className: "bg-muted text-muted-foreground" };
  };

  const getEventLabel = (event: TimelineEvent) => {
    switch (event.event_type) {
      case "created":
        return "Report Submitted";
      case "status_change":
        return `Status changed to ${getStatusBadge(event.to_status || "").label}`;
      case "assigned":
        return "Assigned to official";
      case "comment_added":
        return "Comment added";
      case "evidence_added":
        return "Evidence uploaded";
      default:
        return event.event_type.replace(/_/g, " ");
    }
  };

  const getFileIcon = (fileType: string) => {
    switch (fileType) {
      case "image":
        return <ImageIcon className="w-5 h-5" />;
      case "video":
        return <Video className="w-5 h-5" />;
      default:
        return <File className="w-5 h-5" />;
    }
  };

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center min-h-[60vh]">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      </DashboardLayout>
    );
  }

  if (error || !report) {
    return (
      <DashboardLayout>
        <div className="text-center py-12">
          <FileText className="w-16 h-16 mx-auto text-muted-foreground mb-4" />
          <h2 className="text-xl font-semibold text-foreground mb-2">
            {error || "Report not found"}
          </h2>
          <Link to="/my-reports">
            <Button variant="outline" className="mt-4">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Reports
            </Button>
          </Link>
        </div>
      </DashboardLayout>
    );
  }

  const statusBadge = getStatusBadge(report.status);
  const severityBadge = getSeverityBadge(report.severity);

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center gap-4">
          <Link to="/my-reports">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="w-5 h-5" />
            </Button>
          </Link>
          <div className="flex-1">
            <h1 className="font-heading text-2xl font-bold text-foreground">
              {report.title}
            </h1>
            <p className="text-muted-foreground text-sm">
              Submitted {formatDistanceToNow(new Date(report.created_at), { addSuffix: true })}
            </p>
          </div>
        </div>

        {/* Main Content */}
        <div className="grid lg:grid-cols-3 gap-6">
          {/* Report Info */}
          <Card className="lg:col-span-2 border-border/50">
            <CardHeader>
              <div className="flex items-start justify-between flex-wrap gap-2">
                <CardTitle className="font-heading text-xl">Report Details</CardTitle>
                <div className="flex gap-2">
                  <Badge className={statusBadge.className}>{statusBadge.label}</Badge>
                  <Badge className={severityBadge.className}>{severityBadge.label}</Badge>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              <div>
                <h3 className="font-medium text-foreground mb-2">Description</h3>
                <p className="text-muted-foreground whitespace-pre-wrap">{report.description}</p>
              </div>

              {report.ai_category_suggestion && (
                <div className="p-3 rounded-lg bg-primary/5 border border-primary/20">
                  <p className="text-sm text-muted-foreground">AI Suggested Category</p>
                  <p className="font-medium text-foreground">{report.ai_category_suggestion}</p>
                </div>
              )}

              <div className="grid sm:grid-cols-2 gap-4">
                <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
                  <FileText className="w-5 h-5 text-primary" />
                  <div>
                    <p className="text-sm text-muted-foreground">Category</p>
                    <p className="font-medium text-foreground capitalize">{report.category}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
                  <AlertTriangle className="w-5 h-5 text-primary" />
                  <div>
                    <p className="text-sm text-muted-foreground">Type</p>
                    <p className="font-medium text-foreground capitalize">{report.type}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
                  <MapPin className="w-5 h-5 text-primary" />
                  <div>
                    <p className="text-sm text-muted-foreground">Location</p>
                    <p className="font-medium text-foreground">
                      {report.location_address || "Not specified"}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
                  <Calendar className="w-5 h-5 text-primary" />
                  <div>
                    <p className="text-sm text-muted-foreground">Last Updated</p>
                    <p className="font-medium text-foreground">
                      {format(new Date(report.updated_at), "PPp")}
                    </p>
                  </div>
                </div>
              </div>

              {/* Evidence Section */}
              {evidence.length > 0 && (
                <div>
                  <h3 className="font-medium text-foreground mb-3">
                    Evidence ({evidence.length} file{evidence.length > 1 ? "s" : ""})
                  </h3>
                  <div className="grid sm:grid-cols-2 gap-3">
                    {evidence.map((item) => (
                      <div
                        key={item.id}
                        className="flex items-center justify-between p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors"
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
                            {getFileIcon(item.file_type)}
                          </div>
                          <div className="min-w-0">
                            <p className="font-medium text-foreground text-sm truncate">
                              {item.original_filename || "Uploaded file"}
                            </p>
                            <p className="text-xs text-muted-foreground capitalize">
                              {item.file_type}
                            </p>
                          </div>
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDownload(item.file_url, item.original_filename)}
                        >
                          <Download className="w-4 h-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Timeline Sidebar */}
          <Card className="border-border/50">
            <CardHeader>
              <CardTitle className="font-heading text-lg flex items-center gap-2">
                <Clock className="w-5 h-5" />
                Timeline
              </CardTitle>
            </CardHeader>
            <CardContent>
              {timeline.length === 0 ? (
                <div className="space-y-4">
                  <div className="flex gap-3">
                    <div className="w-2 h-2 rounded-full bg-primary mt-2 flex-shrink-0" />
                    <div>
                      <p className="font-medium text-foreground">Report Submitted</p>
                      <p className="text-sm text-muted-foreground">
                        {format(new Date(report.created_at), "PPp")}
                      </p>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  {timeline.map((event, index) => (
                    <div key={event.id} className="flex gap-3">
                      <div className="relative">
                        <div className={`w-2 h-2 rounded-full mt-2 flex-shrink-0 ${
                          index === timeline.length - 1 ? "bg-primary" : "bg-muted-foreground"
                        }`} />
                        {index < timeline.length - 1 && (
                          <div className="absolute top-4 left-[3px] w-0.5 h-full bg-border" />
                        )}
                      </div>
                      <div className="pb-4">
                        <p className="font-medium text-foreground text-sm">
                          {getEventLabel(event)}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {format(new Date(event.created_at), "PPp")}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </DashboardLayout>
  );
};

export default ReportDetails;
