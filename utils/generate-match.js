// Global trackers for partnerships, opponents, and expected wins
const global_partnerships = {};
const global_opponents = {};
const global_expected_wins = {};


/**
 * Recursive backtracking for rest schedule generation with consecutive rounds limit
 * @param {string[]} players
 * @param {Array[]} restSchedule - Array of arrays, each round's rest players
 * @param {Object} restCounts - {player: restCount}
 * @param {number} currentRound
 * @param {number} totalRounds
 * @param {number[]} restPerRound - How many rest slots per round 
 * @param {number} targetRestCount
 * @param {Object} playerConsecutiveActive - {player: consecutiveActiveRounds}
 * @param {number} maxConsecutiveRounds - Maximum consecutive active rounds before mandatory rest
 * @returns {boolean}
 */
function backtrackRestScheduleVariable(players, restSchedule, restCounts, currentRound, totalRounds, restPerRound, targetRestCount, playerConsecutiveActive, maxConsecutiveRounds) {
  if (currentRound === totalRounds) return true;
  const restCountNeeded = restPerRound[currentRound];
  const roundsLeft = totalRounds - currentRound;

  // 1. Players who must rest due to consecutive actives
  const mustRestConsecutive = players.filter(p => (playerConsecutiveActive[p.name] || 0) >= maxConsecutiveRounds);
  // 2. Players who must rest to meet target rest count
  const restNeeded = {};
  players.forEach(p => restNeeded[p.name] = targetRestCount - restCounts[p.name]);
  const mustRestCount = players.filter(p => restNeeded[p.name] > 0 && restNeeded[p.name] > roundsLeft - 1);
  const mustRest = Array.from(new Set([...mustRestConsecutive, ...mustRestCount]));
  if (mustRest.length > restCountNeeded) {
    console.log('  [FAIL] Too many must-rest players for available rest slots.');
    return false;
  }    
  if (players.filter(p => restCounts[p.name] < targetRestCount).length < restCountNeeded) {
    console.log('  [FAIL] Not enough players left who need rest.');
    return false;
  }
  // Candidates for resting  
  const validCandidates = players.filter(p => restCounts[p.name] < targetRestCount && !mustRest.includes(p));
  const femaleCandidates = validCandidates.filter(p => p.gender === 'female').sort((a, b) => (playerConsecutiveActive[b.name] || 0) - (playerConsecutiveActive[a.name] || 0));
  const maleCandidates = validCandidates.filter(p => p.gender === 'male').sort((a, b) => (playerConsecutiveActive[b.name] || 0) - (playerConsecutiveActive[a.name] || 0));
  const mustRestFemales = mustRest.filter(p => p.gender === 'female');

  // Gender balance
  const restSlotsRemaining = restCountNeeded - mustRest.length;
  const currentFemaleCount = mustRestFemales.length;
  const totalFemales = players.filter(p => p.gender === 'female').length;
  const activeFemales = totalFemales - currentFemaleCount;
  const neededFemalesToRest = activeFemales % 2;

  // Generate combinations
  let combinationsToTry = [];
  function getCombinations(arr, k) {
    if (k === 0) return [[]];
    if (arr.length < k) return [];
    if (arr.length === k) return [arr.slice()];
    let result = [];
    for (let i = 0; i <= arr.length - k; i++) {
      let head = arr[i];
      let tailCombos = getCombinations(arr.slice(i + 1), k - 1);
      tailCombos.forEach(tail => result.push([head, ...tail]));
    }
    return result;
  }

  if (neededFemalesToRest === 1) {
    for (let offset = 0; offset <= Math.floor((femaleCandidates.length + 1) / 2); offset++) {
      let femalesToAdd = 1 + offset * 2;
      if (femalesToAdd > restSlotsRemaining) continue;
      let malesToAdd = restSlotsRemaining - femalesToAdd;
      if (malesToAdd > maleCandidates.length) continue;
      let femaleCombos = getCombinations(femaleCandidates, Math.min(femalesToAdd, femaleCandidates.length));
      let maleCombos = getCombinations(maleCandidates, Math.min(malesToAdd, maleCandidates.length));
      femaleCombos.forEach(fCombo => {
        maleCombos.forEach(mCombo => {
          combinationsToTry.push([...fCombo, ...mCombo]);
        });
      });
    }
  } else {
    for (let offset = 0; offset <= Math.floor(femaleCandidates.length / 2); offset++) {
      let femalesToAdd = offset * 2;
      if (femalesToAdd > restSlotsRemaining) continue;
      let malesToAdd = restSlotsRemaining - femalesToAdd;
      if (malesToAdd > maleCandidates.length) continue;
      let femaleCombos = getCombinations(femaleCandidates, Math.min(femalesToAdd, femaleCandidates.length));
      let maleCombos = getCombinations(maleCandidates, Math.min(malesToAdd, maleCandidates.length));
      femaleCombos.forEach(fCombo => {
        maleCombos.forEach(mCombo => {
          combinationsToTry.push([...fCombo, ...mCombo]);
        });
      });
    }
  }
  if (combinationsToTry.length > 1) {
    for (let i = combinationsToTry.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [combinationsToTry[i], combinationsToTry[j]] = [combinationsToTry[j], combinationsToTry[i]];
    }
  }

  for (let comboIdx = 0; comboIdx < combinationsToTry.length; comboIdx++) {
    let combo = combinationsToTry[comboIdx];    
    // Copy consecutive active state
    let playerConsecutiveActiveCopy = { ...playerConsecutiveActive };
    // Add mustRest and combo to restSchedule
    let restThisRound = [...mustRest, ...combo];
    restThisRound.forEach(player => {
      restSchedule[currentRound].push(player);
      restCounts[player.name]++;
      playerConsecutiveActiveCopy[player.name] = 0;
    });
    // Update consecutive actives for others
    players.forEach(player => {
      if (!restThisRound.includes(player)) {
        playerConsecutiveActiveCopy[player.name] = (playerConsecutiveActiveCopy[player.name] || 0) + 1;
      }
    });
    // Recurse
    if (backtrackRestScheduleVariable(players, restSchedule, restCounts, currentRound + 1, totalRounds, restPerRound, targetRestCount, playerConsecutiveActiveCopy, maxConsecutiveRounds)) {
      return true;
    }
    // Backtrack
    restThisRound.forEach(player => {
      restSchedule[currentRound].pop();
      restCounts[player.name]--;
    });
  }
  // If no valid combination found
  console.log(`[RestSchedule][Round ${currentRound}] [FAIL] No valid combination found.`);
  return false;
}


