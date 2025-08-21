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
import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { ChevronRight, MoreHorizontal } from "lucide-react";
import { cn } from "@/lib/utils";
var Breadcrumb = React.forwardRef(function (_a, ref) {
    var props = __rest(_a, []);
    return _jsx("nav", __assign({ ref: ref, "aria-label": "breadcrumb" }, props));
});
Breadcrumb.displayName = "Breadcrumb";
var BreadcrumbList = React.forwardRef(function (_a, ref) {
    var className = _a.className, props = __rest(_a, ["className"]);
    return (_jsx("ol", __assign({ ref: ref, className: cn("flex flex-wrap items-center gap-1.5 break-words text-sm text-muted-foreground sm:gap-2.5", className) }, props)));
});
BreadcrumbList.displayName = "BreadcrumbList";
var BreadcrumbItem = React.forwardRef(function (_a, ref) {
    var className = _a.className, props = __rest(_a, ["className"]);
    return (_jsx("li", __assign({ ref: ref, className: cn("inline-flex items-center gap-1.5", className) }, props)));
});
BreadcrumbItem.displayName = "BreadcrumbItem";
var BreadcrumbLink = React.forwardRef(function (_a, ref) {
    var asChild = _a.asChild, className = _a.className, props = __rest(_a, ["asChild", "className"]);
    var Comp = asChild ? Slot : "a";
    return (_jsx(Comp, __assign({ ref: ref, className: cn("transition-colors hover:text-foreground", className) }, props)));
});
BreadcrumbLink.displayName = "BreadcrumbLink";
var BreadcrumbPage = React.forwardRef(function (_a, ref) {
    var className = _a.className, props = __rest(_a, ["className"]);
    return (_jsx("span", __assign({ ref: ref, role: "link", "aria-disabled": "true", "aria-current": "page", className: cn("font-normal text-foreground", className) }, props)));
});
BreadcrumbPage.displayName = "BreadcrumbPage";
var BreadcrumbSeparator = function (_a) {
    var children = _a.children, className = _a.className, props = __rest(_a, ["children", "className"]);
    return (_jsx("li", __assign({ role: "presentation", "aria-hidden": "true", className: cn("[&>svg]:w-3.5 [&>svg]:h-3.5", className) }, props, { children: children !== null && children !== void 0 ? children : _jsx(ChevronRight, {}) })));
};
BreadcrumbSeparator.displayName = "BreadcrumbSeparator";
var BreadcrumbEllipsis = function (_a) {
    var className = _a.className, props = __rest(_a, ["className"]);
    return (_jsxs("span", __assign({ role: "presentation", "aria-hidden": "true", className: cn("flex h-9 w-9 items-center justify-center", className) }, props, { children: [_jsx(MoreHorizontal, { className: "h-4 w-4" }), _jsx("span", { className: "sr-only", children: "More" })] })));
};
BreadcrumbEllipsis.displayName = "BreadcrumbElipssis";
export { Breadcrumb, BreadcrumbList, BreadcrumbItem, BreadcrumbLink, BreadcrumbPage, BreadcrumbSeparator, BreadcrumbEllipsis, };
