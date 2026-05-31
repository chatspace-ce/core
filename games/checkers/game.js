
  // ——— Params ———
  const params = new URLSearchParams(location.search);
  const raw    = params.get('lobby') || params.get('code') || 'demo';
  let player = Math.max(1, Math.min(2, parseInt(params.get('player'), 10) || 1)); // 1=Red, 2=White
  const user   = parseInt(params.get('user'), 10) || 1001;
  const gameId = parseInt(params.get('game'), 10) || 0;
  const csrf = params.get('csrf') || '';

  const url = new URL(window.location.href);
  const path = url.pathname;

  const gamesRoot = path.includes('/games/') ? path.slice(0, path.indexOf('/games/') + '/games'.length) : '/games';
  const base = gamesRoot;
  const LIST_URL = `${base}/list_lobbies.php?game=${gameId}`;

  // ——— Match/runtime state ———
  let lastSeq = 0;
  let board   = [];
  let opponentUserId = null;
  let bothJoined = false;
  let yourTurn = (player === 1); // Red starts
  let youRequestedRematch = false;
  let oppRequestedRematch = false;
  let gameOver = false;
  let currentRound = 1;

  // ——— UI refs ———
  const topLabel     = document.getElementById('top-label');
  const bottomLabel  = document.getElementById('bottom-label');
  const boardEl      = document.getElementById('board');
  const boardWrap    = document.getElementById('board-wrap');
  const startBtn     = document.getElementById('start-over');
  const resignBtn    = document.getElementById('resign');
  const turnStatus   = document.getElementById('turn-status');
  const waitingUI    = document.getElementById('waiting');
  const overlay      = document.getElementById('overlay');
  const overlayTitle = document.getElementById('overlay-title');
  const overlaySub   = document.getElementById('overlay-sub');
  const playAgainBtn = document.getElementById('play-again');
  const leaveBtn     = document.getElementById('leave');

  window.addEventListener('message', e => {
    if (e.origin !== window.location.origin) return;
    if (e.data?.type !== 'game_control') return;
    if (e.data.action === 'rematch') startBtn?.click();
    if (e.data.action === 'resign') resignBtn?.click();
  });

  // lobby/user labels removed from UI

  function applyPlayerNumber(nextPlayer) {
    player = Math.max(1, Math.min(2, Number(nextPlayer) || 1));
    yourTurn = !bothJoined ? (player === 1) : yourTurn;
    boardWrap.classList.toggle('flip', player === 2);
  }

  // POV: flip board when you're Player 2 so YOU are always bottom
  applyPlayerNumber(player);

  // ——— Build board grid ———
  for (let r=0; r<8; r++){
    for (let c=0; c<8; c++){
      const cell = document.createElement('div');
      cell.id = `cell-${r}-${c}`;
      cell.className = 'cell ' + ((r+c)%2 ? 'dark' : 'light');
      const delay = ((r * 8 + c) % 12) * 0.25;
      cell.style.setProperty('--delay', `${delay}s`);
      cell.setAttribute('role','gridcell');
      cell.setAttribute('aria-label', `row ${r+1}, col ${c+1}`);
      boardEl.appendChild(cell);
    }
  }

  // Click on empty/destination cells to move
  boardEl.addEventListener('click', e => {
    if(!e.target.classList.contains('cell')) return;
    const [_, r, c] = e.target.id.split('-').map(Number);
    tryMove(r,c);
  });

  // ——— Draw + selection ———
  function drawBoard(){
    for (let r=0; r<8; r++){
      for (let c=0; c<8; c++){
        const el = document.getElementById(`cell-${r}-${c}`);
        el.innerHTML = '';
        if (board[r][c]){
          const p = document.createElement('div');
          p.className = `piece p${board[r][c]}`;
          if (board[r][c] === player) p.classList.add('mine');
          p.dataset.r = r; p.dataset.c = c;
          p.onclick = () => selectPiece(r,c);
          el.appendChild(p);
        }
      }
    }
    updateLabels();
    updateTurnStatus();
  }

  let selected = null;
  function selectPiece(r,c){
    if (gameOver || !bothJoined || !yourTurn) return;
    if (board[r][c] !== player) return;
    selected = {r,c};
  }

  function tryMove(toR,toC){
    if (!selected || gameOver || !bothJoined || !yourTurn) return;
    const {r:fr,c:fc} = selected;
    const dr = toR - fr, dc = toC - fc;

    const isEmpty = (board[toR]?.[toC] === 0);
    const midR = fr + dr/2, midC = fc + dc/2;

    const isSimpleStep = (Math.abs(dr) === 1 && Math.abs(dc) === 1 && isEmpty);
    const isCapture = (Math.abs(dr) === 2 && Math.abs(dc) === 2 && board[midR]?.[midC] && isEmpty);

    if (!isSimpleStep && !isCapture) { selected = null; return; }

    // Local move
    board[toR][toC] = player;
    board[fr][fc]   = 0;
    if (isCapture) board[midR][midC] = 0;

    selected = null;
    yourTurn = false;
    drawBoard();
    checkGameEnd('move');

    // Report (fire & forget)
    const mv = {type:'move', user_id:user, from:{r:fr,c:fc}, to:{r:toR,c:toC}};
    apiPost(`${base}/api/moves.php`, { lobby_id: raw, user_id: user, payload: mv }).catch(()=>{});
    apiPost(`${base}/api/state.php`, { lobby_id: raw, user_id: user, state: board }).catch(()=>{});
  }

  // ——— Labels & footer status ———
  function updateLabels(){
    const flat = board.flat();
    const redCount   = flat.filter(x=>x===1).length;
    const whiteCount = flat.filter(x=>x===2).length;
    const redCaptures   = 12 - whiteCount;
    const whiteCaptures = 12 - redCount;

    if (player === 1){
      topLabel.textContent    = `White (Opponent) — Captures: ${whiteCaptures}`;
      bottomLabel.textContent = `Red (You) — Captures: ${redCaptures}`;
    } else {
      topLabel.textContent    = `Red (Opponent) — Captures: ${redCaptures}`;
      bottomLabel.textContent = `White (You) — Captures: ${whiteCaptures}`;
    }
  }
  function updateTurnStatus(){
    if (!bothJoined){
      turnStatus.textContent = 'Waiting for Opponent';
    } else if (yourTurn){
      turnStatus.textContent = 'Your turn.';
    } else {
      turnStatus.textContent = 'Waiting for Opponent';
    }
  }

  // ——— Controls ———
  startBtn.onclick = async ()=>{
    if (!bothJoined || gameOver) return;
    youRequestedRematch = true;
    await sendControl('play-again-request', { player });
    maybeRestart();
  };
  resignBtn.onclick = async ()=>{
    if (gameOver) return;
    await sendControl('resign', { player });
    finishMatch(false, 'Resigned');
  };
  playAgainBtn.onclick = async ()=>{
    youRequestedRematch = true;
    await sendControl('play-again-request', { player });
    maybeRestart();
  };
  leaveBtn.onclick = async ()=>{
    await sendControl('leave', { player });
    tryCloseLobby(); // best-effort
    overlay.style.display = 'flex';
    overlayTitle.textContent = 'Lobby Closed';
    overlaySub.textContent = 'Thanks for playing!';
    disableBoard();
  };

  // ——— API helpers ———
  async function apiGet(path){
    const url = path + (path.includes('?') ? '&' : '?') + `user=${user}`;
    const res = await fetch(url);
    return res.ok ? res.json() : {};
  }
  async function apiPost(path,data){
    const payload = Object.assign({}, data || {}, { _csrf: csrf });
    const res = await fetch(path,{
      method:'POST',
      headers:{'Content-Type':'application/json','X-CSRF-Token':csrf},
      body: JSON.stringify(payload)
    });
    if (!res.ok) throw new Error('network');
    return res.json();
  }

  // Control helpers
  async function sendControl(type, extra={}){
    const payload = Object.assign({type}, extra);
    try { await apiPost(`${base}/api/moves.php`, { lobby_id: raw, user_id: user, payload }); } catch {}
  }
  async function recordResult(result, reason='completed', score=0){
    try {
      await apiPost(`${base}/api/result.php`, { lobby_id: raw, user_id: user, result, reason, score });
    } catch {
      sendControl('result', { result, reason, score });
    }
  }
  async function tryCloseLobby(){
    try { await apiPost(`${base}/api/lobby.php`, { action:'close', lobby_id: raw, user_id: user }); } catch {}
  }
  function asMovesArray(resp){
    if (Array.isArray(resp)) return resp;
    if (resp && Array.isArray(resp.moves)) return resp.moves;
    return [];
  }
  function applyLobbyStatus(lobby) {
    if (!lobby) return;
    currentRound = Math.max(1, Number(lobby.round_number || currentRound || 1));
    if (Number(lobby.user2_id) === user) applyPlayerNumber(2);
    else applyPlayerNumber(1);
    opponentUserId = (player === 1) ? Number(lobby.user2_id || 0) : Number(lobby.user1_id || 0);
    if (lobby.status === 'ended') {
      showLobbyClosed();
      return;
    }
    if (lobby.user1_id && lobby.user2_id && !bothJoined) startMatch();
  }
  async function joinLobbyAndAssignPlayer() {
    const joined = await apiPost(`${base}/api/lobby.php`, { action:'join', lobby_id: raw, user_id: user }).catch(() => null);
    if (joined?.ok) {
      applyLobbyStatus(joined);
      return joined;
    }
    const status = await apiGet(`${base}/api/lobby.php?action=status&lobby_id=${encodeURIComponent(raw)}`).catch(() => null);
    applyLobbyStatus(status);
    return status;
  }

  // ——— Initial board ———
  function initBoard(){
    const b = Array.from({length:8}, ()=>Array(8).fill(0));
    for (let r=0;r<3;r++) for (let c=0;c<8;c++) if ((r+c)%2) b[r][c]=2; // top: White (P2)
    for (let r=5;r<8;r++) for (let c=0;c<8;c++) if ((r+c)%2) b[r][c]=1; // bottom: Red (P1)
    return b;
  }
  function disableBoard(){ boardEl.style.pointerEvents = 'none'; }
  function enableBoard(){ boardEl.style.pointerEvents = 'auto'; }

  // ——— Match flow ———
  function setWaiting(on){
    waitingUI.style.display = on ? 'flex' : 'none';
    document.querySelector('.board-wrap').style.display = on ? 'none' : 'block';
    document.getElementById('top-label').style.display = on ? 'none' : 'block';
    document.getElementById('bottom-label').style.display = on ? 'none' : 'block';
  }

  function startMatch(){
    bothJoined = true;
    setWaiting(false);
    yourTurn = (player === 1);
    updateTurnStatus();
    enableBoard();
  }

  function startMatchIfReady(){
    if (bothJoined) return;
    if (opponentUserId && opponentUserId !== user){
      startMatch();
    }
  }

  function showLobbyClosed(){
    if (gameOver) return;
    gameOver = true;
    disableBoard();
    overlay.style.display = 'flex';
    overlayTitle.textContent = 'Lobby Closed';
    overlaySub.textContent = 'This game has ended.';
    playAgainBtn.style.display = 'none';
  }

  function checkGameEnd(){
    const flat = board.flat();
    const reds   = flat.filter(x=>x===1).length;
    const whites = flat.filter(x=>x===2).length;
    if (reds === 0 || whites === 0){
      const youWon = (player === 1 && whites===0) || (player === 2 && reds===0);
      finishMatch(youWon, 'All pieces captured');
    }
  }

  async function finishMatch(youWon, reason){
    if (gameOver) return;
    gameOver = true;
    disableBoard();
    overlay.style.display = 'flex';

    const isResignation = /resign/i.test(String(reason||''));

    if (isResignation && !youWon){
      overlayTitle.textContent = "You Resigned";
      overlaySub.textContent   = "Returning to lobbies…";
      playAgainBtn.style.display = 'none';
      leaveBtn.style.display     = 'none';
      setTimeout(()=>{ try { window.parent.postMessage({ type: "game_close", lobby: raw }, "*"); } catch {}
      location.href = LIST_URL; }, 3000);
    } else if (isResignation && youWon){
      overlayTitle.textContent = "You’ve Won!";
      overlaySub.textContent   = "Opponent resigned.";
      playAgainBtn.style.display = 'none';
      leaveBtn.onclick = ()=>{ try { window.parent.postMessage({ type: "game_close", lobby: raw }, "*"); } catch {}
      location.href = LIST_URL; };
    } else {
      overlayTitle.textContent = youWon ? "You’ve Won!" : "Better luck next time :(";
      overlaySub.textContent   = reason || '';
    }

    await recordResult(youWon ? 'win' : 'loss', reason, 0);
    await sendControl('match-end', { youWon, reason });
  }

  function resetForRematch(lobby = null){
    if (lobby) applyLobbyStatus(lobby);
    board = initBoard();
    gameOver = false;
    youRequestedRematch = false;
    oppRequestedRematch = false;
    yourTurn = (player === 1);
    overlay.style.display = 'none';
    setWaiting(false);
    drawBoard();
    apiPost(`${base}/api/state.php`, { lobby_id: raw, user_id: user, state: board }).catch(()=>{});
  }

  function maybeRestart(){
    if (youRequestedRematch && oppRequestedRematch){
      (async ()=>{
        const restarted = await apiPost(`${base}/api/restart.php`, { lobby_id: raw, user_id: user, round_number: currentRound }).catch(() => null);
        if (restarted?.ok) {
          await sendControl('restart', {
            round_number: restarted.round_number,
            user1_id: restarted.user1_id,
            user2_id: restarted.user2_id,
          });
          resetForRematch(restarted);
        } else {
          await sendControl('restart', {});
          resetForRematch();
        }
      })();
    }
  }

  // ——— Status fallback ———
  async function pollLobbyStatus(){
    try{
      const s = await apiGet(`${base}/api/lobby.php?action=status&lobby_id=${raw}`);
      if (s && s.status === 'ended' && !gameOver){
        showLobbyClosed();
        return;
      }
      applyLobbyStatus(s);
    } catch {}
  }

  // ——— Init + poll ———
  (async ()=>{
    // Load or init state
    try {
      const s = await apiGet(`${base}/api/state.php?lobby=${raw}`);
      board = (s && s.state && Array.isArray(s.state)) ? s.state : initBoard();
      if (!s || !s.state) await apiPost(`${base}/api/state.php`,{ lobby_id:raw, user_id:user, state:board });
    } catch {
      board = initBoard();
    }
    drawBoard();

    // Seat this browser in the lobby and derive player 1/2 from the server.
    await joinLobbyAndAssignPlayer();

    // Start in waiting mode until we detect opponent
    if (!bothJoined) {
      setWaiting(true);
      disableBoard();
    }
    await sendControl('join', { player, user_id: user });

    // Seed moves
    try {
      const initMoves = await apiGet(`${base}/api/moves.php?lobby=${raw}&lastSeq=0`);
      const arr = asMovesArray(initMoves);
      if (arr.length) {
        lastSeq = arr[arr.length-1].sequence || 0;
        for (const m of arr){
          const p = m.payload || {};
          if (p.type === 'join' && m.user_id !== user) opponentUserId = m.user_id;
        }
      }
    } catch {}

    startMatchIfReady();

    // Poll opponent moves
    setInterval(async ()=>{
      try{
        const mv = await apiGet(`${base}/api/moves.php?lobby=${raw}&lastSeq=${lastSeq}`);
        const arr = asMovesArray(mv);
        if (!arr.length) return;
        for (const m of arr){
          lastSeq = m.sequence || lastSeq;
          const {payload, user_id} = m;
          const p = payload || {};
          if (user_id === undefined) continue;

          if (!opponentUserId && user_id !== user) opponentUserId = user_id;

          switch (p.type){
            case 'start':
              // Server signaled the match is ready — unlock UI
              startMatch();
              break;

            case 'join':
              startMatchIfReady();
              break;

            case 'move':
              if (user_id !== user){
                const {from, to} = p;
                const opponentPiece = (player === 1) ? 2 : 1;
                if (board[from?.r]?.[from?.c] !== opponentPiece) break;
                board[to.r][to.c] = opponentPiece;
                board[from.r][from.c] = 0;
                if (Math.abs(to.r - from.r) === 2 && Math.abs(to.c - from.c) === 2){
                  board[(to.r + from.r)/2][(to.c + from.c)/2] = 0;
                }
                yourTurn = true;
                drawBoard();
                checkGameEnd('opponent-move');
              }
              break;

            case 'resign':
              if (user_id !== user) finishMatch(true, 'Opponent resigned');
              break;

            case 'leave':
              if (user_id !== user){
                finishMatch(true, 'Opponent left');
                tryCloseLobby();
              }
              break;

            case 'play-again-request':
              if (user_id !== user){
                oppRequestedRematch = true;
                maybeRestart();
              }
              break;

            case 'restart':
              resetForRematch(p);
              break;

            case 'match-end':
              // Opponent declared end; we already handle our overlay locally
              break;

            default:
              if (p.from && p.to && user_id !== user){
                const opponentPiece = (player === 1) ? 2 : 1;
                if (board[p.from?.r]?.[p.from?.c] !== opponentPiece) break;
                board[p.to.r][p.to.c] = opponentPiece;
                board[p.from.r][p.from.c] = 0;
                if (Math.abs(p.to.r - p.from.r) === 2){
                  board[(p.to.r + p.from.r)/2][(p.to.c + p.from.c)/2] = 0;
                }
                yourTurn = true;
                drawBoard();
                checkGameEnd('opponent-move');
              }
              break;
          }
        }
      } catch {}
    }, 900);

    // Poll lobby status as a safety net
    setInterval(pollLobbyStatus, 1500);
  })();
