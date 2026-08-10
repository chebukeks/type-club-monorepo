import { useState, useEffect, useRef, useCallback } from 'react';
import { collaborationApi, type Collaborator } from '../api';
import { UserAutocompleteInput } from './UserAutocompleteInput';
import { X, Copy, Check, Trash2, Link } from 'lucide-react';

interface Props {
  articleId: number;
  onClose: () => void;
}

export function CollaborationModal({ articleId, onClose }: Props) {
  const [editors, setEditors] = useState<Collaborator[]>([]);
  const [coauthors, setCoauthors] = useState<Collaborator[]>([]);
  const [editorLink, setEditorLink] = useState('');
  const [coauthorLink, setCoauthorLink] = useState('');
  const [copiedRole, setCopiedRole] = useState<string | null>(null);
  const [error, setError] = useState('');

  const overlayMouseDownRef = useRef(false);

  const handleOverlayMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    overlayMouseDownRef.current = (e.target === e.currentTarget);
  };

  const handleOverlayClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget && overlayMouseDownRef.current) {
      onClose();
    }
    overlayMouseDownRef.current = false;
  };

  const fetchCollaborators = useCallback(async () => {
    try {
      const data = await collaborationApi.list(articleId);
      setEditors(data.filter((c) => c.role === 'editor'));
      setCoauthors(data.filter((c) => c.role === 'co_author'));
    } catch (e: any) {
      setError(e.message || 'Ошибка загрузки соавторов');
    }
  }, [articleId]);

  useEffect(() => {
    fetchCollaborators();
  }, [fetchCollaborators]);

  const handleInvite = async (nickname: string, role: 'editor' | 'co_author') => {
    setError('');
    try {
      await collaborationApi.invite(articleId, nickname, role);
      await fetchCollaborators();
    } catch (e: any) {
      setError(e.message || 'Не удалось пригласить пользователя');
    }
  };

  const handleRemove = async (userId: number) => {
    setError('');
    try {
      await collaborationApi.remove(articleId, userId);
      await fetchCollaborators();
    } catch (e: any) {
      setError(e.message || 'Не удалось удалить пользователя');
    }
  };

  const handleGenerateLink = async (role: 'editor' | 'co_author') => {
    setError('');
    try {
      const res = await collaborationApi.generateLink(articleId, role);
      if (role === 'editor') setEditorLink(res.url);
      else setCoauthorLink(res.url);
    } catch (e: any) {
      setError(e.message || 'Не удалось создать ссылку');
    }
  };

  const copyToClipboard = (text: string, roleKey: string) => {
    navigator.clipboard.writeText(text);
    setCopiedRole(roleKey);
    setTimeout(() => setCopiedRole(null), 2000);
  };

  const memberList = (members: Collaborator[]) => members.map((c) => (
    <div
      key={c.user_id}
      className="flex items-center justify-between rounded-lg hover:bg-[var(--bg-hover)] text-xs text-[var(--text-primary)] transition-colors"
      style={{ padding: '6px 10px' }}
    >
      <span className="font-medium">{c.nickname}</span>
      <button
        onClick={() => handleRemove(c.user_id)}
        className="rounded-md hover:bg-red-500/10 text-[var(--text-dim)] hover:text-red-500 transition-colors"
        style={{ padding: '4px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
        title="Удалить"
      >
        <Trash2 size={14} />
      </button>
    </div>
  ));

  const linkSection = (role: 'editor' | 'co_author', link: string) => (
    <div style={{ marginTop: '12px' }}>
      <div className="text-[11px] font-semibold text-[var(--text-dim)] uppercase tracking-tight" style={{ marginBottom: '6px' }}>
        Приглашение по ссылке
      </div>
      {link ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          <div className="flex items-center" style={{ gap: '8px' }}>
            <input
              className="modal-input text-xs flex-1"
              value={link}
              readOnly
              onFocus={(e) => e.target.select()}
            />
            <button
              className="btn-primary shrink-0 flex items-center text-xs font-medium"
              style={{ width: 'auto', padding: '6px 12px', gap: '6px' }}
              onClick={() => copyToClipboard(link, role)}
            >
              {copiedRole === role ? <Check size={14} /> : <Copy size={14} />}
              <span>{copiedRole === role ? 'Скопировано' : 'Копировать'}</span>
            </button>
          </div>
          <button
            className="w-full text-left text-xs text-[var(--text-dim)] hover:text-[var(--text-secondary)] transition-colors"
            style={{ padding: '2px 0' }}
            onClick={() => handleGenerateLink(role)}
          >
            Сгенерировать новую (старая перестанет работать)
          </button>
        </div>
      ) : (
        <button
          className="w-full rounded-lg bg-[var(--bg-hover)] border border-[var(--border-default)] text-[var(--text-secondary)] text-xs font-medium hover:bg-[var(--bg-active)] hover:text-[var(--text-primary)] transition-colors flex items-center justify-center"
          style={{ padding: '8px 12px', gap: '6px' }}
          onClick={() => handleGenerateLink(role)}
        >
          <Link size={14} />
          <span>Сгенерировать ссылку</span>
        </button>
      )}
    </div>
  );

  return (
    <div className="modal-overlay" onMouseDown={handleOverlayMouseDown} onClick={handleOverlayClick}>
      <div
        className="modal-panel"
        style={{ maxWidth: '448px', padding: '24px', borderRadius: '16px' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between" style={{ marginBottom: '16px' }}>
          <h3 className="text-lg font-bold text-[var(--text-primary)]">Совместная работа</h3>
          <button onClick={onClose} className="modal-close" style={{ padding: '4px', borderRadius: '8px' }}>
            <X size={18} />
          </button>
        </div>

        {error && <div className="modal-error" style={{ marginBottom: '12px' }}>{error}</div>}

        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', maxHeight: '75vh', overflowY: 'auto', paddingRight: '2px' }}>
          {/* Section 1: Редакторы */}
          <div>
            <h4 className="text-xs font-bold text-[var(--text-dim)] uppercase tracking-wider" style={{ marginBottom: '4px' }}>
              Редакторы
            </h4>
            <p className="text-xs text-[var(--text-muted)]" style={{ marginBottom: '10px' }}>
              Могут оставлять предложения по тексту (режим советчика)
            </p>
            <div style={{ marginBottom: '8px' }}>
              <UserAutocompleteInput
                placeholder="Пригласить редактора по никнейму…"
                onSelect={(nickname) => handleInvite(nickname, 'editor')}
              />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', marginBottom: '8px' }}>
              {editors.length > 0 ? (
                memberList(editors)
              ) : (
                <div className="text-xs text-[var(--text-dim)] italic" style={{ padding: '4px 10px' }}>Нет приглашённых</div>
              )}
            </div>
            {linkSection('editor', editorLink)}
          </div>

          {/* Separator */}
          <div className="border-t border-[var(--border-default)]" style={{ margin: '16px 0' }} />

          {/* Section 2: Соавторы */}
          <div>
            <h4 className="text-xs font-bold text-[var(--text-dim)] uppercase tracking-wider" style={{ marginBottom: '4px' }}>
              Соавторы
            </h4>
            <p className="text-xs text-[var(--text-muted)]" style={{ marginBottom: '10px' }}>
              Могут редактировать текст напрямую
            </p>
            <div style={{ marginBottom: '8px' }}>
              <UserAutocompleteInput
                placeholder="Пригласить соавтора по никнейму…"
                onSelect={(nickname) => handleInvite(nickname, 'co_author')}
              />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', marginBottom: '8px' }}>
              {coauthors.length > 0 ? (
                memberList(coauthors)
              ) : (
                <div className="text-xs text-[var(--text-dim)] italic" style={{ padding: '4px 10px' }}>Нет приглашённых</div>
              )}
            </div>
            {linkSection('co_author', coauthorLink)}
          </div>
        </div>
      </div>
    </div>
  );
}
