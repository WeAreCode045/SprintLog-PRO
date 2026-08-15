import type { ReactNode } from 'react';

export interface MentionableUser {
  id: string;
  name: string;
  email?: string;
  role?: string;
  avatarFileId?: string | null;
}

/**
 * Extracts tagged users from text containing `@DisplayName` or `@Username`.
 * Returns an array of matched user objects without duplicates.
 */
export function extractMentions(
  text: string,
  users: MentionableUser[],
): MentionableUser[] {
  if (!text || !users || users.length === 0) return [];
  const lowerText = text.toLowerCase();
  const tagged: MentionableUser[] = [];
  const seenIds = new Set<string>();

  // Sort users by name length descending to match longer names first (e.g. "John Doe" before "John")
  const sortedUsers = [...users].sort((a, b) => b.name.length - a.name.length);

  for (const user of sortedUsers) {
    if (!user.name) continue;
    const nameLower = user.name.trim().toLowerCase();
    if (!nameLower) continue;
    const mentionPattern = `@${nameLower}`;

    let searchFrom = 0;
    while (searchFrom < lowerText.length) {
      const idx = lowerText.indexOf(mentionPattern, searchFrom);
      if (idx === -1) break;

      // Check boundary before @
      const isStart = idx === 0;
      const charBefore = isStart ? ' ' : lowerText[idx - 1];
      const validBefore = isStart || /\s|[.,!?:;()[\]{}"'\n\r]/.test(charBefore);

      // Check boundary after mention
      const endIdx = idx + mentionPattern.length;
      const isEnd = endIdx === lowerText.length;
      const charAfter = isEnd ? ' ' : lowerText[endIdx];
      const validAfter = isEnd || /\s|[.,!?:;()[\]{}"'\n\r]/.test(charAfter);

      if (validBefore && validAfter && !seenIds.has(user.id)) {
        seenIds.add(user.id);
        tagged.push(user);
        break;
      }

      searchFrom = idx + 1;
    }
  }

  return tagged;
}

/**
 * Formats the summary text for tagged users (e.g. "Alice & Bob" or "Alice, Bob & Charlie").
 */
export function formatTaggedNames(tagged: MentionableUser[]): string {
  if (tagged.length === 0) return '';
  if (tagged.length === 1) return tagged[0].name;
  if (tagged.length === 2) return `${tagged[0].name} & ${tagged[1].name}`;
  return `${tagged.slice(0, -1).map((u) => u.name).join(', ')} & ${tagged[tagged.length - 1].name}`;
}

/**
 * Renders text with `@mentions` highlighted as stylized badges.
 */
export function renderMentionText(text: string, users?: MentionableUser[]): ReactNode {
  if (!text) return null;
  if (!text.includes('@')) return text;

  if (users && users.length > 0) {
    const validNames = users
      .map((u) => u.name.trim())
      .filter(Boolean)
      .sort((a, b) => b.length - a.length);

    if (validNames.length > 0) {
      const escaped = validNames.map((n) => n.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|');
      const regex = new RegExp(`(@(?:${escaped}))(?=[\\s.,!?:;()\\[\\]{}"'\\n\\r]|$)`, 'gi');

      const parts = text.split(regex);
      return parts.map((part, index) => {
        if (part.startsWith('@')) {
          const matchedName = part.slice(1).toLowerCase();
          const matchedUser = users.find((u) => u.name.trim().toLowerCase() === matchedName);
          if (matchedUser || validNames.some((n) => n.toLowerCase() === matchedName)) {
            return (
              <span key={index} className="mention-tag" title={matchedUser?.email ?? part}>
                {part}
              </span>
            );
          }
        }
        return part;
      });
    }
  }

  // Fallback: match any @word or @[name]
  const generalMentionRegex = /(@[a-zA-Z0-9_.-]+)/g;
  const parts = text.split(generalMentionRegex);
  return parts.map((part, index) => {
    if (part.startsWith('@') && part.length > 1) {
      return (
        <span key={index} className="mention-tag">
          {part}
        </span>
      );
    }
    return part;
  });
}