/**
 * Generates rest schedule and court assignments for all rounds.
 * @param {string[]} players
 * @param {number} courtCount
 * @param {number} gamePerPlayer
 * @param {number} eloThreshold
 * @param {number} teamEloDiff
 * @param {number} maxOpponentFrequency
 * @param {number} maxConsecutiveRounds
 * @param {boolean} ignoreGender - If true, ignore gender balance constraints
 * @param {number} femaleEloDiff - Amount to subtract from female players' ELO when ignoreGender=true
 * @returns {{restSchedule: string[][], roundsLineups: string[][][]}}
 */
function generateRotationFull(players, courtCount, gamePerPlayer, eloThreshold, teamEloDiff, maxOpponentFrequency, maxConsecutiveRounds, ignoreGender, femaleEloDiff = 100) {  
  // Make a deep copy of players to avoid modifying the original objects
  players = players.map(p => ({...p}));
  
  // If ignoreGender is true, adjust ELO scores for female players
  if (ignoreGender) {
    players.forEach(player => {
      if (player.gender === 'female') {
        const originalElo = player.elo;
        player.elo = Math.max(0, player.elo - femaleEloDiff);
        console.log(`Adjusted ELO for female player ${player.name}: ${originalElo} -> ${player.elo} (diff: ${femaleEloDiff})`);
      }
    });
  }
  
  const COURT_SIZE = 4;
  const minExpectedWins = 0;
  const totalPlayers = players.length;
  const totalPlayerGames = totalPlayers * gamePerPlayer;
  const playerSlotsPerRound = courtCount * COURT_SIZE;
  const roundsFloat = totalPlayerGames / playerSlotsPerRound;
  const fullRounds = Math.floor(roundsFloat);
  const hasPartialRound = roundsFloat > fullRounds;
  const rounds = fullRounds + (hasPartialRound ? 1 : 0);
  let lastRoundCourts = courtCount;
  if (hasPartialRound) {
    const remainingPlayerGames = totalPlayerGames - (fullRounds * playerSlotsPerRound);
    lastRoundCourts = Math.ceil(remainingPlayerGames / COURT_SIZE);
  }
  // How many rest slots per round
  const courtsPerRound = Array(rounds - 1).fill(courtCount).concat([lastRoundCourts]);
  const restPerRound = courtsPerRound.map(roundCourts => totalPlayers - roundCourts * COURT_SIZE);  
  // Rest schedule
  const restSchedule = Array.from({ length: rounds }, () => []);
  const restCounts = {};
  players.forEach(p => restCounts[p.name] = 0);
  const targetRestCount = rounds - gamePerPlayer;
  const playerConsecutiveActive = {};
  players.forEach(p => playerConsecutiveActive[p.name] = 0);

  console.log('--- generateRotationFull DEBUG ---');  
  console.log('Players:', players);
  console.log('Female players:', players.filter(p => p.gender === 'female').map(p => `${p.name} (ELO: ${p.elo})`));
  console.log('Total players:', totalPlayers);
  console.log('Court count:', courtCount);  
  console.log('Game per player:', gamePerPlayer);
  console.log('ELO threshold:', eloThreshold);
  console.log('Team ELO diff:', teamEloDiff);
  console.log('Player ELOs:', players.map(p => `${p.name}: ${p.elo}`).join(', '));
  console.log('Total player games:', totalPlayerGames);
  console.log('Player slots per round:', playerSlotsPerRound);
  console.log('Rounds float:', roundsFloat);
  console.log('Full rounds:', fullRounds);
  console.log('Has partial round:', hasPartialRound);
  console.log('Total rounds:', rounds);
  console.log('Courts per round:', courtsPerRound);
  console.log('Rest per round:', restPerRound);
  console.log('Target rest count:', targetRestCount);
  console.log('Max opponent frequency:', maxOpponentFrequency);
  console.log('Max consecutive rounds:', maxConsecutiveRounds);
  console.log('Ignore gender balance:', ignoreGender);
  if (ignoreGender) {
    console.log('Female ELO adjustment:', femaleEloDiff);
  }

  // Generate rest schedule
  const restOk = backtrackRestScheduleVariable(
    players,
    restSchedule,
    restCounts,
    0,
    rounds,
    restPerRound,
    targetRestCount,
    playerConsecutiveActive,
    maxConsecutiveRounds
  );
  if (!restOk) {
    console.error('Failed to generate rest schedule.');
    console.error('Rest schedule so far:', JSON.stringify(restSchedule, null, 2));
    console.error('Rest counts:', restCounts);
    throw new Error('Failed to generate rest schedule');
  }
  console.log('Rest Schedule:', JSON.stringify(restSchedule, null, 2));

  // Court assignments for each round
  const roundsLineups = [];
  
  for (let attempt = 0; attempt < 10000; attempt++) {
    let success = true;
    let tempLineups = [];    
    let playerRemainingRounds = {};
    players.forEach(p => playerRemainingRounds[p.name] = gamePerPlayer);
    // Reset global trackers    
    Object.keys(global_partnerships).forEach(k => delete global_partnerships[k]);
    Object.keys(global_opponents).forEach(k => delete global_opponents[k]);
    Object.keys(global_expected_wins).forEach(k => delete global_expected_wins[k]);
    for (let r = 0; r < rounds; r++) {      
      const active = players.filter(p => !restSchedule[r].includes(p));
      
      // Filter players by gender, but if ignoreGender is true, treat all players as males
      let activeFemales = [];
      let activeMales = active;
      
      if (!ignoreGender) {
        // Only filter by gender if ignoreGender is false
        activeFemales = active.filter(p => p.gender === 'female');
        activeMales = active.filter(p => p.gender === 'male');
      }
      
      const roundCourtCount = courtsPerRound[r];
      const courts = [];
      const usedPlayers = new Set();
      const ok = backtrackCourts(
        courts,
        activeFemales,
        activeMales,
        roundCourtCount,        
        usedPlayers,
        eloThreshold,
        maxOpponentFrequency,
        teamEloDiff,
        playerRemainingRounds,
        minExpectedWins,
        ignoreGender
      );
      if (!ok || courts.length < roundCourtCount) {
        success = false;
        break;
      }
      tempLineups.push(courts);
    }
    if (success) {
      console.log('SUCCESS: Full schedule found on attempt', attempt + 1);
      return { restSchedule, roundsLineups: tempLineups };
    }
  }
  console.error('Failed to generate a valid schedule after multiple attempts');
  throw new Error('Failed to generate a valid schedule after multiple attempts');
}


