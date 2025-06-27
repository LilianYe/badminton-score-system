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
  const playerFields = ['PlayerA1', 'PlayerA2', 'PlayerB1', 'PlayerB2'];
  
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
    console.log(`=== UPDATING PERFORMANCE FOR ${playerName} ===`);
    console.log('Player name:', playerName);
    console.log('Is winner:', isWinner);
    console.log('ELO change:', eloChange);
    console.log('Is mixed:', isMixed);
    
    // Find the player's performance record
    let playerRes = await db.collection('UserPerformance')
      .where({
        Name: playerName
      })
      .get();

    console.log('Found performance records:', playerRes.data.length);
    
    let playerRecord = playerRes.data[0];
    if (!playerRecord) {
      console.log(`No performance record found for ${playerName}, creating new one`);
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
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      const addRes = await db.collection('UserPerformance').add({ data: playerRecord });
      playerRecord._id = addRes._id;
      console.log(`Inserted initial UserPerformance record for ${playerName} with ID: ${addRes._id}`);
    } else {
      console.log(`Found existing performance record for ${playerName}:`, {
        _id: playerRecord._id,
        ELO: playerRecord.ELO,
        Games: playerRecord.Games,
        Wins: playerRecord.Wins,
        Losses: playerRecord.Losses
      });
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
    
    console.log('Performance update data:', {
      current: { ELO: currentELO, Games: currentGames, Wins: currentWins, Losses: currentLosses },
      new: { ELO: newELO, Games: newGames, Wins: newWins, Losses: newLosses },
      isMixed: isMixed,
      mixedStats: { Games: newMixedGames, Wins: newMixedWins, Losses: newMixedLosses },
      sameGenderStats: { Games: newSameGenderGames, Wins: newSameGenderWins, Losses: newSameGenderLosses }
    });
    
    // Update the player's performance record
    const updateResult = await db.collection('UserPerformance').doc(playerRecord._id).update({
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
        updatedAt: new Date().toISOString()
      }
    });
    
    console.log('Update result:', updateResult);
    const matchType = isMixed ? 'Mixed' : 'Same Gender';
    console.log(`Updated ${matchType} performance for ${playerName}: Games=${newGames}, Wins=${newWins}, Losses=${newLosses}, ELO=${newELO}`);
    console.log(`=== END UPDATING PERFORMANCE FOR ${playerName} ===`);
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
    // Get the match details
    const matchRes = await db.collection('Match').where({
      MatchId: matchId
    }).get();
    
    console.log('Query result - found matches:', matchRes.data.length);
    if (!matchRes.data || matchRes.data.length === 0) {
      return {
        success: false,
        error: 'Match not found'
      };
    }

    const match = matchRes.data[0];
    // Determine winner (Team A wins if scoreA > scoreB)
    const teamAWins = scoreA > scoreB;

    // Get all players involved
    const teamAPlayers = [match.PlayerA1?.name, match.PlayerA2?.name].filter(Boolean);
    const teamBPlayers = [match.PlayerB1?.name, match.PlayerB2?.name].filter(Boolean);
    const allPlayers = [...teamAPlayers, ...teamBPlayers];

    console.log('=== PLAYER EXTRACTION DEBUG ===');
    console.log('Team A players:', teamAPlayers);
    console.log('Team B players:', teamBPlayers);
    console.log('All players:', allPlayers);
    console.log('Match player data:', {
      PlayerA1: match.PlayerA1,
      PlayerA2: match.PlayerA2,
      PlayerB1: match.PlayerB1,
      PlayerB2: match.PlayerB2
    });

    // Extract player information directly from match record
    const playerGenders = {};
    const playerELOs = {};
    
    for (const playerName of allPlayers) {
      const playerInfo = extractPlayerInfo(match, playerName);
      if (playerInfo) {
        playerGenders[playerName] = playerInfo.gender;
        playerELOs[playerName] = playerInfo.elo || 1500;
        console.log(`Player info for ${playerName}:`, playerInfo);
      } else {
        console.log(`Could not find player info for ${playerName}, using defaults`);
        playerGenders[playerName] = 'unknown';
        playerELOs[playerName] = 1500;
      }
    }
    console.log('=== END PLAYER EXTRACTION DEBUG ===');

    // Determine if this is a mixed match
    const isMixed = isMixedMatch(teamAPlayers, teamBPlayers, playerGenders);
    console.log(`Match type: ${isMixed ? 'Mixed' : 'Same Gender'}`);
    console.log('Player genders:', playerGenders);

    // Calculate average ELO for each team
    const teamAELO = teamAPlayers.reduce((sum, player) => sum + playerELOs[player], 0) / teamAPlayers.length;
    const teamBELO = teamBPlayers.reduce((sum, player) => sum + playerELOs[player], 0) / teamBPlayers.length;

    // Update performance for all players
    const updatePromises = [];
    const playerEloChanges = {};

    console.log('=== PERFORMANCE UPDATE LOOP DEBUG ===');
    for (const playerName of allPlayers) {
      const isTeamA = teamAPlayers.includes(playerName);
      const isWinner = isTeamA ? teamAWins : !teamAWins;
      const actualResult = isWinner ? 1 : 0;
      
      // Calculate ELO change
      const playerELO = playerELOs[playerName];
      const opponentELO = isTeamA ? teamBELO : teamAELO;
      const eloChange = calculateELOChange(playerELO, opponentELO, actualResult);
      
      // Store ELO change for updating match record
      playerEloChanges[playerName] = eloChange;

      console.log(`Processing ${playerName}: TeamA=${isTeamA}, Winner=${isWinner}, ELO=${playerELO}, OpponentELO=${opponentELO}, ELOChange=${eloChange}`);

      updatePromises.push(
        updatePlayerPerformance(playerName, isWinner, eloChange, isMixed)
      );
    }
    console.log('=== END PERFORMANCE UPDATE LOOP DEBUG ===');

    // Wait for all performance updates to complete
    console.log('Waiting for all performance updates to complete...');
    await Promise.all(updatePromises);
    console.log('All performance updates completed');

    // Update match record with ELO changes
    const matchUpdateData = {
      ScoreA: scoreA,
      ScoreB: scoreB,
      CompleteTime: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    // Add ELO changes to player data
    if (match.PlayerA1 && match.PlayerA1.name && playerEloChanges[match.PlayerA1.name] !== undefined) {
      matchUpdateData.PlayerA1 = {
        ...match.PlayerA1,
        eloChanged: playerEloChanges[match.PlayerA1.name]
      };
      console.log(`Added ELO change for ${match.PlayerA1.name}: ${playerEloChanges[match.PlayerA1.name]}`);
    }
    if (match.PlayerA2 && match.PlayerA2.name && playerEloChanges[match.PlayerA2.name] !== undefined) {
      matchUpdateData.PlayerA2 = {
        ...match.PlayerA2,
        eloChanged: playerEloChanges[match.PlayerA2.name]
      };
      console.log(`Added ELO change for ${match.PlayerA2.name}: ${playerEloChanges[match.PlayerA2.name]}`);
    }
    if (match.PlayerB1 && match.PlayerB1.name && playerEloChanges[match.PlayerB1.name] !== undefined) {
      matchUpdateData.PlayerB1 = {
        ...match.PlayerB1,
        eloChanged: playerEloChanges[match.PlayerB1.name]
      };
      console.log(`Added ELO change for ${match.PlayerB1.name}: ${playerEloChanges[match.PlayerB1.name]}`);
    }
    if (match.PlayerB2 && match.PlayerB2.name && playerEloChanges[match.PlayerB2.name] !== undefined) {
      matchUpdateData.PlayerB2 = {
        ...match.PlayerB2,
        eloChanged: playerEloChanges[match.PlayerB2.name]
      };
      console.log(`Added ELO change for ${match.PlayerB2.name}: ${playerEloChanges[match.PlayerB2.name]}`);
    }

    console.log('Updating match record with ELO changes:', matchUpdateData);

    // Update match record with scores, completion time, and ELO changes
    await db.collection('Match').where({
      MatchId: matchId
    }).update({
      data: matchUpdateData
    });

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