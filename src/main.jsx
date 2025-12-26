import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App.jsx";
import "./index.css";
import { BrowserRouter } from "react-router-dom";
import { AuthProvider } from "./context/AuthContext";

// Suppress MetaMask extension errors (not used in this app)
window.addEventListener("error", (event) => {
  if (
    event.message?.includes("MetaMask") ||
    event.message?.includes("Failed to connect to MetaMask") ||
    event.message?.includes("MetaMask extension not found") ||
    event.filename?.includes("inpage.js")
  ) {
    event.preventDefault();
    return true;
  }
});

// Suppress MetaMask promise rejections
window.addEventListener("unhandledrejection", (event) => {
  if (
    event.reason?.message?.includes("MetaMask") ||
    event.reason?.message?.includes("Failed to connect to MetaMask") ||
    event.reason?.message?.includes("MetaMask extension not found") ||
    (typeof event.reason === "string" && event.reason.includes("MetaMask"))
  ) {
    event.preventDefault();
    return true;
  }
  
  // Log other unhandled rejections in development
  if (import.meta.env.DEV) {
    console.error("Unhandled promise rejection:", event.reason);
  }
});

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <App />
      </AuthProvider>
    </BrowserRouter>
  </React.StrictMode>
);
