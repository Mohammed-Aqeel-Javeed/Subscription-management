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
  Globe
} from "lucide-react";

export default function LandingPage() {
  const navigate = useNavigate();

  const features = [
    {
      icon: <Bell className="w-6 h-6" />,
      title: "Smart Reminders",
      description: "Never miss a renewal with intelligent notification system"
    },
    {
      icon: <Calendar className="w-6 h-6" />,
      title: "Calendar View",
      description: "Visualize all subscriptions in monthly and yearly calendars"
    },
    {
      icon: <TrendingUp className="w-6 h-6" />,
      title: "Cost Analytics",
      description: "Track spending trends and optimize your subscription costs"
    },
    {
      icon: <Shield className="w-6 h-6" />,
      title: "Compliance Ready",
      description: "Stay compliant with built-in compliance tracking and reporting"
    },
    {
      icon: <Users className="w-6 h-6" />,
      title: "Team Management",
      description: "Manage employees, departments, and subscription assignments"
    },
    {
      icon: <BarChart3 className="w-6 h-6" />,
      title: "Detailed Reports",
      description: "Generate comprehensive reports for better decision making"
    }
  ];

  const benefits = [
    "Centralized subscription management",
    "Automated renewal tracking",
    "Cost optimization insights",
    "Multi-user collaboration",
    "Secure data encryption",
    "Export and import capabilities"
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
                className="h-10 w-10 object-contain"
                style={{
                  filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.1)) brightness(1.1) contrast(1.2)'
                }}
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
            Bring the power of organized
            <br />
            <span className="bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
              subscription management
            </span>
            <br />
            to your team
          </h1>
          
          <p className="text-xl text-gray-600 mb-8 max-w-3xl mx-auto">
            Trackla helps teams track, manage, and optimize all their subscriptions in one place. 
            Never miss a renewal, reduce costs, and stay compliant.
          </p>

          <div className="flex items-center justify-center gap-4">
            <Button
              size="lg"
              onClick={() => navigate("/signup")}
              className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white text-lg px-8 py-6 shadow-xl hover:shadow-2xl transition-all"
            >
              Try it free
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

      {/* Features Section */}
      <section className="max-w-7xl mx-auto px-6 py-20">
        <motion.div
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          transition={{ duration: 0.6 }}
          viewport={{ once: true }}
          className="text-center mb-16"
        >
          <h2 className="text-4xl font-bold text-gray-900 mb-4">
            Everything you need to manage subscriptions
          </h2>
          <p className="text-xl text-gray-600">
            Powerful features designed for modern teams
          </p>
        </motion.div>

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
              Choose the plan that's right for your team
            </p>
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
                <p className="text-gray-600 mb-4">Perfect for small teams</p>
                <div className="flex items-baseline justify-center gap-2">
                  <span className="text-5xl font-bold text-gray-900">$29</span>
                  <span className="text-gray-600">/month</span>
                </div>
              </div>
              <ul className="space-y-4 mb-8">
                <li className="flex items-start gap-3">
                  <CheckCircle2 className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
                  <span className="text-gray-700">Up to 50 subscriptions</span>
                </li>
                <li className="flex items-start gap-3">
                  <CheckCircle2 className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
                  <span className="text-gray-700">5 team members</span>
                </li>
                <li className="flex items-start gap-3">
                  <CheckCircle2 className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
                  <span className="text-gray-700">Email reminders</span>
                </li>
                <li className="flex items-start gap-3">
                  <CheckCircle2 className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
                  <span className="text-gray-700">Basic reports</span>
                </li>
                <li className="flex items-start gap-3">
                  <CheckCircle2 className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
                  <span className="text-gray-700">Email support</span>
                </li>
              </ul>
              <Button
                onClick={() => navigate("/signup")}
                className="w-full bg-gray-900 hover:bg-gray-800 text-white"
              >
                Get Started
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
                <p className="text-blue-100 mb-4">For growing teams</p>
                <div className="flex items-baseline justify-center gap-2">
                  <span className="text-5xl font-bold text-white">$79</span>
                  <span className="text-blue-100">/month</span>
                </div>
              </div>
              <ul className="space-y-4 mb-8">
                <li className="flex items-start gap-3">
                  <CheckCircle2 className="w-5 h-5 text-green-300 flex-shrink-0 mt-0.5" />
                  <span className="text-white">Unlimited subscriptions</span>
                </li>
                <li className="flex items-start gap-3">
                  <CheckCircle2 className="w-5 h-5 text-green-300 flex-shrink-0 mt-0.5" />
                  <span className="text-white">Unlimited team members</span>
                </li>
                <li className="flex items-start gap-3">
                  <CheckCircle2 className="w-5 h-5 text-green-300 flex-shrink-0 mt-0.5" />
                  <span className="text-white">Advanced reminders</span>
                </li>
                <li className="flex items-start gap-3">
                  <CheckCircle2 className="w-5 h-5 text-green-300 flex-shrink-0 mt-0.5" />
                  <span className="text-white">Advanced analytics</span>
                </li>
                <li className="flex items-start gap-3">
                  <CheckCircle2 className="w-5 h-5 text-green-300 flex-shrink-0 mt-0.5" />
                  <span className="text-white">Compliance tracking</span>
                </li>
                <li className="flex items-start gap-3">
                  <CheckCircle2 className="w-5 h-5 text-green-300 flex-shrink-0 mt-0.5" />
                  <span className="text-white">Priority support</span>
                </li>
              </ul>
              <Button
                onClick={() => navigate("/signup")}
                className="w-full bg-white text-blue-600 hover:bg-gray-100"
              >
                Get Started
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
                onClick={() => navigate("/signup")}
                variant="outline"
                className="w-full border-2 border-gray-900 text-gray-900 hover:bg-gray-900 hover:text-white"
              >
                Contact Sales
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
            Ready to take control of your subscriptions?
          </h2>
          <p className="text-xl text-blue-100 mb-8">
            Join teams already managing their subscriptions with Trackla
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
