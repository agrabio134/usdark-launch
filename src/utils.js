// utils.js
import axios from 'axios';
import {
    Connection, PublicKey, SystemProgram, Transaction, LAMPORTS_PER_SOL,
    Keypair, TransactionInstruction, TransactionMessage, VersionedTransaction
} from '@solana/web3.js';
import {
    TOKEN_PROGRAM_ID,
    ASSOCIATED_TOKEN_PROGRAM_ID,
    createTransferInstruction,
    createAssociatedTokenAccountInstruction,
    getAssociatedTokenAddressSync,
    createInitializeMintInstruction,
    getMinimumBalanceForRentExemptMint,
    createMintToInstruction,
    createSetAuthorityInstruction,
    NATIVE_MINT,
    createBurnInstruction
} from '@solana/spl-token';
import BN from 'bn.js';
import { FEE_WALLET, PINATA_JWT, LAUNCH_FEE_USDARK, USDARK_DECIMALS, USDARK_MINT, USDARK_BYPASS, VIRTUAL_TOKENS_BASE, VIRTUAL_SOL_LAMPORTS } from './constants';

export const uploadToPinata = async (data, options = { pinataMetadata: { name: 'metadata' } }) => {
    const formData = new FormData();
    if (data instanceof File) {
        formData.append('file', data);
    } else {
        formData.append('file', new Blob([JSON.stringify(data)], { type: 'application/json' }), 'metadata.json');
    }
    Object.keys(options.pinataMetadata).forEach(key => {
        formData.append(`pinataMetadata[${key}]`, options.pinataMetadata[key]);
    });
    try {
        const response = await axios.post('https://api.pinata.cloud/pinning/pinFileToIPFS', formData, {
            headers: {
                'Authorization': `Bearer ${PINATA_JWT}`,
                'Content-Type': 'multipart/form-data',
            },
            maxContentLength: Infinity,
            maxBodyLength: Infinity,
        });
        return response.data.IpfsHash;
    } catch (error) {
        throw new Error(`Pinata upload failed: ${error.response?.data?.error || error.message}`);
    }
};

export const uploadToIPFS = async (imageFile, metadata, tokenName) => {
    try {
        let imageHash = '';
        let imageUrl = '';
        if (imageFile) {
            imageHash = await uploadToPinata(imageFile, { pinataMetadata: { name: `${tokenName}_image` } });
            imageUrl = `https://ipfs.io/ipfs/${imageHash}`;
        }
        metadata.image = imageUrl;
        if (metadata.twitter) metadata.twitter = metadata.twitter;
        if (metadata.telegram) metadata.telegram = metadata.telegram;
        if (metadata.website) metadata.website = metadata.website;
        const metadataHash = await uploadToPinata(metadata, { pinataMetadata: { name: `${tokenName}_metadata` } });
        const metadataUri = `https://ipfs.io/ipfs/${metadataHash}`;
        return { metadataUri, imageUrl };
    } catch (error) {
        console.error('Pinata upload error:', error);
        throw new Error(`IPFS upload failed: ${error.message}`);
    }
};

export const timeoutPromise = (promise, ms) => {
    return Promise.race([
        promise,
        new Promise((_, reject) => setTimeout(() => reject(new Error(`Timeout after ${ms}ms`)), ms))
    ]);
};

export const safeGetOrCreateATA = async (connection, payer, mint, owner) => {
    const ata = getAssociatedTokenAddressSync(mint, owner);
    try {
        const accountInfo = await timeoutPromise(connection.getAccountInfo(ata, 'confirmed'), 10000);
        if (accountInfo && accountInfo.owner.equals(TOKEN_PROGRAM_ID)) {
            return { address: ata };
        } else {
            const ix = createAssociatedTokenAccountInstruction(payer, ata, owner, mint);
            return { address: ata, instruction: ix };
        }
    } catch (error) {
        console.warn('getAccountInfo timed out or failed, assuming ATA does not exist:', error.message);
        const ix = createAssociatedTokenAccountInstruction(payer, ata, owner, mint);
        return { address: ata, instruction: ix };
    }
};

