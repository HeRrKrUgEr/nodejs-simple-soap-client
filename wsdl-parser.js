const xml2js = require('xml2js');
const axios = require('axios');

class WSDLParser {
  constructor() {
    this.parser = new xml2js.Parser({ explicitArray: false });
  }

  async parseWSDL(wsdlUrl) {
    try {
      const response = await axios.get(wsdlUrl);
      const wsdlContent = response.data;
      
      const result = await this.parser.parseStringPromise(wsdlContent);
      return this.extractServiceInfo(result);
    } catch (error) {
      console.error('Failed to parse WSDL:', error.message);
      throw error;
    }
  }

  extractServiceInfo(wsdlData) {
    const definitions = wsdlData.definitions || wsdlData['wsdl:definitions'];
    if (!definitions) {
      throw new Error('Invalid WSDL: No definitions found');
    }

    const serviceInfo = {
      targetNamespace: definitions.$.targetNamespace,
      services: [],
      operations: [],
      types: []
    };

    const services = definitions.service || definitions['wsdl:service'];
    if (services) {
      const serviceArray = Array.isArray(services) ? services : [services];
      serviceArray.forEach(service => {
        const ports = service.port || service['wsdl:port'];
        const portArray = Array.isArray(ports) ? ports : [ports];
        
        portArray.forEach(port => {
          serviceInfo.services.push({
            name: service.$.name,
            port: port.$.name,
            binding: port.$.binding,
            location: port['soap:address'] ? port['soap:address'].$.location : 
                     port['soap12:address'] ? port['soap12:address'].$.location : 'Unknown'
          });
        });
      });
    }

    const bindings = definitions.binding || definitions['wsdl:binding'];
    if (bindings) {
      const bindingArray = Array.isArray(bindings) ? bindings : [bindings];
      bindingArray.forEach(binding => {
        const operations = binding.operation || binding['wsdl:operation'];
        if (operations) {
          const operationArray = Array.isArray(operations) ? operations : [operations];
          operationArray.forEach(operation => {
            serviceInfo.operations.push({
              name: operation.$.name,
              binding: binding.$.name,
              soapAction: operation['soap:operation'] ? operation['soap:operation'].$.soapAction : 
                         operation['soap12:operation'] ? operation['soap12:operation'].$.soapAction : ''
            });
          });
        }
      });
    }

    const types = definitions.types || definitions['wsdl:types'];
    if (types && types['xsd:schema']) {
      const schemas = Array.isArray(types['xsd:schema']) ? types['xsd:schema'] : [types['xsd:schema']];
      schemas.forEach(schema => {
        const elements = schema['xsd:element'];
        if (elements) {
          const elementArray = Array.isArray(elements) ? elements : [elements];
          elementArray.forEach(element => {
            serviceInfo.types.push({
              name: element.$.name,
              type: element.$.type,
              namespace: schema.$.targetNamespace
            });
          });
        }
      });
    }

    return serviceInfo;
  }

  displayServiceInfo(serviceInfo) {
    console.log('\n=== WSDL Service Information ===');
    console.log(`Target Namespace: ${serviceInfo.targetNamespace}`);
    
    console.log('\nServices:');
    serviceInfo.services.forEach(service => {
      console.log(`  - ${service.name} (${service.port})`);
      console.log(`    Location: ${service.location}`);
      console.log(`    Binding: ${service.binding}`);
    });

    console.log('\nOperations:');
    serviceInfo.operations.forEach(operation => {
      console.log(`  - ${operation.name}`);
      console.log(`    SOAP Action: ${operation.soapAction}`);
      console.log(`    Binding: ${operation.binding}`);
    });

    if (serviceInfo.types.length > 0) {
      console.log('\nTypes:');
      serviceInfo.types.forEach(type => {
        console.log(`  - ${type.name} (${type.type})`);
      });
    }

    return serviceInfo;
  }
}

module.exports = WSDLParser;