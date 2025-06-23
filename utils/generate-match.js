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
 * @param {Set<string>} femaleSet
 * @param {number} targetRestCount
 * @param {Object} playerConsecutiveActive - {player: consecutiveActiveRounds}
 * @returns {boolean}
 */
function backtrackRestScheduleVariable(players, restSchedule, restCounts, currentRound, totalRounds, restPerRound, femaleSet, targetRestCount, playerConsecutiveActive) {
  if (currentRound === totalRounds) return true;
  const restCountNeeded = restPerRound[currentRound];
  const roundsLeft = totalRounds - currentRound;

  // 1. Players who must rest due to consecutive actives
  const mustRestConsecutive = players.filter(p => (playerConsecutiveActive[p] || 0) >= 6);
  // 2. Players who must rest to meet target rest count
  const restNeeded = {};
  players.forEach(p => restNeeded[p] = targetRestCount - restCounts[p]);
  const mustRestCount = players.filter(p => restNeeded[p] > 0 && restNeeded[p] > roundsLeft - 1);
  const mustRest = Array.from(new Set([...mustRestConsecutive, ...mustRestCount]));

  if (mustRest.length > restCountNeeded) {
    console.log('  [FAIL] Too many must-rest players for available rest slots.');
    return false;
  }
  if (players.filter(p => restCounts[p] < targetRestCount).length < restCountNeeded) {
    console.log('  [FAIL] Not enough players left who need rest.');
    return false;
  }

  // Candidates for resting
  const validCandidates = players.filter(p => restCounts[p] < targetRestCount && !mustRest.includes(p));
  const femaleCandidates = validCandidates.filter(p => femaleSet.has(p)).sort((a, b) => (playerConsecutiveActive[b] || 0) - (playerConsecutiveActive[a] || 0));
  const maleCandidates = validCandidates.filter(p => !femaleSet.has(p)).sort((a, b) => (playerConsecutiveActive[b] || 0) - (playerConsecutiveActive[a] || 0));
  const mustRestFemales = mustRest.filter(p => femaleSet.has(p));

  // Gender balance
  const restSlotsRemaining = restCountNeeded - mustRest.length;
  const currentFemaleCount = mustRestFemales.length;
  const activeFemales = femaleSet.size - currentFemaleCount;
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
      restCounts[player]++;
      playerConsecutiveActiveCopy[player] = 0;
    });
    // Update consecutive actives for others
    players.forEach(player => {
      if (!restThisRound.includes(player)) {
        playerConsecutiveActiveCopy[player] = (playerConsecutiveActiveCopy[player] || 0) + 1;
      }
    });
    // Recurse
    if (backtrackRestScheduleVariable(players, restSchedule, restCounts, currentRound + 1, totalRounds, restPerRound, femaleSet, targetRestCount, playerConsecutiveActiveCopy)) {
      return true;
    }
    // Backtrack
    restThisRound.forEach(player => {
      restSchedule[currentRound].pop();
      restCounts[player]--;
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
 * @param {Object} playerElos
 * @param {number} teamEloDiff
 * @returns {{restSchedule: string[][], roundsLineups: string[][][]}}
 */
function generateRotationFull(players, courtCount, gamePerPlayer, eloThreshold, playerElos, teamEloDiff) {
  const COURT_SIZE = 4;
  // Gender set
  const femaleSet = new Set(players.filter(p => p.endsWith('(F)')));
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
  players.forEach(p => restCounts[p] = 0);
  const targetRestCount = rounds - gamePerPlayer;
  const playerConsecutiveActive = {};
  players.forEach(p => playerConsecutiveActive[p] = 0);

  console.log('--- generateRotationFull DEBUG ---');
  console.log('Players:', players);
  console.log('Female set:', Array.from(femaleSet));
  console.log('Total players:', totalPlayers);
  console.log('Court count:', courtCount);
  console.log('Game per player:', gamePerPlayer);
  console.log('ELO threshold:', eloThreshold);
  console.log('Team ELO diff:', teamEloDiff);
  console.log('Player ELOs:', playerElos);
  console.log('Total player games:', totalPlayerGames);
  console.log('Player slots per round:', playerSlotsPerRound);
  console.log('Rounds float:', roundsFloat);
  console.log('Full rounds:', fullRounds);
  console.log('Has partial round:', hasPartialRound);
  console.log('Total rounds:', rounds);
  console.log('Courts per round:', courtsPerRound);
  console.log('Rest per round:', restPerRound);
  console.log('Target rest count:', targetRestCount);

  // Generate rest schedule
  const restOk = backtrackRestScheduleVariable(
    players,
    restSchedule,
    restCounts,
    0,
    rounds,
    restPerRound,
    femaleSet,
    targetRestCount,
    playerConsecutiveActive
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
  const maxOpponentFrequency = Math.floor(gamePerPlayer / 2) + 1;
  for (let attempt = 0; attempt < 10000; attempt++) {
    let success = true;
    let tempLineups = [];
    let playerRemainingRounds = {};
    players.forEach(p => playerRemainingRounds[p] = gamePerPlayer);
    // Reset global trackers
    Object.keys(global_partnerships).forEach(k => delete global_partnerships[k]);
    Object.keys(global_opponents).forEach(k => delete global_opponents[k]);
    Object.keys(global_expected_wins).forEach(k => delete global_expected_wins[k]);
    for (let r = 0; r < rounds; r++) {
      const active = players.filter(p => !restSchedule[r].includes(p));
      const activeFemales = active.filter(p => femaleSet.has(p));
      const activeMales = active.filter(p => !femaleSet.has(p));
      const roundCourtCount = courtsPerRound[r];
      const courts = [];
      const usedPlayers = new Set();
      const ok = backtrackCourts(
        courts,
        activeFemales,
        activeMales,
        roundCourtCount,
        femaleSet,
        usedPlayers,
        playerElos,
        eloThreshold,
        maxOpponentFrequency,
        teamEloDiff,
        playerRemainingRounds
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


function checkTeammateEloCompatibility(player1, player2, playerElos, teamEloDiff) {
  return Math.abs(playerElos[player1] - playerElos[player2]) <= teamEloDiff;
}

// Merged: checkExpectedWinBalance (now includes ELO threshold check)
function checkExpectedWinBalance(team1, team2, playerElos, playerRemainingRounds, eloThreshold, minExpectedWins = 0) {
  // ELO difference check (formerly checkTeamElo)
  const team1Avg = (playerElos[team1[0]] + playerElos[team1[1]]) / 2;
  const team2Avg = (playerElos[team2[0]] + playerElos[team2[1]]) / 2;
  if (Math.abs(team1Avg - team2Avg) > eloThreshold) return false;
  // Expected win balance check
  const disadvantaged = team1Avg > team2Avg ? team2 : team1;
  for (const p of disadvantaged) {
    const current = global_expected_wins[p] || 0;
    const remaining = (playerRemainingRounds[p] || 0) - 1;
    if (current + remaining < minExpectedWins) return false;
  }
  return true;
}

function checkOpponentsValid(team1, team2, maxOpponentFrequency) {
  for (const p1 of team1) {
    for (const p2 of team2) {
      const pair = [p1, p2].sort().join('|');
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

function backtrackCourts(courts, females, males, courtCount, femaleSet, usedPlayers, playerElos, eloThreshold, maxOpponentFrequency, teamEloDiff, playerRemainingRounds) {
  // Base case: all courts filled
  if (courts.length === courtCount) return true;

  // Snapshots for backtracking
  const partnershipsSnapshot = { ...global_partnerships };
  const opponentsSnapshot = { ...global_opponents };
  const expectedWinsSnapshot = { ...global_expected_wins };
  const remainingRoundsSnapshot = { ...playerRemainingRounds };

  // Gender options
  let courtOptions = [];
  if (females.length >= 2 && males.length >= 2) courtOptions.push('mixed');
  if (females.length >= 4) courtOptions.push('all_female');
  if (males.length >= 4) courtOptions.push('all_male');
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
          const pair = [f1, m1].sort().join('|');
          if (global_partnerships[pair]) continue;
          if (!checkTeammateEloCompatibility(f1, m1, playerElos, teamEloDiff)) continue;
          team1 = [f1, m1];
          global_partnerships[pair] = (global_partnerships[pair] || 0) + 1;
          usedCopy.add(f1); usedCopy.add(m1);
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
          const pair = [f2, m2].sort().join('|');
          if (global_partnerships[pair]) continue;
          if (!checkExpectedWinBalance(team1, [f2, m2], playerElos, playerRemainingRounds, eloThreshold)) continue;
          if (!checkOpponentsValid(team1, [f2, m2], maxOpponentFrequency)) continue;
          if (!checkTeammateEloCompatibility(f2, m2, playerElos, teamEloDiff)) continue;
          team2 = [f2, m2];
          global_partnerships[pair] = (global_partnerships[pair] || 0) + 1;
          for (const p1 of team1) for (const p2 of team2) {
            const oppPair = [p1, p2].sort().join('|');
            global_opponents[oppPair] = (global_opponents[oppPair] || 0) + 1;
          }
          for (const p of [...team1, ...team2]) playerRemainingRounds[p]--;
          usedCopy.add(f2); usedCopy.add(m2);
          break;
        }
        if (team2) break;
      }
      if (team1 && team2) {
        court = [...team1, ...team2];
        femalesCopy = femalesCopy.filter(f => !usedCopy.has(f));
        malesCopy = malesCopy.filter(m => !usedCopy.has(m));
        const team1Avg = (playerElos[team1[0]] + playerElos[team1[1]]) / 2;
        const team2Avg = (playerElos[team2[0]] + playerElos[team2[1]]) / 2;
        if (team1Avg > team2Avg) {
          for (const p of team1) global_expected_wins[p] = (global_expected_wins[p] || 0) + 1;
        } else {
          for (const p of team2) global_expected_wins[p] = (global_expected_wins[p] || 0) + 1;
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
        const pair = [f1, f2].sort().join('|');
        if (global_partnerships[pair]) continue;
        if (!checkTeammateEloCompatibility(f1, f2, playerElos, teamEloDiff)) continue;
        team1 = [f1, f2];
        global_partnerships[pair] = (global_partnerships[pair] || 0) + 1;
        usedCopy.add(f1); usedCopy.add(f2);
        break;
      }
      if (!team1) continue;
      let team2 = null;
      for (const [f1, f2] of femalePairs) {
        if (usedCopy.has(f1) || usedCopy.has(f2)) continue;
        const pair = [f1, f2].sort().join('|');
        if (global_partnerships[pair]) continue;
        if (!checkExpectedWinBalance(team1, [f1, f2], playerElos, playerRemainingRounds, eloThreshold)) continue;
        if (!checkOpponentsValid(team1, [f1, f2], maxOpponentFrequency)) continue;
        if (!checkTeammateEloCompatibility(f1, f2, playerElos, teamEloDiff)) continue;
        team2 = [f1, f2];
        global_partnerships[pair] = (global_partnerships[pair] || 0) + 1;
        for (const p1 of team1) for (const p2 of team2) {
          const oppPair = [p1, p2].sort().join('|');
          global_opponents[oppPair] = (global_opponents[oppPair] || 0) + 1;
        }
        for (const p of [...team1, ...team2]) playerRemainingRounds[p]--;
        usedCopy.add(f1); usedCopy.add(f2);
        break;
      }
      if (team1 && team2) {
        court = [...team1, ...team2];
        femalesCopy = femalesCopy.filter(f => !usedCopy.has(f));
        const team1Avg = (playerElos[team1[0]] + playerElos[team1[1]]) / 2;
        const team2Avg = (playerElos[team2[0]] + playerElos[team2[1]]) / 2;
        if (team1Avg > team2Avg) {
          for (const p of team1) global_expected_wins[p] = (global_expected_wins[p] || 0) + 1;
        } else {
          for (const p of team2) global_expected_wins[p] = (global_expected_wins[p] || 0) + 1;
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
        if (m1.endsWith('(F)') && m2.endsWith('(F)')) continue;
        const pair = [m1, m2].sort().join('|');
        if (global_partnerships[pair]) continue;
        if (!checkTeammateEloCompatibility(m1, m2, playerElos, teamEloDiff)) continue;
        team1 = [m1, m2];
        global_partnerships[pair] = (global_partnerships[pair] || 0) + 1;
        usedCopy.add(m1); usedCopy.add(m2);
        break;
      }
      if (!team1) continue;
      let team2 = null;
      for (const [m1, m2] of malePairs) {
        if (usedCopy.has(m1) || usedCopy.has(m2)) continue;
        if (m1.endsWith('(F)') && m2.endsWith('(F)')) continue;
        const pair = [m1, m2].sort().join('|');
        if (global_partnerships[pair]) continue;
        if (!checkExpectedWinBalance(team1, [m1, m2], playerElos, playerRemainingRounds, eloThreshold)) continue;
        if (!checkOpponentsValid(team1, [m1, m2], maxOpponentFrequency)) continue;
        if (!checkTeammateEloCompatibility(m1, m2, playerElos, teamEloDiff)) continue;
        team2 = [m1, m2];
        global_partnerships[pair] = (global_partnerships[pair] || 0) + 1;
        for (const p1 of team1) for (const p2 of team2) {
          const oppPair = [p1, p2].sort().join('|');
          global_opponents[oppPair] = (global_opponents[oppPair] || 0) + 1;
        }
        for (const p of [...team1, ...team2]) playerRemainingRounds[p]--;
        usedCopy.add(m1); usedCopy.add(m2);
        break;
      }
      if (team1 && team2) {
        const team1Avg = (playerElos[team1[0]] + playerElos[team1[1]]) / 2;
        const team2Avg = (playerElos[team2[0]] + playerElos[team2[1]]) / 2;
        if (team1Avg > team2Avg) {
          for (const p of team1) global_expected_wins[p] = (global_expected_wins[p] || 0) + 1;
        } else {
          for (const p of team2) global_expected_wins[p] = (global_expected_wins[p] || 0) + 1;
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
      if (backtrackCourts(courts, femalesCopy, malesCopy, courtCount, femaleSet, usedCopy, playerElos, eloThreshold, maxOpponentFrequency, teamEloDiff, playerRemainingRounds)) {
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

// Test for generateRotationFull
function testGenerateRotationFull() {
  const players = [
    "敏敏子(F)", "Acaprice", "liyu", "Max(F)",
    "张晴川", "方文", "米兰的小铁匠", "gdc", 'x1(F)', 'x2(F)'
  ];
  const courtCount = 2;
  const gamePerPlayer = 4;
  const eloThreshold = 100;
  const teamEloDiff = 70;
  const playerElos = {
    "敏敏子(F)": 1500, "Acaprice": 1500, "liyu": 1500, "Max(F)": 1500,
    "张晴川": 1500, "方文": 1500, "米兰的小铁匠": 1500, "gdc": 1500, 'x1(F)': 1500, 'x2(F)': 1500
  };
  try {
    const result = generateRotationFull(players, courtCount, gamePerPlayer, eloThreshold, playerElos, teamEloDiff);
    console.log("Rest schedule:", JSON.stringify(result.restSchedule, null, 2));
    console.log("Rounds lineups:", JSON.stringify(result.roundsLineups, null, 2));
  } catch (e) {
    console.error("Failed to generate rotation:", e.message);
  }
}

testGenerateRotationFull();

