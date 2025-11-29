import { TrendingUp, TrendingDown, IndianRupee, AlertTriangle, CheckCircle2 } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";

const projects = [
  {
    name: "National Highway 44 Expansion",
    department: "Ministry of Road Transport",
    budget: 2500,
    released: 1875,
    spent: 1650,
    status: "On Track",
    statusColor: "text-success",
    progress: 66,
  },
  {
    name: "Smart City Mission - Phase 2",
    department: "Ministry of Housing & Urban Affairs",
    budget: 1800,
    released: 1200,
    spent: 1450,
    status: "Over Budget",
    statusColor: "text-destructive",
    progress: 81,
  },
  {
    name: "Rural Water Supply Scheme",
    department: "Jal Shakti Ministry",
    budget: 3200,
    released: 2400,
    spent: 2100,
    status: "On Track",
    statusColor: "text-success",
    progress: 66,
  },
  {
    name: "Digital India Initiative",
    department: "Ministry of Electronics & IT",
    budget: 950,
    released: 800,
    spent: 720,
    status: "Under Budget",
    statusColor: "text-success",
    progress: 76,
  },
];

const BudgetTracker = () => {
  return (
    <section id="transparency" className="py-20 bg-muted/50">
      <div className="container mx-auto px-4">
        <div className="text-center mb-12">
          <span className="inline-block px-3 py-1 rounded-full bg-primary/10 text-primary text-sm font-medium mb-4">
            Financial Transparency
          </span>
          <h2 className="font-heading text-3xl md:text-4xl font-bold text-foreground mb-4">
            Government Budget Tracker
          </h2>
          <p className="text-muted-foreground max-w-2xl mx-auto">
            Monitor how public funds are allocated and spent across major government projects. 
            Complete transparency in real-time.
          </p>
        </div>

        {/* Summary Cards */}
        <div className="grid md:grid-cols-3 gap-6 mb-10">
          <div className="bg-card rounded-xl p-6 shadow-soft border border-border">
            <div className="flex items-center justify-between mb-4">
              <span className="text-sm font-medium text-muted-foreground">Total Budget</span>
              <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                <IndianRupee className="w-5 h-5 text-primary" />
              </div>
            </div>
            <div className="text-3xl font-bold text-foreground mb-1">₹8,450 Cr</div>
            <div className="flex items-center gap-1 text-sm text-success">
              <TrendingUp className="w-4 h-4" />
              <span>12% increase from last year</span>
            </div>
          </div>

          <div className="bg-card rounded-xl p-6 shadow-soft border border-border">
            <div className="flex items-center justify-between mb-4">
              <span className="text-sm font-medium text-muted-foreground">Funds Released</span>
              <div className="w-10 h-10 rounded-lg bg-success/10 flex items-center justify-center">
                <CheckCircle2 className="w-5 h-5 text-success" />
              </div>
            </div>
            <div className="text-3xl font-bold text-foreground mb-1">₹6,275 Cr</div>
            <div className="text-sm text-muted-foreground">74% of total budget</div>
          </div>

          <div className="bg-card rounded-xl p-6 shadow-soft border border-border">
            <div className="flex items-center justify-between mb-4">
              <span className="text-sm font-medium text-muted-foreground">Actual Spent</span>
              <div className="w-10 h-10 rounded-lg bg-accent/10 flex items-center justify-center">
                <TrendingDown className="w-5 h-5 text-accent" />
              </div>
            </div>
            <div className="text-3xl font-bold text-foreground mb-1">₹5,920 Cr</div>
            <div className="flex items-center gap-1 text-sm text-muted-foreground">
              <AlertTriangle className="w-4 h-4 text-warning" />
              <span>2 projects over budget</span>
            </div>
          </div>
        </div>

        {/* Project Table */}
        <div className="bg-card rounded-xl shadow-soft border border-border overflow-hidden">
          <div className="p-6 border-b border-border">
            <h3 className="font-heading text-lg font-semibold text-foreground">
              Active Government Projects
            </h3>
          </div>
          
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-muted/50">
                <tr>
                  <th className="text-left px-6 py-4 text-sm font-medium text-muted-foreground">Project Name</th>
                  <th className="text-left px-6 py-4 text-sm font-medium text-muted-foreground hidden md:table-cell">Department</th>
                  <th className="text-right px-6 py-4 text-sm font-medium text-muted-foreground">Budget</th>
                  <th className="text-right px-6 py-4 text-sm font-medium text-muted-foreground hidden sm:table-cell">Released</th>
                  <th className="text-right px-6 py-4 text-sm font-medium text-muted-foreground">Spent</th>
                  <th className="text-center px-6 py-4 text-sm font-medium text-muted-foreground">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {projects.map((project, index) => (
                  <tr key={index} className="hover:bg-muted/30 transition-colors">
                    <td className="px-6 py-4">
                      <div className="font-medium text-foreground text-sm">{project.name}</div>
                      <div className="md:hidden text-xs text-muted-foreground mt-1">{project.department}</div>
                    </td>
                    <td className="px-6 py-4 text-sm text-muted-foreground hidden md:table-cell">
                      {project.department}
                    </td>
                    <td className="px-6 py-4 text-right text-sm font-medium text-foreground">
                      ₹{project.budget} Cr
                    </td>
                    <td className="px-6 py-4 text-right text-sm text-muted-foreground hidden sm:table-cell">
                      ₹{project.released} Cr
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="text-sm font-medium text-foreground">₹{project.spent} Cr</div>
                      <Progress value={project.progress} className="h-1.5 mt-1 w-20 ml-auto" />
                    </td>
                    <td className="px-6 py-4 text-center">
                      <span className={`text-xs font-medium ${project.statusColor}`}>
                        {project.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="p-4 border-t border-border bg-muted/30 flex justify-center">
            <Button variant="ghost" size="sm">
              View All Projects →
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
};

export default BudgetTracker;
