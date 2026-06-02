import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "@fontsource-variable/geist"; // self-hosted, OFL — local-first, no network
import "@fontsource-variable/geist-mono";
import "@fontsource-variable/inter"; // selectable in Settings
import "./styles/colors_and_type.css";
import "./styles/anchor.css";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
