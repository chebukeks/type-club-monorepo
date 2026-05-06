import { Outlet, useLocation } from "react-router-dom";
import SiteHeader from "./SiteHeader";

export default function Layout() {
  const location = useLocation();
  const isEditor = location.pathname.startsWith("/editor");

  return (
    <div className="min-h-screen flex flex-col">
      {!isEditor && <SiteHeader />}

      <main className="flex-1">
        <Outlet />
      </main>

      {!isEditor && (
        <footer className="border-t border-gray-200 dark:border-gray-800 py-6 text-center text-sm text-gray-500">
          <div className="max-w-6xl mx-auto px-4">
            Type Club — Seamless Markdown Editor. Built for writers.
          </div>
        </footer>
      )}
    </div>
  );
}
