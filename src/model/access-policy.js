/**
 * Единая политика доступа браузерного приложения и Web Component.
 * Viewer может читать проект и управлять камерой мышью, но не может
 * изменять данные, оформление, легенду или снимать блокировку командами.
 */
export const VIEWER_ALLOWED_TOOLS = Object.freeze(new Set([
  'get_project',
  'graph_get_project'
]));

export function isToolAllowedInMode(mode, toolName) {
  return mode !== 'viewer' || VIEWER_ALLOWED_TOOLS.has(toolName);
}

export function assertToolAllowedInMode(mode, toolName) {
  if (!isToolAllowedInMode(mode, toolName)) {
    throw new Error('Режим просмотра: команды изменения отключены.');
  }
}

export function assertAdminMode(mode) {
  if (mode !== 'admin') {
    throw new Error('Режим просмотра: редактирование отключено.');
  }
}
