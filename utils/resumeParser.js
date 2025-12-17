const pdfParse = require('pdf-parse');
const mammoth = require('mammoth');

class ResumeParser {
  async parseFile(buffer, fileType) {
    let text = '';

    if (fileType === 'application/pdf') {
      text = await this.parsePDF(buffer);
    } else if (fileType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
      text = await this.parseDOCX(buffer);
    } else {
      throw new Error('Unsupported file type');
    }

    return this.extractData(text);
  }

  async parsePDF(buffer) {
    const data = await pdfParse(buffer);
    return data.text;
  }

  async parseDOCX(buffer) {
    const result = await mammoth.extractRawText({ buffer });
    return result.value;
  }

  extractData(text) {
    const extractedData = {
      name: this.extractName(text),
      email: this.extractEmail(text),
      phone: this.extractPhone(text),
      location: this.extractLocation(text),
      skills: this.extractSkills(text),
      education: this.extractEducation(text),
      experience: this.extractExperience(text)
    };

    return extractedData;
  }

  extractName(text) {
    // Extract name from the first few lines
    const lines = text.split('\n').filter(line => line.trim());
    if (lines.length > 0) {
      // First non-empty line is usually the name
      const firstLine = lines[0].trim();
      // Remove common titles
      return firstLine.replace(/^(Mr\.|Mrs\.|Ms\.|Dr\.|Prof\.)\s*/i, '');
    }
    return '';
  }

  extractEmail(text) {
    // Enhanced email regex with better matching
    const emailRegex = /([a-zA-Z0-9._-]+@[a-zA-Z0-9._-]+\.[a-zA-Z0-9_-]+)/gi;
    const emails = text.match(emailRegex);
    
    if (emails && emails.length > 0) {
      // Filter out common false positives and return the first valid email
      const validEmails = emails.filter(email => {
        return email.length > 5 && 
               !email.includes('example.com') && 
               !email.includes('domain.com') &&
               email.includes('.');
      });
      return validEmails[0] || '';
    }
    return '';
  }

  extractPhone(text) {
    // Multiple phone number patterns to catch different formats
    const phonePatterns = [
      // International format: +91 9876543210, +1-234-567-8900
      /\+?\d{1,4}[-.\s]?\(?\d{1,4}\)?[-.\s]?\d{1,4}[-.\s]?\d{1,4}[-.\s]?\d{1,9}/g,
      // US format: (123) 456-7890, 123-456-7890
      /\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/g,
      // Indian format: 9876543210, 98765-43210
      /\b\d{5}[-.\s]?\d{5}\b/g,
      // General 10 digit: 1234567890
      /\b\d{10}\b/g,
    ];

    for (const pattern of phonePatterns) {
      const phones = text.match(pattern);
      if (phones && phones.length > 0) {
        // Return first phone that looks valid (has at least 10 digits)
        const validPhone = phones.find(phone => {
          const digitCount = phone.replace(/\D/g, '').length;
          return digitCount >= 10 && digitCount <= 15;
        });
        if (validPhone) return validPhone.trim();
      }
    }
    return '';
  }

