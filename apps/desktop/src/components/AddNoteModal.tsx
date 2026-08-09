import React, { useState, useEffect, useRef } from "react";
import { MessageCircleMore, X } from "lucide-react";

interface AddNoteModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (noteText: string) => void;
}

export function AddNoteModal({ isOpen, onClose, onSubmit }: AddNoteModalProps) {
  const [text, setText] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    if (isOpen) {
      setText("");
      setTimeout(() => textareaRef.current?.focus(), 50);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSubmit = () => {
    if (!text.trim()) return;
    onSubmit(text.trim());
    onClose();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") {
      e.preventDefault();
      onClose();
    } else if (e.key === "Enter" && (e.ctrlKey || e.metaKey || !e.shiftKey)) {
      e.preventDefault();
      handleSubmit();
    }
  };

  return (
    <div
      className="modal-overlay"
      style={{ zIndex: 99999 }}
      onClick={onClose}
    >
      <div
        className="modal-panel"
        style={{ maxWidth: "440px" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-header">
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <MessageCircleMore size={18} style={{ color: "#f59e0b" }} />
            <h3 className="modal-title">Добавить примечание</h3>
          </div>
          <button onClick={onClose} className="modal-close">
            <X size={18} />
          </button>
        </div>

        <div style={{ padding: "20px" }}>
          <textarea
            ref={textareaRef}
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Введите примечание для автора..."
            rows={3}
            className="modal-input"
            style={{ width: "100%", resize: "none", marginBottom: "16px" }}
          />

          <div style={{ display: "flex", justifyContent: "flex-end", gap: "8px" }}>
            <button className="btn-secondary" onClick={onClose}>
              Отмена
            </button>
            <button
              className="btn-primary"
              onClick={handleSubmit}
              disabled={!text.trim()}
            >
              Добавить
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
