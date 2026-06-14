import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useLocation } from "wouter";
import { Button, Input, Card, CardContent, Select, Label } from "@/components/ui";
import { Activity, Lock, User, Languages, AlertTriangle, QrCode, CheckCircle2, X, Camera } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useTranslation } from "react-i18next";
import i18n, { applyLangToDoc } from "@/i18n/index";
import { QRScanner } from "@/components/qr-scanner";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

type Line = { id: number; name: string; team: string | null };

export default function Login() {
  const { t } = useTranslation();
  const { login, isLoggingIn } = useAuth();
  const [, setLocation] = useLocation();
  const [error, setError] = useState("");

  const [publicEnabled, setPublicEnabled] = useState(false);
  const [lines, setLines] = useState<Line[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [reportForm, setReportForm] = useState({ reporterName: "", machineName: "", machineCode: "", lineId: "", reporterTeam: "" });
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState<string | null>(null);
  const [reportError, setReportError] = useState("");
  const [showScanner, setShowScanner] = useState(false);

  useEffect(() => {
    fetch(`${BASE}/api/public/status`)
      .then(r => r.ok ? r.json() : null)
      .then(d => {
        if (d) {
          setPublicEnabled(d.publicDowntimeEnabled ?? false);
          setLines(d.lines ?? []);
        }
      })
      .catch(() => {});
  }, []);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError("");
    const fd = new FormData(e.currentTarget);
    try {
      await login({
        username: fd.get("username") as string,
        password: fd.get("password") as string,
      });
      setLocation("/dashboard");
    } catch (err: any) {
      setError(err.message || t("login.loginError"));
    }
  };

  const openModal = () => {
    setReportForm({ reporterName: "", machineName: "", machineCode: "", lineId: lines[0]?.id.toString() ?? "", reporterTeam: "" });
    setSubmitted(null);
    setReportError("");
    setShowModal(true);
  };

  const submitReport = async () => {
    if (!reportForm.reporterName.trim() || !reportForm.machineName.trim() || !reportForm.lineId || !reportForm.reporterTeam) {
      setReportError(t("publicDowntime.requiredFields"));
      return;
    }
    setSubmitting(true);
    setReportError("");
    try {
      const res = await fetch(`${BASE}/api/public/report`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          reporterName: reportForm.reporterName.trim(),
          machineName: reportForm.machineName.trim(),
          machineCode: reportForm.machineCode.trim() || undefined,
          lineId: Number(reportForm.lineId),
          reporterTeam: reportForm.reporterTeam,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed");
      setSubmitted(data.message || t("publicDowntime.success"));
    } catch (err: any) {
      setReportError(err.message || t("common.error"));
    } finally {
      setSubmitting(false);
    }
  };

  const LANG_CYCLE: Record<string, string> = { en: "ar", ar: "zh", zh: "en" };
  const toggleLanguage = () => {
    const next = LANG_CYCLE[i18n.language] ?? "en";
    i18n.changeLanguage(next);
    applyLangToDoc(next);
  };

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-background relative overflow-hidden">
      {/* Background */}
      <div className="absolute inset-0 z-0">
        <img
          src={`${import.meta.env.BASE_URL}images/factory-bg.png`}
          alt="Factory Background"
          className="w-full h-full object-cover opacity-30"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-background/80 via-background/60 to-background/95 backdrop-blur-[2px]" />
      </div>

      {/* Language toggle — top right */}
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
        className="z-10 w-full max-w-md px-4"
      >
        <div className="flex flex-col items-center mb-8">
          <div className="w-16 h-16 bg-primary/20 rounded-2xl flex items-center justify-center mb-4 border border-primary/50 shadow-[0_0_30px_rgba(37,99,235,0.3)] tech-border">
            <Activity className="w-8 h-8 text-primary" />
          </div>
          <h1 className="text-4xl font-display font-bold text-white tracking-wider">OPPO <span className="text-primary">CMMS</span></h1>
          <p className="text-muted-foreground mt-2 text-sm uppercase tracking-widest">{t("login.subtitle")}</p>
        </div>

        <Card className="border-white/10 backdrop-blur-xl bg-card/60 shadow-2xl shadow-black">
          <CardContent className="p-8">
            <form onSubmit={handleSubmit} className="space-y-5">
              <div className="space-y-2">
                <div className="relative">
                  <User className="absolute start-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input
                    name="username"
                    placeholder={t("login.usernamePlaceholder")}
                    className="ps-10 h-12 bg-background/50 border-white/10 focus-visible:ring-primary focus-visible:border-primary font-mono"
                    required
                  />
                </div>
              </div>
              <div className="space-y-2">
                <div className="relative">
                  <Lock className="absolute start-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input
                    name="password"
                    type="password"
                    placeholder={t("login.passwordPlaceholder")}
                    className="ps-10 h-12 bg-background/50 border-white/10 focus-visible:ring-primary focus-visible:border-primary font-mono"
                    required
                  />
                </div>
              </div>

              {error && (
                <div className="p-3 rounded-md bg-destructive/10 border border-destructive/20 text-destructive text-sm font-medium text-center">
                  {error}
                </div>
              )}

              <Button
                type="submit"
                className="w-full h-12 text-base font-bold tracking-wide uppercase tech-border hover:shadow-[0_0_20px_rgba(37,99,235,0.4)] transition-all duration-300"
                disabled={isLoggingIn}
              >
                {isLoggingIn ? t("login.loggingIn") : t("login.loginBtn")}
              </Button>
            </form>
          </CardContent>
        </Card>

        <p className="text-center mt-6 text-xs text-muted-foreground/70">
          {t("signup.noAccount")}{" "}
          <button
            onClick={() => setLocation("/signup")}
            className="text-primary hover:text-primary/80 font-semibold transition-colors"
          >
            {t("signup.registerHere")}
          </button>
        </p>

        {publicEnabled && (
          <div className="mt-4">
            <button
              onClick={openModal}
              className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl border border-red-500/40 bg-red-500/10 text-red-400 hover:bg-red-500/20 hover:border-red-500/60 transition-all text-sm font-semibold"
            >
              <AlertTriangle className="w-4 h-4" />
              {t("publicDowntime.reportButton")}
            </button>
          </div>
        )}

        <p className="text-center mt-3 text-xs text-muted-foreground/50 font-mono">
          {t("login.authorized")}
        </p>
        <p className="text-center mt-2 text-[11px] text-muted-foreground/35 tracking-wide select-none">
          {t("common.developedBy")}
        </p>
      </motion.div>

      {/* QR Scanner */}
      {showScanner && (
        <QRScanner
          onScan={(code) => {
            setReportForm(f => ({ ...f, machineCode: code }));
            setShowScanner(false);
          }}
          onClose={() => setShowScanner(false)}
          label={t("publicDowntime.qrCode")}
        />
      )}

      {/* Public Downtime Report Modal */}
      <AnimatePresence>
        {showModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm"
            onClick={e => { if (e.target === e.currentTarget) setShowModal(false); }}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="w-full max-w-md bg-card border border-white/10 rounded-2xl shadow-2xl overflow-hidden"
            >
              <div className="flex items-center justify-between p-5 border-b border-white/10">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="w-5 h-5 text-red-400" />
                  <h2 className="text-white font-semibold">{t("publicDowntime.title")}</h2>
                </div>
                <button onClick={() => setShowModal(false)} className="text-muted-foreground hover:text-white transition-colors">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="p-5">
                {submitted ? (
                  <div className="text-center py-6 space-y-4">
                    <CheckCircle2 className="w-16 h-16 text-emerald-400 mx-auto" />
                    <p className="text-white font-semibold text-lg">{t("publicDowntime.submitted")}</p>
                    <p className="text-muted-foreground text-sm">{submitted}</p>
                    <Button onClick={() => setShowModal(false)} className="mt-4">{t("common.close")}</Button>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <p className="text-sm text-muted-foreground">{t("publicDowntime.description")}</p>

                    <div className="space-y-1">
                      <Label className="text-xs text-muted-foreground">{t("publicDowntime.yourName")} *</Label>
                      <Input
                        value={reportForm.reporterName}
                        onChange={e => setReportForm(f => ({ ...f, reporterName: e.target.value }))}
                        placeholder={t("publicDowntime.yourNamePlaceholder")}
                      />
                    </div>

                    <div className="space-y-1">
                      <Label className="text-xs text-muted-foreground">{t("publicDowntime.yourTeam")} *</Label>
                      <div className="grid grid-cols-3 gap-2">
                        {(["assembly", "test", "packaging"] as const).map(team => {
                          const colors = {
                            assembly: { active: "bg-blue-500/20 border-blue-500 text-blue-300", idle: "border-white/10 text-muted-foreground hover:border-white/30" },
                            test: { active: "bg-amber-500/20 border-amber-500 text-amber-300", idle: "border-white/10 text-muted-foreground hover:border-white/30" },
                            packaging: { active: "bg-emerald-500/20 border-emerald-500 text-emerald-300", idle: "border-white/10 text-muted-foreground hover:border-white/30" },
                          };
                          const isActive = reportForm.reporterTeam === team;
                          return (
                            <button
                              key={team}
                              type="button"
                              onClick={() => setReportForm(f => ({ ...f, reporterTeam: team }))}
                              className={`py-2 px-3 rounded-lg border text-xs font-semibold capitalize transition-all ${isActive ? colors[team].active : colors[team].idle}`}
                            >
                              {t(`teams.${team}`)}
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    <div className="space-y-1">
                      <Label className="text-xs text-muted-foreground">{t("publicDowntime.machineName")} *</Label>
                      <Input
                        value={reportForm.machineName}
                        onChange={e => setReportForm(f => ({ ...f, machineName: e.target.value }))}
                        placeholder={t("publicDowntime.machineNamePlaceholder")}
                      />
                    </div>

                    <div className="space-y-1">
                      <Label className="text-xs text-muted-foreground flex items-center gap-1">
                        <QrCode className="w-3 h-3" />
                        {t("publicDowntime.qrCode")}
                      </Label>
                      <div className="flex gap-2">
                        <Input
                          value={reportForm.machineCode}
                          onChange={e => setReportForm(f => ({ ...f, machineCode: e.target.value }))}
                          placeholder={t("publicDowntime.qrCodePlaceholder")}
                          className="font-mono flex-1"
                        />
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => setShowScanner(true)}
                          className="shrink-0 gap-1.5 px-3"
                        >
                          <Camera className="w-4 h-4" />
                          {t("common.scan")}
                        </Button>
                      </div>
                    </div>

                    <div className="space-y-1">
                      <Label className="text-xs text-muted-foreground">{t("common.line")} *</Label>
                      <Select
                        value={reportForm.lineId}
                        onChange={e => setReportForm(f => ({ ...f, lineId: e.target.value }))}
                      >
                        {lines.map(l => (
                          <option key={l.id} value={l.id}>
                            {l.name}{l.team ? ` (${l.team})` : ""}
                          </option>
                        ))}
                      </Select>
                    </div>

                    {reportError && (
                      <p className="text-red-400 text-sm">{reportError}</p>
                    )}

                    <div className="flex gap-2 pt-2">
                      <Button variant="outline" onClick={() => setShowModal(false)} className="flex-1">
                        {t("common.cancel")}
                      </Button>
                      <Button
                        onClick={submitReport}
                        disabled={submitting}
                        className="flex-1 bg-red-500 hover:bg-red-600 text-white"
                      >
                        {submitting ? t("common.loading") : t("publicDowntime.submit")}
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
