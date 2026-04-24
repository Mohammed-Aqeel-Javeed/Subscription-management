import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";
import {
  Bell,
  Calendar,
  TrendingUp,
  Shield,
  Users,
  BarChart3,
  CheckCircle2,
  ArrowRight,
  Zap,
  Lock,
  Globe,
  Star
} from "lucide-react";
import { API_BASE_URL } from "../lib/config";

export default function LandingPage() {
  const navigate = useNavigate();
  const [pricingLoading, setPricingLoading] = useState<string | null>(null);
  const [pricingError, setPricingError] = useState<string | null>(null);

  const handlePricingClick = async (plan: "starter" | "professional") => {
    setPricingLoading(plan);
    setPricingError(null);
    try {
      const res = await fetch(`${API_BASE_URL}/api/stripe/checkout-session`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan, mode: "landing" }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setPricingError(data.message || `Server error (${res.status}). Please try again.`);
        return;
      }
      if (data.url) {
        window.location.href = data.url;
      } else {
        setPricingError("No checkout URL returned. Please try again.");
      }
    } catch (err: any) {
      setPricingError("Network error — could not reach the server. Is it running?");
    } finally {
      setPricingLoading(null);
    }
  };

  const features = [
    {
      icon: <Bell className="w-6 h-6" />,
      title: "Renewal & filing reminders",
      description: "Set lead times, escalate ownership, and stay ahead of deadlines."
    },
    {
      icon: <Calendar className="w-6 h-6" />,
      title: "Unified calendar",
      description: "See subscriptions, compliance deadlines, and renewals in one view."
    },
    {
      icon: <TrendingUp className="w-6 h-6" />,
      title: "Spend analytics (LCY)",
      description: "Track totals in local currency with trends you can act on."
    },
    {
      icon: <Shield className="w-6 h-6" />,
      title: "Compliance workflows",
      description: "Track category, authority, status, submission dates, and evidence."
    },
    {
      icon: <Users className="w-6 h-6" />,
      title: "Ownership by team",
      description: "Assign owners by employee/department so nothing falls through."
    },
    {
      icon: <BarChart3 className="w-6 h-6" />,
      title: "Import/export ready",
      description: "Start fast with Excel import and export clean reports anytime."
    }
  ];

  const benefits = [
    "A single source of truth for recurring services and deadlines",
    "Stop surprise renewals with proactive lead-time reminders",
    "Track compliance filings with status, notes, and submission evidence",
    "Understand spend with local-currency (LCY) reporting and trends",
    "Assign ownership by employee and department for accountability",
    "Move fast with Excel import/export and share-ready reporting"
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50">
      {/* Navigation Header */}
      <nav className="bg-white/80 backdrop-blur-md border-b border-gray-200 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            {/* Logo */}
            <div className="flex items-center gap-3">
              <img 
                src="/assets/logo.png" 
                alt="Trackla Logo" 
                className="h-10 w-10 object-contain drop-shadow-sm"
              />
              <span className="text-2xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
                Trackla
              </span>
            </div>

            {/* Navigation Buttons */}
            <div className="flex items-center gap-4">
              <Button
                variant="ghost"
                onClick={() => {
                  const pricingSection = document.getElementById('pricing');
                  pricingSection?.scrollIntoView({ behavior: 'smooth' });
                }}
                className="text-gray-700 hover:text-blue-600 hover:bg-blue-50"
              >
                Pricing
              </Button>
              <Button
                variant="ghost"
                onClick={() => navigate("/login")}
                className="text-gray-700 hover:text-blue-600 hover:bg-blue-50"
              >
                Sign In
              </Button>
              <Button
                onClick={() => navigate("/signup")}
                className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white shadow-lg"
              >
                Get Started Free
              </Button>
            </div>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="max-w-7xl mx-auto px-6 py-20">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="text-center"
        >
          <h1 className="text-5xl md:text-6xl font-bold text-gray-900 mb-6 leading-tight">
            Turn recurring work into
            <br />
            <span className="bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
              clear ownership & control
            </span>
            <br />
            with Trackla
          </h1>
          
          <p className="text-xl text-gray-600 mb-8 max-w-3xl mx-auto">
            Trackla brings subscriptions, compliance filings, and renewals into one secure workspace.
            Track every due date, assign owners, and see spend trends in local currency—without spreadsheets.
          </p>

          <div className="flex items-center justify-center gap-4">
            <Button
              size="lg"
              onClick={() => navigate("/signup")}
              className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white text-lg px-8 py-6 shadow-xl hover:shadow-2xl transition-all"
            >
              Get started free
              <ArrowRight className="ml-2 w-5 h-5" />
            </Button>
          </div>

          {/* Hero Image/Dashboard Preview */}
          <motion.div
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.2 }}
            className="mt-16 rounded-2xl shadow-2xl overflow-hidden border-4 border-white"
          >
            <div className="bg-gradient-to-br from-gray-900 to-gray-800 p-8">
              <div className="bg-white rounded-xl shadow-lg p-6">
                <div className="grid grid-cols-4 gap-4 mb-6">
                  <div className="bg-blue-50 rounded-lg p-4 border border-blue-200">
                    <div className="text-blue-600 font-semibold text-sm mb-1">Active</div>
                    <div className="text-2xl font-bold text-gray-900">24</div>
                  </div>
                  <div className="bg-green-50 rounded-lg p-4 border border-green-200">
                    <div className="text-green-600 font-semibold text-sm mb-1">Upcoming</div>
                    <div className="text-2xl font-bold text-gray-900">8</div>
                  </div>
                  <div className="bg-orange-50 rounded-lg p-4 border border-orange-200">
                    <div className="text-orange-600 font-semibold text-sm mb-1">Expiring</div>
                    <div className="text-2xl font-bold text-gray-900">3</div>
                  </div>
                  <div className="bg-purple-50 rounded-lg p-4 border border-purple-200">
                    <div className="text-purple-600 font-semibold text-sm mb-1">Total Cost</div>
                    <div className="text-2xl font-bold text-gray-900">$12.5K</div>
                  </div>
                </div>
                <div className="h-48 bg-gradient-to-br from-blue-100 to-indigo-100 rounded-lg flex items-center justify-center">
                  <BarChart3 className="w-24 h-24 text-blue-600 opacity-50" />
                </div>
              </div>
            </div>
          </motion.div>
        </motion.div>
      </section>

      {/* Everything you need Section - Heading Only */}
      <section className="max-w-7xl mx-auto px-6 pt-20 pb-8">
        <motion.div
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          transition={{ duration: 0.6 }}
          viewport={{ once: true }}
          className="text-center mb-8"
        >
          <h2 className="text-4xl font-bold text-gray-900 mb-4">
            Everything you need to run recurring operations
          </h2>
          <p className="text-xl text-gray-600">
            Subscriptions, compliance, and renewals—built for teams.
          </p>
        </motion.div>
      </section>

      {/* Three Modules Section */}
      <section className="max-w-7xl mx-auto px-6 pt-8 pb-20">
        <motion.div
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          transition={{ duration: 0.6 }}
          viewport={{ once: true }}
          className="text-center mb-16"
        >
          <div className="inline-flex items-center gap-2 mb-6 px-6 py-2 bg-blue-50/80 rounded-full">
            <Star className="w-4 h-4 text-blue-600" fill="currentColor" />
            <span className="text-sm font-semibold text-blue-600 tracking-wider uppercase">CORE MODULES</span>
          </div>
          <h2 className="text-4xl font-bold text-gray-900 mb-4">
            Three modules.
            <br />
            <span className="bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
              One system of record.
            </span>
          </h2>
          <p className="text-lg text-gray-600 max-w-3xl mx-auto">
            Trackla is built around three tightly integrated modules that cover the entire lifecycle—from onboarding a subscription, to meeting filing deadlines, to renewal decisions.
          </p>
        </motion.div>

        {/* Module 1: Subscriptions */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          viewport={{ once: true }}
          className="mb-16"
        >
          <div className="grid md:grid-cols-2 gap-12 items-center">
            <div>
              <div className="inline-block mb-4">
                <span className="text-sm font-semibold text-blue-600 tracking-wider uppercase">MODULE 1</span>
              </div>
              <h3 className="text-3xl font-bold text-gray-900 mb-4">Subscriptions</h3>
              <p className="text-gray-600 mb-6">
                Capture every subscription in one place—cost, cycle, owners, and next renewal. Trackla helps you understand what you pay for, who owns it, and what’s coming next.
              </p>
              <ul className="space-y-3">
                <li className="flex items-start gap-3">
                  <CheckCircle2 className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
                  <span className="text-gray-700">Central dashboard with status, owners, vendors, and next renewal at a glance</span>
                </li>
                <li className="flex items-start gap-3">
                  <CheckCircle2 className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
                  <span className="text-gray-700">Categorize by department, vendor, and custom fields—standardize across the company</span>
                </li>
                <li className="flex items-start gap-3">
                  <CheckCircle2 className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
                  <span className="text-gray-700">Calendar view for upcoming renewals and key dates—reschedule without losing context</span>
                </li>
                <li className="flex items-start gap-3">
                  <CheckCircle2 className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
                  <span className="text-gray-700">LCY-based analytics to spot growth, waste, and renewal risk</span>
                </li>
              </ul>
            </div>
            <div className="bg-gradient-to-br from-blue-50 to-indigo-100 rounded-2xl p-8 shadow-lg border border-blue-200">
              <div className="bg-white rounded-xl p-6 shadow-md">
                <div className="flex items-center justify-between mb-4">
                  <h4 className="font-bold text-gray-900">Overview</h4>
                  <span className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded-full">Trackla</span>
                </div>
                <div className="space-y-3">
                  <div className="flex items-center justify-between p-3 bg-blue-50 rounded-lg">
                    <span className="text-sm font-medium text-gray-700">Active Subscriptions</span>
                    <span className="text-lg font-bold text-blue-600">24</span>
                  </div>
                  <div className="flex items-center justify-between p-3 bg-green-50 rounded-lg">
                    <span className="text-sm font-medium text-gray-700">Monthly Spend (LCY)</span>
                    <span className="text-lg font-bold text-green-600">$2,000</span>
                  </div>
                  <div className="flex items-center justify-between p-3 bg-orange-50 rounded-lg">
                    <span className="text-sm font-medium text-gray-700">Upcoming Renewals</span>
                    <span className="text-lg font-bold text-orange-600">3</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </motion.div>

        {/* Module 2: Compliance Tracking */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          viewport={{ once: true }}
          className="mb-16"
        >
          <div className="grid md:grid-cols-2 gap-12 items-center">
            <div className="order-2 md:order-1">
              <div className="bg-gradient-to-br from-green-50 to-emerald-100 rounded-2xl p-8 shadow-lg border border-green-200">
                <div className="bg-white rounded-xl p-6 shadow-md">
                  <div className="flex items-center justify-between mb-4">
                    <h4 className="font-bold text-gray-900">Compliance Status</h4>
                    <span className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded-full">Healthy</span>
                  </div>
                  <div className="grid grid-cols-2 gap-3 mb-4">
                    <div className="text-center p-3 bg-green-50 rounded-lg">
                      <div className="text-2xl font-bold text-green-600">18</div>
                      <div className="text-xs text-gray-600">Compliant</div>
                    </div>
                    <div className="text-center p-3 bg-orange-50 rounded-lg">
                      <div className="text-2xl font-bold text-orange-600">4</div>
                      <div className="text-xs text-gray-600">Pending</div>
                    </div>
                  </div>
                  <div className="flex items-center justify-between p-3 bg-blue-50 rounded-lg">
                    <span className="text-sm font-medium text-gray-700">Overall Score</span>
                    <span className="text-lg font-bold text-blue-600">92%</span>
                  </div>
                </div>
              </div>
            </div>
            <div className="order-1 md:order-2">
              <div className="inline-block mb-4">
                <span className="text-sm font-semibold text-green-600 tracking-wider uppercase">MODULE 2</span>
              </div>
              <h3 className="text-3xl font-bold text-gray-900 mb-4">Compliance</h3>
              <p className="text-gray-600 mb-6">
                Track filing obligations with clear deadlines, statuses, and evidence. Trackla keeps your team aligned on what’s due, who owns it, and what was submitted.
              </p>
              <ul className="space-y-3">
                <li className="flex items-start gap-3">
                  <CheckCircle2 className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
                  <span className="text-gray-700">Track category and governing authority per filing with due dates and recurrence</span>
                </li>
                <li className="flex items-start gap-3">
                  <CheckCircle2 className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
                  <span className="text-gray-700">Store notes and supporting documents for each submission</span>
                </li>
                <li className="flex items-start gap-3">
                  <CheckCircle2 className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
                  <span className="text-gray-700">Reminders and status tracking so pending items don’t turn into late penalties</span>
                </li>
              </ul>
            </div>
          </div>
        </motion.div>

        {/* Module 3: Renewal Automation */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          viewport={{ once: true }}
          className="mb-16"
        >
          <div className="grid md:grid-cols-2 gap-12 items-center">
            <div>
              <div className="inline-block mb-4">
                <span className="text-sm font-semibold text-orange-600 tracking-wider uppercase">MODULE 3</span>
              </div>
              <h3 className="text-3xl font-bold text-gray-900 mb-4">Renewals</h3>
              <p className="text-gray-600 mb-6">
                Plan renewals early and keep a clean history. Trackla surfaces what’s expiring, what changed, and what needs a decision—before the deadline.
              </p>
              <ul className="space-y-3">
                <li className="flex items-start gap-3">
                  <CheckCircle2 className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
                  <span className="text-gray-700">Configurable lead-time reminders and escalations to the right stakeholders</span>
                </li>
                <li className="flex items-start gap-3">
                  <CheckCircle2 className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
                  <span className="text-gray-700">Track renewal status, notes, and documents in one place—no email threads</span>
                </li>
                <li className="flex items-start gap-3">
                  <CheckCircle2 className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
                  <span className="text-gray-700">Understand renewals with history and cost-change context to negotiate better terms</span>
                </li>
                <li className="flex items-start gap-3">
                  <CheckCircle2 className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
                  <span className="text-gray-700">Avoid accidental renewals by tracking owners and decision points before expiry</span>
                </li>
              </ul>
            </div>
            <div className="bg-gradient-to-br from-orange-50 to-yellow-100 rounded-2xl p-8 shadow-lg border border-orange-200">
              <div className="bg-white rounded-xl p-6 shadow-md">
                <div className="flex items-center justify-between mb-4">
                  <h4 className="font-bold text-gray-900">Upcoming Renewals</h4>
                  <span className="text-xs bg-orange-100 text-orange-700 px-2 py-1 rounded-full">Pending</span>
                </div>
                <div className="space-y-3">
                  <div className="p-3 bg-red-50 rounded-lg border-l-4 border-red-500">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm font-semibold text-gray-900">Back Business</span>
                      <span className="text-xs font-bold text-red-600">3 days</span>
                    </div>
                    <span className="text-xs text-gray-600">Expiring</span>
                  </div>
                  <div className="p-3 bg-yellow-50 rounded-lg border-l-4 border-yellow-500">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm font-semibold text-gray-900">AWS License</span>
                      <span className="text-xs font-bold text-yellow-600">15 days</span>
                    </div>
                    <span className="text-xs text-gray-600">Pending</span>
                  </div>
                  <div className="p-3 bg-green-50 rounded-lg border-l-4 border-green-500">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm font-semibold text-gray-900">Figma Enterprise</span>
                      <span className="text-xs font-bold text-green-600">45 days</span>
                    </div>
                    <span className="text-xs text-gray-600">Renewed</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </motion.div>
      </section>

      {/* Features Grid Section */}
      <section className="max-w-7xl mx-auto px-6 py-20">
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
          {features.map((feature, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: index * 0.1 }}
              viewport={{ once: true }}
              className="bg-white rounded-xl p-6 shadow-lg hover:shadow-xl transition-shadow border border-gray-100"
            >
              <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-lg flex items-center justify-center text-white mb-4">
                {feature.icon}
              </div>
              <h3 className="text-xl font-semibold text-gray-900 mb-2">
                {feature.title}
              </h3>
              <p className="text-gray-600">
                {feature.description}
              </p>
            </motion.div>
          ))}
        </div>
      </section>

      {/* Pricing Section */}
      <section id="pricing" className="bg-gradient-to-br from-gray-50 to-blue-50 py-20">
        <div className="max-w-7xl mx-auto px-6">
          <motion.div
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            transition={{ duration: 0.6 }}
            viewport={{ once: true }}
            className="text-center mb-16"
          >
            <h2 className="text-4xl font-bold text-gray-900 mb-4">
              Simple, transparent pricing
            </h2>
            <p className="text-xl text-gray-600">
              Start free and upgrade when your team grows
            </p>
            {pricingError && (
              <div className="mt-4 inline-flex items-center gap-2 px-4 py-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm max-w-md mx-auto">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" className="flex-shrink-0">
                  <path d="M12 8v4m0 4h.01M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0z" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                </svg>
                {pricingError}
              </div>
            )}
          </motion.div>

          <div className="grid md:grid-cols-3 gap-8 max-w-6xl mx-auto">
            {/* Starter Plan */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
              viewport={{ once: true }}
              className="bg-white rounded-2xl p-8 shadow-lg border border-gray-200 hover:shadow-xl transition-shadow"
            >
              <div className="text-center mb-6">
                <h3 className="text-2xl font-bold text-gray-900 mb-2">Starter</h3>
                <p className="text-gray-600 mb-4">For getting organized fast</p>
                <div className="flex items-baseline justify-center gap-2">
                  <span className="text-5xl font-bold text-gray-900">$29</span>
                  <span className="text-gray-600">/month</span>
                </div>
              </div>
              <ul className="space-y-4 mb-8">
                <li className="flex items-start gap-3">
                  <CheckCircle2 className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
                  <span className="text-gray-700">Up to 50 records (subscriptions/filings/renewals)</span>
                </li>
                <li className="flex items-start gap-3">
                  <CheckCircle2 className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
                  <span className="text-gray-700">5 team members</span>
                </li>
                <li className="flex items-start gap-3">
                  <CheckCircle2 className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
                  <span className="text-gray-700">Reminders and calendar view</span>
                </li>
                <li className="flex items-start gap-3">
                  <CheckCircle2 className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
                  <span className="text-gray-700">Basic dashboards and exports</span>
                </li>
                <li className="flex items-start gap-3">
                  <CheckCircle2 className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
                  <span className="text-gray-700">Email support</span>
                </li>
              </ul>
              <Button
                onClick={() => handlePricingClick("starter")}
                disabled={pricingLoading !== null}
                className="w-full bg-gray-900 hover:bg-gray-800 text-white disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {pricingLoading === "starter" ? "Loading…" : "Get Started"}
              </Button>
            </motion.div>

            {/* Professional Plan - Featured */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.1 }}
              viewport={{ once: true }}
              className="bg-gradient-to-br from-blue-600 to-indigo-600 rounded-2xl p-8 shadow-2xl border-4 border-blue-400 relative transform md:scale-105"
            >
              <div className="absolute -top-4 left-1/2 transform -translate-x-1/2">
                <span className="bg-yellow-400 text-gray-900 px-4 py-1 rounded-full text-sm font-bold">
                  MOST POPULAR
                </span>
              </div>
              <div className="text-center mb-6">
                <h3 className="text-2xl font-bold text-white mb-2">Professional</h3>
                <p className="text-blue-100 mb-4">For teams that run on Trackla</p>
                <div className="flex items-baseline justify-center gap-2">
                  <span className="text-5xl font-bold text-white">$79</span>
                  <span className="text-blue-100">/month</span>
                </div>
              </div>
              <ul className="space-y-4 mb-8">
                <li className="flex items-start gap-3">
                  <CheckCircle2 className="w-5 h-5 text-green-300 flex-shrink-0 mt-0.5" />
                  <span className="text-white">Unlimited records</span>
                </li>
                <li className="flex items-start gap-3">
                  <CheckCircle2 className="w-5 h-5 text-green-300 flex-shrink-0 mt-0.5" />
                  <span className="text-white">Unlimited team members</span>
                </li>
                <li className="flex items-start gap-3">
                  <CheckCircle2 className="w-5 h-5 text-green-300 flex-shrink-0 mt-0.5" />
                  <span className="text-white">Advanced reminders and escalations</span>
                </li>
                <li className="flex items-start gap-3">
                  <CheckCircle2 className="w-5 h-5 text-green-300 flex-shrink-0 mt-0.5" />
                  <span className="text-white">Advanced analytics and trends</span>
                </li>
                <li className="flex items-start gap-3">
                  <CheckCircle2 className="w-5 h-5 text-green-300 flex-shrink-0 mt-0.5" />
                  <span className="text-white">Compliance tracking and histories</span>
                </li>
                <li className="flex items-start gap-3">
                  <CheckCircle2 className="w-5 h-5 text-green-300 flex-shrink-0 mt-0.5" />
                  <span className="text-white">Priority support</span>
                </li>
              </ul>
              <Button
                onClick={() => handlePricingClick("professional")}
                disabled={pricingLoading !== null}
                className="w-full bg-white text-blue-600 hover:bg-gray-100 disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {pricingLoading === "professional" ? "Loading…" : "Get Started"}
              </Button>
            </motion.div>

            {/* Enterprise Plan */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.2 }}
              viewport={{ once: true }}
              className="bg-white rounded-2xl p-8 shadow-lg border border-gray-200 hover:shadow-xl transition-shadow"
            >
              <div className="text-center mb-6">
                <h3 className="text-2xl font-bold text-gray-900 mb-2">Enterprise</h3>
                <p className="text-gray-600 mb-4">For large organizations</p>
                <div className="flex items-baseline justify-center gap-2">
                  <span className="text-5xl font-bold text-gray-900">Custom</span>
                </div>
              </div>
              <ul className="space-y-4 mb-8">
                <li className="flex items-start gap-3">
                  <CheckCircle2 className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
                  <span className="text-gray-700">Everything in Professional</span>
                </li>
                <li className="flex items-start gap-3">
                  <CheckCircle2 className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
                  <span className="text-gray-700">Custom integrations</span>
                </li>
                <li className="flex items-start gap-3">
                  <CheckCircle2 className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
                  <span className="text-gray-700">Dedicated account manager</span>
                </li>
                <li className="flex items-start gap-3">
                  <CheckCircle2 className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
                  <span className="text-gray-700">SLA guarantee</span>
                </li>
                <li className="flex items-start gap-3">
                  <CheckCircle2 className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
                  <span className="text-gray-700">24/7 phone support</span>
                </li>
              </ul>
              <Button
                disabled
                variant="outline"
                className="w-full border-2 border-gray-300 text-gray-400 opacity-60 cursor-not-allowed"
              >
                Coming Soon
              </Button>
            </motion.div>
          </div>
        </div>
      </section>

      {/* Benefits Section */}
      <section className="bg-white py-20">
        <div className="max-w-7xl mx-auto px-6">
          <div className="grid md:grid-cols-2 gap-12 items-center">
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              whileInView={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.6 }}
              viewport={{ once: true }}
            >
              <h2 className="text-4xl font-bold text-gray-900 mb-6">
                Why teams choose Trackla
              </h2>
              <div className="space-y-4">
                {benefits.map((benefit, index) => (
                  <div key={index} className="flex items-start gap-3">
                    <CheckCircle2 className="w-6 h-6 text-green-600 flex-shrink-0 mt-1" />
                    <span className="text-lg text-gray-700">{benefit}</span>
                  </div>
                ))}
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, x: 20 }}
              whileInView={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.6 }}
              viewport={{ once: true }}
              className="grid grid-cols-2 gap-4"
            >
              <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl p-6 border border-blue-200">
                <Zap className="w-8 h-8 text-blue-600 mb-3" />
                <h3 className="font-semibold text-gray-900 mb-2">Fast Setup</h3>
                <p className="text-sm text-gray-600">Get started in minutes</p>
              </div>
              <div className="bg-gradient-to-br from-green-50 to-emerald-50 rounded-xl p-6 border border-green-200">
                <Lock className="w-8 h-8 text-green-600 mb-3" />
                <h3 className="font-semibold text-gray-900 mb-2">Secure</h3>
                <p className="text-sm text-gray-600">Enterprise-grade security</p>
              </div>
              <div className="bg-gradient-to-br from-purple-50 to-pink-50 rounded-xl p-6 border border-purple-200">
                <Users className="w-8 h-8 text-purple-600 mb-3" />
                <h3 className="font-semibold text-gray-900 mb-2">Collaborative</h3>
                <p className="text-sm text-gray-600">Built for teams</p>
              </div>
              <div className="bg-gradient-to-br from-orange-50 to-red-50 rounded-xl p-6 border border-orange-200">
                <Globe className="w-8 h-8 text-orange-600 mb-3" />
                <h3 className="font-semibold text-gray-900 mb-2">Accessible</h3>
                <p className="text-sm text-gray-600">Access anywhere</p>
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="max-w-7xl mx-auto px-6 py-20">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          viewport={{ once: true }}
          className="bg-gradient-to-r from-blue-600 to-indigo-600 rounded-3xl p-12 text-center shadow-2xl"
        >
          <h2 className="text-4xl font-bold text-white mb-4">
            Ready to run renewals and compliance on time?
          </h2>
          <p className="text-xl text-blue-100 mb-8">
            Start with one module—grow into a single system of record.
          </p>
          <Button
            size="lg"
            onClick={() => navigate("/signup")}
            className="bg-white text-blue-600 hover:bg-gray-100 text-lg px-8 py-6 shadow-xl"
          >
            Get Started Free
            <ArrowRight className="ml-2 w-5 h-5" />
          </Button>
        </motion.div>
      </section>

      {/* Footer */}
      <footer className="bg-gray-900 text-gray-400 py-12">
        <div className="max-w-7xl mx-auto px-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <img 
                src="/assets/logo.png" 
                alt="Trackla Logo" 
                className="h-8 w-8 object-contain"
                style={{
                  filter: 'brightness(0) invert(1)'
                }}
              />
              <span className="text-xl font-bold text-white">Trackla</span>
            </div>
            <div className="text-sm">
              © 2025 Trackla. All rights reserved.
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
