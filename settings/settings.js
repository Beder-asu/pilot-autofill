let saveTimeout = null;

function showSaveStatus() {
  const status = document.getElementById('save-status');
  status.style.opacity = '1';
  setTimeout(() => status.style.opacity = '0', 2000);
}

function debouncedSave() {
  if (saveTimeout) clearTimeout(saveTimeout);
  saveTimeout = setTimeout(async () => {
    await saveProfileFromUI();
    showSaveStatus();
  }, 500);
}

let currentProfile = {};

const AI_MODELS = {
  gemini: [
    'gemini-2.5-flash',
    'gemini-3.1-flash-lite',          // 500 RPD free tier — recommended
    'gemini-2.5-flash-lite-preview-06-17',
    'gemini-2.0-flash',
    'gemini-2.0-flash-lite',
    'gemini-1.5-flash',
    'gemini-1.5-flash-8b',
    'gemini-2.5-pro',
  ],
  openai: ['gpt-4o', 'gpt-4o-mini', 'gpt-3.5-turbo'],
  anthropic: ['claude-3-5-sonnet-latest', 'claude-3-opus-latest', 'claude-3-haiku-20240307']
};

async function loadProfile() {
  currentProfile = await globalThis.ProfileStore.getProfile();
  document.getElementById('firstName').value = currentProfile.personal.firstName || '';
  document.getElementById('middleName').value = currentProfile.personal.middleName || '';
  document.getElementById('lastName').value = currentProfile.personal.lastName || '';
  document.getElementById('preferredName').value = currentProfile.personal.preferredName || '';
  document.getElementById('email').value = currentProfile.personal.email || '';
  document.getElementById('phone').value = currentProfile.personal.phone || '';
  document.getElementById('birthday').value = currentProfile.personal.birthday || '';
  document.getElementById('pronouns').value = currentProfile.personal.pronouns || '';
  document.getElementById('gender').value = currentProfile.personal.gender || '';
  document.getElementById('ethnicity').value = currentProfile.personal.ethnicity || '';
  document.getElementById('veteranStatus').value = currentProfile.personal.veteranStatus || '';
  document.getElementById('disabilityStatus').value = currentProfile.personal.disabilityStatus || '';
  document.getElementById('linkedin').value = currentProfile.professional.linkedin || '';
  document.getElementById('github').value = currentProfile.professional.github || '';
  document.getElementById('portfolio').value = currentProfile.professional.portfolio || '';
  document.getElementById('currentCompany').value = currentProfile.professional.currentCompany || '';
  document.getElementById('currentTitle').value = currentProfile.professional.currentTitle || '';
  document.getElementById('yearsOfExperience').value = currentProfile.professional.yearsOfExperience || '';
  document.getElementById('university').value = currentProfile.education.university || '';
  document.getElementById('faculty').value = currentProfile.education.faculty || '';
  document.getElementById('degree').value = currentProfile.education.degree || '';
  document.getElementById('fieldOfStudy').value = currentProfile.education.fieldOfStudy || '';
  document.getElementById('studentLevel').value = currentProfile.education.studentLevel || '';
  document.getElementById('gpa').value = currentProfile.education.gpa || '';
  document.getElementById('graduationYear').value = currentProfile.education.graduationYear || '';
  document.getElementById('salaryExpectation').value = currentProfile.preferences.salaryExpectation || '';
  document.getElementById('startDate').value = currentProfile.preferences.startDate || '';
  document.getElementById('noticePeriod').value = currentProfile.preferences.noticePeriod || '';
  document.getElementById('relocation').value = currentProfile.preferences.relocation || '';
  document.getElementById('travelPercentage').value = currentProfile.preferences.travelPercentage || '';
  document.getElementById('languages').value = currentProfile.preferences.languages || '';
  document.getElementById('workAuthorization').value = currentProfile.preferences.workAuthorization || '';
  document.getElementById('aiInstructions').value = currentProfile.preferences.aiInstructions || '';
}

