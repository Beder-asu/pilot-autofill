globalThis.ResumeParser = (function () {

  async function extractTextFromPDF(arrayBuffer) {
    if (!globalThis.pdfjsLib) {
      throw new Error('PDF.js library not loaded');
    }
    if (!globalThis.pdfjsLib.GlobalWorkerOptions.workerSrc) {
      if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.getURL) {
        globalThis.pdfjsLib.GlobalWorkerOptions.workerSrc = chrome.runtime.getURL('lib/pdf.worker.min.js');
      } else {
        // Fallback for local testing via test-parser.html
        globalThis.pdfjsLib.GlobalWorkerOptions.workerSrc = 'lib/pdf.worker.min.js';
      }
    }
    const loadingTask = globalThis.pdfjsLib.getDocument({ data: new Uint8Array(arrayBuffer) });
    const pdf = await loadingTask.promise;

    let fullText = '';
    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const textContent = await page.getTextContent();
      
      let lastY, text = '';
      for (const item of textContent.items) {
        if (lastY !== undefined && Math.abs(item.transform[5] - lastY) > 4) {
          text += '\n';
        } else if (lastY !== undefined) {
          text += ' ';
        }
        // Clean up strange PDF letter spacing (e.g., "M OHAMED") by trimming but keeping spaces
        text += item.str;
        lastY = item.transform[5];
      }
      
      // Clean up strange PDF letter spacing (e.g., "M OHAMED")
      let cleanedText = text.replace(/  +/g, ' __SPACE__ ');
      // Fix first-letter detached bug: "P ROJECTS" -> "PROJECTS", "M OHAMED" -> "MOHAMED"
      cleanedText = cleanedText.replace(/\b([A-Z]) ([A-Za-z]+)\b/g, '$1$2');
      cleanedText = cleanedText.replace(/ __SPACE__ /g, ' ');

      fullText += cleanedText + '\n';
    }

    return fullText;
  }

  function runOfflineHeuristics(text) {
    const result = {
      firstName: '',
      lastName: '',
      email: '',
      phone: '',
      linkedin: '',
      github: '',
      portfolio: '',
      university: '',
      degree: '',
      fieldOfStudy: '',
      currentTitle: '',
      yearsOfExperience: 0
    };

    const broadPhoneMatch = text.match(/(?:\+?\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/);
    if (broadPhoneMatch) result.phone = broadPhoneMatch[0].trim();

    const emailMatch = text.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/);
    if (emailMatch) result.email = emailMatch[0].trim();

    const linkedinMatch = text.match(/(?:https?:\/\/)?(?:www\.)?linkedin\.com\/in\/[\w-]+\/?/i);
    if (linkedinMatch) {
      let url = linkedinMatch[0].trim();
      if (!url.startsWith('http')) url = 'https://' + url;
      result.linkedin = url;
    }

    const githubMatch = text.match(/(?:https?:\/\/)?(?:www\.)?github\.com\/[\w-]+\/?/i);
    if (githubMatch) {
      let url = githubMatch[0].trim();
      if (!url.startsWith('http')) url = 'https://' + url;
      result.github = url;
    }
    
    const urlMatches = text.match(/https?:\/\/(?:www\.)?[-a-zA-Z0-9@:%._\+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b(?:[-a-zA-Z0-9()@:%_\+.~#?&//=]*)/gi);
    if (urlMatches) {
      for (const url of urlMatches) {
        if (!url.toLowerCase().includes('github.com') && !url.toLowerCase().includes('linkedin.com')) {
          result.portfolio = url;
          break;
        }
      }
    }

    const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 0);
    const ignoreWords = ['resume', 'cv', 'curriculum vitae', 'page'];
    
    for (let i = 0; i < Math.min(lines.length, 10); i++) {
      const line = lines[i];
      const lowerLine = line.toLowerCase();
      
      if (ignoreWords.some(w => lowerLine.includes(w))) continue;
      if (line.includes('@') || (broadPhoneMatch && line.includes(broadPhoneMatch[0]))) continue;
      
      const words = line.split(/\s+/);
      if (words.length >= 2 && words.length <= 4) {
        const isNameLike = words.every(w => /^[A-Za-z-']+$/.test(w));
        if (isNameLike) {
          result.firstName = words[0];
          result.lastName = words.slice(1).join(' ');
          break;
        }
      }
    }

    for (const line of lines) {
      const lowerLine = line.toLowerCase();
      // Require line to be somewhat short to avoid grabbing full paragraphs
      if (line.length < 80 && !result.university && (lowerLine.includes('university') || lowerLine.includes('college') || lowerLine.includes('institute') || lowerLine.includes('academy'))) {
        result.university = line;
      }
      
      if (line.length < 100 && !result.degree && (lowerLine.includes('bachelor') || lowerLine.includes('master') || lowerLine.includes('b.s') || lowerLine.includes('b.a') || lowerLine.includes('m.s') || lowerLine.includes('ph.d'))) {
        result.degree = line;
        
        const inIndex = lowerLine.indexOf(' in ');
        if (inIndex !== -1) {
          result.fieldOfStudy = line.substring(inIndex + 4).trim();
        }
      }
    }

    const commonTitles = ['software engineer', 'developer', 'manager', 'director', 'designer', 'analyst', 'administrator', 'data scientist'];
    for (const line of lines) {
      const lowerLine = line.toLowerCase();
      if (commonTitles.some(t => lowerLine.includes(t)) 
          && line.length < 50 
          && !lowerLine.includes('university') 
          && !lowerLine.includes('seeking') 
          && !lowerLine.includes('internship') 
          && !line.endsWith('.') 
          && line !== result.degree) {
        result.currentTitle = line;
        break;
      }
    }

    const experienceTextLines = lines.filter(l => {
      const low = l.toLowerCase();
      return !low.includes('university') && !low.includes('college') && !low.includes('bachelor') && !low.includes('degree') && !low.includes('education');
    });
    
    const yearMatches = experienceTextLines.join(' ').match(/\b(19|20)\d{2}\b/g);
    if (yearMatches && yearMatches.length > 1) {
      const years = yearMatches.map(Number);
      const minYear = Math.min(...years);
      let maxYear = Math.max(...years);
      
      if (text.toLowerCase().includes('present') || text.toLowerCase().includes('current')) {
        maxYear = new Date().getFullYear();
      }
      
      const exp = maxYear - minYear;
      if (exp > 0 && exp < 40) {
        result.yearsOfExperience = exp;
      }
    }

    return result;
  }

  async function runLLMExtraction(text, apiKey, provider, model) {
    const prompt = `You are an expert resume parser. Extract information from the resume text provided below. If a field is not found, use an empty string or 0 for numbers.\n\nResume Text:\n"""\n${text}\n"""`;

    const standardJsonSchema = {
      type: "object",
      properties: {
        personal: {
          type: "object",
          properties: {
            firstName: { type: "string" }, lastName: { type: "string" }, email: { type: "string" }, phone: { type: "string" },
            address: { type: "object", properties: { line1: { type: "string" }, line2: { type: "string" }, city: { type: "string" }, state: { type: "string" }, zip: { type: "string" }, country: { type: "string" } }, required: ["line1", "line2", "city", "state", "zip", "country"], additionalProperties: false }
          },
          required: ["firstName", "lastName", "email", "phone", "address"],
          additionalProperties: false
        },
        professional: {
          type: "object",
          properties: { linkedin: { type: "string" }, github: { type: "string" }, portfolio: { type: "string" }, currentCompany: { type: "string" }, currentTitle: { type: "string" }, yearsOfExperience: { type: "integer" } },
          required: ["linkedin", "github", "portfolio", "currentCompany", "currentTitle", "yearsOfExperience"],
          additionalProperties: false
        },
        education: {
          type: "object",
          properties: { university: { type: "string" }, degree: { type: "string" }, fieldOfStudy: { type: "string" }, graduationYear: { type: "integer" } },
          required: ["university", "degree", "fieldOfStudy", "graduationYear"],
          additionalProperties: false
        }
      },
      required: ["personal", "professional", "education"],
      additionalProperties: false
    };

    const geminiSchema = {
      type: "OBJECT",
      properties: {
        personal: {
          type: "OBJECT",
          properties: {
            firstName: { type: "STRING" }, lastName: { type: "STRING" }, email: { type: "STRING" }, phone: { type: "STRING" },
            address: { type: "OBJECT", properties: { line1: { type: "STRING" }, line2: { type: "STRING" }, city: { type: "STRING" }, state: { type: "STRING" }, zip: { type: "STRING" }, country: { type: "STRING" } } }
          }
        },
        professional: {
          type: "OBJECT",
          properties: { linkedin: { type: "STRING" }, github: { type: "STRING" }, portfolio: { type: "STRING" }, currentCompany: { type: "STRING" }, currentTitle: { type: "STRING" }, yearsOfExperience: { type: "INTEGER" } }
        },
        education: {
          type: "OBJECT",
          properties: { university: { type: "STRING" }, degree: { type: "STRING" }, fieldOfStudy: { type: "STRING" }, graduationYear: { type: "INTEGER" } }
        }
      }
    };

    try {
      let rawJson = '';

      if (provider === 'gemini') {
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: { 
              temperature: 0.1,
              responseMimeType: "application/json",
              responseSchema: geminiSchema
            }
          })
        });
        if (!response.ok) {
          const errText = await response.text();
          throw new Error(`Gemini API Error: ${response.status} - ${errText}`);
        }
        const data = await response.json();
        rawJson = data.candidates[0].content.parts[0].text;
        
      } else if (provider === 'openai') {
        const response = await fetch(`https://api.openai.com/v1/chat/completions`, {
          method: 'POST',
          headers: { 
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`
          },
          body: JSON.stringify({
            model: model,
            messages: [{ role: 'user', content: prompt }],
            temperature: 0.1,
            response_format: {
              type: "json_schema",
              json_schema: {
                name: "resume_extraction",
                strict: true,
                schema: standardJsonSchema
              }
            }
          })
        });
        if (!response.ok) throw new Error(`OpenAI API Error: ${response.status}`);
        const data = await response.json();
        rawJson = data.choices[0].message.content;
        
      } else if (provider === 'anthropic') {
        const response = await fetch(`https://api.anthropic.com/v1/messages`, {
          method: 'POST',
          headers: { 
            'Content-Type': 'application/json',
            'x-api-key': apiKey,
            'anthropic-version': '2023-06-01',
            'anthropic-dangerously-allow-urls': 'true'
          },
          body: JSON.stringify({
            model: model,
            max_tokens: 1024,
            messages: [{ role: 'user', content: prompt }],
            temperature: 0.1,
            tools: [
              {
                name: "extract_resume",
                description: "Extracts structured data from a resume",
                input_schema: standardJsonSchema
              }
            ],
            tool_choice: { type: "tool", name: "extract_resume" }
          })
        });
        if (!response.ok) throw new Error(`Anthropic API Error: ${response.status}`);
        const data = await response.json();
        // Anthropic returns the tool call arguments as JSON
        const toolCall = data.content.find(block => block.type === 'tool_use');
        if (toolCall) {
          rawJson = JSON.stringify(toolCall.input);
        } else {
          throw new Error('Anthropic did not return a tool call');
        }
      }

      // Safe parse since APIs are now strictly typed
      return JSON.parse(rawJson);
    } catch (e) {
      console.error('[ResumeParser] LLM extraction failed:', e);
      return null;
    }
  }

  async function parseResume(arrayBuffer, apiKey, provider = 'gemini', model = 'gemini-2.5-flash') {
    const text = await extractTextFromPDF(arrayBuffer);
    const offlineResult = runOfflineHeuristics(text);

    let finalProfile = {
      personal: { firstName: offlineResult.firstName, lastName: offlineResult.lastName, email: offlineResult.email, phone: offlineResult.phone, address: { line1: '', line2: '', city: '', state: '', zip: '', country: '' } },
      professional: { linkedin: offlineResult.linkedin, github: offlineResult.github, portfolio: offlineResult.portfolio, currentCompany: '', currentTitle: offlineResult.currentTitle, yearsOfExperience: offlineResult.yearsOfExperience },
      education: { university: offlineResult.university, degree: offlineResult.degree, fieldOfStudy: offlineResult.fieldOfStudy, graduationYear: 0 }
    };

    if (apiKey) {
      const llmResult = await runLLMExtraction(text, apiKey, provider, model);
      if (llmResult) {
        finalProfile.personal.firstName = llmResult.personal?.firstName || finalProfile.personal.firstName;
        finalProfile.personal.lastName = llmResult.personal?.lastName || finalProfile.personal.lastName;
        finalProfile.personal.email = llmResult.personal?.email || finalProfile.personal.email;
        finalProfile.personal.phone = llmResult.personal?.phone || finalProfile.personal.phone;
        finalProfile.personal.address = llmResult.personal?.address || finalProfile.personal.address;

        finalProfile.professional.linkedin = llmResult.professional?.linkedin || finalProfile.professional.linkedin;
        finalProfile.professional.github = llmResult.professional?.github || finalProfile.professional.github;
        finalProfile.professional.portfolio = llmResult.professional?.portfolio || finalProfile.professional.portfolio;
        finalProfile.professional.currentCompany = llmResult.professional?.currentCompany || '';
        finalProfile.professional.currentTitle = llmResult.professional?.currentTitle || '';
        finalProfile.professional.yearsOfExperience = llmResult.professional?.yearsOfExperience || 0;

        finalProfile.education = llmResult.education || finalProfile.education;
      }
    }

    return finalProfile;
  }

  return { parseResume };
})();
