#!/usr/bin/env node

const soap = require('soap');
const fs = require('fs');
const { Command } = require('commander');

const program = new Command();

program
  .name('simple-soap')
  .description('Simple SOAP client with cookie file support')
  .version('1.0.0')
  .requiredOption('-w, --wsdl <url>', 'WSDL URL')
  .requiredOption('-m, --method <name>', 'Method name to execute')
  .option('-p, --params <json>', 'Parameters as JSON string', '{}')
  .option('-c, --cookies <file>', 'Cookie file path (will read/write cookies)')
  .option('-h, --headers <json>', 'Additional HTTP headers as JSON', '{}')
  .action(async (options) => {
    try {
      console.log(`Connecting to WSDL: ${options.wsdl}`);
      
      // Load cookies from file if specified
      let cookies = '';
      if (options.cookies && fs.existsSync(options.cookies)) {
        cookies = fs.readFileSync(options.cookies, 'utf8').trim();
        console.log(`Loaded cookies from ${options.cookies}: ${cookies}`);
      }
      
      // Parse parameters
      let parameters = {};
      try {
        parameters = JSON.parse(options.params);
      } catch (error) {
        console.error('Invalid JSON parameters:', error.message);
        process.exit(1);
      }
      
      // Parse additional headers
      let additionalHeaders = {};
      try {
        additionalHeaders = JSON.parse(options.headers);
      } catch (error) {
        console.error('Invalid JSON headers:', error.message);
        process.exit(1);
      }
      
      // Create SOAP client
      const client = await soap.createClientAsync(options.wsdl);
      
      // Add cookies if available
      if (cookies) {
        client.addHttpHeader('Cookie', cookies);
      }
      
      // Add additional headers
      Object.keys(additionalHeaders).forEach(key => {
        client.addHttpHeader(key, additionalHeaders[key]);
      });
      
      console.log(`Executing method: ${options.method}`);
      console.log(`Parameters: ${JSON.stringify(parameters, null, 2)}`);
      
      // Execute the method
      const result = await new Promise((resolve, reject) => {
        client[options.method](parameters, (err, result, raw, soapHeader) => {
          if (err) {
            reject(err);
          } else {
            resolve({ result, raw, soapHeader });
          }
        });
      });
      
      // Check for new cookies in response and save them
      if (options.cookies && client.lastResponseHeaders && client.lastResponseHeaders['set-cookie']) {
        const newCookies = client.lastResponseHeaders['set-cookie'];
        const cookieStrings = Array.isArray(newCookies) ? newCookies : [newCookies];
        const cookieValues = cookieStrings.map(cookie => cookie.split(';')[0]).join('; ');
        
        // Save cookies to file
        fs.writeFileSync(options.cookies, cookieValues);
        console.log(`Saved new cookies to ${options.cookies}: ${cookieValues}`);
      }
      
      console.log('\n=== METHOD EXECUTED SUCCESSFULLY ===');
      console.log('Result:');
      console.log(JSON.stringify(result.result, null, 2));
      
    } catch (error) {
      console.error('Error:', error.message);
      process.exit(1);
    }
  });

// Show help if no arguments
if (process.argv.length === 2) {
  program.help();
}

program.parse();