# SOAP Client

A simple, intuitive SOAP client with authentication capabilities and user-friendly interface.

## Features

-  Easy connection to SOAP services via WSDL
-  Multiple authentication methods (Basic, WS-Security, Cookie)
-  **Session cookie management with domain persistence**
-  Automatic service discovery and method listing
-  Interactive execution of SOAP methods
-  **Execute authentication methods that return session cookies**
-  Connection profile management
-  Colorful and intuitive CLI interface
-  WSDL parsing and analysis

## Installation

```bash
npm install
```

## Usage

### Command Line Interface

#### Interactive Mode (Recommended)
```bash
node cli.js
# or
npm start
```

#### Direct Commands

**Connect to a service:**
```bash
node cli.js connect --url "http://example.com/service.wsdl"
```

**Save connection as profile:**
```bash
node cli.js connect --url "http://example.com/service.wsdl" --save "myservice"
```

**Connect using saved profile:**
```bash
node cli.js profile --connect "myservice"
```

**List available methods:**
```bash
node cli.js methods
```

**Execute a method:**
```bash
node cli.js execute --method "GetData" --params '{"id": 123}'
```

**Execute any method (automatically captures cookies if returned):**
```bash
node cli.js execute --method "Login" --params '{"username": "user", "password": "pass"}'
```

**Manage session cookies:**
```bash
# View current session cookies
node cli.js cookies --view

# View all stored cookies by domain
node cli.js cookies --all

# Clear cookies for current domain
node cli.js cookies --clear
```

### Programmatic Usage

```javascript
const SOAPClient = require('./index');

const client = new SOAPClient();

// Connect to service
const result = await client.connect('http://example.com/service.wsdl');
if (result.success) {
  console.log('Connected successfully!');
  
  // Authenticate
  await client.authenticate('username', 'password', 'basic');
  
  // List methods
  const methods = client.getAvailableMethods();
  console.log('Available methods:', methods.methods);
  
  // Execute any method - cookies are automatically captured if returned
  const authResponse = await client.executeMethod('Login', { 
    username: 'user', 
    password: 'pass' 
  });
  if (authResponse.success) {
    console.log('Login successful!');
    
    // If the method returned cookies, they're now stored and will be used automatically
    const cookies = client.getSessionCookies();
    if (cookies) {
      console.log('Session cookies captured:', cookies);
    }
    
    // Subsequent calls will use the captured cookies automatically
    const protectedResponse = await client.executeMethod('GetProtectedData', {});
    console.log('Protected data:', protectedResponse.result);
  }
}
```

## Authentication Methods

### Basic Authentication
```javascript
await client.authenticate('username', 'password', 'basic');
```

### WS-Security
```javascript
await client.authenticate('username', 'password', 'wsse');
```

### Cookie Authentication
```javascript
await client.authenticate('username', 'password', 'cookie');
```

### Session Cookie Authentication (Automatic)
Simply execute any SOAP method - if it returns authentication cookies, they are automatically captured and used for all subsequent calls:

```javascript
// Execute any method - cookies are automatically captured if returned
const authResult = await client.executeMethod('AuthenticateUser', {
  username: 'myuser',
  password: 'mypass'
});

if (authResult.success) {
  console.log('Authentication successful!');
  
  // Check if cookies were captured
  const cookies = client.getSessionCookies();
  if (cookies) {
    console.log('Session cookies captured:', cookies);
    
    // All subsequent calls will automatically include the session cookies
    const data = await client.executeMethod('GetUserData', {});
  }
}
```

**Key Features:**
-  **Automatically captures cookies from ANY SOAP method response**
-  Persists cookies by domain - when switching between services on the same domain, cookies are preserved
-  Cookies are applied to all subsequent SOAP calls within the session
- 🗂 View and manage stored cookies by domain
-  **No special authentication methods needed** - just execute your service's login/auth method normally

## Configuration

Profiles are automatically saved to `~/.soap-client/config.json` and include:
- WSDL URL
- Creation timestamp
- Last used timestamp

## Error Handling

All methods return structured responses with error handling:

```javascript
const result = await client.executeMethod('MethodName', params);
if (result.success) {
  console.log('Success:', result.result);
} else {
  console.error('Error:', result.error);
  console.error('Details:', result.details);
}
```

## Example Workflow

1. **Start the client:**
   ```bash
   npm start
   ```

2. **Connect to a service:**
   - Choose "Connect to a service"
   - Enter WSDL URL
   - Authenticate if required

3. **Explore the service:**
   - List available methods
   - Parse WSDL for detailed information

4. **Execute methods:**
   - Select a method
   - Provide parameters in JSON format
   - View results

5. **Authenticate with session cookies:**
   - Execute any method that returns authentication cookies
   - Cookies are automatically captured and stored
   - All subsequent calls use the session cookies

6. **Save for later:**
   - Save connection as a profile
   - Reuse profiles for quick access

## Session Cookie Workflow

This client now supports a common enterprise SOAP authentication pattern:

1. **Connect** to a SOAP service
2. **Execute an authentication method** (like `Login`, `Authenticate`, etc.) that returns session cookies
3. **All subsequent method calls** automatically include those cookies for authentication
4. **Switch between services** on the same domain while maintaining authentication
5. **Manage cookies** - view current cookies, clear them, or view all stored cookies by domain

### Example Cross-Service Workflow:
```bash
# Connect to authentication service
npm start
> Connect to a service
> Enter WSDL URL: http://example.com/Login.svc?wsdl

# Execute authentication method
> Execute a method (auto-captures cookies)
> Select method: Authenticate
> Parameters: {"username": "user", "password": "pass"}
#  Session cookies captured for domain example.com

# Connect to different service on same domain
> Connect to a service
> Enter WSDL URL: http://example.com/PropService.svc?wsdl
#  Applied existing cookies for domain example.com
#  These cookies will be used for all requests to example.com

# Execute method on new service - cookies automatically included
> Execute a method (auto-captures cookies)
> Select method: GetProperties
# ✓ Method executed successfully (using session cookies from Login.svc)
```

## Dependencies

- `soap`: SOAP client library
- `commander`: CLI framework
- `inquirer`: Interactive prompts
- `chalk`: Terminal colors
- `axios`: HTTP client
- `xml2js`: XML parsing

## License

MIT
