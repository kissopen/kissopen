/*
The relay data core, shared by every Kissopen client.

What belongs here: the shape of what the relay carries, the reduction of a
message stream into a conversation, and the end-to-end encryption around both.
Every client has to agree on these exactly — two devices that reduce the same
stream differently show the same person two different conversations, and that
is the kind of disagreement nobody can see until it has already happened.

What does not belong here: connecting, storing, and anything with an opinion
about a screen. Those differ per client and are better written twice than
bent into one shape.

Nothing here reaches a native module directly. The three or four primitives a
runtime has to supply come through `./platform`, installed once at startup.
*/

export * from './platform';

// What the relay carries.
export * from './apiTypes';
export * from './typesRaw';
export * from './storageTypes';
export * from './typesMessage';
export * from './typesMessageMeta';
export * from './artifactTypes';
export * from './feedTypes';
export * from './friendTypes';
export * from './profile';
export * from './projectTypes';
export * from './projectRecord';
export * from './rig';
export * from './blob';
export * from './imageFiles';
export * from './agentGit';
export * from './sessionAvatarTypes';

// Turning that stream into a conversation.
export * from './reducer/reducer';
export * from './reducer/messageToEvent';
export * from './reducer/reducerTracer';
export * from './reducer/activityUpdateAccumulator';

// Segmenting a stream into turns, which every client draws from.
export * from './turns/agentTurns';
export * from './turns/agentTurnCopy';

// Keeping it readable only by the account that owns it.
export * from './encryption/encryption';
export * from './encryption/encryptor';
export * from './encryption/encryptionCache';
export * from './encryption/sessionEncryption';
export * from './encryption/machineEncryption';
export * from './encryption/artifactEncryption';

// The primitives underneath, for clients that need them directly.
export * from './crypto/base64';
export * from './crypto/hex';
export * from './crypto/text';
export * from './crypto/aes';
export * from './crypto/libsodium';
export * from './crypto/deriveKey';
export * from './crypto/hmac_sha512';
