import { useState, useEffect } from "react";

let globalDeferredPrompt = null;
const listeners = new Set();

if (typeof window !== "undefined") {
  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault();
    globalDeferredPrompt = e;
    listeners.forEach((listener) => listener(globalDeferredPrompt));
  });

  window.addEventListener("appinstalled", () => {
    globalDeferredPrompt = null;
    listeners.forEach((listener) => listener(null));
  });
}

export function usePwaInstall() {
  const [deferredPrompt, setDeferredPrompt] = useState(globalDeferredPrompt);
  const [isInstalled, setIsInstalled] = useState(false);
  const [isIos, setIsIos] = useState(false);

  useEffect(() => {
    const isStandalone =
      (typeof window !== "undefined" &&
        window.matchMedia("(display-mode: standalone)").matches) ||
      (typeof navigator !== "undefined" && navigator.standalone === true);
    setIsInstalled(Boolean(isStandalone));

    const userAgent = typeof navigator !== "undefined" ? navigator.userAgent : "";
    const isIosDevice =
      /iPad|iPhone|iPod/.test(userAgent) && !window.MSStream;
    setIsIos(isIosDevice);

    const updatePrompt = (prompt) => setDeferredPrompt(prompt);
    listeners.add(updatePrompt);

    return () => {
      listeners.delete(updatePrompt);
    };
  }, []);

  const installApp = async () => {
    if (!deferredPrompt) return false;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === "accepted") {
      setDeferredPrompt(null);
      globalDeferredPrompt = null;
      return true;
    }
    return false;
  };

  return {
    canInstall: Boolean(deferredPrompt),
    isInstalled,
    isIos,
    installApp,
  };
}