function saveProfileFromUI() {
  const autoFillMode = document.getElementById('autoFillMode').checked;
  chrome.storage.local.set({ autoFillMode: autoFillMode });

  currentProfile.personal.firstName = document.getElementById('firstName').value;
  currentProfile.personal.middleName = document.getElementById('middleName').value;
  currentProfile.personal.lastName = document.getElementById('lastName').value;
  currentProfile.personal.preferredName = document.getElementById('preferredName').value;
  currentProfile.personal.email = document.getElementById('email').value;
  currentProfile.personal.phone = document.getElementById('phone').value;
  currentProfile.personal.birthday = document.getElementById('birthday').value;
  currentProfile.personal.pronouns = document.getElementById('pronouns').value;
  currentProfile.personal.gender = document.getElementById('gender').value;
  currentProfile.personal.ethnicity = document.getElementById('ethnicity').value;
  currentProfile.personal.veteranStatus = document.getElementById('veteranStatus').value;
  currentProfile.personal.disabilityStatus = document.getElementById('disabilityStatus').value;
  currentProfile.professional.linkedin = document.getElementById('linkedin').value;
  currentProfile.professional.github = document.getElementById('github').value;
  currentProfile.professional.portfolio = document.getElementById('portfolio').value;
  currentProfile.professional.currentCompany = document.getElementById('currentCompany').value;
  currentProfile.professional.currentTitle = document.getElementById('currentTitle').value;
  currentProfile.professional.yearsOfExperience = document.getElementById('yearsOfExperience').value;
  currentProfile.education.university = document.getElementById('university').value;
  currentProfile.education.faculty = document.getElementById('faculty').value;
  currentProfile.education.degree = document.getElementById('degree').value;
  currentProfile.education.fieldOfStudy = document.getElementById('fieldOfStudy').value;
  currentProfile.education.studentLevel = document.getElementById('studentLevel').value;
  currentProfile.education.gpa = document.getElementById('gpa').value;
  currentProfile.education.graduationYear = document.getElementById('graduationYear').value;
  currentProfile.preferences.salaryExpectation = document.getElementById('salaryExpectation').value;
  currentProfile.preferences.startDate = document.getElementById('startDate').value;
  currentProfile.preferences.noticePeriod = document.getElementById('noticePeriod').value;
  currentProfile.preferences.relocation = document.getElementById('relocation').value;
  currentProfile.preferences.travelPercentage = document.getElementById('travelPercentage').value;
  currentProfile.preferences.languages = document.getElementById('languages').value;
  currentProfile.preferences.workAuthorization = document.getElementById('workAuthorization').value;
  currentProfile.preferences.aiInstructions = document.getElementById('aiInstructions').value;
  
  const provider = document.getElementById('aiProvider').value;
  const model = document.getElementById('aiModel').value;
  const key = document.getElementById('aiApiKey').value;
  
  chrome.storage.local.set({
    autoFillMode: autoFillMode,
    aiProvider: provider,
    aiModel: model,
    aiApiKey: key,
    darkMode: document.getElementById('checkbox-theme').checked
  });

  return globalThis.ProfileStore.saveProfile(currentProfile);
}

function populateModels(provider) {
  const modelSelect = document.getElementById('aiModel');
  modelSelect.innerHTML = '';
  AI_MODELS[provider].forEach(model => {
    const opt = document.createElement('option');
    opt.value = model;
    opt.textContent = model;
    modelSelect.appendChild(opt);
  });
  if (AI_MODELS[provider] && AI_MODELS[provider].length > 0) {
    modelSelect.value = AI_MODELS[provider][0];
  }
}

