const soap = require('soap');
const axios = require('axios');
const xml2js = require('xml2js');
const url = require('url');

class SOAPClient {
  constructor() {
    this.client = null;
    this.authCookie = null;
    this.wsdlUrl = null;
    this.serviceUrl = null;
    this.sessionCookies = new Map(); // Domain-based cookie storage
    this.currentDomain = null;
  }

  async connect(wsdlUrl, options = {}) {
    try {
      this.wsdlUrl = wsdlUrl;
      
      // Pre-extract domain to check for existing cookies
      const tempUrl = new url.URL(wsdlUrl);
      const targetDomain = tempUrl.hostname;
      
      // Check for existing cookies for this domain
      const existingCookies = this.sessionCookies.get(targetDomain);
      
      const clientOptions = {
        ignoredNamespaces: {
          namespaces: ['targetNamespace', 'typedNamespace']
        },
        ...options
      };
      
      // If we have existing cookies for this domain, include them in the SOAP client creation
      if (existingCookies && existingCookies.length > 0) {
        const cookieString = existingCookies.join('; ');
        console.log(`🍪 Pre-loading cookies for domain ${targetDomain}: ${cookieString}`);
        
        // Add cookies to the client options for the initial WSDL fetch
        clientOptions.wsdl_headers = {
          'Cookie': cookieString,
          ...clientOptions.wsdl_headers
        };
      }

      this.client = await soap.createClientAsync(wsdlUrl, clientOptions);
      this.serviceUrl = this.client.wsdl.services[Object.keys(this.client.wsdl.services)[0]].ports[Object.keys(this.client.wsdl.services[Object.keys(this.client.wsdl.services)[0]].ports)[0]].location;
      
      // Extract actual service domain (might be different from WSDL domain)
      const parsedUrl = new url.URL(this.serviceUrl);
      const serviceDomain = parsedUrl.hostname;
      
      console.log(`Connected to SOAP service at: ${this.serviceUrl}`);
      console.log(`Domain: ${serviceDomain}`);
      
      // Check if we're switching domains or connecting to the same domain
      if (this.currentDomain && this.currentDomain !== serviceDomain) {
        console.log(`⚠️  Switching from domain ${this.currentDomain} to ${serviceDomain}`);
      }
      
      this.currentDomain = serviceDomain;
      
      // Apply existing cookies for the service domain (this handles cases where WSDL and service domains differ)
      this.applyCookiesForDomain(this.currentDomain);
      
      return true;
    } catch (error) {
      console.error('Failed to connect to SOAP service:', error.message);
      return false;
    }
  }

  async authenticate(username, password, authMethod = 'basic') {
    try {
      if (authMethod === 'basic') {
        this.client.setSecurity(new soap.BasicAuthSecurity(username, password));
        console.log('Basic authentication configured');
        return true;
      } else if (authMethod === 'wsse') {
        this.client.setSecurity(new soap.WSSecurity(username, password));
        console.log('WS-Security authentication configured');
        return true;
      } else if (authMethod === 'cookie') {
        const authCookie = await this.authenticateWithCookie(username, password);
        if (authCookie) {
          this.authCookie = authCookie;
          this.client.addHttpHeader('Cookie', authCookie);
          console.log('Cookie authentication successful');
          return true;
        }
      }
      return false;
    } catch (error) {
      console.error('Authentication failed:', error.message);
      return false;
    }
  }

  async authenticateWithCookie(username, password) {
    try {
      const authData = {
        username: username,
        password: password
      };

      const response = await axios.post(`${this.serviceUrl}/auth`, authData, {
        withCredentials: true
      });

      const setCookieHeader = response.headers['set-cookie'];
      if (setCookieHeader && setCookieHeader.length > 0) {
        return setCookieHeader.map(cookie => cookie.split(';')[0]).join('; ');
      }
      
      return null;
    } catch (error) {
      console.error('Cookie authentication failed:', error.message);
      return null;
    }
  }

