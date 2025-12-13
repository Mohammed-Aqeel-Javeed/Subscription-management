import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Building2, Eye, EyeOff } from "lucide-react";
import { apiFetch } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import ReactCountryFlag from "react-country-flag";

type AddCompanyModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
};

const currencyList = [
  { code: "USD", description: "United States Dollar", symbol: "$", countryCode: "US" },
  { code: "EUR", description: "Euro", symbol: "€", countryCode: "EU" },
  { code: "GBP", description: "British Pound Sterling", symbol: "£", countryCode: "GB" },
  { code: "INR", description: "Indian Rupee", symbol: "₹", countryCode: "IN" },
  { code: "JPY", description: "Japanese Yen", symbol: "¥", countryCode: "JP" },
  { code: "CNY", description: "Chinese Yuan", symbol: "¥", countryCode: "CN" },
  { code: "AUD", description: "Australian Dollar", symbol: "A$", countryCode: "AU" },
  { code: "CAD", description: "Canadian Dollar", symbol: "C$", countryCode: "CA" },
  { code: "AED", description: "UAE Dirham", symbol: "د.إ", countryCode: "AE" },
  { code: "SAR", description: "Saudi Riyal", symbol: "ر.س", countryCode: "SA" },
];

export default function AddCompanyModal({ open, onOpenChange, onSuccess }: AddCompanyModalProps) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [defaultCurrency, setDefaultCurrency] = useState("");
  const [showCurrencyDropdown, setShowCurrencyDropdown] = useState(false);
  const [filteredCurrencies, setFilteredCurrencies] = useState(currencyList);
  const [setAsDefault, setSetAsDefault] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const handleCurrencyChange = (value: string) => {
    const upperValue = value.toUpperCase();
    setDefaultCurrency(upperValue);
    
    if (upperValue.length > 0) {
      const filtered = currencyList.filter(curr => 
        curr.code.startsWith(upperValue) || 
        curr.description.toUpperCase().includes(upperValue)
      );
      setFilteredCurrencies(filtered);
      setShowCurrencyDropdown(filtered.length > 0);
    } else {
      setFilteredCurrencies(currencyList);
      setShowCurrencyDropdown(false);
    }
  };

  const handleCurrencySelect = (currency: typeof currencyList[0]) => {
    setDefaultCurrency(currency.code);
    setShowCurrencyDropdown(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!email || !password || !companyName || !defaultCurrency) {
      toast({
        title: "Error",
        description: "Please fill in all required fields",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    try {
      const res = await apiFetch("/api/user/add-company", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          password,
          companyName,
          defaultCurrency,
          setAsDefault,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.message || "Failed to add company");
      }

      await res.json();
      
      toast({
        title: "Success!",
        description: setAsDefault 
          ? `Company "${companyName}" added and set as default! Page will reload...`
          : `Company "${companyName}" added successfully! You can add more or proceed to login.`,
      });

      // Reset form
      setEmail("");
      setPassword("");
      setCompanyName("");
      setDefaultCurrency("");
      setSetAsDefault(true);
      
      if (onSuccess) {
        onSuccess();
      }

      // If set as default, reload page to switch context
      if (setAsDefault) {
        setTimeout(() => {
          window.location.reload();
        }, 1500);
      } else {
        // Just close modal if not setting as default
        setTimeout(() => {
          onOpenChange(false);
        }, 1500);
      }
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to add company",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px] bg-white border-gray-200">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl text-gray-900">
            <Building2 className="h-5 w-5 text-blue-600" />
            Add New Company
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} style={{ marginTop: 16 }}>
          {/* Email */}
          <div style={{ marginBottom: 10 }}>
            <label style={{ fontWeight: 500, fontSize: 13, color: "#374151" }}>
              Email Address
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
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

          {/* Password */}
          <div style={{ marginBottom: 10 }}>
            <label style={{ fontWeight: 500, fontSize: 13, color: "#374151" }}>
              Password
            </label>
            <div style={{ position: "relative" }}>
              <input
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
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
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                style={{
                  position: "absolute",
                  right: 12,
                  top: "50%",
                  transform: "translateY(-50%)",
                  background: "transparent",
                  border: "none",
                  cursor: "pointer",
                  color: "#6b7280",
                }}
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>

          {/* Company Name */}
          <div style={{ marginBottom: 10 }}>
            <label style={{ fontWeight: 500, fontSize: 13, color: "#374151" }}>
              Company Name
            </label>
            <input
              type="text"
              value={companyName}
              onChange={(e) => setCompanyName(e.target.value)}
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

          {/* LCY (Currency) */}
          <div style={{ marginBottom: 10, position: "relative" }}>
            <label style={{ fontWeight: 500, fontSize: 13, color: "#374151" }}>
              LCY
            </label>
            <input
              type="text"
              value={defaultCurrency}
              onChange={(e) => handleCurrencyChange(e.target.value)}
              onFocus={() => {
                if (defaultCurrency && filteredCurrencies.length > 0) {
                  setShowCurrencyDropdown(true);
                }
              }}
              onBlur={() => {
                setTimeout(() => setShowCurrencyDropdown(false), 200);
              }}
              required
              autoComplete="off"
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
            
            {/* Currency Dropdown with Flags */}
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
                {filteredCurrencies.map((curr) => (
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
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = "#eef2ff";
                      e.currentTarget.style.transform = "translateY(-1px)";
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = "transparent";
                      e.currentTarget.style.transform = "translateY(0)";
                    }}
                  >
                    <ReactCountryFlag
                      countryCode={curr.countryCode}
                      svg
                      style={{ width: '20px', height: '15px', borderRadius: 2 }}
                    />
                    <span style={{ fontWeight: 600, color: "#111827" }}>{curr.description} ({curr.code})</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Set as Default Checkbox */}
          <div style={{ 
            display: "flex", 
            alignItems: "center", 
            gap: 8, 
            padding: 12, 
            background: "#eff6ff", 
            borderRadius: 8, 
            border: "1px solid #bfdbfe",
            marginBottom: 16 
          }}>
            <input
              id="setAsDefault"
              type="checkbox"
              checked={setAsDefault}
              onChange={(e) => setSetAsDefault(e.target.checked)}
              style={{ width: 16, height: 16, cursor: "pointer" }}
            />
            <label
              htmlFor="setAsDefault"
              style={{
                fontSize: 13,
                fontWeight: 500,
                color: "#111827",
                cursor: "pointer",
              }}
            >
              Set as default company (switch to this company after adding)
            </label>
          </div>

          {/* Submit Buttons */}
          <div style={{ display: "flex", gap: 12, marginTop: 16 }}>
            <button
              type="button"
              onClick={() => onOpenChange(false)}
              disabled={loading}
              style={{
                flex: 1,
                padding: 10,
                borderRadius: 999,
                border: "1px solid #e5e7eb",
                background: "white",
                color: "#374151",
                fontWeight: 600,
                fontSize: 15,
                cursor: loading ? "not-allowed" : "pointer",
              }}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              style={{
                flex: 1,
                padding: 10,
                borderRadius: 999,
                border: 0,
                background: loading ? "#9ca3af" : "linear-gradient(90deg, #4f46e5, #7c3aed)",
                color: "white",
                fontWeight: 600,
                fontSize: 15,
                cursor: loading ? "not-allowed" : "pointer",
              }}
            >
              {loading ? "Adding..." : "Add Company"}
            </button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
