// frontend/src/styles/theme.js

// =========================================================
// ADVOMIND DESIGN TOKENS
// A law-office palette: ink, paper, and a single brass-burgundy
// accent used sparingly for primary actions and status.
// Every shared component and page should pull from here rather
// than defining its own one-off colors/spacing.
// =========================================================

export const colors = {
  ink: "#1A1A1D",
  charcoal: "#3A3D42",
  slate: "#6B6F76",
  hairline: "#E3E5E8",
  paper: "#F7F7F5",
  surface: "#FFFFFF",

  accent: "#7A2E33",
  accentHover: "#611F24",
  accentSoft: "#F4E8E9",

  danger: "#B3261E",
  dangerSoft: "#FBEAE9",
  success: "#2E5339",
  successSoft: "#E9F1EC",

  white: "#FFFFFF"
};

export const font = {
  display: "'Source Serif 4', 'Georgia', serif",
  body: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif"
};

export const radius = {
  sm: "6px",
  md: "10px",
  lg: "14px"
};

export const shadow = {
  sm: "0 1px 2px rgba(26,26,29,0.06)",
  md: "0 6px 20px rgba(26,26,29,0.08)",
  lg: "0 16px 40px rgba(26,26,29,0.12)"
};

export const space = function (n) {
  return (n * 4) + "px";
};

const theme = { colors: colors, font: font, radius: radius, shadow: shadow, space: space };

export default theme;