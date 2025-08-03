#!/usr/bin/env node

const { Command } = require('commander');
const inquirer = require('inquirer');
const chalk = require('chalk');
const SOAPClient = require('./soap-client');
const WSDLParser = require('./wsdl-parser');
const ConfigManager = require('./config-manager');

const program = new Command();
const soapClient = new SOAPClient();
const wsdlParser = new WSDLParser();
const configManager = new ConfigManager();

program
  .name('soap-client')
  .description('Simple SOAP client with authentication and intuitive interface')
  .version('1.0.0');

program
  .command('connect')
  .description('Connect to a SOAP service')
  .option('-u, --url <url>', 'WSDL URL')
  .option('-s, --save <name>', 'Save connection as profile')
  .action(async (options) => {
    try {
      let wsdlUrl = options.url;
      
      if (!wsdlUrl) {
        const { url } = await inquirer.prompt([
          {
            type: 'input',
            name: 'url',
            message: 'Enter WSDL URL:',
            validate: (input) => input.length > 0 || 'URL is required'
          }
        ]);
        wsdlUrl = url;
      }

      console.log(chalk.blue('Connecting to SOAP service...'));
      const connected = await soapClient.connect(wsdlUrl);
      
      if (connected) {
        console.log(chalk.green('✓ Connected successfully!'));
        
        if (options.save) {
          configManager.saveProfile(options.save, { wsdlUrl });
          console.log(chalk.green(`✓ Profile saved as "${options.save}"`));
        }
        
        soapClient.describe();
        await promptForAuth();
      } else {
        console.log(chalk.red('✗ Connection failed'));
      }
    } catch (error) {
      console.error(chalk.red('Error:', error.message));
    }
  });

program
  .command('profile')
  .description('Manage connection profiles')
  .option('-l, --list', 'List saved profiles')
  .option('-c, --connect <name>', 'Connect using saved profile')
  .option('-d, --delete <name>', 'Delete a profile')
  .action(async (options) => {
    try {
      if (options.list) {
        const profiles = configManager.listProfiles();
        if (profiles.length === 0) {
          console.log(chalk.yellow('No saved profiles found'));
        } else {
          console.log(chalk.blue('Saved profiles:'));
          profiles.forEach(profile => {
            console.log(`  - ${chalk.green(profile.name)}: ${profile.wsdlUrl}`);
          });
        }
      } else if (options.connect) {
        const profile = configManager.getProfile(options.connect);
        if (profile) {
          console.log(chalk.blue(`Connecting using profile "${options.connect}"...`));
          const connected = await soapClient.connect(profile.wsdlUrl);
          if (connected) {
            console.log(chalk.green('✓ Connected successfully!'));
            soapClient.describe();
            await promptForAuth();
          }
        } else {
          console.log(chalk.red(`Profile "${options.connect}" not found`));
        }
      } else if (options.delete) {
        configManager.deleteProfile(options.delete);
        console.log(chalk.green(`✓ Profile "${options.delete}" deleted`));
      }
    } catch (error) {
      console.error(chalk.red('Error:', error.message));
    }
  });

program
  .command('methods')
  .description('List available methods')
  .action(() => {
    try {
      const methods = soapClient.getAvailableMethods();
      if (methods.length === 0) {
        console.log(chalk.yellow('No methods available. Connect to a service first.'));
      } else {
        console.log(chalk.blue('Available methods:'));
        methods.forEach(method => {
          console.log(`  ${chalk.green(method.name)} (${method.service})`);
        });
      }
    } catch (error) {
      console.error(chalk.red('Error:', error.message));
    }
  });

