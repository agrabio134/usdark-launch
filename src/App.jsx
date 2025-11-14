import React, { useState, useEffect, useMemo } from 'react';
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
import { useWallet } from '@solana/wallet-adapter-react';
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui';
import { Wallet, Home, Rocket, TrendingUp, Search, Menu, X, Info, DollarSign, Twitter, Send, Globe, Loader2, User } from 'lucide-react';
import axios from 'axios';
import '@solana/wallet-adapter-react-ui/styles.css';
import { initializeApp } from 'firebase/app';
import { getFirestore, collection, addDoc, getDocs, query, orderBy, updateDoc, doc, onSnapshot } from 'firebase/firestore';
import { getAuth, signInAnonymously, onAuthStateChanged } from 'firebase/auth';
import {
    DynamicBondingCurveClient,
    buildCurveWithMarketCap,
    ActivationType,
    CollectFeeMode,
    BaseFeeMode,
    MigrationFeeOption,
    MigrationOption,
    TokenDecimal,
    TokenType,
    TokenUpdateAuthorityOption
} from '@meteora-ag/dynamic-bonding-curve-sdk';
import BN from 'bn.js';
const NETWORKS = {
    'devnet': [
        'https://api.devnet.solana.com',
        'https://devnet.solana.com',
        'https://dawn-devnet.solana.com'
    ],
    'mainnet': [
        'https://mainnet.helius-rpc.com/?api-key=a736e60e-52b8-469a-9f57-298d73076f3a', // Primary: Your Helius RPC
        'https://solana.drpc.org/',
        'https://solana-rpc.publicnode.com',
        'https://api.mainnet-beta.solana.com',
        'https://solana.lavenderfive.com/',
        'https://solana.api.onfinality.io/public'
    ]
};
const DEFAULT_NETWORK = 'mainnet';
const firebaseConfig = {
    apiKey: "AIzaSyBmF3F8CgYQfpqN6xSpeL0rkJvpshFLmwk",
    authDomain: "usdark-launchpad.firebaseapp.com",
    projectId: "usdark-launchpad",
    storageBucket: "usdark-launchpad.firebasestorage.app",
    messagingSenderId: "54701943971",
    appId: "1:54701943971:web:295fa5465d713d28502316"
};
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);
let FEE_WALLET;
try {
    FEE_WALLET = new PublicKey('5o3YkaKpfC8oJAjwhzwSTjbCj9UN8PosfT4D1e1xMrZU');
} catch (error) {
    console.error('Invalid FEE_WALLET address:', error);
    FEE_WALLET = new PublicKey('11111111111111111111111111111111');
}
const BASE_FEE = 0.02 * LAMPORTS_PER_SOL;
const PINATA_JWT = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySW5mb3JtYXRpb24iOnsiaWQiOiJhMTNlMDlhMy1hYmJjLTQwOWYtOTdmMi1mNGY0N2Y2ODUzZDYiLCJlbWFpbCI6ImFncmFiaW9oYXJ2ZXlAZ21haWwuY29tIiwiZW1haWxfdmVyaWZpZWQiOnRydWUsInBpbl9wb2xpY3kiOnsicmVnaW9ucyI6W3siZGVzaXJlZFJlcGxpY2F0aW9uQ291bnQiOjEsImlkIjoiRlJBMSJ9LHsiZGVzaXJlZFJlcGxpY2F0aW9uQ291bnQiOjEsImlkIjoiTllDMSJ9XSwidmVyc2lvbiI6MX0sIm1mYV9lbmFibGVkIjpmYWxzZSwic3RhdHVzIjoiQUNUSVZFIn0sImF1dGhlbnRpY2F0aW9uVHlwZSI6InNjb3BlZEtleSIsInNjb3BlZEtleUtleSI6IjE2MTc1YTM5NTE5NWFmMWVjNjk5Iiwic2NvcGVkS2V5U2VjcmV0IjoiY2FjNWI4NmRjYjkxMzBlYWQ5NWM4MTZmMzk3ZWZiMWUyZTIwMzQxZjM1OGMxMzk5YTE0ZWYzYjczNjNkYmE0MSIsImV4cCI6MTc5MTg5MjU4NH0.ZRvRz1xkIvI0VN-Xd44ZdXSUEMhVyK-TaNFPk4BOZYs';
const TOTAL_SUPPLY_TOKENS = 1000000000;
const BONDING_SUPPLY_TOKENS = 800000000;
const DEX_SUPPLY_TOKENS = 200000000;
const MIGRATION_TARGET_SOL = 40;
const VIRTUAL_SOL_LAMPORTS = BigInt(30 * LAMPORTS_PER_SOL);
const VIRTUAL_TOKENS_BASE = 200000000n;
const DBC_PROGRAM_ID = new PublicKey('dbcij3LWUppWqq96dh6gJWwBifmcGfLSB5D4DuSMaqN');
const USDARK_MINT = new PublicKey('4EKDKWJDrqrCQtAD6j9sM5diTeZiKBepkEB8GLP9Dark');
const USDARK_DECIMALS = 6;
const LAUNCH_FEE_USDARK = 2000;
const USDARK_BYPASS = 1;
const uploadToPinata = async (data, options = { pinataMetadata: { name: 'metadata' } }) => {
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
const uploadToIPFS = async (imageFile, metadata, tokenName) => {
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
const timeoutPromise = (promise, ms) => {
    return Promise.race([
        promise,
        new Promise((_, reject) => setTimeout(() => reject(new Error(`Timeout after ${ms}ms`)), ms))
    ]);
};
const safeGetOrCreateATA = async (connection, payer, mint, owner) => {
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
const calculateTokensOut = (solInLamports, solReservesLamports, tokenReservesUnits, decimals) => {
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
const calculateSolOut = (tokensInUnits, solReservesLamports, tokenReservesUnits, decimals) => {
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
const fetchHoldersCount = async (connection, mintStr) => {
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
const fetchTokenMetrics = async (mint) => {
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
const timeAgo = (timestamp) => {
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
const TokenCard = ({ token, onAction, solPrice, metrics }) => {
    const isNew = token.timestamp && (Date.now() - token.timestamp < 3600000);
    const progress = token.graduated ? 100 : (token.solCollected / MIGRATION_TARGET_SOL) * 100;
    const virtualSol = 30;
    const virtualTokens = 200000000;
    const tokensSoldUnits = token.tokensSoldUnits || '0';
    const decimalsBig = BigInt(token.decimals);
    const pow10 = 10n ** decimalsBig;
    const remainingTokens = BONDING_SUPPLY_TOKENS - Number(BigInt(tokensSoldUnits) / pow10);
    const effectiveSol = virtualSol + token.solCollected;
    const effectiveTokens = virtualTokens + remainingTokens;
    const priceSol = effectiveSol / effectiveTokens;
    const tokenPrice = priceSol * solPrice;
    const circulatingTokens = Number(BigInt(tokensSoldUnits) / pow10);
    const marketCap = circulatingTokens * tokenPrice;
    let displayPrice = tokenPrice;
    let displayMcap = marketCap;
    if (token.graduated && metrics) {
        displayPrice = metrics.priceUsd || tokenPrice;
        displayMcap = metrics.mcap || (TOTAL_SUPPLY_TOKENS * displayPrice);
    }
    return (
        <div className="token-card" onClick={() => onAction(token, 'view')}>
            {isNew && <div className="new-badge">NEW</div>}
            {token.graduated && <div className="graduated-badge">GRADUATED</div>}
            <div className="token-image-container">
                <img
                    src={token.image || 'https://via.placeholder.com/200?text=USDARK'}
                    alt={token.name}
                    className="token-image"
                    onError={(e) => e.target.src = 'https://via.placeholder.com/200?text=USDARK'}
                />
            </div>
            <div className="token-header">
                <h3>{token.name}</h3>
            </div>
            <div className="creator-address">
                Creator: {token.creator.substring(0, 6)}...{token.creator.slice(-6)}
            </div>
            <div className="time-launched">
                Launched: {timeAgo(token.timestamp)}
            </div>
            <div className="token-metrics">
                <div className="metric-row">
                    <span>MC:</span>
                    <span>${displayMcap.toFixed(2)}</span>
                </div>
                <div className="metric-row">
                    <span>$:</span>
                    <span>${displayPrice > 0 ? displayPrice.toFixed(8) : '0.00000000'}</span>
                </div>
            </div>
            {!token.graduated && (
                <>
                    <div className="progress-bar">
                        <div className="progress" style={{ width: `${Math.min(progress, 100)}%` }}></div>
                    </div>
                </>
            )}
            <button
                className="buy-button"
                onClick={(e) => {
                    e.stopPropagation();
                    onAction(token, 'view');
                }}
            >
                {token.graduated ? 'View Details' : 'Trade'}
            </button>
        </div>
    );
};
const confirmSignature = async (connection, signature, commitment = 'confirmed') => {
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
const generateVanityKeypair = (setProgress) => {
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
function App() {
    const [network, setNetwork] = useState(DEFAULT_NETWORK);
    const [solanaConnection, setSolanaConnection] = useState(null);
    const { publicKey, signTransaction, connected } = useWallet();
    const walletPublicKey = useMemo(() => {
        if (!publicKey) return null;
        try {
            return publicKey;
        } catch (e) {
            console.error('Invalid publicKey from wallet:', e);
            return null;
        }
    }, [publicKey]);
    const [status, setStatus] = useState('Fair SPL token launcher with bonding curve - 0.02 SOL launch fee');
    const [showStatusModal, setShowStatusModal] = useState(false);
    const [isSending, setIsSending] = useState(false);
    const [activePage, setActivePage] = useState('home');
    const [searchQuery, setSearchQuery] = useState('');
    const [createdTokens, setCreatedTokens] = useState([]);
    const [isLoadingTokens, setIsLoadingTokens] = useState(true);
    const [firebaseUser, setFirebaseUser] = useState(null);
    const [showMobileMenu, setShowMobileMenu] = useState(false);
    const [tokenName, setTokenName] = useState('');
    const [ticker, setTicker] = useState('');
    const [description, setDescription] = useState('');
    const [imageFile, setImageFile] = useState(null);
    const [imagePreview, setImagePreview] = useState('');
    const [decimals, setDecimals] = useState(6);
    const [useVanityAddress, setUseVanityAddress] = useState(true);
    const [vanityStatus, setVanityStatus] = useState('idle');
    const [vanityProgress, setVanityProgress] = useState(0);
    const [vanityResult, setVanityResult] = useState(null);
    const [twitterUrl, setTwitterUrl] = useState('');
    const [telegramUrl, setTelegramUrl] = useState('');
    const [websiteUrl, setWebsiteUrl] = useState('');
    const [showModal, setShowModal] = useState(false);
    const [selectedToken, setSelectedToken] = useState(null);
    const [modalTab, setModalTab] = useState('buy');
    const [tradeAmount, setTradeAmount] = useState('');
    const [slippage, setSlippage] = useState(0.5);
    const [outputAmount, setOutputAmount] = useState('');
    const [copiedCA, setCopiedCA] = useState(false);
    const [userTokenBalance, setUserTokenBalance] = useState(0);
    const [userSolBalance, setUserSolBalance] = useState(0);
    const [userUsdarkBalance, setUserUsdarkBalance] = useState(0);
    const [solPrice, setSolPrice] = useState(150);
    const [isFetchingQuote, setIsFetchingQuote] = useState(false);
    const [tradeError, setTradeError] = useState('');
    const [showInitialBuyModal, setShowInitialBuyModal] = useState(false);
    const [initialBuyAmount, setInitialBuyAmount] = useState('0.5');
    const [pendingTokenData, setPendingTokenData] = useState(null);
    const [showLaunchInfoModal, setShowLaunchInfoModal] = useState(false);
    // Profile state
    const [claimableFees, setClaimableFees] = useState({});
    const [tokenMetrics, setTokenMetrics] = useState({});
    const userTokens = useMemo(() => {
        return createdTokens.filter(token => token.creator === walletPublicKey?.toBase58());
    }, [createdTokens, walletPublicKey]);
    const client = useMemo(() => {
        if (!solanaConnection) return null;
        return new DynamicBondingCurveClient(solanaConnection, 'confirmed');
    }, [solanaConnection]);
    useEffect(() => {
        const fetchSolPrice = async () => {
            try {
                const response = await axios.get('https://api.coingecko.com/api/v3/simple/price?ids=solana&vs_currencies=usd');
                setSolPrice(response.data.solana.usd);
            } catch (error) {
                console.log('Using default SOL price');
            }
        };
        fetchSolPrice();
        const interval = setInterval(fetchSolPrice, 60000);
        return () => clearInterval(interval);
    }, []);
    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, (user) => {
            if (user) {
                console.log('Firebase user authenticated:', user.uid);
                setFirebaseUser(user);
            } else {
                signInAnonymously(auth).catch((error) => {
                    console.error('Firebase auth error:', error);
                    setStatus('Firebase authentication failed');
                    setShowStatusModal(true);
                });
            }
        });
        return () => unsubscribe();
    }, []);
    useEffect(() => {
        if (!firebaseUser) return;
        setIsLoadingTokens(true);
        const tokensRef = collection(db, 'tokens');
        const q = query(tokensRef, orderBy('timestamp', 'desc'));
        const unsubscribe = onSnapshot(q, (querySnapshot) => {
            const tokens = [];
            const uniqueMints = new Set();
            querySnapshot.forEach((doc) => {
                const data = doc.data();
                data.tokensSoldUnits = data.tokensSoldUnits || '0';
                data.holders = data.holders || 0;
                if (!uniqueMints.has(data.mint)) {
                    uniqueMints.add(data.mint);
                    tokens.push({ id: doc.id, ...data });
                }
            });
            setCreatedTokens(tokens);
            setIsLoadingTokens(false);
        }, (error) => {
            console.error('Error loading tokens:', error);
            setStatus('Failed to load tokens from database');
            setShowStatusModal(true);
            setIsLoadingTokens(false);
        });
        return () => unsubscribe();
    }, [firebaseUser]);
    useEffect(() => {
        const fetchAllMetrics = async () => {
            const graduatedTokens = createdTokens.filter(t => t.graduated).slice(0, 20);
            const promises = graduatedTokens.map(async (t) => {
                if (!tokenMetrics[t.mint]) {
                    const m = await fetchTokenMetrics(t.mint);
                    if (m) {
                        setTokenMetrics(prev => ({ ...prev, [t.mint]: m }));
                    }
                }
            });
            await Promise.all(promises);
        };
        if (createdTokens.length > 0) {
            fetchAllMetrics();
        }
    }, [createdTokens]);
    useEffect(() => {
        if (!solanaConnection || !client || !createdTokens.length) return;
        // Limit to recent 10 tokens to reduce polling load
        const recentTokens = createdTokens.slice(0, 10).filter(token => !token.graduated && token.pool);
        let pollInterval;
        if (recentTokens.length > 0) {
            pollInterval = setInterval(async () => {
                for (const token of recentTokens) {
                    try {
                        const poolPk = new PublicKey(token.pool);
                        const info = await solanaConnection.getAccountInfo(poolPk);
                        if (info) {
                            const poolState = client.state.parsePool(info.data);
                            const newSolCollected = Number(poolState.quoteReserve) / LAMPORTS_PER_SOL;
                            const baseReserveUnits = poolState.baseReserve;
                            const bondingSupplyBN = new BN(token.bondingSupplyUnits);
                            const tokensSoldUnitsBN = bondingSupplyBN.sub(baseReserveUnits);
                            const tokensSoldUnits = tokensSoldUnitsBN.toString();
                            const updates = {
                                solCollected: newSolCollected,
                                tokensSoldUnits,
                                graduated: newSolCollected >= MIGRATION_TARGET_SOL,
                            };
                            if (token.id && (token.solCollected !== newSolCollected || token.tokensSoldUnits !== tokensSoldUnits)) {
                                await updateTokenInFirestore(token.id, updates);
                            }
                        }
                    } catch (err) {
                        console.error('Polling error for pool:', token.pool, err);
                    }
                }
            }, 10000); // Poll every 10 seconds
        }
        return () => {
            if (pollInterval) clearInterval(pollInterval);
        };
    }, [createdTokens, client, solanaConnection, solPrice]);
    // Poll for holders count (for all tokens, limited to 20, every 30 seconds)
    useEffect(() => {
        if (!solanaConnection || !createdTokens.length) return;
        const allTokens = createdTokens.slice(0, 20);
        const holdersInterval = setInterval(async () => {
            for (const token of allTokens) {
                try {
                    const holders = await fetchHoldersCount(solanaConnection, token.mint);
                    if (holders !== token.holders && token.id) {
                        await updateTokenInFirestore(token.id, { holders });
                    }
                } catch (err) {
                    console.error('Error fetching holders for token:', token.mint, err);
                }
            }
        }, 30000); // Poll every 30 seconds
        return () => clearInterval(holdersInterval);
    }, [createdTokens, solanaConnection]);
    // Fetch claimable fees for user tokens
    useEffect(() => {
        const fetchClaimables = async () => {
            if (!solanaConnection || !client || !walletPublicKey || userTokens.length === 0) return;
            const newFees = {};
            for (const token of userTokens) {
                try {
                    // Approximate calculation based on SOL collected (assumes fees from buys)
                    newFees[token.mint] = token.solCollected * 0.04 * 0.6; // 60% of 4% fees
                } catch (error) {
                    console.error(`Error fetching fees for ${token.name}:`, error);
                    newFees[token.mint] = 0;
                }
            }
            setClaimableFees(newFees);
        };
        fetchClaimables();
    }, [userTokens, client, solanaConnection, walletPublicKey]);
    useEffect(() => {
        const fetchBalances = async () => {
            if (!connected || !walletPublicKey || !solanaConnection) return;
            try {
                const solBal = await solanaConnection.getBalance(walletPublicKey) / LAMPORTS_PER_SOL;
                setUserSolBalance(solBal);
                const userAta = getAssociatedTokenAddressSync(USDARK_MINT, walletPublicKey);
                try {
                    const bal = await solanaConnection.getTokenAccountBalance(userAta);
                    setUserUsdarkBalance(bal.value.uiAmount || 0);
                } catch {
                    setUserUsdarkBalance(0);
                }
            } catch (err) {
                console.error('Fetch balances error:', err);
            }
        };
        fetchBalances();
    }, [connected, walletPublicKey, solanaConnection]);
    useEffect(() => {
        const updateOutput = async () => {
            if (!selectedToken || !tradeAmount || parseFloat(tradeAmount) <= 0) {
                setOutputAmount('');
                setTradeError('');
                return;
            }
            if (selectedToken.graduated) {
                setIsFetchingQuote(true);
                try {
                    const inputMint = modalTab === 'buy' ? NATIVE_MINT.toString() : selectedToken.mint;
                    const outputMint = modalTab === 'buy' ? selectedToken.mint : NATIVE_MINT.toString();
                    const inputDec = modalTab === 'buy' ? 9 : selectedToken.decimals;
                    const amountIn = Math.floor(parseFloat(tradeAmount) * (10 ** inputDec));
                    const res = await axios.get(`https://quote-api.jup.ag/v6/quote?inputMint=${inputMint}&outputMint=${outputMint}&amount=${amountIn}&slippageBps=${Math.floor(slippage * 100)}`);
                    const quote = res.data;
                    const outputDec = modalTab === 'buy' ? selectedToken.decimals : 9;
                    const out = parseFloat(quote.outAmount) / (10 ** outputDec);
                    setOutputAmount(out.toFixed(6));
                    setTradeError('');
                } catch (e) {
                    setTradeError(e.message);
                    setOutputAmount('');
                } finally {
                    setIsFetchingQuote(false);
                }
            } else {
                setIsFetchingQuote(false);
                const amount = parseFloat(tradeAmount);
                const solReservesLamports = Math.floor(selectedToken.solCollected * LAMPORTS_PER_SOL);
                const tokensSoldUnits = BigInt(selectedToken.tokensSoldUnits || '0');
                const bondingUnits = BigInt(selectedToken.bondingSupplyUnits);
                const remainingUnits = bondingUnits - tokensSoldUnits;
                const dec = selectedToken.decimals;
                let outUi = 0;
                if (modalTab === 'buy') {
                    const solInLamports = Math.floor(amount * LAMPORTS_PER_SOL);
                    const tokensOut = calculateTokensOut(solInLamports, solReservesLamports, remainingUnits.toString(), dec);
                    outUi = Number(tokensOut) / (10 ** dec);
                } else {
                    const tokensInUnits = Math.floor(amount * (10 ** dec));
                    const solOutLamports = calculateSolOut(tokensInUnits, solReservesLamports, remainingUnits.toString(), dec);
                    outUi = Number(solOutLamports) / LAMPORTS_PER_SOL;
                }
                setOutputAmount(outUi.toFixed(6));
                setTradeError('');
            }
        };
        const timeoutId = setTimeout(updateOutput, 300);
        return () => clearTimeout(timeoutId);
    }, [tradeAmount, modalTab, selectedToken, slippage]);
    const saveTokenToFirestore = async (tokenData) => {
        try {
            const docRef = await addDoc(collection(db, 'tokens'), tokenData);
            return docRef.id;
        } catch (error) {
            console.error('Error saving token to Firestore:', error);
            throw new Error('Failed to save token to database');
        }
    };
    const updateTokenInFirestore = async (tokenId, updates) => {
        try {
            const tokenRef = doc(db, 'tokens', tokenId);
            await updateDoc(tokenRef, updates);
        } catch (error) {
            console.error('Error updating token in Firestore:', error);
            throw new Error('Failed to update token in database');
        }
    };
    const createConnection = async (rpcUrls) => {
        for (const url of rpcUrls) {
            try {
                const connection = new Connection(url, 'confirmed');
                await timeoutPromise(connection.getSlot('confirmed'), 5000);
                console.log(`Connected to ${url}`);
                return connection;
            } catch (e) {
                console.warn(`Failed to connect to ${url}:`, e.message);
            }
        }
        throw new Error('All RPC endpoints failed');
    };
    useEffect(() => {
        const initConnection = async () => {
            const rpcUrls = NETWORKS[network];
            try {
                const connection = await createConnection(Array.isArray(rpcUrls) ? rpcUrls : [rpcUrls]);
                setSolanaConnection(connection);
                setStatus(`Connected to ${network.toUpperCase()} network.`);
                setShowStatusModal(true);
            } catch (error) {
                setStatus(`Failed to connect to ${network}: ${error.message}`);
                setShowStatusModal(true);
            }
        };
        initConnection();
    }, [network]);
    useEffect(() => {
        if (!connected) {
            setStatus('Please connect your wallet');
            setShowStatusModal(true);
        } else if (walletPublicKey) {
            setStatus(`Connected: ${walletPublicKey.toString().substring(0, 4)}...${walletPublicKey.toString().slice(-4)} on ${network.toUpperCase()}`);
            setShowStatusModal(true);
        } else {
            setStatus('Invalid wallet public key');
            setShowStatusModal(true);
        }
    }, [connected, walletPublicKey, network]);
    const filteredTokens = createdTokens.filter(t =>
        t.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        t.symbol.toLowerCase().includes(searchQuery.toLowerCase())
    );
    const handleTokenAction = async (token, action) => {
        if (action === 'view') {
            setSelectedToken(token);
            setShowModal(true);
            setModalTab('buy');
            setTradeAmount('');
            setOutputAmount('');
            setTradeError('');
            setSlippage(0.5);
            if (token.graduated) {
                const m = await fetchTokenMetrics(token.mint);
                if (m) {
                    setTokenMetrics(prev => ({ ...prev, [token.mint]: m }));
                }
            }
            if (connected && walletPublicKey && solanaConnection) {
                try {
                    const solBal = await solanaConnection.getBalance(walletPublicKey);
                    setUserSolBalance(solBal / LAMPORTS_PER_SOL);
                    const mint = new PublicKey(token.mint);
                    const userATA = getAssociatedTokenAddressSync(mint, walletPublicKey);
                    const accountInfo = await solanaConnection.getAccountInfo(userATA);
                    if (accountInfo) {
                        const tokenAccountInfo = await solanaConnection.getTokenAccountBalance(userATA);
                        setUserTokenBalance(parseFloat(tokenAccountInfo.value.uiAmount || 0));
                    } else {
                        setUserTokenBalance(0);
                    }
                } catch (error) {
                    console.error('Error fetching balances:', error);
                    setUserTokenBalance(0);
                }
            }
            return;
        }
        if (action === 'trade' && token.graduated) {
            setStatus('Token graduated! Use Raydium or Jupiter to trade.');
            setShowStatusModal(true);
            return;
        }
    };
    const handleQuickAmount = (percent) => {
        const balance = modalTab === 'buy' ? userSolBalance : userTokenBalance;
        if (balance > 0) {
            setTradeAmount((balance * (percent / 100)).toFixed(4));
        }
    };
    const handleCopyCA = (address) => {
        navigator.clipboard.writeText(address);
        setCopiedCA(true);
        setTimeout(() => setCopiedCA(false), 2000);
    };
    const handleBondingTrade = async (token, isBuy, amountUi) => {
        if (!client || !walletPublicKey) throw new Error('Client or wallet not ready');
        const pool = new PublicKey(token.pool);
        const dec = token.decimals;
        const amountLamportsOrUnits = Math.floor(amountUi * (isBuy ? LAMPORTS_PER_SOL : (10 ** dec)));
        if (amountLamportsOrUnits <= 0) throw new Error('Invalid amount');
        const { blockhash } = await solanaConnection.getLatestBlockhash('confirmed');
        let tx;
        let expectedOutUnits;
        const solReservesLamports = Math.floor(token.solCollected * LAMPORTS_PER_SOL);
        const tokensSoldUnits = BigInt(token.tokensSoldUnits || '0');
        const bondingUnits = BigInt(token.bondingSupplyUnits);
        const remainingUnits = bondingUnits - tokensSoldUnits;
        if (isBuy) {
            expectedOutUnits = calculateTokensOut(amountLamportsOrUnits, solReservesLamports, remainingUnits.toString(), dec);
            const minOut = new BN(Number(expectedOutUnits) * (1 - slippage / 100));
            const swapParam = {
                amountIn: new BN(amountLamportsOrUnits),
                minimumAmountOut: minOut,
                swapBaseForQuote: false,
                owner: walletPublicKey,
                pool,
                referralTokenAccount: null,
            };
            tx = await client.pool.swap(swapParam);
        } else {
            expectedOutUnits = calculateSolOut(amountLamportsOrUnits, solReservesLamports, remainingUnits.toString(), dec);
            const minOut = new BN(Number(expectedOutUnits) * (1 - slippage / 100));
            const swapParam = {
                amountIn: new BN(amountLamportsOrUnits),
                minimumAmountOut: minOut,
                swapBaseForQuote: true,
                owner: walletPublicKey,
                pool,
                referralTokenAccount: null,
            };
            tx = await client.pool.swap(swapParam);
        }
        tx.recentBlockhash = blockhash;
        tx.feePayer = walletPublicKey;
        const signed = await signTransaction(tx);
        const sig = await solanaConnection.sendRawTransaction(signed.serialize(), {
            skipPreflight: false,
            preflightCommitment: 'confirmed',
            maxRetries: 5,
        });
        await confirmSignature(solanaConnection, sig);
        // Approximate local update
        if (token.id && isBuy) {
            const newSolCollected = token.solCollected + amountUi;
            const newTokensSoldUnits = (BigInt(token.tokensSoldUnits || '0') + BigInt(expectedOutUnits)).toString();
            await updateTokenInFirestore(token.id, { solCollected: newSolCollected, tokensSoldUnits: newTokensSoldUnits });
        } else if (token.id && !isBuy) {
            const newTokensSoldUnits = (BigInt(token.tokensSoldUnits || '0') - BigInt(amountLamportsOrUnits)).toString();
            await updateTokenInFirestore(token.id, { tokensSoldUnits: newTokensSoldUnits });
        }
        return sig;
    };
    const handleTrade = async () => {
        if (!connected || !walletPublicKey || !selectedToken || !tradeAmount || parseFloat(tradeAmount) <= 0) {
            setStatus('Enter a valid amount');
            setShowStatusModal(true);
            return;
        }
        const inputBal = modalTab === 'buy' ? userSolBalance : userTokenBalance;
        if (parseFloat(tradeAmount) > inputBal) {
            setStatus('Insufficient balance');
            setShowStatusModal(true);
            return;
        }
        setIsSending(true);
        setStatus(`Processing ${modalTab}...`);
        setShowStatusModal(true);
        try {
            // if (selectedToken.graduated) {
                const isUsdark = selectedToken.mint === USDARK_MINT.toBase58();
                const inputMint = modalTab === 'buy' ? NATIVE_MINT.toString() : selectedToken.mint;
                const outputMint = modalTab === 'buy' ? selectedToken.mint : NATIVE_MINT.toString();
                const inputDec = modalTab === 'buy' ? 9 : isUsdark ? 6 : selectedToken.decimals;
                const outputDec = modalTab === 'buy' ? isUsdark ? 6 : selectedToken.decimals : 9;
                const amountInLamports = Math.floor(parseFloat(tradeAmount) * Math.pow(10, inputDec));
                if (amountInLamports <= 0) throw new Error('Invalid amount');
                const quoteParams = new URLSearchParams({
                    inputMint,
                    outputMint,
                    amount: amountInLamports.toString(),
                    slippageBps: Math.floor(slippage * 100).toString(),
                });
                const quoteRes = await fetch(`https://lite-api.jup.ag/swap/v1/quote?${quoteParams}`);
                if (!quoteRes.ok) {
                    const txt = await quoteRes.text();
                    throw new Error(`Quote error: ${quoteRes.status} – ${txt}`);
                }
                const quote = await quoteRes.json();
                const outUi = parseFloat(quote.outAmount) / Math.pow(10, outputDec);
                setOutputAmount(outUi.toFixed(6));
                const swapRes = await fetch('https://lite-api.jup.ag/swap/v1/swap', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        quoteResponse: quote,
                        userPublicKey: walletPublicKey.toString(),
                        wrapAndUnwrapSol: true,
                        dynamicComputeUnitLimit: true,
                        prioritizationFeeLamports: 'auto',
                    }),
                });
                if (!swapRes.ok) {
                    const txt = await swapRes.text();
                    throw new Error(`Swap error: ${swapRes.status} – ${txt}`);
                }
                const { swapTransaction } = await swapRes.json();
                const buf = Uint8Array.from(atob(swapTransaction), (c) => c.charCodeAt(0));
                const tx = VersionedTransaction.deserialize(buf);
                const signed = await signTransaction(tx);
                const txid = await solanaConnection.sendRawTransaction(signed.serialize(), { skipPreflight: false, preflightCommitment: 'confirmed' });
                await confirmSignature(solanaConnection, txid);
                setStatus(`${modalTab.charAt(0).toUpperCase() + modalTab.slice(1)} successful! TX: ${txid}`);
                // Refetch metrics after trade
                const newMetrics = await fetchTokenMetrics(selectedToken.mint);
                if (newMetrics) {
                    setTokenMetrics(prev => ({ ...prev, [selectedToken.mint]: newMetrics }));
                }
            // } 
            else {
                const sig = await handleBondingTrade(selectedToken, modalTab === 'buy', parseFloat(tradeAmount));
                setStatus(`${modalTab.charAt(0).toUpperCase() + modalTab.slice(1)} successful! TX: ${sig}`);
            }
            setTradeAmount('');
            setOutputAmount('');
            const newSol = await solanaConnection.getBalance(walletPublicKey);
            setUserSolBalance(newSol / LAMPORTS_PER_SOL);
            const mintPk = new PublicKey(selectedToken.mint);
            const ata = getAssociatedTokenAddressSync(mintPk, walletPublicKey);
            try {
                const bal = await solanaConnection.getTokenAccountBalance(ata);
                setUserTokenBalance(bal.value.uiAmount || 0);
            } catch {
                setUserTokenBalance(0);
            }
        } catch (err) {
            console.error('Trade error:', err);
            setStatus(`Trade failed: ${err.message}`);
            setTradeError(err.message);
        } finally {
            setIsSending(false);
            setShowStatusModal(true);
        }
    };
    // Initial buy handler
    const handleInitialBuy = async () => {
        if (!connected || !walletPublicKey || !pendingTokenData || !initialBuyAmount || parseFloat(initialBuyAmount) <= 0) {
            setStatus('Enter a valid amount');
            setShowStatusModal(true);
            return;
        }
        const amountUi = parseFloat(initialBuyAmount);
        if (userSolBalance < amountUi) {
            setStatus('Insufficient SOL balance');
            setShowStatusModal(true);
            return;
        }
        setIsSending(true);
        setStatus('Processing initial buy...');
        setShowStatusModal(true);
        try {
            const sig = await handleBondingTrade(pendingTokenData, true, amountUi);
            const docId = await saveTokenToFirestore(pendingTokenData);
            const savedToken = { ...pendingTokenData, id: docId };
            setCreatedTokens(prev => [savedToken, ...prev]);
            setSelectedToken(savedToken);
            setShowInitialBuyModal(false);
            setShowModal(true);
            setStatus(`Initial buy successful! TX: ${sig}`);
            setInitialBuyAmount('0.5');
        } catch (err) {
            console.error('Initial buy error:', err);
            setStatus(`Initial buy failed: ${err.message}`);
        } finally {
            setIsSending(false);
            setShowStatusModal(true);
        }
    };
    // Claim creator fees
    const handleClaim = async (token) => {
        const feeSol = claimableFees[token.mint];
        if (!connected || !walletPublicKey || !client || feeSol <= 0) {
            setStatus('No fees to claim or wallet not connected');
            setShowStatusModal(true);
            return;
        }
        setIsSending(true);
        setStatus('Claiming fees...');
        setShowStatusModal(true);
        try {
            const pool = new PublicKey(token.pool);
            const { blockhash } = await solanaConnection.getLatestBlockhash('confirmed');
            const claimParam = {
                pool,
                destination: walletPublicKey, // Native SOL
            };
            const claimTx = await client.pool.claimCreatorTradingFee(claimParam);
            claimTx.recentBlockhash = blockhash;
            claimTx.feePayer = walletPublicKey;
            const signed = await signTransaction(claimTx);
            const sig = await solanaConnection.sendRawTransaction(signed.serialize(), {
                skipPreflight: false,
                preflightCommitment: 'confirmed',
                maxRetries: 5,
            });
            await confirmSignature(solanaConnection, sig);
            setStatus(`Claimed ${feeSol.toFixed(4)} SOL in fees! TX: ${sig}`);
            setShowStatusModal(true);
            // Update local state
            setClaimableFees(prev => ({ ...prev, [token.mint]: 0 }));
            // Refresh balances
            const newSol = await solanaConnection.getBalance(walletPublicKey);
            setUserSolBalance(newSol / LAMPORTS_PER_SOL);
            // Re-fetch claimables
            const newFees = {};
            for (const t of userTokens) {
                newFees[t.mint] = t.solCollected * 0.04 * 0.6;
            }
            setClaimableFees(newFees);
        } catch (error) {
            console.error('Claim error:', error);
            setStatus(`Claim failed: ${error.message}`);
            setShowStatusModal(true);
        } finally {
            setIsSending(false);
        }
    };
    const handleSkipInitialBuy = async () => {
        try {
            if (!pendingTokenData) return;
            await saveTokenToFirestore(pendingTokenData);
            setStatus('Token launched and saved! No initial buy.');
            setShowStatusModal(true);
            setShowInitialBuyModal(false);
            setPendingTokenData(null);
            setTimeout(() => {
                setActivePage('home');
            }, 2000);
        } catch (error) {
            console.error('Save error:', error);
            setStatus(`Error saving token: ${error.message}`);
            setShowStatusModal(true);
        }
    };
    const handleImageChange = (event) => {
        const file = event.target.files[0];
        if (file) {
            if (!['image/png', 'image/jpeg', 'image/gif'].includes(file.type)) {
                setStatus('Only PNG, JPG, GIF allowed.');
                setShowStatusModal(true);
                return;
            }
            if (file.size > 2 * 1024 * 1024) {
                setStatus('Image size must be under 2MB.');
                setShowStatusModal(true);
                return;
            }
            setImageFile(file);
            const reader = new FileReader();
            reader.onload = (e) => setImagePreview(e.target.result);
            reader.readAsDataURL(file);
        }
    };
    const handleLaunchToken = async () => {
        if (!connected || !walletPublicKey || !solanaConnection || !client) {
            setStatus('Wallet not connected or client not ready');
            setShowStatusModal(true);
            return;
        }
        if (!tokenName || !ticker || !description || !imageFile) {
            setStatus('Fill all required fields');
            setShowStatusModal(true);
            return;
        }
        if (tokenName.length > 32 || ticker.length > 10 || description.length > 1000) {
            setStatus('Name ≤32 chars, Ticker ≤10 chars, Description ≤1000 chars');
            setShowStatusModal(true);
            return;
        }
        if (decimals !== 6 && decimals !== 9) {
            setStatus('Decimals must be 6 or 9');
            setShowStatusModal(true);
            return;
        }
        setIsSending(true);
        try {
            let userUsdArkAta = getAssociatedTokenAddressSync(USDARK_MINT, walletPublicKey);
            if (USDARK_BYPASS === 1) {
                setStatus('Preparing USDARK fee...');
                setShowStatusModal(true);
                const feeInstructions = [];
                const { address: ataAddress, instruction: createUserATAIx } = await safeGetOrCreateATA(
                    solanaConnection,
                    walletPublicKey,
                    USDARK_MINT,
                    walletPublicKey
                );
                userUsdArkAta = ataAddress;
                if (createUserATAIx) {
                    feeInstructions.push(createUserATAIx);
                }
                const { address: feeAtaAddress, instruction: createFeeATAIx } = await safeGetOrCreateATA(
                    solanaConnection,
                    walletPublicKey,
                    USDARK_MINT,
                    FEE_WALLET
                );
                if (createFeeATAIx) {
                    feeInstructions.push(createFeeATAIx);
                }
                const feeAmount = new BN(LAUNCH_FEE_USDARK * (10 ** USDARK_DECIMALS));
                const transferIx = createTransferInstruction(
                    userUsdArkAta,
                    feeAtaAddress,
                    walletPublicKey,
                    feeAmount
                );
                feeInstructions.push(transferIx);
                if (feeInstructions.length > 0) {
                    setStatus('Processing USDARK fee transaction...');
                    setShowStatusModal(true);
                    const feeTx = new Transaction().add(...feeInstructions);
                    const { blockhash } = await timeoutPromise(solanaConnection.getLatestBlockhash('confirmed'), 10000);
                    feeTx.recentBlockhash = blockhash;
                    feeTx.feePayer = walletPublicKey;
                    const signedFeeTx = await signTransaction(feeTx);
                    const feeSig = await solanaConnection.sendRawTransaction(signedFeeTx.serialize(), {
                        skipPreflight: false,
                        preflightCommitment: 'confirmed',
                        maxRetries: 5
                    });
                    await confirmSignature(solanaConnection, feeSig);
                    setStatus('USDARK fee processed.');
                    setShowStatusModal(true);
                }
            }
            setStatus('Uploading to IPFS...');
            setShowStatusModal(true);
            const metadata = {
                name: tokenName,
                symbol: ticker,
                description: description,
                image: '',
                twitter: twitterUrl || undefined,
                telegram: telegramUrl || undefined,
                website: websiteUrl || undefined,
            };
            const { metadataUri, imageUrl } = await uploadToIPFS(imageFile, metadata, tokenName);
            setStatus('IPFS upload complete. Creating token...');
            setShowStatusModal(true);
            let mint;
            if (useVanityAddress) {
                setStatus('Generating vanity address...');
                setShowStatusModal(true);
                setVanityStatus('running');
                setVanityProgress(0);
                try {
                    const vanityKeypair = await generateVanityKeypair(setVanityProgress);
                    setVanityResult({
                        publicKey: vanityKeypair.publicKey.toBase58(),
                        secretKey: Array.from(vanityKeypair.secretKey)
                    });
                    setVanityStatus('done');
                    setStatus(`Vanity address generated: ...${vanityKeypair.publicKey.toBase58().slice(-10)}. Using vanity address...`);
                    setShowStatusModal(true);
                    mint = vanityKeypair;
                } catch (error) {
                    setVanityStatus('failed');
                    setVanityProgress(0);
                    throw error;
                }
            } else {
                mint = Keypair.generate();
            }
            const config = Keypair.generate();
            const curveConfig = buildCurveWithMarketCap({
                totalTokenSupply: TOTAL_SUPPLY_TOKENS,
                initialMarketCap: 30,
                migrationMarketCap: 270,
                migrationOption: MigrationOption.MET_DAMM_V2,
                tokenBaseDecimal: decimals === 6 ? TokenDecimal.SIX : TokenDecimal.NINE,
                tokenQuoteDecimal: TokenDecimal.NINE,
                lockedVestingParam: {
                    totalLockedVestingAmount: 0,
                    numberOfVestingPeriod: 0,
                    cliffUnlockAmount: 0,
                    totalVestingDuration: 0,
                    cliffDurationFromMigrationTime: 0,
                },
                baseFeeParams: {
                    baseFeeMode: BaseFeeMode.FeeSchedulerLinear,
                    feeSchedulerParam: {
                        startingFeeBps: 400,
                        endingFeeBps: 400,
                        numberOfPeriod: 0,
                        totalDuration: 0,
                    },
                },
                dynamicFeeEnabled: true,
                activationType: ActivationType.Slot,
                collectFeeMode: CollectFeeMode.QuoteToken,
                migrationFeeOption: MigrationFeeOption.FixedBps100,
                tokenType: TokenType.SPL,
                partnerLpPercentage: 0,
                creatorLpPercentage: 0,
                partnerLockedLpPercentage: 50,
                creatorLockedLpPercentage: 50,
                creatorTradingFeePercentage: 60,
                leftover: 1,
                tokenUpdateAuthority: TokenUpdateAuthorityOption.Immutable,
                migrationFee: {
                    feePercentage: 0,
                    creatorFeePercentage: 0,
                },
            });
            let { blockhash } = await timeoutPromise(solanaConnection.getLatestBlockhash('confirmed'), 10000);
            const baseTx = await client.partner.createConfig({
                config: config.publicKey,
                feeClaimer: FEE_WALLET,
                leftoverReceiver: FEE_WALLET,
                payer: walletPublicKey,
                quoteMint: NATIVE_MINT,
                ...curveConfig,
            });
            const feeTransferIx = SystemProgram.transfer({
                fromPubkey: walletPublicKey,
                toPubkey: FEE_WALLET,
                lamports: BASE_FEE,
            });
            baseTx.add(feeTransferIx);
            baseTx.recentBlockhash = blockhash;
            baseTx.feePayer = walletPublicKey;
            const messageV0 = new TransactionMessage({
                payerKey: walletPublicKey,
                recentBlockhash: blockhash,
                instructions: baseTx.instructions,
            }).compileToV0Message();
            const unsignedConfigTx = new VersionedTransaction(messageV0);
            unsignedConfigTx.sign([config]);
            let signedConfigTx = await signTransaction(unsignedConfigTx);
            let signature = await solanaConnection.sendRawTransaction(signedConfigTx.serialize(), {
                skipPreflight: false,
                preflightCommitment: 'confirmed',
                maxRetries: 5
            });
            await confirmSignature(solanaConnection, signature);
            setStatus('Config created. Creating pool...');
            setShowStatusModal(true);
            const { blockhash: poolBlockhash } = await timeoutPromise(solanaConnection.getLatestBlockhash('confirmed'), 10000);
            const createPoolParam = {
                baseMint: mint.publicKey,
                config: config.publicKey,
                name: tokenName,
                symbol: ticker,
                uri: metadataUri,
                payer: walletPublicKey,
                poolCreator: walletPublicKey,
            };
            const poolTx = await client.pool.createPool(createPoolParam);
            poolTx.recentBlockhash = poolBlockhash;
            poolTx.feePayer = walletPublicKey;
            poolTx.partialSign(mint);
            const signedPoolTx = await signTransaction(poolTx);
            signature = await solanaConnection.sendRawTransaction(signedPoolTx.serialize(), {
                skipPreflight: false,
                preflightCommitment: 'confirmed',
                maxRetries: 5
            });
            await confirmSignature(solanaConnection, signature);
            const [poolAddress] = PublicKey.findProgramAddressSync(
                [mint.publicKey.toBuffer(), NATIVE_MINT.toBuffer(), config.publicKey.toBuffer()],
                DBC_PROGRAM_ID
            );
            const bondingSupplyUnits = (BigInt(BONDING_SUPPLY_TOKENS) * (10n ** BigInt(decimals))).toString();
            const dexSupplyUnits = (BigInt(DEX_SUPPLY_TOKENS) * (10n ** BigInt(decimals))).toString();
            const newToken = {
                mint: mint.publicKey.toBase58(),
                pool: poolAddress.toBase58(),
                name: tokenName,
                symbol: ticker,
                description: description,
                image: imageUrl,
                totalSupplyUnits: (BigInt(TOTAL_SUPPLY_TOKENS) * (10n ** BigInt(decimals))).toString(),
                bondingSupplyUnits,
                dexSupplyUnits,
                decimals: decimals,
                creator: walletPublicKey.toString(),
                migrationTarget: MIGRATION_TARGET_SOL,
                solCollected: 0,
                tokensSoldUnits: '0',
                graduated: false,
                signature: signature,
                timestamp: Date.now(),
                metadataUri: metadataUri,
                twitter: twitterUrl || '',
                telegram: telegramUrl || '',
                website: websiteUrl || '',
                transactions: 0,
                holders: 0
            };
            setPendingTokenData(newToken);
            setShowInitialBuyModal(true);
        } catch (error) {
            console.error('Launch error:', error);
            setStatus(`Error: ${error.message}`);
            setShowStatusModal(true);
        } finally {
            setIsSending(false);
            setVanityProgress(0);
        }
    };
    const requireUsdark = USDARK_BYPASS === 1;
    const enoughSol = userSolBalance >= 0.02;
    const enoughUsdark = !requireUsdark || userUsdarkBalance >= LAUNCH_FEE_USDARK;
    const formComplete = tokenName && ticker && description && imageFile;
    const currentBalance = modalTab === 'buy' ? userSolBalance : userTokenBalance;
    return (
        <>
            <div className="app-container">
                {/* Header */}
                <header className="header">
                    <div className="logo"><img src="/logo.png" alt="logo" />USDARK PAD</div>
                    <div className="header-actions">
                        <select value={network} onChange={(e) => setNetwork(e.target.value)} style={{ padding: '8px', borderRadius: '8px', background: 'rgba(255,255,255,0.1)', color: '#1cc29a', border: '1px solid #1cc29a' }}>
                            <option value="devnet">Devnet</option>
                            <option value="mainnet">Mainnet</option>
                        </select>
                        <button
                            className="create-coin desktop-only"
                            onClick={() => setActivePage('launch')}
                        >
                            Create Token
                        </button>
                        <button
                            className="mobile-menu-toggle"
                            onClick={() => setShowMobileMenu(!showMobileMenu)}
                        >
                            {showMobileMenu ? <X size={24} /> : <Menu size={24} />}
                        </button>
                        <div className="wallet desktop-only">
                            {/* icon */}
                            <WalletMultiButton />
                        </div>
                    </div>
                </header>
                <div style={{ display: 'flex', width: '100%', height: '100%' }}>
                    {/* Sidebar */}
                    <nav className={`sidebar ${showMobileMenu ? 'open' : ''}`}>
                        <button
                            className={activePage === 'home' ? 'active' : ''}
                            onClick={() => {
                                setActivePage('home');
                                setShowMobileMenu(false);
                            }}
                        >
                            <Home size={20} /> Home
                        </button>
                        <button
                            className={activePage === 'launch' ? 'active' : ''}
                            onClick={() => {
                                setActivePage('launch');
                                setShowMobileMenu(false);
                            }}
                        >
                            <Rocket size={20} /> Launch
                        </button>
                        <button
                            className={activePage === 'profile' ? 'active' : ''}
                            onClick={() => {
                                setActivePage('profile');
                                setShowMobileMenu(false);
                            }}
                        >
                            <User size={20} /> Profile
                        </button>
                        <div className="mobile-only" style={{ marginTop: '-19px' }}>
                            <div className={`wallet ${!connected ? 'has-icon' : ''}`}>
                                {!connected && <Wallet size={20} />}
                                <WalletMultiButton />
                            </div>
                        </div>
                    </nav>
                    {/* Main Content */}
                    <main className="main-content">
                        {activePage === 'home' && (
                            <div className="home-page">
                                {/* Hero Section */}
                                <div className="home-hero">
                                    <h1>Launch Your Token on Solana</h1>
                                    <p>Experience fair launches with dynamic bonding curves. Powered by Meteora and USDARK protocol for maximum deflationary impact.</p>
                                </div>
                                {/* Trending Bar */}
                                <div className="trending-bar">
                                    <TrendingUp size={24} />
                                    <span>RECENTLY LAUNCHED TOKENS</span>
                                </div>
                                {/* Filters */}
                                <div className="filters">
                                    <button>All Tokens ({filteredTokens.length})</button>
                                    <button>Active ({filteredTokens.filter(t => !t.graduated).length})</button>
                                    <button>Graduated ({filteredTokens.filter(t => t.graduated).length})</button>
                                    <div className="search-container">
                                        <input
                                            type="text"
                                            className="search-input"
                                            placeholder="Search by name or ticker..."
                                            value={searchQuery}
                                            onChange={e => setSearchQuery(e.target.value)}
                                        />
                                        <button className="search-button">
                                            <Search size={18} /> Search
                                        </button>
                                    </div>
                                </div>
                                {/* Token Grid */}
                                {isLoadingTokens ? (
                                    <div className="no-tokens">
                                        <Loader2 size={48} className="animate-spin mx-auto" />
                                        <p>Loading tokens from database...</p>
                                    </div>
                                ) : filteredTokens.length === 0 ? (
                                    <div className="no-tokens">
                                        <Rocket size={48} className="mx-auto" />
                                        <p>No tokens found</p>
                                        <p>Launch your first memecoin and join the USDARK revolution!</p>
                                    </div>
                                ) : (
                                    <div className="token-grid">
                                        {filteredTokens.map((token, index) => (
                                            <TokenCard
                                                key={token.id || token.mint || index}
                                                token={token}
                                                onAction={handleTokenAction}
                                                solPrice={solPrice}
                                                metrics={tokenMetrics[token.mint]}
                                            />
                                        ))}
                                    </div>
                                )}
                            </div>
                        )}
                        {activePage === 'launch' && (
                            <div className="launch-container">
                                {/* Launch Form */}
                                <div className="launch-form-container">
                                    <h1>Launch Your Token</h1>
                                    <form className="launch-form">
                                        <div className="input-group">
                                            <label>Name</label>
                                            <input
                                                type="text"
                                                placeholder="Enter token name (max 32 chars)"
                                                value={tokenName}
                                                onChange={e => setTokenName(e.target.value)}
                                                maxLength={32}
                                            />
                                        </div>
                                        <div className="input-group">
                                            <label>Ticker</label>
                                            <input
                                                type="text"
                                                placeholder="Enter ticker symbol (max 10 chars)"
                                                value={ticker}
                                                onChange={e => setTicker(e.target.value.toUpperCase())}
                                                maxLength={10}
                                            />
                                        </div>
                                        <div className="input-group">
                                            <label>Description</label>
                                            <textarea
                                                placeholder="Describe your token (max 1000 chars)"
                                                value={description}
                                                onChange={e => setDescription(e.target.value)}
                                                maxLength={1000}
                                            />
                                        </div>
                                        <div className="input-group">
                                            <label>Token Image</label>
                                            <input
                                                type="file"
                                                accept="image/png,image/jpeg,image/gif"
                                                onChange={handleImageChange}
                                            />
                                            {imagePreview && (
                                                <img
                                                    src={imagePreview}
                                                    alt="Preview"
                                                    className="preview-media"
                                                />
                                            )}
                                            <p>PNG, JPG, GIF. Max 2MB</p>
                                        </div>
                                        <div className="input-group">
                                            <label>Decimals</label>
                                            <select
                                                value={decimals}
                                                onChange={e => setDecimals(parseInt(e.target.value))}
                                            >
                                                <option value={6}>6</option>
                                                <option value={9}>9</option>
                                            </select>
                                            <p>Choose between 6 or 9 decimals</p>
                                        </div>
                                        <div className="input-group">
                                            <label>Total Supply</label>
                                            <p>Fixed: 1,000,000,000 tokens</p>
                                        </div>
                                        <div className="input-group">
                                            <label>Migration Target (SOL)</label>
                                            <p>Fixed: 40 SOL. When this amount is collected, token graduates to DEX.</p>
                                        </div>
                                        <div className="input-group">
                                            <label>Twitter / X (Optional)</label>
                                            <input
                                                type="url"
                                                placeholder="https://twitter.com/yourproject"
                                                value={twitterUrl}
                                                onChange={e => setTwitterUrl(e.target.value)}
                                            />
                                        </div>
                                        <div className="input-group">
                                            <label>Telegram (Optional)</label>
                                            <input
                                                type="url"
                                                placeholder="https://t.me/yourproject"
                                                value={telegramUrl}
                                                onChange={e => setTelegramUrl(e.target.value)}
                                            />
                                        </div>
                                        <div className="input-group">
                                            <label>Website (Optional)</label>
                                            <input
                                                type="url"
                                                placeholder="https://yourproject.com"
                                                value={websiteUrl}
                                                onChange={e => setWebsiteUrl(e.target.value)}
                                            />
                                        </div>
                                        <div className="input-group">
                                            <label>Vanity Address (Optional)</label>
                                            <div className="checkbox">
                                                <input
                                                    type="checkbox"
                                                    id="use-vanity"
                                                    checked={useVanityAddress}
                                                    onChange={e => {
                                                        setUseVanityAddress(e.target.checked);
                                                        if (!e.target.checked) {
                                                            setVanityResult(null);
                                                            setVanityStatus('idle');
                                                            setVanityProgress(0);
                                                        }
                                                    }}
                                                />
                                                <label htmlFor="use-vanity">Use DRK Vanity Address</label>
                                            </div>
                                            <p style={{ fontSize: '0.85em', color: '#ccc' }}>Generation will start during launch (may take 1-5 minutes on average, non-blocking).</p>
                                            {vanityStatus === 'running' && (
                                                <div style={{ fontSize: '0.8em', color: '#1cc29a' }}>
                                                    Progress: {Math.round((vanityProgress / 1000000) * 100)}% ({vanityProgress.toLocaleString()} attempts)
                                                </div>
                                            )}
                                        </div>
                                        <button
                                            type="button"
                                            className="launch-button"
                                            onClick={handleLaunchToken}
                                            disabled={isSending || !solanaConnection || !connected || !formComplete || !enoughSol || !enoughUsdark}
                                        >
                                            {isSending ? 'Launching...' : USDARK_BYPASS === 1 ? 'Launch Token (0.02 SOL + 2000 USDARK)' : 'Launch Token (0.02 SOL)'}
                                        </button>
                                        {!enoughSol && <p style={{ color: 'red' }}>Insufficient SOL balance (need at least 0.05 SOL for fees and rent)</p>}
                                        {requireUsdark && !enoughUsdark && <p style={{ color: 'red' }}>Insufficient USDARK balance (need at least 2000 USDARK)</p>}
                                        {!formComplete && <p style={{ color: 'red' }}>Please complete all required fields</p>}
                                        {useVanityAddress && vanityStatus === 'failed' && <p style={{ color: 'red' }}>Vanity generation failed. Uncheck to use random address.</p>}
                                    </form>
                                </div>
                                {/* Live Preview Panel */}
                                <div className="preview-panel">
                                    <div>
                                        <h2 style={{ marginBottom: '20px', fontFamily: 'Orbitron', fontSize: '1.5em' }}>Live Preview</h2>
                                        <div className="preview-content">
                                            {imagePreview ? (
                                                <img
                                                    src={imagePreview}
                                                    alt="Token preview"
                                                    style={{ width: '100%', height: '200px', objectFit: 'cover', borderRadius: '12px', marginBottom: '15px' }}
                                                />
                                            ) : (
                                                <div className="preview-image-placeholder">
                                                    Upload image to preview
                                                </div>
                                            )}
                                            <h3 style={{ marginBottom: '10px', fontSize: '1.3em' }}>{tokenName || 'Token Name'} ({ticker || 'TICKER'})</h3>
                                            <p style={{ color: '#ccc', marginBottom: '15px', fontSize: '0.9em' }}>{description || 'Enter a description for your token...'}</p>
                                            <div className="preview-stats">
                                                <div>
                                                    <span>Total Supply</span>
                                                    <span>1B</span>
                                                </div>
                                                <div>
                                                    <span>Decimals</span>
                                                    <span>{decimals}</span>
                                                </div>
                                                <div>
                                                    <span>Migration Target</span>
                                                    <span>40 SOL</span>
                                                </div>
                                            </div>
                                            <div className="bonding-info">
                                                <div>SOL Collected: 0 / 40</div>
                                                <div>Progress: 0%</div>
                                            </div>
                                            <div className="progress-bar">
                                                <div className="progress" style={{ width: '0%' }}></div>
                                            </div>
                                            <div className="preview-fee">
                                                <div><DollarSign size={16} style={{ display: 'inline', marginRight: '5px' }} /> Launch Fee: 0.02 SOL (~$3 USD) {USDARK_BYPASS === 1 ? '+ 2000 USDARK (sent to fee wallet)' : ''}</div>
                                                <div>Bonding Curve: Manual trading until 40 SOL</div>
                                                {useVanityAddress && (
                                                    <div>Vanity: ...DRK</div>
                                                )}
                                            </div>
                                            <button className="preview-button" onClick={() => setShowLaunchInfoModal(true)}>View Launch Details</button>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}
                        {activePage === 'profile' && (
                            <div className="profile-container">
                                <div className="profile-header">
                                    <h1>Creator Dashboard</h1>
                                    <p>Manage your tokens and claim your trading fees</p>
                                </div>
                                {userTokens.length === 0 ? (
                                    <div className="no-tokens profile-no-tokens">
                                        <User size={48} className="mx-auto" />
                                        <p>No tokens created yet</p>
                                        <button className="create-coin" onClick={() => setActivePage('launch')}>
                                            Launch Your First Token
                                        </button>
                                    </div>
                                ) : (
                                    <div className="user-tokens-list">
                                        {userTokens.map((token) => (
                                            <div key={token.id || token.mint} className="user-token-item">
                                                <div className="user-token-info">
                                                    <img
                                                        src={token.image || 'https://via.placeholder.com/80?text=USDARK'}
                                                        alt={token.name}
                                                        className="user-token-image"
                                                        onError={(e) => (e.target.src = 'https://via.placeholder.com/80?text=USDARK')}
                                                    />
                                                    <div className="user-token-details">
                                                        <h3>{token.name} ({token.symbol})</h3>
                                                        <p className="mint-address">{token.mint.substring(0, 8)}...{token.mint.slice(-8)}</p>
                                                        <div className="user-token-stats">
                                                            <span>SOL Collected: {token.solCollected.toFixed(2)}</span>
                                                            {token.graduated && <span className="graduated-tag">Graduated</span>}
                                                        </div>
                                                    </div>
                                                </div>
                                                <div className="user-token-fees">
                                                    <div className="claimable-fee">
                                                        <DollarSign size={16} />
                                                        <span>{(claimableFees[token.mint] || 0).toFixed(4)} SOL</span>
                                                        {/* <small>(60% of fees)</small> */}
                                                    </div>
                                                    <button
                                                        className="claim-button"
                                                        onClick={() => handleClaim(token)}
                                                        disabled={isSending || (claimableFees[token.mint] || 0) <= 0}
                                                    >
                                                        {isSending ? <Loader2 className="animate-spin mr-2" size={16} /> : <DollarSign size={16} className="mr-2" />}
                                                        {isSending ? 'Claiming...' : 'Claim Fees'}
                                                    </button>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        )}
                    </main>
                </div>
            </div>
            {/* Token Detail Modal */}
            {showModal && selectedToken && (
                <div className="modal-overlay" onClick={() => setShowModal(false)}>
                    <div className="modal-content" onClick={(e) => e.stopPropagation()}>
                        <div className="modal-header">
                            <h2>{selectedToken.name} ({selectedToken.symbol})</h2>
                            <button className="modal-close" onClick={() => setShowModal(false)}>×</button>
                        </div>
                        <div className="modal-body">
                            <img
                                src={selectedToken.image || 'https://via.placeholder.com/600x250?text=USDARK'}
                                alt={selectedToken.name}
                                className="token-detail-image"
                                onError={(e) => e.target.src = 'https://via.placeholder.com/600x250?text=USDARK'}
                            />
                            <p style={{ color: '#ccc', fontSize: '0.95em' }}> {selectedToken.description}</p>
                            {/* Social Links */}
                            {(selectedToken.twitter || selectedToken.telegram || selectedToken.website) && (
                                <div className="social-links-large">
                                    {selectedToken.twitter && (
                                        <a href={selectedToken.twitter} target="_blank" rel="noopener noreferrer">
                                            <Twitter size={20} />
                                        </a>
                                    )}
                                    {selectedToken.telegram && (
                                        <a href={selectedToken.telegram} target="_blank" rel="noopener noreferrer">
                                            <Send size={20} />
                                        </a>
                                    )}
                                    {selectedToken.website && (
                                        <a href={selectedToken.website} target="_blank" rel="noopener noreferrer">
                                            <Globe size={20} />
                                        </a>
                                    )}
                                </div>
                            )}
                            {/* Contract Address */}
                            <div className="ca-copy-section">
                                <span className="ca-address">Contract: {selectedToken.mint}</span>
                                <button
                                    className={`copy-button ${copiedCA ? 'copied' : ''}`}
                                    onClick={() => handleCopyCA(selectedToken.mint)}
                                >
                                    {copiedCA ? '✓ Copied' : 'Copy CA'}
                                </button>
                            </div>
                            {/* Token Stats */}
                            <div className="preview-stats">
                                <div>
                                    <span>Total Supply</span>
                                    <span>1B</span>
                                </div>
                                <div>
                                    <span>Decimals</span>
                                    <span>{selectedToken.decimals}</span>
                                </div>
                                <div>
                                    <span>Creator</span>
                                    <span style={{ fontSize: '0.85em' }}>
                                        {selectedToken.creator.substring(0, 6)}...{selectedToken.creator.slice(-6)}
                                    </span>
                                </div>
                            </div>
                            {/* Advanced Metrics */}
                            <div style={{ background: 'rgba(0, 0, 0, 0.3)', padding: '20px', borderRadius: '15px', marginTop: '20px', border: '1px solid rgba(28, 194, 154, 0.1)' }}>
                                <h3 style={{ marginTop: 0, marginBottom: '20px', color: '#1cc29a', fontFamily: 'Orbitron' }}>Token Metrics</h3>
                                {(() => {
                                    const virtualSol = 30;
                                    const virtualTokens = 200000000;
                                    const tokensSoldUnits = selectedToken.tokensSoldUnits || '0';
                                    const decimalsBig = BigInt(selectedToken.decimals);
                                    const pow10 = 10n ** decimalsBig;
                                    const remainingTokens = BONDING_SUPPLY_TOKENS - Number(BigInt(tokensSoldUnits) / pow10);
                                    const effectiveSol = virtualSol + selectedToken.solCollected;
                                    const effectiveTokens = virtualTokens + remainingTokens;
                                    const priceSol = effectiveSol / effectiveTokens;
                                    const curvePrice = priceSol * solPrice;
                                    const circulatingTokens = Number(BigInt(tokensSoldUnits) / pow10);
                                    const curveMcap = circulatingTokens * curvePrice;
                                    const curveFdv = TOTAL_SUPPLY_TOKENS * curvePrice;
                                    const curveLiquidity = selectedToken.solCollected * solPrice;
                                    const curveVolume = selectedToken.solCollected * solPrice;
                                    const curveCirculating = circulatingTokens;
                                    const m = tokenMetrics[selectedToken.mint];
                                    let price = curvePrice;
                                    let mcap = curveMcap;
                                    let fdv = curveFdv;
                                    let liquidity = curveLiquidity;
                                    let volume = curveVolume;
                                    let circulating = curveCirculating;
                                    let holders = selectedToken.holders || 0;
                                    if (selectedToken.graduated && m) {
                                        price = m.priceUsd || curvePrice;
                                        mcap = m.mcap || (TOTAL_SUPPLY_TOKENS * price);
                                        fdv = m.fdv || (TOTAL_SUPPLY_TOKENS * price);
                                        liquidity = m.liquidity || curveLiquidity;
                                        volume = m.volume24h || curveVolume;
                                        circulating = TOTAL_SUPPLY_TOKENS;
                                    } else {
                                        circulating = circulatingTokens > 0 ? circulatingTokens : TOTAL_SUPPLY_TOKENS;
                                        mcap = circulating * price;
                                    }
                                    return (
                                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '15px' }}>
                                            <div>
                                                <div style={{ color: '#888', fontSize: '0.85em' }}>Price (USD)</div>
                                                <div style={{ color: '#1cc29a', fontWeight: 'bold' }}>${price > 0 ? price.toFixed(8) : '0.00000000'}</div>
                                            </div>
                                            <div>
                                                <div style={{ color: '#888', fontSize: '0.85em' }}>Market Cap</div>
                                                <div style={{ color: '#1cc29a', fontWeight: 'bold' }}>${mcap.toFixed(2)}</div>
                                            </div>
                                            <div>
                                                <div style={{ color: '#888', fontSize: '0.85em' }}>FDV</div>
                                                <div style={{ color: '#1cc29a', fontWeight: 'bold' }}>${fdv.toFixed(2)}</div>
                                            </div>
                                            <div>
                                                <div style={{ color: '#888', fontSize: '0.85em' }}>Liquidity</div>
                                                <div style={{ color: '#1cc29a', fontWeight: 'bold' }}>${liquidity.toFixed(2)}</div>
                                            </div>
                                            <div>
                                                <div style={{ color: '#888', fontSize: '0.85em' }}>Volume (24h)</div>
                                                <div style={{ color: '#1cc29a', fontWeight: 'bold' }}>${volume.toFixed(2)}</div>
                                            </div>
                                            <div>
                                                <div style={{ color: '#888', fontSize: '0.85em' }}>Holders</div>
                                                <div style={{ color: '#1cc29a', fontWeight: 'bold' }}>{holders}</div>
                                            </div>
                                            <div>
                                                <div style={{ color: '#888', fontSize: '0.85em' }}>Circulating Supply</div>
                                                <div style={{ color: '#1cc29a', fontWeight: 'bold' }}>{circulating.toFixed(0)}</div>
                                            </div>
                                        </div>
                                    );
                                })()}
                            </div>
                            {selectedToken.graduated ? (
                                <div className="preview-fee" style={{ background: 'linear-gradient(45deg, rgba(255, 149, 0, 0.1), rgba(255, 170, 0, 0.1))', color: '#ff9500', margin: '20px 0' }}>
                                    <div>Token Graduated!</div>
                                    <div>Trade on Raydium or Jupiter</div>
                                </div>
                            ) : (
                                <>
                                    <div className="bonding-info">
                                        <div>SOL Collected: {selectedToken.solCollected.toFixed(2)} / {MIGRATION_TARGET_SOL}</div>
                                        <div>Progress: {((selectedToken.solCollected / MIGRATION_TARGET_SOL) * 100).toFixed(1)}%</div>
                                    </div>
                                    <div className="progress-bar">
                                        <div
                                            className="progress"
                                            style={{ width: `${Math.min((selectedToken.solCollected / MIGRATION_TARGET_SOL) * 100, 100)}%` }}
                                        ></div>
                                    </div>
                                </>
                            )}
                            {connected && (
                                <div style={{
                                    background: 'rgba(0, 0, 0, 0.3)',
                                    padding: '15px',
                                    borderRadius: '12px',
                                    marginBottom: '20px',
                                    border: '1px solid rgba(28, 194, 154, 0.1)'
                                }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px' }}>
                                        <span style={{ color: '#888' }}>Your SOL Balance:</span>
                                        <span style={{ color: '#1cc29a', fontWeight: 'bold' }}>{userSolBalance.toFixed(4)} SOL</span>
                                    </div>
                                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                        <span style={{ color: '#888' }}>Your {selectedToken.symbol} Balance:</span>
                                        <span style={{ color: '#1cc29a', fontWeight: 'bold' }}>{userTokenBalance.toFixed(2)} {selectedToken.symbol}</span>
                                    </div>
                                </div>
                            )}
                            {/* Trade Tabs */}
                            <div className="trade-tabs">
                                <button
                                    className={`trade-tab ${modalTab === 'buy' ? 'active' : ''}`}
                                    onClick={() => { setModalTab('buy'); setTradeAmount(''); setOutputAmount(''); }}
                                >
                                    Buy
                                </button>
                                <button
                                    className={`trade-tab ${modalTab === 'sell' ? 'active' : ''}`}
                                    onClick={() => { setModalTab('sell'); setTradeAmount(''); setOutputAmount(''); }}
                                >
                                    Sell
                                </button>
                            </div>
                            {/* Trade Input */}
                            <div className="trade-input-group">
                                <label>{modalTab === 'buy' ? 'Amount (SOL)' : `Amount (${selectedToken.symbol})`}</label>
                                <input
                                    type="number"
                                    step="0.01"
                                    min="0"
                                    placeholder={modalTab === 'buy' ? 'Enter SOL amount' : 'Enter token amount'}
                                    value={tradeAmount}
                                    onChange={(e) => setTradeAmount(e.target.value)}
                                />
                                <p style={{ color: '#888', fontSize: '0.85em' }}>
                                    Balance: {currentBalance.toFixed(modalTab === 'buy' ? 4 : 2)} {modalTab === 'buy' ? 'SOL' : selectedToken.symbol}
                                </p>
                                {outputAmount && (
                                    <div style={{ color: '#1cc29a', fontSize: '0.95em', marginTop: '5px' }}>
                                        Output: {outputAmount} {modalTab === 'buy' ? selectedToken.symbol : 'SOL'}
                                    </div>
                                )}
                                <div className="quick-buttons" style={{ display: 'flex', justifyContent: 'space-between', marginTop: '10px' }}>
                                    {[25, 50, 75].map(p => (
                                        <button
                                            key={p}
                                            type="button"
                                            onClick={() => handleQuickAmount(p)}
                                            style={{ flex: 1, padding: '5px 10px', marginRight: '5px', background: 'rgba(28, 194, 154, 0.2)', border: '1px solid #1cc29a', color: '#1cc29a', borderRadius: '4px' }}
                                        >
                                            {p}%
                                        </button>
                                    ))}
                                    <button
                                        type="button"
                                        onClick={() => handleQuickAmount(100)}
                                        style={{ padding: '5px 10px', background: 'rgba(28, 194, 154, 0.2)', border: '1px solid #1cc29a', color: '#1cc29a', borderRadius: '4px' }}
                                    >
                                        Max
                                    </button>
                                </div>
                            </div>
                            <div className="trade-input-group">
                                <label>Slippage (%)</label>
                                <input
                                    type="number"
                                    step="0.1"
                                    min="0.1"
                                    value={slippage}
                                    onChange={(e) => setSlippage(Math.max(0.1, parseFloat(e.target.value) || 0.5))}
                                />
                            </div>
                            {tradeError && <div style={{ color: '#ff6666', fontSize: '0.85em', marginBottom: '10px' }}>{tradeError}</div>}
                            {isFetchingQuote && <div style={{ color: '#888', textAlign: 'center', marginBottom: '10px' }}>Loading quote...</div>}
                            <button
                                className="trade-button"
                                onClick={handleTrade}
                                disabled={!connected || !tradeAmount || parseFloat(tradeAmount) <= 0 || isSending || isFetchingQuote}
                            >
                                {isSending ? <Loader2 className="animate-spin" size={20} style={{ display: 'inline', marginRight: '8px' }} /> : null}
                                {isSending ? 'Processing...' : (modalTab === 'buy' ? 'Buy' : 'Sell') + ` ${selectedToken.symbol}`}
                            </button>
                            {/* Transaction Link */}
                            {selectedToken.signature && (
                                <div style={{ marginTop: '25px', textAlign: 'center' }}>
                                    <a
                                        href={`https://explorer.solana.com/tx/${selectedToken.signature}?cluster=${network}`}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        style={{ color: '#1cc29a', textDecoration: 'none', fontWeight: '500', padding: '10px 20px', border: '1px solid rgba(28, 194, 154, 0.2)', borderRadius: '10px', transition: 'all 0.2s ease' }}
                                        onMouseOver={(e) => e.target.style.background = 'rgba(28, 194, 154, 0.1)'}
                                        onMouseOut={(e) => e.target.style.background = 'transparent'}
                                    >
                                        View Launch Transaction
                                    </a>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}
            {/* Initial Buy Modal */}
            {showInitialBuyModal && pendingTokenData && (
                <div className="modal-overlay">
                    <div className="modal-content" onClick={(e) => e.stopPropagation()}>
                        <div className="modal-header">
                            <h2>Token Launched Successfully!</h2>
                        </div>
                        <div className="modal-body">
                            <div style={{ textAlign: 'center', marginBottom: '25px' }}>
                                <img
                                    src={pendingTokenData.image || 'https://via.placeholder.com/200?text=USDARK'}
                                    alt={pendingTokenData.name}
                                    style={{ width: '160px', height: '160px', objectFit: 'cover', borderRadius: '15px', margin: '0 auto', border: '1px solid rgba(28, 194, 154, 0.2)' }}
                                />
                                <h3 style={{ marginTop: '15px', fontSize: '1.4em' }}>{pendingTokenData.name} ({pendingTokenData.symbol})</h3>
                            </div>
                            <div style={{ background: 'rgba(28, 194, 154, 0.05)', padding: '20px', borderRadius: '15px', marginBottom: '25px', border: '1px solid rgba(28, 194, 154, 0.2)' }}>
                                <p style={{ color: '#1cc29a', textAlign: 'center', marginBottom: '12px', fontWeight: '500' }}>
                                    Be the first buyer of your token!
                                </p>
                                <p style={{ color: '#ccc', fontSize: '0.95em', textAlign: 'center' }}>
                                    Make an initial purchase to kickstart your token's bonding curve
                                </p>
                            </div>
                            <div className="trade-input-group">
                                <label>Initial Buy Amount (SOL)</label>
                                <input
                                    type="number"
                                    step="0.1"
                                    min="0"
                                    placeholder="Enter SOL amount (e.g., 0.5)"
                                    value={initialBuyAmount}
                                    onChange={(e) => setInitialBuyAmount(e.target.value)}
                                />
                                <p style={{ color: '#888', fontSize: '0.9em', marginTop: '8px', textAlign: 'center' }}>
                                    You'll receive approximately {initialBuyAmount && parseFloat(initialBuyAmount) > 0
                                        ? (Number(calculateTokensOut(
                                            parseFloat(initialBuyAmount) * LAMPORTS_PER_SOL,
                                            0,
                                            pendingTokenData.bondingSupplyUnits,
                                            pendingTokenData.decimals
                                        )) / (10 ** pendingTokenData.decimals)).toFixed(0)
                                        : '0'} {pendingTokenData.symbol} tokens
                                </p>
                            </div>
                            <button
                                className="trade-button"
                                onClick={handleTrade}
                                disabled={!initialBuyAmount || parseFloat(initialBuyAmount) <= 0 || isSending}
                                style={{ marginBottom: '15px' }}
                            >
                                {isSending ? <Loader2 className="animate-spin mr-2" size={16} /> : null}
                                {isSending ? 'Processing...' : `Buy ${initialBuyAmount || '0'} SOL Worth`}
                            </button>
                            <button
                                className="trade-button"
                                onClick={handleSkipInitialBuy}
                                disabled={isSending}
                                style={{ background: 'rgba(255, 255, 255, 0.1)', color: '#fff', border: '1px solid rgba(255, 255, 255, 0.2)' }}
                            >
                                Skip Initial Buy
                            </button>
                        </div>
                    </div>
                </div>
            )}
            {/* Status Modal */}
            {/* {showStatusModal && (
                <div className="modal-overlay" onClick={() => setShowStatusModal(false)}>
                    <div className="modal-content status-modal-content" onClick={(e) => e.stopPropagation()}>
                        <div className="modal-header">
                            <h2>Status Update</h2>
                            <button className="modal-close" onClick={() => setShowStatusModal(false)}>×</button>
                        </div>
                        <div className="modal-body status-modal-body">
                            <p className={status.includes('Error:') ? 'status-error' : status.includes('successful') || status.includes('launched') ? 'status-success' : ''}>
                                {status}
                            </p>
                            <button
                                className="trade-button"
                                onClick={() => setShowStatusModal(false)}
                                style={{ background: status.includes('Error:') ? '#ff6666' : '#1cc29a', color: '#000' }}
                            >
                                Dismiss
                            </button>
                        </div>
                    </div>
                </div>
            )} */}
            {/* Launch Info Modal */}
            {showLaunchInfoModal && (
                <div className="modal-overlay" onClick={() => setShowLaunchInfoModal(false)}>
                    <div className="modal-content" onClick={(e) => e.stopPropagation()}>
                        <div className="modal-header">
                            <h2>Launch Details</h2>
                            <button className="modal-close" onClick={() => setShowLaunchInfoModal(false)}>×</button>
                        </div>
                        <div className="modal-body launch-info-modal-body">
                            <h3>Launch Fee</h3>
                            <p>Projected to be approximately 2,000 $USDARK.</p>
                            <h3>Deflationary Mechanism</h3>
                            <p>100% of these fees will be sent directly to the fee wallet address. This process will also integrate the x420 protocol. This is a strong start for our journey in this new wave, and we are committed to developing it further.</p>
                            <h3>Dynamic Fee</h3>
                            <p>The 2,000 $USDARK fee is not fixed. If the price of $USDARK increases, the fee (in $USDARK) will be adjusted downwards. This ensures the launchpad remains accessible while establishing a powerful, deflationary mechanism for the token supply.</p>
                            <h3>Major Liquidity & Burn Update</h3>
                            <ol>
                                <li>Add 20% of the total supply to the liquidity pool.</li>
                                <li>Use ALL generated Meteora fees for a continuous buyback and burn of $USDARK.</li>
                            </ol>
                            <p>These steps will contribute significantly to the long-term growth and sustainability of $USDARK.</p>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}
export default App;