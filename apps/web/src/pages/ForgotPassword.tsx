import { useState } from "react";
import { Link } from "react-router-dom";
import { authApi } from "../api";

export default function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await authApi.forgotPassword(email);
      setSent(true);
    } catch (err: any) {
      setError(err.message || "Request failed");
    } finally {
      setLoading(false);
    }
  };

  if (sent) {
    return (
      <div className="max-w-md mx-auto px-4 py-20 text-center">
        <h1 className="text-2xl font-bold mb-4">Check Your Email</h1>
        <p className="text-gray-500 dark:text-gray-400 mb-6">
          If an account with that email exists, we've sent a password reset link.
        </p>
        <Link to="/login" className="text-blue-600 hover:underline">Back to Sign In</Link>
      </div>
    );
  }

  return (
    <div className="max-w-md mx-auto px-4 py-20">
      <h1 className="text-3xl font-bold mb-2 text-center">Forgot Password</h1>
      <p className="text-center text-gray-500 dark:text-gray-400 mb-8 text-sm">
        Enter your email and we'll send you a reset link.
      </p>
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && <div className="p-3 rounded-lg bg-red-50 dark:bg-red-950 text-red-600 text-sm">{error}</div>}
        <div>
          <label className="block text-sm font-medium mb-1">Email</label>
          <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)}
            className="w-full px-4 py-2.5 rounded-xl border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500" />
        </div>
        <button type="submit" disabled={loading}
          className="w-full py-2.5 rounded-xl bg-blue-600 text-white font-semibold hover:bg-blue-700 disabled:opacity-50 transition-colors">
          {loading ? "Sending..." : "Send Reset Link"}
        </button>
      </form>
      <p className="text-center mt-6 text-sm text-gray-500">
        <Link to="/login" className="text-blue-600 hover:underline">Back to Sign In</Link>
      </p>
    </div>
  );
}
