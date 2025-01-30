const BLOCKED_SITES_KEY = 'blockedSites';
const REDIRECT_URL_KEY = 'redirectURL';
const CHALLENGE_TEXT_KEY = 'challengeText';

document.addEventListener('DOMContentLoaded', async () => {
  // Get references to UI elements
  const challengeDisplay = document.getElementById('challengeDisplay');
  const challengeTextArea = document.getElementById('challengeText');
  const setChallengeBtn = document.getElementById('setChallengeBtn');
  const challengeConfirm = document.getElementById('challengeConfirm');

  const newSiteInput = document.getElementById('newSite');
  const addSiteBtn = document.getElementById('addSiteBtn');
  const blockedSitesList = document.getElementById('blockedSitesList');

  const redirectUrlInput = document.getElementById('redirectUrlInput');
  const saveRedirectBtn = document.getElementById('saveRedirectBtn');

  const exportBtn = document.getElementById('exportBtn');
  const importBtn = document.getElementById('importBtn');
  const importFileInput = document.getElementById('importFile');

  // Load from storage
  let {
    blockedSites = [],
    redirectURL = '',
    challengeText = ''
  } = await chrome.storage.local.get([BLOCKED_SITES_KEY, REDIRECT_URL_KEY, CHALLENGE_TEXT_KEY]);

  // Display the current challenge text
  function renderChallengeText() {
    if (challengeText) {
      challengeDisplay.textContent = challengeText;
    } else {
      challengeDisplay.textContent = 'No challenge text set';
    }
  }
  renderChallengeText();

  // Render the blocked sites
  function renderBlockedSites() {
    blockedSitesList.innerHTML = '';
    blockedSites.forEach((site, index) => {
      const li = document.createElement('li');
      li.textContent = site;

      const removeBtn = document.createElement('button');
      removeBtn.textContent = 'Remove';
      removeBtn.style.marginLeft = '10px';
      removeBtn.addEventListener('click', async () => {
        // Require challenge match (if challengeText is set)
        if (!checkChallenge()) return;

        // Remove this site
        blockedSites.splice(index, 1);
        await chrome.storage.local.set({ [BLOCKED_SITES_KEY]: blockedSites });
        renderBlockedSites();
      });

      li.appendChild(removeBtn);
      blockedSitesList.appendChild(li);
    });
  }
  renderBlockedSites();

  // Set the redirect URL field
  redirectUrlInput.value = redirectURL;

  // Helper: Check if the challenge text is set and, if so, verify user input
  function checkChallenge() {
    // If there's no challenge text set, no need to check
    if (!challengeText) return true;

    // If challenge text is set, user must have typed it EXACTLY in challengeConfirm
    const userEntry = (challengeConfirm.value || '').trim();
    if (userEntry === challengeText) {
      return true; // matched
    }

    alert('Challenge text does not match. Action not allowed.');
    return false;
  }

  // 1) Set Challenge Text
  setChallengeBtn.addEventListener('click', async () => {
    // If there's an existing challenge text, must match it first to change it
    if (challengeText) {
      if (!checkChallenge()) return;
    }
    
    // Now set a new challenge text
    const newText = challengeTextArea.value.trim();
    challengeText = newText; // update in memory
    await chrome.storage.local.set({ [CHALLENGE_TEXT_KEY]: challengeText });

    // Clear out the text area after setting
    challengeTextArea.value = '';
    // Re-render
    renderChallengeText();

    alert('Challenge text updated.');
  });

  // 2) Add a new site
  addSiteBtn.addEventListener('click', async () => {
    // (If you want to protect adding sites, require challenge match)
    // if (!checkChallenge()) return;

    const site = newSiteInput.value.trim();
    if (site && !blockedSites.includes(site)) {
      blockedSites.push(site);
      await chrome.storage.local.set({ [BLOCKED_SITES_KEY]: blockedSites });
      renderBlockedSites();
      newSiteInput.value = '';
    }
  });

  // 3) Save Redirect URL
  saveRedirectBtn.addEventListener('click', async () => {
    if (!checkChallenge()) return;

    const newRedirect = redirectUrlInput.value.trim();
    await chrome.storage.local.set({ [REDIRECT_URL_KEY]: newRedirect });
    alert('Redirect URL saved!');
  });

  // 4) Export
  exportBtn.addEventListener('click', () => {
    // Optionally, require challenge to export
    // if (!checkChallenge()) return;

    const dataToExport = {
      blockedSites,
      redirectURL,
      challengeText
    };
    const dataStr = JSON.stringify(dataToExport, null, 2);
    const blob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);

    const link = document.createElement('a');
    link.href = url;
    link.download = 'blocked-sites.json';
    link.click();

    URL.revokeObjectURL(url);
  });

  // 5) Import
  importBtn.addEventListener('click', () => {
    // Optionally, require challenge to import
    // if (!checkChallenge()) return;

    importFileInput.click();
  });

  importFileInput.addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (evt) => {
      try {
        const importedData = JSON.parse(evt.target.result);
        if (importedData && Array.isArray(importedData.blockedSites)) {
          // If challenge is set, require challenge to overwrite
          if (!checkChallenge()) return;

          blockedSites = importedData.blockedSites;
          redirectURL = importedData.redirectURL || '';
          challengeText = importedData.challengeText || '';

          await chrome.storage.local.set({
            [BLOCKED_SITES_KEY]: blockedSites,
            [REDIRECT_URL_KEY]: redirectURL,
            [CHALLENGE_TEXT_KEY]: challengeText
          });

          // Refresh UI
          renderBlockedSites();
          redirectUrlInput.value = redirectURL;
          renderChallengeText();

          alert('Import successful!');
        } else {
          alert('Invalid file format. Must contain { blockedSites: [], redirectURL: "", challengeText: "" }');
        }
      } catch (err) {
        alert('Error reading or parsing file. Make sure it’s valid JSON.');
      }
      importFileInput.value = null; // reset input
    };
    reader.readAsText(file);
  });
});