program
  .command('execute')
  .description('Execute a SOAP method (automatically captures any returned cookies)')
  .option('-m, --method <name>', 'Method name')
  .option('-p, --params <json>', 'Parameters as JSON string')
  .action(async (options) => {
    try {
      let methodName = options.method;
      let parameters = {};

      if (!methodName) {
        const methods = soapClient.getAvailableMethods();
        if (methods.length === 0) {
          console.log(chalk.yellow('No methods available. Connect to a service first.'));
          return;
        }

        const { selectedMethod } = await inquirer.prompt([
          {
            type: 'list',
            name: 'selectedMethod',
            message: 'Select a method to execute:',
            choices: methods.map(m => ({ name: m.name, value: m.name }))
          }
        ]);
        methodName = selectedMethod;
      }

      if (options.params) {
        try {
          parameters = JSON.parse(options.params);
        } catch (parseError) {
          console.error(chalk.red('Invalid JSON parameters'));
          return;
        }
      } else {
        const methodInfo = soapClient.getMethodInfo(methodName);
        if (methodInfo && methodInfo.input) {
          const { paramInput } = await inquirer.prompt([
            {
              type: 'input',
              name: 'paramInput',
              message: 'Enter parameters (JSON format, or press Enter for none):',
              default: '{}'
            }
          ]);
          
          try {
            parameters = JSON.parse(paramInput);
          } catch (parseError) {
            console.error(chalk.red('Invalid JSON parameters'));
            return;
          }
        }
      }

      console.log(chalk.blue(`Executing method: ${methodName}`));
      console.log(chalk.gray(`Parameters: ${JSON.stringify(parameters, null, 2)}`));
      
      const result = await soapClient.executeMethod(methodName, parameters);
      
      // Check if cookies were captured
      const cookies = soapClient.getSessionCookies();
      if (cookies) {
        console.log(chalk.green('🍪 Session cookies captured and will be used for subsequent calls'));
        console.log(chalk.gray(`Domain: ${soapClient.currentDomain}`));
        console.log(chalk.gray(`Cookies: ${cookies}`));
      }
      
      console.log(chalk.green('\n✓ Method executed successfully!'));
      console.log(chalk.blue('Result:'));
      console.log(JSON.stringify(result, null, 2));
      
    } catch (error) {
      console.error(chalk.red('Execution failed:', error.message));
    }
  });

program
  .command('cookies')
  .description('Manage session cookies')
  .option('-v, --view', 'View current session cookies')
  .option('-a, --all', 'View all stored cookies by domain')
  .option('-c, --clear [domain]', 'Clear cookies for domain (or current domain)')
  .action(async (options) => {
    try {
      if (options.view) {
        const cookies = soapClient.getSessionCookies();
        if (cookies) {
          console.log(chalk.blue(`Domain: ${soapClient.currentDomain}`));
          console.log(chalk.green(`Cookies: ${cookies}`));
        } else {
          console.log(chalk.yellow('No session cookies for current domain'));
        }
      } else if (options.all) {
        const allCookies = soapClient.listAllCookies();
        if (Object.keys(allCookies).length === 0) {
          console.log(chalk.yellow('No cookies stored'));
        } else {
          console.log(chalk.blue('All stored cookies:'));
          Object.entries(allCookies).forEach(([domain, cookies]) => {
            console.log(`  ${chalk.green(domain)}: ${cookies.join('; ')}`);
          });
        }
      } else if (options.clear !== undefined) {
        const targetDomain = options.clear || soapClient.currentDomain;
        if (targetDomain) {
          soapClient.clearSessionCookies(targetDomain);
          console.log(chalk.green(`✓ Cookies cleared for domain: ${targetDomain}`));
        } else {
          console.log(chalk.yellow('No domain specified and no current domain'));
        }
      } else {
        console.log(chalk.blue('Cookie management options:'));
        console.log('  --view        View current session cookies');
        console.log('  --all         View all stored cookies by domain');
        console.log('  --clear       Clear cookies for current domain');
        console.log('  --clear <domain>  Clear cookies for specific domain');
      }
    } catch (error) {
      console.error(chalk.red('Error:', error.message));
    }
  });

