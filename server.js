const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: '*' },
  pingTimeout: 60000,
  pingInterval: 25000,
  maxHttpBufferSize: 1e5
});

const PORT = process.env.PORT || 3000;
const HOST = '0.0.0.0';

app.use(express.static(path.join(__dirname, 'public')));
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok', players: Object.keys(players).length });
});

const players = {};
const roomPlayers = {};
const privateRooms = {};
const chatRate = {};
const moveRate = {};
const actionRate = {};
const bots = {};

const PUBLIC_ROOMS = [
  { id: 'lobby', name: 'Sảnh Chính', max: 50 },
  { id: 'sauna-steam', name: 'Xông Hơi Nước', max: 25 },
  { id: 'sauna-dry', name: 'Xông Khô', max: 25 },
  { id: 'jacuzzi', name: 'Jacuzzi', max: 20 },
  { id: 'dark-room', name: 'Phòng Tối', max: 20 },
  { id: 'lounge', name: 'Lounge', max: 30 },
  { id: 'changing', name: 'Thay Đồ', max: 15 },
  { id: 'bath', name: 'Phòng Tắm', max: 15 },
  { id: 'arena', name: 'Khu Đấu', max: 30 },
  { id: 'motel', name: 'Nhà Nghỉ', max: 20 }
];

const ROOM_BOUNDS = {
  lobby: { w: 1400, h: 900 },
  'sauna-steam': { w: 900, h: 650 },
  'sauna-dry': { w: 850, h: 600 },
  jacuzzi: { w: 900, h: 700 },
  'dark-room': { w: 1000, h: 700 },
  lounge: { w: 1100, h: 750 },
  changing: { w: 700, h: 550 },
  bath: { w: 800, h: 600 },
  arena: { w: 1200, h: 800 },
  motel: { w: 700, h: 550 }
};

const TOWEL_ROOMS = new Set(['jacuzzi', 'sauna-steam', 'sauna-dry', 'bath', 'dark-room', 'motel']);

const SHOP_ITEMS = {
  ticket: { name: 'Vé vào cửa', price: 150000 },
  popper: { name: 'Popper Gel', price: 80000 },
  bcs: { name: 'BCS', price: 30000 }
};

const BOT_CHAT = [
  'bú sục 50k mại dô mại dô',
  'anh ơi cần thư giãn không ạ~',
  '50k một lần nha anh',
  'đi tắm cùng em không~',
  'xông hơi thư giãn đi anh',
  'em đợi anh ở đây nè',
  'mại dô mại dô 50k',
  'muốn đi jacuzzi cùng em không?',
  'đi nhà nghỉ không anh~'
];

