import { Construction, UserX, Droplets, Zap, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";

const categories = [
  {
    icon: Construction,
    title: "Road & Infrastructure",
    description: "Report potholes, broken bridges, damaged public buildings, and other infrastructure issues.",
    reports: "4,230 reports",
    color: "bg-primary/10 text-primary",
  },
  {
    icon: UserX,
    title: "Employee Misconduct",
    description: "Report corruption, bribery, negligence, or unprofessional behavior by government officials.",
    reports: "2,180 reports",
    color: "bg-destructive/10 text-destructive",
  },
  {
    icon: Droplets,
    title: "Water & Sanitation",
    description: "Report water supply issues, sewage problems, and sanitation facility failures.",
    reports: "3,450 reports",
    color: "bg-blue-500/10 text-blue-600",
  },
  {
    icon: Zap,
    title: "Electricity & Utilities",
    description: "Report power outages, faulty streetlights, and other utility infrastructure problems.",
    reports: "2,590 reports",
    color: "bg-amber-500/10 text-amber-600",
  },
];

const ReportCategories = () => {
  return (
    <section id="reports" className="py-20 bg-background">
      <div className="container mx-auto px-4">
        <div className="text-center mb-12">
          <span className="inline-block px-3 py-1 rounded-full bg-accent/10 text-accent text-sm font-medium mb-4">
            Report an Issue
          </span>
          <h2 className="font-heading text-3xl md:text-4xl font-bold text-foreground mb-4">
            What Would You Like to Report?
          </h2>
          <p className="text-muted-foreground max-w-2xl mx-auto">
            Select a category below to submit your report with photos and videos as evidence. 
            Your identity remains protected throughout the process.
          </p>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 mb-12">
          {categories.map((category, index) => (
            <div
              key={index}
              className="group bg-card rounded-xl p-6 shadow-soft hover:shadow-elevated transition-all duration-300 cursor-pointer border border-border hover:border-primary/20"
              style={{ animationDelay: `${index * 0.1}s` }}
            >
              <div className={`w-14 h-14 rounded-xl ${category.color} flex items-center justify-center mb-4 group-hover:scale-110 transition-transform`}>
                <category.icon className="w-7 h-7" />
              </div>
              <h3 className="font-heading text-lg font-semibold text-foreground mb-2">
                {category.title}
              </h3>
              <p className="text-sm text-muted-foreground mb-4 leading-relaxed">
                {category.description}
              </p>
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">{category.reports}</span>
                <ArrowRight className="w-4 h-4 text-muted-foreground group-hover:text-primary group-hover:translate-x-1 transition-all" />
              </div>
            </div>
          ))}
        </div>

        <div className="text-center">
          <Button variant="default" size="lg">
            View All Categories
            <ArrowRight className="w-4 h-4 ml-2" />
          </Button>
        </div>
      </div>
    </section>
  );
};

export default ReportCategories;