  extractLocation(text) {
    // Strategy 1: Look for explicit location labels (most reliable)
    const locationPatterns = [
      /(?:Location|Current Location|City|Address|Based in|Residing in|Lives in)[\s:]+([A-Za-z\s,.-]+?)(?:\n|$|[|\u2022])/i,
      /(?:Location|Current Location|City|Address)[\s:]+([^|\n\u2022]+?)(?:\n|$|[|\u2022])/i
    ];

    for (const pattern of locationPatterns) {
      const match = text.match(pattern);
      if (match && match[1]) {
        let location = match[1].trim();
        // Clean up: remove extra whitespace, trailing punctuation
        location = location.replace(/[.,;]+$/, '').trim();
        // Validate: should be reasonable length and contain letters
        if (location.length >= 3 && location.length <= 100 && /[a-zA-Z]/.test(location)) {
          return location;
        }
      }
    }

    // Strategy 2: Look for Indian city patterns (common in your data)
    const indianCities = [
      'Mumbai', 'Delhi', 'Bangalore', 'Bengaluru', 'Hyderabad', 'Chennai', 'Kolkata', 'Pune', 
      'Ahmedabad', 'Surat', 'Jaipur', 'Lucknow', 'Kanpur', 'Nagpur', 'Indore', 'Thane', 
      'Bhopal', 'Visakhapatnam', 'Vijayawada', 'Pimpri', 'Patna', 'Vadodara', 'Ghaziabad',
      'Ludhiana', 'Agra', 'Nashik', 'Faridabad', 'Meerut', 'Rajkot', 'Varanasi', 'Srinagar',
      'Aurangabad', 'Dhanbad', 'Amritsar', 'Allahabad', 'Ranchi', 'Howrah', 'Coimbatore',
      'Jabalpur', 'Gwalior', 'Vijayawada', 'Jodhpur', 'Madurai', 'Raipur', 'Kota', 'Guwahati',
      'Chandigarh', 'Thiruvananthapuram', 'Solapur', 'Tiruchirappalli', 'Tiruppur', 'Moradabad',
      'Mysore', 'Bareilly', 'Gurgaon', 'Aligarh', 'Jalandhar', 'Bhubaneswar', 'Salem', 'Warangal',
      'Guntur', 'Bhiwandi', 'Saharanpur', 'Gorakhpur', 'Bikaner', 'Amravati', 'Noida', 'Jamshedpur',
      'Bhilai', 'Cuttack', 'Firozabad', 'Kochi', 'Nellore', 'Bhavnagar', 'Dehradun', 'Durgapur',
      'Rajahmundry', 'Tirupati', 'Kadapa', 'Kakinada', 'Suryapet', 'Panruti', 'Gudivada', 'Kodad',
      'Eluru', 'Salur', 'Adoni', 'Nirmal', 'Khammam', 'Anantapur', 'Karimnagar'
    ];

    const lowerText = text.toLowerCase();
    for (const city of indianCities) {
      const cityLower = city.toLowerCase();
      // Look for city name with word boundaries
      const regex = new RegExp(`\\b${this.escapeRegex(cityLower)}\\b`, 'i');
      if (regex.test(lowerText)) {
        // Try to get the full location context around the city
        const contextRegex = new RegExp(`([^\\n]{0,30}\\b${this.escapeRegex(cityLower)}\\b[^\\n]{0,30})`, 'i');
        const contextMatch = text.match(contextRegex);
        if (contextMatch) {
          let location = contextMatch[1].trim();
          // Clean common prefixes/suffixes
          location = location.replace(/^[•\-*\s:|]+/, '').replace(/[•\-*\s:|]+$/, '').trim();
          // If too long or contains multiple sentences, just return the city
          if (location.length > 60 || location.includes('.') || location.includes('experience')) {
            return city;
          }
          return location || city;
        }
        return city;
      }
    }

    // Strategy 3: Look for US-style city, state patterns
    const cityStateRegex = /\b([A-Z][a-z]+(?:\s[A-Z][a-z]+)*),\s*([A-Z]{2})\b/g;
    const cityStateMatches = text.match(cityStateRegex);
    if (cityStateMatches && cityStateMatches.length > 0) {
      // Return the first match that's not a date or other common false positive
      for (const match of cityStateMatches) {
        if (!match.match(/\d{2},\s*\d{2}/) && !match.includes('January') && !match.includes('February')) {
          return match;
        }
      }
    }

    // Strategy 4: Look in the first few lines (often contains contact info)
    const firstLines = text.split('\n').slice(0, 10).join('\n');
    const emailLineMatch = firstLines.match(/[\w.-]+@[\w.-]+\.\w+\s*([A-Za-z\s,.-]{3,50}?)(?:\n|$)/);
    if (emailLineMatch && emailLineMatch[1]) {
      const location = emailLineMatch[1].trim().replace(/[.,;|]+$/, '').trim();
      if (location.length >= 3 && location.length <= 50 && /[a-zA-Z]/.test(location)) {
        return location;
      }
    }

    return '';
  }

