import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import AlbumPage from "./components/AlbumPage.tsx";
import CatalogoPage from "./components/CatalogoPage.tsx";
import "./index.css";

const path = window.location.pathname;
const albumMatch = path.match(/^\/album\/([a-zA-Z0-9]+)/);

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    {path === "/catalogo" ? (
      <CatalogoPage />
    ) : albumMatch ? (
      <AlbumPage token={albumMatch[1]} />
    ) : (
      <App />
    )}
  </StrictMode>
);
