const SOAPClient = require('./soap-client');
const WSDLParser = require('./wsdl-parser');
const ConfigManager = require('./config-manager');

class SOAPClientWrapper {
  constructor() {
    this.client = new SOAPClient();
    this.parser = new WSDLParser();
    this.config = new ConfigManager();
  }

  async connect(wsdlUrl, options = {}) {
    try {
      const success = await this.client.connect(wsdlUrl, options);
      return { success, client: this.client };
    } catch (error) {
      return { 
        success: false, 
        error: error.message,
        details: error.stack 
      };
    }
  }

  async authenticate(username, password, method = 'basic') {
    try {
      const success = await this.client.authenticate(username, password, method);
      return { success };
    } catch (error) {
      return { 
        success: false, 
        error: error.message,
        details: error.stack 
      };
    }
  }

  async executeMethod(methodName, parameters = {}) {
    try {
      const result = await this.client.executeMethod(methodName, parameters);
      return { 
        success: true, 
        result,
        method: methodName,
        parameters 
      };
    } catch (error) {
      return { 
        success: false, 
        error: error.message,
        details: error.stack,
        method: methodName,
        parameters 
      };
    }
  }

  getAvailableMethods() {
    try {
      const methods = this.client.getAvailableMethods();
      return { success: true, methods };
    } catch (error) {
      return { 
        success: false, 
        error: error.message,
        methods: [] 
      };
    }
  }

  getMethodInfo(methodName) {
    try {
      const info = this.client.getMethodInfo(methodName);
      return { success: true, info };
    } catch (error) {
      return { 
        success: false, 
        error: error.message,
        info: null 
      };
    }
  }

  async parseWSDL(wsdlUrl) {
    try {
      const serviceInfo = await this.parser.parseWSDL(wsdlUrl);
      return { success: true, serviceInfo };
    } catch (error) {
      return { 
        success: false, 
        error: error.message,
        details: error.stack 
      };
    }
  }

  saveProfile(name, profileData) {
    try {
      this.config.saveProfile(name, profileData);
      return { success: true };
    } catch (error) {
      return { 
        success: false, 
        error: error.message 
      };
    }
  }

  getProfile(name) {
    try {
      const profile = this.config.getProfile(name);
      return { 
        success: !!profile, 
        profile: profile || null 
      };
    } catch (error) {
      return { 
        success: false, 
        error: error.message,
        profile: null 
      };
    }
  }

  listProfiles() {
    try {
      const profiles = this.config.listProfiles();
      return { success: true, profiles };
    } catch (error) {
      return { 
        success: false, 
        error: error.message,
        profiles: [] 
      };
    }
  }

  async connectWithRetry(wsdlUrl, options = {}, maxRetries = 3) {
    let lastError;
    
    for (let i = 0; i < maxRetries; i++) {
      try {
        const result = await this.connect(wsdlUrl, options);
        if (result.success) {
          return result;
        }
        lastError = result.error;
        
        if (i < maxRetries - 1) {
          const delay = Math.pow(2, i) * 1000; // Exponential backoff
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      } catch (error) {
        lastError = error.message;
      }
    }
    
    return { 
      success: false, 
      error: `Failed after ${maxRetries} attempts. Last error: ${lastError}` 
    };
  }

  async executeWithValidation(methodName, parameters = {}) {
    const methodInfo = this.getMethodInfo(methodName);
    if (!methodInfo.success) {
      return {
        success: false,
        error: `Method '${methodName}' not found`
      };
    }

    try {
      return await this.executeMethod(methodName, parameters);
    } catch (error) {
      return {
        success: false,
        error: error.message,
        suggestion: `Check method parameters and service availability`
      };
    }
  }


  getSessionCookies() {
    try {
      return this.client.getSessionCookies();
    } catch (error) {
      return null;
    }
  }

  clearSessionCookies(domain = null) {
    try {
      this.client.clearSessionCookies(domain);
      return { success: true };
    } catch (error) {
      return { 
        success: false, 
        error: error.message 
      };
    }
  }

  listAllCookies() {
    try {
      const cookies = this.client.listAllCookies();
      return { success: true, cookies };
    } catch (error) {
      return { 
        success: false, 
        error: error.message,
        cookies: {} 
      };
    }
  }

  getConnectionStatus() {
    return {
      connected: !!this.client.client,
      authenticated: !!this.client.authCookie,
      serviceUrl: this.client.serviceUrl,
      wsdlUrl: this.client.wsdlUrl,
      currentDomain: this.client.currentDomain,
      sessionCookies: this.client.getSessionCookies()
    };
  }

  addCookiesForDomain(domain, cookieString) {
    try {
      return this.client.addCookiesForDomain(domain, cookieString);
    } catch (error) {
      console.error('Failed to add cookies:', error.message);
      return false;
    }
  }

  disconnect() {
    this.client.client = null;
    this.client.authCookie = null;
    this.client.serviceUrl = null;
    this.client.wsdlUrl = null;
    return { success: true };
  }
}

module.exports = SOAPClientWrapper;