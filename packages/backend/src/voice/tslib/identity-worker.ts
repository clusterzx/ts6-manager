import { workerData, parentPort } from 'worker_threads';
import { generateIdentity } from './identity.js';

const { securityLevel } = workerData as { securityLevel: number };
const identity = generateIdentity(securityLevel);

// Serialize: KeyObjects can't cross thread boundary, only send scalar data
parentPort!.postMessage({
  privateKeyBigInt: identity.privateKeyBigInt.toString(),
  keyOffset: identity.keyOffset.toString(),
  publicKeyString: identity.publicKeyString,
  uid: identity.uid,
});
