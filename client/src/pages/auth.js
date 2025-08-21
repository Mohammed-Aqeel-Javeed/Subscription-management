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
import { LogIn, UserPlus } from "lucide-react";
import { useNavigate } from "react-router-dom";
// Backend API base URL
var API_BASE_URL = "http://localhost:5000";
export default function AuthPage() {
    var _this = this;
    var _a = useState(false), showSignup = _a[0], setShowSignup = _a[1];
    var _b = useState(""), loginEmail = _b[0], setLoginEmail = _b[1];
    var _c = useState(""), loginPassword = _c[0], setLoginPassword = _c[1];
    var _d = useState(""), loginError = _d[0], setLoginError = _d[1];
    var _e = useState(""), signupName = _e[0], setSignupName = _e[1];
    var _f = useState(""), signupEmail = _f[0], setSignupEmail = _f[1];
    var _g = useState(""), signupPassword = _g[0], setSignupPassword = _g[1];
    var _h = useState(""), signupConfirm = _h[0], setSignupConfirm = _h[1];
    var _j = useState(""), signupError = _j[0], setSignupError = _j[1];
    var _k = useState(""), signupSuccess = _k[0], setSignupSuccess = _k[1];
    var navigate = useNavigate();
    // Slide animation styles
    var mainStyle = {
        width: 350,
        height: 500,
        margin: "4rem auto",
        background: "#fff",
        borderRadius: 10,
        boxShadow: "5px 20px 50px #0002",
        overflow: "hidden",
        position: "relative",
        transition: "box-shadow 0.3s"
    };
    var slideStyle = {
        position: "absolute",
        width: "100%",
        height: "100%",
        top: "0px",
        left: showSignup ? "0px" : "100%",
        background: "#fff",
        borderRadius: "10px",
        boxShadow: showSignup ? "0 2px 16px #0001" : "none",
        transition: "left 0.6s cubic-bezier(.68,-0.55,.27,1.55)"
    };
    var loginStyle = {
        position: "absolute",
        width: "100%",
        height: "100%",
        top: "0px",
        left: showSignup ? "-100%" : "0px",
        background: "#fff",
        borderRadius: "10px",
        boxShadow: !showSignup ? "0 2px 16px #0001" : "none",
        transition: "left 0.6s cubic-bezier(.68,-0.55,.27,1.55)"
    };
    // Login handler
    var handleLogin = function (e) { return __awaiter(_this, void 0, void 0, function () {
        var res, data, err_1;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    e.preventDefault();
                    setLoginError("");
                    if (!loginEmail || !loginPassword) {
                        setLoginError("Please enter both email and password.");
                        return [2 /*return*/];
                    }
                    _a.label = 1;
                case 1:
                    _a.trys.push([1, 5, , 6]);
                    return [4 /*yield*/, fetch("".concat(API_BASE_URL, "/api/login"), {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({ email: loginEmail, password: loginPassword })
                        })];
                case 2:
                    res = _a.sent();
                    if (!!res.ok) return [3 /*break*/, 4];
                    return [4 /*yield*/, res.json().catch(function () { return ({}); })];
                case 3:
                    data = _a.sent();
                    setLoginError(data.message || "Login failed");
                    return [2 /*return*/];
                case 4:
                    sessionStorage.setItem("isAuthenticated", "true");
                    navigate("/dashboard");
                    return [3 /*break*/, 6];
                case 5:
                    err_1 = _a.sent();
                    setLoginError("Network error");
                    return [3 /*break*/, 6];
                case 6: return [2 /*return*/];
            }
        });
    }); };
    // Signup handler
    var handleSignup = function (e) { return __awaiter(_this, void 0, void 0, function () {
        var res, data, _a;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0:
                    e.preventDefault();
                    setSignupError("");
                    setSignupSuccess("");
                    if (!signupName || !signupEmail || !signupPassword || !signupConfirm) {
                        setSignupError("Please fill in all fields.");
                        return [2 /*return*/];
                    }
                    if (signupPassword !== signupConfirm) {
                        setSignupError("Passwords do not match.");
                        return [2 /*return*/];
                    }
                    _b.label = 1;
                case 1:
                    _b.trys.push([1, 5, , 6]);
                    return [4 /*yield*/, fetch("".concat(API_BASE_URL, "/api/login"), {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({ fullName: signupName, email: signupEmail, password: signupPassword })
                        })];
                case 2:
                    res = _b.sent();
                    if (!!res.ok) return [3 /*break*/, 4];
                    return [4 /*yield*/, res.json().catch(function () { return ({}); })];
                case 3:
                    data = _b.sent();
                    setSignupError(data.message || "Signup failed");
                    return [2 /*return*/];
                case 4:
                    setSignupSuccess("Signup successful!");
                    setTimeout(function () {
                        setShowSignup(false);
                        setSignupSuccess("");
                    }, 1200);
                    return [3 /*break*/, 6];
                case 5:
                    _a = _b.sent();
                    setSignupError("Network error");
                    return [3 /*break*/, 6];
                case 6: return [2 /*return*/];
            }
        });
    }); };
    return (_jsxs("div", { style: mainStyle, children: [_jsx("div", { style: slideStyle, children: _jsxs("form", { onSubmit: handleSignup, style: { padding: 32, display: 'flex', flexDirection: 'column', alignItems: 'center', height: '100%' }, children: [_jsx(UserPlus, { size: 40, color: "#573b8a", style: { marginBottom: 16 } }), _jsx("label", { style: { color: '#573b8a', fontSize: 28, fontWeight: 700, marginBottom: 24 }, children: "Sign up" }), _jsx("input", { type: "text", placeholder: "User name", value: signupName, onChange: function (e) { return setSignupName(e.target.value); }, required: true, style: { width: '80%', marginBottom: 18, padding: 12, borderRadius: 5, border: '1px solid #e0dede' } }), _jsx("input", { type: "email", placeholder: "Email", value: signupEmail, onChange: function (e) { return setSignupEmail(e.target.value); }, required: true, style: { width: '80%', marginBottom: 18, padding: 12, borderRadius: 5, border: '1px solid #e0dede' } }), _jsx("input", { type: "password", placeholder: "Password", value: signupPassword, onChange: function (e) { return setSignupPassword(e.target.value); }, required: true, style: { width: '80%', marginBottom: 18, padding: 12, borderRadius: 5, border: '1px solid #e0dede' } }), _jsx("input", { type: "password", placeholder: "Confirm Password", value: signupConfirm, onChange: function (e) { return setSignupConfirm(e.target.value); }, required: true, style: { width: '80%', marginBottom: 18, padding: 12, borderRadius: 5, border: '1px solid #e0dede' } }), _jsx("button", { type: "submit", style: { width: '80%', height: 40, background: '#573b8a', color: '#fff', fontWeight: 600, fontSize: 18, border: 0, borderRadius: 5, marginTop: 10, cursor: 'pointer' }, children: "Sign up" }), signupError && _jsx("div", { style: { color: '#d32f2f', marginTop: 12, textAlign: 'center' }, children: signupError }), signupSuccess && _jsx("div", { style: { color: '#388e3c', marginTop: 12, textAlign: 'center' }, children: signupSuccess }), _jsx("button", { type: "button", style: { background: 'none', border: 0, color: '#573b8a', marginTop: 18, fontWeight: 500, cursor: 'pointer' }, onClick: function () { return setShowSignup(false); }, children: "Already have an account? Login" })] }) }), _jsx("div", { style: loginStyle, children: _jsxs("form", { onSubmit: handleLogin, style: { padding: 32, display: 'flex', flexDirection: 'column', alignItems: 'center', height: '100%' }, children: [_jsx(LogIn, { size: 40, color: "#573b8a", style: { marginBottom: 16 } }), _jsx("label", { style: { color: '#573b8a', fontSize: 28, fontWeight: 700, marginBottom: 24 }, children: "Login" }), _jsx("input", { type: "email", placeholder: "Email", value: loginEmail, onChange: function (e) { return setLoginEmail(e.target.value); }, required: true, style: { width: '80%', marginBottom: 18, padding: 12, borderRadius: 5, border: '1px solid #e0dede' } }), _jsx("input", { type: "password", placeholder: "Password", value: loginPassword, onChange: function (e) { return setLoginPassword(e.target.value); }, required: true, style: { width: '80%', marginBottom: 18, padding: 12, borderRadius: 5, border: '1px solid #e0dede' } }), _jsx("button", { type: "submit", style: { width: '80%', height: 40, background: '#573b8a', color: '#fff', fontWeight: 600, fontSize: 18, border: 0, borderRadius: 5, marginTop: 10, cursor: 'pointer' }, children: "Login" }), loginError && _jsx("div", { style: { color: '#d32f2f', marginTop: 12, textAlign: 'center' }, children: loginError }), _jsx("button", { type: "button", style: { background: 'none', border: 0, color: '#573b8a', marginTop: 18, fontWeight: 500, cursor: 'pointer' }, onClick: function () { return setShowSignup(true); }, children: "Don't have an account? Sign up" })] }) })] }));
}
