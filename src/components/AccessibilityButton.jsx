import React, { useEffect, useRef, useState } from "react";
import { FaWheelchair } from "react-icons/fa";

const STORAGE_KEY = "admin-accessibility-preferences-v2";
const STYLE_ID = "admin-accessibility-styles";
const NORMAL_CONTRAST = "normal";
const LIGHT_CONTRAST = "light";
const DEFAULT_FONT_SIZE = 100;

const AccessibilityButton = () => {
  const [fontSize, setFontSize] = useState(DEFAULT_FONT_SIZE);
  const [contrast, setContrast] = useState(NORMAL_CONTRAST);
  const [dyslexiaFont, setDyslexiaFont] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const panelRef = useRef(null);
  const buttonRef = useRef(null);
  const hasAccessibilityOverrides =
    fontSize !== DEFAULT_FONT_SIZE ||
    contrast !== NORMAL_CONTRAST ||
    dyslexiaFont;

  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (!saved) return;

    try {
      const parsed = JSON.parse(saved);
      setFontSize(parsed?.fontSize ?? DEFAULT_FONT_SIZE);
      setContrast(parsed?.contrast ?? NORMAL_CONTRAST);
      setDyslexiaFont(parsed?.dyslexiaFont ?? false);
    } catch {
      // Ignore invalid saved data
    }
  }, []);

  useEffect(() => {
    const root = document.documentElement;
    document.body.classList.toggle("light-contrast", contrast === LIGHT_CONTRAST);
    document.body.classList.toggle("dyslexia-font", dyslexiaFont);

    if (fontSize !== DEFAULT_FONT_SIZE) {
      root.style.fontSize = `${fontSize}%`;
    } else {
      root.style.removeProperty("font-size");
    }

    if (hasAccessibilityOverrides) {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({ fontSize, contrast, dyslexiaFont })
      );
    } else {
      localStorage.removeItem(STORAGE_KEY);
    }
  }, [contrast, dyslexiaFont, fontSize, hasAccessibilityOverrides]);

  useEffect(() => {
    document.getElementById(STYLE_ID)?.remove();
    if (
      contrast !== LIGHT_CONTRAST &&
      !dyslexiaFont
    ) {
      return undefined;
    }

    const style = document.createElement("style");
    style.id = STYLE_ID;
    style.textContent = `
      body.light-contrast {
        background: #ffffff !important;
        color: #000000 !important;
      }
      body.light-contrast *:not(.accessibility-tools *) {
        color: #000000 !important;
        border-color: #000000 !important;
        text-shadow: none !important;
        box-shadow: none !important;
      }
      body.light-contrast a:not(.accessibility-tools a) {
        color: #0033cc !important;
        text-decoration: underline !important;
      }
      body.light-contrast button:not(.accessibility-tools button):not([aria-disabled="true"]),
      body.light-contrast [role="button"]:not(.accessibility-tools [role="button"]) {
        background: #000000 !important;
        color: #ffffff !important;
        border: 2px solid #000000 !important;
      }
      body.light-contrast button:disabled:not(.accessibility-tools button) {
        background: #666666 !important;
        color: #ffffff !important;
        border: 2px solid #666666 !important;
      }
      body.light-contrast input:not(.accessibility-tools input),
      body.light-contrast select:not(.accessibility-tools select),
      body.light-contrast textarea:not(.accessibility-tools textarea) {
        background: #ffffff !important;
        color: #000000 !important;
        border: 2px solid #000000 !important;
      }
      body.dyslexia-font *:not(.accessibility-tools *) {
        font-family: "Comic Sans MS", "Arial", sans-serif !important;
        letter-spacing: 0.05em !important;
        word-spacing: 0.1em !important;
        line-height: 1.5 !important;
      }
    `;

    document.head.appendChild(style);

    return () => {
      document.getElementById(STYLE_ID)?.remove();
    };
  }, [contrast, dyslexiaFont]);

  useEffect(() => {
    if (!isOpen) return undefined;

    const handleKeyDown = (event) => {
      if (event.key === "Escape") setIsOpen(false);
    };

    const handleOutsideClick = (event) => {
      if (!panelRef.current) return;
      if (
        !panelRef.current.contains(event.target) &&
        !buttonRef.current?.contains(event.target)
      ) {
        setIsOpen(false);
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    document.addEventListener("mousedown", handleOutsideClick);

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.removeEventListener("mousedown", handleOutsideClick);
    };
  }, [isOpen]);

  useEffect(() => {
    return () => {
      document.body.classList.remove("light-contrast", "dyslexia-font");
      document.documentElement.style.removeProperty("font-size");
      document.getElementById(STYLE_ID)?.remove();
    };
  }, []);

  const canIncrease = fontSize < 150;
  const canDecrease = fontSize > 80;

  const increaseFontSize = () => {
    if (canIncrease) setFontSize((value) => value + 10);
  };

  const decreaseFontSize = () => {
    if (canDecrease) setFontSize((value) => value - 10);
  };

  const toggleContrast = () => {
    setContrast((value) =>
      value === NORMAL_CONTRAST ? LIGHT_CONTRAST : NORMAL_CONTRAST
    );
  };

  const resetAccessibility = () => {
    setFontSize(DEFAULT_FONT_SIZE);
    setContrast(NORMAL_CONTRAST);
    setDyslexiaFont(false);
    localStorage.removeItem(STORAGE_KEY);
  };

  return (
    <div
      className="accessibility-tools"
      style={{
        position: "fixed",
        bottom: "16px",
        left: "16px",
        zIndex: 10000,
      }}
    >
      <button
        ref={buttonRef}
        type="button"
        aria-label={isOpen ? "Close accessibility tools" : "Open accessibility tools"}
        aria-expanded={isOpen}
        aria-controls="accessibility-panel"
        onClick={() => setIsOpen((value) => !value)}
        style={{
          height: 44,
          width: 44,
          borderRadius: "12px",
          border: "none",
          background: "#ff6b35",
          color: "white",
          fontSize: 20,
          cursor: "pointer",
          boxShadow: "0 4px 6px rgba(255, 107, 53, 0.3)",
          display: "grid",
          placeItems: "center",
          transform: isOpen ? "rotate(15deg) scale(1.02)" : "none",
          transition: "transform .2s ease, box-shadow .2s ease, background .2s ease",
        }}
      >
        <FaWheelchair size={20} color="white" />
      </button>

      {isOpen && (
        <div
          id="accessibility-panel"
          ref={panelRef}
          role="dialog"
          aria-label="Accessibility tools"
          style={{
            position: "absolute",
            bottom: 56,
            left: 0,
            background: "rgba(255,255,255,0.98)",
            borderRadius: 12,
            padding: 10,
            boxShadow: "0 10px 28px rgba(0,0,0,0.2)",
            border: "1px solid rgba(0,0,0,0.08)",
            backdropFilter: "blur(10px)",
            minWidth: 220,
          }}
        >
          <div
            style={{
              display: "flex",
              gap: 8,
              flexDirection: "row",
              alignItems: "center",
            }}
          >
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: 4,
              }}
            >
              <button
                type="button"
                style={{
                  padding: "4px 8px",
                  border: "none",
                  borderRadius: 4,
                  background: "#f8f9fa",
                  color: "#333",
                  cursor: canIncrease ? "pointer" : "not-allowed",
                  fontSize: 12,
                  fontWeight: "bold",
                  minWidth: 30,
                  opacity: canIncrease ? 1 : 0.45,
                }}
                onClick={increaseFontSize}
                disabled={!canIncrease}
                title="Increase font size"
              >
                +
              </button>

              <div style={{ fontSize: 10, fontWeight: "bold", textAlign: "center" }}>
                <div style={{ fontSize: 16, fontWeight: "bold" }}>Aa</div>
                <div style={{ fontWeight: 500, fontSize: 10 }}>Font Size</div>
                <div style={{ fontSize: 8, color: "#666" }}>{fontSize}%</div>
              </div>

              <button
                type="button"
                style={{
                  padding: "4px 8px",
                  border: "none",
                  borderRadius: 4,
                  background: "#f8f9fa",
                  color: "#333",
                  cursor: canDecrease ? "pointer" : "not-allowed",
                  fontSize: 12,
                  fontWeight: "bold",
                  minWidth: 30,
                  opacity: canDecrease ? 1 : 0.45,
                }}
                onClick={decreaseFontSize}
                disabled={!canDecrease}
                title="Decrease font size"
              >
                -
              </button>
            </div>

            <button
              type="button"
              onClick={toggleContrast}
              aria-pressed={contrast !== NORMAL_CONTRAST}
              title={`Contrast mode: ${contrast}`}
              style={{
                display: "flex",
                alignItems: "center",
                flexDirection: "column",
                gap: 4,
                padding: "8px 12px",
                border: "none",
                borderRadius: 8,
                background: contrast !== NORMAL_CONTRAST ? "#007bff" : "#f8f9fa",
                color: contrast !== NORMAL_CONTRAST ? "white" : "#333",
                cursor: "pointer",
                fontSize: 12,
                textAlign: "center",
                minWidth: 70,
              }}
            >
              <span style={{ fontSize: 16, fontWeight: "bold" }}>C</span>
              <span style={{ fontWeight: 500, fontSize: 10 }}>Contrast</span>
              <span style={{ fontSize: 10, opacity: 0.8 }}>
                {contrast === LIGHT_CONTRAST ? "L" : "N"}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setDyslexiaFont((value) => !value)}
              aria-pressed={dyslexiaFont}
              title={`Dyslexia Font: ${dyslexiaFont ? "Enabled" : "Disabled"}`}
              style={{
                display: "flex",
                alignItems: "center",
                flexDirection: "column",
                gap: 4,
                padding: "8px 12px",
                border: "none",
                borderRadius: 8,
                background: dyslexiaFont ? "#007bff" : "#f8f9fa",
                color: dyslexiaFont ? "white" : "#333",
                cursor: "pointer",
                fontSize: 12,
                textAlign: "center",
                minWidth: 70,
              }}
            >
              <span style={{ fontSize: 16, fontWeight: "bold" }}>Df</span>
              <span style={{ fontWeight: 500, fontSize: 10 }}>Dyslexia</span>
            </button>
          </div>

          <button
            type="button"
            onClick={resetAccessibility}
            style={{
              marginTop: 8,
              width: "100%",
              border: "1px solid #d1d5db",
              borderRadius: 8,
              background: "#ffffff",
              color: "#111827",
              fontSize: 12,
              fontWeight: 600,
              padding: "6px 10px",
              cursor: "pointer",
            }}
          >
            Reset View
          </button>
        </div>
      )}
    </div>
  );
};

export default AccessibilityButton;
