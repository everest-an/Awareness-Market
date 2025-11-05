import { create } from 'kubo-rpc-client';

/**
 * IPFS Storage Service
 * Provides distributed file storage for paid users
 */

// IPFS node configuration
// You can use:
// 1. Local IPFS node: http://127.0.0.1:5001
// 2. Infura IPFS: https://ipfs.infura.io:5001
// 3. Pinata: https://api.pinata.cloud
const IPFS_API_URL = process.env.IPFS_API_URL || 'https://ipfs.infura.io:5001';
const IPFS_PROJECT_ID = process.env.IPFS_PROJECT_ID || '';
const IPFS_PROJECT_SECRET = process.env.IPFS_PROJECT_SECRET || '';

// Create IPFS client
let ipfsClient: ReturnType<typeof create> | null = null;

function getIPFSClient() {
  if (!ipfsClient) {
    const auth = IPFS_PROJECT_ID && IPFS_PROJECT_SECRET
      ? 'Basic ' + Buffer.from(IPFS_PROJECT_ID + ':' + IPFS_PROJECT_SECRET).toString('base64')
      : undefined;

    ipfsClient = create({
      url: IPFS_API_URL,
      headers: auth ? { authorization: auth } : undefined,
    });
  }
  return ipfsClient;
}

/**
 * Upload file to IPFS
 * @param buffer File buffer
 * @param fileName Original file name
 * @returns IPFS CID and gateway URL
 */
export async function uploadToIPFS(buffer: Buffer, fileName: string): Promise<{
  cid: string;
  url: string;
  size: number;
}> {
  try {
    const client = getIPFSClient();
    
    // Add file to IPFS
    const result = await client.add({
      path: fileName,
      content: buffer,
    });

    const cid = result.cid.toString();
    const url = `https://ipfs.io/ipfs/${cid}`;

    return {
      cid,
      url,
      size: result.size,
    };
  } catch (error) {
    console.error('Failed to upload to IPFS:', error);
    throw new Error('IPFS upload failed');
  }
}

/**
 * Pin file to IPFS (ensure it stays available)
 * @param cid IPFS CID
 */
export async function pinToIPFS(cid: string): Promise<void> {
  try {
    const client = getIPFSClient();
    await client.pin.add(cid);
  } catch (error) {
    console.error('Failed to pin to IPFS:', error);
    throw new Error('IPFS pin failed');
  }
}

/**
 * Unpin file from IPFS
 * @param cid IPFS CID
 */
export async function unpinFromIPFS(cid: string): Promise<void> {
  try {
    const client = getIPFSClient();
    await client.pin.rm(cid);
  } catch (error) {
    console.error('Failed to unpin from IPFS:', error);
    throw new Error('IPFS unpin failed');
  }
}

/**
 * Get file from IPFS
 * @param cid IPFS CID
 * @returns File buffer
 */
export async function getFromIPFS(cid: string): Promise<Buffer> {
  try {
    const client = getIPFSClient();
    const chunks: Uint8Array[] = [];

    for await (const chunk of client.cat(cid)) {
      chunks.push(chunk);
    }

    return Buffer.concat(chunks);
  } catch (error) {
    console.error('Failed to get from IPFS:', error);
    throw new Error('IPFS retrieval failed');
  }
}

/**
 * Check if IPFS service is available
 */
export async function checkIPFSHealth(): Promise<boolean> {
  try {
    const client = getIPFSClient();
    const version = await client.version();
    return !!version;
  } catch (error) {
    console.error('IPFS health check failed:', error);
    return false;
  }
}
