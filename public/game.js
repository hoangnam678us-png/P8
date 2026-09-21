(() => {
  'use strict';
  const state = {
    socket: null, myId: null, nickname: '', role: 'top',
    avatar: { skin: '#f5c9a0', hair: 'short', hairColor: '#3d2b1f', top: 'towel', topColor: '#fff', bottom: 'shorts', bottomColor: '#2a5caa', towelColor: '#ff6b9d' },
    room: 'lobby', bounds: { w: 1400, h: 900 }, players: {}, keys: {},
    joy: { active: false, dx: 0, dy: 0 }, speed: 2.9, chatOpen: false, lastMoveSend: 0,
    bubbles: {}, emotes: {}, actions: {}, online: 0, roomsInfo: [], targetId: null,
    hp: 100, maxHp: 100, myState: 'normal', money: 500000, inventory: {},
    motelFrom: null
  };

  const SKINS = ['#f5c9a0','#e8b88a','#c68642','#8d5524','#5c3a21','#fde8d0'];
  const HAIRS = ['#3d2b1f','#1a1a1a','#c9a227','#8b4513','#ff6b9d','#4a90d9','#e0e0e0'];
  const CLOTHES = ['#ffffff','#ff6b9d','#2a5caa','#2ecc71','#e74c3c','#9b59b6','#f39c12','#1abc9c'];
  const ROOM_NAMES = { lobby:'Sảnh Chính','sauna-steam':'Xông Hơi Nước','sauna-dry':'Xông Khô',jacuzzi:'Jacuzzi','dark-room':'Phòng Tối',lounge:'Lounge',changing:'Thay Đồ',bath:'Phòng Tắm',arena:'Khu Đấu',motel:'Nhà Nghỉ' };

  const $ = s => document.querySelector(s);
  const loginScreen = $('#login-screen'), gameScreen = $('#game-screen'), canvas = $('#game-canvas'), ctx = canvas.getContext('2d');
  const nickInput = $('#nickname-input'), btnJoin = $('#btn-join'), avatarPreview = $('#avatar-preview');
  const onlineEl = $('#online-count'), roomCountEl = $('#room-count'), myNameEl = $('#my-name'), roomNameEl = $('#room-name');
  const hpBar = $('#hp-bar'), moneyEl = $('#money-display'), chatBar = $('#chat-bar'), chatInput = $('#chat-input'), chatLog = $('#chat-log');
  const emoteMenu = $('#emote-menu'), socialMenu = $('#social-menu'), shopPanel = $('#shop-panel');
  const pmPanel = $('#pm-panel'), motelModal = $('#motel-modal'), roomNav = $('#room-nav'), privatePanel = $('#private-panel');

  document.querySelectorAll('.role-btn').forEach(btn => {
    btn.onclick = () => {
      document.querySelectorAll('.role-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      state.role = btn.dataset.role;
    };
  });

  function renderPreview() {
    const a = state.avatar; avatarPreview.innerHTML = '';
    const svg = document.createElementNS('http://www.w3.org/2000/svg','svg');
    svg.setAttribute('viewBox','0 0 40 50'); svg.style.width='80px'; svg.style.height='100px';
    const body = document.createElementNS('http://www.w3.org/2000/svg','rect');
    body.setAttribute('x','12'); body.setAttribute('y','18'); body.setAttribute('width','16'); body.setAttribute('height','20'); body.setAttribute('rx','3'); body.setAttribute('fill',a.skin); svg.appendChild(body);
    const head = document.createElementNS('http://www.w3.org/2000/svg','circle');
    head.setAttribute('cx','20'); head.setAttribute('cy','12'); head.setAttribute('r','9'); head.setAttribute('fill',a.skin); svg.appendChild(head);
    if (a.hair !== 'bald') {
      const hair = document.createElementNS('http://www.w3.org/2000/svg','ellipse');
      hair.setAttribute('cx','20'); hair.setAttribute('cy','8'); hair.setAttribute('rx',a.hair==='long'?10:8); hair.setAttribute('ry',a.hair==='curly'?7:5); hair.setAttribute('fill',a.hairColor); svg.appendChild(hair);
    }
    const top = document.createElementNS('http://www.w3.org/2000/svg','rect');
    top.setAttribute('x','11'); top.setAttribute('y','18'); top.setAttribute('width','18'); top.setAttribute('height','12'); top.setAttribute('rx','2');
    top.setAttribute('fill', a.top==='towel'?(a.towelColor||a.topColor):a.topColor); svg.appendChild(top);
    const bot = document.createElementNS('http://www.w3.org/2000/svg','rect');
    bot.setAttribute('x','13'); bot.setAttribute('y','30'); bot.setAttribute('width','14'); bot.setAttribute('height','10'); bot.setAttribute('rx','2'); bot.setAttribute('fill',a.bottomColor); svg.appendChild(bot);
    avatarPreview.appendChild(svg);
  }
  function buildColorPicks(id, colors, key) {
    const el = document.getElementById(id); el.innerHTML = '';
    colors.forEach(c => {
      const d = document.createElement('div'); d.className = 'color-pick'+(state.avatar[key]===c?' active':''); d.style.background=c;
      d.onclick = () => { state.avatar[key]=c; if(key==='topColor') state.avatar.towelColor=c; el.querySelectorAll('.color-pick').forEach(x=>x.classList.remove('active')); d.classList.add('active'); renderPreview(); };
      el.appendChild(d);
    });
  }
  buildColorPicks('skin-picks',SKINS,'skin'); buildColorPicks('hair-picks',HAIRS,'hairColor');
  buildColorPicks('top-picks',CLOTHES,'topColor'); buildColorPicks('bottom-picks',CLOTHES,'bottomColor');
  $('#hair-style').onchange = e => { state.avatar.hair=e.target.value; renderPreview(); };
  $('#top-style').onchange = e => { state.avatar.top=e.target.value; renderPreview(); };
  $('#bottom-style').onchange = e => { state.avatar.bottom=e.target.value; renderPreview(); };
  renderPreview();

  btnJoin.onclick = () => {
    const nick = nickInput.value.trim();
    if (!nick || nick.length > 16) { alert('Biệt danh 1-16 ký tự'); return; }
    state.nickname = nick; startGame();
  };
  nickInput.addEventListener('keydown', e => { if (e.key === 'Enter') btnJoin.click(); });

  function startGame() {
    loginScreen.classList.add('hidden'); gameScreen.classList.remove('hidden');
    myNameEl.textContent = state.nickname;
    myNameEl.style.color = state.role === 'bot' ? '#ff6b9d' : '#4a90d9';
    resizeCanvas(); window.addEventListener('resize', resizeCanvas);
    state.socket = io({ transports: ['websocket','polling'] });

    state.socket.on('connect', () => state.socket.emit('join', { nickname: state.nickname, avatar: state.avatar, role: state.role }));

    state.socket.on('joined', data => {
      state.myId = data.id; state.room = data.room; state.bounds = data.bounds;
      state.roomsInfo = data.rooms || []; state.money = data.money || 500000;
      state.inventory = data.inventory || {}; state.role = data.role || state.role;
      updateMoney(); state.players = {};
      data.players.forEach(p => { state.players[p.id] = { ...p, tx: p.x, ty: p.y, renderX: p.x, renderY: p.y }; });
      if (!state.players[state.myId]) {
        state.players[state.myId] = { id: state.myId, nickname: state.nickname, avatar: state.avatar, role: state.role, x: 250, y: 350, tx: 250, ty: 350, renderX: 250, renderY: 350, dir: 'down', hp: 100, maxHp: 100, state: 'normal' };
      }
      updateRoomUI(); requestAnimationFrame(loop);
    });

    state.socket.on('playerJoined', p => { state.players[p.id] = { ...p, tx: p.x, ty: p.y, renderX: p.x, renderY: p.y }; });
    state.socket.on('playerLeft', d => { delete state.players[d.id]; delete state.bubbles[d.id]; delete state.emotes[d.id]; delete state.actions[d.id]; });
    state.socket.on('playerMoved', d => { const p = state.players[d.id]; if (!p) return; p.tx = d.x; p.ty = d.y; p.dir = d.dir || p.dir; p.sitting = !!d.sitting; });
    state.socket.on('chat', d => { state.bubbles[d.id] = { msg: d.msg, until: Date.now() + 4500 }; addChatLog(d.nickname, d.msg, d.id === 'system', d.role || (d.isBot ? 'bot' : null)); });
    state.socket.on('pm', d => {
      const isMe = d.from === state.myId;
      const name = isMe ? 'Bạn → ' + (state.players[d.to]?.nickname || '') : d.fromName;
      const log = $('#pm-log');
      const div = document.createElement('div');
      div.innerHTML = `<b style="color:${d.fromRole==='bot'?'#ff6b9d':'#4a90d9'}">${esc(name)}:</b> ${esc(d.msg)}`;
      log.appendChild(div);
      log.scrollTop = log.scrollHeight;
      if (!isMe) {
        addChatLog('PM từ ' + d.fromName, d.msg, true, d.fromRole);
        pmPanel.classList.remove('hidden');
        $('#pm-target').textContent = 'Đang chat với: ' + d.fromName;
        state.targetId = d.from;
      }
    });
    state.socket.on('playerEmote', d => { state.emotes[d.id] = { emote: d.emote, until: Date.now() + 3000 }; });
    state.socket.on('social', d => {
      state.actions[d.from] = { type: d.type, until: Date.now() + 2500 };
      const labels = { hug:'ôm', kiss:'hôn', sleep:'ngủ cùng', pat:'vỗ về', highfive:'đập tay', dance:'nhảy', wave:'vẫy tay', motel:'rủ nhà nghỉ' };
      if (d.to === state.myId || d.from === state.myId) addChatLog('Hệ thống', `${d.nickname} đã ${labels[d.type]||d.type}`, true);
    });
    state.socket.on('motelInvite', d => {
      state.motelFrom = d.from;
      $('#motel-from-text').textContent = d.fromName + ' rủ bạn đi Nhà Nghỉ';
      motelModal.classList.remove('hidden');
    });
    state.socket.on('combat', d => {
      const t = state.players[d.target]; if (t) { t.hp = d.hp; t.maxHp = d.maxHp; }
      if (d.target === state.myId) { state.hp = d.hp; hpBar.style.width = (d.hp/d.maxHp*100)+'%'; }
      state.actions[d.attacker] = { type: 'attack', until: Date.now() + 500 };
      if (t) t.dmgText = { val: '-'+d.damage, until: Date.now()+800, y: 0 };
    });
    state.socket.on('bought', d => { state.money = d.money; state.inventory = d.inventory; updateMoney(); addChatLog('Lễ tân', 'Mua thành công '+d.name, true); });
    state.socket.on('roomChanged', data => {
      state.room = data.room; state.bounds = data.bounds; state.myState = data.state || 'normal';
      state.roomsInfo = data.rooms || state.roomsInfo; state.players = {};
      data.players.forEach(p => { state.players[p.id] = { ...p, tx: p.x, ty: p.y, renderX: p.x, renderY: p.y }; });
      const me = state.players[state.myId];
      if (me) { me.x = data.x; me.y = data.y; me.tx = data.x; me.ty = data.y; me.renderX = data.x; me.renderY = data.y; me.state = data.state; }
      updateRoomUI();
      motelModal.classList.add('hidden');
    });
    state.socket.on('privateCreated', data => {
      state.room = data.room; state.bounds = data.bounds; state.myState = 'towel'; state.players = {};
      state.players[state.myId] = { id: state.myId, nickname: state.nickname, avatar: state.avatar, role: state.role, x: data.x, y: data.y, tx: data.x, ty: data.y, renderX: data.x, renderY: data.y, dir: 'down', state: 'towel', hp: state.hp, maxHp: state.maxHp };
      updateRoomUI(); alert('Phòng riêng: ' + data.room); privatePanel.classList.add('hidden');
    });
    state.socket.on('onlineCount', n => { state.online = n; onlineEl.textContent = 'Online: ' + n; });
    state.socket.on('error', d => addChatLog('Hệ thống', d.msg, true));
    state.socket.on('disconnect', () => addChatLog('Hệ thống', 'Mất kết nối...', true));
    state.socket.on('reconnect', () => state.socket.emit('join', { nickname: state.nickname, avatar: state.avatar, role: state.role }));
    setupInput();
  }

  function updateMoney() { moneyEl.textContent = '💰 ' + (state.money||0).toLocaleString('vi-VN') + 'đ'; }
  function updateRoomUI() {
    roomNameEl.textContent = ROOM_NAMES[state.room] || (state.room.startsWith('private_') || state.room.startsWith('motel_') ? 'Phòng Riêng / Nhà Nghỉ' : state.room);
    roomNav.innerHTML = '';
    (state.roomsInfo||[]).forEach(r => {
      const btn = document.createElement('button');
      btn.className = 'room-btn'+(r.id===state.room?' active':'')+(r.count>=r.max?' full':'');
      btn.textContent = `${r.name} (${r.count})`;
      btn.onclick = () => { if (r.id !== state.room) state.socket.emit('changeRoom', { room: r.id }); };
      roomNav.appendChild(btn);
    });
    const cur = (state.roomsInfo||[]).find(r => r.id === state.room);
    roomCountEl.textContent = cur ? `Phòng: ${cur.count}/${cur.max}` : '';
  }
  function addChatLog(name, msg, isSystem, role) {
    const div = document.createElement('div');
    div.className = 'chat-msg'+(isSystem?' system':'');
    let nameColor = '#ff9ec0';
    if (role === 'bot') nameColor = '#ff6b9d';
    else if (role === 'top') nameColor = '#4a90d9';
    div.innerHTML = `<span class="name" style="color:${nameColor}">${esc(name)}:</span> ${esc(msg)}`;
    chatLog.appendChild(div);
    while (chatLog.children.length > 10) chatLog.removeChild(chatLog.firstChild);
    setTimeout(() => div.remove(), 9000);
  }
  function esc(s) { return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }

  function setupInput() {
    window.addEventListener('keydown', e => {
      if (state.chatOpen) { if (e.key==='Enter') sendChat(); if (e.key==='Escape') closeChat(); return; }
      state.keys[e.key.toLowerCase()] = true;
      if (e.key === 'Enter') openChat();
      if (e.key.toLowerCase() === 'e') state.socket.emit('sit');
      if (e.key.toLowerCase() === 'f') doAttack();
    });
    window.addEventListener('keyup', e => { state.keys[e.key.toLowerCase()] = false; });

    const base = $('#joystick-base'), knob = $('#joystick-knob'); let joyId = null;
    function joyStart(x,y,id){ joyId=id; state.joy.active=true; joyMove(x,y); }
    function joyMove(x,y){ if(!state.joy.active)return; const rect=base.getBoundingClientRect(); const cx=rect.left+rect.width/2,cy=rect.top+rect.height/2; let dx=x-cx,dy=y-cy; const max=40,len=Math.sqrt(dx*dx+dy*dy); if(len>max){dx=dx/len*max;dy=dy/len*max;} knob.style.transform=`translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px))`; state.joy.dx=dx/max; state.joy.dy=dy/max; }
    function joyEnd(){ state.joy.active=false; state.joy.dx=0; state.joy.dy=0; knob.style.transform='translate(-50%,-50%)'; joyId=null; }
    base.addEventListener('touchstart', e=>{e.preventDefault();const t=e.changedTouches[0];joyStart(t.clientX,t.clientY,t.identifier);},{passive:false});
    window.addEventListener('touchmove', e=>{if(joyId===null)return;for(const t of e.changedTouches)if(t.identifier===joyId){e.preventDefault();joyMove(t.clientX,t.clientY);}},{passive:false});
    window.addEventListener('touchend', e=>{for(const t of e.changedTouches)if(t.identifier===joyId)joyEnd();});
    base.addEventListener('mousedown', e=>joyStart(e.clientX,e.clientY,'mouse'));
    window.addEventListener('mousemove', e=>{if(joyId==='mouse')joyMove(e.clientX,e.clientY);});
    window.addEventListener('mouseup', ()=>{if(joyId==='mouse')joyEnd();});

    $('#btn-chat').onclick = () => state.chatOpen ? closeChat() : openChat();
    $('#btn-emote').onclick = () => { emoteMenu.classList.toggle('hidden'); socialMenu.classList.add('hidden'); shopPanel.classList.add('hidden'); pmPanel.classList.add('hidden'); };
    $('#btn-social').onclick = () => { socialMenu.classList.toggle('hidden'); emoteMenu.classList.add('hidden'); shopPanel.classList.add('hidden'); pmPanel.classList.add('hidden'); };
    $('#btn-pm').onclick = () => {
      if (!state.targetId) { addChatLog('Hệ thống', 'Chạm chọn người chơi trước rồi bấm 📩', true); return; }
      const t = state.players[state.targetId];
      $('#pm-target').textContent = t ? 'Đang chat với: ' + t.nickname : 'Chọn người chơi';
      pmPanel.classList.toggle('hidden');
      socialMenu.classList.add('hidden'); emoteMenu.classList.add('hidden');
    };
    $('#btn-attack').onclick = doAttack;
    $('#btn-shop').onclick = () => { shopPanel.classList.toggle('hidden'); socialMenu.classList.add('hidden'); emoteMenu.classList.add('hidden'); pmPanel.classList.add('hidden'); };
    $('#btn-close-shop').onclick = () => shopPanel.classList.add('hidden');
    $('#btn-close-pm').onclick = () => pmPanel.classList.add('hidden');
    $('#btn-send-pm').onclick = () => {
      const msg = $('#pm-input').value.trim();
      if (!msg || !state.targetId) return;
      state.socket.emit('pm', { toId: state.targetId, msg });
      $('#pm-input').value = '';
    };
    $('#btn-send').onclick = sendChat;
    $('#btn-private').onclick = () => privatePanel.classList.toggle('hidden');
    $('#btn-close-private').onclick = () => privatePanel.classList.add('hidden');
    $('#btn-create-private').onclick = () => state.socket.emit('createPrivate');
    $('#btn-join-private').onclick = () => { const code = $('#private-code').value.trim(); if (code) state.socket.emit('joinPrivate', { room: code }); };
    $('#btn-accept-motel').onclick = () => {
      if (state.motelFrom) state.socket.emit('acceptMotel', { fromId: state.motelFrom });
      motelModal.classList.add('hidden');
    };
    $('#btn-decline-motel').onclick = () => { motelModal.classList.add('hidden'); state.motelFrom = null; };

    document.querySelectorAll('.emote-item').forEach(btn => {
      btn.onclick = () => { state.socket.emit('emote', { emote: btn.dataset.emote }); state.emotes[state.myId] = { emote: btn.dataset.emote, until: Date.now()+3000 }; emoteMenu.classList.add('hidden'); };
    });
    document.querySelectorAll('.social-item').forEach(btn => {
      btn.onclick = () => {
        const type = btn.dataset.type;
        if (type === 'invite-bath') { state.socket.emit('inviteBot', { action: 'bath' }); socialMenu.classList.add('hidden'); return; }
        if (type === 'invite-sauna') { state.socket.emit('inviteBot', { action: 'sauna' }); socialMenu.classList.add('hidden'); return; }
        if (type === 'motel') {
          if (!state.targetId) { addChatLog('Hệ thống', 'Chọn người chơi trước', true); return; }
          state.socket.emit('inviteMotel', { toId: state.targetId });
          socialMenu.classList.add('hidden');
          return;
        }
        state.socket.emit('social', { type, targetId: state.targetId });
        state.actions[state.myId] = { type, until: Date.now()+2500 };
        socialMenu.classList.add('hidden');
      };
    });
    document.querySelectorAll('.shop-item').forEach(btn => {
      btn.onclick = () => state.socket.emit('buy', { item: btn.dataset.item });
    });

    canvas.addEventListener('click', e => {
      const scale = Math.min(window.innerWidth/state.bounds.w, window.innerHeight/state.bounds.h)*0.95;
      const ox = (window.innerWidth - state.bounds.w*scale)/2;
      const oy = (window.innerHeight - state.bounds.h*scale)/2 + 20;
      const mx = (e.clientX-ox)/scale, my = (e.clientY-oy)/scale;
      let nearest = null, minD = 50;
      Object.values(state.players).forEach(p => {
        if (p.id === state.myId) return;
        const d = Math.hypot(p.renderX-mx, p.renderY-my);
        if (d < minD) { minD = d; nearest = p.id; }
      });
      state.targetId = nearest;
    });
  }

  function openChat() { state.chatOpen=true; chatBar.classList.remove('hidden'); chatInput.value=''; setTimeout(()=>chatInput.focus(),40); }
  function closeChat() { state.chatOpen=false; chatBar.classList.add('hidden'); chatInput.blur(); }
  function sendChat() { const msg=chatInput.value.trim(); if(msg) state.socket.emit('chat',{msg}); closeChat(); }
  function doAttack() { if(!state.targetId){addChatLog('Hệ thống','Chọn mục tiêu rồi ấn ⚔️',true);return;} state.socket.emit('attack',{targetId:state.targetId}); }

  function resizeCanvas() {
    canvas.width = window.innerWidth*devicePixelRatio; canvas.height = window.innerHeight*devicePixelRatio;
    canvas.style.width = window.innerWidth+'px'; canvas.style.height = window.innerHeight+'px';
    ctx.setTransform(devicePixelRatio,0,0,devicePixelRatio,0,0);
  }

  function roundRect(x,y,w,h,r,color) {
    ctx.fillStyle=color; ctx.beginPath();
    ctx.moveTo(x+r,y); ctx.arcTo(x+w,y,x+w,y+h,r); ctx.arcTo(x+w,y+h,x,y+h,r);
    ctx.arcTo(x,y+h,x,y,r); ctx.arcTo(x,y,x+w,y,r); ctx.closePath(); ctx.fill();
  }

  function drawRoom() {
    const w=window.innerWidth, h=window.innerHeight, room=state.room;
    let floor='#3d2b1f', wall='#1a120c';
    if (room==='sauna-steam'||room==='sauna-dry'){floor='#5c4033';wall='#2a1a12';}
    else if(room==='jacuzzi'||room==='bath'){floor='#1a3a4a';wall='#0d2030';}
    else if(room==='dark-room'){floor='#12121f';wall='#080810';}
    else if(room==='lounge'){floor='#2a1a3a';wall='#150a20';}
    else if(room==='arena'){floor='#2a2a2a';wall='#151515';}
    else if(room==='motel'||room.startsWith('motel_')||room.startsWith('private_')){floor='#2a1520';wall='#150a12';}
    else if(room==='lobby'){floor='#4a3528';wall='#2a1c14';}

    // gradient wall
    const g = ctx.createLinearGradient(0,0,0,h);
    g.addColorStop(0, wall); g.addColorStop(1, '#0a0a12');
    ctx.fillStyle = g; ctx.fillRect(0,0,w,h);

    const scale = Math.min(w/state.bounds.w, h/state.bounds.h)*0.95;
    const ox = (w-state.bounds.w*scale)/2, oy = (h-state.bounds.h*scale)/2+20;
    ctx.save(); ctx.translate(ox,oy); ctx.scale(scale,scale);

    // floor with subtle pattern
    ctx.fillStyle = floor; ctx.fillRect(0,0,state.bounds.w,state.bounds.h);
    ctx.strokeStyle = 'rgba(255,255,255,0.04)'; ctx.lineWidth=1;
    for(let x=0;x<state.bounds.w;x+=40){ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x,state.bounds.h);ctx.stroke();}
    for(let y=0;y<state.bounds.h;y+=40){ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(state.bounds.w,y);ctx.stroke();}

    // furniture
    if (room==='lobby') {
      roundRect(80,120,200,70,10,'#6b4c3a');
      roundRect(90,110,30,25,6,'#5a3c2a'); roundRect(240,110,30,25,6,'#5a3c2a');
      roundRect(150,220,100,55,8,'#4a3728');
      ctx.fillStyle='#2ecc71'; ctx.beginPath(); ctx.arc(360,150,22,0,Math.PI*2); ctx.fill();
      ctx.fillStyle='#8b5a2b'; ctx.fillRect(352,168,16,30);
      // TV
      roundRect(520,70,140,85,6,'#111'); roundRect(530,80,120,65,4,'#3a7abd');
      // lễ tân
      roundRect(720,90,180,55,8,'#5a4a3a');
      ctx.fillStyle='#f1c40f'; ctx.font='bold 16px Nunito'; ctx.textAlign='center';
      ctx.fillText('🛒 LỄ TÂN', 810, 125);
    }
    if (room==='sauna-steam'||room==='sauna-dry') {
      for(let i=0;i<3;i++) roundRect(80+i*25,140+i*55,220,35,6,'#8b5a2b');
    }
    if (room==='jacuzzi'||room==='bath') {
      ctx.fillStyle='#2a7a9a';
      ctx.beginPath(); ctx.ellipse(state.bounds.w/2, state.bounds.h/2, 200, 130, 0, 0, Math.PI*2); ctx.fill();
      ctx.strokeStyle='#1a5a7a'; ctx.lineWidth=10; ctx.stroke();
      // bubbles
      ctx.fillStyle='rgba(200,240,255,0.35)';
      for(let i=0;i<12;i++){ ctx.beginPath(); ctx.arc(state.bounds.w/2+(Math.random()-0.5)*300, state.bounds.h/2+(Math.random()-0.5)*100, 3+Math.random()*6, 0, Math.PI*2); ctx.fill(); }
    }
    if (room==='dark-room'||room.startsWith('private_')||room.startsWith('motel_')||room==='motel') {
      roundRect(100,160,160,80,10,'#3a2040');
      roundRect(380,220,160,80,10,'#3a2040');
      // soft glow
      ctx.fillStyle='rgba(255,80,150,0.08)'; ctx.beginPath(); ctx.arc(state.bounds.w/2, state.bounds.h/2, 180, 0, Math.PI*2); ctx.fill();
    }
    if (room==='changing') { for(let i=0;i<5;i++) roundRect(70+i*75,90,60,130,6,'#3a3a5a'); }
    if (room==='arena') {
      ctx.strokeStyle='rgba(255,60,60,0.5)'; ctx.lineWidth=5;
      ctx.strokeRect(80,80,state.bounds.w-160,state.bounds.h-160);
    }
    if (room==='lounge') {
      roundRect(100,150,180,70,10,'#5a3a6a');
      roundRect(400,200,180,70,10,'#5a3a6a');
      roundRect(250,320,120,50,8,'#3a2a4a');
    }

    ctx.restore();
    return { scale, ox, oy };
  }

  function drawPlayer(p, isMe) {
    const a = p.avatar || state.avatar, x = p.renderX, y = p.renderY, sitting = p.sitting;
    const st = p.state || (isMe ? state.myState : 'normal');
    const role = p.role || (p.isBot ? 'bot' : 'top');
    ctx.save(); ctx.translate(x, y);

    // soft shadow
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.beginPath(); ctx.ellipse(0, 10, 14, 6, 0, 0, Math.PI*2); ctx.fill();

    const by = sitting ? 5 : 0;
    const isTowel = st === 'towel' || st === 'underwear';

    // legs
    if (!sitting) {
      ctx.fillStyle = isTowel ? (a.towelColor || '#ff6b9d') : (a.bottomColor || '#2a5caa');
      if (isTowel) { ctx.fillRect(-10, 5, 20, 12); }
      else { ctx.fillRect(-9, 7, 8, 14); ctx.fillRect(1, 7, 8, 14); }
    } else {
      ctx.fillStyle = isTowel ? (a.towelColor || '#ff6b9d') : (a.bottomColor || '#2a5caa');
      ctx.fillRect(-12, 9, 24, 10);
    }

    // body
    ctx.fillStyle = isTowel ? (a.towelColor || a.topColor || '#fff') : (a.top === 'towel' ? (a.towelColor||a.topColor) : (a.topColor||'#fff'));
    roundRect(-11, by-12, 22, 20, 4, ctx.fillStyle);

    // head
    ctx.fillStyle = a.skin || '#f5c9a0';
    ctx.beginPath(); ctx.arc(0, by-20, 11, 0, Math.PI*2); ctx.fill();
    // blush
    ctx.fillStyle = 'rgba(255,150,150,0.35)';
    ctx.beginPath(); ctx.arc(-6, by-18, 3, 0, Math.PI*2); ctx.arc(6, by-18, 3, 0, Math.PI*2); ctx.fill();

    // hair
    if (a.hair !== 'bald') {
      ctx.fillStyle = a.hairColor || '#3d2b1f';
      ctx.beginPath();
      if (a.hair === 'long') { ctx.ellipse(0, by-22, 12, 9, 0, 0, Math.PI*2); }
      else if (a.hair === 'curly') {
        ctx.arc(-6, by-24, 5.5, 0, Math.PI*2); ctx.arc(6, by-24, 5.5, 0, Math.PI*2); ctx.arc(0, by-26, 5.5, 0, Math.PI*2);
      } else if (a.hair === 'ponytail') {
        ctx.ellipse(0, by-24, 10, 7, 0, 0, Math.PI*2);
        ctx.fillRect(8, by-22, 6, 14);
      } else { ctx.ellipse(0, by-24, 10, 7, 0, 0, Math.PI*2); }
      ctx.fill();
    }

    // eyes
    ctx.fillStyle = '#1a1a1a';
    ctx.beginPath(); ctx.arc(-4, by-20, 1.8, 0, Math.PI*2); ctx.arc(4, by-20, 1.8, 0, Math.PI*2); ctx.fill();
    // eye shine
    ctx.fillStyle = '#fff';
    ctx.beginPath(); ctx.arc(-3.3, by-20.5, 0.7, 0, Math.PI*2); ctx.arc(4.7, by-20.5, 0.7, 0, Math.PI*2); ctx.fill();

    // target ring
    if (p.id === state.targetId) {
      ctx.strokeStyle = '#ff6b9d'; ctx.lineWidth = 2.5;
      ctx.beginPath(); ctx.arc(0, by-4, 24, 0, Math.PI*2); ctx.stroke();
    }

    // name
    const nameColor = role === 'bot' ? '#ff6b9d' : '#4a90d9';
    ctx.font = 'bold 12px Nunito, sans-serif'; ctx.textAlign = 'center';
    ctx.strokeStyle = 'rgba(0,0,0,0.75)'; ctx.lineWidth = 3;
    const displayName = (p.isBot ? '🤖 ' : '') + (p.nickname || '');
    ctx.strokeText(displayName, 0, by-38); ctx.fillStyle = nameColor; ctx.fillText(displayName, 0, by-38);

    // hp
    if (p.hp !== undefined && p.hp < p.maxHp) {
      ctx.fillStyle = 'rgba(0,0,0,0.55)'; ctx.fillRect(-16, by-46, 32, 5);
      ctx.fillStyle = p.hp > 40 ? '#2ecc71' : '#e74c3c'; ctx.fillRect(-16, by-46, 32*(p.hp/p.maxHp), 5);
    }

    // bubble
    const bub = state.bubbles[p.id];
    if (bub && bub.until > Date.now()) {
      const text = bub.msg; ctx.font = '12px Nunito,sans-serif';
      const tw = Math.min(ctx.measureText(text).width + 18, 170);
      const bx = -tw/2, by2 = by-62;
      roundRect(bx, by2, tw, 24, 10, 'rgba(255,255,255,0.96)');
      ctx.beginPath(); ctx.moveTo(-5, by2+24); ctx.lineTo(0, by2+31); ctx.lineTo(5, by2+24); ctx.fill();
      ctx.fillStyle = '#222'; ctx.textAlign = 'center';
      let display = text; while (ctx.measureText(display).width > tw-14 && display.length > 3) display = display.slice(0,-2)+'…';
      ctx.fillText(display, 0, by2+16);
    }

    const em = state.emotes[p.id];
    if (em && em.until > Date.now()) { ctx.font = '24px serif'; ctx.textAlign='center'; ctx.fillText(em.emote, 20, by-30); }
    const act = state.actions[p.id];
    if (act && act.until > Date.now()) {
      const icons = { hug:'🤗',kiss:'😘',sleep:'😴',pat:'🤚',highfive:'🙏',dance:'💃',wave:'👋',attack:'💥',motel:'🏨' };
      ctx.font = '22px serif'; ctx.textAlign='center'; ctx.fillText(icons[act.type]||'✨', -20, by-30);
    }
    if (p.dmgText && p.dmgText.until > Date.now()) {
      p.dmgText.y -= 0.9; ctx.fillStyle='#e74c3c'; ctx.font='bold 15px Nunito';
      ctx.fillText(p.dmgText.val, 0, by-52 + p.dmgText.y);
    }
    ctx.restore();
  }

  let lastTime = performance.now();
  function loop(now) {
    const dt = Math.min((now-lastTime)/16.67, 2.5); lastTime = now;
    const me = state.players[state.myId];
    if (me && !state.chatOpen) {
      let dx=0, dy=0;
      if (state.keys['w']||state.keys['arrowup']) dy-=1;
      if (state.keys['s']||state.keys['arrowdown']) dy+=1;
      if (state.keys['a']||state.keys['arrowleft']) dx-=1;
      if (state.keys['d']||state.keys['arrowright']) dx+=1;
      if (state.joy.active) { dx+=state.joy.dx; dy+=state.joy.dy; }
      const len = Math.sqrt(dx*dx+dy*dy);
      if (len > 0.1) {
        dx/=len; dy/=len;
        me.x += dx*state.speed*dt; me.y += dy*state.speed*dt;
        me.x = Math.max(25, Math.min(state.bounds.w-25, me.x));
        me.y = Math.max(45, Math.min(state.bounds.h-25, me.y));
        me.tx=me.x; me.ty=me.y; me.renderX=me.x; me.renderY=me.y;
        me.dir = Math.abs(dx)>Math.abs(dy) ? (dx>0?'right':'left') : (dy>0?'down':'up');
        if (now - state.lastMoveSend > 40) {
          state.socket.emit('move', { x: me.x, y: me.y, dir: me.dir, sitting: me.sitting });
          state.lastMoveSend = now;
        }
      }
    }
    Object.values(state.players).forEach(p => {
      if (p.id === state.myId) return;
      p.renderX += (p.tx - p.renderX)*0.28*dt;
      p.renderY += (p.ty - p.renderY)*0.28*dt;
    });
    const { scale, ox, oy } = drawRoom();
    const sorted = Object.values(state.players).sort((a,b)=>a.renderY-b.renderY);
    ctx.save(); ctx.translate(ox,oy); ctx.scale(scale,scale);
    sorted.forEach(p => drawPlayer(p, p.id===state.myId));
    ctx.restore();
    requestAnimationFrame(loop);
  }
})();
