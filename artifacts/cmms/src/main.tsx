import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";
import "./i18n/index";
import { applyLangToDoc } from "./i18n/index";
import i18n from "./i18n/index";

applyLangToDoc(i18n.language);

createRoot(document.getElementById("root")!).render(<App />);