export const calculateTokensOut = (solInLamports, solReservesLamports, tokenReservesUnits, decimals) => {
    const virtualTokens = VIRTUAL_TOKENS_BASE * (10n ** BigInt(decimals));
    const solInBig = BigInt(solInLamports);
    const fee = solInBig / 100n;
    const solInNet = solInBig - fee;
    const actualSol = BigInt(solReservesLamports);
    const actualTokens = BigInt(tokenReservesUnits);
    const effectiveSol = VIRTUAL_SOL_LAMPORTS + actualSol;
    const effectiveTokens = virtualTokens + actualTokens;
    const k = effectiveSol * effectiveTokens;
    const newEffectiveSol = effectiveSol + solInNet;
    const newEffectiveTokens = k / newEffectiveSol;
    const tokensOut = effectiveTokens - newEffectiveTokens;
    return tokensOut;
};

export const calculateSolOut = (tokensInUnits, solReservesLamports, tokenReservesUnits, decimals) => {
    const virtualTokens = VIRTUAL_TOKENS_BASE * (10n ** BigInt(decimals));
    const tokensInBig = BigInt(tokensInUnits);
    const fee = tokensInBig / 100n;
    const tokensInNet = tokensInBig - fee;
    const actualSol = BigInt(solReservesLamports);
    const actualTokens = BigInt(tokenReservesUnits);
    const effectiveSol = VIRTUAL_SOL_LAMPORTS + actualSol;
    const effectiveTokens = virtualTokens + actualTokens;
    const k = effectiveSol * effectiveTokens;
    const newEffectiveTokens = effectiveTokens + tokensInNet;
    const newEffectiveSol = k / newEffectiveTokens;
    const solOut = effectiveSol - newEffectiveSol;
    return solOut;
};

export const fetchHoldersCount = async (connection, mintStr) => {
    const mint = new PublicKey(mintStr);
    try {
        const accounts = await connection.getProgramAccounts(TOKEN_PROGRAM_ID, {
            filters: [
                { memcmp: { offset: 0, bytes: mint.toBase58() } },
                { dataSize: 165 }
            ],
            commitment: 'confirmed'
        });
        let count = 0;
        for (const acc of accounts) {
            const data = acc.account.data;
            const amount = new BN(data.slice(64, 72), 'le');
            if (amount.gt(new BN(0))) {
                count++;
            }
        }
        return count;
    } catch (err) {
        console.error('Error fetching holders:', err);
        return 0;
    }
};

export const fetchTokenMetrics = async (mint) => {
    try {
        const res = await axios.get(`https://api.dexscreener.com/latest/dex/tokens/${mint}`);
        if (res.data.pairs && res.data.pairs.length > 0) {
            const pair = res.data.pairs[0];
            return {
                priceUsd: parseFloat(pair.priceUsd) || 0,
                mcap: parseFloat(pair.marketCap) || 0,
                fdv: parseFloat(pair.fdv) || 0,
                liquidity: parseFloat(pair.liquidity?.usd) || 0,
                volume24h: parseFloat(pair.volume?.h24) || 0,
            };
        }
    } catch (e) {
        console.error('Fetch metrics error:', e);
    }
    return null;
};

export const timeAgo = (timestamp) => {
  const now = Date.now();
  const diff = now - timestamp;
  const seconds = Math.floor(diff / 1000);
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
};

export const confirmSignature = async (connection, signature, commitment = 'confirmed') => {
    let start = Date.now();
    const timeout = 60 * 1000;
    while (Date.now() - start < timeout) {
        const statuses = await connection.getSignatureStatuses([signature]);
        const status = statuses && statuses.value[0];
        if (status) {
            if (status.err) {
                throw new Error(`Transaction failed: ${JSON.stringify(status.err)}`);
            }
            if (status.confirmationStatus === commitment || status.confirmationStatus === 'finalized') {
                return status;
            }
        }
        await new Promise(resolve => setTimeout(resolve, 2000));
    }
    throw new Error('Transaction confirmation timeout');
};

export const generateVanityKeypair = (setProgress) => {
    return new Promise((resolve, reject) => {
        let attempts = 0;
        const maxAttempts = 1000000;
        const batchSize = 1000;
        const generateBatch = () => {
            if (attempts >= maxAttempts) {
                reject(new Error(`Vanity generation failed after ${maxAttempts} attempts. Try again or uncheck the option.`));
                return;
            }
            const start = attempts;
            let found = false;
            for (let i = 0; i < batchSize && attempts < maxAttempts; i++) {
                attempts++;
                const keypair = Keypair.generate();
                const pubStr = keypair.publicKey.toBase58();
                if (pubStr.toUpperCase().endsWith('DRK')) {
                    resolve(keypair);
                    found = true;
                    break;
                }
            }
            if (setProgress) setProgress(attempts);
            if (!found) {
                setTimeout(generateBatch, 0);
            }
        };
        generateBatch();
    });
};