function sanitize(str, max = 100) {
  if (typeof str !== 'string') return '';
  return str.replace(/[<>&"'`]/g, '').trim().slice(0, max);
}
function isValidNick(n) { n = (n || '').trim(); return n.length >= 1 && n.length <= 16; }
function getRoomCount(room) { return roomPlayers[room] ? roomPlayers[room].size : 0; }
function getRoomInfo(room) {
  const def = PUBLIC_ROOMS.find(r => r.id === room);
  return { id: room, name: def ? def.name : room, count: getRoomCount(room), max: def ? def.max : 20 };
}
function ensureRoom(room) { if (!roomPlayers[room]) roomPlayers[room] = new Set(); }
function broadcastRoom(room, event, data, exclude = null) {
  const set = roomPlayers[room];
  if (!set) return;
  set.forEach(sid => { if (sid !== exclude) io.to(sid).emit(event, data); });
}
function publicPlayer(p) {
  if (!p) return null;
  return {
    id: p.id, nickname: p.nickname, avatar: p.avatar, role: p.role || 'top',
    x: p.x, y: p.y, dir: p.dir, room: p.room, sitting: p.sitting,
    hp: p.hp, maxHp: p.maxHp, state: p.state, isBot: !!p.isBot
  };
}
function defaultAvatar() {
  return { skin: '#f5c9a0', hair: 'short', hairColor: '#3d2b1f', top: 'towel', topColor: '#fff', bottom: 'shorts', bottomColor: '#2a5caa', towelColor: '#ff6b9d' };
}

function createBot(room) {
  const names = ['Miu','Baby','Cherry','Luna','Soft','Honey','Kitty','Angel','Sugar','Pinky'];
  const name = names[Math.floor(Math.random()*names.length)] + (Math.floor(Math.random()*90)+10);
  const bounds = ROOM_BOUNDS[room] || { w: 800, h: 600 };
  bots[room] = {
    id: 'bot_' + room, nickname: name, role: 'bot', isBot: true,
    avatar: {
      skin: ['#f5c9a0','#e8b88a','#fde8d0'][Math.floor(Math.random()*3)],
      hair: ['long','ponytail','curly','short'][Math.floor(Math.random()*4)],
      hairColor: ['#3d2b1f','#ff6b9d','#1a1a1a','#c9a227'][Math.floor(Math.random()*4)],
      top: 'towel', topColor: '#ff6b9d', bottom: 'towel', bottomColor: '#ff6b9d', towelColor: '#ff6b9d'
    },
    x: 100 + Math.random() * (bounds.w - 200),
    y: 100 + Math.random() * (bounds.h - 200),
    dir: 'down', room, sitting: false, hp: 100, maxHp: 100,
    state: TOWEL_ROOMS.has(room) ? 'towel' : 'normal',
    targetX: null, targetY: null, lastChat: 0
  };
  return bots[room];
}
PUBLIC_ROOMS.forEach(r => { if (!bots[r.id]) createBot(r.id); });

setInterval(() => {
  Object.keys(bots).forEach(room => {
    const bot = bots[room];
    if (!bot) return;
    const bounds = ROOM_BOUNDS[room] || { w: 800, h: 600 };
    if (!bot.targetX || Math.random() < 0.02) {
      bot.targetX = 60 + Math.random() * (bounds.w - 120);
      bot.targetY = 60 + Math.random() * (bounds.h - 120);
    }
    const dx = bot.targetX - bot.x, dy = bot.targetY - bot.y;
    const dist = Math.sqrt(dx*dx + dy*dy);
    if (dist > 5) {
      bot.x += (dx/dist)*1.2; bot.y += (dy/dist)*1.2;
      bot.dir = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : (dy > 0 ? 'down' : 'up');
    }
    if (roomPlayers[room] && roomPlayers[room].size > 0) {
      broadcastRoom(room, 'playerMoved', { id: bot.id, x: bot.x, y: bot.y, dir: bot.dir, sitting: false });
    }
    const now = Date.now();
    if (now - bot.lastChat > 12000 + Math.random()*15000) {
      bot.lastChat = now;
      if (roomPlayers[room] && roomPlayers[room].size > 0) {
        const msg = BOT_CHAT[Math.floor(Math.random()*BOT_CHAT.length)];
        io.to(room).emit('chat', { id: bot.id, nickname: bot.nickname, msg, time: now, isBot: true, role: 'bot' });
      }
    }
  });
}, 200);

io.on('connection', (socket) => {
  console.log('[+] Kết nối:', socket.id);

  socket.on('join', (data) => {
    try {
      const nickname = sanitize(data.nickname || '', 16);
      if (!isValidNick(nickname)) { socket.emit('error', { msg: 'Tên không hợp lệ (1-16 ký tự)' }); return; }
      const role = data.role === 'bot' ? 'bot' : 'top';
      const avatar = data.avatar && typeof data.avatar === 'object' ? data.avatar : defaultAvatar();
      const room = 'lobby';
      ensureRoom(room);
      players[socket.id] = {
        id: socket.id, nickname, role, avatar,
        x: 250 + Math.random()*150, y: 350 + Math.random()*100, dir: 'down',
        room, sitting: false, hp: 100, maxHp: 100, state: 'normal',
        money: 500000, inventory: { ticket: 0, popper: 0, bcs: 0 },
        privateRoom: null, isBot: false
      };
      roomPlayers[room].add(socket.id);
      socket.join(room);
      const list = [...roomPlayers[room]].map(id => publicPlayer(players[id])).filter(Boolean);
      if (bots[room]) list.push(publicPlayer(bots[room]));
      socket.emit('joined', {
        id: socket.id, room, bounds: ROOM_BOUNDS[room], players: list,
        rooms: PUBLIC_ROOMS.map(r => getRoomInfo(r.id)),
        money: players[socket.id].money, inventory: players[socket.id].inventory, role
      });
      socket.to(room).emit('playerJoined', publicPlayer(players[socket.id]));
      io.emit('onlineCount', Object.keys(players).length);
    } catch (e) {
      console.error(e);
      socket.emit('error', { msg: 'Lỗi khi vào game' });
    }
  });

  socket.on('move', (data) => {
    const p = players[socket.id];
    if (!p) return;
    const now = Date.now();
    if (!moveRate[socket.id]) moveRate[socket.id] = 0;
    if (now - moveRate[socket.id] < 28) return;
    moveRate[socket.id] = now;
    const bounds = ROOM_BOUNDS[p.room] || { w: 1000, h: 700 };
    let x = Number(data.x), y = Number(data.y);
    if (isNaN(x) || isNaN(y)) return;
    x = Math.max(25, Math.min(bounds.w - 25, x));
    y = Math.max(45, Math.min(bounds.h - 25, y));
    const dx = x - p.x, dy = y - p.y, dist = Math.sqrt(dx*dx+dy*dy);
    if (dist > 90) { x = p.x + (dx/dist)*45; y = p.y + (dy/dist)*45; }
    p.x = x; p.y = y;
    if (['up','down','left','right'].includes(data.dir)) p.dir = data.dir;
    if (data.sitting !== undefined) p.sitting = !!data.sitting;
    broadcastRoom(p.room, 'playerMoved', { id: socket.id, x: p.x, y: p.y, dir: p.dir, sitting: p.sitting }, socket.id);
  });

  socket.on('chat', (data) => {
    const p = players[socket.id];
    if (!p) return;
    const now = Date.now();
    if (!chatRate[socket.id]) chatRate[socket.id] = { c: 0, t: now };
    if (now - chatRate[socket.id].t > 4000) chatRate[socket.id] = { c: 0, t: now };
    chatRate[socket.id].c++;
    if (chatRate[socket.id].c > 6) { socket.emit('error', { msg: 'Chat quá nhanh!' }); return; }
    let msg = sanitize(data.msg || '', 100);
    if (!msg) return;
    io.to(p.room).emit('chat', { id: socket.id, nickname: p.nickname, msg, time: now, role: p.role });
  });

  // Chat riêng (PM)
  socket.on('pm', (data) => {
    const p = players[socket.id];
    if (!p) return;
    const toId = data.toId;
    const msg = sanitize(data.msg || '', 120);
    if (!msg || !toId) return;
    const target = players[toId];
    if (!target) { socket.emit('error', { msg: 'Người chơi không online' }); return; }
    const payload = { from: socket.id, fromName: p.nickname, fromRole: p.role, to: toId, msg, time: Date.now() };
    io.to(toId).emit('pm', payload);
    socket.emit('pm', payload); // echo cho người gửi
  });

  socket.on('emote', (data) => {
    const p = players[socket.id];
    if (!p) return;
    broadcastRoom(p.room, 'playerEmote', { id: socket.id, emote: sanitize(data.emote || '', 8) });
  });

  socket.on('social', (data) => {
    const p = players[socket.id];
    if (!p) return;
    const now = Date.now();
    if (!actionRate[socket.id]) actionRate[socket.id] = 0;
    if (now - actionRate[socket.id] < 800) return;
    actionRate[socket.id] = now;
    const type = sanitize(data.type || '', 20);
    const allowed = ['hug','kiss','sleep','wave','highfive','dance','pat','motel'];
    if (!allowed.includes(type)) return;
    io.to(p.room).emit('social', { from: socket.id, to: data.targetId || null, type, nickname: p.nickname });
  });

  // Rủ đi nhà nghỉ
  socket.on('inviteMotel', (data) => {
    const p = players[socket.id];
    if (!p) return;
    const toId = data.toId;
    const target = players[toId];
    if (!target) { socket.emit('error', { msg: 'Người chơi không online' }); return; }
    io.to(toId).emit('motelInvite', {
      from: socket.id,
      fromName: p.nickname,
      fromRole: p.role
    });
    socket.emit('error', { msg: 'Đã gửi lời mời nhà nghỉ tới ' + target.nickname });
  });

  socket.on('acceptMotel', (data) => {
    const p = players[socket.id];
    if (!p) return;
    const fromId = data.fromId;
    const other = players[fromId];
    if (!other) return;

    // Tạo phòng riêng motel
    const id = 'motel_' + socket.id.slice(0, 6) + '_' + fromId.slice(0, 6);
    privateRooms[id] = { owner: fromId, guest: socket.id };

    // Cả 2 rời phòng cũ
    [p, other].forEach(pl => {
      if (roomPlayers[pl.room]) roomPlayers[pl.room].delete(pl.id);
      const s = io.sockets.sockets.get(pl.id);
      if (s) { s.leave(pl.room); broadcastRoom(pl.room, 'playerLeft', { id: pl.id }); }
      pl.room = id;
      pl.privateRoom = id;
      pl.state = 'towel';
      pl.sitting = false;
    });

    ensureRoom(id);
    roomPlayers[id].add(socket.id);
    roomPlayers[id].add(fromId);
    const s1 = io.sockets.sockets.get(socket.id);
    const s2 = io.sockets.sockets.get(fromId);
    if (s1) s1.join(id);
    if (s2) s2.join(id);

    p.x = 200; p.y = 280;
    other.x = 400; other.y = 280;

    const list = [publicPlayer(p), publicPlayer(other)];
    const payload = {
      room: id,
      bounds: { w: 700, h: 550 },
      players: list,
      state: 'towel'
    };
    if (s1) s1.emit('roomChanged', { ...payload, x: p.x, y: p.y, rooms: PUBLIC_ROOMS.map(r => getRoomInfo(r.id)) });
    if (s2) s2.emit('roomChanged', { ...payload, x: other.x, y: other.y, rooms: PUBLIC_ROOMS.map(r => getRoomInfo(r.id)) });
  });

  socket.on('attack', (data) => {
    const p = players[socket.id];
    if (!p) return;
    const now = Date.now();
    if (!actionRate[socket.id]) actionRate[socket.id] = 0;
    if (now - actionRate[socket.id] < 600) return;
    actionRate[socket.id] = now;
    let target = players[data.targetId];
    if (!target && bots[p.room] && bots[p.room].id === data.targetId) target = bots[p.room];
    if (!target) return;
    const dx = p.x - target.x, dy = p.y - target.y;
    if (Math.sqrt(dx*dx+dy*dy) > 80) { socket.emit('error', { msg: 'Đứng gần hơn!' }); return; }
    const dmg = 8 + Math.floor(Math.random()*10);
    target.hp = Math.max(0, target.hp - dmg);
    io.to(p.room).emit('combat', { attacker: socket.id, target: data.targetId, damage: dmg, hp: target.hp, maxHp: target.maxHp });
    if (target.hp <= 0) {
      target.hp = target.maxHp;
      io.to(p.room).emit('chat', { id: 'system', nickname: 'Hệ thống', msg: target.nickname + ' bị hạ gục và hồi phục!', time: now });
    }
  });

  socket.on('buy', (data) => {
    const p = players[socket.id];
    if (!p) return;
    const item = sanitize(data.item || '', 20);
    const shop = SHOP_ITEMS[item];
    if (!shop) return;
    if (p.money < shop.price) { socket.emit('error', { msg: 'Không đủ tiền!' }); return; }
    p.money -= shop.price;
    p.inventory[item] = (p.inventory[item] || 0) + 1;
    socket.emit('bought', { item, money: p.money, inventory: p.inventory, name: shop.name });
  });

  socket.on('inviteBot', (data) => {
    const p = players[socket.id];
    if (!p) return;
    const bot = bots[p.room];
    if (!bot) { socket.emit('error', { msg: 'Không có bot trong phòng' }); return; }
    const dx = p.x - bot.x, dy = p.y - bot.y;
    if (Math.sqrt(dx*dx+dy*dy) > 120) { socket.emit('error', { msg: 'Đến gần bot hơn!' }); return; }
    bot.targetX = p.x + 30; bot.targetY = p.y;
    const action = sanitize(data.action || '', 20);
    const msg = action === 'bath' ? 'đi tắm cùng anh nha~' : action === 'sauna' ? 'đi xông hơi với anh nè~' : 'đi theo anh nha~';
    io.to(p.room).emit('chat', { id: bot.id, nickname: bot.nickname, msg, time: Date.now(), isBot: true, role: 'bot' });
  });

  socket.on('changeRoom', (data) => {
    const p = players[socket.id];
    if (!p) return;
    const newRoom = sanitize(data.room || '', 30);
    const def = PUBLIC_ROOMS.find(r => r.id === newRoom);
    if (!def) { socket.emit('error', { msg: 'Phòng không tồn tại' }); return; }
    if (p.room === newRoom) return;
    const old = p.room;
    if (roomPlayers[old]) roomPlayers[old].delete(socket.id);
    socket.leave(old);
    broadcastRoom(old, 'playerLeft', { id: socket.id });
    p.room = newRoom; p.privateRoom = null; p.sitting = false;
    ensureRoom(newRoom);
    roomPlayers[newRoom].add(socket.id);
    socket.join(newRoom);
    p.state = TOWEL_ROOMS.has(newRoom) ? 'towel' : 'normal';
    const bounds = ROOM_BOUNDS[newRoom];
    p.x = 70 + Math.random()*80;
    p.y = bounds.h/2 + (Math.random()-0.5)*100;
    p.dir = 'right';
    const list = [...roomPlayers[newRoom]].map(id => publicPlayer(players[id])).filter(Boolean);
    if (bots[newRoom]) list.push(publicPlayer(bots[newRoom]));
    socket.emit('roomChanged', {
      room: newRoom, bounds, players: list, x: p.x, y: p.y, state: p.state,
      rooms: PUBLIC_ROOMS.map(r => getRoomInfo(r.id))
    });
    socket.to(newRoom).emit('playerJoined', publicPlayer(p));
  });

  socket.on('createPrivate', () => {
    const p = players[socket.id];
    if (!p) return;
    const id = 'private_' + socket.id.slice(0, 8);
    privateRooms[id] = { owner: socket.id, guest: null };
    if (roomPlayers[p.room]) roomPlayers[p.room].delete(socket.id);
    socket.leave(p.room);
    broadcastRoom(p.room, 'playerLeft', { id: socket.id });
    p.room = id; p.privateRoom = id; p.state = 'towel';
    ensureRoom(id); roomPlayers[id].add(socket.id); socket.join(id);
    p.x = 200; p.y = 300;
    socket.emit('privateCreated', { room: id, bounds: { w: 600, h: 500 }, x: p.x, y: p.y, state: 'towel' });
  });

  socket.on('joinPrivate', (data) => {
    const p = players[socket.id];
    if (!p) return;
    const id = sanitize(data.room || '', 40);
    const pr = privateRooms[id];
    if (!pr) { socket.emit('error', { msg: 'Phòng không tồn tại' }); return; }
    if (pr.guest && pr.guest !== socket.id) { socket.emit('error', { msg: 'Phòng đã đủ 2 người' }); return; }
    if (roomPlayers[p.room]) roomPlayers[p.room].delete(socket.id);
    socket.leave(p.room);
    broadcastRoom(p.room, 'playerLeft', { id: socket.id });
    pr.guest = socket.id;
    p.room = id; p.privateRoom = id; p.state = 'towel';
    ensureRoom(id); roomPlayers[id].add(socket.id); socket.join(id);
    p.x = 350; p.y = 300;
    const list = [...roomPlayers[id]].map(sid => publicPlayer(players[sid])).filter(Boolean);
    socket.emit('roomChanged', {
      room: id, bounds: { w: 600, h: 500 }, players: list, x: p.x, y: p.y, state: 'towel',
      rooms: PUBLIC_ROOMS.map(r => getRoomInfo(r.id))
    });
    socket.to(id).emit('playerJoined', publicPlayer(p));
  });

  socket.on('sit', () => {
    const p = players[socket.id];
    if (!p) return;
    p.sitting = !p.sitting;
    broadcastRoom(p.room, 'playerMoved', { id: socket.id, x: p.x, y: p.y, dir: p.dir, sitting: p.sitting });
  });

  socket.on('disconnect', () => {
    const p = players[socket.id];
    if (p) {
      if (roomPlayers[p.room]) roomPlayers[p.room].delete(socket.id);
      broadcastRoom(p.room, 'playerLeft', { id: socket.id });
      if (p.privateRoom && privateRooms[p.privateRoom]) delete privateRooms[p.privateRoom];
      delete players[socket.id];
      delete chatRate[socket.id]; delete moveRate[socket.id]; delete actionRate[socket.id];
      io.emit('onlineCount', Object.keys(players).length);
    }
  });
});

server.listen(PORT, HOST, () => {
  console.log(`Sauna P8 đang chạy tại http://${HOST}:${PORT}`);
});
