# Badminton Score System - Architecture Documentation

## Overview

The application has been refactored to follow a clean layered architecture that separates concerns and makes the codebase more maintainable and testable.

## Architecture Layers

### 1. Raw Database Layer (`utils/cloud-db.js`)

**Purpose**: Handles direct database operations with no business logic.

**Responsibilities**:
- Database connection and initialization
- Raw CRUD operations on collections
- Data validation at database level
- Error handling for database operations

**Key Methods**:
- `init()` - Initialize database connection
- `getUserByOpenid(openid)` - Get user by WeChat openid
- `createUser(userData)` - Create new user
- `updateUser(openid, updateData)` - Update existing user
- `getAllUsers()` - Get all users
- `nicknameExists(nickname, excludeOpenid)` - Check nickname uniqueness
- `getAllGames()` - Get all games
- `getGameById(gameId)` - Get game by ID
- `createGame(gameData)` - Create new game
- `updateGame(gameId, updateData)` - Update game
- `deleteGame(gameId)` - Delete game
- `saveGeneratedMatches(matchData, sessionId)` - Save matches

**Characteristics**:
- No business logic
- No user authentication checks
- No data transformation
- Pure database operations only

### 2. Business Logic Layer

#### User Service (`utils/user-service.js`)

**Purpose**: Handles user-related business logic and orchestration.

**Responsibilities**:
- User authentication and authorization
- User registration and login flow
- User profile management
- Session management
- Data validation and business rules
- Integration with WeChat services

**Key Methods**:
- `loginWithWeChat()` - Complete WeChat login flow
- `registerUser(openid, userData)` - Register new user
- `updateUserProfile(openid, updateData)` - Update user profile
- `isNicknameUnique(nickname, excludeOpenid)` - Check nickname uniqueness
- `getAllUsers()` - Get all users
- `getCurrentUser()` - Get current logged-in user
- `setCurrentUser(user)` - Set current user
- `logout()` - Logout current user

**User Profile Structure**:
- `_openid` - WeChat user ID
- `Name` - User's nickname/display name
- `Avatar` - User's avatar URL
- `Gender` - User's gender
- `createdAt` - Account creation timestamp
- `updatedAt` - Last update timestamp
- `lastLoginAt` - Last login timestamp

**Characteristics**:
- Contains business rules and validation
- Orchestrates multiple database operations
- Handles user session management
- Integrates with external services (WeChat)

#### Game Service (`utils/game-service.js`)

**Purpose**: Handles game-related business logic and orchestration.

**Responsibilities**:
- Game creation and management
- Player management (join/leave games)
- Game state management
- Match generation and management
- Access control and permissions
- Game data validation

**Key Methods**:
- `createGame(gameData)` - Create new game session
- `getAllGames()` - Get all games with computed fields
- `getGameById(gameId)` - Get game by ID with details
- `updateGame(gameId, updateData)` - Update game (with permission check)
- `deleteGame(gameId)` - Delete game (with permission check)
- `joinGame(gameId)` - Join game with validation
- `leaveGame(gameId)` - Leave game
- `saveMatches(gameId, matches)` - Save generated matches
- `isGameOwner(game)` - Check if current user is game owner
- `getMyGames()` - Get games created by current user
- `getJoinedGames()` - Get games joined by current user

**Characteristics**:
- Contains game business rules
- Handles access control and permissions
- Validates game state transitions
- Computes derived data (player count, match count, etc.)

### 3. Application Layer (`app.js`)

**Purpose**: Application-level coordination and global data management.

**Responsibilities**:
- Application lifecycle management
- Global data storage
- Service layer initialization
- App-level utility functions
- Delegation to service layers

**Key Methods**:
- `onLaunch()` - App initialization
- `checkAndRestoreUser()` - Restore user session
- `isNicknameUnique()` - Delegates to UserService
- `getAllUsers()` - Delegates to UserService
- `getCurrentUser()` - Delegates to UserService
- `saveUserToGlobalList()` - Delegates to UserService
- `syncToCloud()` - Handles data synchronization
- `readAllCloudProfiles()` - Delegates to UserService

