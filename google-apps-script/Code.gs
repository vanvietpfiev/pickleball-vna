// ============================================================
// Pickleball VNA – Google Apps Script Web App
// Deploy: Extensions > Apps Script > Deploy > New deployment
//   Type: Web App | Execute as: Me | Access: Anyone
// ============================================================

var SS = SpreadsheetApp.getActiveSpreadsheet();
var K_FACTOR = 32;
var INITIAL_ELO = 1200;

// ── Router ───────────────────────────────────────────────────────

function doGet(e) {
  var action = e.parameter.action;
  var result;
  try {
    if      (action === 'getPlayers')     result = getPlayers();
    else if (action === 'getMatches')     result = getMatches();
    else if (action === 'getTournaments') result = getTournaments();
    else if (action === 'getUsers')       result = getUsers();
    else result = { error: 'Unknown action: ' + action };
  } catch(err) {
    result = { error: err.message };
  }
  return jsonResponse(result);
}

function doPost(e) {
  var data;
  try { data = JSON.parse(e.postData.contents); }
  catch(err) { return jsonResponse({ error: 'Invalid JSON' }); }

  var action = data.action;
  var result;
  try {
    if      (action === 'addPlayer')        result = addPlayer(data);
    else if (action === 'updateAvatar')     result = updateAvatar(data);
    else if (action === 'updatePlayerLevel') result = updatePlayerLevel(data);
    else if (action === 'addMatch')         result = addMatch(data);
    else if (action === 'addTournament')    result = addTournament(data);
    else if (action === 'updateTournament') result = updateTournament(data);
    else if (action === 'deleteTournament')    result = deleteTournament(data);
    else if (action === 'validateCredentials') result = validateCredentials(data);
    else if (action === 'addUser')             result = addUser(data);
    else if (action === 'updateUser')          result = updateUser(data);
    else if (action === 'deleteUser')          result = deleteUser(data);
    else result = { error: 'Unknown action: ' + action };
  } catch(err) {
    result = { error: err.message };
  }
  return jsonResponse(result);
}

function jsonResponse(data) {
  return ContentService
    .createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}

// ── ELO Helpers ──────────────────────────────────────────────────

function expectedScore(ratingA, ratingB) {
  return 1 / (1 + Math.pow(10, (ratingB - ratingA) / 400));
}

function calcNewRating(rating, expected, actual) {
  return Math.round(rating + K_FACTOR * (actual - expected));
}

// ── Sheet Helpers ────────────────────────────────────────────────

function getSheet(name) {
  var sh = SS.getSheetByName(name);
  if (!sh) throw new Error('Sheet "' + name + '" not found');
  return sh;
}

// Returns all data rows as array of objects (skip header)
function sheetToObjects(sheetName) {
  var sh = getSheet(sheetName);
  var data = sh.getDataRange().getValues();
  if (data.length < 2) return [];
  var headers = data[0];
  return data.slice(1).map(function(row) {
    var obj = {};
    headers.forEach(function(h, i) { obj[h] = row[i]; });
    return obj;
  });
}

function findRowIndex(sheetName, id) {
  var sh = getSheet(sheetName);
  var col = sh.getRange('A:A').getValues();
  for (var i = 1; i < col.length; i++) {
    if (String(col[i][0]) === String(id)) return i + 1; // 1-based
  }
  return -1;
}

// ── Players ──────────────────────────────────────────────────────

function getPlayers() {
  return sheetToObjects('Players').map(function(p) {
    return {
      id:         String(p.id),
      name:       String(p.name),
      elo:        Number(p.elo) || INITIAL_ELO,
      matches:    Number(p.matches) || 0,
      wins:       Number(p.wins) || 0,
      losses:     Number(p.losses) || 0,
      createdAt:  String(p.createdAt),
      avatar:     String(p.avatar || ''),
      initialElo: Number(p.initialElo) || INITIAL_ELO,
      level:      String(p.level || ''),
    };
  });
}