  getAvailableMethods() {
    if (!this.client) {
      console.error('Not connected to any service');
      return [];
    }

    const methods = [];
    const services = this.client.wsdl.services;
    
    Object.keys(services).forEach(serviceName => {
      const service = services[serviceName];
      Object.keys(service.ports).forEach(portName => {
        const port = service.ports[portName];
        Object.keys(port.binding.methods).forEach(methodName => {
          const method = port.binding.methods[methodName];
          methods.push({
            name: methodName,
            service: serviceName,
            port: portName,
            input: method.input,
            output: method.output
          });
        });
      });
    });

    return methods;
  }

  async executeMethod(methodName, parameters = {}) {
    if (!this.client) {
      throw new Error('Not connected to any service');
    }

    try {
      const result = await new Promise((resolve, reject) => {
        this.client[methodName](parameters, (err, result, raw, soapHeader) => {
          if (err) {
            reject(err);
          } else {
            resolve({ result, raw, soapHeader });
          }
        });
      });

      // Try to extract cookies from the response
      this.extractCookiesFromMultipleSources(result, {});
      
      return result.result;
    } catch (error) {
      console.error(`Failed to execute method ${methodName}:`, error.message);
      throw error;
    }
  }

  getMethodInfo(methodName) {
    if (!this.client) {
      return null;
    }

    const services = this.client.wsdl.services;
    let methodInfo = null;

    Object.keys(services).forEach(serviceName => {
      const service = services[serviceName];
      Object.keys(service.ports).forEach(portName => {
        const port = service.ports[portName];
        if (port.binding.methods[methodName]) {
          methodInfo = {
            name: methodName,
            service: serviceName,
            port: portName,
            input: port.binding.methods[methodName].input,
            output: port.binding.methods[methodName].output
          };
        }
      });
    });

    return methodInfo;
  }

  describe() {
    if (!this.client) {
      console.error('Not connected to any service');
      return;
    }

    console.log('\n=== SOAP Service Description ===');
    console.log(`WSDL URL: ${this.wsdlUrl}`);
    console.log(`Service URL: ${this.serviceUrl}`);
    console.log(`Domain: ${this.currentDomain}`);
    
    // Show cookie status
    const currentCookies = this.getSessionCookies();
    if (currentCookies) {
      console.log(`🍪 Active cookies for this domain: ${currentCookies}`);
    } else {
      console.log(`📭 No active cookies for this domain`);
    }
    
    // Show all stored cookies
    const allCookies = this.listAllCookies();
    if (Object.keys(allCookies).length > 0) {
      console.log(`\n🗂️  All stored cookies by domain:`);
      Object.entries(allCookies).forEach(([domain, cookies]) => {
        console.log(`  ${domain}: ${cookies.join('; ')}`);
      });
    }
    
    const methods = this.getAvailableMethods();
    console.log(`\nAvailable Methods (${methods.length}):`);
    
    methods.forEach(method => {
      console.log(`  - ${method.name}`);
    });
    
    return methods;
  }

  // Extract cookies from multiple sources
  extractCookiesFromMultipleSources(result, responseHeaders) {
    if (!this.currentDomain) return;
    
    try {
      let foundCookies = false;
      
      // Method 1: Check SOAP client's last response headers (most reliable)
      if (this.client && this.client.lastResponseHeaders && this.client.lastResponseHeaders['set-cookie']) {
        console.log('🍪 Found cookies in SOAP client response headers');
        this.processCookies(this.client.lastResponseHeaders['set-cookie'], this.currentDomain);
        foundCookies = true;
      }
      
      // Method 2: Check raw response if available
      if (!foundCookies && result.raw && result.raw.headers && result.raw.headers['set-cookie']) {
        console.log('🍪 Found cookies in raw response headers');
        this.processCookies(result.raw.headers['set-cookie'], this.currentDomain);
        foundCookies = true;
      }
      
      // Method 3: Check for response headers in the raw response data
      if (!foundCookies && typeof result.raw === 'string') {
        const setCookieMatch = result.raw.match(/Set-Cookie:\s*([^\r\n]+)/gi);
        if (setCookieMatch) {
          console.log('🍪 Found cookies in raw response text');
          const cookies = setCookieMatch.map(match => match.replace(/Set-Cookie:\s*/i, ''));
          this.processCookies(cookies, this.currentDomain);
          foundCookies = true;
        }
      }
      
      // Only log if we're in debug mode or if someone is specifically looking for auth
      if (!foundCookies) {
        console.log('🔍 No cookies found in response');
      }
      
    } catch (error) {
      console.log('Cookie extraction error:', error.message);
    }
  }

