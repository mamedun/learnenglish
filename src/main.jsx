import React from "react";
import ReactDOM from "react-dom/client";
import { Toaster } from "sonner";
import { HashRouter } from "react-router-dom";
import App from "./app/App";
import { registerServiceWorker } from "./registerServiceWorker";
import "./styles.css";
import "./overrides.css";
import "./theme.css";

registerServiceWorker();

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <HashRouter>
      <App />
      <Toaster position="top-right" richColors closeButton />
    </HashRouter>
  </React.StrictMode>,
);
