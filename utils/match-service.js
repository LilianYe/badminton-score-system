/**
 * Match Service - Business Logic Layer
 * Handles match-related business logic, validation, and orchestration
 * Uses CloudDBService for raw database operations
 */

const CloudDBService = require('./cloud-db.js');
const UserService = require('./user-service.js');

class MatchService {
  /**
   * Initialize match service
   */
  static init() {
    return CloudDBService.init();
  }

  /**
   * Format time for display
   * @param {any} dateInput - Date input (string, number, or object)
   * @returns {string} Formatted time string
   */
  static formatTime(dateInput) {
    if (!dateInput) return '';
    
    let d;
    console.log('formatTime input:', dateInput, 'type:', typeof dateInput);
    
    if (typeof dateInput === 'string') {
      d = new Date(dateInput);
    } else if (typeof dateInput === 'number') {
      d = new Date(dateInput);
    } else if (typeof dateInput === 'object') {
      if (dateInput.$date) {
        d = new Date(dateInput.$date);
      } else if (dateInput instanceof Date) {
        d = dateInput;
      } else {
        console.log('Unknown object format for date:', dateInput);
        return '';
      }
    } else {
      console.log('Unknown date format:', dateInput);
      return '';
    }
    
    if (isNaN(d.getTime())) {
      console.log('Invalid date after parsing:', d);
      return '';
    }
    
    const y = d.getFullYear();
    const m = (d.getMonth() + 1).toString().padStart(2, '0');
    const day = d.getDate().toString().padStart(2, '0');
    const h = d.getHours().toString().padStart(2, '0');
    const min = d.getMinutes().toString().padStart(2, '0');
    const formatted = `${y}-${m}-${day} ${h}:${min}`;
    
    console.log('formatted time:', formatted);
    return formatted;
  }

  /**
   * Extract player name from different possible formats
   * @param {any} playerField - Player field (string or object)
   * @returns {string|null} Player name or null
   */
  static getPlayerName(playerField) {
    if (!playerField) return null;
    if (typeof playerField === 'string') return playerField;
    if (typeof playerField === 'object' && playerField.name) return playerField.name;
    return null;
  }

  /**
   * Extract player ELO from player object
   * @param {any} playerField - Player field (string or object)
   * @returns {number} Player ELO or default 1500
   */
  static getPlayerElo(playerField) {
    if (!playerField) return 1500;
    if (typeof playerField === 'object' && typeof playerField.elo === 'number') return playerField.elo;
    return 1500;
  }

  /**
   * Extract player gender from player object
   * @param {any} playerField - Player field (string or object)
   * @returns {string} Player gender or 'unknown'
   */
  static getPlayerGender(playerField) {
    if (!playerField) return 'unknown';
    if (typeof playerField === 'object' && playerField.gender) return playerField.gender;
    return 'unknown';
  }

  /**
   * Filter matches by current user
   * @param {Array} matches - Array of match data
   * @param {string} currentUserName - Current user's name
   * @returns {Array} Filtered matches
   */
  static filterMatchesByUser(matches, currentUserName) {
    return matches.filter(match => {
      const playerNames = [
        this.getPlayerName(match.PlayerA1),
        this.getPlayerName(match.PlayerA2),
        this.getPlayerName(match.PlayerB1),
        this.getPlayerName(match.PlayerB2),
        this.getPlayerName(match.Referee)
      ].filter(Boolean);
      
      return playerNames.includes(currentUserName);
    });
  }

  /**
   * Process match data for display (add formatted times and player names)
   * @param {Array} matches - Array of match data
   * @returns {Array} Processed matches with formatted times and player names
   */
  static processMatchesForDisplay(matches) {
    return matches.map(match => {
      const processedMatch = {
        ...match,
        formattedStartTime: this.formatTime(match.StartTime),
        formattedCompleteTime: this.formatTime(match.CompleteTime),
        PlayerA1: match.PlayerA1,
        PlayerA2: match.PlayerA2,
        PlayerB1: match.PlayerB1,
        PlayerB2: match.PlayerB2,
        Referee: match.Referee,
        Court: match.Court
      };
      return processedMatch;
    });
  }

  /**
   * Get upcoming matches for current user
   * @returns {Promise<Array>} Array of upcoming matches for current user
   */
  static async getUpcomingMatchesForUser() {
    try {
      console.log('Getting upcoming matches for current user...');
      
      // Get current user
      const currentUser = UserService.getCurrentUser();
      if (!currentUser || !currentUser.Name) {
        throw new Error('用户未登录');
      }
      
      // Get all upcoming matches from database
      const allMatches = await CloudDBService.getUpcomingMatches();
      
      // Filter matches for current user
      const userMatches = this.filterMatchesByUser(allMatches, currentUser.Name);
      
      // Process matches for display
      const processedMatches = this.processMatchesForDisplay(userMatches);
      
      console.log(`Found ${processedMatches.length} upcoming matches for user`);
      return processedMatches;
    } catch (error) {
      console.error('Error getting upcoming matches for user:', error);
      throw error;
    }
  }

