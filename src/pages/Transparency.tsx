import { 
  TrendingUp, 
  DollarSign, 
  Building2, 
  Calendar,
  Download,
  Search,
  Filter,
  ChevronRight,
  ExternalLink
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Link } from "react-router-dom";
import DashboardLayout from "@/components/layouts/DashboardLayout";

const Transparency = () => {
  const stats = [
    { label: "Total Budget", value: "₹245.8 Cr", change: "+12%", icon: DollarSign },
    { label: "Funds Released", value: "₹189.2 Cr", change: "+8%", icon: TrendingUp },
    { label: "Active Projects", value: "47", change: "+5", icon: Building2 },
    { label: "Completed", value: "132", change: "+18", icon: Calendar },
  ];

  const projects = [
    {
      id: 1,
      name: "City Ring Road Phase 2",
      department: "Public Works",
      budget: "₹45.5 Cr",
      spent: "₹32.1 Cr",
      progress: 71,
      status: "On Track",
      contractor: "ABC Constructions Ltd.",
    },
    {
      id: 2,
      name: "Water Treatment Plant Upgrade",
      department: "Water Supply",
      budget: "₹28.0 Cr",
      spent: "₹25.8 Cr",
      progress: 92,
      status: "Near Completion",
      contractor: "Hydro Systems Inc.",
    },
    {
      id: 3,
      name: "Smart Street Lighting",
      department: "Electricity",
      budget: "₹12.0 Cr",
      spent: "₹4.2 Cr",
      progress: 35,
      status: "In Progress",
      contractor: "Bright Solutions",
    },
    {
      id: 4,
      name: "Government Hospital Renovation",
      department: "Health",
      budget: "₹18.5 Cr",
      spent: "₹2.1 Cr",
      progress: 11,
      status: "Just Started",
      contractor: "MedBuild Corp.",
    },
    {
      id: 5,
      name: "Public Park Development",
      department: "Parks & Recreation",
      budget: "₹8.0 Cr",
      spent: "₹6.8 Cr",
      progress: 85,
      status: "On Track",
      contractor: "Green Spaces Ltd.",
    },
  ];

  const getStatusColor = (status: string) => {
    switch (status) {
      case "Near Completion":
        return "bg-success text-success-foreground";
      case "On Track":
        return "bg-primary text-primary-foreground";
      case "In Progress":
        return "bg-accent text-accent-foreground";
      case "Just Started":
        return "bg-muted text-muted-foreground";
      default:
        return "bg-muted text-muted-foreground";
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-8">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="font-heading text-3xl font-bold text-foreground">Budget Transparency</h1>
            <p className="text-muted-foreground mt-1">Track government spending and project progress</p>
          </div>
          <Link to="/transparency/reports">
            <Button variant="outline" className="gap-2">
              <Download className="w-4 h-4" />
              Download Reports
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
                    <p className="text-2xl font-bold text-foreground mt-1">{stat.value}</p>
                    <p className="text-xs text-success mt-1">{stat.change} from last year</p>
                  </div>
                  <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
                    <stat.icon className="w-6 h-6" />
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Search and Filter */}
        <Card className="border-border/50">
          <CardContent className="p-4">
            <div className="flex flex-col sm:flex-row gap-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input placeholder="Search projects, departments..." className="pl-10 h-11" />
              </div>
              <Button variant="outline" className="gap-2">
                <Filter className="w-4 h-4" />
                Filters
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Projects List */}
        <Card className="border-border/50">
          <CardHeader>
            <CardTitle className="font-heading text-xl">Active Projects</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {projects.map((project) => (
                <div
                  key={project.id}
                  className="p-5 rounded-xl bg-muted/30 hover:bg-muted/50 transition-colors border border-border/50"
                >
                  <div className="flex flex-col lg:flex-row lg:items-center gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <h3 className="font-semibold text-foreground">{project.name}</h3>
                          <p className="text-sm text-muted-foreground">{project.department} • {project.contractor}</p>
                        </div>
                        <Badge className={getStatusColor(project.status)}>{project.status}</Badge>
                      </div>
                      
                      <div className="mt-4 space-y-2">
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-muted-foreground">Progress</span>
                          <span className="font-medium text-foreground">{project.progress}%</span>
                        </div>
                        <Progress value={project.progress} className="h-2" />
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-muted-foreground">Budget: {project.budget}</span>
                          <span className="text-muted-foreground">Spent: {project.spent}</span>
                        </div>
                      </div>
                    </div>
                    
                    <div className="flex gap-2">
                      <Link to={`/transparency/projects/${project.id}`}>
                        <Button variant="outline" size="sm" className="gap-1">
                          View Details <ChevronRight className="w-4 h-4" />
                        </Button>
                      </Link>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Quick Links */}
        <div className="grid md:grid-cols-3 gap-4">
          <Card className="border-border/50 hover:border-primary transition-colors cursor-pointer">
            <CardContent className="p-6 flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
                <Download className="w-6 h-6 text-primary" />
              </div>
              <div>
                <h3 className="font-semibold text-foreground">Financial Reports</h3>
                <p className="text-sm text-muted-foreground">Download detailed reports</p>
              </div>
              <ExternalLink className="w-4 h-4 text-muted-foreground ml-auto" />
            </CardContent>
          </Card>
          
          <Card className="border-border/50 hover:border-primary transition-colors cursor-pointer">
            <CardContent className="p-6 flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-accent/10 flex items-center justify-center">
                <Building2 className="w-6 h-6 text-accent" />
              </div>
              <div>
                <h3 className="font-semibold text-foreground">Department Wise</h3>
                <p className="text-sm text-muted-foreground">View by department</p>
              </div>
              <ExternalLink className="w-4 h-4 text-muted-foreground ml-auto" />
            </CardContent>
          </Card>
          
          <Card className="border-border/50 hover:border-primary transition-colors cursor-pointer">
            <CardContent className="p-6 flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-success/10 flex items-center justify-center">
                <Calendar className="w-6 h-6 text-success" />
              </div>
              <div>
                <h3 className="font-semibold text-foreground">Historical Data</h3>
                <p className="text-sm text-muted-foreground">Past budgets & spending</p>
              </div>
              <ExternalLink className="w-4 h-4 text-muted-foreground ml-auto" />
            </CardContent>
          </Card>
        </div>
      </div>
    </DashboardLayout>
  );
};

export default Transparency;
