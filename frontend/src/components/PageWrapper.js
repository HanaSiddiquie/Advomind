function PageWrapper({ title, children }) {
  return (
    <div style={{ padding: "25px", background: "#f5f6fa", minHeight: "100vh" }}>
      <h2 style={{ marginBottom: "20px" }}>{title}</h2>
      {children}
    </div>
  );
}

export default PageWrapper;