  /**
   * Get completed matches for current user
   * @returns {Promise<Array>} Array of completed matches for current user
   */
  static async getCompletedMatchesForUser() {
    try {
      console.log('Getting completed matches for current user...');
      const currentUser = UserService.getCurrentUser();
      if (!currentUser || !currentUser.Name) {
        throw new Error('用户未登录');
      }
      // Use the new optimized query
      const userMatches = await CloudDBService.getCompletedMatchesByUserName(currentUser.Name);
      const processedMatches = userMatches.map(match => {
        let result = '';
        const isPlayerA = [
          this.getPlayerName(match.PlayerA1), 
          this.getPlayerName(match.PlayerA2)
        ].includes(currentUser.Name);
        const isPlayerB = [
          this.getPlayerName(match.PlayerB1), 
          this.getPlayerName(match.PlayerB2)
        ].includes(currentUser.Name);
        if (isPlayerA) {
          result = match.ScoreA > match.ScoreB ? 'Win' : 'Loss';
        } else if (isPlayerB) {
          result = match.ScoreB > match.ScoreA ? 'Win' : 'Loss';
        } else {
          result = 'Referee';
        }
        const processedMatch = {
          ...match,
          formattedCompleteTime: this.formatTime(match.CompleteTime),
          result: result,
          PlayerA1: match.PlayerA1,
          PlayerA2: match.PlayerA2,
          PlayerB1: match.PlayerB1,
          PlayerB2: match.PlayerB2,
          Referee: match.Referee,
          Court: match.Court
        };
        return processedMatch;
      });
      console.log(`Found ${processedMatches.length} completed matches for user`);
      return processedMatches;
    } catch (error) {
      console.error('Error getting completed matches for user:', error);
      throw error;
    }
  }

  /**
   * Update match scores
   * @param {string} matchId - Match ID (MatchId field value)
   * @param {number} scoreA - Team A score
   * @param {number} scoreB - Team B score
   * @returns {Promise<Object>} Update result
   */
  static async updateMatchScores(matchId, scoreA, scoreB) {
    try {
      console.log('=== MATCH SERVICE UPDATE DEBUG ===');
      console.log('MatchService received matchId:', matchId, 'type:', typeof matchId);
      console.log('MatchService received scoreA:', scoreA, 'type:', typeof scoreA);
      console.log('MatchService received scoreB:', scoreB, 'type:', typeof scoreB);
      
      // Validate scores
      if (scoreA === scoreB) {
        throw new Error('Scores cannot be equal. Badminton matches must have a winner.');
      }
      
      if (scoreA < 0 || scoreB < 0) {
        throw new Error('Scores cannot be negative.');
      }
      
      // Call the cloud function to complete the match
      const result = await wx.cloud.callFunction({
        name: 'completeMatch',
        data: {
          matchId: matchId,
          scoreA: Number(scoreA),
          scoreB: Number(scoreB)
        }
      });
      
      console.log('Cloud function result:', result);
      
      if (result.result && result.result.success) {
        console.log('Match completed successfully via cloud function');
        return result.result;
      } else {
        const errorMessage = result.result?.error || 'Failed to complete match';
        console.error('Cloud function failed:', errorMessage);
        throw new Error(errorMessage);
      }
    } catch (error) {
      console.error('Error updating match scores:', error);
      throw error;
    }
  }

  /**
   * Get match by ID
   * @param {string} matchId - Match document ID
   * @returns {Promise<Object|null>} Match data or null if not found
   */
  static async getMatchById(matchId) {
    try {
      console.log('Getting match by ID:', matchId);
      
      const match = await CloudDBService.getMatchById(matchId);
      
      if (match) {
        // Process match for display
        const processedMatch = this.processMatchesForDisplay([match])[0];
        console.log('Match found:', processedMatch);
        return processedMatch;
      }
      
      console.log('Match not found for ID:', matchId);
      return null;
    } catch (error) {
      console.error('Error getting match by ID:', error);
      throw error;
    }
  }

  /**
   * Get player information from match for ELO calculations
   * @param {Object} match - Match object
   * @returns {Object} Player information with names, ELOs, and genders
   */
  static getMatchPlayerInfo(match) {
    return {
      teamAPlayers: [
        { 
          name: this.getPlayerName(match.PlayerA1), 
          elo: this.getPlayerElo(match.PlayerA1), 
          gender: this.getPlayerGender(match.PlayerA1)
        },
        {
          name: this.getPlayerName(match.PlayerA2), 
          elo: this.getPlayerElo(match.PlayerA2), 
          gender: this.getPlayerGender(match.PlayerA2)
        }
      ].filter(p => p.name),
      teamBPlayers: [
        { 
          name: this.getPlayerName(match.PlayerB1), 
          elo: this.getPlayerElo(match.PlayerB1), 
          gender: this.getPlayerGender(match.PlayerB1)
        },
        { 
          name: this.getPlayerName(match.PlayerB2), 
          elo: this.getPlayerElo(match.PlayerB2), 
          gender: this.getPlayerGender(match.PlayerB2)
        }
      ].filter(p => p.name),
      referee: { 
        name: this.getPlayerName(match.Referee), 
        elo: this.getPlayerElo(match.Referee), 
        gender: this.getPlayerGender(match.Referee)
      }
    };
  }
}

module.exports = MatchService; 