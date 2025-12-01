import { useState } from "react";
import { 
  Construction, 
  Users, 
  Upload, 
  MapPin, 
  AlertTriangle,
  ChevronRight,
  X,
  Image,
  Video,
  FileText
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import DashboardLayout from "@/components/layouts/DashboardLayout";

const SubmitReport = () => {
  const [reportType, setReportType] = useState<"infrastructure" | "misconduct" | null>(null);
  const [isAnonymous, setIsAnonymous] = useState(false);
  const [files, setFiles] = useState<File[]>([]);

  const infrastructureCategories = [
    "Roads & Potholes",
    "Street Lighting",
    "Water Supply",
    "Drainage & Sewage",
    "Public Buildings",
    "Bridges & Flyovers",
    "Parks & Recreation",
    "Other",
  ];

  const misconductCategories = [
    "Bribery & Corruption",
    "Negligence of Duty",
    "Abuse of Power",
    "Misuse of Public Funds",
    "Harassment",
    "Other",
  ];

  const severityLevels = [
    { value: "low", label: "Low", description: "Minor issue, no immediate danger" },
    { value: "medium", label: "Medium", description: "Moderate concern, needs attention" },
    { value: "high", label: "High", description: "Serious issue requiring prompt action" },
    { value: "critical", label: "Critical", description: "Immediate danger to public safety" },
  ];

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      setFiles([...files, ...Array.from(e.target.files)]);
    }
  };

  const removeFile = (index: number) => {
    setFiles(files.filter((_, i) => i !== index));
  };

  const getFileIcon = (file: File) => {
    if (file.type.startsWith("image/")) return <Image className="w-4 h-4" />;
    if (file.type.startsWith("video/")) return <Video className="w-4 h-4" />;
    return <FileText className="w-4 h-4" />;
  };

  if (!reportType) {
    return (
      <DashboardLayout>
        <div className="max-w-3xl mx-auto">
          <div className="text-center mb-8">
            <h1 className="font-heading text-3xl font-bold text-foreground mb-2">Submit a Report</h1>
            <p className="text-muted-foreground">Choose the type of issue you want to report</p>
          </div>

          <div className="grid md:grid-cols-2 gap-6">
            <Card 
              className="cursor-pointer border-2 border-border hover:border-primary transition-all hover:shadow-elevated"
              onClick={() => setReportType("infrastructure")}
            >
              <CardContent className="p-8 text-center">
                <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-4">
                  <Construction className="w-8 h-8 text-primary" />
                </div>
                <h3 className="font-heading text-xl font-semibold text-foreground mb-2">
                  Infrastructure Damage
                </h3>
                <p className="text-muted-foreground text-sm">
                  Report damaged roads, broken street lights, water leaks, and other public infrastructure issues
                </p>
                <Button variant="ghost" className="mt-4 gap-2">
                  Select <ChevronRight className="w-4 h-4" />
                </Button>
              </CardContent>
            </Card>

            <Card 
              className="cursor-pointer border-2 border-border hover:border-accent transition-all hover:shadow-elevated"
              onClick={() => setReportType("misconduct")}
            >
              <CardContent className="p-8 text-center">
                <div className="w-16 h-16 rounded-2xl bg-accent/10 flex items-center justify-center mx-auto mb-4">
                  <Users className="w-8 h-8 text-accent" />
                </div>
                <h3 className="font-heading text-xl font-semibold text-foreground mb-2">
                  Government Misconduct
                </h3>
                <p className="text-muted-foreground text-sm">
                  Report corruption, negligence, abuse of power, or other misconduct by government employees
                </p>
                <Button variant="ghost" className="mt-4 gap-2">
                  Select <ChevronRight className="w-4 h-4" />
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="max-w-3xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <div>
            <Button 
              variant="ghost" 
              className="mb-2 -ml-4"
              onClick={() => setReportType(null)}
            >
              ← Back to Selection
            </Button>
            <h1 className="font-heading text-3xl font-bold text-foreground">
              {reportType === "infrastructure" ? "Infrastructure Damage Report" : "Government Misconduct Report"}
            </h1>
          </div>
        </div>

        <form className="space-y-6">
          {/* Anonymous Toggle */}
          <Card className="border-border/50">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <AlertTriangle className="w-5 h-5 text-accent" />
                  <div>
                    <p className="font-medium text-foreground">Submit Anonymously</p>
                    <p className="text-sm text-muted-foreground">Your identity will be protected</p>
                  </div>
                </div>
                <Switch checked={isAnonymous} onCheckedChange={setIsAnonymous} />
              </div>
            </CardContent>
          </Card>

          {/* Basic Information */}
          <Card className="border-border/50">
            <CardHeader>
              <CardTitle className="font-heading text-xl">Report Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="title">Title *</Label>
                <Input id="title" placeholder="Brief title describing the issue" className="h-12" />
              </div>

              <div className="grid md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Category *</Label>
                  <Select>
                    <SelectTrigger className="h-12">
                      <SelectValue placeholder="Select category" />
                    </SelectTrigger>
                    <SelectContent>
                      {(reportType === "infrastructure" ? infrastructureCategories : misconductCategories).map((cat) => (
                        <SelectItem key={cat} value={cat.toLowerCase().replace(/\s+/g, "-")}>
                          {cat}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Severity Level *</Label>
                  <Select>
                    <SelectTrigger className="h-12">
                      <SelectValue placeholder="Select severity" />
                    </SelectTrigger>
                    <SelectContent>
                      {severityLevels.map((level) => (
                        <SelectItem key={level.value} value={level.value}>
                          <div>
                            <span className="font-medium">{level.label}</span>
                            <span className="text-muted-foreground ml-2 text-sm">- {level.description}</span>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">Description *</Label>
                <Textarea 
                  id="description" 
                  placeholder="Provide a detailed description of the issue..."
                  className="min-h-32 resize-none"
                />
              </div>
            </CardContent>
          </Card>

          {/* Location */}
          <Card className="border-border/50">
            <CardHeader>
              <CardTitle className="font-heading text-xl flex items-center gap-2">
                <MapPin className="w-5 h-5" />
                Location
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="address">Address / Location Description *</Label>
                <Input id="address" placeholder="Enter the location of the issue" className="h-12" />
              </div>
              <div className="aspect-video bg-muted rounded-xl flex items-center justify-center">
                <p className="text-muted-foreground">Map integration will be displayed here</p>
              </div>
            </CardContent>
          </Card>

          {/* Evidence Upload */}
          <Card className="border-border/50">
            <CardHeader>
              <CardTitle className="font-heading text-xl flex items-center gap-2">
                <Upload className="w-5 h-5" />
                Evidence Upload
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div 
                className="border-2 border-dashed border-border rounded-xl p-8 text-center hover:border-primary transition-colors cursor-pointer"
                onClick={() => document.getElementById('file-upload')?.click()}
              >
                <Upload className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
                <p className="font-medium text-foreground">Drop files here or click to upload</p>
                <p className="text-sm text-muted-foreground mt-1">
                  Support for images, videos, and documents (Max 50MB each)
                </p>
                <input
                  id="file-upload"
                  type="file"
                  multiple
                  accept="image/*,video/*,.pdf,.doc,.docx"
                  className="hidden"
                  onChange={handleFileUpload}
                />
              </div>

              {files.length > 0 && (
                <div className="space-y-2">
                  {files.map((file, index) => (
                    <div key={index} className="flex items-center justify-between p-3 bg-muted rounded-lg">
                      <div className="flex items-center gap-3">
                        {getFileIcon(file)}
                        <span className="text-sm font-medium text-foreground">{file.name}</span>
                        <span className="text-xs text-muted-foreground">
                          ({(file.size / 1024 / 1024).toFixed(2)} MB)
                        </span>
                      </div>
                      <Button variant="ghost" size="icon" onClick={() => removeFile(index)}>
                        <X className="w-4 h-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Submit */}
          <div className="flex gap-4">
            <Button type="button" variant="outline" className="flex-1 h-12" onClick={() => setReportType(null)}>
              Cancel
            </Button>
            <Button type="submit" className="flex-1 h-12">
              Submit Report
            </Button>
          </div>
        </form>
      </div>
    </DashboardLayout>
  );
};

export default SubmitReport;
