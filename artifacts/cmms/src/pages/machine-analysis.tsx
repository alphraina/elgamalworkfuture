import { useState, useRef } from "react";
import { Button } from "@/components/ui";
import { Cpu, ExternalLink, Maximize2 } from "lucide-react";
import { useTranslation } from "react-i18next";

const TOOL_URL = "https://oppo-analysis.replit.app";

export default function MachineAnalysis() {
  const { t } = useTranslation();
  const [fullscreen, setFullscreen] = useState(false);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  return (
    <div className={
      fullscreen
        ? "fixed inset-0 z-50 flex flex-col bg-background"
        : "flex flex-col"
      }
      style={fullscreen ? {} : { height: "calc(100vh - 80px)" }}
    >
      <div className="flex items-center justify-between px-4 py-2 bg-card border-b border-white/5 flex-shrink-0">
        <div className="flex items-center gap-2">
          <Cpu className="w-4 h-4 text-primary" />
          <span className="text-sm font-semibold text-white">{t("machineAnalysis.title")}</span>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            className="gap-1.5 text-muted-foreground text-xs"
            onClick={() => window.open(TOOL_URL, "_blank")}
          >
            <ExternalLink className="w-3.5 h-3.5" />
            {t("machineAnalysis.openTab")}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="gap-1.5 text-muted-foreground text-xs"
            onClick={() => setFullscreen(f => !f)}
          >
            <Maximize2 className="w-3.5 h-3.5" />
            {fullscreen ? t("machineAnalysis.exitFullscreen") : t("machineAnalysis.fullscreen")}
          </Button>
        </div>
      </div>

      <iframe
        ref={iframeRef}
        src={TOOL_URL}
        className="flex-1 w-full border-0"
        allow="clipboard-write"
        title="Midea Machine Analysis Tool"
      />
    </div>
  );
}
