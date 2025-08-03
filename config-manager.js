const fs = require('fs');
const path = require('path');
const os = require('os');

class ConfigManager {
  constructor() {
    this.configDir = path.join(os.homedir(), '.soap-client');
    this.configFile = path.join(this.configDir, 'config.json');
    this.ensureConfigDir();
  }

  ensureConfigDir() {
    if (!fs.existsSync(this.configDir)) {
      fs.mkdirSync(this.configDir, { recursive: true });
    }
  }

  loadConfig() {
    try {
      if (fs.existsSync(this.configFile)) {
        const data = fs.readFileSync(this.configFile, 'utf8');
        return JSON.parse(data);
      }
    } catch (error) {
      console.error('Failed to load config:', error.message);
    }
    return { profiles: {} };
  }

  saveConfig(config) {
    try {
      fs.writeFileSync(this.configFile, JSON.stringify(config, null, 2));
    } catch (error) {
      console.error('Failed to save config:', error.message);
    }
  }

  saveProfile(name, profileData) {
    const config = this.loadConfig();
    config.profiles[name] = {
      ...profileData,
      createdAt: new Date().toISOString(),
      lastUsed: new Date().toISOString()
    };
    this.saveConfig(config);
  }

  getProfile(name) {
    const config = this.loadConfig();
    const profile = config.profiles[name];
    if (profile) {
      profile.lastUsed = new Date().toISOString();
      this.saveConfig(config);
    }
    return profile;
  }

  listProfiles() {
    const config = this.loadConfig();
    return Object.keys(config.profiles).map(name => ({
      name,
      ...config.profiles[name]
    }));
  }

  deleteProfile(name) {
    const config = this.loadConfig();
    delete config.profiles[name];
    this.saveConfig(config);
  }

  updateProfile(name, updates) {
    const config = this.loadConfig();
    if (config.profiles[name]) {
      config.profiles[name] = {
        ...config.profiles[name],
        ...updates,
        updatedAt: new Date().toISOString()
      };
      this.saveConfig(config);
      return true;
    }
    return false;
  }

  exportProfiles() {
    const config = this.loadConfig();
    return JSON.stringify(config.profiles, null, 2);
  }

  importProfiles(profilesJson) {
    try {
      const importedProfiles = JSON.parse(profilesJson);
      const config = this.loadConfig();
      
      Object.keys(importedProfiles).forEach(name => {
        config.profiles[name] = {
          ...importedProfiles[name],
          importedAt: new Date().toISOString()
        };
      });
      
      this.saveConfig(config);
      return Object.keys(importedProfiles).length;
    } catch (error) {
      console.error('Failed to import profiles:', error.message);
      return 0;
    }
  }
}

module.exports = ConfigManager;