function checkTeammateEloCompatibility(player1, player2, teamEloDiff) {
  return Math.abs(player1.elo - player2.elo) <= teamEloDiff;
}

function checkExpectedWinBalance(team1, team2, playerRemainingRounds, eloThreshold, minExpectedWins) {
  // ELO difference check (formerly checkTeamElo)
  const team1Avg = (team1[0].elo + team1[1].elo) / 2;
  const team2Avg = (team2[0].elo + team2[1].elo) / 2;
  if (Math.abs(team1Avg - team2Avg) > eloThreshold) return false;
  // Expected win balance check
  const disadvantaged = team1Avg > team2Avg ? team2 : team1;  for (const p of disadvantaged) {
    const current = global_expected_wins[p.name] || 0;
    const remaining = (playerRemainingRounds[p.name] || 0) - 1;
    if (current + remaining < minExpectedWins) return false;
  }
  return true;
}

function checkOpponentsValid(team1, team2, maxOpponentFrequency) {
  for (const p1 of team1) {
    for (const p2 of team2) {
      const pair = [p1.name, p2.name].sort().join('|');
      if ((global_opponents[pair] || 0) > maxOpponentFrequency) {
        return false;
      }
    }
  }
  return true;
}

function getCombinations(arr, k) {
  if (k === 0) return [[]];
  if (arr.length < k) return [];
  if (arr.length === k) return [arr.slice()];
  let result = [];
  for (let i = 0; i <= arr.length - k; i++) {
    let head = arr[i];
    let tailCombos = getCombinations(arr.slice(i + 1), k - 1);
    tailCombos.forEach(tail => result.push([head, ...tail]));
  }
  return result;
}

