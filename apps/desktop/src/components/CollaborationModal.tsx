import { useState, useEffect, useCallback } from 'react';
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

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-panel collab-modal" style={{ maxWidth: '520px' }} onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3 className="modal-title">Совместная работа</h3>
          <button onClick={onClose} className="modal-close">
            <X size={18} />
          </button>
        </div>

        <div style={{ maxHeight: '75vh', overflowY: 'auto' }}>
          {error && <div className="modal-error" style={{ margin: '12px 20px 0' }}>{error}</div>}

          {/* EDITORS Section */}
          <div className="collab-section">
            <h4 className="collab-section-title">РЕДАКТОРЫ</h4>
            <p className="collab-section-desc">Могут оставлять предложения по тексту (режим советчика)</p>

            {editors.map((ed) => (
              <div key={ed.user_id} className="collab-user">
                <span className="collab-user-name">{ed.nickname}</span>
                <button onClick={() => handleRemove(ed.user_id)} className="collab-remove" title="Удалить">
                  <Trash2 size={14} />
                </button>
              </div>
            ))}

            <UserAutocompleteInput
              placeholder="Пригласить редактора по никнейму…"
              onSelect={(nickname) => handleInvite(nickname, 'editor')}
            />

            <div className="collab-link-section">
              <button onClick={() => handleGenerateLink('editor')} className="collab-link-btn">
                <Link size={14} /> Создать ссылку для редактора
              </button>
              {editorLink && (
                <div className="collab-link-display">
                  <input value={editorLink} readOnly className="modal-input collab-link-input" />
                  <button className="btn-secondary" onClick={() => copyToClipboard(editorLink, 'editor')}>
                    {copiedRole === 'editor' ? <Check size={14} /> : <Copy size={14} />}
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* CO-AUTHORS Section */}
          <div className="collab-section">
            <h4 className="collab-section-title">СОАВТОРЫ</h4>
            <p className="collab-section-desc">Могут редактировать текст напрямую</p>

            {coauthors.map((ca) => (
              <div key={ca.user_id} className="collab-user">
                <span className="collab-user-name">{ca.nickname}</span>
                <button onClick={() => handleRemove(ca.user_id)} className="collab-remove" title="Удалить">
                  <Trash2 size={14} />
                </button>
              </div>
            ))}

            <UserAutocompleteInput
              placeholder="Пригласить соавтора по никнейму…"
              onSelect={(nickname) => handleInvite(nickname, 'co_author')}
            />

            <div className="collab-link-section">
              <button onClick={() => handleGenerateLink('co_author')} className="collab-link-btn">
                <Link size={14} /> Создать ссылку для соавтора
              </button>
              {coauthorLink && (
                <div className="collab-link-display">
                  <input value={coauthorLink} readOnly className="modal-input collab-link-input" />
                  <button className="btn-secondary" onClick={() => copyToClipboard(coauthorLink, 'co_author')}>
                    {copiedRole === 'co_author' ? <Check size={14} /> : <Copy size={14} />}
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
