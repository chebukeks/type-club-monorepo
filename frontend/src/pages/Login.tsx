import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await login(email, password);
      navigate("/");
    } catch (err: any) {
      setError(err.message || "Login failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-md mx-auto px-4 py-20">
      <h1 className="text-3xl font-bold mb-8 text-center">Sign In</h1>
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && <div className="p-3 rounded-lg bg-red-50 dark:bg-red-950 text-red-600 text-sm">{error}</div>}
        <div>
          <label className="block text-sm font-medium mb-1">Email</label>
          <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)}
            className="w-full px-4 py-2.5 rounded-xl border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500" />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Password</label>
          <input type="password" required value={password} onChange={(e) => setPassword(e.target.value)}
            className="w-full px-4 py-2.5 rounded-xl border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500" />
        </div>
        <button type="submit" disabled={loading}
          className="w-full py-2.5 rounded-xl bg-blue-600 text-white font-semibold hover:bg-blue-700 disabled:opacity-50 transition-colors">
          {loading ? "Signing in..." : "Sign In"}
        </button>
      </form>
      <p className="text-center mt-6 text-sm text-gray-500">
        Don't have an account?{" "}
        <Link to="/register" className="text-blue-600 hover:underline">Register</Link>
      </p>
    </div>
  );
}
