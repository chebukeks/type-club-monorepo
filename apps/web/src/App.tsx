import { Routes, Route, Navigate } from "react-router-dom";
import { useAuth } from "./context/AuthContext";
import Layout from "./components/Layout";
import Landing from "./pages/Landing";
import Login from "./pages/Login";
import Register from "./pages/Register";
import Profile from "./pages/Profile";
import Articles from "./pages/Articles";
import MyArticles from "./pages/MyArticles";
import Editor from "./pages/Editor";
import ReadArticle from "./pages/ReadArticle";
import Download from "./pages/Download";
import VerifyEmail from "./pages/VerifyEmail";
import ForgotPassword from "./pages/ForgotPassword";
import ResetPassword from "./pages/ResetPassword";
import JoinPage from "./pages/JoinPage";

function Protected({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="flex items-center justify-center min-h-screen"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 dark:border-white" /></div>;
  if (!user) return <Navigate to="/login" />;
  return <>{children}</>;
}

export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route path="/" element={<Landing />} />
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/profile" element={<Protected><Profile /></Protected>} />
        <Route path="/articles" element={<Articles />} />
        <Route path="/my-articles" element={<Protected><MyArticles /></Protected>} />
        <Route path="/editor" element={<Protected><Editor /></Protected>} />
        <Route path="/editor/:id" element={<Protected><Editor /></Protected>} />
        <Route path="/download" element={<Download />} />
        <Route path="/verify-email" element={<VerifyEmail />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="/reset-password" element={<ResetPassword />} />
        <Route path="/join/:token" element={<JoinPage />} />
        <Route path="/:username/:slug" element={<ReadArticle />} />
        <Route path="*" element={<Navigate to="/" />} />
      </Route>
    </Routes>
  );
}
