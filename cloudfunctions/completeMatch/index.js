const cloud = require('wx-server-sdk');

cloud.init({
  env: "elo-system-8g6jq2r4a931945e"
});

const db = cloud.database();

// Calculate ELO change based on expected vs actual result
function calculateELOChange(playerELO, opponentELO, actualResult, kFactor = 32) {
  const expectedScore = 1 / (1 + Math.pow(10, (opponentELO - playerELO) / 400));
  const actualScore = actualResult; // 1 for win, 0 for loss
  return Math.round(kFactor * (actualScore - expectedScore));
}

// Determine if a match is mixed (has both male and female players)
function isMixedMatch(teamAPlayers, teamBPlayers, playerGenders) {
  // Get genders for each team
  const teamAGenders = teamAPlayers.map(player => playerGenders[player]).filter(Boolean);
  const teamBGenders = teamBPlayers.map(player => playerGenders[player]).filter(Boolean);
  
  // Check if either team has both male and female players
  const teamAHasBoth = teamAGenders.includes('male') && teamAGenders.includes('female');
  const teamBHasBoth = teamBGenders.includes('male') && teamBGenders.includes('female');
  
  return teamAHasBoth || teamBHasBoth;
}

// Extract player information from match record
function extractPlayerInfo(match, playerName) {
  // Check all possible player fields in the match record
  const playerFields = ['PlayerNameA1', 'PlayerNameA2', 'PlayerNameB1', 'PlayerNameB2'];
  
  for (const field of playerFields) {
    if (match[field] && match[field].name === playerName) {
      return {
        name: match[field].name,
        gender: match[field].gender,
        elo: match[field].elo
      };
    }
  }
  
  return null;
}

// Update a single player's performance stats
async function updatePlayerPerformance(playerName, isWinner, eloChange, isMixed) {
  try {
    // Find the player's performance record
    let playerRes = await db.collection('UserPerformance')
      .where({
        Name: playerName
      })
      .get();

    let playerRecord = playerRes.data[0];
    if (!playerRecord) {
      // Insert initial record if not found
      playerRecord = {
        Name: playerName,
        ELO: 1500,
        Games: 0,
        Wins: 0,
        Losses: 0,
        WinRate: 0,
        MixedGames: 0,
        MixedWins: 0,
        MixedLosses: 0,
        MixedWinRate: 0,
        SameGenderGames: 0,
        SameGenderWins: 0,
        SameGenderLosses: 0,
        SameGenderWinRate: 0,
        createdAt: new Date(),
        updatedAt: new Date()
      };
      const addRes = await db.collection('UserPerformance').add({ data: playerRecord });
      playerRecord._id = addRes._id;
      console.log(`Inserted initial UserPerformance record for ${playerName}`);
    }

    const currentELO = playerRecord.ELO || 1500;
    const currentGames = playerRecord.Games || 0;
    const currentWins = playerRecord.Wins || 0;
    const currentLosses = playerRecord.Losses || 0;
    // Mixed games stats
    const currentMixedGames = playerRecord.MixedGames || 0;
    const currentMixedWins = playerRecord.MixedWins || 0;
    const currentMixedLosses = playerRecord.MixedLosses || 0;
    // Same gender games stats
    const currentSameGenderGames = playerRecord.SameGenderGames || 0;
    const currentSameGenderWins = playerRecord.SameGenderWins || 0;
    const currentSameGenderLosses = playerRecord.SameGenderLosses || 0;

    // Calculate new stats
    const newGames = currentGames + 1;
    const newWins = isWinner ? currentWins + 1 : currentWins;
    const newLosses = isWinner ? currentLosses : currentLosses + 1;
    const newELO = currentELO + eloChange;
    const newWinRate = newGames > 0 ? newWins / newGames : 0;
    // Update mixed or same gender stats
    let newMixedGames = currentMixedGames;
    let newMixedWins = currentMixedWins;
    let newMixedLosses = currentMixedLosses;
    let newMixedWinRate = currentMixedGames > 0 ? currentMixedWins / currentMixedGames : 0;
    let newSameGenderGames = currentSameGenderGames;
    let newSameGenderWins = currentSameGenderWins;
    let newSameGenderLosses = currentSameGenderLosses;
    let newSameGenderWinRate = currentSameGenderGames > 0 ? currentSameGenderWins / currentSameGenderGames : 0;
    if (isMixed) {
      newMixedGames = currentMixedGames + 1;
      newMixedWins = isWinner ? currentMixedWins + 1 : currentMixedWins;
      newMixedLosses = isWinner ? currentMixedLosses : currentMixedLosses + 1;
      newMixedWinRate = newMixedGames > 0 ? newMixedWins / newMixedGames : 0;
    } else {
      newSameGenderGames = currentSameGenderGames + 1;
      newSameGenderWins = isWinner ? currentSameGenderWins + 1 : currentSameGenderWins;
      newSameGenderLosses = isWinner ? currentSameGenderLosses : currentSameGenderLosses + 1;
      newSameGenderWinRate = newSameGenderGames > 0 ? newSameGenderWins / newSameGenderGames : 0;
    }
    // Update the player's performance record
    await db.collection('UserPerformance').doc(playerRecord._id).update({
      data: {
        Games: newGames,
        Wins: newWins,
        Losses: newLosses,
        ELO: newELO,
        WinRate: newWinRate,
        MixedGames: newMixedGames,
        MixedWins: newMixedWins,
        MixedLosses: newMixedLosses,
        MixedWinRate: newMixedWinRate,
        SameGenderGames: newSameGenderGames,
        SameGenderWins: newSameGenderWins,
        SameGenderLosses: newSameGenderLosses,
        SameGenderWinRate: newSameGenderWinRate,
        updatedAt: new Date()
      }
    });
    const matchType = isMixed ? 'Mixed' : 'Same Gender';
    console.log(`Updated ${matchType} performance for ${playerName}: Games=${newGames}, Wins=${newWins}, Losses=${newLosses}, ELO=${newELO}`);
  } catch (error) {
    console.error(`Error updating performance for ${playerName}:`, error);
    throw error;
  }
}

