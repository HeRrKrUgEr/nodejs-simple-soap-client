# Simple SOAP Client - Command Line Usage

A straightforward command-line tool for SOAP service calls with cookie file support.

## Usage

```bash
node simple-soap.js -w <WSDL_URL> -m <METHOD> [-p <PARAMS>] [-c <COOKIE_FILE>] [-h <HEADERS>]
```

## Parameters

- `-w, --wsdl <url>` - **Required**: WSDL URL of the service
- `-m, --method <name>` - **Required**: Method name to execute
- `-p, --params <json>` - **Optional**: Parameters as JSON string (default: `{}`)
- `-c, --cookies <file>` - **Optional**: Cookie file path (reads existing cookies, saves new ones)
- `-h, --headers <json>` - **Optional**: Additional HTTP headers as JSON (default: `{}`)

## Examples

### 1. Simple method call without authentication
```bash
node simple-soap.js -w "http://example.com/service.wsdl" -m "GetData" -p '{"id": 123}'
```

### 2. Authentication call that saves cookies
```bash
# Execute login method and save cookies to file
node simple-soap.js -w "http://example.com/Login.svc?wsdl" -m "Authenticate" -p '{"username": "user", "password": "pass"}' -c "cookies.txt"
```

### 3. Use saved cookies for subsequent calls
```bash
# Use cookies from previous login
node simple-soap.js -w "http://example.com/PropService.svc?wsdl" -m "GetProperties" -c "cookies.txt"
```

### 4. Call with additional headers
```bash
node simple-soap.js -w "http://example.com/service.wsdl" -m "GetData" -p '{"id": 123}' -h '{"User-Agent": "MyApp/1.0"}'
```

## Cookie File Workflow

1. **Login and save cookies**:
   ```bash
   node simple-soap.js -w "http://example.com/Login.svc?wsdl" -m "Login" -p '{"user": "admin", "pass": "secret"}' -c "auth.txt"
   ```

2. **Use cookies for other services**:
   ```bash
   node simple-soap.js -w "http://example.com/DataService.svc?wsdl" -m "GetUserData" -c "auth.txt"
   ```

3. **Check cookie file content**:
   ```bash
   type auth.txt
   # Output: JSESSIONID=ABC123; AuthToken=XYZ789
   ```

## Features

- ✅ **Automatic cookie handling**: Reads cookies from file, sends with request, saves new cookies
- ✅ **JSON parameter support**: Pass complex parameters as JSON
- ✅ **Custom headers**: Add any HTTP headers needed
- ✅ **Cross-service authentication**: Use same cookie file across multiple services
- ✅ **Simple and reliable**: No complex state management, just file-based cookies
- ✅ **Detailed output**: Shows request details and formatted response

## Error Handling

The tool will exit with error code 1 and show the error message if:
- WSDL cannot be loaded
- Method doesn't exist
- Parameters are invalid JSON
- Network/authentication errors occur

## Notes

- Cookie file is created if it doesn't exist
- Existing cookies in file are automatically sent with requests
- New cookies from responses overwrite the file
- JSON parameters must be valid JSON (use single quotes around the JSON string in bash)