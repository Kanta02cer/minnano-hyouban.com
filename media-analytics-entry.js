import { startProductionAnalytics, startPrivacySettings } from './media-analytics-bootstrap.js?v=privacy-inline-20261026';
const node = document.getElementById('media-analytics-config');
if (node?.type === 'application/json') {
  try { startProductionAnalytics({config: JSON.parse(node.textContent)}); }
  catch { /* Fail closed: malformed config must not start analytics. */ }
}
const settings = document.getElementById('media-privacy-config');
if (settings?.type === 'application/json') {
  try { startPrivacySettings({config: JSON.parse(settings.textContent)}); }
  catch { /* Inline controls remain disabled if configuration is invalid. */ }
}
