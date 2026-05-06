import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import {
  BarChart3,
  Bell,
  Calendar,
  Check,
  ChevronRight,
  DollarSign,
  FileUp,
  HelpCircle,
  Layers,
  Mail,
  Menu,
  MessageSquare,
  RefreshCw,
  Settings,
  Shield,
  ShieldCheck,
  TrendingUp,
  Users,
  X,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { API_BASE_URL } from "../lib/config";

function SpendMiniChart() {
  const points = useMemo(
    () => [
      { x: 0, y: 70 },
      { x: 30, y: 62 },
      { x: 60, y: 66 },
      { x: 90, y: 48 },
      { x: 120, y: 54 },
      { x: 150, y: 36 },
      { x: 180, y: 40 },
      { x: 210, y: 22 },
      { x: 240, y: 26 },
      { x: 270, y: 14 },
    ],
    []
  );

  const polyline = useMemo(() => points.map((p) => `${p.x},${p.y}`).join(" "), [points]);
  const area = useMemo(
    () => [...points.map((p) => `${p.x},${p.y}`), "270,90", "0,90"].join(" "),
    [points]
  );

  return (
    <svg
      viewBox="0 0 270 90"
      className="w-full h-16 text-orange-500"
      preserveAspectRatio="none"
      role="img"
      aria-label="Spending trend"
    >
      <polygon points={area} fill="currentColor" fillOpacity="0.16" />
      <polyline
        points={polyline}
        fill="none"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
      <circle
        cx={points[points.length - 1].x}
        cy={points[points.length - 1].y}
        r="4"
        fill="currentColor"
        stroke="hsl(var(--background))"
        strokeWidth="2"
      />
    </svg>
  );
}

function DashboardMockup() {
  return (
    <div className="relative">
      <div className="rounded-2xl border border-indigo-100 bg-white shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b border-indigo-50 bg-white">
          <div className="flex items-center gap-2">
            <img src="/assets/logo.png" alt="Trackla" className="w-6 h-6 object-contain" />
            <span className="text-xs font-bold text-indigo-600">Dashboard</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-semibold px-3 py-1 rounded-full bg-gradient-to-r from-indigo-600 to-violet-500 text-white">
              Get Started
            </span>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-4">
          {[
            { label: "Monthly Spend", value: "$447k", sub: "+12%", cls: "text-indigo-600", bg: "bg-indigo-50" },
            { label: "Active Subs", value: "14", sub: "active", cls: "text-emerald-600", bg: "bg-emerald-50" },
            { label: "Renewals", value: "2", sub: "next 30d", cls: "text-orange-500", bg: "bg-orange-50" },
            { label: "Compliance", value: "92%", sub: "compliant", cls: "text-blue-600", bg: "bg-blue-50" },
          ].map((c) => (
            <div key={c.label} className={`rounded-xl p-3 shadow-sm border border-slate-100 ${c.bg}`}>
              <p className="text-[10px] font-medium text-slate-500 mb-1">{c.label}</p>
              <p className={`text-lg font-extrabold leading-none ${c.cls}`}>{c.value}</p>
              <p className={`text-[10px] font-semibold mt-1 ${c.cls}`}>{c.sub}</p>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-5 gap-3 px-4 pb-4">
          <div className="sm:col-span-3 rounded-xl p-3 border border-indigo-50 bg-white shadow-sm">
            <div className="flex items-center justify-between mb-2">
              <p className="text-[11px] font-bold text-slate-900">Spending Trends</p>
              <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-orange-50 text-orange-600">+14.2%</span>
            </div>
            <SpendMiniChart />
            <div className="flex justify-between mt-1">
              {[
                "Oct",
                "Nov",
                "Dec",
                "Jan",
                "Feb",
                "Mar",
              ].map((m) => (
                <span key={m} className="text-[9px] text-slate-400">
                  {m}
                </span>
              ))}
            </div>
          </div>

          <div className="sm:col-span-2 rounded-xl p-3 border border-indigo-50 bg-white shadow-sm">
            <p className="text-[11px] font-bold text-slate-900 mb-2">Top Categories</p>
            <svg viewBox="0 0 80 80" className="w-20 h-20 mx-auto" role="img" aria-label="Top categories">
              <circle cx="40" cy="40" r="28" fill="none" stroke="currentColor" className="text-indigo-100" strokeWidth="14" />
              <circle
                cx="40"
                cy="40"
                r="28"
                fill="none"
                stroke="currentColor"
                className="text-indigo-600"
                strokeWidth="14"
                strokeDasharray="70 106"
                transform="rotate(-90 40 40)"
              />
              <circle
                cx="40"
                cy="40"
                r="28"
                fill="none"
                stroke="currentColor"
                className="text-orange-500"
                strokeWidth="14"
                strokeDasharray="35 141"
                strokeDashoffset="-70"
                transform="rotate(-90 40 40)"
              />
              <circle
                cx="40"
                cy="40"
                r="28"
                fill="none"
                stroke="currentColor"
                className="text-blue-600"
                strokeWidth="14"
                strokeDasharray="25 151"
                strokeDashoffset="-105"
                transform="rotate(-90 40 40)"
              />
              <text x="40" y="44" textAnchor="middle" className="fill-slate-900" style={{ fontSize: 12, fontWeight: 800 }}>
                14
              </text>
            </svg>
            <div className="space-y-1 mt-2">
              {[
                { label: "Productivity", color: "bg-indigo-600" },
                { label: "Dev & Hosting", color: "bg-orange-500" },
                { label: "Analytics", color: "bg-blue-600" },
              ].map((l) => (
                <div key={l.label} className="flex items-center gap-2">
                  <div className={`w-2 h-2 rounded-full ${l.color}`} />
                  <span className="text-[10px] text-slate-500">{l.label}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="px-4 pb-4">
          <div className="rounded-xl overflow-hidden border border-indigo-50">
            <div className="px-3 py-2 flex items-center justify-between bg-gradient-to-r from-indigo-600 to-blue-600">
              <span className="text-[11px] font-bold text-white">Recent Subscriptions</span>
              <span className="text-[10px] text-white/80">View all →</span>
            </div>
            {[
              { name: "Microsoft 365", cost: "$12.5k", status: "Active" },
              { name: "AWS", cost: "$8.2k", status: "Active" },
              { name: "Adobe CC", cost: "$3.1k", status: "Expiring" },
              { name: "Slack", cost: "$1.8k", status: "Active" },
            ].map((row, i) => {
              const expiring = row.status === "Expiring";
              return (
                <div
                  key={row.name}
                  className={`flex items-center justify-between px-3 py-2 ${i % 2 === 0 ? "bg-slate-50" : "bg-white"} ${i === 0 ? "" : "border-t border-indigo-50"}`}
                >
                  <span className="text-[10px] font-semibold text-slate-900">{row.name}</span>
                  <span className="text-[10px] text-slate-500">{row.cost}</span>
                  <span
                    className={`px-2 py-0.5 rounded-full text-[9px] font-semibold ${
                      expiring ? "bg-orange-50 text-orange-600" : "bg-emerald-50 text-emerald-600"
                    }`}
                  >
                    {row.status}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

function Section({
  id,
  className,
  children,
}: {
  id: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <section id={id} className={`scroll-mt-24 ${className ?? ""}`}>
      {children}
    </section>
  );
}

function FeatureCard({
  icon: Icon,
  title,
  description,
  index,
}: {
  icon: React.ElementType;
  title: string;
  description: string;
  index: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      whileInView={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay: Math.min(index * 0.04, 0.2) }}
      viewport={{ once: true, amount: 0.2 }}
      className="rounded-2xl p-5 bg-white border border-indigo-100 shadow-sm hover:shadow-md transition-all duration-200 hover:-translate-y-1"
    >
      <div className="w-11 h-11 rounded-xl flex items-center justify-center mb-4 bg-gradient-to-r from-indigo-600 to-violet-500 text-white">
        <Icon size={20} />
      </div>
      <h3 className="text-[15px] font-bold text-slate-900 mb-2">{title}</h3>
      <p className="text-[13px] text-slate-600 leading-relaxed">{description}</p>
    </motion.div>
  );
}

function PricingCard({
  name,
  price,
  period,
  description,
  bullets,
  cta,
  popular,
  selected,
  disabled,
  onSelect,
  onCtaClick,
}: {
  name: string;
  price: string;
  period?: string;
  description: string;
  bullets: string[];
  cta: string;
  popular?: boolean;
  selected?: boolean;
  disabled?: boolean;
  onSelect?: () => void;
  onCtaClick?: () => void;
}) {
  const isActive = Boolean(selected);
  return (
    <motion.div
      whileHover={{ y: -6, scale: 1.01 }}
      whileTap={{ scale: 0.99 }}
      transition={{ type: "spring", stiffness: 320, damping: 22 }}
      className={`relative rounded-2xl p-6 flex flex-col h-full cursor-pointer transition-shadow duration-200 ${
        isActive
          ? "bg-gradient-to-br from-indigo-600 to-violet-500 text-white shadow-2xl"
          : "bg-white border border-indigo-100 shadow-sm"
      } ${selected ? "ring-2 ring-indigo-500 ring-offset-2 ring-offset-slate-50" : ""}`}
      role="button"
      tabIndex={0}
      onClick={onSelect}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") onSelect?.();
      }}
    >
      {popular && (
        <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-4 py-1 rounded-full text-xs font-bold bg-orange-500 text-white shadow-lg">
          MOST POPULAR
        </div>
      )}

      <div className="mb-5">
        <p className={`text-sm font-semibold ${isActive ? "text-white/80" : "text-slate-500"}`}>{name}</p>
        <div className="flex items-end gap-2 mt-1">
          <span className={`text-4xl font-extrabold leading-none ${isActive ? "text-white" : "text-slate-900"}`}>{price}</span>
          {period && <span className={`text-sm pb-1 ${isActive ? "text-white/70" : "text-slate-400"}`}>{period}</span>}
        </div>
        <p className={`text-sm mt-3 leading-relaxed ${isActive ? "text-white/80" : "text-slate-600"}`}>{description}</p>
      </div>

      <ul className="flex-1 space-y-2.5 mb-6">
        {bullets.map((b) => (
          <li key={b} className="flex items-start gap-2.5">
            <Check size={14} className="mt-0.5 flex-shrink-0" />
            <span className={`text-sm ${isActive ? "text-white/90" : "text-slate-700"}`}>{b}</span>
          </li>
        ))}
      </ul>

      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onCtaClick?.();
        }}
        disabled={disabled}
        className={`w-full rounded-xl py-2.5 text-sm font-semibold text-white shadow-md transition-all duration-200 hover:-translate-y-0.5 disabled:opacity-60 disabled:hover:translate-y-0 ${
          isActive
            ? "bg-white/20 border border-white/30 hover:bg-white/25"
            : "bg-gradient-to-r from-indigo-600 to-violet-500 hover:from-indigo-700 hover:to-violet-600"
        }`}
      >
        {cta}
      </button>
    </motion.div>
  );
}

export default function LandingPage() {
  const navigate = useNavigate();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [pricingLoading, setPricingLoading] = useState<string | null>(null);
  const [pricingError, setPricingError] = useState<string | null>(null);
  const [selectedPlan, setSelectedPlan] = useState<"starter" | "professional" | "enterprise">("professional");

  const [contactForm, setContactForm] = useState({ name: "", email: "", message: "" });
  const [contactSent, setContactSent] = useState(false);

  const scrollTo = (id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
    setMobileMenuOpen(false);
  };

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
    } catch {
      setPricingError("Network error — could not reach the server. Is it running?");
    } finally {
      setPricingLoading(null);
    }
  };

  const handleContactSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setContactSent(true);
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-indigo-50 via-slate-50 to-white">
      {/* NAVBAR */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-white/95 backdrop-blur-xl border-b border-indigo-100 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <button type="button" onClick={() => scrollTo("hero")} className="flex items-center gap-2" aria-label="Trackla Home">
              <img src="/assets/logo.png" alt="Trackla" className="w-10 h-10 object-contain" />
              <span className="text-lg font-extrabold text-indigo-600 tracking-tight">Trackla</span>
            </button>

            <div className="hidden md:flex items-center gap-7">
              {[
                { id: "features", label: "Features" },
                { id: "pricing", label: "Pricing" },
                { id: "help", label: "Help" },
                { id: "contact", label: "Contact" },
              ].map((l) => (
                <button
                  key={l.id}
                  type="button"
                  onClick={() => scrollTo(l.id)}
                  className="text-sm font-medium text-slate-600 hover:text-slate-900 transition-colors"
                >
                  {l.label}
                </button>
              ))}
            </div>

            <div className="hidden md:flex items-center gap-3">
              <button
                type="button"
                onClick={() => navigate("/login")}
                className="text-sm font-semibold text-indigo-600 hover:opacity-80 transition-opacity px-3 py-2"
              >
                Login
              </button>
              <Button
                onClick={() => navigate("/signup")}
                className="h-9 rounded-full px-5 bg-gradient-to-r from-indigo-600 to-violet-500 hover:from-indigo-700 hover:to-violet-600 text-white shadow-lg"
              >
                Get Started Free
              </Button>
            </div>

            <button
              type="button"
              className="md:hidden p-2 rounded-lg text-indigo-600"
              onClick={() => setMobileMenuOpen((v) => !v)}
              aria-label="Toggle menu"
            >
              {mobileMenuOpen ? <X size={22} /> : <Menu size={22} />}
            </button>
          </div>
        </div>

        {mobileMenuOpen && (
          <div className="md:hidden border-t border-indigo-100 bg-white px-4 py-4 space-y-1">
            {[
              { id: "features", label: "Features" },
              { id: "pricing", label: "Pricing" },
              { id: "help", label: "Help" },
              { id: "contact", label: "Contact" },
            ].map((l) => (
              <button
                key={l.id}
                type="button"
                onClick={() => scrollTo(l.id)}
                className="w-full text-left px-3 py-2.5 rounded-lg text-sm font-medium text-slate-700 hover:bg-indigo-50 transition-colors"
              >
                {l.label}
              </button>
            ))}
            <div className="pt-2 flex flex-col gap-2">
              <button
                type="button"
                onClick={() => {
                  setMobileMenuOpen(false);
                  navigate("/login");
                }}
                className="text-sm font-semibold px-4 py-2.5 rounded-xl border border-indigo-100 text-indigo-600"
              >
                Login
              </button>
              <button
                type="button"
                onClick={() => {
                  setMobileMenuOpen(false);
                  navigate("/signup");
                }}
                className="text-sm font-semibold px-4 py-2.5 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-500 text-white"
              >
                Get Started Free
              </button>
            </div>
          </div>
        )}
      </nav>

      {/* HERO */}
      <Section id="hero" className="pt-28 pb-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-14 items-center">
          <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.55 }}>
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full mb-6 text-xs font-semibold bg-white/70 border border-indigo-100 text-indigo-600 shadow-sm">
              <span className="w-2 h-2 rounded-full bg-indigo-600" />
              SaaS Subscription, Compliance &amp; Renewal Platform
            </div>

            <h1 className="mb-6 leading-tight text-slate-900 font-extrabold" style={{ fontSize: "clamp(2rem, 4vw, 3rem)", letterSpacing: "-0.06em" }}>
              Manage Subscriptions, <span className="bg-gradient-to-r from-indigo-600 to-violet-500 bg-clip-text text-transparent">Compliance &amp; Renewals</span> — in One Dashboard
            </h1>

            <p className="mb-8 text-slate-600 leading-relaxed" style={{ fontSize: 17, maxWidth: 520 }}>
              Track spend, never miss renewals, and assign ownership with ease. Built for finance, operations, and founders who move fast.
            </p>

            <div className="flex flex-wrap gap-3">
              <button
                type="button"
                onClick={() => navigate("/signup")}
                className="inline-flex items-center gap-2 px-6 py-3 rounded-xl font-semibold text-white bg-gradient-to-r from-indigo-600 to-violet-500 shadow-lg transition-all duration-200 hover:-translate-y-0.5"
              >
                Get Started Free <ChevronRight size={16} />
              </button>
              <button
                type="button"
                onClick={() => scrollTo("contact")}
                className="inline-flex items-center gap-2 px-6 py-3 rounded-xl font-semibold text-indigo-600 bg-white border border-indigo-100 shadow-sm transition-all duration-200 hover:-translate-y-0.5"
              >
                Book Demo
              </button>
            </div>

            <div className="flex items-center gap-6 mt-8">
              {[
                { v: "500+", l: "Teams" },
                { v: "$12M+", l: "Spend tracked" },
                { v: "99.9%", l: "Uptime" },
              ].map((s) => (
                <div key={s.l}>
                  <p className="text-lg font-extrabold text-indigo-600">{s.v}</p>
                  <p className="text-[11px] text-slate-400 font-medium">{s.l}</p>
                </div>
              ))}
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.65, delay: 0.05 }}
            className="relative w-full order-last lg:order-none mt-10 lg:mt-0"
          >
            <div className="max-w-xl mx-auto lg:max-w-none scale-[0.98] sm:scale-100 origin-top">
              <DashboardMockup />
            </div>
          </motion.div>
        </div>
      </Section>

      {/* PRODUCT OVERVIEW */}
      <Section id="overview" className="py-20 px-4 sm:px-6 lg:px-8 bg-slate-50">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-14">
            <p className="text-xs font-semibold tracking-widest text-indigo-600 mb-3">PRODUCT OVERVIEW</p>
            <h2 className="text-3xl md:text-4xl font-extrabold text-slate-900 mb-4 tracking-tight">Three Modules. One System of Record.</h2>
            <p className="text-slate-600 max-w-2xl mx-auto leading-relaxed">
              Trackla brings subscriptions, compliance, and renewals into one unified workflow — so nothing slips through the cracks.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 items-stretch">
            {/* Subscriptions */}
            <div className="h-full rounded-2xl overflow-hidden bg-white border border-indigo-100 shadow-sm hover:shadow-md transition-all duration-200 hover:-translate-y-1 flex flex-col">
              <div className="border-b border-indigo-100 bg-slate-50 flex-1 flex flex-col">
                <div className="flex items-center gap-2 px-4 py-3 bg-gradient-to-r from-indigo-600 to-violet-500">
                  <Layers size={15} className="text-white/90" />
                  <span className="text-sm font-bold text-white">Subscriptions</span>
                </div>
                <div className="px-4 pt-4 pb-3 flex-1 flex flex-col">
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <p className="text-[10px] text-slate-400 font-medium mb-1">Monthly Spend</p>
                      <p className="text-xl font-extrabold text-slate-900 leading-none">$447,239</p>
                    </div>
                    <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-600 inline-flex items-center gap-1">
                      <TrendingUp size={10} /> +12%
                    </span>
                  </div>
                  <div className="flex-1 space-y-2">
                    {[
                      { i: "M", n: "Microsoft 365", c: "$1,200/mo", bg: "bg-blue-600" },
                      { i: "A", n: "AWS", c: "$8,400/mo", bg: "bg-orange-500" },
                      { i: "S", n: "Slack", c: "$480/mo", bg: "bg-violet-500" },
                    ].map((v) => (
                      <div key={v.n} className="flex items-center gap-2.5 rounded-lg px-2.5 py-1.5 bg-white border border-indigo-50">
                        <div className={`w-6 h-6 rounded-full flex items-center justify-center ${v.bg}`}>
                          <span className="text-[10px] font-extrabold text-white">{v.i}</span>
                        </div>
                        <span className="text-[11px] font-semibold text-slate-900 flex-1">{v.n}</span>
                        <span className="text-[11px] text-slate-500 font-medium">{v.c}</span>
                      </div>
                    ))}
                  </div>
                  <div className="pt-3 text-right mt-auto">
                    <span className="text-[11px] text-indigo-600 font-semibold">View all 14 →</span>
                  </div>
                </div>
              </div>
              <div className="p-5 min-h-[200px]">
                <span className="inline-block px-2.5 py-0.5 rounded-full text-xs font-semibold mb-3 bg-indigo-50 text-indigo-600">Subscriptions</span>
                <h3 className="text-[17px] font-bold text-slate-900 mb-2">Control Every Subscription</h3>
                <p className="text-sm text-slate-600 leading-relaxed">
                  Capture and manage all your subscriptions in one place. Track spend, assign owners, and understand exactly where your money goes.
                </p>
              </div>
            </div>

            {/* Compliance */}
            <div className="h-full rounded-2xl overflow-hidden bg-white border border-blue-100 shadow-sm hover:shadow-md transition-all duration-200 hover:-translate-y-1 flex flex-col">
              <div className="border-b border-blue-100 bg-slate-50 flex-1 flex flex-col">
                <div className="flex items-center gap-2 px-4 py-3 bg-gradient-to-r from-blue-600 to-indigo-600">
                  <ShieldCheck size={15} className="text-white/90" />
                  <span className="text-sm font-bold text-white">Compliance</span>
                </div>
                <div className="px-4 pt-4 pb-3 flex-1 flex flex-col">
                  <div className="flex items-center justify-center mb-4">
                    <div className="relative" style={{ width: 96, height: 96 }}>
                      <svg width="96" height="96" viewBox="0 0 100 100" role="img" aria-label="Compliance score">
                        <circle
                          cx="50"
                          cy="50"
                          r="40"
                          fill="none"
                          stroke="currentColor"
                          className="text-blue-100"
                          strokeWidth="10"
                        />
                        <circle
                          cx="50"
                          cy="50"
                          r="40"
                          fill="none"
                          stroke="currentColor"
                          className="text-blue-600"
                          strokeWidth="10"
                          strokeLinecap="round"
                          strokeDasharray="230 251"
                          strokeDashoffset="62.75"
                          transform="rotate(-90 50 50)"
                        />
                      </svg>
                      <div className="absolute inset-0 flex flex-col items-center justify-center">
                        <span className="text-xl font-extrabold text-slate-900 leading-none">92%</span>
                        <span className="text-[9px] text-slate-400 font-medium mt-1">Overall Score</span>
                      </div>
                    </div>
                  </div>
                  <div className="rounded-lg px-3 py-2 mb-3 bg-white border border-blue-50">
                    {[
                      { dot: "bg-emerald-600", l: "Completed", c: "11 items" },
                      { dot: "bg-amber-500", l: "Due Soon", c: "2 items" },
                      { dot: "bg-red-500", l: "Overdue", c: "1 item" },
                    ].map((s) => (
                      <div key={s.l} className="flex items-center justify-between py-0.5">
                        <div className="flex items-center gap-2">
                          <div className={`w-2 h-2 rounded-full ${s.dot}`} />
                          <span className="text-[11px] text-slate-600 font-medium">{s.l}</span>
                        </div>
                        <span className="text-[11px] text-slate-900 font-bold">{s.c}</span>
                      </div>
                    ))}
                  </div>
                  <div className="mt-auto">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-[10px] text-slate-400">Progress</span>
                      <span className="text-[10px] font-bold text-blue-600">92%</span>
                    </div>
                    <div className="w-full h-1.5 rounded-full bg-blue-100">
                      <div className="h-1.5 rounded-full bg-gradient-to-r from-blue-600 to-indigo-600" style={{ width: "92%" }} />
                    </div>
                  </div>
                </div>
              </div>
              <div className="p-5 min-h-[200px]">
                <span className="inline-block px-2.5 py-0.5 rounded-full text-xs font-semibold mb-3 bg-blue-50 text-blue-600">Compliance</span>
                <h3 className="text-[17px] font-bold text-slate-900 mb-2">Stay Ahead of Deadlines</h3>
                <p className="text-sm text-slate-600 leading-relaxed">
                  Stay on top of compliance requirements with clear tracking, evidence storage, and deadline visibility — all in one dashboard.
                </p>
              </div>
            </div>

            {/* Renewals */}
            <div className="h-full rounded-2xl overflow-hidden bg-white border border-orange-200 shadow-sm hover:shadow-md transition-all duration-200 hover:-translate-y-1 flex flex-col">
              <div className="border-b border-orange-200 bg-slate-50 flex-1 flex flex-col">
                <div className="flex items-center gap-2 px-4 py-3 bg-gradient-to-r from-orange-500 to-amber-500">
                  <RefreshCw size={15} className="text-white/90" />
                  <span className="text-sm font-bold text-white">Renewals</span>
                </div>
                <div className="px-4 pt-4 pb-3 flex-1 flex flex-col">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-3">Upcoming Renewals</p>
                  <div className="flex-1 space-y-2">
                    {[
                      { i: "A", bg: "bg-orange-500", n: "Adobe Creative", s: "Expiring", sCls: "bg-orange-50 text-orange-600", d: "7d" },
                      { i: "W", bg: "bg-blue-600", n: "AWS Enterprise", s: "Pending", sCls: "bg-amber-50 text-amber-700", d: "22d" },
                      { i: "M", bg: "bg-emerald-600", n: "Microsoft 365", s: "Scheduled", sCls: "bg-emerald-50 text-emerald-600", d: "34d" },
                    ].map((r) => (
                      <div key={r.n} className="flex items-center gap-2.5 rounded-lg px-2.5 py-2 bg-white border border-indigo-50">
                        <div className={`w-6 h-6 rounded-full flex items-center justify-center ${r.bg}`}>
                          <span className="text-[10px] font-extrabold text-white">{r.i}</span>
                        </div>
                        <span className="text-[11px] font-semibold text-slate-900 flex-1">{r.n}</span>
                        <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold ${r.sCls}`}>{r.s}</span>
                        <span className="px-2 py-0.5 rounded-md text-[9px] font-bold bg-slate-50 text-slate-600 border border-slate-200">{r.d}</span>
                      </div>
                    ))}
                  </div>
                  <div className="pt-3 text-right mt-auto">
                    <span className="text-[11px] text-orange-600 font-semibold">View all renewals →</span>
                  </div>
                </div>
              </div>
              <div className="p-5 min-h-[200px]">
                <span className="inline-block px-2.5 py-0.5 rounded-full text-xs font-semibold mb-3 bg-orange-50 text-orange-600">Renewals</span>
                <h3 className="text-[17px] font-bold text-slate-900 mb-2">Never Miss a Renewal</h3>
                <p className="text-sm text-slate-600 leading-relaxed">
                  Get proactive alerts, track renewal history, and make informed decisions before contracts expire.
                </p>
              </div>
            </div>
          </div>
        </div>
      </Section>

      {/* FEATURES */}
      <Section id="features" className="py-20 px-4 sm:px-6 lg:px-8 bg-slate-50">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-14">
            <p className="text-sm font-semibold text-indigo-600 mb-2">KEY FEATURES</p>
            <h2 className="text-3xl md:text-4xl font-extrabold text-slate-900 tracking-tight">Everything Your Team Needs</h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {[
              { icon: Bell, title: "Renewal Reminders", description: "Auto-alerts before contracts expire, so your team never gets caught off guard." },
              { icon: Calendar, title: "Unified Calendar", description: "All subscription deadlines, compliance dates, and renewals in one view." },
              { icon: BarChart3, title: "Spend Analytics (LCY)", description: "Multi-currency spend tracking with local currency conversion and trends." },
              { icon: Shield, title: "Compliance Workflows", description: "Assign owners, track statuses, and store evidence end-to-end." },
              { icon: Users, title: "Ownership by Team", description: "Assign subscriptions and tasks to teams or individuals for accountability." },
              { icon: FileUp, title: "Import/Export Ready", description: "Bulk import from CSV and export reports in one click." },
            ].map((f, i) => (
              <FeatureCard key={f.title} icon={f.icon} title={f.title} description={f.description} index={i} />
            ))}
          </div>
        </div>
      </Section>

      {/* USE CASES */}
      <Section id="usecases" className="py-20 px-4 sm:px-6 lg:px-8 bg-white">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-14">
            <p className="text-sm font-semibold text-indigo-600 mb-2">USE CASES</p>
            <h2 className="text-3xl md:text-4xl font-extrabold text-slate-900 tracking-tight">
              Built for Teams That Manage <span className="bg-gradient-to-r from-indigo-600 to-violet-500 bg-clip-text text-transparent">Recurring Operations</span>
            </h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[
              {
                icon: DollarSign,
                title: "Finance Teams",
                description:
                  "Track spend across subscriptions, eliminate waste, and optimize your software costs.",
                color: "bg-indigo-600",
                bg: "bg-indigo-50",
              },
              {
                icon: Settings,
                title: "Operations",
                description:
                  "Manage compliance deadlines, assign ownership, and stay ahead of renewals before they become urgent.",
                color: "bg-blue-600",
                bg: "bg-blue-50",
              },
              {
                icon: TrendingUp,
                title: "Founders",
                description:
                  "Stay in control of your stack — know what you pay, when it renews, and who owns it.",
                color: "bg-emerald-600",
                bg: "bg-emerald-50",
              },
            ].map((c) => (
              <div key={c.title} className={`rounded-2xl p-6 border border-white shadow-sm hover:shadow-md transition-all duration-200 hover:-translate-y-1 ${c.bg}`}>
                <div className={`w-12 h-12 rounded-xl flex items-center justify-center mb-4 ${c.color} text-white`}>
                  <c.icon size={22} />
                </div>
                <h3 className="text-[17px] font-bold text-slate-900 mb-2">{c.title}</h3>
                <p className="text-sm text-slate-700 leading-relaxed">{c.description}</p>
              </div>
            ))}
          </div>
        </div>
      </Section>

      {/* PRICING */}
      <Section id="pricing" className="py-20 px-4 sm:px-6 lg:px-8 bg-slate-50">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-14">
            <p className="text-sm font-semibold text-indigo-600 mb-2">PRICING</p>
            <h2 className="text-3xl md:text-4xl font-extrabold text-slate-900 tracking-tight">Simple, Transparent Pricing</h2>
            <p className="mt-3 text-slate-600">Start for free. Scale when you're ready.</p>
            {pricingError && <div className="mt-5 text-sm text-red-600 bg-red-50 border border-red-100 rounded-xl px-4 py-3 inline-block">{pricingError}</div>}
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-stretch">
            <PricingCard
              name="Starter"
              price="$29"
              period="/mo"
              description="Perfect for small teams getting started."
              bullets={["Up to 25 subscriptions", "Basic renewal reminders", "Email alerts", "1 user seat"]}
              cta={pricingLoading === "starter" ? "Loading…" : "Start Free Trial"}
              selected={selectedPlan === "starter"}
              disabled={pricingLoading !== null}
              onSelect={() => setSelectedPlan("starter")}
              onCtaClick={() => void handlePricingClick("starter")}
            />
            <PricingCard
              name="Professional"
              price="$79"
              period="/mo"
              description="For teams that need full control and analytics."
              bullets={["Unlimited subscriptions", "Compliance workflows", "Team ownership", "Advanced analytics", "5 user seats", "Priority support"]}
              cta={pricingLoading === "professional" ? "Loading…" : "Get Started Free"}
              popular
              selected={selectedPlan === "professional"}
              disabled={pricingLoading !== null}
              onSelect={() => setSelectedPlan("professional")}
              onCtaClick={() => void handlePricingClick("professional")}
            />
            <PricingCard
              name="Enterprise"
              price="Custom"
              description="Tailored for large teams with complex needs."
              bullets={["Unlimited everything", "Custom integrations", "Dedicated CSM", "SSO / SAML", "SLA guarantee", "Audit logs"]}
              cta="Coming Soon"
              selected={selectedPlan === "enterprise"}
              disabled
              onSelect={() => setSelectedPlan("enterprise")}
            />
          </div>
        </div>
      </Section>

      {/* HELP */}
      <Section id="help" className="py-20 px-4 sm:px-6 lg:px-8 bg-white">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-14">
            <p className="text-sm font-semibold text-indigo-600 mb-2">SUPPORT</p>
            <h2 className="text-3xl md:text-4xl font-extrabold text-slate-900 tracking-tight">Need Help?</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[
              {
                icon: HelpCircle,
                title: "Getting Started Guide",
                description: "Step-by-step docs to set up Trackla and import your first subscriptions in minutes.",
                cta: "Read Docs",
                color: "bg-indigo-600",
                text: "text-indigo-600",
                bg: "bg-indigo-50",
              },
              {
                icon: Calendar,
                title: "Book a Demo",
                description: "See Trackla live with a product expert. We'll tailor the demo to your workflows.",
                cta: "Schedule Call",
                color: "bg-blue-600",
                text: "text-blue-600",
                bg: "bg-blue-50",
              },
              {
                icon: MessageSquare,
                title: "Live Chat / Support",
                description: "Our support team is available weekdays, 9–5. Average response time is under 2 hours.",
                cta: "Start Chat",
                color: "bg-emerald-600",
                text: "text-emerald-600",
                bg: "bg-emerald-50",
              },
            ].map((h) => (
              <div key={h.title} className={`rounded-2xl p-6 border border-indigo-50 shadow-sm hover:shadow-md transition-all duration-200 hover:-translate-y-1 ${h.bg}`}>
                <div className={`w-11 h-11 rounded-xl flex items-center justify-center mb-4 ${h.color} text-white`}>
                  <h.icon size={20} />
                </div>
                <h3 className="text-[15px] font-bold text-slate-900 mb-2">{h.title}</h3>
                <p className="text-[13px] text-slate-700 leading-relaxed mb-4">{h.description}</p>
                <button
                  type="button"
                  className={`text-sm font-semibold inline-flex items-center gap-1 hover:opacity-75 transition-opacity ${h.text}`}
                  onClick={() => {
                    if (h.cta === "Start Chat") {
                      window.location.href = "mailto:support@trackla.io";
                    } else {
                      scrollTo("contact");
                    }
                  }}
                >
                  {h.cta} <ChevronRight size={14} />
                </button>
              </div>
            ))}
          </div>
        </div>
      </Section>

      {/* CONTACT */}
      <Section id="contact" className="py-20 px-4 sm:px-6 lg:px-8 bg-slate-50">
        <div className="max-w-5xl mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-12 items-start">
            <div>
              <p className="text-sm font-semibold text-indigo-600 mb-2">CONTACT US</p>
              <h2 className="text-3xl md:text-4xl font-extrabold text-slate-900 tracking-tight mb-4">Talk to Us</h2>
              <p className="text-slate-700 leading-relaxed mb-8">
                Have questions about pricing, features, or implementation? Our team responds within 2 business hours.
              </p>
              <div className="space-y-4">
                {[
                  { icon: Mail, label: "Email", value: "hello@trackla.io" },
                  { icon: MessageSquare, label: "Live Chat", value: "Available Mon–Fri, 9–5" },
                  { icon: Calendar, label: "Demo", value: "Book a 30-minute walkthrough" },
                ].map((c) => (
                  <div key={c.label} className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl flex items-center justify-center bg-gradient-to-r from-indigo-600 to-violet-500 text-white">
                      <c.icon size={15} />
                    </div>
                    <div>
                      <p className="text-[11px] text-slate-400 font-medium">{c.label}</p>
                      <p className="text-[13px] font-semibold text-slate-900">{c.value}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-2xl p-6 bg-white border border-indigo-100 shadow-lg">
              {contactSent ? (
                <div className="text-center py-10">
                  <div className="w-14 h-14 rounded-full bg-emerald-50 flex items-center justify-center mx-auto mb-4">
                    <Check size={28} className="text-emerald-600" />
                  </div>
                  <h3 className="text-lg font-bold text-slate-900 mb-2">Message Sent!</h3>
                  <p className="text-sm text-slate-600">We'll get back to you within 2 business hours.</p>
                </div>
              ) : (
                <form onSubmit={handleContactSubmit} className="space-y-4">
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-1.5" htmlFor="contact-name">
                      Name
                    </label>
                    <input
                      id="contact-name"
                      type="text"
                      required
                      value={contactForm.name}
                      onChange={(e) => setContactForm((p) => ({ ...p, name: e.target.value }))}
                      placeholder="Your full name"
                      className="w-full rounded-xl px-4 py-2.5 text-sm outline-none border border-indigo-100 bg-slate-50 focus:bg-white focus:ring-2 focus:ring-indigo-500/20"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-1.5" htmlFor="contact-email">
                      Email
                    </label>
                    <input
                      id="contact-email"
                      type="email"
                      required
                      value={contactForm.email}
                      onChange={(e) => setContactForm((p) => ({ ...p, email: e.target.value }))}
                      placeholder="you@company.com"
                      className="w-full rounded-xl px-4 py-2.5 text-sm outline-none border border-indigo-100 bg-slate-50 focus:bg-white focus:ring-2 focus:ring-indigo-500/20"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-1.5" htmlFor="contact-message">
                      Message
                    </label>
                    <textarea
                      id="contact-message"
                      required
                      rows={4}
                      value={contactForm.message}
                      onChange={(e) => setContactForm((p) => ({ ...p, message: e.target.value }))}
                      placeholder="Tell us about your use case..."
                      className="w-full rounded-xl px-4 py-2.5 text-sm outline-none border border-indigo-100 bg-slate-50 focus:bg-white focus:ring-2 focus:ring-indigo-500/20 resize-none"
                    />
                  </div>
                  <button
                    type="submit"
                    className="w-full py-3 rounded-xl font-semibold text-sm text-white bg-gradient-to-r from-indigo-600 to-violet-500 shadow-lg transition-all duration-200 hover:-translate-y-0.5"
                  >
                    Send Message
                  </button>
                </form>
              )}
            </div>
          </div>
        </div>
      </Section>

      {/* FINAL CTA */}
      <Section id="finalcta" className="py-24 px-4 sm:px-6 lg:px-8 text-center bg-gradient-to-r from-indigo-600 to-violet-500">
        <div className="max-w-3xl mx-auto">
          <h2 className="text-white font-extrabold mb-4" style={{ fontSize: "clamp(1.8rem,4vw,2.8rem)", letterSpacing: "-0.04em" }}>
            Stop Missing Renewals.
            <br />
            Start Tracking Everything Today.
          </h2>
          <p className="mb-8 text-white/80" style={{ fontSize: 17 }}>
            Join 500+ teams already using Trackla to stay on top of subscriptions.
          </p>
          <button
            type="button"
            onClick={() => navigate("/signup")}
            className="inline-flex items-center gap-2 px-8 py-4 rounded-xl font-semibold text-base bg-white text-indigo-600 shadow-2xl transition-all duration-200 hover:-translate-y-1"
          >
            Get Started Free <ChevronRight size={18} />
          </button>
        </div>
      </Section>

      {/* FOOTER */}
      <footer className="py-10 px-4 sm:px-6 lg:px-8 border-t border-indigo-100 bg-white">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <img src="/assets/logo.png" alt="Trackla" className="w-8 h-8 object-contain" />
            <span className="font-bold text-indigo-600">Trackla</span>
          </div>
          <div className="flex items-center gap-6">
            {[
              { id: "features", label: "Features" },
              { id: "pricing", label: "Pricing" },
              { id: "help", label: "Help" },
              { id: "contact", label: "Contact" },
            ].map((l) => (
              <button
                key={l.id}
                type="button"
                onClick={() => scrollTo(l.id)}
                className="text-sm text-slate-500 hover:text-slate-900 transition-colors"
              >
                {l.label}
              </button>
            ))}
          </div>
          <p className="text-xs text-slate-400">© {new Date().getFullYear()} Trackla. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}
