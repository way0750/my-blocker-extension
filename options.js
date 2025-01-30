// options.js

// Keys for storage
const BLOCKED_SITES_KEY  = 'blockedSites';
const REDIRECT_URL_KEY   = 'redirectURL';
const CHALLENGE_TEXT_KEY = 'challengeText';

document.addEventListener('DOMContentLoaded', async () => {
  // --- DOM References ---
  const challengeDisplay   = document.getElementById('challengeDisplay');
  const challengeTextArea  = document.getElementById('challengeTextArea');
  const checkChallengeBtn  = document.getElementById('checkChallengeBtn');
  const setChallengeBtn    = document.getElementById('setChallengeBtn');

  const newSiteInput       = document.getElementById('newSite');
  const addSiteBtn         = document.getElementById('addSiteBtn');
  const blockedSitesList   = document.getElementById('blockedSitesList');

  const redirectUrlInput   = document.getElementById('redirectUrlInput');
  const saveRedirectBtn    = document.getElementById('saveRedirectBtn');

  const exportBtn          = document.getElementById('exportBtn');
  const importBtn          = document.getElementById('importBtn');
  const importFileInput    = document.getElementById('importFile');

  // --- Load existing data from storage ---
  let { blockedSites = [], redirectURL = '', challengeText = '' } =
    await chrome.storage.local.get([BLOCKED_SITES_KEY, REDIRECT_URL_KEY, CHALLENGE_TEXT_KEY]);

  // Track whether restricted actions are unlocked
  let unlocked = false;

  // --- Render the challenge text or "No challenge text set" ---
  function renderChallengeText() {
    if (!challengeText) {
      challengeDisplay.textContent = 'No challenge text set';
    } else {
      challengeDisplay.textContent = challengeText;
    }
  }
  renderChallengeText();

  // --- Render the list of blocked sites ---
  function renderBlockedSites() {
    blockedSitesList.innerHTML = '';
    blockedSites.forEach((site, index) => {
      const li = document.createElement('li');
      li.textContent = site;

      const removeBtn = document.createElement('button');
      removeBtn.textContent = 'Remove';
      removeBtn.style.marginLeft = '10px';

      // Removing a site is restricted (needs to be unlocked)
      removeBtn.addEventListener('click', async () => {
        if (!unlocked) return; // do nothing if locked
        blockedSites.splice(index, 1);
        await chrome.storage.local.set({ [BLOCKED_SITES_KEY]: blockedSites });
        renderBlockedSites();
      });

      li.appendChild(removeBtn);
      blockedSitesList.appendChild(li);
    });
  }
  renderBlockedSites();

  // Pre-fill the redirect URL field
  redirectUrlInput.value = redirectURL;

  // --- Enable/Disable restricted actions ---
  function enableRestrictedActions(enable) {
    // If locked => these are disabled
    setChallengeBtn.disabled  = !enable;
    saveRedirectBtn.disabled  = !enable;

    // Disable remove site buttons
    const removeButtons = blockedSitesList.querySelectorAll('button');
    removeButtons.forEach(btn => {
      btn.disabled = !enable;
    });
  }

  // --- Decide initial lock state ---
  if (!challengeText) {
    // No challenge => unlocked
    unlocked = true;
    enableRestrictedActions(true);
  } else {
    // Challenge text => locked
    unlocked = false;
    enableRestrictedActions(false);
  }

  // ========== DISABLE COPY/PASTE IN THE TEXTAREA ==========
  challengeTextArea.addEventListener('paste',  (e) => e.preventDefault());
  challengeTextArea.addEventListener('copy',   (e) => e.preventDefault());
  challengeTextArea.addEventListener('cut',    (e) => e.preventDefault());

  // ========== CHECK CHALLENGE BUTTON ==========
  checkChallengeBtn.addEventListener('click', () => {
    if (!challengeText) {
      // No challenge text set at all
      console.log('No challenge text is set, so no need to check.');
      alert('There is currently no challenge text set.');
      return;
    }

    // If already unlocked, do nothing
    if (unlocked) {
      console.log('Already unlocked. No need to check challenge again.');
      return;
    }

    const userTyped = challengeTextArea.value;
    console.log('User typed:', userTyped);
    console.log('Actual challenge text:', challengeText);

    if (userTyped === challengeText) {
      // Correct => unlock everything
      unlocked = true;
      enableRestrictedActions(true);

      alert('Correct! Options are now unlocked.');
    } else {
      alert('Incorrect challenge text!');
    }
  });

  // ========== SET CHALLENGE BUTTON ==========
  setChallengeBtn.addEventListener('click', async () => {
    // If a challenge text already exists, we must be unlocked to change it
    if (challengeText && !unlocked) return;

    const newText = challengeTextArea.value;
    challengeText = newText;
    await chrome.storage.local.set({ [CHALLENGE_TEXT_KEY]: challengeText });

    renderChallengeText();
    alert('Challenge text updated.');
  });

  // ========== ADD SITE (ALWAYS ALLOWED) ==========
  addSiteBtn.addEventListener('click', async () => {
    // No challenge check here; user can always add
    const site = newSiteInput.value.trim();
    if (site && !blockedSites.includes(site)) {
      blockedSites.push(site);
      await chrome.storage.local.set({ [BLOCKED_SITES_KEY]: blockedSites });
      renderBlockedSites();
      newSiteInput.value = '';
    }
  });

  // ========== SAVE REDIRECT (RESTRICTED) ==========
  saveRedirectBtn.addEventListener('click', async () => {
    if (!unlocked) return;

    const newRedirect = redirectUrlInput.value.trim();
    await chrome.storage.local.set({ [REDIRECT_URL_KEY]: newRedirect });
    alert('Redirect URL saved!');
  });

  // ========== EXPORT ==========
  exportBtn.addEventListener('click', () => {
    // If you want to restrict export, you could require unlocked. For now, always allowed.
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

  // ========== IMPORT ==========
  importBtn.addEventListener('click', () => {
    // If you want to restrict import, you could add if (!unlocked) return;
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
          blockedSites = importedData.blockedSites;
          redirectURL  = importedData.redirectURL || '';
          challengeText= importedData.challengeText || '';

          await chrome.storage.local.set({
            [BLOCKED_SITES_KEY]: blockedSites,
            [REDIRECT_URL_KEY]: redirectURL,
            [CHALLENGE_TEXT_KEY]: challengeText
          });

          // Re-render
          renderBlockedSites();
          redirectUrlInput.value = redirectURL;
          renderChallengeText();

          // If a challenge text was imported, lock unless it's empty
          if (challengeText) {
            unlocked = false;
            enableRestrictedActions(false);
          } else {
            unlocked = true;
            enableRestrictedActions(true);
          }

          alert('Import successful!');
        } else {
          alert('Invalid file format. Must have { blockedSites: [], redirectURL: "", challengeText: "" }');
        }
      } catch (err) {
        alert('Error reading or parsing file. Make sure it’s valid JSON.');
      }
      importFileInput.value = null; // reset
    };
    reader.readAsText(file);
  });
});