function Card({ children }) {
  return (
    <div
      style={{
        background: "white",
        borderRadius: "14px",
        padding: "16px",
        boxShadow: "0 4px 12px rgba(0,0,0,0.08)",
        border: "1px solid #eee"
      }}
    >
      {children}
    </div>
  );
}

export default Card;