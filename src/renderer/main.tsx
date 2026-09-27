import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import "./styles.css";
import { installBrowserApi } from "./browser-api";

const browserMode=installBrowserApi();
document.documentElement.dataset.runtime=browserMode?"browser":"desktop";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
