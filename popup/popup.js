document.getElementById('btn-settings').addEventListener('click', () => {
  chrome.runtime.openOptionsPage();
});

chrome.tabs.query({active: true, currentWindow: true}, (tabs) => {
  const currentTab = tabs[0];
  if (currentTab && currentTab.url && !currentTab.url.startsWith('chrome://')) {
    const url = new URL(currentTab.url);
    document.getElementById('domain-name').innerText = url.hostname;
    
    chrome.tabs.sendMessage(currentTab.id, { action: 'GET_STATUS' }, (response) => {
      if (chrome.runtime.lastError || !response) {
        document.getElementById('status-text').innerText = "No form fields found on this page";
      } else {
        document.getElementById('status-text').innerText = `Fields detected: ${response.totalFields}\n${response.reviewCount} need review`;
        if (response.totalFields > 0) {
          document.getElementById('action-buttons').style.display = 'block';
        }
      }
    });
  } else {
    document.getElementById('status-text').innerText = "Extension cannot run on this page";
  }
});

document.getElementById('btn-fill').addEventListener('click', () => {
  chrome.tabs.query({active: true, currentWindow: true}, (tabs) => {
    chrome.tabs.sendMessage(tabs[0].id, { action: 'FILL_ALL' }, () => {
      window.close();
    });
  });
});

document.getElementById('btn-fill-all-tabs').addEventListener('click', () => {
  document.getElementById('btn-fill-all-tabs').innerText = 'Filling All...';
  chrome.tabs.query({currentWindow: true}, (tabs) => {
    let sentCount = 0;
    tabs.forEach(tab => {
      chrome.tabs.sendMessage(tab.id, { action: 'FILL_ALL' }, () => {
        // Ignore errors for tabs without content scripts
        if (chrome.runtime.lastError) {}
      });
      sentCount++;
    });
    setTimeout(() => window.close(), 300);
  });
});

document.getElementById('btn-review').addEventListener('click', () => {
  chrome.tabs.query({active: true, currentWindow: true}, (tabs) => {
    chrome.tabs.sendMessage(tabs[0].id, { action: 'REVIEW_FIELDS' }, () => {
      window.close();
    });
  });
});

chrome.storage.local.get(['syncEnabled'], (res) => {
  const syncBanner = document.getElementById('sync-banner');
  const btnSync = document.getElementById('btn-enable-sync');
  syncBanner.style.display = 'block';
  
  if (res.syncEnabled) {
    btnSync.innerText = 'Disable Sync';
    syncBanner.firstElementChild.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align: middle; margin-right: 4px; color: #FF9500;"><path d="M4 22h16"></path><path d="M12 22V10"></path><path d="M4 10a8 8 0 0 1 16 0"></path><path d="M8 10a4 4 0 0 1 8 0"></path><circle cx="12" cy="10" r="1"></circle></svg> Dataset sync: ON';
    btnSync.style.background = '#e53935';
    btnSync.style.color = '#fff';
    btnSync.style.border = 'none';
    btnSync.style.cursor = 'pointer';
    btnSync.style.borderRadius = '4px';
  } else {
    btnSync.innerText = 'Enable anonymous data sharing';
    syncBanner.firstElementChild.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align: middle; margin-right: 4px; color: #FF9500;"><path d="M4 22h16"></path><path d="M12 22V10"></path><path d="M4 10a8 8 0 0 1 16 0"></path><path d="M8 10a4 4 0 0 1 8 0"></path><circle cx="12" cy="10" r="1"></circle></svg> Dataset sync: OFF';
    btnSync.style.background = '#f5f5f5';
    btnSync.style.color = '#333';
    btnSync.style.border = '1px solid #ccc';
    btnSync.style.cursor = 'pointer';
    btnSync.style.borderRadius = '4px';
  }

  btnSync.addEventListener('click', () => {
    const newState = !res.syncEnabled;
    chrome.storage.local.set({ syncEnabled: newState }, () => {
      window.location.reload();
    });
  });
});
