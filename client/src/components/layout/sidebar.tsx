import { Link, useLocation, useNavigate } from "react-router-dom";
import { BarChart3, Layers, Settings, FileBarChart, BellRing, Building2, ShieldCheck, Award, LogOut, Shuffle, Check, PanelLeft, ChevronDown } from "lucide-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "../../lib/api";
import { UnifiedImportExport } from "../unified-import-export";
import { useEffect, useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { Can } from "@/components/Can";
import { useSidebarSlot } from "@/context/SidebarSlotContext";
import { findPlatformSection, platformNavSections } from "@/lib/platform-nav";
import AddCompanyModal from "../modals/add-company-modal";
import { motion, AnimatePresence } from "framer-motion";

type Company = { tenantId: string; companyName: string; isActive: boolean };

function CompanySwitcherDialog({ onClose }: { onClose: () => void }) {
  const [searchQuery, setSearchQuery] = useState("");
  const [addCompanyOpen, setAddCompanyOpen] = useState(false);
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: companies = [], isLoading } = useQuery<Company[]>({
    queryKey: ["/api/user/companies"],
    queryFn: async () => { const r = await apiFetch("/api/user/companies"); if (!r.ok) throw new Error(); return r.json(); },
    staleTime: 0, refetchOnMount: "always", refetchOnWindowFocus: true,
  });

  const filtered = companies.filter(c => c.companyName.toLowerCase().includes(searchQuery.toLowerCase()));
  const getInitials = (n: string) => { const w = n.trim().split(/\s+/); return w.length >= 2 ? (w[0][0]+w[1][0]).toUpperCase() : n.substring(0,2).toUpperCase(); };
  const getColor = (n: string) => ["bg-yellow-500","bg-purple-400","bg-amber-600","bg-teal-500","bg-pink-400","bg-indigo-500","bg-red-500","bg-green-500","bg-blue-500","bg-orange-500"][n.charCodeAt(0)%10];

  const handleSwitch = async (tenantId: string) => {
    try {
      const res = await apiFetch("/api/user/switch-company", { method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify({tenantId}) });
      if (!res.ok) throw new Error();
      const data = await res.json().catch(()=>({} as any));
      if (typeof data?.token==="string"&&data.token.length>0) {
        sessionStorage.setItem("token", data.token.trim().replace(/^Bearer\s+/i,""));
        sessionStorage.setItem("isAuthenticated","true");
      }
      window.dispatchEvent(new Event("account-changed")); queryClient.clear(); window.location.reload();
    } catch { toast({title:"Error",description:"Failed to switch company.",variant:"destructive"}); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm" onClick={onClose}>
      <AddCompanyModal open={addCompanyOpen} onOpenChange={setAddCompanyOpen} onSuccess={()=>queryClient.invalidateQueries({queryKey:["/api/user/companies"]})} />
      <motion.div initial={{opacity:0,scale:0.96,y:6}} animate={{opacity:1,scale:1,y:0}} exit={{opacity:0,scale:0.96}} transition={{duration:0.16}}
        className="bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4 border border-gray-100" onClick={e=>e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div className="flex items-center gap-2"><Shuffle size={16} className="text-indigo-500"/><span className="text-base font-semibold text-gray-900 tracking-tight">Switch Company</span></div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 p-1 rounded-lg transition-colors">
            <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/></svg>
          </button>
        </div>
        <div className="p-4 space-y-3">
          <input type="text" placeholder="Search company..." value={searchQuery} onChange={e=>setSearchQuery(e.target.value)}
            className="w-full px-3 py-2 rounded-lg border border-gray-200 focus:outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 text-sm transition-all"/>
          <div className="text-xs font-semibold text-gray-400 uppercase tracking-wider px-1">Your Companies</div>
          <div className="max-h-60 overflow-y-auto space-y-0.5">
            {isLoading ? <div className="text-center py-6 text-gray-400 text-sm">Loading...</div>
             : filtered.length===0 ? <div className="text-center py-6 text-gray-400 text-sm">No company found.</div>
             : filtered.map(company=>(
              <button key={company.tenantId} onClick={async()=>{if(!company.isActive)await handleSwitch(company.tenantId);onClose();}}
                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-indigo-50 transition-colors text-left group">
                <div className={`h-8 w-8 ${getColor(company.companyName)} rounded-lg flex items-center justify-center flex-shrink-0`}>
                  <span className="text-xs font-bold text-white">{getInitials(company.companyName)}</span>
                </div>
                <span className="flex-1 truncate text-sm font-medium text-gray-700 group-hover:text-indigo-700 transition-colors">{company.companyName}</span>
                {company.isActive && <Check className="h-4 w-4 text-indigo-500 flex-shrink-0"/>}
              </button>
            ))}
          </div>
          <div className="pt-2 border-t border-gray-100">
            <button onClick={()=>setAddCompanyOpen(true)}
              className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-gradient-to-r from-indigo-500 to-blue-500 hover:from-indigo-600 hover:to-blue-600 text-white text-sm font-semibold rounded-xl transition-all shadow-sm hover:shadow-md">
              <Building2 className="h-4 w-4"/><span>Add Company</span>
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
}

const navItems = [
  { path: "/dashboard", label: "Dashboard", icon: BarChart3 },
  { path: "/subscriptions", label: "Subscriptions", icon: Layers },
  { path: "/compliance", label: "Compliance", icon: Award },
  { path: "/government-license", label: "Renewals", icon: ShieldCheck },
  { path: "/notifications", label: "Notifications", icon: BellRing },
  { path: "/configuration", label: "Setup & Configuration", icon: Settings },
  { path: "/company-details", label: "Company Details", icon: Building2 },
  { path: "/reports", label: "Reports", icon: FileBarChart },
];
const configSubItems = [
  { path: "/configuration/currency", label: "Currency" },
  { path: "/configuration/payment", label: "Payment Methods" },
  { path: "/configuration/custom-field", label: "Custom Field" },
];
const companySubItems = [
  { path: "/company-details/company", label: "Company Information" },
  { path: "/company-details/department", label: "Department" },
  { path: "/company-details/employee", label: "Employees" },
  { path: "/company-details/subscription", label: "Subscription Category" },
  { path: "/company-details/users", label: "User Management", requiresUserRead: true },
] as const;

export default function Sidebar({ isOpen = true, onToggle }: { isOpen?: boolean; onToggle?: () => void }) {
  const location = useLocation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [showSwitcher, setShowSwitcher] = useState(false);
  const [configOpen, setConfigOpen] = useState(() => location.pathname.startsWith("/configuration"));
  const [companyOpen, setCompanyOpen] = useState(() => location.pathname.startsWith("/company-details"));
  const [platformOpen, setPlatformOpen] = useState<Record<string,boolean>>(() =>
    Object.fromEntries(platformNavSections.map(s=>[s.id, location.pathname===s.path||location.pathname.startsWith(`${s.path}/`)]))
  );
  const { active: pageSlotActive, replaceNav: pageSlotReplaceNav } = useSidebarSlot();

  useEffect(() => {
    if (location.pathname.startsWith("/configuration")) setConfigOpen(true);
    if (location.pathname.startsWith("/company-details")) setCompanyOpen(true);
    const active = findPlatformSection(location.pathname);
    if (active) setPlatformOpen(c => c[active.id] ? c : {...c,[active.id]:true});
  }, [location.pathname]);

  const { data: currentUser } = useQuery({
    queryKey: ["/api/me"],
    queryFn: async () => { const r = await apiFetch("/api/me"); if (!r.ok) throw new Error(); return r.json(); },
    retry: false, staleTime: 0, refetchOnWindowFocus: true,
  });

  const isGlobalAdmin = currentUser?.role === "global_admin";

  const sidebarBackground = isGlobalAdmin
    ? "linear-gradient(180deg, #f5f3ff 0%, #ede9fe 45%, #ffffff 100%)"
    : "linear-gradient(180deg, #ede9fe 0%, #e0d8fd 50%, #ddd5fc 100%)";

  const handleLogout = async () => {
    try { await fetch("/api/logout",{method:"POST",credentials:"include"}); } catch {}
    sessionStorage.clear(); localStorage.removeItem("token");
    queryClient.clear(); window.dispatchEvent(new Event("logout"));
    navigate("/landing",{replace:true});
  };

  const itemBase = "flex items-center gap-3 px-3 py-2.5 rounded-xl text-[14px] font-semibold tracking-tight transition-all duration-200 w-full";
  const itemActive = "bg-indigo-600 text-white shadow-md";
  const itemHover = "text-indigo-800 hover:bg-white/60 hover:text-indigo-900 hover:shadow-sm";
  const subBase = "flex items-center gap-2.5 px-3 py-[7px] rounded-lg text-[13px] font-medium transition-all duration-150 w-full";
  const subActive = "bg-white/70 text-indigo-800 font-semibold shadow-sm";
  const subHover = "text-indigo-700 hover:bg-white/50 hover:text-indigo-900";

  // ── COLLAPSED ──
  if (!isOpen) {
    return (
      <div className="flex flex-col h-full w-16 border-r border-indigo-200/50" style={{background:sidebarBackground}}>
        <div className="flex flex-col items-center gap-1 px-2 pt-3 pb-2 border-b border-indigo-200/50">
          <button onClick={onToggle} className="group h-11 w-11 flex items-center justify-center rounded-xl bg-white/60 hover:bg-white/80 border border-indigo-200/60 shadow-sm transition-all duration-200 hover:scale-105 relative" aria-label="Open Sidebar">
            <img src="/assets/logo.png" alt="Logo" className="w-9 h-9 object-contain absolute opacity-100 group-hover:opacity-0 transition-opacity duration-150" style={{imageRendering:"crisp-edges"}}/>
            <PanelLeft size={20} className="text-indigo-600 opacity-0 group-hover:opacity-100 transition-opacity duration-150"/>
          </button>
        </div>
        <nav className="flex-1 px-2 py-3 overflow-y-auto">
          <ul className="space-y-1">
            {(isGlobalAdmin?platformNavSections:navItems).map(item=>{
              const Icon=item.icon;
              const isActive=location.pathname===item.path||(item.path==="/configuration"&&location.pathname.startsWith("/configuration/"))||(item.path==="/company-details"&&location.pathname.startsWith("/company-details/"))||(isGlobalAdmin&&findPlatformSection(location.pathname)?.path===item.path);
              return (
                <li key={item.path}>
                  <Link to={item.path} title={item.label} className={`flex items-center justify-center w-12 h-12 rounded-xl transition-all duration-200 ${isActive?"bg-indigo-600 shadow-md":"hover:bg-white/50"}`}>
                    <Icon size={18} className={isActive?"text-white":"text-indigo-700"}/>
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>
        <div className="p-2 border-t border-indigo-200/50">
          <button onClick={handleLogout} className="flex items-center justify-center w-9 h-9 mx-auto rounded-lg text-indigo-400 hover:text-red-500 hover:bg-red-50 transition-all duration-200" title="Logout">
            <LogOut size={16}/>
          </button>
        </div>
      </div>
    );
  }

  // ── EXPANDED ──
  return (
    <div className="flex flex-col h-full border-r border-indigo-200/50" style={{background:sidebarBackground}}>

      {/* Header */}
      <div className="flex flex-col gap-2 px-4 pt-3 pb-3 border-b border-indigo-200/50">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-0">
            <img src="/assets/logo.png" alt="Trackla" className="w-20 h-20 object-contain drop-shadow-xl" style={{imageRendering:"crisp-edges"}}/>
            <h1 className="text-2xl font-bold tracking-tight text-indigo-900">Trackla</h1>
          </div>
          {onToggle&&(
            <button onClick={onToggle} className="h-8 w-8 flex items-center justify-center rounded-lg bg-white/50 hover:bg-white/70 text-indigo-600 border border-indigo-200/60 transition-all duration-200" title="Collapse">
              <PanelLeft className="h-5 w-5"/>
            </button>
          )}
        </div>
        {currentUser&&!isGlobalAdmin&&(
          <button onClick={()=>setShowSwitcher(true)}
            className="flex items-center gap-2 pl-3 pr-2 py-1.5 rounded-lg bg-indigo-500/10 hover:bg-indigo-500/20 transition-all duration-200 w-full border border-indigo-200/40 group">
            <Shuffle size={14} className="text-indigo-500 flex-shrink-0"/>
            <span className="text-sm font-semibold text-indigo-700 leading-tight truncate flex-1 text-left">{currentUser.companyName||"Select company..."}</span>
            <ChevronDown size={13} className="text-indigo-400 flex-shrink-0"/>
          </button>
        )}
      </div>

      {showSwitcher&&!isGlobalAdmin&&<CompanySwitcherDialog onClose={()=>setShowSwitcher(false)}/>}

      {/* Navigation */}
      <nav className="flex-1 px-3 py-3 overflow-y-auto overscroll-contain custom-scrollbar">
        {pageSlotActive&&pageSlotReplaceNav ? null : (
          <>
            {isGlobalAdmin ? (
              <ul className="space-y-0.5">
                {platformNavSections.map((section,idx)=>{
                  const Icon=section.icon;
                  const isActive=location.pathname===section.path||location.pathname.startsWith(`${section.path}/`);
                  const isExpanded=platformOpen[section.id]??isActive;
                  return (
                    <motion.li key={section.id} initial={{opacity:0,y:6}} animate={{opacity:1,y:0}} transition={{delay:idx*0.04,duration:0.18}}>
                      <div className="flex items-center rounded-xl overflow-hidden">
                        <Link to={section.path} className={`${itemBase} flex-1 ${isActive ? itemActive : itemHover}`}
                          onClick={e => { e.preventDefault(); navigate(section.path); setPlatformOpen(c=>({...c,[section.id]:!c[section.id]})); }}>
                          <Icon size={17} className="flex-shrink-0"/>
                          <span className="truncate flex-1">{section.label}</span>
                          <motion.div animate={{rotate:isExpanded?180:0}} transition={{duration:0.2}} className="flex-shrink-0 ml-1">
                            <ChevronDown size={15} className={isActive?"text-white":"text-indigo-500"}/>
                          </motion.div>
                        </Link>
                      </div>
                      <AnimatePresence initial={false}>
                        {isExpanded&&(
                          <motion.div initial={{height:0,opacity:0}} animate={{height:"auto",opacity:1}} exit={{height:0,opacity:0}} transition={{duration:0.2}}
                            className="overflow-hidden mt-0.5 ml-7 pl-3 border-l-2 border-indigo-300/50 space-y-0.5 py-0.5">
                            {section.items.map(sub=>{
                              const subIsActive=location.pathname===sub.path;
                              return (
                                <Link key={sub.path} to={sub.path} className={`${subBase} ${subIsActive ? subActive : subHover}`}>
                                  <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 transition-colors ${subIsActive?"bg-indigo-600":"bg-indigo-400/50"}`}/>
                                  <span className="truncate">{sub.label}</span>
                                  {(sub as any).readOnly&&<span className="text-[10px] uppercase tracking-wider text-indigo-400 ml-auto">View</span>}
                                </Link>
                              );
                            })}
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </motion.li>
                  );
                })}
              </ul>
            ) : (
              <ul className="space-y-0.5">
                {navItems.map((item,idx)=>{
                  const Icon=item.icon;
                  const isConfigRoute=item.path==="/configuration";
                  const isCompanyRoute=item.path==="/company-details";
                  const isActive=location.pathname===item.path||(isConfigRoute&&location.pathname.startsWith("/configuration/"))||(isCompanyRoute&&location.pathname.startsWith("/company-details/"));
                  const hasSubMenu=isConfigRoute||isCompanyRoute;
                  const subOpen=isConfigRoute?configOpen:companyOpen;
                  const subItems=isConfigRoute?configSubItems:companySubItems;

                  const rowEl=(
                    <motion.li key={item.path} initial={{opacity:0,y:6}} animate={{opacity:1,y:0}} transition={{delay:idx*0.04,duration:0.18}}>
                      {hasSubMenu ? (
                        <>
                          <div className="flex items-center">
                            <Link to={item.path} className={`${itemBase} flex-1 ${isActive ? itemActive : itemHover}`}
                              onClick={e => {
                                e.preventDefault();

                                if (isConfigRoute) {
                                  if (!location.pathname.startsWith("/configuration")) {
                                    navigate("/configuration/currency");
                                  }
                                  setConfigOpen(v => !v);
                                  return;
                                }

                                if (isCompanyRoute) {
                                  if (!location.pathname.startsWith("/company-details")) {
                                    navigate("/company-details/company");
                                  }
                                  setCompanyOpen(v => !v);
                                }
                              }}>
                              <Icon size={17} className="flex-shrink-0"/>
                              <span className="truncate flex-1">{item.label}</span>
                              <motion.div animate={{rotate:subOpen?180:0}} transition={{duration:0.2}} className="flex-shrink-0 ml-1">
                                <ChevronDown size={15} className={isActive?"text-white":"text-indigo-500"}/>
                              </motion.div>
                            </Link>
                          </div>
                          <AnimatePresence initial={false}>
                            {subOpen&&(
                              <motion.div initial={{height:0,opacity:0}} animate={{height:"auto",opacity:1}} exit={{height:0,opacity:0}} transition={{duration:0.2}}
                                className="overflow-hidden mt-0.5 ml-5 space-y-0.5 py-0.5">
                                {subItems.map(sub=>{
                                  const subIsActive=location.pathname===sub.path;
                                  const linkEl=(
                                    <Link key={sub.path} to={sub.path} className={`${subBase} ${subIsActive ? subActive : subHover}`}>
                                      <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 transition-colors ${subIsActive?"bg-indigo-600":"bg-indigo-400/50"}`}/>
                                      <span className="truncate">{sub.label}</span>
                                    </Link>
                                  );
                                  if("requiresUserRead" in sub&&sub.requiresUserRead) return <Can I="read" a="User" key={sub.path} fallback={null}>{linkEl}</Can>;
                                  return linkEl;
                                })}
                              </motion.div>
                            )}
                          </AnimatePresence>
                        </>
                      ) : (
                        <Link to={item.path} className={`${itemBase} ${isActive ? itemActive : itemHover}`}>
                          <Icon size={17} className="flex-shrink-0"/>
                          <span>{item.label}</span>
                        </Link>
                      )}
                    </motion.li>
                  );


                  if(hasSubMenu) return <Can I="manage" a="Settings" key={item.path} fallback={null}>{rowEl}</Can>;
                  return rowEl;
                })}
              </ul>
            )}

            {!isGlobalAdmin&&(
              <div className="mt-4 pt-4 border-t border-indigo-200/50">
                <UnifiedImportExport/>
              </div>
            )}
          </>
        )}
        <div id="page-sidebar-slot" className={pageSlotActive&&pageSlotReplaceNav?"h-full":"hidden"}/>
      </nav>

      {/* Logout */}
      <div className={`px-3 py-3 border-t ${isGlobalAdmin?"border-indigo-200/60":"border-indigo-200/50"}`}>
        <button onClick={handleLogout}
          className="flex items-center gap-3 w-full px-3 py-2.5 rounded-xl text-[13.5px] font-semibold text-indigo-500 hover:text-red-600 hover:bg-red-50/70 transition-all duration-200 group">
          <LogOut size={16} className="transition-transform duration-200 group-hover:rotate-12 flex-shrink-0"/>
          <span>Logout</span>
        </button>
      </div>
    </div>
  );
}