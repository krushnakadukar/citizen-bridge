import { Shield, Menu, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useState } from "react";

const Header = () => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  return (
    <header className="fixed top-0 left-0 right-0 z-50 bg-card/80 backdrop-blur-md border-b border-border">
      <div className="container mx-auto px-4">
        <div className="flex items-center justify-between h-16">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg gradient-hero flex items-center justify-center">
              <Shield className="w-5 h-5 text-primary-foreground" />
            </div>
            <div>
              <h1 className="font-heading font-bold text-foreground text-lg leading-tight">
                Citizen Connect
              </h1>
              <p className="text-xs text-muted-foreground">Public Accountability Portal</p>
            </div>
          </div>

          {/* Desktop Navigation */}
          <nav className="hidden md:flex items-center gap-6">
            <a href="#reports" className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">
              Report Issue
            </a>
            <a href="#transparency" className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">
              Budget Tracker
            </a>
            <a href="#how-it-works" className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">
              How It Works
            </a>
            <Button variant="default" size="sm">
              Sign In
            </Button>
          </nav>

          {/* Mobile Menu Toggle */}
          <button
            className="md:hidden p-2 text-foreground"
            onClick={() => setIsMenuOpen(!isMenuOpen)}
          >
            {isMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
        </div>

        {/* Mobile Navigation */}
        {isMenuOpen && (
          <nav className="md:hidden py-4 border-t border-border animate-fade-in">
            <div className="flex flex-col gap-3">
              <a href="#reports" className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors py-2">
                Report Issue
              </a>
              <a href="#transparency" className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors py-2">
                Budget Tracker
              </a>
              <a href="#how-it-works" className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors py-2">
                How It Works
              </a>
              <Button variant="default" size="sm" className="w-full mt-2">
                Sign In
              </Button>
            </div>
          </nav>
        )}
      </div>
    </header>
  );
};

export default Header;
