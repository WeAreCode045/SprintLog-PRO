import {
  useState,
  useRef,
  useEffect,
  useCallback,
  type ChangeEvent,
  type KeyboardEvent,
} from 'react';
import type { MentionableUser } from '../lib/mentions';
import { authorInitials } from '../features/discussions/TopicList';

interface MentionTextareaProps {
  id?: string;
  rows?: number;
  placeholder?: string;
  value: string;
  onChange: (value: string) => void;
  onKeyDown?: (e: KeyboardEvent<HTMLTextAreaElement>) => void;
  users: MentionableUser[];
  disabled?: boolean;
  className?: string;
  autoFocus?: boolean;
}

export function MentionTextarea({
  id,
  rows = 4,
  placeholder,
  value,
  onChange,
  onKeyDown,
  users,
  disabled = false,
  className = '',
  autoFocus = false,
}: MentionTextareaProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [mentionStartIndex, setMentionStartIndex] = useState(-1);
  const [selectedIndex, setSelectedIndex] = useState(0);

  // Filter users matching query (by name or email)
  const filteredUsers = users
    .filter((user) => {
      if (!user.name) return false;
      const q = query.toLowerCase();
      return (
        user.name.toLowerCase().includes(q) ||
        (user.email && user.email.toLowerCase().includes(q))
      );
    })
    .slice(0, 7);

  // Detect mention pattern at cursor
  const checkMentionTrigger = useCallback((text: string, cursor: number) => {
    const textBeforeCursor = text.slice(0, cursor);
    // Match @ preceded by start of string or whitespace, followed by non-space chars
    const match = textBeforeCursor.match(/(?:^|\s)@([^\s@]*)$/);

    if (match && match.index !== undefined) {
      const atSymbolIndex = textBeforeCursor.lastIndexOf('@');
      const mentionQuery = match[1];
      setQuery(mentionQuery);
      setMentionStartIndex(atSymbolIndex);
      setSelectedIndex(0);
      setIsOpen(true);
    } else {
      setIsOpen(false);
      setQuery('');
      setMentionStartIndex(-1);
    }
  }, []);

  const handleChange = (e: ChangeEvent<HTMLTextAreaElement>) => {
    const nextValue = e.target.value;
    const cursor = e.target.selectionStart ?? nextValue.length;
    onChange(nextValue);
    checkMentionTrigger(nextValue, cursor);
  };

  const handleSelectUser = useCallback(
    (user: MentionableUser) => {
      if (mentionStartIndex === -1 || !textareaRef.current) return;

      const cursor = textareaRef.current.selectionStart ?? value.length;
      const before = value.slice(0, mentionStartIndex);
      const after = value.slice(cursor);
      const inserted = `@${user.name.trim()} `;
      const nextValue = before + inserted + after;

      onChange(nextValue);
      setIsOpen(false);
      setQuery('');
      setMentionStartIndex(-1);

      // Re-focus and position caret right after the inserted mention
      requestAnimationFrame(() => {
        if (textareaRef.current) {
          textareaRef.current.focus();
          const newPos = before.length + inserted.length;
          textareaRef.current.setSelectionRange(newPos, newPos);
        }
      });
    },
    [mentionStartIndex, value, onChange],
  );

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (isOpen && filteredUsers.length > 0) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex((prev) => (prev + 1) % filteredUsers.length);
        return;
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex((prev) => (prev - 1 + filteredUsers.length) % filteredUsers.length);
        return;
      }
      if (e.key === 'Enter' || e.key === 'Tab') {
        e.preventDefault();
        const selected = filteredUsers[selectedIndex];
        if (selected) {
          handleSelectUser(selected);
        }
        return;
      }
      if (e.key === 'Escape') {
        e.preventDefault();
        setIsOpen(false);
        return;
      }
    }

    if (onKeyDown) {
      onKeyDown(e);
    }
  };

  // Close dropdown on click outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Ensure active option is scrolled into view
  useEffect(() => {
    if (isOpen && dropdownRef.current) {
      const activeEl = dropdownRef.current.querySelector<HTMLElement>(
        `.mention-autocomplete-item:nth-child(${selectedIndex + 1})`,
      );
      if (activeEl) {
        activeEl.scrollIntoView({ block: 'nearest' });
      }
    }
  }, [selectedIndex, isOpen]);

  return (
    <div className={`mention-textarea-container ${className}`} ref={containerRef}>
      <textarea
        ref={textareaRef}
        id={id}
        rows={rows}
        placeholder={placeholder}
        value={value}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        disabled={disabled}
        autoFocus={autoFocus}
        className="mention-textarea-input"
      />

      {isOpen && filteredUsers.length > 0 && (
        <div className="mention-autocomplete-dropdown" ref={dropdownRef} role="listbox">
          <div className="mention-autocomplete-header">
            <span>Gebruikers ({filteredUsers.length})</span>
          </div>
          {filteredUsers.map((user, idx) => {
            const isActive = idx === selectedIndex;
            return (
              <button
                key={user.id}
                type="button"
                className={`mention-autocomplete-item ${isActive ? 'active' : ''}`}
                onMouseDown={(e) => {
                  e.preventDefault(); // prevent textarea blur
                  handleSelectUser(user);
                }}
                onMouseEnter={() => setSelectedIndex(idx)}
                role="option"
                aria-selected={isActive}
              >
                <span className="mention-user-avatar" aria-hidden>
                  {authorInitials(user.name)}
                </span>
                <div className="mention-user-info">
                  <strong className="mention-user-name">{user.name}</strong>
                  {user.email && (
                    <span className="mention-user-sub">{user.email}</span>
                  )}
                </div>
                {user.role && (
                  <span className="mention-user-role-badge">{user.role}</span>
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
