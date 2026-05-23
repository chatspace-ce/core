
    // ——— Params ———
    const params = new URLSearchParams(location.search);
    const raw      = params.get('lobby') || params.get('code') || 'demo';
    let playerN  = Math.max(1, Math.min(2, parseInt(params.get('player'), 10) || 1)); // 1=White, 2=Black
    let youColor = (playerN === 1) ? 'w' : 'b';
    const user     = parseInt(params.get('user'), 10) || 1001;
    const gameId   = parseInt(params.get('game'), 10) || 0;
    const url = new URL(window.location.href);
    const path = url.pathname; 

    const gamesRoot = path.includes('/games/') ? path.slice(0, path.indexOf('/games/') + '/games'.length) : '/games';
    const base = gamesRoot;
    // Now build URLs relative to that
    const LIST_URL = `${base}/list_lobbies.php?game=${gameId}`;

    // ——— Runtime ———
    let state      = null;
    let gameOver   = false;
    let bothJoined = false;
    let opponentUserId = null;
    let youRequestedRematch = false;
    let oppRequestedRematch = false;
    let lastSeq = 0;

    // ——— UI refs ———
    const boardEl      = document.getElementById('board');
    const boardWrap    = document.getElementById('board-wrap');
    const topLabel     = document.getElementById('top-label');
    const bottomLabel  = document.getElementById('bottom-label');
    const waitingUI    = document.getElementById('waiting');
    const turnStatus   = document.getElementById('turn-status');
    const overlay      = document.getElementById('overlay');
    const overlayTitle = document.getElementById('overlay-title');
    const overlaySub   = document.getElementById('overlay-sub');
    const startBtn     = document.getElementById('start-over');
    const resignBtn    = document.getElementById('resign');
    const playAgainBtn = document.getElementById('play-again');
    const leaveBtn     = document.getElementById('leave');

    // lobby/user labels removed from UI
    function applyPlayerNumber(nextPlayer) {
      playerN = Math.max(1, Math.min(2, Number(nextPlayer) || 1));
      youColor = (playerN === 1) ? 'w' : 'b';
      boardWrap.classList.toggle('flip', youColor === 'b');
    }
    applyPlayerNumber(playerN);

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
        cell.addEventListener('click', () => onCellClick(r,c));
        boardEl.appendChild(cell);
      }
    }

    // ——— API helpers ———
    async function apiGet(path){
      const url = path + (path.includes('?') ? '&' : '?') + `user=${user}`;
      const res = await fetch(url, { cache: 'no-store' });
      return res.ok ? res.json() : {};
    }
    async function apiPost(path,data){
      const res = await fetch(path,{
        method:'POST',
        headers:{'Content-Type':'application/json'},
        body: JSON.stringify(data),
        cache: 'no-store'
      });
      if (!res.ok) throw new Error('network');
      return res.json();
    }
    function asMovesArray(resp){
      if (Array.isArray(resp)) return resp;
      if (resp && Array.isArray(resp.moves)) return resp.moves;
      return [];
    }

    async function sendControl(type, extra={}){
      try { await apiPost(`${base}/api/moves.php`, { lobby_id: raw, user_id: user, payload: Object.assign({type}, extra) }); } catch {}
    }
    function applyLobbyStatus(lobby) {
      if (!lobby) return;
      if (Number(lobby.user2_id) === user) applyPlayerNumber(2);
      else applyPlayerNumber(1);
      opponentUserId = (playerN === 1) ? Number(lobby.user2_id || 0) : Number(lobby.user1_id || 0);
      bothJoined = Boolean(lobby.user1_id && lobby.user2_id && lobby.status !== 'ended');
      refreshWaiting();
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
    async function pollLobbyStatus() {
      try {
        const status = await apiGet(`${base}/api/lobby.php?action=status&lobby_id=${encodeURIComponent(raw)}`);
        if (status?.status === 'ended') {
          gameOver = true;
          overlayTitle.textContent = 'Lobby Closed';
          overlaySub.textContent = 'This game has ended.';
          overlay.style.display = 'flex';
          disableInputs(true);
          return;
        }
        applyLobbyStatus(status);
      } catch {}
    }
    async function recordResult(result, reason='completed', score=0){
      try { await apiPost(`${base}/api/result.php`, { lobby_id: raw, user_id: user, result, reason, score }); }
      catch { sendControl('result', { result, reason, score }); }
    }
    async function tryCloseLobby(){
      try { await apiPost(`${base}/api/lobby.php`, { action:'close', lobby_id: raw, user_id: user }); } catch {}
    }

    // ——— Chess core ———
    const PIECES = { wP:'♙', wR:'♖', wN:'♘', wB:'♗', wQ:'♕', wK:'♔', bP:'♟', bR:'♜', bN:'♞', bB:'♝', bQ:'♛', bK:'♚' };
    const DIRS_K = [[-1,-1],[-1,0],[-1,1],[0,-1],[0,1],[1,-1],[1,0],[1,1]];
    const DIRS_B = [[-1,-1],[-1,1],[1,-1],[1,1]];
    const DIRS_R = [[-1,0],[1,0],[0,-1],[0,1]];
    const KNIGHT = [[-2,-1],[-2,1],[-1,-2],[-1,2],[1,-2],[1,2],[2,-1],[2,1]];

    function inB(r,c){ return r>=0 && r<8 && c>=0 && c<8; }
    function colOf(p){ return p ? p[0] : null; }
    function typeOf(p){ return p ? p[1] : null; }
    function other(col){ return col==='w' ? 'b' : 'w'; }

    function initialState(){
      const b = Array.from({length:8}, ()=>Array(8).fill(''));
      const back = ['R','N','B','Q','K','B','N','R'];
      for(let c=0;c<8;c++){ b[0][c]='b'+back[c]; b[1][c]='bP'; }
      for(let c=0;c<8;c++){ b[6][c]='wP'; b[7][c]='w'+back[c]; }
      return { board:b, toMove:'w', castling:{wK:true,wQ:true,bK:true,bQ:true}, enPassant:null, halfmove:0, fullmove:1, captured:{w:[],b:[]} };
    }
    function cloneState(s){
      return { board:s.board.map(r=>r.slice()), toMove:s.toMove, castling:{...s.castling}, enPassant:s.enPassant?{...s.enPassant}:null, halfmove:s.halfmove, fullmove:s.fullmove, captured:{w:[...s.captured.w], b:[...s.captured.b]} };
    }
    function findKing(s,col){ for(let r=0;r<8;r++)for(let c=0;c<8;c++){ if(s.board[r][c]===col+'K') return {r,c}; } return null; }

    function isSquareAttacked(s, rr, cc, byCol){
      const b=s.board; const dir = byCol==='w' ? -1 : 1;
      // pawns
      for(const dc of [-1,1]){ const r=rr+dir, c=cc+dc; if(inB(r,c)&&b[r][c]===(byCol+'P')) return true; }
      // knights
      for(const [dr,dc] of KNIGHT){ const r=rr+dr,c=cc+dc; if(inB(r,c)&&b[r][c]===(byCol+'N')) return true; }
      // bishops/queens
      for(const [dr,dc] of DIRS_B){
        for(let r=rr+dr, c=cc+dc; inB(r,c); r+=dr, c+=dc){
          const p=b[r][c]; if(!p) continue;
          if(colOf(p)===byCol && (typeOf(p)==='B'||typeOf(p)==='Q')) return true; break;
        }
      }
      // rooks/queens
      for(const [dr,dc] of DIRS_R){
        for(let r=rr+dr, c=cc+dc; inB(r,c); r+=dr, c+=dc){
          const p=b[r][c]; if(!p) continue;
          if(colOf(p)===byCol && (typeOf(p)==='R'||typeOf(p)==='Q')) return true; break;
        }
      }
      // king
      for(const [dr,dc] of DIRS_K){ const r=rr+dr,c=cc+dc; if(inB(r,c)&&b[r][c]===(byCol+'K')) return true; }
      return false;
    }
    function inCheck(s,col){ const k=findKing(s,col); if(!k) return false; return isSquareAttacked(s,k.r,k.c,other(col)); }

    function applyMoveOn(s, mv, dry=false){
      const b=s.board; const {from,to,promotion,castle,enPassant,double} = mv;
      const piece = b[from.r][from.c]; const col=colOf(piece);
      let captured='';
      s.enPassant=null;

      if(enPassant){ const dir=(col==='w')?1:-1; captured=b[to.r+dir][to.c]; b[to.r+dir][to.c]=''; }
      else { captured=b[to.r][to.c]||''; }

      b[to.r][to.c]=piece; b[from.r][from.c]='';

      if(promotion){ b[to.r][to.c]=col+promotion; }
      if(captured && !dry) s.captured[col].push(captured);

      if(castle==='K'){ const row=(col==='w')?7:0; b[row][5]=col+'R'; b[row][7]=''; }
      if(castle==='Q'){ const row=(col==='w')?7:0; b[row][3]=col+'R'; b[row][0]=''; }

      if(typeOf(piece)==='P' && double){ const dir=(col==='w')?-1:1; s.enPassant={r:from.r+dir,c:from.c}; }

      if(piece=== 'wK'){ s.castling.wK=false; s.castling.wQ=false; }
      if(piece=== 'bK'){ s.castling.bK=false; s.castling.bQ=false; }
      if(piece=== 'wR' && from.r===7 && from.c===0) s.castling.wQ=false;
      if(piece=== 'wR' && from.r===7 && from.c===7) s.castling.wK=false;
      if(piece=== 'bR' && from.r===0 && from.c===0) s.castling.bQ=false;
      if(piece=== 'bR' && from.r===0 && from.c===7) s.castling.bK=false;

      if(!dry){
        s.halfmove = (typeOf(piece)==='P' || captured) ? 0 : (s.halfmove+1);
        s.toMove = other(s.toMove);
        if(s.toMove==='w') s.fullmove += 1;
      }
      return captured;
    }

    function genMovesFor(s, r, c){
      const b=s.board, p=b[r][c]; if(!p) return [];
      const col=colOf(p), t=typeOf(p); const moves=[];
      const push=(toR,toC,opts={})=>{
        const ns=cloneState(s);
        const cap=applyMoveOn(ns,{from:{r,c},to:{r:toR,c:toC},...opts},true);
        if(!inCheck(ns,col)) moves.push({from:{r,c},to:{r:toR,c:toC},...opts,capture:cap||''});
      };

      if(t==='P'){
        const dir=(col==='w')?-1:1; const startR=(col==='w')?6:1;
        const one=r+dir;
        if(inB(one,c) && !b[one][c]){
          if((col==='w'&&one===0)||(col==='b'&&one===7)) push(one,c,{promotion:'Q'});
          else push(one,c,{});
          const two=r+2*dir; if(r===startR && !b[two][c]) push(two,c,{double:true});
        }
        for(const dc of [-1,1]){
          const tr=r+dir, tc=c+dc; if(!inB(tr,tc)) continue;
          if(b[tr][tc] && colOf(b[tr][tc])!==col){
            if((col==='w'&&tr===0)||(col==='b'&&tr===7)) push(tr,tc,{promotion:'Q'}); else push(tr,tc,{});
          }
        }
        if(s.enPassant){ const {r:er,c:ec}=s.enPassant; if(er===r+dir && Math.abs(ec-c)===1) push(er,ec,{enPassant:true}); }
      }
      if(t==='N'){ for(const [dr,dc] of KNIGHT){ const tr=r+dr,tc=c+dc; if(!inB(tr,tc)) continue; if(!b[tr][tc] || colOf(b[tr][tc])!==col) push(tr,tc,{});} }
      if(t==='B'||t==='Q'){ for(const [dr,dc] of DIRS_B){ let tr=r+dr,tc=c+dc; while(inB(tr,tc) && !b[tr][tc]){ push(tr,tc,{}); tr+=dr; tc+=dc;} if(inB(tr,tc) && colOf(b[tr][tc])!==col) push(tr,tc,{}); } }
      if(t==='R'||t==='Q'){ for(const [dr,dc] of DIRS_R){ let tr=r+dr,tc=c+dc; while(inB(tr,tc) && !b[tr][tc]){ push(tr,tc,{}); tr+=dr; tc+=dc;} if(inB(tr,tc) && colOf(b[tr][tc])!==col) push(tr,tc,{}); } }
      if(t==='K'){
        for(const [dr,dc] of DIRS_K){ const tr=r+dr,tc=c+dc; if(!inB(tr,tc)) continue; if(!b[tr][tc] || colOf(b[tr][tc])!==col) push(tr,tc,{}); }
        if((col==='w'&&r===7&&c===4)||(col==='b'&&r===0&&c===4)){
          const rights=s.castling; const row=r;
          if((col==='w'&&rights.wK)||(col==='b'&&rights.bK)){
            if(!b[row][5]&&!b[row][6]&&!isSquareAttacked(s,row,4,other(col))&&!isSquareAttacked(s,row,5,other(col))&&!isSquareAttacked(s,row,6,other(col))){
              push(row,6,{castle:'K'});
            }
          }
          if((col==='w'&&rights.wQ)||(col==='b'&&rights.bQ)){
            if(!b[row][1]&&!b[row][2]&&!b[row][3]&&!isSquareAttacked(s,row,4,other(col))&&!isSquareAttacked(s,row,3,other(col))&&!isSquareAttacked(s,row,2,other(col))){
              push(row,2,{castle:'Q'});
            }
          }
        }
      }
      return moves;
    }
    function genAllLegal(s,col){ const ms=[]; for(let r=0;r<8;r++)for(let c=0;c<8;c++){ const p=s.board[r][c]; if(p && colOf(p)===col) ms.push(...genMovesFor(s,r,c)); } return ms; }

    // ——— UI helpers ———
    let selected = null;

    function refreshWaiting(){
      const waiting = (!opponentUserId) || (!bothJoined);
      waitingUI.style.display = waiting ? 'flex' : 'none';
      boardWrap.style.display = waiting ? 'none' : 'block';
      topLabel.style.display  = waiting ? 'none' : 'block';
      bottomLabel.style.display = waiting ? 'none' : 'block';
      boardEl.style.pointerEvents = waiting ? 'none' : 'auto';
      if(state){
        turnStatus.textContent = waiting ? 'Waiting for Opponent' : (state.toMove === youColor ? 'Your turn.' : 'Waiting for Opponent');
      } else {
        turnStatus.textContent = waiting ? 'Waiting for Opponent' : 'Your turn.';
      }
    }
    function setWaiting(v){ refreshWaiting(); }
    function disableInputs(v){ boardEl.style.pointerEvents = v ? 'none' : 'auto'; refreshWaiting(); }
    function resetOverlayButtons(){
      playAgainBtn.style.display = 'inline-block';
      leaveBtn.textContent = 'Leave';
    }

    function drawBoard(){
      if(!state) return;
      for(let r=0;r<8;r++){
        for(let c=0;c<8;c++){
          const cell=document.getElementById(`cell-${r}-${c}`);
          cell.innerHTML='';
          const p=state.board[r][c];
          if(!p) continue;
          const div=document.createElement('div');
          div.className=`piece ${colOf(p)} ${colOf(p)===youColor?'mine':''}`;
          const glyph=document.createElement('div');
          glyph.className='glyph';
          glyph.textContent=PIECES[p];
          div.appendChild(glyph);
          div.addEventListener('click', (e)=>{ e.stopPropagation(); onPieceClick(r,c); });
          cell.appendChild(div);
        }
      }
      // Labels
      const wCaps = state.captured.b.length; // White captured black pieces
      const bCaps = state.captured.w.length; // Black captured white pieces
      if (youColor==='w'){
        topLabel.textContent    = `Black (Opponent) — Captured: ${wCaps}`;
        bottomLabel.textContent = `White (You) — Captured: ${bCaps}`;
      } else {
        topLabel.textContent    = `White (Opponent) — Captured: ${bCaps}`;
        bottomLabel.textContent = `Black (You) — Captured: ${wCaps}`;
      }
      turnStatus.textContent = (state.toMove===youColor) ? 'Your turn.' : 'Waiting for Opponent';

      refreshWaiting();
      if(selected){
        const cell=document.getElementById(`cell-${selected.r}-${selected.c}`);
        const el=cell && cell.querySelector('.piece.mine'); if(el) el.classList.add('selected');
      }
    }

    function clearHints(){
      document.querySelectorAll('.hint').forEach(h=>h.remove());
      document.querySelectorAll('.move-target').forEach(el=>el.classList.remove('move-target'));
    }
    function highlightMoves(moves){
      clearHints();
      moves = Array.isArray(moves) ? moves : [];
      for(const m of moves){
        const el = document.getElementById(`cell-${m.to.r}-${m.to.c}`);
        if(!el) continue;
        const h = document.createElement('div');
        h.className = 'hint' + (m.capture ? ' capture' : '');
        el.appendChild(h);
        el.classList.add('move-target');
      }
    }

    function onPieceClick(r,c){
      if(gameOver || !state) return;
      if(state.toMove!==youColor) return;
      const p=state.board[r][c];
      if(!p || colOf(p)!==youColor){ return; }
      selected={r,c, moves:genMovesFor(state,r,c)};
      highlightMoves(selected.moves);
      document.querySelectorAll('.piece').forEach(el=>el.classList.remove('selected'));
      const div=document.querySelector(`#cell-${r}-${c} .piece`);
      if(div) div.classList.add('selected');
    }
    function onCellClick(r,c){
      if(gameOver || !state) return;
      if(state.toMove!==youColor) return;
      if(!selected){ return; }
      const current = genMovesFor(state, selected.r, selected.c);
      const mv = current.find(m=>m.to.r===r && m.to.c===c);
      if(!mv){
        const p = state.board[r][c];
        if(p && colOf(p)===youColor){ onPieceClick(r,c); return; }
        return;
      }
      doLocalMove(mv);
    }

    function doLocalMove(mv){
      applyMoveOn(state, mv);
      selected=null; clearHints();
      document.querySelectorAll('.piece').forEach(el=>el.classList.remove('selected'));
      drawBoard();

      // Persist + notify
      const payload = { type:'move', from:mv.from, to:mv.to, promotion:mv.promotion||null, castle:mv.castle||null, enPassant: !!mv.enPassant, double: !!mv.double };
      apiPost(`${base}/api/moves.php`, { lobby_id: raw, user_id: user, payload }).catch(()=>{});
      apiPost(`${base}/api/state.php`, { lobby_id: raw, user_id: user, state }).catch(()=>{});

      evaluateEnd();
    }

    function evaluateEnd(){
      const legal = genAllLegal(state, state.toMove);
      if(legal.length===0){
        const check = inCheck(state, state.toMove);
        if(check){
          gameOver=true;
          recordResult('win','checkmate',1).catch(()=>{});
          resetOverlayButtons();
          overlayTitle.textContent='Checkmate!';
          overlaySub.textContent='You win.';
          overlay.style.display='flex';
        }else{
          gameOver=true;
          recordResult('draw','stalemate',0.5).catch(()=>{});
          resetOverlayButtons();
          overlayTitle.textContent='Draw';
          overlaySub.textContent='Stalemate.';
          overlay.style.display='flex';
        }
      }
    }

    // ——— Controls ———
    startBtn.onclick = async ()=>{
      if (gameOver) return;
      youRequestedRematch = true;
      await sendControl('play-again-request', { player: playerN });
      maybeRestart();
    };
    playAgainBtn.onclick = startBtn.onclick;

    resignBtn.onclick = async ()=>{
      if (gameOver) return;
      await sendControl('resign', { player: playerN });
      gameOver = true;
      overlayTitle.textContent = "You Resigned";
      overlaySub.textContent   = "Returning to lobbies…";
      playAgainBtn.style.display = 'none';
      leaveBtn.style.display     = 'none';
      overlay.style.display = 'flex';
      try { await recordResult('loss','resigned',0); } catch {}
      setTimeout(()=>{ try { window.parent.postMessage({ type: "game_close", lobby: raw }, "*"); } catch {}
      location.href = LIST_URL; }, 3000);
    };

    leaveBtn.onclick = async ()=>{
      await sendControl('leave', { player: playerN });
      tryCloseLobby();
      overlayTitle.textContent = 'Lobby Closed';
      overlaySub.textContent   = 'Thanks for playing!';
      overlay.style.display = 'flex';
      boardEl.style.pointerEvents='none';
    };

    function resetForRematch(){
      state = initialState();
      gameOver = false;
      youRequestedRematch = false;
      oppRequestedRematch = false;
      overlay.style.display='none';
      drawBoard();
      apiPost(`${base}/api/state.php`, { lobby_id: raw, user_id: user, state }).catch(()=>{});
    }
    function maybeRestart(){
      if (youRequestedRematch && oppRequestedRematch){
        (async ()=>{
          try { await apiPost(`${base}/api/restart.php`, { lobby_id: raw, user_id: user }); } catch {}
          await sendControl('restart', {});
          resetForRematch();
        })();
      }
    }

    // ——— Match flow / polling ———
    function startMatchIfReady(){
      if (bothJoined) return;
      if (opponentUserId && opponentUserId !== user){
        bothJoined = true;
        refreshWaiting();
      }
    }

    async function handleMovePayload(p){
      const t = p?.payload?.type;
      if (!t) return;

      // NEW: figure out who sent the control (top-level user_id is most reliable)
      const senderId = (p && (p.user_id != null)) ? p.user_id : (p?.payload?.user_id ?? null);

      if (t === 'join'){
        const uid = p.payload.user_id;
        if ((uid && uid !== user) || (senderId && senderId !== user)){
          opponentUserId = uid || senderId;
          startMatchIfReady();
        }
      }

      if (t === 'move'){
        const mv = { from:p.payload.from, to:p.payload.to, promotion:p.payload.promotion||null, castle:p.payload.castle||null, enPassant: !!p.payload.enPassant, double: !!p.payload.double };
        applyMoveOn(state, mv);
        drawBoard();
        evaluateEnd();
      }

      if (t === 'play-again-request'){
        oppRequestedRematch = true; maybeRestart();
      }

      if (t === 'restart'){
        resetForRematch();
      }

      // PATCHED: only react if the OTHER player resigned
      if (t === 'resign' && senderId !== user){
        gameOver = true;
        overlayTitle.textContent = "You’ve Won!";
        overlaySub.textContent   = "Opponent resigned.";
        playAgainBtn.style.display = 'none';
        overlay.style.display='flex';
        // make Leave an immediate bounce to the lobby (clean UX)
        leaveBtn.onclick = ()=>{ try { window.parent.postMessage({ type: "game_close", lobby: raw }, "*"); } catch {}
      location.href = LIST_URL; };
        try { await recordResult('win','opponent_resigned',1); } catch {}
      }

      // Bonus: if the other side leaves outright, show a clean finish too
      if (t === 'leave' && senderId !== user){
        gameOver = true;
        overlayTitle.textContent = "You’ve Won!";
        overlaySub.textContent   = "Opponent left.";
        playAgainBtn.style.display = 'none';
        overlay.style.display='flex';
        leaveBtn.onclick = ()=>{ try { window.parent.postMessage({ type: "game_close", lobby: raw }, "*"); } catch {}
      location.href = LIST_URL; };
        tryCloseLobby();
      }

      if (t === 'match-end'){
        gameOver = true;
        overlayTitle.textContent = p.payload.youWon ? "You’ve Won!" : "Better luck next time :(";
        overlaySub.textContent   = p.payload.reason || '';
        overlay.style.display='flex';
      }
    }

    async function poll(){
      try{
        const resp = await apiGet(`${base}/api/moves.php?lobby=${encodeURIComponent(raw)}&lastSeq=${lastSeq}`);
        const arr  = asMovesArray(resp);
        if (arr.length){
          lastSeq = arr[arr.length-1].sequence || lastSeq;
          for(const m of arr){ await handleMovePayload(m); }
        }
      }catch{}
      // Also peek state to catch up if we missed a move
      try{
        const s = await apiGet(`${base}/api/state.php?lobby=${encodeURIComponent(raw)}`);
        if (s && s.state){
          // basic reconciliation: if turn or board differs notably, adopt server state
          if (!state || JSON.stringify(state.board)!==JSON.stringify(s.state.board) || state.toMove!==s.state.toMove){
            state = s.state;
            drawBoard();
          }
        }
      }catch{}
    }

    // ——— Init ———
    (async ()=>{
      // Load or init state
      try {
        const s = await apiGet(`${base}/api/state.php?lobby=${encodeURIComponent(raw)}`);
        state = (s && s.state) ? s.state : initialState();
        if (!s || !s.state) await apiPost(`${base}/api/state.php`,{ lobby_id:raw, user_id:user, state });
      } catch {
        state = initialState();
      }
      await joinLobbyAndAssignPlayer();
      drawBoard();

      // Announce join & show waiting until we detect opponent
      await sendControl('join', { player: playerN, user_id: user });
      refreshWaiting();

      // Seed lastSeq with history
      try {
        const initMoves = await apiGet(`${base}/api/moves.php?lobby=${encodeURIComponent(raw)}&lastSeq=0`);
        const arr = asMovesArray(initMoves);
        if (arr.length){
          lastSeq = arr[arr.length-1].sequence || 0;
          // backfill opponent detection if their join was earlier
          const oppJoin = arr.find(x => x?.payload?.type==='join' && (x?.payload?.user_id || x?.user_id) && (x.payload.user_id || x.user_id) !== user);
          if (oppJoin){ opponentUserId = oppJoin.payload?.user_id || oppJoin.user_id; startMatchIfReady(); }
        }
      } catch {}

      // Begin polling
      setInterval(poll, 1200);
      setInterval(pollLobbyStatus, 1500);
    })();
  