program
  .command('interactive')
  .description('Start interactive mode')
  .action(async () => {
    console.log(chalk.blue('🚀 Welcome to SOAP Client Interactive Mode'));
    await interactiveMode();
  });

async function promptForAuth() {
  const { needsAuth } = await inquirer.prompt([
    {
      type: 'confirm',
      name: 'needsAuth',
      message: 'Do you need to authenticate?',
      default: false
    }
  ]);

  if (needsAuth) {
    const authOptions = await inquirer.prompt([
      {
        type: 'list',
        name: 'method',
        message: 'Select authentication method:',
        choices: [
          { name: 'Basic Authentication', value: 'basic' },
          { name: 'WS-Security', value: 'wsse' },
          { name: 'Cookie Authentication', value: 'cookie' }
        ]
      },
      {
        type: 'input',
        name: 'username',
        message: 'Username:',
        validate: (input) => input.length > 0 || 'Username is required'
      },
      {
        type: 'password',
        name: 'password',
        message: 'Password:',
        validate: (input) => input.length > 0 || 'Password is required'
      }
    ]);

    console.log(chalk.blue('Authenticating...'));
    const authenticated = await soapClient.authenticate(
      authOptions.username,
      authOptions.password,
      authOptions.method
    );

    if (authenticated) {
      console.log(chalk.green('✓ Authentication successful!'));
    } else {
      console.log(chalk.red('✗ Authentication failed'));
    }
  }
}

