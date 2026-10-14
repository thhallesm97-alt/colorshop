import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App.jsx";
import "./index.css";

// Quando sai uma versão nova, o service worker novo assume e a página recarrega sozinha
// (antes ficava na versão antiga até fechar e abrir de novo). Também procura versão nova a cada 10 min.
if ("serviceWorker" in navigator && navigator.serviceWorker.controller) {
  let recarregou = false;
  navigator.serviceWorker.addEventListener("controllerchange", () => {
    if (recarregou) return;
    recarregou = true;
    window.location.reload();
  });
  navigator.serviceWorker.ready.then((reg) => setInterval(() => reg.update().catch(() => {}), 10 * 60 * 1000));
}

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
