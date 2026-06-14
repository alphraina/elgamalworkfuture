import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { Button, Input, Card, CardContent } from "@/components/ui";
import { Activity, Lock, User, Languages, ArrowLeft, CheckCircle } from "lucide-react";
import { motion } from "framer-motion";
import { useTranslation } from "react-i18next";
import i18n, { applyLangToDoc } from "@/i18n/index";
import { Label } from "@/components/ui";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs text-muted-foreground uppercase tracking-wider">{label}</Label>
      {children}
    </div>
  );
}

export default function Signup() {
  const { t } = useTranslation();
  const [, setLocation] = useLocation();
  const [signupEnabled, setSignupEnabled] = useState<boolean | null>(null);
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const [form, setForm] = useState({
    username: "", password: "", confirmPassword: "",
    fullName: "", email: "", department: "", phone: "",
  });

  useEffect(() => {
    fetch(`${BASE}/api/auth/signup-status`, { credentials: "include" })
      .then(r => r.json())
      .then(d => setSignupEnabled(d.signupEnabled))
      .catch(() => setSignupEnabled(false));
  }, []);

  const LANG_CYCLE: Record<string, string> = { en: "ar", ar: "zh", zh: "en" };
  const toggleLanguage = () => {
    const next = LANG_CYCLE[i18n.language] ?? "en";
    i18n.changeLanguage(next);
    applyLangToDoc(next);
  };

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (!form.username.trim() || !form.password.trim() || !form.fullName.trim()) {
      setError(t("signup.errorRequired"));
      return;
    }
    if (form.password !== form.confirmPassword) {
      setError(t("signup.errorPasswordMatch"));
      return;
    }
    if (form.password.length < 6) {
      setError(t("signup.errorPasswordLength"));
      return;
    }
    setBusy(true);
    try {
      const res = await fetch(`${BASE}/api/auth/signup`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          username: form.username.trim(),
          password: form.password,
          fullName: form.fullName.trim(),
          email: form.email.trim() || undefined,
          department: form.department.trim() || undefined,
          phone: form.phone.trim() || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || t("common.error"));
      setDone(true);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  const bgUrl = `${import.meta.env.BASE_URL}images/factory-bg.png`;

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-background relative overflow-hidden">
      <div className="absolute inset-0 z-0">
        <img src={bgUrl} alt="" className="w-full h-full object-cover opacity-30" />
        <div className="absolute inset-0 bg-gradient-to-b from-background/80 via-background/60 to-background/95 backdrop-blur-[2px]" />
      </div>

      <button
        onClick={toggleLanguage}
        className="absolute top-4 end-4 z-20 flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-white/5 border border-white/10 text-muted-foreground hover:text-white hover:bg-white/10 transition-colors text-xs font-bold tracking-wider"
      >
        <Languages className="w-3.5 h-3.5" />
        {t("lang.switchTo")}
      </button>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="z-10 w-full max-w-lg px-4 py-8"
      >
        <div className="flex flex-col items-center mb-6">
          <div className="w-14 h-14 bg-primary/20 rounded-2xl flex items-center justify-center mb-3 border border-primary/50 shadow-[0_0_30px_rgba(37,99,235,0.3)] tech-border">
            <Activity className="w-7 h-7 text-primary" />
          </div>
          <h1 className="text-3xl font-display font-bold text-white tracking-wider">OPPO <span className="text-primary">CMMS</span></h1>
          <p className="text-muted-foreground mt-1 text-sm uppercase tracking-widest">{t("signup.title")}</p>
        </div>

        <Card className="border-white/10 backdrop-blur-xl bg-card/60 shadow-2xl shadow-black">
          <CardContent className="p-6">
            {signupEnabled === null ? (
              <div className="text-center py-8 text-muted-foreground">{t("common.loading")}</div>
            ) : !signupEnabled ? (
              <div className="text-center py-8 space-y-4">
                <Lock className="w-12 h-12 text-muted-foreground mx-auto opacity-40" />
                <p className="text-white font-semibold">{t("signup.closed")}</p>
                <p className="text-muted-foreground text-sm">{t("signup.closedDesc")}</p>
                <Button variant="outline" onClick={() => setLocation("/")} className="gap-2 mt-2">
                  <ArrowLeft className="w-4 h-4" /> {t("signup.backToLogin")}
                </Button>
              </div>
            ) : done ? (
              <div className="text-center py-8 space-y-4">
                <CheckCircle className="w-12 h-12 text-green-400 mx-auto" />
                <p className="text-white font-semibold">{t("signup.successTitle")}</p>
                <p className="text-muted-foreground text-sm">{t("signup.successDesc")}</p>
                <Button onClick={() => setLocation("/")} className="gap-2 mt-2">
                  <ArrowLeft className="w-4 h-4" /> {t("signup.backToLogin")}
                </Button>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4">
                {error && (
                  <p className="text-sm text-destructive bg-destructive/10 px-3 py-2 rounded">{error}</p>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <Field label={`${t("users.workId")} *`}>
                    <div className="relative">
                      <User className="absolute start-3 top-3 h-4 w-4 text-muted-foreground" />
                      <Input
                        className="ps-9"
                        placeholder="EG52000"
                        autoComplete="username"
                        value={form.username}
                        onChange={e => setForm(f => ({ ...f, username: e.target.value }))}
                      />
                    </div>
                  </Field>
                  <Field label={`${t("users.fullName")} *`}>
                    <Input
                      placeholder="John Doe"
                      autoComplete="name"
                      value={form.fullName}
                      onChange={e => setForm(f => ({ ...f, fullName: e.target.value }))}
                    />
                  </Field>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <Field label={`${t("users.password")} *`}>
                    <div className="relative">
                      <Lock className="absolute start-3 top-3 h-4 w-4 text-muted-foreground" />
                      <Input
                        type="password"
                        className="ps-9"
                        placeholder="••••••••"
                        autoComplete="new-password"
                        value={form.password}
                        onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                      />
                    </div>
                  </Field>
                  <Field label={`${t("signup.confirmPassword")} *`}>
                    <div className="relative">
                      <Lock className="absolute start-3 top-3 h-4 w-4 text-muted-foreground" />
                      <Input
                        type="password"
                        className="ps-9"
                        placeholder="••••••••"
                        autoComplete="new-password"
                        value={form.confirmPassword}
                        onChange={e => setForm(f => ({ ...f, confirmPassword: e.target.value }))}
                      />
                    </div>
                  </Field>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <Field label={t("users.email")}>
                    <Input
                      type="email"
                      placeholder="john@factory.com"
                      autoComplete="email"
                      value={form.email}
                      onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                    />
                  </Field>
                  <Field label={t("users.department")}>
                    <Input
                      placeholder="Maintenance"
                      value={form.department}
                      onChange={e => setForm(f => ({ ...f, department: e.target.value }))}
                    />
                  </Field>
                </div>

                <Field label={t("users.phone")}>
                  <Input
                    placeholder="+20 1xx xxx xxxx"
                    value={form.phone}
                    onChange={e => setForm(f => ({ ...f, phone: e.target.value }))}
                  />
                </Field>

                <p className="text-xs text-muted-foreground bg-white/5 border border-white/10 rounded-lg px-3 py-2">
                  {t("signup.roleNote")}
                </p>

                <Button type="submit" className="w-full" disabled={busy}>
                  {busy ? t("common.loading") : t("signup.submit")}
                </Button>

                <div className="text-center">
                  <button
                    type="button"
                    onClick={() => setLocation("/")}
                    className="text-xs text-muted-foreground hover:text-white transition-colors"
                  >
                    {t("signup.backToLogin")}
                  </button>
                </div>
              </form>
            )}
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}