function addPlayer(data) {
  var id = 'p_' + Date.now();
  var now = new Date().toISOString();
  var initialElo = Number(data.initialElo) || INITIAL_ELO;
  var level = String(data.level || '');
  getSheet('Players').appendRow([id, data.name, initialElo, 0, 0, 0, now, data.avatar || '', initialElo, level]);
  return { id: id, name: data.name, elo: initialElo, matches: 0, wins: 0, losses: 0, createdAt: now, avatar: data.avatar || '', initialElo: initialElo, level: level };
}

function updatePlayerLevel(data) {
  var sh = getSheet('Players');
  var rowIdx = findRowIndex('Players', data.id);
  if (rowIdx === -1) throw new Error('Player not found');
  if (data.level !== undefined) sh.getRange(rowIdx, 10).setValue(String(data.level));
  if (data.initialElo !== undefined) sh.getRange(rowIdx, 9).setValue(Number(data.initialElo));
  return { ok: true };
}

function updateAvatar(data) {
  var rowIdx = findRowIndex('Players', data.id);
  if (rowIdx === -1) throw new Error('Player not found');
  getSheet('Players').getRange(rowIdx, 8).setValue(data.avatar); // col H
  return { ok: true };
}

// Update ELO + stats for one player (called after match)
function updatePlayerStats_(id, newElo, won) {
  var sh = getSheet('Players');
  var rowIdx = findRowIndex('Players', id);
  if (rowIdx === -1) return;
  var row = sh.getRange(rowIdx, 1, 1, 8).getValues()[0];
  sh.getRange(rowIdx, 3, 1, 4).setValues([[
    newElo,
    Number(row[3]) + 1,              // matches
    Number(row[4]) + (won ? 1 : 0),  // wins
    Number(row[5]) + (won ? 0 : 1),  // losses
  ]]);
}

// ── Matches + ELO Calculation ────────────────────────────────────

function getMatches() {
  return sheetToObjects('Matches').map(function(m) {
    return {
      id:          String(m.id),
      date:        String(m.date),
      type:        String(m.type),
      team1:       m.team1 ? String(m.team1).split(',') : [],
      team2:       m.team2 ? String(m.team2).split(',') : [],
      score1:      Number(m.score1),
      score2:      Number(m.score2),
      winningSide: String(m.winningSide),
      notes:       String(m.notes || ''),
    };
  }).reverse();
}

function addMatch(data) {
  var id = 'm_' + Date.now();
  var now = new Date().toISOString();
  var team1 = data.team1; // array of player ids
  var team2 = data.team2;
  var team1Won = String(data.winningSide) === '1';

  // Save match row
  getSheet('Matches').appendRow([
    id, now, data.type,
    team1.join(','), team2.join(','),
    data.score1, data.score2,
    data.winningSide, data.notes || ''
  ]);

  // Build ELO map from current players
  var players = getPlayers();
  var eloMap = {};
  players.forEach(function(p) { eloMap[p.id] = p.elo; });

  // Calculate & apply ELO changes
  if (data.type === 'singles') {
    var p1 = team1[0], p2 = team2[0];
    var exp1 = expectedScore(eloMap[p1], eloMap[p2]);
    var exp2 = expectedScore(eloMap[p2], eloMap[p1]);
    var new1 = calcNewRating(eloMap[p1], exp1, team1Won ? 1 : 0);
    var new2 = calcNewRating(eloMap[p2], exp2, team1Won ? 0 : 1);
    updatePlayerStats_(p1, new1, team1Won);
    updatePlayerStats_(p2, new2, !team1Won);

  } else { // doubles
    var avg1 = team1.reduce(function(s, id) { return s + (eloMap[id] || INITIAL_ELO); }, 0) / team1.length;
    var avg2 = team2.reduce(function(s, id) { return s + (eloMap[id] || INITIAL_ELO); }, 0) / team2.length;
    var e1 = expectedScore(avg1, avg2);
    var e2 = expectedScore(avg2, avg1);

    team1.forEach(function(id) {
      var newElo = calcNewRating(eloMap[id] || INITIAL_ELO, e1, team1Won ? 1 : 0);
      updatePlayerStats_(id, newElo, team1Won);
    });
    team2.forEach(function(id) {
      var newElo = calcNewRating(eloMap[id] || INITIAL_ELO, e2, team1Won ? 0 : 1);
      updatePlayerStats_(id, newElo, !team1Won);
    });
  }

  return { id: id, date: now, type: data.type, team1: team1, team2: team2,
           score1: data.score1, score2: data.score2, winningSide: data.winningSide, notes: data.notes || '' };
}

