import Header from "@/components/Header";
import HeroSection from "@/components/HeroSection";
import ReportCategories from "@/components/ReportCategories";
import BudgetTracker from "@/components/BudgetTracker";
import HowItWorks from "@/components/HowItWorks";
import Footer from "@/components/Footer";

const Index = () => {
  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main>
        <HeroSection />
        <ReportCategories />
        <BudgetTracker />
        <HowItWorks />
      </main>
      <Footer />
    </div>
  );
};

export default Index;
