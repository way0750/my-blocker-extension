const BLOCKED_SITES_KEY = 'blockedSites';
const REDIRECT_URL_KEY = 'redirectURL';

async function updateBlockingRules() {
  // Get list of blocked sites and the redirect URL from storage
  const { blockedSites, redirectURL } = await chrome.storage.local.get([BLOCKED_SITES_KEY, REDIRECT_URL_KEY]);
  const sites = blockedSites || [];
  const userRedirect = (redirectURL || '').trim();

  // Remove existing rules
  const ruleIdsToRemove = Array.from({ length: 1000 }, (_, i) => i + 1);
  await chrome.declarativeNetRequest.updateDynamicRules({
    removeRuleIds: ruleIdsToRemove
  });

  let ruleIdCounter = 1;
  const newRules = sites.map((site) => {
    // Build the urlFilter for each blocked site
    const urlFilterValue = site.includes('://') ? site : `*://${site}/*`;

    // If the user provided a valid redirect (starts with http:// or https://), use it
    // Otherwise, fallback to our local 'blocked.html'
    let finalRedirectURL = userRedirect;

    // Basic validation: if userRedirect isn't a well-formed URL with a protocol, we revert
    if (!/^https?:\/\//.test(finalRedirectURL)) {
      // Build the extension-based URL for blocked.html
      finalRedirectURL = `chrome-extension://${chrome.runtime.id}/blocked.html`;
    }

    return {
      id: ruleIdCounter++,
      priority: 1,
      action: {
        type: 'redirect',
        redirect: { url: finalRedirectURL }
      },
      condition: {
        urlFilter: urlFilterValue,
        resourceTypes: ['main_frame']
      }
    };
  });

  if (newRules.length > 0) {
    await chrome.declarativeNetRequest.updateDynamicRules({
      addRules: newRules
    });
  }
}

// Listen for storage changes
chrome.storage.onChanged.addListener(async (changes, areaName) => {
  if (areaName === 'local' && (changes[BLOCKED_SITES_KEY] || changes[REDIRECT_URL_KEY])) {
    await updateBlockingRules();
  }
});

// On install or startup
chrome.runtime.onInstalled.addListener(updateBlockingRules);
chrome.runtime.onStartup.addListener(updateBlockingRules);