function backtrackCourts(courts, females, males, courtCount, usedPlayers, eloThreshold, maxOpponentFrequency, teamEloDiff, playerRemainingRounds, minExpectedWins, ignoreGender) {
  // Base case: all courts filled
  if (courts.length === courtCount) return true;

  // Snapshots for backtracking
  const partnershipsSnapshot = { ...global_partnerships };
  const opponentsSnapshot = { ...global_opponents };
  const expectedWinsSnapshot = { ...global_expected_wins };
  const remainingRoundsSnapshot = { ...playerRemainingRounds };

  // Gender options
  let courtOptions = [];
  
  if (ignoreGender) {
    // If ignoring gender, only create all-male courts
    courtOptions.push('all_male');
  } else {
    // Standard gender-balanced court options
    if (females.length >= 2 && males.length >= 2) courtOptions.push('mixed');
    if (females.length >= 4) courtOptions.push('all_female');
    if (males.length >= 4) courtOptions.push('all_male');
  }
  
  // If no options available, stop here
  if (courtOptions.length === 0) {
    return false;
  }
  
  // Randomize options if we have more than one
  if (courtOptions.length > 1) {
    for (let i = courtOptions.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [courtOptions[i], courtOptions[j]] = [courtOptions[j], courtOptions[i]];
    }
  }

  for (const option of courtOptions) {
    let femalesCopy = females.slice();
    let malesCopy = males.slice();
    let usedCopy = new Set(usedPlayers);
    let court = [];
    let success = false;

    if (option === 'mixed') {
      // Team 1: 1F + 1M
      let team1 = null;
      for (const f1 of femalesCopy) {
        if (usedCopy.has(f1)) continue;
        for (const m1 of malesCopy) {
          if (usedCopy.has(m1)) continue;
          const pair = [f1.name, m1.name].sort().join('|');
          if (global_partnerships[pair]) continue;
          if (!checkTeammateEloCompatibility(f1, m1, teamEloDiff)) continue;
          team1 = [f1, m1];
          global_partnerships[pair] = (global_partnerships[pair] || 0) + 1;
          usedCopy.add(f1); 
          usedCopy.add(m1);
          break;
        }
        if (team1) break;
      }
      if (!team1) continue;
      // Team 2: 1F + 1M
      let team2 = null;
      for (const f2 of femalesCopy) {
        if (usedCopy.has(f2)) continue;
        for (const m2 of malesCopy) {
          if (usedCopy.has(m2)) continue;
          const pair = [f2.name, m2.name].sort().join('|');
          if (global_partnerships[pair]) continue;
          if (!checkExpectedWinBalance(team1, [f2, m2], playerRemainingRounds, eloThreshold, minExpectedWins)) continue;
          if (!checkOpponentsValid(team1, [f2, m2], maxOpponentFrequency)) continue;
          if (!checkTeammateEloCompatibility(f2, m2, teamEloDiff)) continue;
          team2 = [f2, m2];
          global_partnerships[pair] = (global_partnerships[pair] || 0) + 1;
          for (const p1 of team1) for (const p2 of team2) {
            const oppPair = [p1.name, p2.name].sort().join('|');
            global_opponents[oppPair] = (global_opponents[oppPair] || 0) + 1;
          }
          for (const p of [...team1, ...team2]) playerRemainingRounds[p.name]--;
          usedCopy.add(f2); 
          usedCopy.add(m2);
          break;
        }
        if (team2) break;
      }
      if (team1 && team2) {
        court = [...team1, ...team2];        
        femalesCopy = femalesCopy.filter(f => !usedCopy.has(f));        
        malesCopy = malesCopy.filter(m => !usedCopy.has(m));
        const team1Avg = (team1[0].elo + team1[1].elo) / 2;
        const team2Avg = (team2[0].elo + team2[1].elo) / 2;
        if (team1Avg > team2Avg) {
          for (const p of team1) global_expected_wins[p.name] = (global_expected_wins[p.name] || 0) + 1;
        } else {
          for (const p of team2) global_expected_wins[p.name] = (global_expected_wins[p.name] || 0) + 1;
        }
        success = true;
      }
    } else if (option === 'all_female') {
      // 2 teams of 2F
      let femalePairs = getCombinations(femalesCopy, 2);
      if (femalePairs.length > 1) {
        for (let i = femalePairs.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [femalePairs[i], femalePairs[j]] = [femalePairs[j], femalePairs[i]];
        }
      }
      let team1 = null;
      for (const [f1, f2] of femalePairs) {
        if (usedCopy.has(f1) || usedCopy.has(f2)) continue;
        const pair = [f1.name, f2.name].sort().join('|');
        if (global_partnerships[pair]) continue;
        if (!checkTeammateEloCompatibility(f1, f2, teamEloDiff)) continue;
        team1 = [f1, f2];
        global_partnerships[pair] = (global_partnerships[pair] || 0) + 1;
        usedCopy.add(f1); usedCopy.add(f2);
        break;
      }
      if (!team1) continue;
      let team2 = null;
      for (const [f1, f2] of femalePairs) {
        if (usedCopy.has(f1) || usedCopy.has(f2)) continue;
        const pair = [f1.name, f2.name].sort().join('|');
        if (global_partnerships[pair]) continue;
        if (!checkExpectedWinBalance(team1, [f1, f2], playerRemainingRounds, eloThreshold, minExpectedWins)) continue;
        if (!checkOpponentsValid(team1, [f1, f2], maxOpponentFrequency)) continue;
        if (!checkTeammateEloCompatibility(f1, f2, teamEloDiff)) continue;
        team2 = [f1, f2];
        global_partnerships[pair] = (global_partnerships[pair] || 0) + 1;
        for (const p1 of team1) for (const p2 of team2) {
          const oppPair = [p1.name, p2.name].sort().join('|');
          global_opponents[oppPair] = (global_opponents[oppPair] || 0) + 1;
        }        
        for (const p of [...team1, ...team2]) playerRemainingRounds[p.name]--;
        usedCopy.add(f1); usedCopy.add(f2);
        break;
      }
      if (team1 && team2) {        court = [...team1, ...team2];
        femalesCopy = femalesCopy.filter(f => !usedCopy.has(f));
        const team1Avg = (team1[0].elo + team1[1].elo) / 2;
        const team2Avg = (team2[0].elo + team2[1].elo) / 2;
        if (team1Avg > team2Avg) {
          for (const p of team1) global_expected_wins[p.name] = (global_expected_wins[p.name] || 0) + 1;
        } else {
          for (const p of team2) global_expected_wins[p.name] = (global_expected_wins[p.name] || 0) + 1;
        }
        success = true;
      }
    } else if (option === 'all_male') {
      // 2 teams of 2M
      let malePairs = getCombinations(malesCopy, 2);
      if (malePairs.length > 1) {
        for (let i = malePairs.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [malePairs[i], malePairs[j]] = [malePairs[j], malePairs[i]];
        }
      }      
      let team1 = null;
      for (const [m1, m2] of malePairs) {
        if (usedCopy.has(m1) || usedCopy.has(m2)) continue;
        const pair = [m1.name, m2.name].sort().join('|');
        if (global_partnerships[pair]) continue;
        if (!checkTeammateEloCompatibility(m1, m2, teamEloDiff)) continue;
        team1 = [m1, m2];
        global_partnerships[pair] = (global_partnerships[pair] || 0) + 1;
        usedCopy.add(m1); usedCopy.add(m2);
        break;
      }
      if (!team1) continue;      
      let team2 = null;
      for (const [m1, m2] of malePairs) {
        if (usedCopy.has(m1) || usedCopy.has(m2)) continue;
        const pair = [m1.name, m2.name].sort().join('|');
        if (global_partnerships[pair]) continue;
        if (!checkExpectedWinBalance(team1, [m1, m2], playerRemainingRounds, eloThreshold, minExpectedWins)) continue;
        if (!checkOpponentsValid(team1, [m1, m2], maxOpponentFrequency)) continue;
        if (!checkTeammateEloCompatibility(m1, m2, teamEloDiff)) continue;
        team2 = [m1, m2];
        global_partnerships[pair] = (global_partnerships[pair] || 0) + 1;
        for (const p1 of team1) for (const p2 of team2) {
          const oppPair = [p1.name, p2.name].sort().join('|');
          global_opponents[oppPair] = (global_opponents[oppPair] || 0) + 1;
        }        
        for (const p of [...team1, ...team2]) playerRemainingRounds[p.name]--;
        usedCopy.add(m1); usedCopy.add(m2);
        break;
      }
      if (team1 && team2) {        
        const team1Avg = (team1[0].elo + team1[1].elo) / 2;
        const team2Avg = (team2[0].elo + team2[1].elo) / 2;
        if (team1Avg > team2Avg) {
          for (const p of team1) global_expected_wins[p.name] = (global_expected_wins[p.name] || 0) + 1;
        } else {
          for (const p of team2) global_expected_wins[p.name] = (global_expected_wins[p.name] || 0) + 1;
        }
        court = [...team1, ...team2];
        malesCopy = malesCopy.filter(m => !usedCopy.has(m));
        success = true;
      }
    }
    // If we successfully created a court
    if (success && court.length === 4) {
      courts.push(court);
      // Continue with the next court
      if (backtrackCourts(courts, femalesCopy, malesCopy, courtCount, usedCopy, eloThreshold, maxOpponentFrequency, teamEloDiff, playerRemainingRounds, minExpectedWins, ignoreGender)) {
        return true;
      }
      // Backtrack
      courts.pop();
      Object.assign(global_partnerships, partnershipsSnapshot);
      Object.assign(global_opponents, opponentsSnapshot);
      Object.assign(global_expected_wins, expectedWinsSnapshot);
      Object.assign(playerRemainingRounds, remainingRoundsSnapshot);
    }
  }
  return false;
}

