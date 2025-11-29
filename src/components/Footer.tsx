import { Shield, Mail, Phone, MapPin } from "lucide-react";

const Footer = () => {
  return (
    <footer className="bg-foreground text-primary-foreground py-16">
      <div className="container mx-auto px-4">
        <div className="grid md:grid-cols-4 gap-10 mb-12">
          {/* Brand */}
          <div className="md:col-span-1">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-lg gradient-accent flex items-center justify-center">
                <Shield className="w-5 h-5 text-accent-foreground" />
              </div>
              <div>
                <h3 className="font-heading font-bold text-lg">Citizen Connect</h3>
              </div>
            </div>
            <p className="text-primary-foreground/70 text-sm leading-relaxed mb-4">
              Empowering citizens to build transparent and accountable governance through secure reporting and financial tracking.
            </p>
          </div>

          {/* Quick Links */}
          <div>
            <h4 className="font-heading font-semibold mb-4">Quick Links</h4>
            <ul className="space-y-2">
              {["Submit Report", "Budget Tracker", "Track Your Report", "FAQs"].map((link) => (
                <li key={link}>
                  <a href="#" className="text-sm text-primary-foreground/70 hover:text-accent transition-colors">
                    {link}
                  </a>
                </li>
              ))}
            </ul>
          </div>

          {/* Categories */}
          <div>
            <h4 className="font-heading font-semibold mb-4">Report Categories</h4>
            <ul className="space-y-2">
              {["Infrastructure", "Misconduct", "Water & Sanitation", "Electricity"].map((link) => (
                <li key={link}>
                  <a href="#" className="text-sm text-primary-foreground/70 hover:text-accent transition-colors">
                    {link}
                  </a>
                </li>
              ))}
            </ul>
          </div>

          {/* Contact */}
          <div>
            <h4 className="font-heading font-semibold mb-4">Contact Us</h4>
            <ul className="space-y-3">
              <li className="flex items-center gap-2 text-sm text-primary-foreground/70">
                <Mail className="w-4 h-4 text-accent" />
                support@citizenconnect.gov.in
              </li>
              <li className="flex items-center gap-2 text-sm text-primary-foreground/70">
                <Phone className="w-4 h-4 text-accent" />
                1800-XXX-XXXX (Toll Free)
              </li>
              <li className="flex items-start gap-2 text-sm text-primary-foreground/70">
                <MapPin className="w-4 h-4 text-accent flex-shrink-0 mt-0.5" />
                Ministry of Public Grievances, New Delhi
              </li>
            </ul>
          </div>
        </div>

        {/* Bottom Bar */}
        <div className="pt-8 border-t border-primary-foreground/10 flex flex-col md:flex-row justify-between items-center gap-4">
          <p className="text-sm text-primary-foreground/50">
            © 2024 Citizen Connect. A Government of India Initiative.
          </p>
          <div className="flex gap-6">
            <a href="#" className="text-sm text-primary-foreground/50 hover:text-accent transition-colors">
              Privacy Policy
            </a>
            <a href="#" className="text-sm text-primary-foreground/50 hover:text-accent transition-colors">
              Terms of Service
            </a>
            <a href="#" className="text-sm text-primary-foreground/50 hover:text-accent transition-colors">
              RTI
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