// ── Tournaments ──────────────────────────────────────────────────
// Sheet columns: id | name | date | type | config(JSON) | matches(JSON) | status

function getTournaments() {
  return sheetToObjects('Tournaments').map(function(t) {
    var config = {};
    try {
      var raw = t.config || t.groups; // support both column header names
      config = raw ? JSON.parse(String(raw)) : {};
    } catch(e) {}
    var matches = [];
    try { matches = t.matches ? JSON.parse(String(t.matches)) : []; } catch(e) {}
    return {
      id:      String(t.id),
      name:    String(t.name),
      date:    String(t.date),
      venue:   String(t.venue || ''),
      type:    String(t.type),
      config:  config,
      matches: matches,
      status:  String(t.status || 'setup'),
    };
  }).reverse();
}

function addTournament(data) {
  var id = 't_' + Date.now();
  var now = new Date().toISOString();
  var date = data.date || now;
  var venue = data.venue || '';
  var config = { participants: data.participants || [], groups: data.groups || [], format: data.format || {}, mode: data.mode || 'group_knockout' };
  getSheet('Tournaments').appendRow([
    id, data.name, date, data.type,
    JSON.stringify(config), JSON.stringify(data.matches || []), data.status || 'setup', venue
  ]);
  return { id: id, name: data.name, date: date, venue: venue, type: data.type,
           config: config, matches: data.matches || [], status: data.status || 'setup' };
}

function updateTournament(data) {
  var sh = getSheet('Tournaments');
  var rowIdx = findRowIndex('Tournaments', data.id);
  if (rowIdx === -1) throw new Error('Tournament not found');
  var row = sh.getRange(rowIdx, 1, 1, 7).getValues()[0];

  var config = data.config !== undefined ? data.config : (row[4] ? JSON.parse(String(row[4])) : {});
  var matches = data.matches !== undefined ? data.matches : (row[5] ? JSON.parse(String(row[5])) : []);
  var status = data.status !== undefined ? data.status : String(row[6]);

  sh.getRange(rowIdx, 5, 1, 3).setValues([[
    JSON.stringify(config),
    JSON.stringify(matches),
    status
  ]]);
  return { ok: true };
}

function deleteTournament(data) {
  var sh = getSheet('Tournaments');
  var rowIdx = findRowIndex('Tournaments', data.id);
  if (rowIdx === -1) throw new Error('Tournament not found');
  sh.deleteRow(rowIdx);
  return { ok: true };
}

// ── Users ─────────────────────────────────────────────────────────
// Sheet columns: id | username | password | role | createdAt

function getUsers() {
  return sheetToObjects('Users').map(function(u) {
    return { id: String(u.id), username: String(u.username), role: String(u.role || 'member'), createdAt: String(u.createdAt) };
  });
}

function validateCredentials(data) {
  var rows = sheetToObjects('Users');
  for (var i = 0; i < rows.length; i++) {
    var u = rows[i];
    if (String(u.username) === String(data.username) && String(u.password) === String(data.password)) {
      return { id: String(u.id), username: String(u.username), role: String(u.role || 'member') };
    }
  }
  return null;
}

function addUser(data) {
  var id = 'u_' + Date.now();
  var now = new Date().toISOString();
  var role = data.role === 'admin' ? 'admin' : 'member';
  getSheet('Users').appendRow([id, data.username, data.password, role, now]);
  return { id: id, username: data.username, role: role, createdAt: now };
}

