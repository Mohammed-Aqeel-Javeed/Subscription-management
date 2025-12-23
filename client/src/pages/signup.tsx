import React, { useState, useEffect } from "react";
import { CheckCircle2, XCircle, Eye, EyeOff, Building2 } from "lucide-react";
import ReactCountryFlag from "react-country-flag";
import { useNavigate, useSearchParams } from "react-router-dom";
import { API_BASE_URL } from "../lib/config";
import AddCompanyModal from "../components/modals/add-company-modal";

export default function SignupPage() {
  const [step, setStep] = useState<"details" | "otp" | "success">("details");
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [otp, setOtp] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [companyCurrency, setCompanyCurrency] = useState("");
  const [showCurrencyDropdown, setShowCurrencyDropdown] = useState(false);
  const [filteredCurrencies, setFilteredCurrencies] = useState<Array<{code: string, description: string, symbol: string, countryCode?: string}>>([]);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);
  const [showAddCompanyModal, setShowAddCompanyModal] = useState(false);
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  
  // Auto-open Add Company modal if addCompany parameter is present
  useEffect(() => {
    if (searchParams.get('addCompany') === 'true') {
      setShowAddCompanyModal(true);
    }
  }, [searchParams]);
  
  // Complete currency list
  const currencyList = [
    { code: "USD", description: "United States Dollar", symbol: "$" },
    { code: "EUR", description: "Euro", symbol: "€" },
    { code: "GBP", description: "British Pound Sterling", symbol: "£" },
    { code: "INR", description: "Indian Rupee", symbol: "₹" },
    { code: "JPY", description: "Japanese Yen", symbol: "¥" },
    { code: "CNY", description: "Chinese Yuan", symbol: "¥" },
    { code: "AUD", description: "Australian Dollar", symbol: "A$" },
    { code: "CAD", description: "Canadian Dollar", symbol: "C$" },
    { code: "CHF", description: "Swiss Franc", symbol: "CHF" },
    { code: "AED", description: "UAE Dirham", symbol: "د.إ" },
    { code: "SAR", description: "Saudi Riyal", symbol: "ر.س" },
    { code: "SGD", description: "Singapore Dollar", symbol: "S$" },
    { code: "HKD", description: "Hong Kong Dollar", symbol: "HK$" },
    { code: "NZD", description: "New Zealand Dollar", symbol: "NZ$" },
    { code: "KRW", description: "South Korean Won", symbol: "₩" },
    { code: "SEK", description: "Swedish Krona", symbol: "kr" },
    { code: "NOK", description: "Norwegian Krone", symbol: "kr" },
    { code: "DKK", description: "Danish Krone", symbol: "kr" },
    { code: "ZAR", description: "South African Rand", symbol: "R" },
    { code: "BRL", description: "Brazilian Real", symbol: "R$" },
    { code: "MXN", description: "Mexican Peso", symbol: "$" },
    { code: "RUB", description: "Russian Ruble", symbol: "₽" },
    { code: "TRY", description: "Turkish Lira", symbol: "₺" },
    { code: "PLN", description: "Polish Złoty", symbol: "zł" },
    { code: "THB", description: "Thai Baht", symbol: "฿" },
    { code: "IDR", description: "Indonesian Rupiah", symbol: "Rp" },
    { code: "MYR", description: "Malaysian Ringgit", symbol: "RM" },
    { code: "PHP", description: "Philippine Peso", symbol: "₱" },
    { code: "VND", description: "Vietnamese Đồng", symbol: "₫" },
    { code: "EGP", description: "Egyptian Pound", symbol: "£" },
    { code: "NGN", description: "Nigerian Naira", symbol: "₦" },
    { code: "PKR", description: "Pakistani Rupee", symbol: "Rs" },
    { code: "BDT", description: "Bangladeshi Taka", symbol: "৳" },
    { code: "ILS", description: "Israeli New Shekel", symbol: "₪" },
    { code: "ARS", description: "Argentine Peso", symbol: "$" },
    { code: "CLP", description: "Chilean Peso", symbol: "$" },
    { code: "COP", description: "Colombian Peso", symbol: "$" },
    { code: "CZK", description: "Czech Koruna", symbol: "Kč" },
    { code: "HUF", description: "Hungarian Forint", symbol: "Ft" },
    { code: "RON", description: "Romanian Leu", symbol: "lei" }
  ];
  
  // Map currency code to ISO country code for flag rendering
  const getCountryCodeForCurrency = (code: string): string | undefined => {
    const map: Record<string, string> = {
      USD: "US",
      EUR: "EU",
      GBP: "GB",
      INR: "IN",
      JPY: "JP",
      CNY: "CN",
      AUD: "AU",
      CAD: "CA",
      CHF: "CH",
      AED: "AE",
      SAR: "SA",
      SGD: "SG",
      HKD: "HK",
      NZD: "NZ",
      KRW: "KR",
      SEK: "SE",
      NOK: "NO",
      DKK: "DK",
      ZAR: "ZA",
      BRL: "BR",
      MXN: "MX",
      RUB: "RU",
      TRY: "TR",
      PLN: "PL",
      THB: "TH",
      IDR: "ID",
      MYR: "MY",
      PHP: "PH",
      VND: "VN",
      EGP: "EG",
      NGN: "NG",
      PKR: "PK",
      BDT: "BD",
      ILS: "IL",
      ARS: "AR",
      CLP: "CL",
      COP: "CO",
      CZK: "CZ",
      HUF: "HU",
      RON: "RO",
    };

    return map[code as keyof typeof map];
  };

  // Handle currency input change with autocomplete
  const handleCurrencyChange = (value: string) => {
    const upperValue = value.toUpperCase();
    setCompanyCurrency(upperValue);
    
    if (upperValue.length > 0) {
      const filtered = currencyList
        .filter(curr => 
          curr.code.startsWith(upperValue) || 
          curr.description.toUpperCase().includes(upperValue)
        )
        .map(curr => ({
          ...curr,
          countryCode: getCountryCodeForCurrency(curr.code),
        }));

      setFilteredCurrencies(filtered);
      setShowCurrencyDropdown(filtered.length > 0);
    } else {
      setShowCurrencyDropdown(false);
      setFilteredCurrencies([]);
    }
  };
  
  // Handle currency selection from dropdown
  const handleCurrencySelect = (currency: {code: string, description: string, symbol: string}) => {
    setCompanyCurrency(currency.code);
    setShowCurrencyDropdown(false);
    setFilteredCurrencies([]);
  };
  // Autogenerate tenantId in frontend

  // Email validation function
  const isValidEmail = (email: string): boolean => {
    // More strict email validation
    const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
    if (!emailRegex.test(email)) {
      return false;
    }
    
    // Additional checks
    const [localPart, domain] = email.split('@');
    
    // Local part should not be empty or too long
    if (!localPart || localPart.length > 64) {
      return false;
    }
    
    // Domain should have at least one dot and valid TLD
    if (!domain || !domain.includes('.')) {
      return false;
    }
    
    const domainParts = domain.split('.');
    const tld = domainParts[domainParts.length - 1];
    
    // TLD should be at least 2 characters
    if (tld.length < 2) {
      return false;
    }
    
    return true;
  };

  // Password policy validation
  const validatePassword = (password: string) => {
    return {
      minLength: password.length >= 8,
      hasUpperCase: /[A-Z]/.test(password),
      hasLowerCase: /[a-z]/.test(password),
      hasNumber: /[0-9]/.test(password),
      hasSpecialChar: /[!@#$%^&*(),.?":{}|<>]/.test(password),
    };
  };

  const passwordValidation = validatePassword(password);
  const isPasswordValid = Object.values(passwordValidation).every(Boolean);

  const handleSubmitDetails = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccess("");

    if (!fullName || !email || !password || !confirmPassword || !companyCurrency) {
      setError("Please fill in all fields.");
      return;
    }

    if (!isValidEmail(email)) {
      setError("Please enter a valid email address.");
      return;
    }

    if (!isPasswordValid) {
      setError("Password does not meet the security requirements.");
      return;
    }

    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }
    
    // Validate currency code
    const validCurrency = currencyList.find(c => c.code === companyCurrency);
    if (!validCurrency) {
      setError("Please select a valid currency from the list.");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/send-otp`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email })
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.message || "Failed to send OTP");
        return;
      }

      setSuccess("OTP sent to your email! Please check your inbox.");
      setStep("otp");
    } catch (err) {
      setError("Network error - please check if the server is running");
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOTP = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccess("");

    if (!otp || otp.length !== 6) {
      setError("Please enter the 6-digit OTP.");
      return;
    }

    setLoading(true);
    try {
      // First verify OTP
      const verifyRes = await fetch(`${API_BASE_URL}/api/verify-otp`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, otp })
      });

      const verifyData = await verifyRes.json();

      if (!verifyRes.ok) {
        setError(verifyData.message || "Invalid OTP");
        return;
      }

      // Then create account
      const tenantId = 'tenant-' + Math.random().toString(36).substr(2, 9) + '-' + Date.now();
      
      const signupRes = await fetch(`${API_BASE_URL}/api/signup`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ fullName, email, password, tenantId, defaultCurrency: companyCurrency, companyName })
      });

      const signupData = await signupRes.json();

      if (!signupRes.ok) {
        setError(signupData.message || "Signup failed");
        return;
      }

      setSuccess("Signup successful! Redirecting to login...");
      setTimeout(() => {
        navigate("/login");
      }, 1500);
    } catch (err) {
      setError("Network error - please try again");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "linear-gradient(135deg, #5b3cff, #7c3aed)",
        padding: "0.75rem",
        fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Oxygen', 'Ubuntu', 'Cantarell', sans-serif",
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: 880,
          borderRadius: 16,
          overflow: "hidden",
          display: "grid",
          gridTemplateColumns: "1.1fr 1fr",
          background: "#5b3cff",
          boxShadow: "0 24px 80px rgba(15, 23, 42, 0.45)",
        }}
      >
        {/* Left marketing / hero panel */}
        <div
          style={{
            padding: "2rem 2.25rem",
            color: "#f9fafb",
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
            background:
              "radial-gradient(circle at top left, rgba(255,255,255,0.25), transparent 55%), radial-gradient(circle at bottom right, rgba(59,130,246,0.35), transparent 60%)",
            position: "relative",
          }}
        >
          <div style={{ maxWidth: 360 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 18 }}>
              <img
                src="/assets/logo.png"
                alt="Trackla Logo"
                style={{
                  width: 64,
                  height: 64,
                  filter: "drop-shadow(0 4px 10px rgba(0,0,0,0.35)) brightness(1.05)",
                }}
              />
              <div
                style={{
                  fontWeight: 700,
                  fontSize: 28,
                  letterSpacing: "0.03em",
                  color: "#f9fafb",
                }}
              >
                Trackla
              </div>
            </div>

            <div>
              <h1
                style={{
                  fontSize: 30,
                  lineHeight: 1.1,
                  fontWeight: 800,
                  marginBottom: 12,
                }}
              >
                Hey, Hello!
              </h1>
              <p style={{ fontSize: 13, opacity: 0.9, marginBottom: 8 }}>
                Join us today — it only takes a minute.
              </p>
              <p style={{ fontSize: 11, maxWidth: 310, opacity: 0.85 }}>
                Never miss a payment again. Track, manage, and optimize all your
                subscriptions in one place.
              </p>
            </div>
          </div>

          <div
            style={{
              position: "absolute",
              left: "2rem",
              bottom: "1.5rem",
              fontSize: 9,
              opacity: 0.7,
            }}
          >
            © {new Date().getFullYear()} Substracker. All rights reserved.
          </div>
        </div>

        {/* Right signup card */}
        <div
          style={{
            background: "#f9fafb",
            padding: "1.3rem 1.9rem",
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between",
          }}
        >
          <div>
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                marginBottom: 8,
              }}
            >
              <h2
                style={{
                  fontWeight: 700,
                  fontSize: 22,
                  color: "#111827",
                  marginBottom: 4,
                }}
              >
                Create Account
              </h2>
              <p style={{ color: "#6b7280", fontSize: 12 }}>
                {step === "details" && "Let’s get started with your 30 days free trial."}
                {step === "otp" && "Step 2: Verify OTP to complete your signup."}
              </p>
            </div>

            {/* Step 1: Enter All Details */}
            {step === "details" && (
              <form onSubmit={handleSubmitDetails}>
                <div style={{ marginBottom: 10 }}>
                  <label style={{ fontWeight: 500, fontSize: 13, color: "#374151" }}>
                    Full Name
                  </label>
                  <input
                    type="text"
                    value={fullName}
                    onChange={e => setFullName(e.target.value)}
                    required
                    style={{
                      width: "100%",
                      padding: "8px 11px",
                      marginTop: 4,
                      borderRadius: 999,
                      border: "1px solid #e5e7eb",
                      fontSize: 15,
                      background: "#f9fafb",
                      outline: "none",
                    }}
                  />
                </div>
                <div style={{ marginBottom: 10 }}>
                  <label style={{ fontWeight: 500, fontSize: 13, color: "#374151" }}>
                    Company Name
                  </label>
                  <input
                    type="text"
                    value={companyName}
                    onChange={e => setCompanyName(e.target.value)}
                    required
                    style={{
                      width: "100%",
                      padding: "8px 11px",
                      marginTop: 4,
                      borderRadius: 999,
                      border: "1px solid #e5e7eb",
                      fontSize: 15,
                      background: "#f9fafb",
                      outline: "none",
                    }}
                  />
                </div>
                <div style={{ marginBottom: 14 }}>
                  <label style={{ fontWeight: 500, fontSize: 13, color: "#374151" }}>
                    Email Address
                  </label>
                  <input
                    type="email"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    required
                    style={{
                      width: "100%",
                      padding: "10px 12px",
                      marginTop: 6,
                      borderRadius: 999,
                      border: "1px solid #e5e7eb",
                      fontSize: 15,
                      background: "#f9fafb",
                      outline: "none",
                    }}
                  />
                  {email && !isValidEmail(email) && (
                    <div style={{ color: "#dc2626", fontSize: 12, marginTop: 4 }}>
                      Please enter a valid email address
                    </div>
                  )}
                </div>
                <div style={{ marginBottom: 10, position: "relative" }}>
                  <label style={{ fontWeight: 500, fontSize: 13, color: "#374151" }}>
                    LCY
                  </label>
                  <input
                    type="text"
                    value={companyCurrency}
                    onChange={e => handleCurrencyChange(e.target.value)}
                    onFocus={() => {
                      if (companyCurrency && filteredCurrencies.length > 0) {
                        setShowCurrencyDropdown(true);
                      }
                    }}
                    onBlur={() => {
                      // Delay to allow click on dropdown item
                      setTimeout(() => setShowCurrencyDropdown(false), 200);
                    }}
                    required
                    style={{
                      width: "100%",
                      padding: "10px 12px",
                      marginTop: 6,
                      borderRadius: 999,
                      border: "1px solid #e5e7eb",
                      fontSize: 15,
                      background: "#f9fafb",
                      outline: "none",
                    }}
                    autoComplete="off"
                  />
                  {/* Autocomplete Dropdown */}
                  {showCurrencyDropdown && filteredCurrencies.length > 0 && (
                    <div
                      style={{
                        position: "absolute",
                        zIndex: 50,
                        width: "100%",
                        marginTop: 6,
                        background: "white",
                        border: "1px solid #e5e7eb",
                        borderRadius: 12,
                        boxShadow: "0 10px 25px rgba(15,23,42,0.18)",
                        maxHeight: 200,
                        overflowY: "auto",
                      }}
                    >
                      {filteredCurrencies.map(curr => (
                        <button
                          key={curr.code}
                          type="button"
                          onClick={() => handleCurrencySelect(curr)}
                          style={{
                            width: "100%",
                            padding: "8px 14px",
                            textAlign: "left",
                            background: "transparent",
                            border: 0,
                            borderBottom: "1px solid #f3f4f6",
                            cursor: "pointer",
                            transition: "background 0.15s, transform 0.1s",
                            fontSize: 12,
                          }}
                          onMouseEnter={e => {
                            e.currentTarget.style.background = "#eef2ff";
                            e.currentTarget.style.transform = "translateY(-1px)";
                          }}
                          onMouseLeave={e => {
                            e.currentTarget.style.background = "transparent";
                            e.currentTarget.style.transform = "translateY(0)";
                          }}
                        >
                          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                            {curr.countryCode && (
                              <ReactCountryFlag
                                svg
                                countryCode={curr.countryCode}
                                style={{ width: "1.1rem", height: "1.1rem", borderRadius: "999px" }}
                              />
                            )}
                            <span style={{ fontWeight: 600, color: "#111827" }}>
                              {curr.description} ({curr.code})
                            </span>
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                <div style={{ marginBottom: 14 }}>
                  <label style={{ fontWeight: 500, fontSize: 13, color: "#374151" }}>
                    Password
                  </label>
                  <div style={{ position: "relative", marginTop: 6 }}>
                    <input
                      type={showPassword ? "text" : "password"}
                      value={password}
                      onChange={e => setPassword(e.target.value)}
                      required
                      style={{
                        width: "100%",
                        padding: "10px 40px 10px 12px",
                        borderRadius: 999,
                        border: "1px solid #e5e7eb",
                        fontSize: 15,
                        background: "#f9fafb",
                        outline: "none",
                      }}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      style={{
                        position: "absolute",
                        right: 12,
                        top: "50%",
                        transform: "translateY(-50%)",
                        background: "none",
                        border: "none",
                        cursor: "pointer",
                        padding: 4,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        color: "#6b7280",
                      }}
                    >
                      {showPassword ? (
                        <EyeOff size={18} />
                      ) : (
                        <Eye size={18} />
                      )}
                    </button>
                  </div>
                  {password && !Object.values(passwordValidation).every(Boolean) && (
                    <div style={{ marginTop: 8, fontSize: 11.5, lineHeight: 1.6 }}>
                      <div
                        style={{
                          fontWeight: 600,
                          marginBottom: 4,
                          color: "#4b5563",
                        }}
                      >
                        Password must contain:
                      </div>
                      <PasswordRequirement
                        met={passwordValidation.minLength}
                        text="At least 8 characters"
                      />
                      <PasswordRequirement
                        met={passwordValidation.hasUpperCase}
                        text="One uppercase letter (A-Z)"
                      />
                      <PasswordRequirement
                        met={passwordValidation.hasLowerCase}
                        text="One lowercase letter (a-z)"
                      />
                      <PasswordRequirement
                        met={passwordValidation.hasNumber}
                        text="One number (0-9)"
                      />
                      <PasswordRequirement
                        met={passwordValidation.hasSpecialChar}
                        text="One special character (!@#$%^&*)"
                      />
                    </div>
                  )}
                </div>
                <div style={{ marginBottom: 12 }}>
                  <label style={{ fontWeight: 500, fontSize: 13, color: "#374151" }}>
                    Confirm Password
                  </label>
                  <input
                    type="password"
                    value={confirmPassword}
                    onChange={e => setConfirmPassword(e.target.value)}
                    required
                    style={{
                      width: "100%",
                      padding: "10px 12px",
                      marginTop: 6,
                      borderRadius: 999,
                      border: "1px solid #e5e7eb",
                      fontSize: 15,
                      background: "#f9fafb",
                      outline: "none",
                    }}
                  />
                </div>
                <button
                  type="submit"
                  disabled={loading}
                  style={{
                    width: "100%",
                    padding: 10,
                    background: loading
                      ? "#9ca3af"
                      : "linear-gradient(90deg, #4f46e5, #7c3aed)",
                    color: "#fff",
                    border: 0,
                    borderRadius: 999,
                    fontWeight: 600,
                    fontSize: 15,
                    boxShadow: "0 14px 30px rgba(79,70,229,0.35)",
                    cursor: loading ? "not-allowed" : "pointer",
                    marginTop: 4,
                  }}
                >
                  {loading ? "Sending OTP..." : "Send OTP"}
                </button>
                
                <button
                  type="button"
                  onClick={() => setShowAddCompanyModal(true)}
                  style={{
                    width: "100%",
                    padding: 10,
                    border: "2px solid #4f46e5",
                    background: "white",
                    color: "#4f46e5",
                    borderRadius: 999,
                    fontWeight: 600,
                    fontSize: 14,
                    cursor: "pointer",
                    marginTop: 8,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 8,
                  }}
                >
                  <Building2 size={16} />
                  Add Company (2nd, 3rd, etc.)
                </button>
                
                {/* Social sign-in UI (visual only) */}
                <div
                  style={{
                    marginTop: 10,
                    marginBottom: 4,
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    color: "#9ca3af",
                    fontSize: 12,
                  }}
                >
                  <div style={{ flex: 1, height: 1, background: "#e5e7eb" }} />
                  <span>OR</span>
                  <div style={{ flex: 1, height: 1, background: "#e5e7eb" }} />
                </div>
                <div
                  style={{
                    display: "flex",
                    gap: 8,
                    marginBottom: 2,
                  }}
                >
                  <button
                    type="button"
                    style={{
                      flex: 1,
                      padding: "7px 9px",
                      borderRadius: 999,
                      border: "1px solid #e5e7eb",
                      background: "#ffffff",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: 8,
                      fontSize: 13,
                      cursor: "pointer",
                      color: "#374151",
                    }}
                  >
                    <img
                      src="/assets/social/google.svg"
                      alt="Google logo"
                      style={{ width: 28, height: 28}}
                    />
                    <span>Google</span>
                  </button>
                  <button
                    type="button"
                    style={{
                      flex: 1,
                      padding: "8px 10px",
                      borderRadius: 999,
                      border: "1px solid #e5e7eb",
                      background: "#ffffff",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: 8,
                      fontSize: 13,
                      cursor: "pointer",
                      color: "#1d4ed8",
                    }}
                  >
                    <img
                      src="/assets/social/facebook.svg"
                      alt="Facebook logo"
                      style={{ width: 18, height: 18, borderRadius: 999 }}
                    />
                    <span>Facebook</span>
                  </button>
                </div>
                {error && (
                  <div
                    style={{
                      color: "#dc2626",
                      marginTop: 12,
                      textAlign: "center",
                      fontSize: 13,
                    }}
                  >
                    {error}
                  </div>
                )}
                {success && (
                  <div
                    style={{
                      color: "#16a34a",
                      marginTop: 12,
                      textAlign: "center",
                      fontSize: 13,
                    }}
                  >
                    {success}
                  </div>
                )}
              </form>
            )}

            {/* Step 2: Enter OTP */}
            {step === "otp" && (
              <form onSubmit={handleVerifyOTP}>
                <div style={{ marginBottom: 14 }}>
                  <label style={{ fontWeight: 500, fontSize: 13, color: "#374151" }}>
                    Enter 6-digit OTP
                  </label>
                  <input
                    type="text"
                    value={otp}
                    onChange={e => setOtp(e.target.value.replace(/\D/g, ""))}
                    required
                    maxLength={6}
                    style={{
                      width: "100%",
                      padding: "12px 14px",
                      marginTop: 6,
                      borderRadius: 12,
                      border: "1px solid #e5e7eb",
                      fontSize: 16,
                      background: "#f9fafb",
                      outline: "none",
                      textAlign: "center",
                      letterSpacing: "0.2em",
                      fontWeight: 600,
                    }}
                  />
                </div>
                <button
                  type="submit"
                  disabled={loading}
                  style={{
                    width: "100%",
                    padding: 12,
                    background: loading
                      ? "#9ca3af"
                      : "linear-gradient(90deg, #4f46e5, #7c3aed)",
                    color: "#fff",
                    border: 0,
                    borderRadius: 999,
                    fontWeight: 600,
                    fontSize: 15,
                    boxShadow: "0 14px 30px rgba(79,70,229,0.35)",
                    cursor: loading ? "not-allowed" : "pointer",
                    marginTop: 4,
                  }}
                >
                  {loading ? "Verifying..." : "Verify & Create Account"}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setStep("details");
                    setError("");
                    setSuccess("");
                  }}
                  style={{
                    width: "100%",
                    padding: 10,
                    background: "transparent",
                    color: "#6b7280",
                    border: "1px solid #e5e7eb",
                    borderRadius: 999,
                    fontWeight: 500,
                    fontSize: 14,
                    cursor: "pointer",
                    marginTop: 8,
                  }}
                >
                  ← Back to Details
                </button>
                {error && (
                  <div
                    style={{
                      color: "#dc2626",
                      marginTop: 12,
                      textAlign: "center",
                      fontSize: 13,
                    }}
                  >
                    {error}
                  </div>
                )}
                {success && (
                  <div
                    style={{
                      color: "#16a34a",
                      marginTop: 12,
                      textAlign: "center",
                      fontSize: 13,
                    }}
                  >
                    {success}
                  </div>
                )}
              </form>
            )}
          </div>
          
          <div style={{ textAlign: "center", marginTop: 10, fontSize: 12 }}>
            <span style={{ color: "#6b7280" }}>Already have an account? </span>
            <button
              type="button"
              onClick={() => navigate("/login")}
              style={{
                background: "transparent",
                border: 0,
                color: "#4f46e5",
                cursor: "pointer",
                fontWeight: 600,
              }}
            >
              Login
            </button>
          </div>
        </div>
      </div>

      {/* Add Company Modal */}
      <AddCompanyModal 
        open={showAddCompanyModal} 
        onOpenChange={setShowAddCompanyModal}
        onSuccess={() => {
          // Optional: you can add additional logic here
        }}
      />
    </div>
  );
}

// Helper component for password requirements
function PasswordRequirement({ met, text }: { met: boolean; text: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
      {met ? (
        <CheckCircle2 size={14} color="#388e3c" />
      ) : (
        <XCircle size={14} color="#d32f2f" />
      )}
      <span style={{ color: met ? '#388e3c' : '#d32f2f' }}>{text}</span>
    </div>
  );
}
