import { useEffect, useState } from "react";
import { useSearchParams, Link } from "react-router-dom";
import { authApi } from "../api";
import { useLanguage } from "../context/LanguageContext";

export default function VerifyEmail() {
  const { t } = useLanguage();
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token");
  const [status, setStatus] = useState<"loading" | "success" | "error">("loading");
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (!token) {
      setStatus("error");
      setMessage(t('auth.noVerificationToken'));
      return;
    }
    authApi.verifyEmail(token).then((res) => {
      setStatus("success");
      setMessage(res.message);
    }).catch((err) => {
      setStatus("error");
      setMessage(err.message || t('auth.verificationFailed'));
    });
  }, [token, t]);

  return (
    <div className="max-w-md mx-auto px-4 py-20 text-center">
      {status === "loading" && (
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto" />
      )}
      {status === "success" && (
        <>
          <h1 className="text-2xl font-bold mb-4 text-green-600">{t('auth.emailVerified')}</h1>
          <p className="text-gray-500 dark:text-gray-400 mb-6">{message}</p>
          <Link to="/login" className="inline-block px-6 py-3 rounded-xl bg-blue-600 text-white font-semibold hover:bg-blue-700">
            {t('auth.login')}
          </Link>
        </>
      )}
      {status === "error" && (
        <>
          <h1 className="text-2xl font-bold mb-4 text-red-600">{t('auth.verificationFailed')}</h1>
          <p className="text-gray-500 dark:text-gray-400 mb-6">{message}</p>
          <Link to="/" className="text-blue-600 hover:underline">{t('auth.goHome')}</Link>
        </>
      )}
    </div>
  );
}
