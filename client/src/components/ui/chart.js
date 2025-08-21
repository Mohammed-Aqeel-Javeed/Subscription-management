"use client";
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
import * as RechartsPrimitive from "recharts";
import { cn } from "@/lib/utils";
// Format: { THEME_NAME: CSS_SELECTOR }
var THEMES = { light: "", dark: ".dark" };
var ChartContext = React.createContext(null);
function useChart() {
    var context = React.useContext(ChartContext);
    if (!context) {
        throw new Error("useChart must be used within a <ChartContainer />");
    }
    return context;
}
var ChartContainer = React.forwardRef(function (_a, ref) {
    var id = _a.id, className = _a.className, children = _a.children, config = _a.config, props = __rest(_a, ["id", "className", "children", "config"]);
    var uniqueId = React.useId();
    var chartId = "chart-".concat(id || uniqueId.replace(/:/g, ""));
    return (_jsx(ChartContext.Provider, { value: { config: config }, children: _jsxs("div", __assign({ "data-chart": chartId, ref: ref, className: cn("flex aspect-video justify-center text-xs [&_.recharts-cartesian-axis-tick_text]:fill-muted-foreground [&_.recharts-cartesian-grid_line[stroke='#ccc']]:stroke-border/50 [&_.recharts-curve.recharts-tooltip-cursor]:stroke-border [&_.recharts-dot[stroke='#fff']]:stroke-transparent [&_.recharts-layer]:outline-none [&_.recharts-polar-grid_[stroke='#ccc']]:stroke-border [&_.recharts-radial-bar-background-sector]:fill-muted [&_.recharts-rectangle.recharts-tooltip-cursor]:fill-muted [&_.recharts-reference-line_[stroke='#ccc']]:stroke-border [&_.recharts-sector[stroke='#fff']]:stroke-transparent [&_.recharts-sector]:outline-none [&_.recharts-surface]:outline-none", className) }, props, { children: [_jsx(ChartStyle, { id: chartId, config: config }), _jsx(RechartsPrimitive.ResponsiveContainer, { children: children })] })) }));
});
ChartContainer.displayName = "Chart";
var ChartStyle = function (_a) {
    var id = _a.id, config = _a.config;
    var colorConfig = Object.entries(config).filter(function (_a) {
        var config = _a[1];
        return config.theme || config.color;
    });
    if (!colorConfig.length) {
        return null;
    }
    return (_jsx("style", { dangerouslySetInnerHTML: {
            __html: Object.entries(THEMES)
                .map(function (_a) {
                var theme = _a[0], prefix = _a[1];
                return "\n".concat(prefix, " [data-chart=").concat(id, "] {\n").concat(colorConfig
                    .map(function (_a) {
                    var _b;
                    var key = _a[0], itemConfig = _a[1];
                    var color = ((_b = itemConfig.theme) === null || _b === void 0 ? void 0 : _b[theme]) ||
                        itemConfig.color;
                    return color ? "  --color-".concat(key, ": ").concat(color, ";") : null;
                })
                    .join("\n"), "\n}\n");
            })
                .join("\n"),
        } }));
};
var ChartTooltip = RechartsPrimitive.Tooltip;
var ChartTooltipContent = React.forwardRef(function (_a, ref) {
    var active = _a.active, _b = _a.payload, payload = _b === void 0 ? [] : _b, className = _a.className, _c = _a.indicator, indicator = _c === void 0 ? "dot" : _c, _d = _a.hideLabel, hideLabel = _d === void 0 ? false : _d, _e = _a.hideIndicator, hideIndicator = _e === void 0 ? false : _e, labelFormatter = _a.labelFormatter, labelClassName = _a.labelClassName, formatter = _a.formatter, color = _a.color, nameKey = _a.nameKey, labelKey = _a.labelKey;
    var config = useChart().config;
    var tooltipLabel = React.useMemo(function () {
        var _a;
        if (hideLabel || !payload.length) {
            return null;
        }
        var item = payload[0];
        var key = "".concat(labelKey || (item === null || item === void 0 ? void 0 : item.dataKey) || "value");
        var itemConfig = getPayloadConfigFromPayload(config, item, key);
        var value = (_a = itemConfig === null || itemConfig === void 0 ? void 0 : itemConfig.label) !== null && _a !== void 0 ? _a : item.value;
        if (labelFormatter) {
            return (_jsx("div", { className: cn("font-medium", labelClassName), children: labelFormatter(value, payload) }));
        }
        if (!value) {
            return null;
        }
        return _jsx("div", { className: cn("font-medium", labelClassName), children: value });
    }, [
        labelFormatter,
        payload,
        hideLabel,
        labelClassName,
        config,
        labelKey,
    ]);
    if (!active || !payload.length) {
        return null;
    }
    var nestLabel = payload.length === 1 && indicator !== "dot";
    return (_jsxs("div", { ref: ref, className: cn("grid min-w-[8rem] items-start gap-1.5 rounded-lg border border-border/50 bg-background px-2.5 py-1.5 text-xs shadow-xl", className), children: [!nestLabel ? tooltipLabel : null, _jsx("div", { className: "grid gap-1.5", children: payload.map(function (item, index) {
                    var _a;
                    var key = "".concat(nameKey || item.dataKey || "value");
                    var itemConfig = getPayloadConfigFromPayload(config, item, key);
                    var indicatorColor = color || item.color;
                    return (_jsx("div", { className: cn("flex w-full flex-wrap items-stretch gap-2 [&>svg]:h-2.5 [&>svg]:w-2.5 [&>svg]:text-muted-foreground", indicator === "dot" && "items-center"), children: formatter && (item === null || item === void 0 ? void 0 : item.value) !== undefined && item.value ? (formatter(item.value, item.value, item, index, [])) : (_jsxs(_Fragment, { children: [(itemConfig === null || itemConfig === void 0 ? void 0 : itemConfig.icon) ? (_jsx(itemConfig.icon, {})) : (!hideIndicator && (_jsx("div", { className: cn("shrink-0 rounded-[2px] border-[--color-border] bg-[--color-bg]", {
                                        "h-2.5 w-2.5": indicator === "dot",
                                        "w-1": indicator === "line",
                                        "w-0 border-[1.5px] border-dashed bg-transparent": indicator === "dashed",
                                        "my-0.5": nestLabel && indicator === "dashed",
                                    }), style: {
                                        "--color-bg": indicatorColor,
                                        "--color-border": indicatorColor,
                                    } }))), _jsxs("div", { className: cn("flex flex-1 justify-between leading-none", nestLabel ? "items-end" : "items-center"), children: [_jsxs("div", { className: "grid gap-1.5", children: [nestLabel ? tooltipLabel : null, _jsx("span", { className: "text-muted-foreground", children: (_a = itemConfig === null || itemConfig === void 0 ? void 0 : itemConfig.label) !== null && _a !== void 0 ? _a : item.value })] }), item.value && (_jsx("span", { className: "font-mono font-medium tabular-nums text-foreground", children: item.value.toLocaleString() }))] })] })) }, item.dataKey));
                }) })] }));
});
ChartTooltipContent.displayName = "ChartTooltip";
var ChartLegend = RechartsPrimitive.Legend;
var ChartLegendContent = React.forwardRef(function (_a, ref) {
    var className = _a.className, _b = _a.hideIcon, hideIcon = _b === void 0 ? false : _b, _c = _a.payload, payload = _c === void 0 ? [] : _c, _d = _a.verticalAlign, verticalAlign = _d === void 0 ? "bottom" : _d, nameKey = _a.nameKey;
    var config = useChart().config;
    if (!payload.length) {
        return null;
    }
    return (_jsx("div", { ref: ref, className: cn("flex items-center justify-center gap-4", verticalAlign === "top" ? "pb-3" : "pt-3", className), children: payload.map(function (item, index) {
            var _a;
            var key = "".concat(nameKey || item.dataKey || "value");
            var itemConfig = getPayloadConfigFromPayload(config, item, key);
            return (_jsxs("div", { className: cn("flex items-center gap-1.5 [&>svg]:h-3 [&>svg]:w-3 [&>svg]:text-muted-foreground"), children: [(itemConfig === null || itemConfig === void 0 ? void 0 : itemConfig.icon) && !hideIcon ? (_jsx(itemConfig.icon, {})) : (_jsx("div", { className: "h-2 w-2 shrink-0 rounded-[2px]", style: {
                            backgroundColor: item.color,
                        } })), (_a = itemConfig === null || itemConfig === void 0 ? void 0 : itemConfig.label) !== null && _a !== void 0 ? _a : item.value] }, item.value));
        }) }));
});
ChartLegendContent.displayName = "ChartLegend";
// Helper to extract item config from a payload.
function getPayloadConfigFromPayload(config, payload, key) {
    if (typeof payload !== "object" || payload === null) {
        return undefined;
    }
    var payloadPayload = "payload" in payload &&
        typeof payload.payload === "object" &&
        payload.payload !== null
        ? payload.payload
        : undefined;
    var configLabelKey = key;
    if (key in payload &&
        typeof payload[key] === "string") {
        configLabelKey = payload[key];
    }
    else if (payloadPayload &&
        key in payloadPayload &&
        typeof payloadPayload[key] === "string") {
        configLabelKey = payloadPayload[key];
    }
    return configLabelKey in config
        ? config[configLabelKey]
        : config[key];
}
export { ChartContainer, ChartTooltip, ChartTooltipContent, ChartLegend, ChartLegendContent, ChartStyle, };
