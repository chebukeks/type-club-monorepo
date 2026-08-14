import { useEffect, useState } from "react";
import { Download, Monitor, Terminal, Apple, GitBranch, Clock } from "lucide-react";
import { useLanguage } from "../context/LanguageContext";

interface FileInfo {
  file: string;
  size: number;
}

interface PlatformInfo {
  installer?: FileInfo;
  portable?: FileInfo;
  appimage?: FileInfo;
  dmg?: FileInfo;
}

interface Manifest {
  version: string;
  releaseDate: string;
  platforms: {
    windows: PlatformInfo | null;
    linux: PlatformInfo | null;
    macos: PlatformInfo | null;
  };
}

function formatSize(bytes: number): string {
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(0) + " KB";
  return (bytes / (1024 * 1024)).toFixed(1) + " MB";
}

function DownloadCard({
  icon,
  title,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-gray-200 dark:border-gray-700 p-6 flex flex-col">
      <div className="flex items-center gap-3 mb-4">
        <div className="text-blue-600">{icon}</div>
        <h2 className="text-xl font-bold">{title}</h2>
      </div>
      <div className="flex-1 space-y-3">{children}</div>
    </div>
  );
}

function DownloadButton({ file, label }: { file: FileInfo; label?: string }) {
  return (
    <a
      href={`/downloads/${file.file}`}
      className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 transition-colors"
    >
      <Download size={14} /> {label || file.file}
      <span className="text-blue-200 text-xs ml-1">
        ({formatSize(file.size)})
      </span>
    </a>
  );
}

function ComingSoon({ detail }: { detail: string }) {
  return (
    <div className="text-gray-400 dark:text-gray-500 flex items-center gap-2 text-sm">
      <Clock size={14} />
      {detail}
    </div>
  );
}

export default function DownloadPage() {
  const { t } = useLanguage();
  const [manifest, setManifest] = useState<Manifest | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    fetch("/downloads/latest.json")
      .then((r) => {
        if (!r.ok) throw new Error("not found");
        return r.json();
      })
      .then(setManifest)
      .catch(() => setError(true));
  }, []);

  return (
    <div className="max-w-6xl mx-auto px-4 py-8 md:py-12">
      <h1 className="text-3xl md:text-4xl font-bold mb-2">{t('download.title')}</h1>
      {manifest && (
        <p className="text-gray-500 dark:text-gray-400 mb-8">
          {t('download.versionDate', { version: manifest.version, date: manifest.releaseDate })}
        </p>
      )}
      {error && (
        <p className="text-gray-500 dark:text-gray-400 mb-8">
          {t('download.noRelease')}
        </p>
      )}

      <div className="grid gap-6 md:grid-cols-2">
        {/* Windows */}
        <DownloadCard icon={<Monitor size={28} />} title={t('download.windows')}>
          {manifest?.platforms.windows ? (
            <div className="flex flex-wrap gap-2">
              {manifest.platforms.windows.installer && (
                <DownloadButton
                  file={manifest.platforms.windows.installer}
                  label={t('download.setupExe')}
                />
              )}
              {manifest.platforms.windows.portable && (
                <DownloadButton
                  file={manifest.platforms.windows.portable}
                  label={t('download.portableZip')}
                />
              )}
            </div>
          ) : (
            <ComingSoon detail={t('download.comingSoon')} />
          )}
        </DownloadCard>

        {/* Linux */}
        <DownloadCard icon={<Terminal size={28} />} title={t('download.linux')}>
          {manifest?.platforms.linux?.appimage ? (
            <div className="space-y-3">
              <DownloadButton
                file={manifest.platforms.linux.appimage}
                label={t('download.appImage')}
              />
              <p className="text-xs text-gray-400 dark:text-gray-500">
                {t('download.linuxInstruction')}
              </p>
            </div>
          ) : (
            <ComingSoon detail={t('download.comingSoon')} />
          )}
        </DownloadCard>

        {/* macOS */}
        <DownloadCard icon={<Apple size={28} />} title={t('download.macos')}>
          <ComingSoon detail={t('download.comingSoon')} />
        </DownloadCard>

        {/* GitHub */}
        <DownloadCard icon={<GitBranch size={28} />} title={t('download.sourceCode')}>
          <ComingSoon detail={t('download.comingSoon')} />
        </DownloadCard>
      </div>
    </div>
  );
}
