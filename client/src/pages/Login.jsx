import { useEffect, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Eye, EyeOff } from "lucide-react";
import Cookies from "js-cookie";
import { getUserAutoLogin, login } from "../api/user";
import BaseButton from "@/components/common/button/BaseButton";
import BaseInput from "@/components/common/input/BaseInput";
import BaseStatusMessage from "@/components/common/alert/BaseStatusMessage";
import Logo from "@/assets/Logo.png";

export default function LoginPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const autoLoginStarted = useRef(false);

  const [form, setForm] = useState({
    account: "",
    password: "",
  });

  const [errors, setErrors] = useState({});
  const [apiError, setApiError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const saveLogin = (data) => {
    const { token, ID, name } = data;
    Cookies.set("token", token, { expires: 1 });
    Cookies.set("ID", ID, { expires: 1 });
    Cookies.set("name", name, { expires: 1 });
  };

  useEffect(() => {
    const autoLogin = searchParams.get("autoLogin");
    const jwt = searchParams.get("s") || "";
    const iv = searchParams.get("v") || "";

    if (!autoLogin || !jwt || !iv || autoLoginStarted.current) return;

    autoLoginStarted.current = true;
    setIsLoading(true);
    setApiError("");

    getUserAutoLogin({ iv, jwt })
      .then((data) => {
        saveLogin(data);
        navigate("/", { replace: true });
      })
      .catch((error) => {
        console.error("自動登入失敗:", error);

        setApiError(
          error?.response?.data?.message ||
          "自動登入失敗，請重新登入"
        );
      })
      .finally(() => {
        setIsLoading(false);
      });
  }, [navigate, searchParams]);


  const handleChange = (e) => {
    const { name, value } = e.target;

    setForm((prev) => ({
      ...prev,
      [name]: value,
    }));

    setErrors((prev) => ({
      ...prev,
      [name]: "",
    }));
  };

  const validate = () => {
    const newErrors = {};

    if (!form.account.trim()) { newErrors.account = "帳號為必填" }
    if (!form.password.trim()) { newErrors.password = "密碼為必填"; }

    setErrors(newErrors);

    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    setApiError("");

    if (!validate()) return;

    setIsLoading(true);

    try {
      const res = await login(form.account, form.password);

      saveLogin(res);

      navigate("/", { replace: true });
    } catch (error) {
      setApiError(
        error?.response?.data?.message ||
          "登入失敗，請檢查帳號或密碼"
      );
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <main className="flex min-h-dvh items-center justify-center bg-background px-4 py-8 sm:px-6">
      <section className="w-full max-w-105 rounded-3xl border border-border bg-card p-6 shadow-card sm:p-9" aria-labelledby="login-title">
        <div className="mb-8 text-center">
          <span className="mx-auto grid size-12 place-items-center rounded-2xl bg-primary-light">
            <img src={Logo} alt="AIoTWEB" className="max-h-5 max-w-8 object-contain" />
          </span>
          <h1 id="login-title" className="mt-5 type-page-title font-bold tracking-tight text-foreground ">登入</h1>
          <p className="mt-2 type-body text-muted-foreground ">請輸入帳號與密碼</p>
        </div>

        <form className="space-y-5" onSubmit={handleSubmit}>

          <BaseInput
            id="account"
            label="帳號"
            name="account"
            autoComplete="username"
            value={form.account}
            onChange={handleChange}
            placeholder="請輸入帳號"
            error={errors.account}
          />

          <BaseInput
            id="password"
            label="密碼"
            name="password"
            type={showPassword ? "text" : "password"}
            autoComplete="current-password"
            value={form.password}
            onChange={handleChange}
            placeholder="請輸入密碼"
            error={errors.password}
            endAdornment={
              <BaseButton
                type="button"
                variant="ghost"
                size="icon-sm"
                onClick={() => setShowPassword((visible) => !visible)}
                aria-label={showPassword ? "隱藏密碼" : "顯示密碼"}
                aria-pressed={showPassword}
              >
                {showPassword ? <EyeOff size={17} /> : <Eye size={17} />}
              </BaseButton>
            }
          />

          {apiError && (
            <BaseStatusMessage variant="error" title={apiError}/>
          )}

          <BaseButton type="submit" loading={isLoading} disabled={isLoading} className="h-12 w-full">
            登入
          </BaseButton>
        </form>
      </section>
    </main>
  );
}
