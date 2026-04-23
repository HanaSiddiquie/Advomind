import Navbar from "./Navbar";

function Layout({ children }) {
  return (
    <div style={wrapper}>
      <div style={sidebar}>
        <Navbar />
      </div>

      <div style={main}>
        {children}
      </div>
    </div>
  );
}

const wrapper = {
  display: "flex",
  minHeight: "100vh"
};

const sidebar = {
  width: "240px",
  flexShrink: 0,
  background: "#111",
  height: "100vh"
};

const main = {
  flex: 1,
  padding: "20px",
  background: "#f5f6fa"
};

export default Layout;