/**
 * Shuffle an array in place (Fisher-Yates)
 * @param {Array} arr
 * @returns {Array}
 */
function shuffleArray(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

/**
 * Try to generateRotationFull() multiple times with shuffled players until success or maxTries reached.
 * @param {string[]} players
 * @param {number} courtCount
 * @param {number} gamePerPlayer
 * @param {number} eloThreshold
 * @param {number} teamEloDiff
 * @param {number} maxOpponentFrequency
 * @param {number} maxConsecutiveRounds
 * @param {boolean} ignoreGender - If true, ignore gender balance constraints
 * @param {number} femaleEloDiff - Amount to subtract from female players' ELO when ignoreGender=true
 * @param {number} [maxTries=10]
 * @returns {{restSchedule: string[][], roundsLineups: string[][][]}|null}
 */
function tryGenerateRotationFull(players, courtCount, gamePerPlayer, eloThreshold, teamEloDiff, maxOpponentFrequency, maxConsecutiveRounds, ignoreGender = false, femaleEloDiff = 100, maxTries = 10) {
  for (let attempt = 1; attempt <= maxTries; attempt++) {
    const shuffled = shuffleArray([...players]);
    try {
      const result = generateRotationFull(shuffled, courtCount, gamePerPlayer, eloThreshold, teamEloDiff, maxOpponentFrequency, maxConsecutiveRounds, ignoreGender, femaleEloDiff);
      console.log(`[tryGenerateRotationFull] Success on attempt ${attempt}`);
      return result;
    } catch (e) {
      console.warn(`[tryGenerateRotationFull] Failed attempt ${attempt}: ${e.message}`);
    }
  }
  console.error(`[tryGenerateRotationFull] Failed to generate a valid schedule after ${maxTries} attempts.`);
  return null;
}

// Export functions for use in pages
module.exports = {
  tryGenerateRotationFull,
  generateRotationFull,
  backtrackRestScheduleVariable,
  backtrackCourts,
  shuffleArray,
  testGenerateMatchWithSampleData // Export the test function
};

/**
 * Test function for debugging tryGenerateRotationFull with sample player data
 * @param {number} courtCount Number of courts to use
 * @param {number} gamePerPlayer Games per player
 * @param {number} eloThreshold ELO threshold for team balance
 * @param {number} teamEloDiff Maximum ELO difference for teammates
 * @param {number} maxOpponentFrequency
 * @param {number} maxConsecutiveRounds
 * @param {boolean} ignoreGender If true, ignore gender balance constraints
 * @param {number} femaleEloDiff Amount to subtract from female players' ELO when ignoreGender=true
 * @returns {Object|null} The match result or null if generation failed
 */
function testGenerateMatchWithSampleData(courtCount = 2, gamePerPlayer = 4, eloThreshold = 100, teamEloDiff = 300, maxOpponentFrequency = 5, maxConsecutiveRounds = 4, ignoreGender = true, femaleEloDiff = 100) {
  // Sample player data
  const players = [
    {"avatar":"/assets/icons/user.png","elo":1500,"gender":"female","name":"敏敏子"},
    {"avatar":"/assets/icons/user.png","elo":1550,"gender":"male","name":"Acaprice"},
    {"avatar":"/assets/icons/user.png","elo":1600,"gender":"male","name":"liyu"},
    {"avatar":"/assets/icons/user.png","elo":1500,"gender":"female","name":"Max"},
    {"avatar":"/assets/icons/user.png","elo":1500,"gender":"female","name":"小白"},
    {"avatar":"/assets/icons/user.png","elo":1500,"gender":"female","name":"ai"},
    {"avatar":"/assets/icons/user.png","elo":1580,"gender":"male","name":"张晴川"},
    {"avatar":"/assets/icons/user.png","elo":1520,"gender":"male","name":"方文"},
    {"avatar":"/assets/icons/user.png","elo":1500,"gender":"male","name":"米兰的小铁匠"},
    {"avatar":"/assets/icons/user.png","elo":1500,"gender":"male","name":"gdc"}
  ];

  console.log('Starting test with sample data:');
  console.log(`- Court Count: ${courtCount}`);
  console.log(`- Games Per Player: ${gamePerPlayer}`);
  console.log(`- ELO Threshold: ${eloThreshold}`);
  console.log(`- Team ELO Diff: ${teamEloDiff}`);
  console.log(`- Max Opponent Frequency: ${maxOpponentFrequency}`);
  console.log(`- Max Consecutive Rounds: ${maxConsecutiveRounds}`);
  console.log(`- Ignore Gender: ${ignoreGender}`);
  if (ignoreGender) {
    console.log(`- Female ELO Adjustment: ${femaleEloDiff}`);
  }

  console.log('Sample Players:', players.map(p => `${p.name}(${p.gender}:${p.elo})`).join(', '));

  try {
    // Call the match generation function
    const result = tryGenerateRotationFull(
      players, 
      courtCount, 
      gamePerPlayer, 
      eloThreshold,
      teamEloDiff,
      maxOpponentFrequency,
      maxConsecutiveRounds,
      ignoreGender,
      femaleEloDiff
    );
    
    if (result) {
      console.log('✅ Match generation succeeded!');
      console.log('Rest schedule:', result.restSchedule);
      console.log('Rounds lineups:', JSON.stringify(result.roundsLineups, null, 2));
      // Additional validation
      console.log('\nValidation:');
      
      // Check female/male balance in each court (only if not ignoring gender)
      let isBalanced = true;
      if (!ignoreGender) {
        result.roundsLineups.forEach((round, roundIndex) => {
          round.forEach((court, courtIndex) => {
            const femaleCount = court.filter(p => players.find(player => player.name === p)?.gender === 'female').length;
            const maleCount = court.length - femaleCount;
            
            if (!(
              (femaleCount === 0 && maleCount === 4) || // All male court
              (femaleCount === 4 && maleCount === 0) || // All female court
              (femaleCount === 2 && maleCount === 2)    // Mixed court (2F+2M)
            )) {
              console.log(`⚠️ Court balance issue at Round ${roundIndex+1}, Court ${courtIndex+1}: ${femaleCount}F/${maleCount}M`);
              isBalanced = false;
            }
          });
        });
        
        if (isBalanced) {
          console.log('✅ All courts have proper gender balance');
        }
      } else {
        console.log('✅ Gender balance check skipped (ignoreGender=true)');
      }
      
      return result;
    } else {
      console.error('❌ Failed to generate match with sample data');
      return null;
    }
  } catch (error) {
    console.error('❌ Error during match generation:', error.message);
    return null;
  }
}

// const result = testGenerateMatchWithSampleData();