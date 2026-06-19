globalThis.ProfileStore = {
  getProfile: async function() {
    let result = {};
    try {
      if (!chrome || !chrome.storage || !chrome.storage.local) {
        console.warn('[AutoFill] Extension context invalidated (chrome.storage missing). Please refresh the page. Returning default profile.');
        return this.getDefaultProfile();
      }
      result = await chrome.storage.local.get('userProfile');
    } catch (e) {
      if (e.message && e.message.includes('Extension context invalidated')) {
        console.warn('[AutoFill] Extension context invalidated. Please refresh the page. Returning default profile to prevent crash.');
        return this.getDefaultProfile();
      }
      throw e;
    }
    
    const def = this.getDefaultProfile();
    if (!result.userProfile) return def;
    
    const merged = def;
    if (result.userProfile.personal) {
      const mergedAddress = Object.assign({}, merged.personal.address, result.userProfile.personal.address);
      Object.assign(merged.personal, result.userProfile.personal);
      merged.personal.address = mergedAddress;
    }
    if (result.userProfile.professional) Object.assign(merged.professional, result.userProfile.professional);
    if (result.userProfile.education) Object.assign(merged.education, result.userProfile.education);
    if (result.userProfile.preferences) Object.assign(merged.preferences, result.userProfile.preferences);
    if (result.userProfile.meta) Object.assign(merged.meta, result.userProfile.meta);
    
    return merged;
  },

  saveProfile: async function(profile) {
    profile.meta = profile.meta || {};
    profile.meta.updatedAt = new Date().toISOString();
    await chrome.storage.local.set({ userProfile: profile });
  },

  clearProfile: async function() {
    await chrome.storage.local.remove('userProfile');
  },

  getDefaultProfile: function() {
    return {
      personal: {
        firstName: '', middleName: '', lastName: '', preferredName: '', email: '', phone: '', birthday: '', pronouns: '',
        gender: '', ethnicity: '', veteranStatus: '', disabilityStatus: '',
        address: { line1: '', line2: '', city: '', state: '', zip: '', country: '' }
      },
      professional: {
        linkedin: '', github: '', portfolio: '', currentCompany: '', currentTitle: '', yearsOfExperience: 0
      },
      education: {
        university: '', degree: '', faculty: '', fieldOfStudy: '', studentLevel: '', gpa: '', graduationYear: null
      },
      preferences: {
        salaryExpectation: '', startDate: '', noticePeriod: '', relocation: '', travelPercentage: '', languages: '', workAuthorization: '', aiInstructions: ''
      },
      meta: {
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        schemaVersion: 2
      }
    };
  }
};