document.getElementById('btn-dummy').addEventListener('click', async () => {
  document.getElementById('firstName').value = 'John';
  document.getElementById('lastName').value = 'Doe';
  document.getElementById('email').value = 'john.doe@example.com';
  document.getElementById('phone').value = '555-123-4567';
  document.getElementById('linkedin').value = 'https://linkedin.com/in/johndoe';
  document.getElementById('github').value = 'https://github.com/johndoe';
  document.getElementById('portfolio').value = 'https://johndoe.com';
  document.getElementById('currentCompany').value = 'Acme Corp';
  document.getElementById('currentTitle').value = 'Software Engineer';
  document.getElementById('yearsOfExperience').value = '5';
  document.getElementById('university').value = 'State University';
  document.getElementById('degree').value = 'Bachelor of Science';
  document.getElementById('fieldOfStudy').value = 'Computer Science';
  document.getElementById('graduationYear').value = '2020';
  document.getElementById('salaryExpectation').value = '$120,000';
  document.getElementById('startDate').value = '2 Weeks Notice';
  document.getElementById('workAuthorization').value = 'Authorized to work without sponsorship';
  
  
  await saveProfileFromUI();
  showSaveStatus();
});

async function loadFiles() {
  const library = await globalThis.IndexedDBStore.getFileLibrary();
  const list = document.getElementById('file-list');
  list.innerHTML = '';
  library.forEach(file => {
    const div = document.createElement('div');
    div.className = 'file-item';
    div.innerHTML = `
      <div>
        <strong>${file.originalFileName}</strong> (${(file.sizeBytes / 1024).toFixed(1)} KB)<br>
        <small>${file.typeTag} ${file.isDefaultForType ? '<svg width="12" height="12" viewBox="0 0 24 24" fill="#FF9500" stroke="#FF9500" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align: middle; margin-right: 2px;"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon></svg> Default' : ''}</small>
      </div>
      <div>
        <button class="btn-delete-file" data-id="${file.id}">Delete</button>
      </div>
    `;
    list.appendChild(div);
  });
  
  document.querySelectorAll('.btn-delete-file').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      await globalThis.IndexedDBStore.deleteFile(e.target.dataset.id);
      loadFiles();
    });
  });
}

document.getElementById('fileUpload').addEventListener('change', async (e) => {
  const file = e.target.files[0];
  if (!file) return;
  if (file.size > 5 * 1024 * 1024) { alert("File exceeds 5MB limit"); return; }
  if (file.type !== 'application/pdf') { alert("Only PDF files are allowed"); return; }
  
  const library = await globalThis.IndexedDBStore.getFileLibrary();
  if (library.length >= 15) { alert("Maximum 15 files allowed. Please delete a file first."); return; }

  const typeTag = document.getElementById('fileUploadType').value;
  const isDefault = document.getElementById('fileUploadDefault').checked;

  const buffer = await file.arrayBuffer();
  const entry = {
    id: crypto.randomUUID(),
    displayName: file.name,
    typeTag: typeTag,
    isDefaultForType: isDefault,
    originalFileName: file.name,
    mimeType: file.type,
    sizeBytes: file.size,
    uploadedAt: new Date().toISOString()
  };
  
  await globalThis.IndexedDBStore.saveFile(entry, buffer);
  loadFiles();
});

document.addEventListener('DOMContentLoaded', async () => {
  const urlParams = new URLSearchParams(window.location.search);
  if (urlParams.get('onboarding') === 'true') {
    document.getElementById('onboarding-banner').style.display = 'block';
  }

  currentProfile = await globalThis.ProfileStore.getProfile();
  loadProfile();
  
  chrome.storage.local.get(['autoFillMode', 'aiProvider', 'aiModel', 'aiApiKey', 'geminiApiKey', 'darkMode'], (res) => {
    document.getElementById('autoFillMode').checked = res.autoFillMode || false;
    
    const isDark = res.darkMode || false;
    document.getElementById('checkbox-theme').checked = isDark;
    if (isDark) {
      document.body.classList.add('dark-theme');
    }

    // Attach auto-save to all inputs
    document.querySelectorAll('input, select, textarea').forEach(el => {
      if (el.type === 'file' || el.id === 'resume-select') return;
      if (el.id === 'checkbox-theme') {
        el.addEventListener('change', (e) => {
          if (e.target.checked) document.body.classList.add('dark-theme');
          else document.body.classList.remove('dark-theme');
          debouncedSave();
        });
        return;
      }
      el.addEventListener('input', debouncedSave);
      el.addEventListener('change', debouncedSave);
    });

    
    // Migration logic
    if (res.geminiApiKey && !res.aiApiKey) {
      chrome.storage.local.set({ aiProvider: 'gemini', aiApiKey: res.geminiApiKey });
      res.aiProvider = 'gemini';
      res.aiApiKey = res.geminiApiKey;
      chrome.storage.local.remove('geminiApiKey');
    }

    const providerSelect = document.getElementById('aiProvider');
    const modelSelect = document.getElementById('aiModel');
    
    providerSelect.value = res.aiProvider || 'gemini';
    populateModels(providerSelect.value);
    modelSelect.value = res.aiModel || AI_MODELS[providerSelect.value][0];
    
    document.getElementById('aiApiKey').value = res.aiApiKey || '';
    
    providerSelect.addEventListener('change', (e) => {
      populateModels(e.target.value);
    });
  });
  
  loadFiles();
});

