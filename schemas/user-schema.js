/**
 * User Data Schema Definitions
 * This file defines the data structures used throughout the badminton score system
 */

// User object schema for individual users
const UserSchema = {
  // Required fields
  openid: {
    type: 'string',
    required: true,
    description: 'WeChat OpenID - unique identifier from WeChat'
  },
  nickname: {
    type: 'string',
    required: true,
    maxLength: 20,
    description: 'User\'s display name in the app'
  },
  
  // Optional fields
  avatarUrl: {
    type: 'string',
    required: false,
    description: 'URL to user\'s avatar image'
  },
  gender: {
    type: 'string',
    required: false,
    enum: ['male', 'female'],
    default: 'male',
    description: 'User\'s gender preference'
  },
  createdAt: {
    type: 'string',
    required: false,
    format: 'ISO 8601',
    description: 'Timestamp when user first registered',
    example: '2024-01-01T00:00:00.000Z'
  },
  lastLoginAt: {
    type: 'string',
    required: false,
    format: 'ISO 8601',
    description: 'Timestamp of user\'s last login',
    example: '2024-01-15T10:30:00.000Z'
  },
  updatedAt: {
    type: 'string',
    required: false,
    format: 'ISO 8601',
    description: 'Timestamp of last profile update',
    example: '2024-01-15T10:30:00.000Z'
  }
};

// Storage keys used in the application
const StorageKeys = {
  USER_INFO: 'userInfo',
  ALL_USERS: 'allUsers',
  PLAYERS: 'players',
  GAMES: 'games',
  SETTINGS: 'settings'
};

// Validation rules
const ValidationRules = {
  NICKNAME: {
    minLength: 1,
    maxLength: 20,
    pattern: /^[^\s].*[^\s]$/, // No leading/trailing spaces
    unique: true,
    caseInsensitive: true
  },
  OPENID: {
    required: true,
    unique: true,
    pattern: /^mock_openid_\d+$/ // For development
  }
};

// Helper functions for schema validation
const SchemaHelpers = {
  // Create a new user object with required fields
  createUser: function(openid, nickname, avatarUrl = '') {
    const now = new Date().toISOString();
    return {
      openid: openid,
      nickname: nickname.trim(),
      avatarUrl: avatarUrl,
      createdAt: now,
      lastLoginAt: now,
      updatedAt: now
    };
  },
  
  // Update an existing user object
  updateUser: function(existingUser, updates) {
    return {
      ...existingUser,
      ...updates,
      updatedAt: new Date().toISOString()
    };
  },
  
  // Validate user object against schema
  validateUser: function(user) {
    const errors = [];
    
    // Check required fields
    if (!user.openid) {
      errors.push('openid is required');
    }
    if (!user.nickname) {
      errors.push('nickname is required');
    }
    
    // Check field types
    if (user.openid && typeof user.openid !== 'string') {
      errors.push('openid must be a string');
    }
    if (user.nickname && typeof user.nickname !== 'string') {
      errors.push('nickname must be a string');
    }
    
    // Check nickname length
    if (user.nickname && user.nickname.length > 20) {
      errors.push('nickname must be 20 characters or less');
    }
    
    // Check timestamp formats
    const timestampFields = ['createdAt', 'lastLoginAt', 'updatedAt'];
    timestampFields.forEach(field => {
      if (user[field] && !this.isValidISOTimestamp(user[field])) {
        errors.push(`${field} must be a valid ISO timestamp`);
      }
    });
    
    return {
      isValid: errors.length === 0,
      errors: errors
    };
  },
  
  // Check if string is valid ISO timestamp
  isValidISOTimestamp: function(str) {
    const isoRegex = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;
    return isoRegex.test(str) && !isNaN(Date.parse(str));
  },
  
  // Get default values for new user
  getDefaultUser: function() {
    return {
      openid: '',
      nickname: '',
      avatarUrl: '',
      createdAt: new Date().toISOString(),
      lastLoginAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
  }
};

// Export the schema definitions
module.exports = {
  UserSchema,
  StorageKeys,
  ValidationRules,
  SchemaHelpers
};

// For WeChat Mini Program environment
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    UserSchema,
    StorageKeys,
    ValidationRules,
    SchemaHelpers
  };
} else {
  // For browser/WeChat environment
  window.UserSchema = {
    UserSchema,
    StorageKeys,
    ValidationRules,
    SchemaHelpers
  };
} 