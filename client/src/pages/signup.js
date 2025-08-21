var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g = Object.create((typeof Iterator === "function" ? Iterator : Object).prototype);
    return g.next = verb(0), g["throw"] = verb(1), g["return"] = verb(2), typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState } from "react";
import { UserPlus } from "lucide-react";
// Backend API base URL
var API_BASE_URL = "http://localhost:5000";
export default function SignupPage() {
    var _this = this;
    var _a = useState(""), fullName = _a[0], setFullName = _a[1];
    var _b = useState(""), email = _b[0], setEmail = _b[1];
    var _c = useState(""), password = _c[0], setPassword = _c[1];
    var _d = useState(""), confirmPassword = _d[0], setConfirmPassword = _d[1];
    var _e = useState(""), error = _e[0], setError = _e[1];
    var _f = useState(""), success = _f[0], setSuccess = _f[1];
    // Autogenerate tenantId in frontend
    var handleSubmit = function (e) { return __awaiter(_this, void 0, void 0, function () {
        var tenantId, res, data, err_1;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    e.preventDefault();
                    setError("");
                    setSuccess("");
                    if (!fullName || !email || !password || !confirmPassword) {
                        setError("Please fill in all fields.");
                        return [2 /*return*/];
                    }
                    if (password !== confirmPassword) {
                        setError("Passwords do not match.");
                        return [2 /*return*/];
                    }
                    _a.label = 1;
                case 1:
                    _a.trys.push([1, 4, , 5]);
                    tenantId = 'tenant-' + Math.random().toString(36).substr(2, 9) + '-' + Date.now();
                    console.log('Attempting signup with:', { fullName: fullName, email: email, tenantId: tenantId }); // Debug log
                    return [4 /*yield*/, fetch("".concat(API_BASE_URL, "/api/signup"), {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            credentials: "include",
                            body: JSON.stringify({ fullName: fullName, email: email, password: password, tenantId: tenantId })
                        })];
                case 2:
                    res = _a.sent();
                    return [4 /*yield*/, res.json().catch(function () { return ({}); })];
                case 3:
                    data = _a.sent();
                    console.log('Signup response data:', data); // Debug log
                    if (!res.ok) {
                        setError(data.message || "Signup failed (".concat(res.status, ")"));
                        return [2 /*return*/];
                    }
                    setSuccess("Signup successful! You can now login with your credentials.");
                    // Clear form
                    setFullName("");
                    setEmail("");
                    setPassword("");
                    setConfirmPassword("");
                    return [3 /*break*/, 5];
                case 4:
                    err_1 = _a.sent();
                    console.error('Signup error:', err_1); // Debug log
                    setError("Network error - please check if the server is running");
                    return [3 /*break*/, 5];
                case 5: return [2 /*return*/];
            }
        });
    }); };
    return (_jsx("div", { style: { maxWidth: 400, margin: "3rem auto" }, children: _jsxs("div", { style: { background: '#fff', borderRadius: 16, boxShadow: '0 2px 16px rgba(0,0,0,0.08)', padding: 32 }, children: [_jsxs("div", { style: { display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: 24 }, children: [_jsx(UserPlus, { size: 48, color: "#007bff", style: { marginBottom: 8 } }), _jsx("h2", { style: { fontWeight: 700, fontSize: 28, color: '#222' }, children: "Create Account" })] }), _jsxs("form", { onSubmit: handleSubmit, children: [_jsxs("div", { style: { marginBottom: 16 }, children: [_jsx("label", { style: { fontWeight: 500 }, children: "Full Name" }), _jsx("input", { type: "text", value: fullName, onChange: function (e) { return setFullName(e.target.value); }, required: true, style: { width: "100%", padding: 10, marginTop: 6, borderRadius: 6, border: '1px solid #ddd', fontSize: 16 } })] }), _jsxs("div", { style: { marginBottom: 16 }, children: [_jsx("label", { style: { fontWeight: 500 }, children: "Email" }), _jsx("input", { type: "email", value: email, onChange: function (e) { return setEmail(e.target.value); }, required: true, style: { width: "100%", padding: 10, marginTop: 6, borderRadius: 6, border: '1px solid #ddd', fontSize: 16 } })] }), _jsxs("div", { style: { marginBottom: 16 }, children: [_jsx("label", { style: { fontWeight: 500 }, children: "Password" }), _jsx("input", { type: "password", value: password, onChange: function (e) { return setPassword(e.target.value); }, required: true, style: { width: "100%", padding: 10, marginTop: 6, borderRadius: 6, border: '1px solid #ddd', fontSize: 16 } })] }), _jsxs("div", { style: { marginBottom: 24 }, children: [_jsx("label", { style: { fontWeight: 500 }, children: "Confirm Password" }), _jsx("input", { type: "password", value: confirmPassword, onChange: function (e) { return setConfirmPassword(e.target.value); }, required: true, style: { width: "100%", padding: 10, marginTop: 6, borderRadius: 6, border: '1px solid #ddd', fontSize: 16 } })] }), _jsx("button", { type: "submit", style: { width: "100%", padding: 12, background: "#007bff", color: "#fff", border: 0, borderRadius: 8, fontWeight: 600, fontSize: 18, boxShadow: '0 2px 8px rgba(0,123,255,0.08)' }, children: "Sign Up" }), error && _jsx("div", { style: { color: "#d32f2f", marginTop: 12, textAlign: 'center' }, children: error }), success && _jsx("div", { style: { color: "#388e3c", marginTop: 12, textAlign: 'center' }, children: success })] })] }) }));
}
