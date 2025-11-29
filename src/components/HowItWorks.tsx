import { Upload, Search, Bell, CheckCircle } from "lucide-react";

const steps = [
  {
    icon: Upload,
    step: "01",
    title: "Submit Your Report",
    description: "Choose a category and upload photos or videos as evidence. Add location details and a description of the issue.",
  },
  {
    icon: Search,
    step: "02",
    title: "Verification Process",
    description: "Our team verifies the authenticity of reports using AI-powered analysis and cross-references with official records.",
  },
  {
    icon: Bell,
    step: "03",
    title: "Authority Notification",
    description: "Verified reports are automatically routed to the relevant government department for immediate attention.",
  },
  {
    icon: CheckCircle,
    step: "04",
    title: "Track Resolution",
    description: "Monitor the progress of your report in real-time and receive updates until the issue is fully resolved.",
  },
];

const HowItWorks = () => {
  return (
    <section id="how-it-works" className="py-20 bg-background">
      <div className="container mx-auto px-4">
        <div className="text-center mb-16">
          <span className="inline-block px-3 py-1 rounded-full bg-success/10 text-success text-sm font-medium mb-4">
            Simple Process
          </span>
          <h2 className="font-heading text-3xl md:text-4xl font-bold text-foreground mb-4">
            How Citizen Connect Works
          </h2>
          <p className="text-muted-foreground max-w-2xl mx-auto">
            From reporting to resolution, we've designed a streamlined process that ensures your voice is heard and action is taken.
          </p>
        </div>

        <div className="relative">
          {/* Connection Line - Desktop */}
          <div className="hidden lg:block absolute top-24 left-[12%] right-[12%] h-0.5 bg-gradient-to-r from-primary via-accent to-success" />

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
            {steps.map((step, index) => (
              <div
                key={index}
                className="relative text-center group"
              >
                {/* Step Number Circle */}
                <div className="relative mx-auto mb-6">
                  <div className="w-20 h-20 rounded-full bg-card shadow-elevated border-2 border-border group-hover:border-primary transition-colors flex items-center justify-center mx-auto relative z-10">
                    <step.icon className="w-8 h-8 text-primary" />
                  </div>
                  <div className="absolute -top-2 -right-2 w-8 h-8 rounded-full gradient-hero flex items-center justify-center text-xs font-bold text-primary-foreground">
                    {step.step}
                  </div>
                </div>

                <h3 className="font-heading text-xl font-semibold text-foreground mb-3">
                  {step.title}
                </h3>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  {step.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
};

export default HowItWorks;
