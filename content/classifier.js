globalThis.Classifier = (function() {
  const ALIAS_DICTIONARY = {
    FIRST_NAME: {
      en: ['first name', 'firstname', 'fname', 'given name', 'givenname', 'first', 'forename', 'legal first name', 'name (first)', 'your first name'],
      ar: ['الاسم الأول', 'اسمك الأول', 'الاسم', 'اسم'],
      autocomplete: 'given-name'
    },
    LAST_NAME: {
      en: ['last name', 'lastname', 'lname', 'surname', 'family name', 'familyname', 'last', 'your last name', 'name (last)'],
      ar: ['اسم العائلة', 'الاسم الأخير', 'اللقب', 'الكنية'],
      autocomplete: 'family-name'
    },
    MIDDLE_NAME: {
      en: ['middle name', 'middlename', 'mname', 'middle initial', 'middle'],
      ar: ['الاسم الأوسط', 'اسم الأب'],
      autocomplete: 'additional-name'
    },
    PREFERRED_NAME: {
      en: ['preferred name', 'nickname', 'known as', 'goes by', 'preferred first name'],
      ar: ['الاسم المفضل', 'اسم الشهرة', 'اللقب المفضل']
    },
    PRONOUNS: {
      en: ['pronoun', 'pronouns', 'preferred pronouns', 'gender pronouns'],
      ar: ['الضمائر', 'ضمائر المخاطبة']
    },
    BIRTHDAY: {
      en: ['birthday', 'date of birth', 'dob', 'birth date', 'birthdate'],
      ar: ['تاريخ الميلاد', 'يوم الميلاد'],
      autocomplete: 'bday'
    },
    FULL_NAME: {
      en: ['full name', 'fullname', 'name', 'your name', 'complete name', 'legal name'],
      ar: ['الاسم الكامل', 'اسمك الكامل', 'الاسم بالكامل'],
      autocomplete: 'name'
    },
    EMAIL: {
      en: ['email', 'email address', 'e-mail', 'emailaddress', 'mail', 'work email', 'contact email', 'your email', 'email id'],
      ar: ['البريد الإلكتروني', 'إيميل', 'بريدك الإلكتروني', 'الإيميل'],
      autocomplete: 'email'
    },
    PHONE: {
      en: ['phone', 'phone number', 'phonenumber', 'mobile', 'mobile number', 'cell', 'cell phone', 'telephone', 'telephone number', 'contact number', 'contact phone', 'preferred contact number', 'best number', 'reach you at', 'tel'],
      ar: ['رقم الهاتف', 'الهاتف', 'موبايل', 'جوال', 'رقم التواصل', 'رقم الجوال', 'رقم المحمول', 'هاتفك'],
      autocomplete: 'tel'
    },
    ADDRESS_LINE_1: {
      en: ['address', 'address line 1', 'street address', 'address1', 'street', 'addr1'],
      ar: ['العنوان', 'عنوانك', 'الشارع', 'عنوان السكن'],
      autocomplete: 'address-line1'
    },
    ADDRESS_LINE_2: {
      en: ['address line 2', 'address2', 'apt', 'apartment', 'suite', 'unit', 'addr2'],
      ar: ['تفاصيل العنوان', 'الشقة', 'الوحدة'],
      autocomplete: 'address-line2'
    },
    CITY: {
      en: ['city', 'town', 'locality', 'city name'],
      ar: ['المدينة', 'مدينتك', 'البلدة'],
      autocomplete: 'address-level2'
    },
    STATE: {
      en: ['state', 'province', 'region', 'state or province', 'governorate'],
      ar: ['المحافظة', 'المنطقة', 'الولاية', 'محافظتك'],
      autocomplete: 'address-level1'
    },
    ZIP: {
      en: ['zip', 'zip code', 'zipcode', 'postal code', 'postalcode', 'postcode'],
      ar: ['الرمز البريدي', 'رمز بريدي'],
      autocomplete: 'postal-code'
    },
    COUNTRY: {
      en: ['country', 'country of residence', 'nation'],
      ar: ['الدولة', 'بلدك', 'جنسيتك', 'بلد الإقامة'],
      autocomplete: 'country'
    },
    LINKEDIN: {
      en: ['linkedin', 'linkedin url', 'linkedin profile', 'linkedin profile url', 'linkedin.com', 'linkedin handle'],
      ar: ['لينكدإن', 'ملف لينكدإن', 'رابط لينكدإن']
    },
    GITHUB: {
      en: ['github', 'github url', 'github profile', 'github.com', 'github handle', 'code repository'],
      ar: ['جيت هاب', 'رابط جيت هاب']
    },
    PORTFOLIO: {
      en: ['portfolio', 'portfolio url', 'personal website', 'website', 'personal site', 'online portfolio', 'work samples'],
      ar: ['الموقع الشخصي', 'ملف الأعمال', 'رابط الموقع']
    },
    RESUME: {
      en: ['resume', 'cv', 'curriculum vitae', 'upload resume', 'attach resume', 'resume upload', 'resume/cv', 'your resume', 'attach cv'],
      ar: ['السيرة الذاتية', 'ملف السيرة الذاتية', 'رفع السيرة الذاتية', 'ارفق سيرتك الذاتية'],
      type: 'file'
    },
    COVER_LETTER_TEXT: {
      en: ['cover letter', 'covering letter', 'motivation letter', 'statement of purpose', 'why do you want to work here', 'tell us about yourself', 'additional information'],
      ar: ['خطاب التقديم', 'رسالة التحفيز', 'عني', 'سيرة ذاتية قصيرة']
    },
    ESSAY_QUESTION: {
      en: ['why do you want', 'describe a time', 'tell us about a time', 'explain', 'how did you', 'what is your', 'essay', 'short answer', 'anything else'],
      ar: ['لماذا ترغب', 'صف موقفا', 'حدثنا عن', 'اشرح', 'كيف قمت', 'ما هو', 'مقالة', 'إجابة قصيرة', 'أي شيء آخر']
    },
    YEARS_OF_EXPERIENCE: {
      en: ['years of experience', 'experience', 'years experience', 'total experience', 'how many years', 'work experience (years)'],
      ar: ['سنوات الخبرة', 'خبرتك', 'عدد سنوات الخبرة']
    },
    CURRENT_COMPANY: {
      en: ['current company', 'current employer', 'company name', 'employer', 'organization', 'where do you work', 'current workplace'],
      ar: ['جهة العمل الحالية', 'اسم الشركة', 'الشركة الحالية']
    },
    CURRENT_TITLE: {
      en: ['current title', 'job title', 'current position', 'current role', 'title', 'position title', 'your title'],
      ar: ['المسمى الوظيفي', 'وظيفتك الحالية', 'المنصب الحالي']
    },
    GRADUATION_YEAR: {
      en: ['graduation year', 'year of graduation', 'expected graduation', 'graduating year', 'grad year'],
      ar: ['سنة التخرج', 'عام التخرج', 'تاريخ التخرج']
    },
    DEGREE: {
      en: ['degree', 'highest degree', 'level of education', 'qualification', 'degree earned'],
      ar: ['الدرجة العلمية', 'المؤهل', 'درجة التعليم']
    },
    UNIVERSITY: {
      autocomplete: 'organization',
      en: ['university', 'college', 'school', 'institution', 'alma mater', 'attended university', 'where did you study'],
      ar: ['الجامعة', 'الكلية', 'المؤسسة التعليمية']
    },
    FACULTY: {
      en: ['faculty', 'school of', 'college of', 'department'],
      ar: ['الكلية', 'كلية', 'القسم']
    },
    FIELD_OF_STUDY: {
      en: ['field of study', 'major', 'area of study', 'concentration', 'discipline', 'degree subject', 'studied'],
      ar: ['التخصص', 'مجال الدراسة', 'تخصصك']
    },
    STUDENT_LEVEL: {
      en: ['student level', 'academic year', 'current year', 'year of study', 'class standing', 'classification', 'academic standing'],
      ar: ['السنة الدراسية', 'المستوى الدراسي', 'الفرقة']
    },
    GPA: {
      en: ['gpa', 'grade point average', 'grade', 'cumulative gpa', 'overall gpa', 'score'],
      ar: ['المعدل التراكمي', 'التقدير', 'المعدل', 'الدرجة']
    },
    NATIONAL_ID: {
      en: ['national id', 'ssn', 'social security number', 'id number', 'national identity', 'cpr', 'civil id', 'aadhar', 'pan card', 'national identifier'],
      ar: ['الرقم القومي', 'رقم الهوية', 'الهوية الوطنية', 'الرقم المدني']
    },
    GENDER: {
      en: ['gender', 'sex', 'male or female'],
      ar: ['الجنس', 'النوع'],
      eeo: true
    },
    SALARY_EXPECTATION: {
      en: ['salary', 'expected salary', 'desired salary', 'salary expectation', 'compensation', 'desired compensation', 'expected ctc'],
      ar: ['الراتب المتوقع', 'توقعات الراتب', 'الراتب المطلوب']
    },
    START_DATE: {
      en: ['start date', 'available start', 'when can you start', 'earliest start', 'availability', 'join date'],
      ar: ['تاريخ البدء', 'متى يمكنك البدء', 'موعد الالتحاق']
    },
    NOTICE_PERIOD: {
      en: ['notice period', 'notice required', 'how much notice', 'availability to start'],
      ar: ['فترة الإشعار', 'مدة الإشعار', 'فترة الإنذار']
    },
    RELOCATION: {
      en: ['relocate', 'relocation', 'willing to relocate', 'willingness to relocate', 'open to relocation'],
      ar: ['الانتقال', 'استعداد للانتقال', 'الانتقال لمدينة أخرى']
    },
    TRAVEL_PERCENTAGE: {
      en: ['travel', 'travel percentage', 'willing to travel', 'willingness to travel', 'travel requirements'],
      ar: ['السفر', 'نسبة السفر', 'الاستعداد للسفر']
    },
    LANGUAGES: {
      en: ['language', 'languages', 'languages spoken', 'language proficiency'],
      ar: ['اللغات', 'اللغات التي تجيدها', 'إجادة اللغات']
    },
    ETHNICITY: {
      en: ['ethnicity', 'race', 'racial identity', 'ethnic background'],
      ar: ['العرق', 'الجنسية الأصلية'],
      eeo: true
    },
    VETERAN_STATUS: {
      en: ['veteran', 'veteran status', 'military status', 'armed forces', 'protected veteran'],
      ar: ['الخدمة العسكرية', 'موقف التجنيد', 'حالة التجنيد'],
      eeo: true
    },
    DISABILITY_STATUS: {
      en: ['disability', 'disability status', 'disabled', 'impairment'],
      ar: ['ذوي الاحتياجات الخاصة', 'إعاقة', 'حالة الإعاقة'],
      eeo: true
    },
    WORK_AUTHORIZATION: {
      en: ['work authorization', 'authorized to work', 'visa status', 'right to work', 'work permit', 'sponsorship required', 'require sponsorship'],
      ar: ['تصريح العمل', 'إذن العمل', 'حق العمل']
    },
    REFERRAL: {
      en: ['referral', 'referred by', 'how did you hear', 'how did you find', 'source', 'heard about us'],
      ar: ['كيف عرفت عنا', 'مصدر المعرفة', 'من أحالك']
    }
  };

  const WEIGHTS = {
    autocomplete: 100,
    labelText: 85,
    ariaLabel: 80,
    ariaLabelledby: 80,
    placeholder: 65,
    name: 60,
    id: 55,
    dataAttributes: 50,
    surroundingText: 40
  };

  function classify(fieldMeta) {
    if (fieldMeta.inputType === 'file') {
      return buildResult(fieldMeta, 'RESUME', 1.0, 'HIGH', 'overlay_file');
    }

    const scores = {};
    const matchedAliases = {};

    for (const [category, dict] of Object.entries(ALIAS_DICTIONARY)) {
      scores[category] = 0;
      matchedAliases[category] = [];
      
      if (dict.autocomplete && (fieldMeta.autocomplete || '').toLowerCase().split(/\s+/).includes(dict.autocomplete)) {
        scores[category] += WEIGHTS.autocomplete;
        matchedAliases[category].push({ alias: dict.autocomplete, language: 'en', source: 'autocomplete', weight: WEIGHTS.autocomplete });
      }

      const languagesToTest = [];
      if (fieldMeta.detectedLanguage === 'en' || fieldMeta.detectedLanguage === 'mixed' || fieldMeta.detectedLanguage === 'unknown') languagesToTest.push('en');
      if (fieldMeta.detectedLanguage === 'ar' || fieldMeta.detectedLanguage === 'mixed') languagesToTest.push('ar');

      languagesToTest.forEach(lang => {
        if (!dict[lang]) return;
        dict[lang].forEach(alias => {
          const normAlias = alias.toLowerCase().replace(/[^\w\s\u0600-\u06FF]/g, ' ').replace(/\s+/g, ' ').trim();
          
          const testSources = [
            { source: 'labelText', text: fieldMeta.labelText },
            { source: 'ariaLabel', text: fieldMeta.ariaLabel },
            { source: 'ariaLabelledby', text: fieldMeta.ariaLabelledby },
            { source: 'placeholder', text: fieldMeta.placeholder },
            { source: 'name', text: fieldMeta.name },
            { source: 'id', text: fieldMeta.id },
            { source: 'surroundingText', text: fieldMeta.surroundingText }
          ];

          Object.values(fieldMeta.dataAttributes).forEach(val => {
            testSources.push({ source: 'dataAttributes', text: val });
          });

          testSources.forEach(({ source, text }) => {
            if (!text || typeof text !== 'string' || text.trim() === '') return;
            const normText = text.toLowerCase().replace(/[^\w\s\u0600-\u06FF]/g, ' ').replace(/\s+/g, ' ').trim();
            if (!normText) return;
            if (normText === normAlias) {
              scores[category] += WEIGHTS[source] * 1.0;
              matchedAliases[category].push({ alias, language: lang, source, weight: WEIGHTS[source] * 1.0 });
            } else {
              const words = normText.split(/\s+/);
              const aliasWords = normAlias.split(/\s+/);
              let isMatch = false;
              if (aliasWords.length === 1) {
                isMatch = words.includes(aliasWords[0]);
              } else {
                isMatch = normText.includes(` ${normAlias} `) || normText.startsWith(`${normAlias} `) || normText.endsWith(` ${normAlias}`);
              }
              if (isMatch) {
                scores[category] += WEIGHTS[source] * 0.6;
                matchedAliases[category].push({ alias, language: lang, source, weight: WEIGHTS[source] * 0.6 });
              }
            }
          });
        });
      });
      
      // Heuristic boost for Textareas for Cover Letter & Essay questions
      if ((category === 'ESSAY_QUESTION' || category === 'COVER_LETTER_TEXT') && 
          (fieldMeta.tagName === 'TEXTAREA' || fieldMeta.inputType === 'contenteditable')) {
        if (scores[category] > 0) {
           scores[category] += 15;
        }
      }
    }

    const sorted = Object.entries(scores).sort((a, b) => b[1] - a[1]);
    const topCategory = sorted[0][0];
    const topScore = sorted[0][1];
    
    if (topScore === 0) {
      return buildResult(fieldMeta, 'UNKNOWN', 0, 'UNKNOWN', 'overlay');
    }

    let confidence = Math.min(topScore / 100, 1.0);
    
    let runnerUpCategory = sorted[1] ? sorted[1][0] : null;
    let runnerUpScore = sorted[1] ? sorted[1][1] : null;

    let band = 'LOW';
    if (confidence >= 0.75) band = 'HIGH';
    else if (confidence >= 0.40) band = 'MEDIUM';

    if (runnerUpScore && (topScore - runnerUpScore) <= 5) {
      band = 'MEDIUM'; 
    }

    let fillRoute = 'autofill';
    if (band === 'MEDIUM' || band === 'LOW') fillRoute = 'overlay';
    if (topCategory === 'RESUME') fillRoute = 'overlay_file';
    if (topCategory === 'COVER_LETTER_TEXT' || topCategory === 'ESSAY_QUESTION') fillRoute = 'overlay_cover_letter';
    if (ALIAS_DICTIONARY[topCategory].eeo) fillRoute = 'overlay_eeo';

    if (band === 'HIGH' && fillRoute === 'autofill') fillRoute = 'autofill';
    if (fieldMeta.element && fieldMeta.element.readOnly) {
       if (topCategory === 'BIRTHDAY' || topCategory === 'START_DATE') {
         fillRoute = 'overlay_cover_letter';
       } else if (fillRoute === 'autofill') {
         fillRoute = 'overlay'; 
       }
    }

    return {
      fieldFingerprint: fieldMeta.fingerprint,
      assignedCategory: topCategory,
      confidence: confidence,
      confidenceBand: band,
      topScore: topScore,
      runnerUpCategory,
      runnerUpScore,
      matchedAliases: matchedAliases[topCategory],
      fillRoute: fillRoute,
      classifiedAt: new Date().toISOString()
    };
  }

  function buildResult(fieldMeta, category, confidence, band, fillRoute) {
    return {
      fieldFingerprint: fieldMeta.fingerprint,
      assignedCategory: category,
      confidence,
      confidenceBand: band,
      topScore: 0,
      runnerUpCategory: null,
      runnerUpScore: null,
      matchedAliases: [],
      fillRoute,
      classifiedAt: new Date().toISOString()
    };
  }

  return { classify };
})();