function updateUser(data) {
  var sh = getSheet('Users');
  var rowIdx = findRowIndex('Users', data.id);
  if (rowIdx === -1) throw new Error('User not found');
  if (data.password !== undefined) sh.getRange(rowIdx, 3).setValue(String(data.password));
  if (data.role !== undefined) sh.getRange(rowIdx, 4).setValue(String(data.role));
  return { ok: true };
}

function deleteUser(data) {
  var sh = getSheet('Users');
  var rowIdx = findRowIndex('Users', data.id);
  if (rowIdx === -1) throw new Error('User not found');
  sh.deleteRow(rowIdx);
  return { ok: true };
}

// ── Manual Recalculate (Menu) ─────────────────────────────────────

function recalculateAllElo() {
  var players = getPlayers();
  var eloMap = {};
  var statsMap = {};
  players.forEach(function(p) {
    eloMap[p.id] = p.initialElo || INITIAL_ELO;  // use per-player initial ELO
    statsMap[p.id] = { matches: 0, wins: 0, losses: 0 };
  });

  var matches = sheetToObjects('Matches').filter(function(m) { return m.id; });
  matches.forEach(function(m) {
    var team1 = m.team1 ? String(m.team1).split(',') : [];
    var team2 = m.team2 ? String(m.team2).split(',') : [];
    var team1Won = String(m.winningSide) === '1';

    if (String(m.type) === 'singles' && team1.length === 1 && team2.length === 1) {
      var p1 = team1[0], p2 = team2[0];
      var exp1 = expectedScore(eloMap[p1] || INITIAL_ELO, eloMap[p2] || INITIAL_ELO);
      var exp2 = expectedScore(eloMap[p2] || INITIAL_ELO, eloMap[p1] || INITIAL_ELO);
      eloMap[p1] = calcNewRating(eloMap[p1] || INITIAL_ELO, exp1, team1Won ? 1 : 0);
      eloMap[p2] = calcNewRating(eloMap[p2] || INITIAL_ELO, exp2, team1Won ? 0 : 1);
    } else {
      var avg1 = team1.reduce(function(s, id) { return s + (eloMap[id] || INITIAL_ELO); }, 0) / (team1.length || 1);
      var avg2 = team2.reduce(function(s, id) { return s + (eloMap[id] || INITIAL_ELO); }, 0) / (team2.length || 1);
      var e1 = expectedScore(avg1, avg2);
      var e2 = expectedScore(avg2, avg1);
      team1.forEach(function(id) { eloMap[id] = calcNewRating(eloMap[id] || INITIAL_ELO, e1, team1Won ? 1 : 0); });
      team2.forEach(function(id) { eloMap[id] = calcNewRating(eloMap[id] || INITIAL_ELO, e2, team1Won ? 0 : 1); });
    }

    var winners = team1Won ? team1 : team2;
    var losers  = team1Won ? team2 : team1;
    [].concat(team1, team2).forEach(function(id) { if (statsMap[id]) statsMap[id].matches++; });
    winners.forEach(function(id) { if (statsMap[id]) statsMap[id].wins++; });
    losers.forEach(function(id)  { if (statsMap[id]) statsMap[id].losses++; });
  });

  // Write back to sheet
  var sh = getSheet('Players');
  players.forEach(function(p) {
    var rowIdx = findRowIndex('Players', p.id);
    if (rowIdx === -1) return;
    var s = statsMap[p.id] || { matches: 0, wins: 0, losses: 0 };
    sh.getRange(rowIdx, 3, 1, 4).setValues([[
      eloMap[p.id] || INITIAL_ELO, s.matches, s.wins, s.losses
    ]]);
  });

  SpreadsheetApp.getUi().alert('✅ Đã tính lại ELO cho ' + matches.length + ' trận!');
}

function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('🏓 Pickleball VNA')
    .addItem('Tính lại ELO toàn bộ', 'recalculateAllElo')
    .addToUi();
}