document.getElementById('btn-autofill-resume').addEventListener('click', async () => {
  const library = await globalThis.IndexedDBStore.getFileLibrary();
  const resumes = library.filter(f => f.typeTag === 'RESUME');
  if (resumes.length === 0) {
    alert('Please upload a Resume in the Files tab first.');
    return;
  }
  
  const select = document.getElementById('resume-select');
  select.innerHTML = '';
  resumes.forEach(f => {
    const opt = document.createElement('option');
    opt.value = f.id;
    opt.textContent = f.originalFileName;
    select.appendChild(opt);
  });
  
  document.getElementById('resume-modal').style.display = 'flex';
});

document.getElementById('btn-resume-cancel').addEventListener('click', () => {
  document.getElementById('resume-modal').style.display = 'none';
  document.getElementById('resume-loading').style.display = 'none';
});

document.getElementById('btn-resume-start').addEventListener('click', async () => {
  const fileId = document.getElementById('resume-select').value;
  if (!fileId) return;
  
  document.getElementById('resume-loading').style.display = 'block';
  document.getElementById('btn-resume-start').disabled = true;
  
  try {
    const fileData = await globalThis.IndexedDBStore.getFileBuffer(fileId);
    if (!fileData) throw new Error('File not found in library');
    
    const apiKey = document.getElementById('aiApiKey').value.trim();
    const provider = document.getElementById('aiProvider').value;
    const model = document.getElementById('aiModel').value;
    const parsed = await globalThis.ResumeParser.parseResume(fileData, apiKey, provider, model);
    
    document.getElementById('firstName').value = parsed.personal.firstName || '';
    document.getElementById('lastName').value = parsed.personal.lastName || '';
    document.getElementById('email').value = parsed.personal.email || '';
    document.getElementById('phone').value = parsed.personal.phone || '';
    
    document.getElementById('linkedin').value = parsed.professional.linkedin || '';
    document.getElementById('github').value = parsed.professional.github || '';
    document.getElementById('portfolio').value = parsed.professional.portfolio || '';
    document.getElementById('currentCompany').value = parsed.professional.currentCompany || '';
    document.getElementById('currentTitle').value = parsed.professional.currentTitle || '';
    document.getElementById('yearsOfExperience').value = parsed.professional.yearsOfExperience || '';
    
    document.getElementById('university').value = parsed.education.university || '';
    document.getElementById('degree').value = parsed.education.degree || '';
    document.getElementById('fieldOfStudy').value = parsed.education.fieldOfStudy || '';
    document.getElementById('graduationYear').value = parsed.education.graduationYear || '';
    
    document.getElementById('resume-modal').style.display = 'none';
    
    await saveProfileFromUI();
    showSaveStatus();
    
    alert(apiKey ? 'Smart extraction complete!' : 'Basic offline extraction complete. Add an API key for full extraction.');
  } catch (err) {
    console.error(err);
    alert('Failed to parse resume: ' + err.message);
  } finally {
    document.getElementById('resume-loading').style.display = 'none';
    document.getElementById('btn-resume-start').disabled = false;
  }
});
