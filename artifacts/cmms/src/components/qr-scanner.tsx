import { useEffect, useRef, useState, useCallback } from "react";
import jsQR from "jsqr";
import { X, Camera, Loader2 } from "lucide-react";
import { Button } from "./ui";

interface QRScannerProps {
  onScan: (result: string) => void;
  onClose: () => void;
  label?: string;
}

export function QRScanner({ onScan, onClose, label }: QRScannerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef<number>(0);
  const [status, setStatus] = useState<"starting" | "scanning" | "error">("starting");
  const [errorMsg, setErrorMsg] = useState("");

  const stopCamera = useCallback(() => {
    cancelAnimationFrame(rafRef.current);
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  }, []);

  const tick = useCallback(() => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas || video.readyState !== video.HAVE_ENOUGH_DATA) {
      rafRef.current = requestAnimationFrame(tick);
      return;
    }
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const code = jsQR(imageData.data, imageData.width, imageData.height, {
      inversionAttempts: "dontInvert",
    });
    if (code) {
      stopCamera();
      onScan(code.data);
      return;
    }
    rafRef.current = requestAnimationFrame(tick);
  }, [onScan, stopCamera]);

  useEffect(() => {
    let cancelled = false;
    navigator.mediaDevices
      .getUserMedia({ video: { facingMode: "environment" } })
      .then((stream) => {
        if (cancelled) { stream.getTracks().forEach((t) => t.stop()); return; }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.play();
        }
        setStatus("scanning");
        rafRef.current = requestAnimationFrame(tick);
      })
      .catch((err) => {
        if (!cancelled) {
          setStatus("error");
          setErrorMsg(err.message ?? "Camera access denied");
        }
      });
    return () => {
      cancelled = true;
      stopCamera();
    };
  }, [tick, stopCamera]);

  const handleClose = () => {
    stopCamera();
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[9999] bg-black/90 flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-sm bg-card border border-white/10 rounded-2xl overflow-hidden shadow-2xl">
        <div className="flex items-center justify-between px-4 py-3 border-b border-white/10">
          <div className="flex items-center gap-2">
            <Camera className="w-4 h-4 text-primary" />
            <span className="text-sm font-semibold text-white">{label ?? "Scan Machine QR Code"}</span>
          </div>
          <button onClick={handleClose} className="text-muted-foreground hover:text-white transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="relative aspect-square bg-black flex items-center justify-center">
          {status === "starting" && (
            <div className="flex flex-col items-center gap-3 text-muted-foreground">
              <Loader2 className="w-8 h-8 animate-spin" />
              <span className="text-sm">Starting camera…</span>
            </div>
          )}
          {status === "error" && (
            <div className="flex flex-col items-center gap-3 px-6 text-center">
              <Camera className="w-8 h-8 text-destructive" />
              <p className="text-sm text-destructive font-medium">Camera unavailable</p>
              <p className="text-xs text-muted-foreground">{errorMsg}</p>
            </div>
          )}
          <video
            ref={videoRef}
            className={`w-full h-full object-cover ${status === "scanning" ? "block" : "hidden"}`}
            playsInline
            muted
          />
          {status === "scanning" && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="w-48 h-48 border-2 border-primary rounded-lg relative">
                <span className="absolute -top-1 -left-1 w-4 h-4 border-t-2 border-l-2 border-primary rounded-tl" />
                <span className="absolute -top-1 -right-1 w-4 h-4 border-t-2 border-r-2 border-primary rounded-tr" />
                <span className="absolute -bottom-1 -left-1 w-4 h-4 border-b-2 border-l-2 border-primary rounded-bl" />
                <span className="absolute -bottom-1 -right-1 w-4 h-4 border-b-2 border-r-2 border-primary rounded-br" />
                <div className="absolute top-0 left-0 right-0 h-0.5 bg-primary/70 animate-scan" />
              </div>
            </div>
          )}
        </div>

        <canvas ref={canvasRef} className="hidden" />

        <div className="px-4 py-3 text-center">
          <p className="text-xs text-muted-foreground">Point the camera at the machine QR code</p>
          <Button variant="ghost" size="sm" onClick={handleClose} className="mt-2 text-muted-foreground">
            Cancel
          </Button>
        </div>
      </div>
    </div>
  );
}
