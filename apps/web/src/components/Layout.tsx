import { Outlet, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import SiteHeader from "./SiteHeader";

export default function Layout() {
  const location = useLocation();
  const { user } = useAuth();
  const isEditor = location.pathname.startsWith("/editor");

  const searchParams = new URLSearchParams(location.search);
  const view = searchParams.get("view");
  const hasVisited = typeof window !== "undefined" && localStorage.getItem("typeclub_visited") === "true";
  const isLanding =
    location.pathname === "/landing" ||
    (location.pathname === "/" && (view === "landing" || (!user && !hasVisited && view !== "home")));

  return (
    <div className="min-h-screen flex flex-col">
      {!isEditor && !isLanding && <SiteHeader />}

      <main className="flex-1">
        <Outlet />
      </main>

      {!isEditor && !isLanding && (
        <footer className="border-t border-gray-200 dark:border-gray-800 py-6 text-center text-sm text-gray-500">
          <div className="max-w-6xl mx-auto px-4">
            Type Club — Seamless Markdown Editor. Built for writers.
          </div>
        </footer>
      )}
    </div>
  );
}
