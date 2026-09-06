import { randomBytes, randomUUID } from "node:crypto";

const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

function cleanText(value, maxLength, label) {
  const text = String(value || "").trim();
  if (!text) throw new Error(`${label} is required.`);
  if (text.length > maxLength) throw new Error(`${label} is too long.`);
  return text;
}

function defaultCode() {
  const bytes = randomBytes(6);
  let code = "";
  for (let i = 0; i < 6; i += 1) {
    code += CODE_ALPHABET[bytes[i] % CODE_ALPHABET.length];
  }
  return code;
}

function publicParticipant(participant) {
  return {
    id: participant.id,
    name: participant.name,
    joinedAt: participant.joinedAt,
  };
}

function publicMessage(message) {
  return {
    id: message.id,
    roomCode: message.roomCode,
    author: { ...message.author },
    statement: message.statement,
    committedAt: message.committedAt,
  };
}

export function createRoomStore({ now = () => new Date().toISOString(), makeId = randomUUID, makeCode = defaultCode } = {}) {
  const rooms = new Map();

  function requireRoom(code) {
    const normalized = String(code || "").trim().toUpperCase();
    const room = rooms.get(normalized);
    if (!room) throw new Error("Room not found.");
    return room;
  }

  function addParticipant(room, displayName) {
    const name = cleanText(displayName, 60, "Display name");
    const participant = {
      id: makeId(),
      token: makeId(),
      name,
      joinedAt: now(),
    };
    room.participants.set(participant.token, participant);
    return participant;
  }

  function snapshot(room) {
    return {
      code: room.code,
      name: room.name,
      createdAt: room.createdAt,
      participants: [...room.participants.values()].map(publicParticipant),
      messages: room.messages.map(publicMessage),
    };
  }

  function createRoom({ displayName, roomName = "" }) {
    let code;
    for (let attempt = 0; attempt < 20; attempt += 1) {
      code = makeCode().toUpperCase();
      if (!rooms.has(code)) break;
      code = undefined;
    }
    if (!code) throw new Error("Could not allocate a room code.");

    const room = {
      code,
      name: String(roomName || "").trim().slice(0, 80) || `Room ${code}`,
      createdAt: now(),
      participants: new Map(),
      messages: [],
    };
    rooms.set(code, room);
    const participant = addParticipant(room, displayName);

    return {
      room: snapshot(room),
      session: { participantId: participant.id, participantToken: participant.token },
    };
  }

  function joinRoom({ code, displayName }) {
    const room = requireRoom(code);
    const participant = addParticipant(room, displayName);
    return {
      room: snapshot(room),
      session: { participantId: participant.id, participantToken: participant.token },
    };
  }

  function authenticate(code, participantToken) {
    const room = requireRoom(code);
    const token = String(participantToken || "").trim();
    const participant = room.participants.get(token);
    if (!participant) throw new Error("Invalid room session.");
    return { room, participant };
  }

  function getSnapshot(code, participantToken) {
    const { room } = authenticate(code, participantToken);
    return snapshot(room);
  }

  function commitMessage({ code, participantToken, statement, approved }) {
    if (approved !== true) throw new Error("Speaker approval is required before commit.");
    const { room, participant } = authenticate(code, participantToken);
    const text = cleanText(statement, 20_000, "Statement");
    const message = {
      id: makeId(),
      roomCode: room.code,
      author: { id: participant.id, name: participant.name },
      statement: text,
      committedAt: now(),
    };
    room.messages.push(message);
    return publicMessage(message);
  }

  function leaveRoom({ code, participantToken }) {
    const { room, participant } = authenticate(code, participantToken);
    room.participants.delete(participantToken);
    return { participant: publicParticipant(participant), room: snapshot(room) };
  }

  return {
    createRoom,
    joinRoom,
    authenticate,
    getSnapshot,
    commitMessage,
    leaveRoom,
    _rooms: rooms,
  };
}