// Main cloud function
exports.main = async (event, context) => {
  const { matchId, scoreA, scoreB } = event;
  
  if (!matchId || scoreA === undefined || scoreB === undefined) {
    return {
      success: false,
      error: 'Missing required parameters: matchId, scoreA, scoreB'
    };
  }

  // Validate that scores are different (no draws in badminton)
  if (scoreA === scoreB) {
    return {
      success: false,
      error: 'Scores cannot be equal. Badminton matches must have a winner.'
    };
  }

  try {
    console.log(`Completing match ${matchId} with score ${scoreA}-${scoreB}`);

    // Get the match details
    const matchRes = await db.collection('Match').where({
      MatchId: matchId
    }).get();
    
    if (!matchRes.data || matchRes.data.length === 0) {
      return {
        success: false,
        error: 'Match not found'
      };
    }

    const match = matchRes.data[0];
    
    // Check if match is already completed
    if (match.CompleteTime) {
      return {
        success: false,
        error: 'Match is already completed'
      };
    }

    // Determine winner (Team A wins if scoreA > scoreB)
    const teamAWins = scoreA > scoreB;

    // Get all players involved
    const teamAPlayers = [match.PlayerNameA1?.name, match.PlayerNameA2?.name].filter(Boolean);
    const teamBPlayers = [match.PlayerNameB1?.name, match.PlayerNameB2?.name].filter(Boolean);
    const allPlayers = [...teamAPlayers, ...teamBPlayers];

    // Extract player information directly from match record
    const playerGenders = {};
    const playerELOs = {};
    
    for (const playerName of allPlayers) {
      const playerInfo = extractPlayerInfo(match, playerName);
      if (playerInfo) {
        playerGenders[playerName] = playerInfo.gender;
        playerELOs[playerName] = playerInfo.elo || 1500;
      } else {
        console.log(`Could not find player info for ${playerName}, using defaults`);
        playerGenders[playerName] = 'unknown';
        playerELOs[playerName] = 1500;
      }
    }

    // Determine if this is a mixed match
    const isMixed = isMixedMatch(teamAPlayers, teamBPlayers, playerGenders);
    console.log(`Match type: ${isMixed ? 'Mixed' : 'Same Gender'}`);
    console.log('Player genders:', playerGenders);

    // Calculate average ELO for each team
    const teamAELO = teamAPlayers.reduce((sum, player) => sum + playerELOs[player], 0) / teamAPlayers.length;
    const teamBELO = teamBPlayers.reduce((sum, player) => sum + playerELOs[player], 0) / teamBPlayers.length;

    // Update match record
    await db.collection('Match').where({
      MatchId: matchId
    }).update({
      data: {
        ScoreA: scoreA,
        ScoreB: scoreB,
        CompleteTime: new Date(),
        updatedAt: new Date()
      }
    });

    console.log(`Updated match ${matchId}`);

    // Update performance for all players
    const updatePromises = [];

    for (const playerName of allPlayers) {
      const isTeamA = teamAPlayers.includes(playerName);
      const isWinner = isTeamA ? teamAWins : !teamAWins;
      const actualResult = isWinner ? 1 : 0;
      
      // Calculate ELO change
      const playerELO = playerELOs[playerName];
      const opponentELO = isTeamA ? teamBELO : teamAELO;
      const eloChange = calculateELOChange(playerELO, opponentELO, actualResult);

      updatePromises.push(
        updatePlayerPerformance(playerName, isWinner, eloChange, isMixed)
      );
    }

    // Wait for all performance updates to complete
    await Promise.all(updatePromises);

    console.log(`Successfully completed match ${matchId} and updated all player performances`);

    return {
      success: true,
      message: 'Match completed successfully',
      data: {
        matchId,
        scoreA,
        scoreB,
        playersUpdated: allPlayers.length,
        isMixed: isMixed
      }
    };

  } catch (error) {
    console.error('Error completing match:', error);
    return {
      success: false,
      error: error.message || 'Failed to complete match'
    };
  }
};

function formatPercent(val) {
    if (typeof val !== 'number' || isNaN(val)) return '0.0';
    return (val * 100).toFixed(1);
}

// In your loadUserStats function, after getting stats:
if (res.data && res.data.length > 0) {
    const stats = res.data[0];
    this.setData({
        userStats: {
            ...stats,
            winRateDisplay: formatPercent(stats.WinRate),
            sameGenderWinRateDisplay: formatPercent(stats.SameGenderWinRate),
            mixedWinRateDisplay: formatPercent(stats.MixedWinRate)
        }
    });
} 