**Characteristics**:
- Minimal business logic
- Focuses on app-level coordination
- Maintains global state
- Delegates to appropriate service layers

## Data Flow

```
UI Layer (Pages)
    ↓
Application Layer (app.js)
    ↓
Business Logic Layer (UserService/GameService)
    ↓
Raw Database Layer (CloudDBService)
    ↓
WeChat Cloud Database
```

## Benefits of This Architecture

### 1. Separation of Concerns
- **Database Layer**: Only handles data persistence
- **Service Layer**: Contains business logic and rules
- **App Layer**: Handles application coordination

### 2. Maintainability
- Changes to business logic don't affect database operations
- Database schema changes only affect the database layer
- Clear boundaries between different types of logic

### 3. Testability
- Each layer can be tested independently
- Business logic can be unit tested without database dependencies
- Database operations can be mocked for service layer tests

### 4. Reusability
- Service methods can be reused across different pages
- Database operations are generic and reusable
- Business logic is centralized and consistent

### 5. Scalability
- Easy to add new services for different domains
- Database layer can be optimized independently
- Business logic can be enhanced without affecting other layers

## Usage Examples

### User Login Flow
```javascript
// In a page
const UserService = require('../../utils/user-service.js');

async function handleLogin() {
  try {
    const result = await UserService.loginWithWeChat();
    if (result.success) {
      // User logged in successfully
      console.log('Logged in user:', result.user);
    } else {
      // User needs registration
      console.log('New user, openid:', result.openid);
    }
  } catch (error) {
    console.error('Login failed:', error);
  }
}
```

### Game Creation
```javascript
// In a page
const GameService = require('../../utils/game-service.js');

async function createNewGame() {
  try {
    const gameData = {
      title: 'Weekend Tournament',
      maxPlayers: 8,
      description: 'Fun weekend tournament'
    };
    
    const game = await GameService.createGame(gameData);
    console.log('Game created:', game);
  } catch (error) {
    console.error('Game creation failed:', error);
  }
}
```

### Getting User Data
```javascript
// In a page
const UserService = require('../../utils/user-service.js');

async function loadUserProfile() {
  try {
    const currentUser = UserService.getCurrentUser();
    if (currentUser) {
      console.log('Current user:', currentUser);
    } else {
      console.log('No user logged in');
    }
  } catch (error) {
    console.error('Error loading user profile:', error);
  }
}
```

## Migration Guide

### For Existing Pages

1. **Replace direct CloudDBService calls** with appropriate service calls:
   ```javascript
   // Old way
   const CloudDBService = require('../../utils/cloud-db.js');
   const user = await CloudDBService.getUserByOpenid(openid);
   
   // New way
   const UserService = require('../../utils/user-service.js');
   const user = await UserService.getUserById(openid);
   ```

2. **Use service methods for business operations**:
   ```javascript
   // Old way - direct database operations
   const result = await CloudDBService.createUser(userData);
   
   // New way - business logic handled by service
   const user = await UserService.registerUser(openid, userData);
   ```

3. **Leverage computed data from services**:
   ```javascript
   // Old way - manual computation
   const users = await CloudDBService.getAllUsers();
   const usersWithRanking = users.map(user => {
     // Manual ranking calculation
   });
   
   // New way - service provides computed data
   const usersWithRanking = await UserService.getAllUsersWithRanking();
   ```

### For New Features

1. **Add new database operations** to `CloudDBService` if needed
2. **Add business logic** to appropriate service (`UserService` or `GameService`)
3. **Add app-level coordination** to `app.js` if needed
4. **Update pages** to use the new service methods

## Best Practices

1. **Never call CloudDBService directly from pages** - always use service layers
2. **Keep business logic in services** - don't put it in pages or app.js
3. **Use service methods for data access** - they provide computed fields and validation
4. **Handle errors appropriately** - services throw errors that should be caught by pages
5. **Maintain separation of concerns** - each layer has a specific responsibility

## Future Enhancements

1. **Add more services** for different domains (e.g., `MatchService`, `StatisticsService`)
2. **Implement caching layer** for frequently accessed data
3. **Add event system** for cross-service communication
4. **Implement data validation layer** with schema validation
5. **Add logging and monitoring** service layer 