async function interactiveMode() {
  while (true) {
    const { action } = await inquirer.prompt([
      {
        type: 'list',
        name: 'action',
        message: 'What would you like to do?',
        choices: [
          { name: '🔗 Connect to a service', value: 'connect' },
          { name: '📋 List available methods', value: 'methods' },
          { name: '⚡ Execute a method (auto-captures cookies)', value: 'execute' },
          { name: '🍪 Manage session cookies', value: 'cookies' },
          { name: '📝 Manage profiles', value: 'profiles' },
          { name: '🔍 Parse WSDL', value: 'parse' },
          { name: '❌ Exit', value: 'exit' }
        ]
      }
    ]);

    try {
      switch (action) {
        case 'connect':
          const { url } = await inquirer.prompt([
            {
              type: 'input',
              name: 'url',
              message: 'Enter WSDL URL:',
              validate: (input) => input.length > 0 || 'URL is required'
            }
          ]);
          
          const connected = await soapClient.connect(url);
          if (connected) {
            soapClient.describe();
            await promptForAuth();
          }
          break;

        case 'methods':
          const methods = soapClient.getAvailableMethods();
          if (methods.length === 0) {
            console.log(chalk.yellow('No methods available. Connect to a service first.'));
          } else {
            console.log(chalk.blue('Available methods:'));
            methods.forEach(method => {
              console.log(`  ${chalk.green(method.name)} (${method.service})`);
            });
          }
          break;

        case 'execute':
          const availableMethods = soapClient.getAvailableMethods();
          if (availableMethods.length === 0) {
            console.log(chalk.yellow('No methods available. Connect to a service first.'));
            break;
          }

          const { methodName } = await inquirer.prompt([
            {
              type: 'list',
              name: 'methodName',
              message: 'Select a method:',
              choices: availableMethods.map(m => ({ name: m.name, value: m.name }))
            }
          ]);

          const { params } = await inquirer.prompt([
            {
              type: 'input',
              name: 'params',
              message: 'Enter parameters (JSON format):',
              default: '{}'
            }
          ]);

          try {
            const parameters = JSON.parse(params);
            const result = await soapClient.executeMethod(methodName, parameters);
            
            // Check if cookies were captured
            const cookies = soapClient.getSessionCookies();
            if (cookies) {
              console.log(chalk.green('🍪 Session cookies captured and will be used for subsequent calls'));
              console.log(chalk.gray(`Domain: ${soapClient.currentDomain}`));
              console.log(chalk.gray(`Cookies: ${cookies}`));
            }
            
            console.log(chalk.green('\n✓ Method executed successfully!'));
            console.log(chalk.blue('Result:'));
            console.log(JSON.stringify(result, null, 2));
          } catch (error) {
            console.error(chalk.red('Execution failed:', error.message));
          }
          break;

        case 'cookies':
          const cookieAction = await inquirer.prompt([
            {
              type: 'list',
              name: 'action',
              message: 'Cookie management:',
              choices: [
                { name: '📋 View current session cookies', value: 'view' },
                { name: '🗂️ View all stored cookies by domain', value: 'view-all' },
                { name: '➕ Add cookies for a domain', value: 'add' },
                { name: '🗑️ Clear current domain cookies', value: 'clear' },
                { name: '↩️ Back to main menu', value: 'back' }
              ]
            }
          ]);

          switch (cookieAction.action) {
            case 'view':
              const currentCookies = soapClient.getSessionCookies();
              if (currentCookies) {
                console.log(chalk.blue(`Current domain: ${soapClient.currentDomain}`));
                console.log(chalk.green(`Session cookies: ${currentCookies}`));
              } else {
                console.log(chalk.yellow('No session cookies for current domain'));
              }
              break;
              
            case 'view-all':
              const allCookies = soapClient.listAllCookies();
              if (Object.keys(allCookies).length === 0) {
                console.log(chalk.yellow('No cookies stored'));
              } else {
                console.log(chalk.blue('All stored cookies:'));
                Object.entries(allCookies).forEach(([domain, cookies]) => {
                  console.log(`  ${chalk.green(domain)}: ${cookies.join('; ')}`);
                });
              }
              break;
              
            case 'add':
              const { domain, cookies } = await inquirer.prompt([
                {
                  type: 'input',
                  name: 'domain',
                  message: 'Enter domain:',
                  validate: (input) => input.length > 0 || 'Domain is required'
                },
                {
                  type: 'input',
                  name: 'cookies',
                  message: 'Enter cookies (format: name1=value1; name2=value2):',
                  validate: (input) => input.length > 0 || 'Cookies are required'
                }
              ]);
              
              soapClient.addCookiesForDomain(domain, cookies);
              break;
              
            case 'clear':
              if (soapClient.currentDomain) {
                soapClient.clearSessionCookies();
                console.log(chalk.green(`✓ Cookies cleared for domain: ${soapClient.currentDomain}`));
              } else {
                console.log(chalk.yellow('No current domain to clear cookies for'));
              }
              break;
          }
          break;

        case 'parse':
          const { wsdlUrl } = await inquirer.prompt([
            {
              type: 'input',
              name: 'wsdlUrl',
              message: 'Enter WSDL URL to parse:',
              validate: (input) => input.length > 0 || 'URL is required'
            }
          ]);

          try {
            const serviceInfo = await wsdlParser.parseWSDL(wsdlUrl);
            wsdlParser.displayServiceInfo(serviceInfo);
          } catch (error) {
            console.error(chalk.red('WSDL parsing failed:', error.message));
          }
          break;

        case 'profiles':
          const profiles = configManager.listProfiles();
          if (profiles.length === 0) {
            console.log(chalk.yellow('No saved profiles found'));
          } else {
            console.log(chalk.blue('Saved profiles:'));
            profiles.forEach(profile => {
              console.log(`  - ${chalk.green(profile.name)}: ${profile.wsdlUrl}`);
            });
          }
          break;

        case 'exit':
          console.log(chalk.blue('👋 Goodbye!'));
          process.exit(0);
          break;
      }
    } catch (error) {
      console.error(chalk.red('Error:', error.message));
    }

    console.log(); // Add spacing
  }
}

if (require.main === module) {
  if (process.argv.length === 2) {
    interactiveMode();
  } else {
    program.parse();
  }
}