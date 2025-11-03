import React, { useState, useEffect, useMemo } from 'react';
import { Connection, PublicKey, SystemProgram, Transaction, LAMPORTS_PER_SOL, Keypair, TransactionInstruction, TransactionMessage, VersionedTransaction } from '@solana/web3.js';
import {
    TOKEN_PROGRAM_ID,
    ASSOCIATED_TOKEN_PROGRAM_ID,
    createTransferInstruction,
    createAssociatedTokenAccountInstruction,
    getAssociatedTokenAddressSync,
    MintLayout,
    createInitializeMintInstruction,
    getMinimumBalanceForRentExemptMint,
    createMintToInstruction,
    AuthorityType,
    createSetAuthorityInstruction,
    NATIVE_MINT,
    createBurnInstruction
} from '@solana/spl-token';
import { useWallet } from '@solana/wallet-adapter-react';
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui';
import { Home, Rocket, TrendingUp, Search, Menu, X, Info, DollarSign } from 'lucide-react';
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
// --- CONFIGURATION CONSTANTS ---
const NETWORKS = {
    'devnet': [
        'https://api.devnet.solana.com',
        'https://devnet.solana.com',
        'https://dawn-devnet.solana.com'
    ],
    'mainnet': [
        'https://solana-rpc.publicnode.com',
        'https://api.mainnet-beta.solana.com',
        'https://rpc.ankr.com/solana',
        'https://solana-mainnet.g.alchemy.com/v2/demo', // Additional fallback
        'https://mainnet.rpcpool.com' // Additional fallback
    ]
};
const DEFAULT_NETWORK = 'mainnet';
// Firebase Configuration
const firebaseConfig = {
    apiKey: "AIzaSyBmF3F8CgYQfpqN6xSpeL0rkJvpshFLmwk",
    authDomain: "usdark-launchpad.firebaseapp.com",
    projectId: "usdark-launchpad",
    storageBucket: "usdark-launchpad.firebasestorage.app",
    messagingSenderId: "54701943971",
    appId: "1:54701943971:web:295fa5465d713d28502316"
};
// Initialize Firebase
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
const BASE_FEE = 0.02 * LAMPORTS_PER_SOL; // Launch fee in SOL
const PINATA_JWT = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySW5mb3JtYXRpb24iOnsiaWQiOiJhMTNlMDlhMy1hYmJjLTQwOWYtOTdmMi1mNGY0N2Y2ODUzZDYiLCJlbWFpbCI6ImFncmFiaW9oYXJ2ZXlAZ21haWwuY29tIiwiZW1haWxfdmVyaWZpZWQiOnRydWUsInBpbl9wb2xpY3kiOnsicmVnaW9ucyI6W3siZGVzaXJlZFJlcGxpY2F0aW9uQ291bnQiOjEsImlkIjoiRlJBMSJ9LHsiZGVzaXJlZFJlcGxpY2F0aW9uQ291bnQiOjEsImlkIjoiTllDMSJ9XSwidmVyc2lvbiI6MX0sIm1mYV9lbmFibGVkIjpmYWxzZSwic3RhdHVzIjoiQUNUSVZFIn0sImF1dGhlbnRpY2F0aW9uVHlwZSI6InNjb3BlZEtleSIsInNjb3BlZEtleUtleSI6IjE2MTc1YTM5NTE5NWFmMWVjNjk5Iiwic2NvcGVkS2V5U2VjcmV0IjoiY2FjNWI4NmRjYjkxMzBlYWQ5NWM4MTZmMzk3ZWZiMWUyZTIwMzQxZjM1OGMxMzk5YTE0ZWYzYjczNjNkYmE0MSIsImV4cCI6MTc5MTg5MjU4NH0.ZRvRz1xkIvI0VN-Xd44ZdXSUEMhVyK-TaNFPk4BOZYs';
const TOTAL_SUPPLY_TOKENS = 1000000000;
const BONDING_SUPPLY_TOKENS = 800000000;
const DEX_SUPPLY_TOKENS = 200000000;
const MIGRATION_TARGET_SOL = 85;
const VIRTUAL_SOL_LAMPORTS = BigInt(30 * LAMPORTS_PER_SOL);
const VIRTUAL_TOKENS_BASE = 200000000n;
const DBC_PROGRAM_ID = new PublicKey('dbcij3LWUppWqq96dh6gJWwBifmcGfLSB5D4DuSMaqN');
const USDARK_MINT = new PublicKey('4EKDKWJDrqrCQtAD6j9sM5diTeZiKBepkEB8GLP9Dark');
const USDARK_DECIMALS = 6; // Assuming 6 decimals for USDARK
const LAUNCH_FEE_USDARK = 2000; // UI amount of USDARK required
const USDARK_BYPASS = 1; // 0 for development (skip check/fee), 1 for mandatory
// Helper functions
const generateVanityKeypair = (suffix, maxAttempts = 100000, onProgress = null) => {
    const upperSuffix = suffix.toUpperCase();
    for (let i = 0; i < maxAttempts; i++) {
        const keypair = Keypair.generate();
        const address = keypair.publicKey.toBase58();
        if (address.endsWith(upperSuffix)) {
            console.log(`Found vanity address after ${i + 1} attempts: ${address}`);
            return keypair;
        }
        if (onProgress && i > 0 && i % 1000 === 0) {
            onProgress(i);
        }
    }
    console.log(`Could not find vanity address after ${maxAttempts} attempts, using random`);
    return Keypair.generate();
};
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
        if (imageFile) {
            imageHash = await uploadToPinata(imageFile, { pinataMetadata: { name: `${tokenName}_image` } });
        }
        metadata.image = imageHash ? `https://ipfs.io/ipfs/${imageHash}` : '';
   
        // Add social links to metadata
        if (metadata.twitter) metadata.twitter = metadata.twitter;
        if (metadata.telegram) metadata.telegram = metadata.telegram;
        if (metadata.website) metadata.website = metadata.website;
   
        const metadataHash = await uploadToPinata(metadata, { pinataMetadata: { name: `${tokenName}_metadata` } });
        return `https://ipfs.io/ipfs/${metadataHash}`;
    } catch (error) {
        console.error('Pinata upload error:', error);
        throw new Error(`IPFS upload failed: ${error.message}`);
    }
};
// Safe ATA helper
const safeGetOrCreateATA = async (connection, payer, mint, owner) => {
    const ata = getAssociatedTokenAddressSync(mint, owner);
    const accountInfo = await connection.getAccountInfo(ata, 'confirmed');
    if (accountInfo && accountInfo.owner.equals(TOKEN_PROGRAM_ID)) {
        return { address: ata };
    } else {
        const ix = createAssociatedTokenAccountInstruction(payer, ata, owner, mint);
        return { address: ata, instruction: ix };
    }
};
// Constant product bonding curve with virtual reserves and 1% fee
const calculateTokensOut = (solInLamports, solReservesLamports, tokenReservesUnits, decimals) => {
    const virtualTokens = VIRTUAL_TOKENS_BASE * (10n ** BigInt(decimals));
    const solInBig = BigInt(solInLamports);
    const fee = solInBig / 100n; // 1% fee
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
    const fee = tokensInBig / 100n; // 1% fee
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
// TokenCard Component
const TokenCard = ({ token, onAction, solPrice }) => {
    const isNew = token.timestamp && (Date.now() - token.timestamp < 3600000);
    const progress = token.graduated ? 100 : (token.solCollected / MIGRATION_TARGET_SOL) * 100;
    // Calculate metrics using bonding curve
    const virtualSol = 30;
    const virtualTokens = 200000000; // Fixed to match VIRTUAL_TOKENS_BASE
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
    const fdv = TOTAL_SUPPLY_TOKENS * tokenPrice;
    const liquidity = token.solCollected * solPrice;
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
                <h3>{token.name} ({token.symbol})</h3>
                <div className="token-socials">
                    {token.twitter && (
                        <a href={token.twitter} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()}>
                            <span>𝕏</span>
                        </a>
                    )}
                    {token.telegram && (
                        <a href={token.telegram} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()}>
                            <span>✈️</span>
                        </a>
                    )}
                    {token.website && (
                        <a href={token.website} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()}>
                            <span>🌐</span>
                        </a>
                    )}
                </div>
            </div>
            <p className="token-description">{token.description?.substring(0, 100)}{token.description?.length > 100 ? '...' : ''}</p>
            <div className="mint-address">{token.mint.substring(0, 8)}...{token.mint.slice(-8)}</div>
       
            {/* Token Metrics */}
            <div className="token-metrics">
                <div className="metric-row">
                    <span>Price:</span>
                    <span>${tokenPrice > 0 ? tokenPrice.toFixed(8) : '0.00000000'}</span>
                </div>
                <div className="metric-row">
                    <span>MCap:</span>
                    <span>${marketCap.toFixed(2)}</span>
                </div>
                <div className="metric-row">
                    <span>FDV:</span>
                    <span>${fdv.toFixed(2)}</span>
                </div>
                <div className="metric-row">
                    <span>Liquidity:</span>
                    <span>${liquidity.toFixed(2)}</span>
                </div>
                <div className="metric-row">
                    <span>Volume:</span>
                    <span>${(token.volume || 0).toFixed(2)}</span>
                </div>
            </div>
       
            {!token.graduated && (
                <>
                    <div className="bonding-info">
                        <div>💰 SOL Collected: {token.solCollected.toFixed(2)} / {MIGRATION_TARGET_SOL}</div>
                        <div>🎯 Progress: {progress.toFixed(1)}%</div>
                    </div>
                    <div className="progress-bar">
                        <div className="progress" style={{ width: `${Math.min(progress, 100)}%` }}></div>
                    </div>
                </>
            )}
       
            <div className="token-stats">
                <div>
                    <div>Supply</div>
                    <div>1000M</div>
                </div>
                <div>
                    <div>Holders</div>
                    <div>{token.holders || 1}</div>
                </div>
            </div>
       
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
// Main App
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
    // Launch Form States
    const [tokenName, setTokenName] = useState('');
    const [ticker, setTicker] = useState('');
    const [description, setDescription] = useState('');
    const [imageFile, setImageFile] = useState(null);
    const [imagePreview, setImagePreview] = useState('');
    const [decimals, setDecimals] = useState(6);
    const [useVanityAddress, setUseVanityAddress] = useState(false);
    const [vanitySuffix, setVanitySuffix] = useState('');
    const [twitterUrl, setTwitterUrl] = useState('');
    const [telegramUrl, setTelegramUrl] = useState('');
    const [websiteUrl, setWebsiteUrl] = useState('');
    // Buy/Sell Modal States
    const [showModal, setShowModal] = useState(false);
    const [selectedToken, setSelectedToken] = useState(null);
    const [modalTab, setModalTab] = useState('buy');
    const [tradeAmount, setTradeAmount] = useState('');
    const [copiedCA, setCopiedCA] = useState(false);
    const [userTokenBalance, setUserTokenBalance] = useState(0);
    const [userSolBalance, setUserSolBalance] = useState(0);
    const [userUsdarkBalance, setUserUsdarkBalance] = useState(0);
    const [solPrice, setSolPrice] = useState(150); // Default SOL price in USD
    // Initial Buy Modal States
    const [showInitialBuyModal, setShowInitialBuyModal] = useState(false);
    const [initialBuyAmount, setInitialBuyAmount] = useState('0.5');
    const [pendingTokenData, setPendingTokenData] = useState(null);
    // Launch Info Modal
    const [showLaunchInfoModal, setShowLaunchInfoModal] = useState(false);
    const client = useMemo(() => {
        if (!solanaConnection) return null;
        return new DynamicBondingCurveClient(solanaConnection, 'confirmed');
    }, [solanaConnection]);
    // Fetch SOL price on mount
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
        const interval = setInterval(fetchSolPrice, 60000); // Update every minute
        return () => clearInterval(interval);
    }, []);
    // Firebase Authentication
    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, (user) => {
            if (user) {
                console.log('Firebase user authenticated:', user.uid);
                setFirebaseUser(user);
            } else {
                // Sign in anonymously if not authenticated
                signInAnonymously(auth).catch((error) => {
                    console.error('Firebase auth error:', error);
                    setStatus('❌ Firebase authentication failed');
                    setShowStatusModal(true);
                });
            }
        });
        return () => unsubscribe();
    }, []);
    // Load tokens from Firestore
    useEffect(() => {
        if (!firebaseUser) return;
        setIsLoadingTokens(true);
        const tokensRef = collection(db, 'tokens');
        const q = query(tokensRef, orderBy('timestamp', 'desc'));
        const unsubscribe = onSnapshot(q, (querySnapshot) => {
            const tokens = [];
            querySnapshot.forEach((doc) => {
                const data = doc.data();
                data.tokensSoldUnits = data.tokensSoldUnits || '0';
                tokens.push({ id: doc.id, ...data });
            });
            setCreatedTokens(tokens);
            setIsLoadingTokens(false);
            console.log(`Loaded ${tokens.length} tokens from Firestore`);
        }, (error) => {
            console.error('Error loading tokens:', error);
            setStatus('❌ Failed to load tokens from database');
            setShowStatusModal(true);
            setIsLoadingTokens(false);
        });
        return () => unsubscribe();
    }, [firebaseUser]);
    // Real-time updates from Solana
    useEffect(() => {
        if (!client || !createdTokens.length) return;
        const subs = [];
        for (const token of createdTokens) {
            if (token.graduated || !token.pool) continue;
            const poolPk = new PublicKey(token.pool);
            try {
                const sub = solanaConnection.onAccountChange(poolPk, async (info) => {
                    const poolState = client.state.parsePool(info.data);
                    const newSolCollected = Number(poolState.quoteReserve) / LAMPORTS_PER_SOL;
                    const tokenSupply = await solanaConnection.getTokenSupply(new PublicKey(token.mint));
                    const tokensSoldUnits = tokenSupply.value.amount;
                    const updates = {
                        solCollected: newSolCollected,
                        tokensSoldUnits,
                        graduated: newSolCollected >= MIGRATION_TARGET_SOL,
                    };
                    if (token.solCollected !== newSolCollected) {
                        await updateTokenInFirestore(token.id, updates);
                    }
                });
                subs.push(sub);
            } catch (err) {
                console.error('Subscription error for pool:', token.pool, err);
            }
        }
        return () => subs.forEach(sub => {
            try {
                solanaConnection.removeAccountChangeListener(sub);
            } catch (err) {
                console.error('Unsubscribe error:', err);
            }
        });
    }, [createdTokens, client, solanaConnection]);
    // Fetch user balances for SOL and USDARK
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
    // Helper function to save token to Firestore
    const saveTokenToFirestore = async (tokenData) => {
        try {
            const docRef = await addDoc(collection(db, 'tokens'), tokenData);
            console.log('Token saved to Firestore with ID:', docRef.id);
            return docRef.id;
        } catch (error) {
            console.error('Error saving token to Firestore:', error);
            throw new Error('Failed to save token to database');
        }
    };
    // Helper function to update token in Firestore
    const updateTokenInFirestore = async (tokenId, updates) => {
        try {
            const tokenRef = doc(db, 'tokens', tokenId);
            await updateDoc(tokenRef, updates);
            console.log('Token updated in Firestore:', tokenId);
        } catch (error) {
            console.error('Error updating token in Firestore:', error);
            throw new Error('Failed to update token in database');
        }
    };
    // Create connection with fallback RPCs
    const createConnection = async (rpcUrls) => {
        for (const url of rpcUrls) {
            try {
                const connection = new Connection(url, 'confirmed');
                await connection.getSlot('confirmed');
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
                setStatus(`❌ Failed to connect to ${network}: ${error.message}`);
                setShowStatusModal(true);
            }
        };
        initConnection();
    }, [network]);
    useEffect(() => {
        if (!connected) {
            setStatus('Please connect your wallet 🔌');
            setShowStatusModal(true);
        } else if (walletPublicKey) {
            setStatus(`✅ Connected: ${walletPublicKey.toString().substring(0, 4)}...${walletPublicKey.toString().slice(-4)} on ${network.toUpperCase()}`);
            setShowStatusModal(true);
        } else {
            setStatus('❌ Invalid wallet public key');
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
       
            // Fetch user balances
            if (connected && walletPublicKey && solanaConnection) {
                try {
                    // Get SOL balance
                    const solBal = await solanaConnection.getBalance(walletPublicKey);
                    setUserSolBalance(solBal / LAMPORTS_PER_SOL);
               
                    // Get token balance
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
            setStatus('💡 Token graduated! Use Raydium or Jupiter to trade.');
            setShowStatusModal(true);
            return;
        }
    };
    const handleCopyCA = (address) => {
        navigator.clipboard.writeText(address);
        setCopiedCA(true);
        setTimeout(() => setCopiedCA(false), 2000);
    };
    const handleBuySell = async () => {
        if (!connected || !walletPublicKey || !solanaConnection || !selectedToken || !client) {
            setStatus('❌ Wallet not connected or client not ready');
            setShowStatusModal(true);
            return;
        }
        if (!tradeAmount || parseFloat(tradeAmount) <= 0) {
            setStatus('❌ Enter a valid amount');
            setShowStatusModal(true);
            return;
        }
        if (selectedToken.graduated) {
            setStatus('💡 Token graduated! Use Raydium or Jupiter to trade.');
            setShowStatusModal(true);
            return;
        }
        setIsSending(true);
        setStatus(`🔄 Preparing ${modalTab}...`);
        setShowStatusModal(true);
   
        try {
            const pool = new PublicKey(selectedToken.pool);
            let amountIn;
            let swapBaseForQuote;
            if (modalTab === 'buy') {
                amountIn = new BN(Math.floor(parseFloat(tradeAmount) * LAMPORTS_PER_SOL));
                swapBaseForQuote = false;
            } else {
                amountIn = new BN(Math.floor(parseFloat(tradeAmount) * Math.pow(10, selectedToken.decimals)));
                swapBaseForQuote = true;
            }
            // Ensure ATA exists for buy
            if (modalTab === 'buy') {
                const mint = new PublicKey(selectedToken.mint);
                const { address: userATA, instruction: createATAIx } = await safeGetOrCreateATA(
                    solanaConnection,
                    walletPublicKey,
                    mint,
                    walletPublicKey
                );
                if (createATAIx) {
                    const tx = new Transaction().add(createATAIx);
                    const { blockhash, lastValidBlockHeight } = await solanaConnection.getLatestBlockhash('confirmed');
                    tx.recentBlockhash = blockhash;
                    tx.feePayer = walletPublicKey;
                    const signedTx = await signTransaction(tx);
                    const sig = await solanaConnection.sendRawTransaction(signedTx.serialize());
                    await solanaConnection.confirmTransaction({ signature: sig, blockhash, lastValidBlockHeight }, 'confirmed');
                }
            }
            const swapParam = {
                amountIn,
                minimumAmountOut: new BN(0),
                swapBaseForQuote,
                owner: walletPublicKey,
                pool,
                referralTokenAccount: null,
            };
            const swapTransaction = await client.pool.swap(swapParam);
            const { blockhash, lastValidBlockHeight } = await solanaConnection.getLatestBlockhash('confirmed');
            swapTransaction.recentBlockhash = blockhash;
            swapTransaction.feePayer = walletPublicKey;
            const signedTx = await signTransaction(swapTransaction);
            const signature = await solanaConnection.sendRawTransaction(signedTx.serialize(), {
                skipPreflight: false,
                preflightCommitment: 'confirmed'
            });
       
            await solanaConnection.confirmTransaction({
                signature,
                blockhash,
                lastValidBlockHeight
            }, 'confirmed');
            const confirmedTradeTx = await solanaConnection.getTransaction(signature, {
                commitment: 'confirmed',
                maxSupportedTransactionVersion: 0
            });
            if (confirmedTradeTx && confirmedTradeTx.meta && confirmedTradeTx.meta.err) {
                console.error('Trade failed. Logs:', confirmedTradeTx.meta.logMessages);
                throw new Error(`Trade failed: ${JSON.stringify(confirmedTradeTx.meta.err)}`);
            }
            setStatus(`✅ ${modalTab.charAt(0).toUpperCase() + modalTab.slice(1)} successful! TX: ${signature}`);
            setShowStatusModal(true);
            // The onAccountChange will update the Firestore
            setTradeAmount('');
        } catch (error) {
            console.error('Trade error:', error);
            setStatus(`❌ Trade failed: ${error.message}`);
            setShowStatusModal(true);
        } finally {
            setIsSending(false);
        }
    };
    const handleImageChange = (event) => {
        const file = event.target.files[0];
        if (file) {
            if (!['image/png', 'image/jpeg', 'image/gif'].includes(file.type)) {
                setStatus('❌ Only PNG, JPG, GIF allowed.');
                setShowStatusModal(true);
                return;
            }
            if (file.size > 2 * 1024 * 1024) {
                setStatus('❌ Image size must be under 2MB.');
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
        setStatus('❌ Wallet not connected or client not ready');
        setShowStatusModal(true);
        return;
    }
    if (!tokenName || !ticker || !description || !imageFile) {
        setStatus('❌ Fill all required fields');
        setShowStatusModal(true);
        return;
    }
    if (tokenName.length > 32 || ticker.length > 10 || description.length > 1000) {
        setStatus('❌ Name ≤32 chars, Ticker ≤10 chars, Description ≤1000 chars');
        setShowStatusModal(true);
        return;
    }
    if (decimals !== 6 && decimals !== 9) {
        setStatus('❌ Decimals must be 6 or 9');
        setShowStatusModal(true);
        return;
    }
    setIsSending(true);
    try {
        let userUsdArkAta = getAssociatedTokenAddressSync(USDARK_MINT, walletPublicKey);
        if (USDARK_BYPASS === 1) {
            setStatus('🔄 Preparing USDARK fee...');
            setShowStatusModal(true);
            const { address: ataAddress, instruction: createATAIx } = await safeGetOrCreateATA(
                solanaConnection,
                walletPublicKey,
                USDARK_MINT,
                walletPublicKey
            );
            userUsdArkAta = ataAddress;
            if (createATAIx) {
                setStatus('🔄 Creating USDARK account...');
                setShowStatusModal(true);
                const tx = new Transaction().add(createATAIx);
                const { blockhash, lastValidBlockHeight } = await solanaConnection.getLatestBlockhash('confirmed');
                tx.recentBlockhash = blockhash;
                tx.feePayer = walletPublicKey;
                const signedTx = await signTransaction(tx);
                const sig = await solanaConnection.sendRawTransaction(signedTx.serialize());
                await solanaConnection.confirmTransaction({ signature: sig, blockhash, lastValidBlockHeight }, 'confirmed');
                setStatus('✅ USDARK account created. Checking balance...');
                setShowStatusModal(true);
            } else {
                setStatus('🔄 Checking USDARK balance for launch fee...');
                setShowStatusModal(true);
            }
            const balance = await solanaConnection.getTokenAccountBalance(userUsdArkAta);
            const uiBalance = balance.value.uiAmount;
            if (uiBalance < LAUNCH_FEE_USDARK) {
                throw new Error(`Insufficient USDARK balance. Need ${LAUNCH_FEE_USDARK} USDARK, have ${uiBalance}.`);
            }
            // For fee wallet ATA
            const { address: feeAtaAddress, instruction: createFeeATAIx } = await safeGetOrCreateATA(
                solanaConnection,
                walletPublicKey, // payer is user
                USDARK_MINT,
                FEE_WALLET
            );
            if (createFeeATAIx) {
                setStatus('🔄 Creating fee USDARK account...');
                setShowStatusModal(true);
                const tx = new Transaction().add(createFeeATAIx);
                const { blockhash, lastValidBlockHeight } = await solanaConnection.getLatestBlockhash('confirmed');
                tx.recentBlockhash = blockhash;
                tx.feePayer = walletPublicKey;
                const signedTx = await signTransaction(tx);
                const sig = await solanaConnection.sendRawTransaction(signedTx.serialize());
                await solanaConnection.confirmTransaction({ signature: sig, blockhash, lastValidBlockHeight }, 'confirmed');
                setStatus('✅ Fee USDARK account created.');
                setShowStatusModal(true);
                // Verify fee ATA creation
                setStatus('🔄 Verifying fee account creation...');
                setShowStatusModal(true);
                const verifyFeeAta = await solanaConnection.getAccountInfo(feeAtaAddress, 'confirmed');
                if (!verifyFeeAta || !verifyFeeAta.owner.equals(TOKEN_PROGRAM_ID)) {
                    throw new Error('Failed to verify fee ATA creation - account not found or invalid');
                }
                setStatus('✅ Fee account verified.');
                setShowStatusModal(true);
            }
        }
        setStatus('🔄 Uploading to IPFS...');
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
        const metadataUri = await uploadToIPFS(imageFile, metadata, tokenName);
        setStatus('✅ IPFS upload complete. Creating token...');
        setShowStatusModal(true);
        let mint;
        if (useVanityAddress && vanitySuffix) {
            setStatus(`🔄 Generating vanity address ending with "${vanitySuffix.toUpperCase()}"...`);
            setShowStatusModal(true);
            mint = generateVanityKeypair(vanitySuffix, 500000, (attempts) => {
                if (attempts % 10000 === 0) {
                    setStatus(`🔄 Generating vanity address... ${attempts} attempts`);
                    setShowStatusModal(true);
                }
            });
        } else {
            mint = Keypair.generate();
        }
        const config = Keypair.generate();
        const curveConfig = buildCurveWithMarketCap({
            totalTokenSupply: TOTAL_SUPPLY_TOKENS,
            initialMarketCap: 30,
            migrationMarketCap: 575,
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
                    startingFeeBps: 100,
                    endingFeeBps: 100,
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
            creatorTradingFeePercentage: 50,
            leftover: 1,
            tokenUpdateAuthority: TokenUpdateAuthorityOption.Immutable,
            migrationFee: {
                feePercentage: 0,
                creatorFeePercentage: 0,
            },
        });
        // Burn USDARK in a separate transaction to avoid simulation issues
        if (USDARK_BYPASS === 1) {
            setStatus('🔄 Sending USDARK fee...');
            setShowStatusModal(true);
            const feeAtaAddress = getAssociatedTokenAddressSync(USDARK_MINT, FEE_WALLET);
            // Double-check fee ATA exists before transfer
            const feeCheck = await solanaConnection.getAccountInfo(feeAtaAddress, 'confirmed');
            if (!feeCheck || !feeCheck.owner.equals(TOKEN_PROGRAM_ID)) {
                throw new Error('Fee ATA missing before transfer - creation may have failed');
            }
            // Double-check user balance before transfer
            const currentBalance = await solanaConnection.getTokenAccountBalance(userUsdArkAta);
            if (currentBalance.value.uiAmount < LAUNCH_FEE_USDARK) {
                throw new Error(`Insufficient USDARK balance before transfer. Need ${LAUNCH_FEE_USDARK} USDARK, have ${currentBalance.value.uiAmount}.`);
            }
            const feeAmount = new BN(LAUNCH_FEE_USDARK * (10 ** USDARK_DECIMALS));
            const transferIx = createTransferInstruction(
                userUsdArkAta,
                feeAtaAddress,
                walletPublicKey,
                feeAmount
            );
            const feeTx = new Transaction().add(transferIx);
            const { blockhash: feeBlockhash, lastValidBlockHeight: feeLastValid } = await solanaConnection.getLatestBlockhash('confirmed');
            feeTx.recentBlockhash = feeBlockhash;
            feeTx.feePayer = walletPublicKey;
            const signedFeeTx = await signTransaction(feeTx);
            const feeSig = await solanaConnection.sendRawTransaction(signedFeeTx.serialize(), {
                skipPreflight: false, // Changed to false for better error debugging
                preflightCommitment: 'confirmed',
                maxRetries: 5
            });
            await solanaConnection.confirmTransaction({
                signature: feeSig,
                blockhash: feeBlockhash,
                lastValidBlockHeight: feeLastValid
            }, 'confirmed');
            const confirmedFeeTx = await solanaConnection.getTransaction(feeSig, {
                commitment: 'confirmed',
                maxSupportedTransactionVersion: 0
            });
            if (confirmedFeeTx && confirmedFeeTx.meta && confirmedFeeTx.meta.err) {
                throw new Error(`Fee transfer failed: ${JSON.stringify(confirmedFeeTx.meta.err)}`);
            }
            setStatus('✅ USDARK sent. Creating config...');
            setShowStatusModal(true);
        }
        // Now create config using VersionedTransaction
        let { blockhash, lastValidBlockHeight } = await solanaConnection.getLatestBlockhash('confirmed');
        const configInstructions = await client.partner._createConfigIx({
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
        const allConfigInstructions = [...configInstructions, feeTransferIx];
        const configMessageV0 = new TransactionMessage({
            payerKey: walletPublicKey,
            recentBlockhash: blockhash,
            instructions: allConfigInstructions,
        }).compileToV0Message();
        const configVersionedTx = new VersionedTransaction(configMessageV0);
        configVersionedTx.sign([config]);
        let signedConfigTx = await signTransaction(configVersionedTx);
        let signature = await solanaConnection.sendRawTransaction(signedConfigTx.serialize(), {
            skipPreflight: false,
            preflightCommitment: 'confirmed',
            maxRetries: 5
        });
        await solanaConnection.confirmTransaction({
            signature,
            blockhash,
            lastValidBlockHeight
        }, 'confirmed');
        // Verify config creation success
        const confirmedConfigTx = await solanaConnection.getTransaction(signature, {
            commitment: 'confirmed',
            maxSupportedTransactionVersion: 0
        });
        if (confirmedConfigTx && confirmedConfigTx.meta && confirmedConfigTx.meta.err) {
            console.error('Config creation failed. Logs:', confirmedConfigTx.meta.logMessages);
            throw new Error(`Config creation failed: ${JSON.stringify(confirmedConfigTx.meta.err)}`);
        }
        setStatus('✅ Config created. Creating pool...');
        setShowStatusModal(true);
        const { blockhash: poolBlockhash, lastValidBlockHeight: poolLastValidBlockHeight } = await solanaConnection.getLatestBlockhash('confirmed');
        const createPoolParam = {
            baseMint: mint.publicKey,
            config: config.publicKey,
            name: tokenName,
            symbol: ticker,
            uri: metadataUri,
            payer: walletPublicKey,
            poolCreator: walletPublicKey,
        };
        const poolInstructions = await client.pool._createPoolIx(createPoolParam);
        const poolMessageV0 = new TransactionMessage({
            payerKey: walletPublicKey,
            recentBlockhash: poolBlockhash,
            instructions: poolInstructions,
        }).compileToV0Message();
        const poolVersionedTx = new VersionedTransaction(poolMessageV0);
        poolVersionedTx.sign([mint]);
        let signedPoolTx = await signTransaction(poolVersionedTx);
        signature = await solanaConnection.sendRawTransaction(signedPoolTx.serialize(), {
            skipPreflight: false,
            preflightCommitment: 'confirmed',
            maxRetries: 5
        });
        await solanaConnection.confirmTransaction({
            signature,
            blockhash: poolBlockhash,
            lastValidBlockHeight: poolLastValidBlockHeight
        }, 'confirmed');
        // Verify pool creation success
        const confirmedPoolTx = await solanaConnection.getTransaction(signature, {
            commitment: 'confirmed',
            maxSupportedTransactionVersion: 0
        });
        if (confirmedPoolTx && confirmedPoolTx.meta && confirmedPoolTx.meta.err) {
            console.error('Pool creation failed. Logs:', confirmedPoolTx.meta.logMessages);
            throw new Error(`Pool creation failed: ${JSON.stringify(confirmedPoolTx.meta.err)}`);
        }
        const [poolAddress] = PublicKey.findProgramAddressSync(
            [mint.publicKey.toBuffer(), NATIVE_MINT.toBuffer(), config.publicKey.toBuffer()],
            DBC_PROGRAM_ID
        );
        // Verify pool exists with retry (patched)
        console.log(`Expected pool PDA: ${poolAddress.toBase58()}`); // Debug
        let poolInfo = null;
        for (let i = 0; i < 10; i++) {
            poolInfo = await solanaConnection.getAccountInfo(poolAddress, 'confirmed'); // Patched commitment
            if (poolInfo && poolInfo.owner.equals(DBC_PROGRAM_ID)) {
                console.log(`Pool verified on attempt ${i + 1}: ${poolAddress.toBase58()}`); // Debug
                break;
            }
            console.log(`Pool not ready on attempt ${i + 1}, waiting...`); // Debug
            await new Promise(resolve => setTimeout(resolve, 5000)); // Patched wait time
        }
        if (!poolInfo || !poolInfo.owner.equals(DBC_PROGRAM_ID)) {
            console.warn(`Pool verification timed out for ${poolAddress.toBase58()}, but tx succeeded. Proceeding with caution.`);
            // Uncomment below for strict mode (may cause false failures on devnet)
            // throw new Error('Pool account not found or invalid after creation');
        }
        setStatus(`🎉 Token launched! Signature: ${signature}`);
        setShowStatusModal(true);
        const bondingSupplyUnits = (BigInt(BONDING_SUPPLY_TOKENS) * (10n ** BigInt(decimals))).toString();
        const dexSupplyUnits = (BigInt(DEX_SUPPLY_TOKENS) * (10n ** BigInt(decimals))).toString();
        const newToken = {
            mint: mint.publicKey.toBase58(),
            pool: poolAddress.toBase58(),
            name: tokenName,
            symbol: ticker,
            description: description,
            image: imagePreview,
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
            volume: 0,
            transactions: 0,
            holders: 1
        };
   
        setPendingTokenData(newToken);
        setShowInitialBuyModal(true);
   
    } catch (error) {
        console.error('Launch error:', error);
   
        // Enhanced error logging
        if (error.logs) {
            console.error('Transaction logs:', error.logs);
            setStatus(`❌ Error: ${error.message}. Check console for logs.`);
        } else {
            setStatus(`❌ Error: ${error.message}`);
        }
        setShowStatusModal(true);
    } finally {
        setIsSending(false);
    }
};
    const handleInitialBuy = async () => {
        if (!pendingTokenData || !initialBuyAmount || parseFloat(initialBuyAmount) <= 0 || !client) {
            setStatus('❌ Enter a valid SOL amount');
            setShowStatusModal(true);
            return;
        }
        try {
            setStatus('🔄 Processing initial buy...');
            setShowStatusModal(true);
            const solAmount = parseFloat(initialBuyAmount);
            const solInLamports = Math.floor(solAmount * LAMPORTS_PER_SOL);
            const docId = await saveTokenToFirestore(pendingTokenData);
            const pool = new PublicKey(pendingTokenData.pool);
            const swapParam = {
                amountIn: new BN(solInLamports),
                minimumAmountOut: new BN(0),
                swapBaseForQuote: false,
                owner: walletPublicKey,
                pool,
                referralTokenAccount: null,
            };
            const swapTx = await client.pool.swap(swapParam);
            const { blockhash, lastValidBlockHeight } = await solanaConnection.getLatestBlockhash('confirmed');
            swapTx.recentBlockhash = blockhash;
            swapTx.feePayer = walletPublicKey;
            const signedTx = await signTransaction(swapTx);
            const signature = await solanaConnection.sendRawTransaction(signedTx.serialize(), {
                skipPreflight: false,
                preflightCommitment: 'confirmed'
            });
       
            await solanaConnection.confirmTransaction({
                signature,
                blockhash,
                lastValidBlockHeight
            }, 'confirmed');
            const confirmedSwapTx = await solanaConnection.getTransaction(signature, {
                commitment: 'confirmed',
                maxSupportedTransactionVersion: 0
            });
            if (confirmedSwapTx && confirmedSwapTx.meta && confirmedSwapTx.meta.err) {
                console.error('Initial buy failed. Logs:', confirmedSwapTx.meta.logMessages);
                throw new Error(`Initial buy failed: ${JSON.stringify(confirmedSwapTx.meta.err)}`);
            }
            // Fetch updated state
            const poolState = await client.state.getPool(pool);
            const newSolCollected = Number(poolState.quoteReserve) / LAMPORTS_PER_SOL;
            const tokenSupply = await solanaConnection.getTokenSupply(new PublicKey(pendingTokenData.mint));
            const tokensSoldUnits = tokenSupply.value.amount;
            const updates = {
                solCollected: newSolCollected,
                tokensSoldUnits,
                graduated: newSolCollected >= MIGRATION_TARGET_SOL,
                volume: solAmount,
                transactions: 1,
                holders: 2
            };
            await updateTokenInFirestore(docId, updates);
       
            setStatus(`🎉 Token launched with initial buy of ${solAmount} SOL! TX: ${signature}`);
            setShowStatusModal(true);
            setShowInitialBuyModal(false);
            setPendingTokenData(null);
            setInitialBuyAmount('0.5');
       
            setTimeout(() => {
                setActivePage('home');
            }, 2000);
       
        } catch (error) {
            console.error('Initial buy error:', error);
            setStatus(`❌ Error: ${error.message}`);
            setShowStatusModal(true);
        }
    };
    const handleSkipInitialBuy = async () => {
        try {
            if (!pendingTokenData) return;
       
            await saveTokenToFirestore(pendingTokenData);
       
            setStatus(`🎉 Token launched and saved! No initial buy.`);
            setShowStatusModal(true);
            setShowInitialBuyModal(false);
            setPendingTokenData(null);
       
            setTimeout(() => {
                setActivePage('home');
            }, 2000);
       
        } catch (error) {
            console.error('Save error:', error);
            setStatus(`❌ Error saving token: ${error.message}`);
            setShowStatusModal(true);
        }
    };
    const requireUsdark = USDARK_BYPASS === 1;
    const enoughSol = userSolBalance >= 0.1; // Increased buffer for multiple tx fees + rent exemptions (USDARK tx, config tx, pool tx including mint creation ~0.002 SOL rent)
    const enoughUsdark = !requireUsdark || userUsdarkBalance >= LAUNCH_FEE_USDARK;
    const formComplete = tokenName && ticker && description && imageFile;
    return (
        <>
            <style>{`
                @import url('https://fonts.googleapis.com/css2?family=Orbitron:wght@400;700;900&family=Inter:wght@300;400;500;600;700&display=swap');
           
                * {
                    box-sizing: border-box;
                }
           
                body {
                    margin: 0;
  font-family: 'Orbitron', 'Segoe UI', -apple-system, BlinkMacSystemFont, 'Roboto', sans-serif;
                    background: linear-gradient(135deg, #0a0a0a 0%, #1a1a2e 50%, #16213e 100%);
                    color: #fff;
                    overflow-x: hidden;
                }
                .header {
                    position: fixed;
                    top: 0;
                    left: 0;
                    width: 100%;
                    height: 70px;
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    padding: 0 20px;
                    background: rgba(0, 0, 0, 0.8);
                    backdrop-filter: blur(20px);
                    border-bottom: 1px solid rgba(28, 194, 154, 0.2);
                    z-index: 1000;
                }
                .logo {
                    font-family: 'Orbitron', monospace;
                    font-size: 1.8em;
                    font-weight: 700;
                    background: linear-gradient(45deg, #1cc29a, #1cc29a);
                    -webkit-background-clip: text;
                    -webkit-text-fill-color: transparent;
                    background-clip: text;
                }

                .logo img{
                    height: 50px;
                    vertical-align: middle;
                    margin-right: 15px;
                }
                .header-actions {
                    display: flex;
                    align-items: center;
                    gap: 15px;
                }
                .mobile-menu-toggle {
                    display: none;
                    background: none;
                    border: none;
                    color: #fff;
                    font-size: 24px;
                    cursor: pointer;
                }
                .app-container {
                    display: flex;
                    min-height: calc(100vh - 70px);
                    width: 100vw;
                    margin-top: 70px;
                }
                .sidebar {
                    width: 250px;
                    background: rgba(0, 0, 0, 0.6);
                    backdrop-filter: blur(10px);
                    padding: 30px 20px;
                    border-right: 1px solid rgba(28, 194, 154, 0.1);
                    height: 100vh;
                    position: fixed;
                    left: 0;
                    top: 70px;
                    transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1);
                    z-index: 999;
                }
                .wallet-adapter-button-trigger{
                    background: linear-gradient(45deg, #1cc29a, #00ff88) !important;
                    border-radius: 12px !important;
                    padding: 8px 16px !important;
                }
                .sidebar button {
                    display: flex;
                    width: 100%;
                    padding: 15px;
                    margin-bottom: 15px;
                    background: none;
                    border: none;
                    color: #fff;
                    text-align: left;
                    cursor: pointer;
                    font-size: 1em;
                    align-items: center;
                    gap: 12px;
                    border-radius: 12px;
                    transition: all 0.2s ease;
                }
                .sidebar button:hover {
                    background: rgba(28, 194, 154, 0.1);
                    color: #1cc29a;
                }
                .sidebar button.active {
                    background: linear-gradient(45deg, #1cc29a, #00ff88);
                    color: #000;
                    box-shadow: 0 4px 20px rgba(28, 194, 154, 0.3);
                }
                .main-content {
                    flex: 1;
                    padding: 40px 20px;
                    overflow-y: auto;
                    width: calc(100% - 250px);
                    margin-left: 250px;
                }
                .create-coin {
                    background: linear-gradient(45deg, #1cc29a, #00ff88);
                    color: #000;
                    padding: 12px 24px;
                    border: none;
                    border-radius: 25px;
                    cursor: pointer;
                    font-weight: 600;
                    white-space: nowrap;
                    font-size: 1em;
                    transition: transform 0.2s ease;
                }
                .create-coin:hover {
                    transform: scale(1.05);
                }
                .home-hero {
                    text-align: center;
                    margin-bottom: 40px;
                    padding: 40px 20px;
                    background: rgba(28, 194, 154, 0.05);
                    border-radius: 20px;
                    border: 1px solid rgba(28, 194, 154, 0.1);
                }
                .home-hero h1 {
                    font-family: 'Orbitron', monospace;
                    font-size: 3em;
                    background: linear-gradient(45deg, #1cc29a, #00ff88);
                    -webkit-background-clip: text;
                    -webkit-text-fill-color: transparent;
                    margin-bottom: 20px;
                }
                .home-hero p {
                    font-size: 1.2em;
                    color: #ccc;
                    max-width: 600px;
                    margin: 0 auto;
                }
                .home-page {
                    color: #fff;
                }
                .trending-bar {
                    background: linear-gradient(45deg, #1cc29a, #00ff88);
                    padding: 15px 25px;
                    margin-bottom: 30px;
                    border-radius: 15px;
                    display: flex;
                    align-items: center;
                    gap: 15px;
                    box-shadow: 0 8px 32px rgba(28, 194, 154, 0.2);
                }
                .trending-bar span {
                    font-size: 1.3em;
                    font-weight: 600;
                    color: #000;
                }
                .filters {
                    display: flex;
                    gap: 15px;
                    margin-bottom: 30px;
                    flex-wrap: wrap;
                    align-items: center;
                }
                .filters button {
                    background: rgba(255, 255, 255, 0.05);
                    color: #fff;
                    padding: 10px 20px;
                    border: 1px solid rgba(28, 194, 154, 0.2);
                    cursor: pointer;
                    border-radius: 10px;
                    font-size: 0.95em;
                    transition: all 0.2s ease;
                }
                .filters button:hover {
                    background: rgba(28, 194, 154, 0.1);
                    border-color: #1cc29a;
                }
                .search-container {
                    display: flex;
                    flex: 1;
                    min-width: 300px;
                    background: rgba(255, 255, 255, 0.05);
                    border: 1px solid rgba(28, 194, 154, 0.2);
                    border-radius: 10px;
                    overflow: hidden;
                }
                .search-input {
                    flex: 1;
                    background: none;
                    color: #fff;
                    border: none;
                    padding: 12px 20px;
                    font-size: 1em;
                }
                .search-input::placeholder {
                    color: #888;
                }
                .search-button {
                    background: linear-gradient(45deg, #1cc29a, #00ff88);
                    color: #000;
                    padding: 12px 20px;
                    border: none;
                    cursor: pointer;
                    display: flex;
                    align-items: center;
                    gap: 8px;
                    font-weight: 500;
                    transition: transform 0.2s ease;
                }
                .search-button:hover {
                    transform: scale(1.05);
                }
                .token-grid {
                    display: grid;
                    grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
                    gap: 25px;
                }
                .token-card {
                    background: rgba(255, 255, 255, 0.05);
                    backdrop-filter: blur(10px);
                    padding: 25px;
                    border-radius: 20px;
                    text-align: left;
                    position: relative;
                    border: 1px solid rgba(28, 194, 154, 0.1);
                    cursor: pointer;
                    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
                    overflow: hidden;
                }
                .token-card::before {
                    content: '';
                    position: absolute;
                    top: 0;
                    left: 0;
                    right: 0;
                    height: 4px;
                    background: linear-gradient(45deg, #1cc29a, #00ff88);
                    transform: scaleX(0);
                    transition: transform 0.3s ease;
                }
                .token-card:hover {
                    transform: translateY(-8px);
                    border-color: #1cc29a;
                    box-shadow: 0 20px 40px rgba(0, 0, 0, 0.3);
                }
                .token-card:hover::before {
                    transform: scaleX(1);
                }
                .token-image-container {
                    width: 100%;
                    height: 140px;
                    border-radius: 15px;
                    overflow: hidden;
                    margin-bottom: 15px;
                    border: 1px solid rgba(28, 194, 154, 0.1);
                }
                .token-image {
                    width: 100%;
                    height: 100%;
                    object-fit: cover;
                    transition: transform 0.3s ease;
                }
                .token-card:hover .token-image {
                    transform: scale(1.05);
                }
                .token-header {
                    display: flex;
                    justify-content: space-between;
                    align-items: flex-start;
                    margin-bottom: 10px;
                }
                .token-card h3 {
                    margin: 0 0 5px 0;
                    font-size: 1.3em;
                    font-weight: 600;
                    color: #fff;
                }
                .token-socials {
                    display: flex;
                    gap: 8px;
                }
                .token-socials a {
                    background: rgba(28, 194, 154, 0.1);
                    color: #1cc29a;
                    width: 32px;
                    height: 32px;
                    border-radius: 50%;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    text-decoration: none;
                    transition: all 0.2s ease;
                    font-size: 1.1em;
                }
                .token-socials a:hover {
                    background: #1cc29a;
                    color: #000;
                    transform: scale(1.1);
                }
                .token-description {
                    font-size: 0.9em;
                    color: #ccc;
                    margin-bottom: 15px;
                    line-height: 1.4;
                }
                .mint-address {
                    font-size: 0.8em;
                    color: #888;
                    font-family: 'Orbitron', monospace;
                    margin-bottom: 15px;
                    word-break: break-all;
                }
                .token-metrics {
                    background: rgba(0, 0, 0, 0.3);
                    padding: 15px;
                    border-radius: 10px;
                    margin-bottom: 15px;
                    border: 1px solid rgba(28, 194, 154, 0.1);
                }
                .metric-row {
                    display: flex;
                    justify-content: space-between;
                    padding: 4px 0;
                    font-size: 0.85em;
                }
                .metric-row span:first-child {
                    color: #888;
                }
                .metric-row span:last-child {
                    color: #1cc29a;
                    font-weight: 600;
                }
                .bonding-info {
                    background: linear-gradient(45deg, rgba(28, 194, 154, 0.1), rgba(0, 255, 136, 0.1));
                    padding: 12px;
                    border-radius: 10px;
                    margin-bottom: 15px;
                    border: 1px solid rgba(28, 194, 154, 0.2);
                }
                .bonding-info div {
                    color: #1cc29a;
                    font-size: 0.9em;
                    margin: 3px 0;
                    font-weight: 500;
                }
                .token-stats {
                    display: flex;
                    justify-content: space-between;
                    margin-bottom: 20px;
                }
                .token-stats div {
                    text-align: center;
                    flex: 1;
                }
                .token-stats > div > div:first-child {
                    font-size: 0.75em;
                    color: #888;
                }
                .token-stats > div > div:last-child {
                    font-weight: 700;
                    color: #1cc29a;
                    font-size: 1.1em;
                }
                .progress-bar {
                    background: rgba(255, 255, 255, 0.1);
                    height: 8px;
                    margin-bottom: 20px;
                    border-radius: 10px;
                    overflow: hidden;
                }
                .progress {
                    background: linear-gradient(90deg, #1cc29a 0%, #00ff88 100%);
                    height: 100%;
                    border-radius: 10px;
                    transition: width 0.5s ease;
                    box-shadow: 0 0 10px rgba(28, 194, 154, 0.5);
                }
                .buy-button {
                    background: linear-gradient(45deg, #1cc29a, #00ff88);
                    color: #000;
                    padding: 12px 24px;
                    border: none;
                    border-radius: 12px;
                    cursor: pointer;
                    width: 100%;
                    font-weight: 600;
                    font-size: 1em;
                    transition: all 0.2s ease;
                }
                .buy-button:hover {
                    transform: translateY(-2px);
                    box-shadow: 0 8px 25px rgba(28, 194, 154, 0.3);
                }
                .buy-button.graduated {
                    background: linear-gradient(45deg, #ff9500, #ffaa00);
                }
                .launch-page {
                    color: #fff;
                }
                .launch-page h1 {
                    font-family: 'Orbitron', monospace;
                    font-size: 2.5em;
                    background: linear-gradient(45deg, #1cc29a, #00ff88);
                    -webkit-background-clip: text;
                    -webkit-text-fill-color: transparent;
                    margin-bottom: 30px;
                    text-align: center;
                }
                .launch-container {
                    display: grid;
                    grid-template-columns: 1fr 400px;
                    gap: 40px;
                    max-width: 1400px;
                    margin: 0 auto;
                }
                .launch-form-container {
                    background: rgba(255, 255, 255, 0.05);
                    backdrop-filter: blur(10px);
                    padding: 40px;
                    border-radius: 20px;
                    border: 1px solid rgba(28, 194, 154, 0.1);
                }
                .launch-form {
                    display: flex;
                    flex-direction: column;
                    gap: 25px;
                }
                .input-group {
                    display: flex;
                    flex-direction: column;
                }
                .input-group label {
                    font-weight: 500;
                    margin-bottom: 8px;
                    color: #ccc;
                    font-size: 0.95em;
                }
                .input-group input,
                .input-group textarea,
                .input-group select {
                    width: 100%;
                    background: rgba(255, 255, 255, 0.05);
                    color: #fff;
                    border: 1px solid rgba(28, 194, 154, 0.2);
                    padding: 15px;
                    border-radius: 12px;
                    font-size: 1em;
                    transition: border-color 0.2s ease;
                }
                .input-group input:focus,
                .input-group textarea:focus,
                .input-group select:focus {
                    outline: none;
                    border-color: #1cc29a;
                }
                .input-group textarea {
                    resize: vertical;
                    min-height: 120px;
                }
                .input-group p {
                    color: #888;
                    font-size: 0.85em;
                    margin-top: 8px;
                }
                .preview-media {
                    width: 100%;
                    max-width: 300px;
                    margin-top: 10px;
                    border-radius: 12px;
                }
                .checkbox {
                    display: flex;
                    align-items: center;
                    gap: 12px;
                    margin-bottom: 15px;
                }
                .checkbox input {
                    width: auto;
                    accent-color: #1cc29a;
                }
                .launch-button {
                    background: linear-gradient(45deg, #1cc29a, #00ff88);
                    color: #000;
                    width: 100%;
                    padding: 18px;
                    border: none;
                    border-radius: 15px;
                    cursor: pointer;
                    font-weight: 600;
                    font-size: 1.1em;
                    transition: all 0.2s ease;
                }
                .launch-button:hover:not(:disabled) {
                    transform: translateY(-2px);
                    box-shadow: 0 10px 30px rgba(28, 194, 154, 0.3);
                }
                .launch-button:disabled {
                    background: rgba(28, 194, 154, 0.3);
                    color: #666;
                    cursor: not-allowed;
                }
                .preview-panel {
                    position: sticky;
                    top: 40px;
                    height: fit-content;
                }
                .preview-panel > div {
                    background: rgba(255, 255, 255, 0.05);
                    backdrop-filter: blur(10px);
                    border-radius: 20px;
                    padding: 30px;
                    border: 1px solid rgba(28, 194, 154, 0.1);
                }
                .preview-content {
                    background: rgba(0, 0, 0, 0.3);
                    border-radius: 15px;
                    padding: 25px;
                    border: 1px solid rgba(28, 194, 154, 0.1);
                }
                .preview-image-placeholder {
                    width: 100%;
                    height: 200px;
                    background: rgba(28, 194, 154, 0.1);
                    border-radius: 12px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    border: 2px dashed rgba(28, 194, 154, 0.3);
                    margin-bottom: 15px;
                    font-size: 0.9em;
                    color: #888;
                }
                .preview-stats {
                    background: linear-gradient(45deg, rgba(28, 194, 154, 0.1), rgba(0, 255, 136, 0.1));
                    padding: 15px;
                    border-radius: 12px;
                    margin: 15px 0;
                    border: 1px solid rgba(28, 194, 154, 0.2);
                }
                .preview-stats div {
                    display: flex;
                    justify-content: space-between;
                    margin: 8px 0;
                    font-size: 0.95em;
                }
                .preview-stats span:first-child {
                    color: #1cc29a;
                    font-weight: 500;
                }
                .preview-fee {
                    background: linear-gradient(45deg, rgba(255, 193, 7, 0.1), rgba(255, 165, 0, 0.1));
                    padding: 15px;
                    border-radius: 12px;
                    border: 1px solid rgba(255, 193, 7, 0.3);
                    margin: 15px 0;
                }
                .preview-fee div {
                    font-size: 0.9em;
                    color: #ffcc00;
                    margin: 4px 0;
                    font-weight: 500;
                }
                .preview-button {
                    width: 100%;
                    padding: 15px;
                    background: rgba(28, 194, 154, 0.3);
                    color: #fff;
                    border: none;
                    border-radius: 12px;
                    cursor: pointer;
                    font-weight: 500;
                    transition: all 0.2s ease;
                }
                .preview-button:hover {
                    background: #1cc29a;
                    transform: translateY(-2px);
                }
                .no-tokens {
                    text-align: center;
                    padding: 100px 40px;
                    color: #666;
                    background: rgba(255, 255, 255, 0.02);
                    border-radius: 20px;
                    border: 1px solid rgba(28, 194, 154, 0.1);
                }
                .no-tokens div {
                    font-size: 4em;
                    margin-bottom: 20px;
                }
                .no-tokens p {
                    font-size: 1.3em;
                    margin-bottom: 10px;
                }
                .no-tokens p:last-child {
                    font-size: 1em;
                    color: #888;
                }
                .modal-overlay {
                    position: fixed;
                    top: 0;
                    left: 0;
                    right: 0;
                    bottom: 0;
                    background: rgba(0, 0, 0, 0.9);
                    backdrop-filter: blur(10px);
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    z-index: 2000;
                }
                .modal-content {
                    background: rgba(0, 0, 0, 0.8);
                    backdrop-filter: blur(20px);
                    border: 1px solid rgba(28, 194, 154, 0.2);
                    border-radius: 20px;
                    width: 90%;
                    max-width: 700px;
                    max-height: 90vh;
                    overflow-y: auto;
                    position: relative;
                }
                .modal-header {
                    padding: 25px 30px;
                    border-bottom: 1px solid rgba(28, 194, 154, 0.1);
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                }
                .modal-header h2 {
                    font-family: 'Orbitron', monospace;
                    font-size: 1.8em;
                    margin: 0;
                }
                .modal-close {
                    background: none;
                    border: none;
                    color: #fff;
                    font-size: 28px;
                    cursor: pointer;
                    padding: 0;
                    width: 40px;
                    height: 40px;
                    border-radius: 50%;
                    transition: background 0.2s ease;
                }
                .modal-close:hover {
                    background: rgba(255, 255, 255, 0.1);
                }
                .modal-body {
                    padding: 30px;
                }
                .token-detail-image {
                    width: 100%;
                    height: 280px;
                    object-fit: cover;
                    border-radius: 15px;
                    margin-bottom: 20px;
                    border: 1px solid rgba(28, 194, 154, 0.1);
                }
                .ca-copy-section {
                    background: rgba(28, 194, 154, 0.05);
                    padding: 15px;
                    border-radius: 12px;
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    margin: 20px 0;
                    border: 1px solid rgba(28, 194, 154, 0.2);
                }
                .ca-address {
                    font-family: 'Orbitron', monospace;
                    font-size: 0.95em;
                    color: #1cc29a;
                    word-break: break-all;
                    flex: 1;
                }
                .copy-button {
                    background: linear-gradient(45deg, #1cc29a, #00ff88);
                    color: #000;
                    border: none;
                    padding: 10px 20px;
                    border-radius: 10px;
                    cursor: pointer;
                    font-weight: 600;
                    white-space: nowrap;
                    transition: all 0.2s ease;
                }
                .copy-button:hover:not(.copied) {
                    transform: scale(1.05);
                }
                .copy-button.copied {
                    background: #00ff88;
                }
                .trade-tabs {
                    display: flex;
                    gap: 10px;
                    margin: 25px 0;
                    background: rgba(255, 255, 255, 0.05);
                    border-radius: 12px;
                    overflow: hidden;
                }
                .trade-tab {
                    flex: 1;
                    padding: 15px;
                    background: none;
                    border: none;
                    color: #fff;
                    cursor: pointer;
                    font-weight: 500;
                    transition: all 0.2s ease;
                }
                .trade-tab.active {
                    background: linear-gradient(45deg, #1cc29a, #00ff88);
                    color: #000;
                }
                .trade-input-group {
                    margin: 20px 0;
                }
                .trade-input-group label {
                    display: block;
                    margin-bottom: 10px;
                    color: #ccc;
                    font-weight: 500;
                }
                .trade-input-group input {
                    width: 100%;
                    background: rgba(255, 255, 255, 0.05);
                    color: #fff;
                    border: 1px solid rgba(28, 194, 154, 0.2);
                    padding: 15px;
                    border-radius: 12px;
                    box-sizing: border-box;
                    font-size: 1.1em;
                }
                .trade-button {
                    width: 100%;
                    padding: 18px;
                    background: linear-gradient(45deg, #1cc29a, #00ff88);
                    color: #000;
                    border: none;
                    border-radius: 12px;
                    cursor: pointer;
                    font-weight: 600;
                    font-size: 1.1em;
                    margin-top: 15px;
                    transition: all 0.2s ease;
                }
                .trade-button:hover:not(:disabled) {
                    transform: translateY(-2px);
                    box-shadow: 0 10px 30px rgba(28, 194, 154, 0.3);
                }
                .trade-button:disabled {
                    background: rgba(28, 194, 154, 0.3);
                    color: #666;
                    cursor: not-allowed;
                }
                .social-links-large {
                    display: flex;
                    gap: 20px;
                    justify-content: center;
                    margin: 25px 0;
                }
                .social-links-large a {
                    background: rgba(28, 194, 154, 0.1);
                    color: #1cc29a;
                    width: 50px;
                    height: 50px;
                    border-radius: 50%;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    text-decoration: none;
                    font-size: 1.4em;
                    transition: all 0.2s ease;
                    border: 1px solid rgba(28, 194, 154, 0.2);
                }
                .social-links-large a:hover {
                    background: #1cc29a;
                    color: #000;
                    transform: scale(1.1) rotate(5deg);
                }
                .new-badge {
                    position: absolute;
                    top: 15px;
                    right: 15px;
                    background: linear-gradient(45deg, #1cc29a, #00ff88);
                    color: #000;
                    padding: 4px 10px;
                    border-radius: 20px;
                    font-size: 0.75em;
                    font-weight: 700;
                    z-index: 1;
                    box-shadow: 0 4px 12px rgba(28, 194, 154, 0.3);
                }
                .graduated-badge {
                    position: absolute;
                    top: 15px;
                    left: 15px;
                    background: linear-gradient(45deg, #ff9500, #ffaa00);
                    color: #000;
                    padding: 4px 10px;
                    border-radius: 20px;
                    font-size: 0.75em;
                    font-weight: 700;
                    z-index: 1;
                    box-shadow: 0 4px 12px rgba(255, 149, 0, 0.3);
                }
                /* Status Modal Styles */
                .status-modal-content {
                    max-width: 500px;
                    text-align: center;
                }
                .status-modal-body {
                    padding: 40px 30px;
                }
                .status-modal-body p {
                    font-size: 1.1em;
                    line-height: 1.5;
                    margin-bottom: 20px;
                }
                .status-success {
                    color: #00ff88;
                }
                .status-error {
                    color: #ff6666;
                }
                /* Launch Info Modal */
                .launch-info-modal-body {
                    padding: 40px 30px;
                    text-align: left;
                }
                .launch-info-modal-body h3 {
                    color: #1cc29a;
                    margin-bottom: 15px;
                    font-family: 'Orbitron';
                }
                .launch-info-modal-body p {
                    color: #ccc;
                    margin-bottom: 12px;
                    line-height: 1.6;
                }
                .launch-info-modal-body ol {
                    color: #ccc;
                    padding-left: 20px;
                }
                .launch-info-modal-body li {
                    margin-bottom: 8px;
                }
                /* Mobile Responsiveness */
                @media (max-width: 1024px) {
                    .launch-container {
                        grid-template-columns: 1fr;
                        gap: 30px;
                    }
                    .preview-panel {
                        position: static;
                    }
                    .token-grid {
                        grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
                        gap: 20px;
                    }
                }
                @media (max-width: 768px) {
                    .header {
                        padding: 0 15px;
                        height: 60px;
                    }
                    .logo {
                        font-size: 1.4em;
                    }
                    .create-coin {
                        padding: 10px 16px;
                        font-size: 0.9em;
                    }
                    .mobile-menu-toggle {
                        display: block;
                    }
                    .header-actions {
                        gap: 10px;
                    }
                    .app-container {
                        flex-direction: column;
                        margin-top: 60px;
                    }
                    .sidebar {
                        position: fixed;
                        top: 60px;
                        left: 0;
                        width: 280px;
                        height: calc(100vh - 60px);
                        transform: translateX(-100%);
                        z-index: 999;
                    }
                    .sidebar.open {
                        transform: translateX(0);
                    }
                    .main-content {
                        padding: 20px 15px;
                        width: 100%;
                        margin-left: 0;
                    }
                    .home-hero h1 {
                        font-size: 2.2em;
                    }
                    .home-hero p {
                        font-size: 1.1em;
                    }
                    .filters {
                        flex-direction: column;
                        align-items: stretch;
                        gap: 10px;
                    }
                    .search-container {
                        min-width: auto;
                        margin-top: 10px;
                    }
                    .token-grid {
                        grid-template-columns: 1fr;
                        gap: 20px;
                    }
                    .token-card {
                        padding: 20px;
                    }
                    .token-image-container {
                        height: 160px;
                    }
                    .token-stats {
                        flex-direction: column;
                        gap: 10px;
                    }
                    .token-metrics {
                        font-size: 0.8em;
                    }
                    .launch-container {
                        gap: 25px;
                    }
                    .launch-form-container {
                        padding: 25px;
                    }
                    .modal-content {
                        width: 95%;
                        max-height: 95vh;
                        margin: 10px;
                    }
                    .modal-header {
                        padding: 20px;
                    }
                    .modal-body {
                        padding: 20px;
                    }
                    .token-detail-image {
                        height: 220px;
                    }
                    .ca-copy-section {
                        flex-direction: column;
                        gap: 15px;
                        align-items: stretch;
                        text-align: center;
                    }
                    .copy-button {
                        width: 100%;
                    }
                    .trade-tabs {
                        flex-direction: row;
                    }
                    .social-links-large {
                        gap: 15px;
                    }
                    .social-links-large a {
                        width: 45px;
                        height: 45px;
                        font-size: 1.2em;
                    }
                    .no-tokens {
                        padding: 60px 20px;
                    }
                    .no-tokens div {
                        font-size: 3em;
                    }
                    .no-tokens p {
                        font-size: 1.1em;
                    }
                }
                @media (max-width: 480px) {
                    .header {
                        height: 55px;
                        padding: 0 10px;
                    }
                    .app-container {
                        margin-top: 55px;
                    }
                    .sidebar {
                        top: 55px;
                        width: 100%;
                        height: calc(100vh - 55px);
                    }
                    .logo {
                        font-size: 0.9em;
                    }
                        .logo img{
                    height: 30px;
                    vertical-align: middle;
                    margin-right: 8px;
                }
                    .main-content {
                        padding: 15px 10px;
                    }
                    .trending-bar {
                        padding: 12px 15px;
                        font-size: 0.9em;
                    }
                    .filters button {
                        padding: 10px 15px;
                        font-size: 0.85em;
                    }
                    .token-card h3 {
                        font-size: 1.1em;
                    }
                    .token-description {
                        font-size: 0.85em;
                    }
                    .input-group input,
                    .input-group textarea,
                    .input-group select {
                        padding: 14px;
                        font-size: 16px; /* Prevents zoom on iOS */
                    }
                    .launch-button,
                    .trade-button {
                        padding: 15px;
                        font-size: 1em;
                    }
                    .modal-content {
                        width: 98%;
                        margin: 5px;
                    }
                    .trade-tabs {
                        flex-direction: column;
                    }
                    .trade-tab {
                        width: 100%;
                    }
                }
                .desktop-only {
                    display: block;
                }
                .mobile-only {
                    display: none;
                }
                @media (max-width: 768px) {
                    .desktop-only {
                        display: none !important;
                    }
                    .mobile-only {
                        display: block !important;
                    }
                }
                @media (min-width: 769px) {
                    .desktop-only {
                        display: block !important;
                    }
                    .mobile-only {
                        display: none !important;
                    }
                }
            `}</style>
            <div className="app-container">
                {/* Header */}
                <header className="header">
                    <div className="logo"><img src="/logo.png" alt="logo"  />USDARK PAD</div>
                    <div className="header-actions">
                        <select value={network} onChange={(e) => setNetwork(e.target.value)} style={{ padding: '8px', borderRadius: '8px', background: 'rgba(255,255,255,0.1)', color: '#fff', border: '1px solid #1cc29a' }}>
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
                        <div className="mobile-only" style={{marginTop: '20px'}}>
                            <div className="wallet">
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
                                        <div>⏳</div>
                                        <p>Loading tokens from database...</p>
                                    </div>
                                ) : filteredTokens.length === 0 ? (
                                    <div className="no-tokens">
                                        <div>🚀</div>
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
                                            <p>Fixed: 85 SOL. When this amount is collected, token graduates to DEX.</p>
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
                                                    onChange={e => setUseVanityAddress(e.target.checked)}
                                                />
                                                <label htmlFor="use-vanity">Generate address ending with custom text</label>
                                            </div>
                                            {useVanityAddress && (
                                                <>
                                                    <input
                                                        type="text"
                                                        placeholder="Enter suffix (e.g., DARK, ARK, RK)"
                                                        value={vanitySuffix}
                                                        onChange={e => setVanitySuffix(e.target.value.toUpperCase())}
                                                        maxLength="4"
                                                    />
                                                    <p>⚠️ Longer suffixes take more time. "DARK" may take several minutes.</p>
                                                </>
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
                                        {!enoughSol && <p style={{color: 'red'}}>Insufficient SOL balance (need at least 0.1 SOL for fees and rent)</p>}
                                        {requireUsdark && !enoughUsdark && <p style={{color: 'red'}}>Insufficient USDARK balance (need at least 2000 USDARK)</p>}
                                        {!formComplete && <p style={{color: 'red'}}>Please complete all required fields</p>}
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
                                                    <span>1000M</span>
                                                </div>
                                                <div>
                                                    <span>Decimals</span>
                                                    <span>{decimals}</span>
                                                </div>
                                                <div>
                                                    <span>Migration Target</span>
                                                    <span>85 SOL</span>
                                                </div>
                                            </div>
                                       
                                            <div className="bonding-info">
                                                <div>💰 SOL Collected: 0 / 85</div>
                                                <div>🎯 Progress: 0%</div>
                                            </div>
                                       
                                            <div className="progress-bar">
                                                <div className="progress" style={{ width: '0%' }}></div>
                                            </div>
                                       
                                            <div className="preview-fee">
                                                <div><DollarSign size={16} style={{ display: 'inline', marginRight: '5px' }} /> Launch Fee: 0.02 SOL (~$3 USD) {USDARK_BYPASS === 1 ? '+ 2000 USDARK (sent to fee wallet)' : ''}</div>
                                                <div>🎯 Bonding Curve: Manual trading until 85 SOL</div>
                                                {useVanityAddress && vanitySuffix && (
                                                    <div>✨ Vanity: ...{vanitySuffix.toUpperCase()}</div>
                                                )}
                                            </div>
                                            <button className="preview-button" onClick={() => setShowLaunchInfoModal(true)}>View Launch Details</button>
                                        </div>
                                    </div>
                                </div>
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
                                            <span>𝕏</span>
                                        </a>
                                    )}
                                    {selectedToken.telegram && (
                                        <a href={selectedToken.telegram} target="_blank" rel="noopener noreferrer">
                                            <span>✈️</span>
                                        </a>
                                    )}
                                    {selectedToken.website && (
                                        <a href={selectedToken.website} target="_blank" rel="noopener noreferrer">
                                            <span>🌐</span>
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
                                    <span>1000M</span>
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
                                    const tokenPrice = priceSol * solPrice;
                                    const circulatingTokens = Number(BigInt(tokensSoldUnits) / pow10);
                                    const marketCap = circulatingTokens * tokenPrice;
                                    const fdv = TOTAL_SUPPLY_TOKENS * tokenPrice;
                                    const liquidity = selectedToken.solCollected * solPrice;
                                    const volume = (selectedToken.volume || 0) * solPrice;
                                    const txns = selectedToken.transactions || 0;
                                    const makers = selectedToken.holders || 1;
                               
                                    return (
                                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '15px' }}>
                                            <div>
                                                <div style={{ color: '#888', fontSize: '0.85em' }}>Price (USD)</div>
                                                <div style={{ color: '#1cc29a', fontWeight: 'bold' }}>${tokenPrice > 0 ? tokenPrice.toFixed(8) : '0.00000000'}</div>
                                            </div>
                                            <div>
                                                <div style={{ color: '#888', fontSize: '0.85em' }}>Market Cap</div>
                                                <div style={{ color: '#1cc29a', fontWeight: 'bold' }}>${marketCap.toFixed(2)}</div>
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
                                                <div style={{ color: '#888', fontSize: '0.85em' }}>Transactions</div>
                                                <div style={{ color: '#1cc29a', fontWeight: 'bold' }}>{txns}</div>
                                            </div>
                                            <div>
                                                <div style={{ color: '#888', fontSize: '0.85em' }}>Holders</div>
                                                <div style={{ color: '#1cc29a', fontWeight: 'bold' }}>{makers}</div>
                                            </div>
                                            <div>
                                                <div style={{ color: '#888', fontSize: '0.85em' }}>Circulating Supply</div>
                                                <div style={{ color: '#1cc29a', fontWeight: 'bold' }}>{circulatingTokens.toFixed(0)}M</div>
                                            </div>
                                        </div>
                                    );
                                })()}
                            </div>
                       
                            {!selectedToken.graduated && (
                                <>
                                    <div className="bonding-info">
                                        <div>💰 SOL Collected: {selectedToken.solCollected.toFixed(2)} / {MIGRATION_TARGET_SOL}</div>
                                        <div>🎯 Progress: {((selectedToken.solCollected / MIGRATION_TARGET_SOL) * 100).toFixed(1)}%</div>
                                    </div>
                               
                                    <div className="progress-bar">
                                        <div
                                            className="progress"
                                            style={{ width: `${Math.min((selectedToken.solCollected / MIGRATION_TARGET_SOL) * 100, 100)}%` }}
                                        ></div>
                                    </div>
                               
                                    {/* User Balances */}
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
                                            onClick={() => setModalTab('buy')}
                                        >
                                            Buy
                                        </button>
                                        <button
                                            className={`trade-tab ${modalTab === 'sell' ? 'active' : ''}`}
                                            onClick={() => setModalTab('sell')}
                                        >
                                            Sell
                                        </button>
                                    </div>
                               
                                    {/* Trade Input */}
                                    <div className="trade-input-group">
                                        <label>{modalTab === 'buy' ? 'Amount (SOL)' : 'Amount (Tokens)'}</label>
                                        <input
                                            type="number"
                                            step="0.01"
                                            min="0"
                                            placeholder={modalTab === 'buy' ? 'Enter SOL amount' : 'Enter token amount'}
                                            value={tradeAmount}
                                            onChange={(e) => setTradeAmount(e.target.value)}
                                        />
                                    </div>
                               
                                    <button
                                        className="trade-button"
                                        onClick={handleBuySell}
                                        disabled={!connected || !tradeAmount || parseFloat(tradeAmount) <= 0 || isSending}
                                    >
                                        {isSending ? 'Processing...' : (modalTab === 'buy' ? 'Buy Tokens' : 'Sell Tokens')}
                                    </button>
                                </>
                            )}
                       
                            {selectedToken.graduated && (
                                <div className="preview-fee" style={{ background: 'linear-gradient(45deg, rgba(255, 149, 0, 0.1), rgba(255, 170, 0, 0.1))', color: '#ff9500' }}>
                                    <div>🎉 Token Graduated!</div>
                                    <div>Trade on Raydium or Jupiter</div>
                                </div>
                            )}
                       
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
                            <h2>🎉 Token Launched Successfully!</h2>
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
                                        ? Number(calculateTokensOut(
                                            parseFloat(initialBuyAmount) * LAMPORTS_PER_SOL,
                                            0,
                                            Number(pendingTokenData.bondingSupplyUnits),
                                            pendingTokenData.decimals
                                          ) / (10n ** BigInt(pendingTokenData.decimals))).toFixed(0)
                                        : '0'} {pendingTokenData.symbol} tokens
                                </p>
                            </div>
                            <button
                                className="trade-button"
                                onClick={handleInitialBuy}
                                disabled={!initialBuyAmount || parseFloat(initialBuyAmount) <= 0}
                                style={{ marginBottom: '15px' }}
                            >
                                Buy {initialBuyAmount || '0'} SOL Worth
                            </button>
                            <button
                                className="trade-button"
                                onClick={handleSkipInitialBuy}
                                style={{ background: 'rgba(255, 255, 255, 0.1)', color: '#fff', border: '1px solid rgba(255, 255, 255, 0.2)' }}
                            >
                                Skip Initial Buy
                            </button>
                        </div>
                    </div>
                </div>
            )}
            {/* Status Modal */}
            {showStatusModal && (
                <div className="modal-overlay" onClick={() => setShowStatusModal(false)}>
                    <div className="modal-content status-modal-content" onClick={(e) => e.stopPropagation()}>
                        <div className="modal-header">
                            <h2>Status Update</h2>
                            <button className="modal-close" onClick={() => setShowStatusModal(false)}>×</button>
                        </div>
                        <div className="modal-body status-modal-body">
                            <p className={status.includes('❌') ? 'status-error' : status.includes('✅') || status.includes('🎉') ? 'status-success' : ''}>
                                {status}
                            </p>
                            <button
                                className="trade-button"
                                onClick={() => setShowStatusModal(false)}
                                style={{ background: status.includes('❌') ? '#ff6666' : '#1cc29a', color: '#000' }}
                            >
                                Dismiss
                            </button>
                        </div>
                    </div>
                </div>
            )}
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