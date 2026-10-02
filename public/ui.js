export const escapeHtml = (value) => String(value).replace(/[&<>"']/g, (character) =>
  ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]);

export const timeLabel = (seconds) => seconds === null ? '∞'
  : `${Math.floor(Math.ceil(seconds) / 60).toString().padStart(2, '0')}:${(Math.ceil(seconds) % 60).toString().padStart(2, '0')}`;

export const roleName = (role) => role === 'operator' ? 'Console operator' : 'Signal analyst';