  escapeRegex(str) {
    // Escape special regex characters
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  extractSkills(text) {
    const skillsSection = this.extractSection(text, ['skills', 'technical skills', 'core competencies', 'expertise', 'technologies', 'proficiencies']);
    
    const skills = new Set();
    
    // Expanded common skill keywords
    const commonSkills = [
      'JavaScript', 'TypeScript', 'Python', 'Java', 'C++', 'C#', 'Ruby', 'PHP', 'Swift', 'Kotlin', 'Go', 'Rust', 'Scala', 'R', 'MATLAB',
      'React', 'React.js', 'Angular', 'Vue', 'Vue.js', 'Node.js', 'Express', 'Next.js', 'Nuxt.js',
      'Django', 'Flask', 'FastAPI', 'Spring', 'Spring Boot', 'Laravel', 'ASP.NET', '.NET Core',
      'HTML', 'HTML5', 'CSS', 'CSS3', 'SASS', 'SCSS', 'LESS', 'Tailwind', 'Bootstrap', 'Material UI',
      'MongoDB', 'MySQL', 'PostgreSQL', 'Redis', 'Oracle', 'SQL Server', 'SQLite', 'DynamoDB', 'Cassandra',
      'AWS', 'Azure', 'GCP', 'Google Cloud', 'Docker', 'Kubernetes', 'Jenkins', 'CI/CD', 'DevOps',
      'Git', 'GitHub', 'GitLab', 'Bitbucket', 'SVN',
      'Agile', 'Scrum', 'Kanban', 'Jira', 'Confluence',
      'Machine Learning', 'Deep Learning', 'AI', 'Artificial Intelligence', 'Data Science', 'NLP', 'Computer Vision',
      'TensorFlow', 'PyTorch', 'Keras', 'scikit-learn', 'Pandas', 'NumPy',
      'REST API', 'RESTful', 'GraphQL', 'Microservices', 'SOA', 'Cloud Computing',
      'Linux', 'Unix', 'Windows Server', 'Shell Scripting', 'Bash', 'PowerShell',
      'Testing', 'Unit Testing', 'Jest', 'Mocha', 'Selenium', 'Cypress', 'JUnit',
      'Webpack', 'Babel', 'Vite', 'npm', 'yarn', 'pnpm'
    ];

    if (skillsSection) {
      const skillsText = skillsSection.toLowerCase();

      // Match against common skills
      commonSkills.forEach(skill => {
        const escapedSkill = this.escapeRegex(skill.toLowerCase());
        const regex = new RegExp(`\\b${escapedSkill}\\b`, 'gi');
        if (regex.test(skillsText)) {
          skills.add(skill);
        }
      });

      // Extract bullet points
      const bulletPoints = skillsSection.match(/[•\-*◦▪]\s*([^\n]+)/g);
      if (bulletPoints) {
        bulletPoints.forEach(point => {
          const cleaned = point.replace(/[•\-*◦▪]\s*/, '').trim();
          // Split by comma, semicolon, or pipe
          const splitSkills = cleaned.split(/[,;|]/);
          splitSkills.forEach(skill => {
            const trimmed = skill.trim();
            if (trimmed.length > 2 && trimmed.length < 50 && !trimmed.match(/^\d+$/)) {
              skills.add(trimmed);
            }
          });
        });
      }

      // Extract comma-separated skills
      const lines = skillsSection.split('\n');
      lines.forEach(line => {
        if (line.includes(',') && !line.match(/^\s*(Education|Experience|Work|Employment)/i)) {
          const lineSkills = line.split(',');
          lineSkills.forEach(skill => {
            const cleaned = skill.trim().replace(/^[•\-*◦▪]\s*/, '');
            if (cleaned.length > 2 && cleaned.length < 50 && !cleaned.match(/^\d+$/) && !cleaned.match(/^(and|or|the|a|an)\b/i)) {
              skills.add(cleaned);
            }
          });
        }
      });
    }

    // If no skills section found, try to find skills in entire text
    if (skills.size === 0) {
      const lowerText = text.toLowerCase();
      commonSkills.forEach(skill => {
        const escapedSkill = this.escapeRegex(skill.toLowerCase());
        const regex = new RegExp(`\\b${escapedSkill}\\b`, 'gi');
        if (regex.test(lowerText)) {
          skills.add(skill);
        }
      });
    }

    return Array.from(skills).slice(0, 30); // Return up to 30 unique skills
  }

  extractEducation(text) {
    const educationSection = this.extractSection(text, ['education', 'academic', 'qualification']);
    
    if (!educationSection) return [];

    const education = [];
    const lines = educationSection.split('\n').filter(line => line.trim());

    // Common degree patterns
    const degreeRegex = /(Bachelor|Master|PhD|Doctorate|B\.S\.|M\.S\.|B\.A\.|M\.A\.|B\.Tech|M\.Tech|MBA|BBA|Associate)[^\.]*(?:\.|in|of)\s*([^\n]+)/gi;
    const degrees = educationSection.match(degreeRegex);
    
    if (degrees) {
      degrees.forEach(degree => {
        education.push(degree.trim());
      });
    }

    // If no degrees found, take bullet points or lines
    if (education.length === 0) {
      lines.forEach(line => {
        if (line.length > 10 && /\d{4}/.test(line)) { // Contains year
          education.push(line.trim());
        }
      });
    }

    return education.slice(0, 5);
  }

  extractExperience(text) {
    const experienceSection = this.extractSection(text, [
      'experience', 'work experience', 'employment', 'work history', 'professional experience'
    ]);
    
    if (!experienceSection) return [];

    const experience = [];
    const lines = experienceSection.split('\n').filter(line => line.trim());

    let currentEntry = '';
    lines.forEach(line => {
      const trimmed = line.trim();
      
      // Check if line contains dates (likely a job entry)
      if (/\d{4}/.test(trimmed) || /\b(present|current)\b/i.test(trimmed)) {
        if (currentEntry) {
          experience.push(currentEntry.trim());
        }
        currentEntry = trimmed;
      } else if (currentEntry && trimmed.length > 5) {
        currentEntry += ' ' + trimmed;
      } else if (!currentEntry && trimmed.length > 10) {
        currentEntry = trimmed;
      }
    });

    if (currentEntry) {
      experience.push(currentEntry.trim());
    }

    return experience.slice(0, 10);
  }

  extractSection(text, keywords) {
    const lowerText = text.toLowerCase();
    
    for (const keyword of keywords) {
      const regex = new RegExp(`\\b${keyword}\\b[:\\s]*`, 'i');
      const match = lowerText.search(regex);
      
      if (match !== -1) {
        // Find the next section header or end of text
        const nextSectionRegex = /\n\s*\n[A-Z][A-Za-z\s]+:/g;
        nextSectionRegex.lastIndex = match + keyword.length;
        const nextMatch = nextSectionRegex.exec(lowerText);
        
        const endIndex = nextMatch ? nextMatch.index : match + 1500; // Get next 1500 chars if no next section
        return text.substring(match, endIndex);
      }
    }
    
    return null;
  }
}

module.exports = new ResumeParser();