  // Legacy method for backward compatibility
  extractAndStoreCookies(rawResponse) {
    this.extractCookiesFromMultipleSources({ raw: rawResponse }, {});
  }

  // Process and store cookies for a domain
  processCookies(cookies, domain) {
    const cookieArray = Array.isArray(cookies) ? cookies : [cookies];
    const domainCookies = this.sessionCookies.get(domain) || [];
    
    cookieArray.forEach(cookie => {
      const cookiePart = cookie.split(';')[0];
      const [name] = cookiePart.split('=');
      
      // Remove existing cookie with same name
      const filtered = domainCookies.filter(existing => !existing.startsWith(name + '='));
      filtered.push(cookiePart);
      
      this.sessionCookies.set(domain, filtered);
    });
    
    // Apply cookies immediately
    this.applyCookiesForDomain(domain);
    
    console.log(`Session cookies updated for domain ${domain}: ${this.sessionCookies.get(domain).join('; ')}`);
  }

  // Apply stored cookies for a domain to the SOAP client
  applyCookiesForDomain(domain) {
    if (!this.client || !domain) {
      console.log(`⚠️  Cannot apply cookies: ${!this.client ? 'No client' : 'No domain'}`);
      return;
    }
    
    const domainCookies = this.sessionCookies.get(domain);
    if (domainCookies && domainCookies.length > 0) {
      const cookieString = domainCookies.join('; ');
      
      // Clear any existing cookie headers first
      if (this.client.httpHeaders && this.client.httpHeaders.Cookie) {
        delete this.client.httpHeaders.Cookie;
      }
      
      // Add the cookies to the new client
      this.client.addHttpHeader('Cookie', cookieString);
      this.authCookie = cookieString; // Update authCookie for compatibility
      
      console.log(`🍪 Applied existing cookies for domain ${domain}: ${cookieString}`);
      console.log(`🔗 These cookies will be used for all requests to ${domain}`);
    } else {
      console.log(`📭 No existing cookies found for domain ${domain}`);
    }
  }


  // Get all session cookies for current domain
  getSessionCookies() {
    if (!this.currentDomain) return null;
    const cookies = this.sessionCookies.get(this.currentDomain);
    return cookies ? cookies.join('; ') : null;
  }

  // Clear session cookies for a domain
  clearSessionCookies(domain = null) {
    const targetDomain = domain || this.currentDomain;
    if (targetDomain) {
      this.sessionCookies.delete(targetDomain);
      console.log(`Session cookies cleared for domain: ${targetDomain}`);
    }
  }

  // List all stored cookies by domain
  listAllCookies() {
    const result = {};
    this.sessionCookies.forEach((cookies, domain) => {
      result[domain] = cookies;
    });
    return result;
  }

  // Manually add cookies for a domain (useful for testing or manual setup)
  addCookiesForDomain(domain, cookieString) {
    if (!domain || !cookieString) {
      console.log('⚠️  Domain and cookie string are required');
      return false;
    }
    
    // Parse the cookie string into individual cookies
    const cookies = cookieString.split(';').map(cookie => cookie.trim());
    
    // Store cookies for the domain
    this.sessionCookies.set(domain, cookies);
    
    // If this is the current domain, apply cookies immediately
    if (this.currentDomain === domain && this.client) {
      this.applyCookiesForDomain(domain);
    }
    
    console.log(`✅ Added cookies for domain ${domain}: ${cookieString}`);
    return true;
  }
}

module.exports = SOAPClient;