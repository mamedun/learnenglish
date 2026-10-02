export function registerServiceWorker() {
  if (typeof window !== "undefined" && "serviceWorker" in navigator) {
    window.addEventListener("load", () => {
      // In Vite, import.meta.env.BASE_URL handles subpaths like /learnenglish/
      const baseUrl = import.meta.env.BASE_URL || "/";
      const swUrl = `${baseUrl.endsWith("/") ? baseUrl : baseUrl + "/"}sw.js`;
      navigator.serviceWorker
        .register(swUrl)
        .then((registration) => {
          registration.onupdatefound = () => {
            const installingWorker = registration.installing;
            if (installingWorker) {
              installingWorker.onstatechange = () => {
                if (
                  installingWorker.state === "installed" &&
                  navigator.serviceWorker.controller
                ) {
                  // New version available
                  console.info("SpeakUp update available.");
                }
              };
            }
          };
        })
        .catch((error) => {
          console.warn("SpeakUp PWA Service Worker registration failed:", error);
        });
    });
  }
}
