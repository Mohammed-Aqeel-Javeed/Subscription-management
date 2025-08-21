var __assign = (this && this.__assign) || function () {
    __assign = Object.assign || function(t) {
        for (var s, i = 1, n = arguments.length; i < n; i++) {
            s = arguments[i];
            for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p))
                t[p] = s[p];
        }
        return t;
    };
    return __assign.apply(this, arguments);
};
var __rest = (this && this.__rest) || function (s, e) {
    var t = {};
    for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p) && e.indexOf(p) < 0)
        t[p] = s[p];
    if (s != null && typeof Object.getOwnPropertySymbols === "function")
        for (var i = 0, p = Object.getOwnPropertySymbols(s); i < p.length; i++) {
            if (e.indexOf(p[i]) < 0 && Object.prototype.propertyIsEnumerable.call(s, p[i]))
                t[p[i]] = s[p[i]];
        }
    return t;
};
import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva } from "class-variance-authority";
import { PanelLeft, Home, Settings, Users, BarChart3, FileText, HelpCircle } from "lucide-react";
import { useIsMobile } from "@/hooks/use-mobile";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, } from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger, } from "@/components/ui/tooltip";
var SIDEBAR_COOKIE_NAME = "sidebar_state";
var SIDEBAR_COOKIE_MAX_AGE = 60 * 60 * 24 * 7;
var SIDEBAR_WIDTH = "16rem";
var SIDEBAR_WIDTH_MOBILE = "18rem";
var SIDEBAR_WIDTH_ICON = "3rem";
var SIDEBAR_KEYBOARD_SHORTCUT = "b";
var SidebarContext = React.createContext(null);
function useSidebar() {
    var context = React.useContext(SidebarContext);
    if (!context) {
        throw new Error("useSidebar must be used within a SidebarProvider.");
    }
    return context;
}
var SidebarProvider = React.forwardRef(function (_a, ref) {
    var _b = _a.defaultOpen, defaultOpen = _b === void 0 ? true : _b, openProp = _a.open, setOpenProp = _a.onOpenChange, className = _a.className, style = _a.style, children = _a.children, props = __rest(_a, ["defaultOpen", "open", "onOpenChange", "className", "style", "children"]);
    var isMobile = useIsMobile();
    var _c = React.useState(false), openMobile = _c[0], setOpenMobile = _c[1];
    var _d = React.useState(defaultOpen), _open = _d[0], _setOpen = _d[1];
    var open = openProp !== null && openProp !== void 0 ? openProp : _open;
    var setOpen = React.useCallback(function (value) {
        var openState = typeof value === "function" ? value(open) : value;
        if (setOpenProp) {
            setOpenProp(openState);
        }
        else {
            _setOpen(openState);
        }
        document.cookie = "".concat(SIDEBAR_COOKIE_NAME, "=").concat(openState, "; path=/; max-age=").concat(SIDEBAR_COOKIE_MAX_AGE);
    }, [setOpenProp, open]);
    var toggleSidebar = React.useCallback(function () {
        return isMobile
            ? setOpenMobile(function (open) { return !open; })
            : setOpen(function (open) { return !open; });
    }, [isMobile, setOpen, setOpenMobile]);
    React.useEffect(function () {
        var handleKeyDown = function (event) {
            if (event.key === SIDEBAR_KEYBOARD_SHORTCUT &&
                (event.metaKey || event.ctrlKey)) {
                event.preventDefault();
                toggleSidebar();
            }
        };
        window.addEventListener("keydown", handleKeyDown);
        return function () { return window.removeEventListener("keydown", handleKeyDown); };
    }, [toggleSidebar]);
    var state = open ? "expanded" : "collapsed";
    var contextValue = React.useMemo(function () { return ({
        state: state,
        open: open,
        setOpen: setOpen,
        isMobile: isMobile,
        openMobile: openMobile,
        setOpenMobile: setOpenMobile,
        toggleSidebar: toggleSidebar,
    }); }, [state, open, setOpen, isMobile, openMobile, setOpenMobile, toggleSidebar]);
    return (_jsx(SidebarContext.Provider, { value: contextValue, children: _jsx(TooltipProvider, { delayDuration: 0, children: _jsx("div", __assign({ style: __assign({ "--sidebar-width": SIDEBAR_WIDTH, "--sidebar-width-icon": SIDEBAR_WIDTH_ICON }, style), className: cn("group/sidebar-wrapper flex min-h-svh w-full has-[[data-variant=inset]]:bg-sidebar", className), ref: ref }, props, { children: children })) }) }));
});
SidebarProvider.displayName = "SidebarProvider";
var Sidebar = React.forwardRef(function (_a, ref) {
    var _b = _a.side, side = _b === void 0 ? "left" : _b, _c = _a.variant, variant = _c === void 0 ? "sidebar" : _c, _d = _a.collapsible, collapsible = _d === void 0 ? "offcanvas" : _d, className = _a.className, children = _a.children, props = __rest(_a, ["side", "variant", "collapsible", "className", "children"]);
    var _e = useSidebar(), isMobile = _e.isMobile, state = _e.state, openMobile = _e.openMobile, setOpenMobile = _e.setOpenMobile;
    if (collapsible === "none") {
        return (_jsx("div", __assign({ className: cn("flex h-full w-[--sidebar-width] flex-col bg-gradient-to-b from-slate-900 to-slate-800 text-sidebar-foreground shadow-xl", className), ref: ref }, props, { children: children })));
    }
    if (isMobile) {
        return (_jsx(Sheet, __assign({ open: openMobile, onOpenChange: setOpenMobile }, props, { children: _jsxs(SheetContent, { "data-sidebar": "sidebar", "data-mobile": "true", className: "w-[--sidebar-width] bg-gradient-to-b from-slate-900 to-slate-800 p-0 text-sidebar-foreground [&>button]:hidden shadow-xl", style: {
                    "--sidebar-width": SIDEBAR_WIDTH_MOBILE,
                }, side: side, children: [_jsxs(SheetHeader, { className: "sr-only", children: [_jsx(SheetTitle, { children: "Sidebar" }), _jsx(SheetDescription, { children: "Displays the mobile sidebar." })] }), _jsx("div", { className: "flex h-full w-full flex-col", children: children })] }) })));
    }
    return (_jsxs("div", { ref: ref, className: "group peer hidden text-sidebar-foreground md:block", "data-state": state, "data-collapsible": state === "collapsed" ? collapsible : "", "data-variant": variant, "data-side": side, children: [_jsx("div", { className: cn("relative w-[--sidebar-width] bg-transparent transition-[width] duration-300 ease-in-out", "group-data-[collapsible=offcanvas]:w-0", "group-data-[side=right]:rotate-180", variant === "floating" || variant === "inset"
                    ? "group-data-[collapsible=icon]:w-[calc(var(--sidebar-width-icon)_+_theme(spacing.4))]"
                    : "group-data-[collapsible=icon]:w-[--sidebar-width-icon]") }), _jsx("div", __assign({ className: cn("fixed inset-y-0 z-10 hidden h-svh w-[--sidebar-width] transition-[left,right,width] duration-300 ease-in-out md:flex", side === "left"
                    ? "left-0 group-data-[collapsible=offcanvas]:left-[calc(var(--sidebar-width)*-1)]"
                    : "right-0 group-data-[collapsible=offcanvas]:right-[calc(var(--sidebar-width)*-1)]", 
                // Adjust the padding for floating and inset variants.
                variant === "floating" || variant === "inset"
                    ? "p-2 group-data-[collapsible=icon]:w-[calc(var(--sidebar-width-icon)_+_theme(spacing.4)_+2px)]"
                    : "group-data-[collapsible=icon]:w-[--sidebar-width-icon] group-data-[side=left]:border-r group-data-[side=right]:border-l", className) }, props, { children: _jsx("div", { "data-sidebar": "sidebar", className: "flex h-full w-full flex-col bg-gradient-to-b from-slate-900 to-slate-800 group-data-[variant=floating]:rounded-xl group-data-[variant=floating]:border group-data-[variant=floating]:border-slate-700 group-data-[variant=floating]:shadow-2xl", children: children }) }))] }));
});
Sidebar.displayName = "Sidebar";
var SidebarTrigger = React.forwardRef(function (_a, ref) {
    var className = _a.className, onClick = _a.onClick, props = __rest(_a, ["className", "onClick"]);
    var toggleSidebar = useSidebar().toggleSidebar;
    return (_jsxs(Button, __assign({ ref: ref, "data-sidebar": "trigger", variant: "ghost", size: "icon", className: cn("h-9 w-9 rounded-lg bg-slate-800/50 text-slate-300 hover:bg-slate-700 hover:text-white transition-all duration-200 hover:scale-105", className), onClick: function (event) {
            onClick === null || onClick === void 0 ? void 0 : onClick(event);
            toggleSidebar();
        } }, props, { children: [_jsx(PanelLeft, { className: "h-5 w-5" }), _jsx("span", { className: "sr-only", children: "Toggle Sidebar" })] })));
});
SidebarTrigger.displayName = "SidebarTrigger";
var SidebarRail = React.forwardRef(function (_a, ref) {
    var className = _a.className, props = __rest(_a, ["className"]);
    var toggleSidebar = useSidebar().toggleSidebar;
    return (_jsx("button", __assign({ ref: ref, "data-sidebar": "rail", "aria-label": "Toggle Sidebar", tabIndex: -1, onClick: toggleSidebar, title: "Toggle Sidebar", className: cn("absolute inset-y-0 z-20 hidden w-4 -translate-x-1/2 transition-all duration-300 ease-in-out after:absolute after:inset-y-0 after:left-1/2 after:w-[2px] hover:after:bg-indigo-400 group-data-[side=left]:-right-4 group-data-[side=right]:left-0 sm:flex", "[[data-side=left]_&]:cursor-w-resize [[data-side=right]_&]:cursor-e-resize", "[[data-side=left][data-state=collapsed]_&]:cursor-e-resize [[data-side=right][data-state=collapsed]_&]:cursor-w-resize", "group-data-[collapsible=offcanvas]:translate-x-0 group-data-[collapsible=offcanvas]:after:left-full group-data-[collapsible=offcanvas]:hover:bg-slate-800/50", "[[data-side=left][data-collapsible=offcanvas]_&]:-right-2", "[[data-side=right][data-collapsible=offcanvas]_&]:-left-2", "hover:bg-slate-800/30 hover:shadow-lg", className) }, props)));
});
SidebarRail.displayName = "SidebarRail";
var SidebarInset = React.forwardRef(function (_a, ref) {
    var className = _a.className, props = __rest(_a, ["className"]);
    return (_jsx("main", __assign({ ref: ref, className: cn("relative flex w-full flex-1 flex-col bg-background", "md:peer-data-[variant=inset]:m-2 md:peer-data-[state=collapsed]:peer-data-[variant=inset]:ml-2 md:peer-data-[variant=inset]:ml-0 md:peer-data-[variant=inset]:rounded-xl md:peer-data-[variant=inset]:shadow", className) }, props)));
});
SidebarInset.displayName = "SidebarInset";
var SidebarInput = React.forwardRef(function (_a, ref) {
    var className = _a.className, props = __rest(_a, ["className"]);
    return (_jsx(Input, __assign({ ref: ref, "data-sidebar": "input", className: cn("h-10 w-full rounded-lg bg-slate-800/50 border-slate-700 text-slate-200 placeholder:text-slate-500 shadow-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:border-indigo-500 transition-all duration-200", className) }, props)));
});
SidebarInput.displayName = "SidebarInput";
var SidebarHeader = React.forwardRef(function (_a, ref) {
    var className = _a.className, props = __rest(_a, ["className"]);
    return (_jsx("div", __assign({ ref: ref, "data-sidebar": "header", className: cn("flex flex-col gap-4 p-4", className) }, props)));
});
SidebarHeader.displayName = "SidebarHeader";
var SidebarFooter = React.forwardRef(function (_a, ref) {
    var className = _a.className, props = __rest(_a, ["className"]);
    return (_jsx("div", __assign({ ref: ref, "data-sidebar": "footer", className: cn("flex flex-col gap-2 p-4 mt-auto", className) }, props)));
});
SidebarFooter.displayName = "SidebarFooter";
var SidebarSeparator = React.forwardRef(function (_a, ref) {
    var className = _a.className, props = __rest(_a, ["className"]);
    return (_jsx(Separator, __assign({ ref: ref, "data-sidebar": "separator", className: cn("mx-3 w-auto bg-slate-700/50", className) }, props)));
});
SidebarSeparator.displayName = "SidebarSeparator";
var SidebarContent = React.forwardRef(function (_a, ref) {
    var className = _a.className, props = __rest(_a, ["className"]);
    return (_jsx("div", __assign({ ref: ref, "data-sidebar": "content", className: cn("flex min-h-0 flex-1 flex-col gap-2 overflow-auto group-data-[collapsible=icon]:overflow-hidden", className) }, props)));
});
SidebarContent.displayName = "SidebarContent";
var SidebarGroup = React.forwardRef(function (_a, ref) {
    var className = _a.className, props = __rest(_a, ["className"]);
    return (_jsx("div", __assign({ ref: ref, "data-sidebar": "group", className: cn("relative flex w-full min-w-0 flex-col p-3", className) }, props)));
});
SidebarGroup.displayName = "SidebarGroup";
var SidebarGroupLabel = React.forwardRef(function (_a, ref) {
    var className = _a.className, _b = _a.asChild, asChild = _b === void 0 ? false : _b, props = __rest(_a, ["className", "asChild"]);
    var Comp = asChild ? Slot : "div";
    return (_jsx(Comp, __assign({ ref: ref, "data-sidebar": "group-label", className: cn("flex h-8 shrink-0 items-center rounded-md px-3 text-xs font-medium text-slate-400 uppercase tracking-wider outline-none ring-sidebar-ring transition-[margin,opacity] duration-200 ease-linear focus-visible:ring-2 [&>svg]:size-4 [&>svg]:shrink-0", "group-data-[collapsible=icon]:-mt-8 group-data-[collapsible=icon]:opacity-0", className) }, props, { children: props.children === "Configuration Setup" ? "Company Configuration" : props.children })));
});
SidebarGroupLabel.displayName = "SidebarGroupLabel";
var SidebarGroupAction = React.forwardRef(function (_a, ref) {
    var className = _a.className, _b = _a.asChild, asChild = _b === void 0 ? false : _b, props = __rest(_a, ["className", "asChild"]);
    var Comp = asChild ? Slot : "button";
    return (_jsx(Comp, __assign({ ref: ref, "data-sidebar": "group-action", className: cn("absolute right-3 top-3.5 flex aspect-square w-6 items-center justify-center rounded-md p-0 text-slate-400 outline-none ring-sidebar-ring transition-transform hover:bg-slate-800 hover:text-white focus-visible:ring-2 [&>svg]:size-4 [&>svg]:shrink-0", 
        // Increases the hit area of the button on mobile.
        "after:absolute after:-inset-2 after:md:hidden", "group-data-[collapsible=icon]:hidden", "hover:scale-110", className) }, props)));
});
SidebarGroupAction.displayName = "SidebarGroupAction";
var SidebarGroupContent = React.forwardRef(function (_a, ref) {
    var className = _a.className, props = __rest(_a, ["className"]);
    return (_jsx("div", __assign({ ref: ref, "data-sidebar": "group-content", className: cn("w-full text-sm", className) }, props)));
});
SidebarGroupContent.displayName = "SidebarGroupContent";
var SidebarMenu = React.forwardRef(function (_a, ref) {
    var className = _a.className, props = __rest(_a, ["className"]);
    return (_jsx("ul", __assign({ ref: ref, "data-sidebar": "menu", className: cn("flex w-full min-w-0 flex-col gap-1", className) }, props)));
});
SidebarMenu.displayName = "SidebarMenu";
var SidebarMenuItem = React.forwardRef(function (_a, ref) {
    var className = _a.className, props = __rest(_a, ["className"]);
    return (_jsx("li", __assign({ ref: ref, "data-sidebar": "menu-item", className: cn("group/menu-item relative", className) }, props)));
});
SidebarMenuItem.displayName = "SidebarMenuItem";
var sidebarMenuButtonVariants = cva("peer/menu-button flex w-full items-center gap-3 overflow-hidden rounded-xl p-3 text-left text-sm outline-none ring-sidebar-ring transition-all duration-200 hover:bg-slate-800/50 hover:text-white focus-visible:ring-2 active:bg-slate-800/70 active:text-white disabled:pointer-events-none disabled:opacity-50 group-has-[[data-sidebar=menu-action]]/menu-item:pr-8 aria-disabled:pointer-events-none aria-disabled:opacity-50 data-[active=true]:bg-slate-800/70 data-[active=true]:text-white data-[active=true]:font-medium data-[state=open]:hover:bg-slate-800/50 data-[state=open]:hover:text-white group-data-[collapsible=icon]:!size-10 group-data-[collapsible=icon]:!p-2 [&>span:last-child]:truncate [&>svg]:size-5 [&>svg]:shrink-0", {
    variants: {
        variant: {
            default: "hover:bg-slate-800/50 hover:text-white",
            outline: "bg-slate-800/30 shadow-[0_0_0_1px_hsl(var(--sidebar-border))] hover:bg-slate-800/50 hover:text-white hover:shadow-[0_0_0_1px_hsl(var(--sidebar-accent))]",
        },
        size: {
            default: "h-10 text-sm",
            sm: "h-8 text-xs",
            lg: "h-12 text-sm group-data-[collapsible=icon]:!p-0",
        },
    },
    defaultVariants: {
        variant: "default",
        size: "default",
    },
});
var SidebarMenuButton = React.forwardRef(function (_a, ref) {
    var _b = _a.asChild, asChild = _b === void 0 ? false : _b, _c = _a.isActive, isActive = _c === void 0 ? false : _c, _d = _a.variant, variant = _d === void 0 ? "default" : _d, _e = _a.size, size = _e === void 0 ? "default" : _e, tooltip = _a.tooltip, className = _a.className, props = __rest(_a, ["asChild", "isActive", "variant", "size", "tooltip", "className"]);
    var Comp = asChild ? Slot : "button";
    var _f = useSidebar(), isMobile = _f.isMobile, state = _f.state;
    var button = (_jsx(Comp, __assign({ ref: ref, "data-sidebar": "menu-button", "data-size": size, "data-active": isActive, className: cn(sidebarMenuButtonVariants({ variant: variant, size: size }), className) }, props)));
    if (!tooltip) {
        return button;
    }
    if (typeof tooltip === "string") {
        tooltip = {
            children: tooltip,
        };
    }
    return (_jsxs(Tooltip, { children: [_jsx(TooltipTrigger, { asChild: true, children: button }), _jsx(TooltipContent, __assign({ side: "right", align: "center", hidden: state !== "collapsed" || isMobile, className: "bg-slate-800 text-slate-200 border-slate-700 shadow-lg" }, tooltip))] }));
});
SidebarMenuButton.displayName = "SidebarMenuButton";
var SidebarMenuAction = React.forwardRef(function (_a, ref) {
    var className = _a.className, _b = _a.asChild, asChild = _b === void 0 ? false : _b, _c = _a.showOnHover, showOnHover = _c === void 0 ? false : _c, props = __rest(_a, ["className", "asChild", "showOnHover"]);
    var Comp = asChild ? Slot : "button";
    return (_jsx(Comp, __assign({ ref: ref, "data-sidebar": "menu-action", className: cn("absolute right-2 top-2.5 flex aspect-square w-6 items-center justify-center rounded-md p-0 text-slate-400 outline-none ring-sidebar-ring transition-transform hover:bg-slate-800 hover:text-white focus-visible:ring-2 peer-hover/menu-button:text-white [&>svg]:size-4 [&>svg]:shrink-0", 
        // Increases the hit area of the button on mobile.
        "after:absolute after:-inset-2 after:md:hidden", "peer-data-[size=sm]/menu-button:top-1.5", "peer-data-[size=default]/menu-button:top-2.5", "peer-data-[size=lg]/menu-button:top-3.5", "group-data-[collapsible=icon]:hidden", showOnHover &&
            "group-focus-within/menu-item:opacity-100 group-hover/menu-item:opacity-100 data-[state=open]:opacity-100 peer-data-[active=true]/menu-button:text-white md:opacity-0", "hover:scale-110", className) }, props)));
});
SidebarMenuAction.displayName = "SidebarMenuAction";
var SidebarMenuBadge = React.forwardRef(function (_a, ref) {
    var className = _a.className, props = __rest(_a, ["className"]);
    return (_jsx("div", __assign({ ref: ref, "data-sidebar": "menu-badge", className: cn("pointer-events-none absolute right-2 flex h-6 min-w-6 select-none items-center justify-center rounded-full px-2 text-xs font-medium tabular-nums text-white bg-indigo-600", "peer-hover/menu-button:text-white peer-data-[active=true]/menu-button:text-white", "peer-data-[size=sm]/menu-button:top-1", "peer-data-[size=default]/menu-button:top-1.5", "peer-data-[size=lg]/menu-button:top-2.5", "group-data-[collapsible=icon]:hidden", className) }, props)));
});
SidebarMenuBadge.displayName = "SidebarMenuBadge";
var SidebarMenuSkeleton = React.forwardRef(function (_a, ref) {
    var className = _a.className, _b = _a.showIcon, showIcon = _b === void 0 ? false : _b, props = __rest(_a, ["className", "showIcon"]);
    // Random width between 50 to 90%.
    var width = React.useMemo(function () {
        return "".concat(Math.floor(Math.random() * 40) + 50, "%");
    }, []);
    return (_jsxs("div", __assign({ ref: ref, "data-sidebar": "menu-skeleton", className: cn("flex h-10 items-center gap-3 rounded-xl p-3", className) }, props, { children: [showIcon && (_jsx(Skeleton, { className: "size-5 rounded-md", "data-sidebar": "menu-skeleton-icon" })), _jsx(Skeleton, { className: "h-4 max-w-[--skeleton-width] flex-1", "data-sidebar": "menu-skeleton-text", style: {
                    "--skeleton-width": width,
                } })] })));
});
SidebarMenuSkeleton.displayName = "SidebarMenuSkeleton";
var SidebarMenuSub = React.forwardRef(function (_a, ref) {
    var className = _a.className, props = __rest(_a, ["className"]);
    return (_jsx("ul", __assign({ ref: ref, "data-sidebar": "menu-sub", className: cn("mx-3.5 flex min-w-0 translate-x-px flex-col gap-1 border-l border-slate-700/50 px-2.5 py-0.5", "group-data-[collapsible=icon]:hidden", className) }, props)));
});
SidebarMenuSub.displayName = "SidebarMenuSub";
var SidebarMenuSubItem = React.forwardRef(function (_a, ref) {
    var props = __rest(_a, []);
    return _jsx("li", __assign({ ref: ref }, props));
});
SidebarMenuSubItem.displayName = "SidebarMenuSubItem";
var SidebarMenuSubButton = React.forwardRef(function (_a, ref) {
    var _b = _a.asChild, asChild = _b === void 0 ? false : _b, _c = _a.size, size = _c === void 0 ? "md" : _c, isActive = _a.isActive, className = _a.className, props = __rest(_a, ["asChild", "size", "isActive", "className"]);
    var Comp = asChild ? Slot : "a";
    return (_jsx(Comp, __assign({ ref: ref, "data-sidebar": "menu-sub-button", "data-size": size, "data-active": isActive, className: cn("flex h-8 min-w-0 -translate-x-px items-center gap-2 overflow-hidden rounded-lg px-3 text-slate-300 outline-none ring-sidebar-ring hover:bg-slate-800/50 hover:text-white focus-visible:ring-2 active:bg-slate-800/70 active:text-white disabled:pointer-events-none disabled:opacity-50 aria-disabled:pointer-events-none aria-disabled:opacity-50 [&>span:last-child]:truncate [&>svg]:size-4 [&>svg]:shrink-0 [&>svg]:text-slate-400", "data-[active=true]:bg-slate-800/70 data-[active=true]:text-white", size === "sm" && "text-xs", size === "md" && "text-sm", "group-data-[collapsible=icon]:hidden", "transition-all duration-200", className) }, props)));
});
SidebarMenuSubButton.displayName = "SidebarMenuSubButton";
// Example menu items with icons and badges
var SidebarMenuItems = function () {
    return (_jsxs(_Fragment, { children: [_jsxs(SidebarGroup, { children: [_jsx(SidebarGroupLabel, { children: "Main" }), _jsx(SidebarGroupContent, { children: _jsxs(SidebarMenu, { children: [_jsx(SidebarMenuItem, { children: _jsxs(SidebarMenuButton, { isActive: true, tooltip: "Dashboard", children: [_jsx(Home, {}), _jsx("span", { children: "Dashboard" })] }) }), _jsx(SidebarMenuItem, { children: _jsxs(SidebarMenuButton, { tooltip: "Analytics", children: [_jsx(BarChart3, {}), _jsx("span", { children: "Analytics" }), _jsx(SidebarMenuBadge, { children: "12" })] }) }), _jsx(SidebarMenuItem, { children: _jsxs(SidebarMenuButton, { tooltip: "Documents", children: [_jsx(FileText, {}), _jsx("span", { children: "Documents" })] }) })] }) })] }), _jsxs(SidebarGroup, { children: [_jsx(SidebarGroupLabel, { children: "Team" }), _jsx(SidebarGroupContent, { children: _jsxs(SidebarMenu, { children: [_jsx(SidebarMenuItem, { children: _jsxs(SidebarMenuButton, { tooltip: "Team Members", children: [_jsx(Users, {}), _jsx("span", { children: "Team Members" })] }) }), _jsx(SidebarMenuItem, { children: _jsxs(SidebarMenuButton, { tooltip: "Settings", children: [_jsx(Settings, {}), _jsx("span", { children: "Settings" })] }) })] }) })] }), _jsxs(SidebarGroup, { children: [_jsx(SidebarGroupLabel, { children: "Support" }), _jsx(SidebarGroupContent, { children: _jsx(SidebarMenu, { children: _jsx(SidebarMenuItem, { children: _jsxs(SidebarMenuButton, { tooltip: "Help Center", children: [_jsx(HelpCircle, {}), _jsx("span", { children: "Help Center" })] }) }) }) })] })] }));
};
export { Sidebar, SidebarContent, SidebarFooter, SidebarGroup, SidebarGroupAction, SidebarGroupContent, SidebarGroupLabel, SidebarHeader, SidebarInput, SidebarInset, SidebarMenu, SidebarMenuAction, SidebarMenuBadge, SidebarMenuButton, SidebarMenuItem, SidebarMenuSkeleton, SidebarMenuSub, SidebarMenuSubButton, SidebarMenuSubItem, SidebarMenuItems, SidebarProvider, SidebarRail, SidebarSeparator, SidebarTrigger, useSidebar, };
