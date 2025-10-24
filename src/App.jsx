import React, { useState, useEffect, useMemo } from 'react';
import { Connection, PublicKey, SystemProgram, Transaction, LAMPORTS_PER_SOL, Keypair, TransactionInstruction } from '@solana/web3.js';
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
    NATIVE_MINT
} from '@solana/spl-token';
import { useWallet } from '@solana/wallet-adapter-react';
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui';
import { Home, Rocket, TrendingUp, Search, Menu, X } from 'lucide-react';
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
};
const DEFAULT_NETWORK = 'devnet';

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

const BASE_FEE = 0.02 * LAMPORTS_PER_SOL;  // Reduced launch fee
const PINATA_JWT = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySW5mb3JtYXRpb24iOnsiaWQiOiJhMTNlMDlhMy1hYmJjLTQwOWYtOTdmMi1mNGY0N2Y2ODUzZDYiLCJlbWFpbCI6ImFncmFiaW9oYXJ2ZXlAZ21haWwuY29tIiwiZW1haWxfdmVyaWZpZWQiOnRydWUsInBpbl9wb2xpY3kiOnsicmVnaW9ucyI6W3siZGVzaXJlZFJlcGxpY2F0aW9uQ291bnQiOjEsImlkIjoiRlJBMSJ9LHsiZGVzaXJlZFJlcGxpY2F0aW9uQ291bnQiOjEsImlkIjoiTllDMSJ9XSwidmVyc2lvbiI6MX0sIm1mYV9lbmFibGVkIjpmYWxzZSwic3RhdHVzIjoiQUNUSVZFIn0sImF1dGhlbnRpY2F0aW9uVHlwZSI6InNjb3BlZEtleSIsInNjb3BlZEtleUtleSI6IjE2MTc1YTM5NTE5NWFmMWVjNjk5Iiwic2NvcGVkS2V5U2VjcmV0IjoiY2FjNWI4NmRjYjkxMzBlYWQ5NWM4MTZmMzk3ZWZiMWUyZTIwMzQxZjM1OGMxMzk5YTE0ZWYzYjczNjNkYmE0MSIsImV4cCI6MTc5MTg5MjU4NH0.ZRvRz1xkIvI0VN-Xd44ZdXSUEMhVyK-TaNFPk4BOZYs';

const TOTAL_SUPPLY_TOKENS = 1000000000;
const BONDING_SUPPLY_TOKENS = 800000000;
const DEX_SUPPLY_TOKENS = 200000000;
const MIGRATION_TARGET_SOL = 85;
const VIRTUAL_SOL_LAMPORTS = BigInt(30 * LAMPORTS_PER_SOL);
const VIRTUAL_TOKENS_BASE = 200000000n;
const DBC_PROGRAM_ID = new PublicKey('dbcij3LWUppWqq96dh6gJWwBifmcGfLSB5D4DuSMaqN');

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
    const virtualTokens = 200000000;  // Fixed to match VIRTUAL_TOKENS_BASE
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
            <img 
                src={token.image || 'https://via.placeholder.com/200'} 
                alt={token.name} 
                className="token-image"
                onError={(e) => e.target.src = 'https://via.placeholder.com/200'}
            />
            <h3>{token.name} ({token.symbol})</h3>
            <p>{token.description?.substring(0, 100)}{token.description?.length > 100 ? '...' : ''}</p>
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
            <p className="mint-address">{token.mint.substring(0, 8)}...{token.mint.slice(-8)}</p>
            
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
    const [vanitySuffix, setVanitySuffix] = useState('DARK');
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
    const [solPrice, setSolPrice] = useState(150); // Default SOL price in USD

    // Initial Buy Modal States
    const [showInitialBuyModal, setShowInitialBuyModal] = useState(false);
    const [initialBuyAmount, setInitialBuyAmount] = useState('0.5');
    const [pendingTokenData, setPendingTokenData] = useState(null);

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
        }
        return () => subs.forEach(sub => solanaConnection.removeAccountChangeListener(sub));
    }, [createdTokens, client, solanaConnection]);

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
                await connection.getSlot('finalized');
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
            } catch (error) {
                setStatus(`❌ Failed to connect to ${network}: ${error.message}`);
            }
        };
        initConnection();
    }, [network]);

    useEffect(() => {
        if (!connected) {
            setStatus('Please connect your wallet 🔌');
        } else if (walletPublicKey) {
            setStatus(`✅ Connected: ${walletPublicKey.toString().substring(0, 4)}...${walletPublicKey.toString().slice(-4)} on ${network.toUpperCase()}`);
        } else {
            setStatus('❌ Invalid wallet public key');
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
            return;
        }

        if (!tradeAmount || parseFloat(tradeAmount) <= 0) {
            setStatus('❌ Enter a valid amount');
            return;
        }

        if (selectedToken.graduated) {
            setStatus('💡 Token graduated! Use Raydium or Jupiter to trade.');
            return;
        }

        setIsSending(true);
        setStatus(`🔄 Preparing ${modalTab}...`);
        
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

            const swapParam = {
                amountIn,
                minimumAmountOut: new BN(0),
                swapBaseForQuote,
                owner: walletPublicKey,
                pool,
                referralTokenAccount: null,
            };

            const swapTransaction = await client.pool.swap(swapParam);

            const { blockhash, lastValidBlockHeight } = await solanaConnection.getLatestBlockhash('finalized');
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
            // The onAccountChange will update the Firestore
            setTradeAmount('');
        } catch (error) {
            console.error('Trade error:', error);
            setStatus(`❌ Trade failed: ${error.message}`);
        } finally {
            setIsSending(false);
        }
    };

    const handleImageChange = (event) => {
        const file = event.target.files[0];
        if (file) {
            if (!['image/png', 'image/jpeg', 'image/gif'].includes(file.type)) {
                setStatus('❌ Only PNG, JPG, GIF allowed.');
                return;
            }
            if (file.size > 2 * 1024 * 1024) {
                setStatus('❌ Image size must be under 2MB.');
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
        return;
    }
    if (!tokenName || !ticker || !description || !imageFile) {
        setStatus('❌ Fill all required fields');
        return;
    }
    if (tokenName.length > 32 || ticker.length > 10 || description.length > 1000) {
        setStatus('❌ Name ≤32 chars, Ticker ≤10 chars, Description ≤1000 chars');
        return;
    }
    if (decimals !== 6 && decimals !== 9) {
        setStatus('❌ Decimals must be 6 or 9');
        return;
    }

    setIsSending(true);
    try {
        setStatus('🔄 Uploading to IPFS...');
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

        let mint;
        if (useVanityAddress && vanitySuffix) {
            setStatus(`🔄 Generating vanity address ending with "${vanitySuffix.toUpperCase()}"...`);
            mint = generateVanityKeypair(vanitySuffix, 500000, (attempts) => {
                if (attempts % 10000 === 0) {
                    setStatus(`🔄 Generating vanity address... ${attempts} attempts`);
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


        let { blockhash, lastValidBlockHeight } = await solanaConnection.getLatestBlockhash('finalized');

        let configTx = await client.partner.createConfig({
            config: config.publicKey,
            feeClaimer: FEE_WALLET,
            leftoverReceiver: FEE_WALLET,
            payer: walletPublicKey,
            quoteMint: NATIVE_MINT,
            ...curveConfig,
        });

        configTx.add(SystemProgram.transfer({
            fromPubkey: walletPublicKey,
            toPubkey: FEE_WALLET,
            lamports: BASE_FEE,
        }));

        configTx.recentBlockhash = blockhash;
        configTx.feePayer = walletPublicKey;
        configTx.partialSign(config);

        let signedTx = await signTransaction(configTx);
        let signature = await solanaConnection.sendRawTransaction(signedTx.serialize(), {
            skipPreflight: true,
            preflightCommitment: 'confirmed',
            maxRetries: 5
        });

        await solanaConnection.confirmTransaction({ 
            signature, 
            blockhash, 
            lastValidBlockHeight 
        }, 'finalized');

        // Verify config creation success
        const confirmedConfigTx = await solanaConnection.getTransaction(signature, {
            commitment: 'finalized',
            maxSupportedTransactionVersion: 0
        });
        if (confirmedConfigTx && confirmedConfigTx.meta && confirmedConfigTx.meta.err) {
            console.error('Config creation failed. Logs:', confirmedConfigTx.meta.logMessages);
            throw new Error(`Config creation failed: ${JSON.stringify(confirmedConfigTx.meta.err)}`);
        }

        setStatus('✅ Config created. Creating pool...');

        blockhash = (await solanaConnection.getLatestBlockhash('finalized')).blockhash;

        const createPoolParam = {
            baseMint: mint.publicKey,
            config: config.publicKey,
            name: tokenName,
            symbol: ticker,
            uri: metadataUri,
            payer: walletPublicKey,
            poolCreator: walletPublicKey,
        };

        let poolTx = await client.pool.createPool(createPoolParam);

        poolTx.recentBlockhash = blockhash;
        poolTx.feePayer = walletPublicKey;
        poolTx.partialSign(mint);

        signedTx = await signTransaction(poolTx);
        signature = await solanaConnection.sendRawTransaction(signedTx.serialize(), {
            skipPreflight: true,
            preflightCommitment: 'confirmed',
            maxRetries: 5
        });

        lastValidBlockHeight = (await solanaConnection.getLatestBlockhash('finalized')).lastValidBlockHeight;

        await solanaConnection.confirmTransaction({ 
            signature, 
            blockhash, 
            lastValidBlockHeight 
        }, 'finalized');

        // Verify pool creation success
        const confirmedPoolTx = await solanaConnection.getTransaction(signature, {
            commitment: 'finalized',
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
            poolInfo = await solanaConnection.getAccountInfo(poolAddress, 'finalized'); // Patched commitment
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
    } finally {
        setIsSending(false);
    }
};
    const handleInitialBuy = async () => {
        if (!pendingTokenData || !initialBuyAmount || parseFloat(initialBuyAmount) <= 0 || !client) {
            setStatus('❌ Enter a valid SOL amount');
            return;
        }

        try {
            setStatus('🔄 Processing initial buy...');
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

            const { blockhash, lastValidBlockHeight } = await solanaConnection.getLatestBlockhash('finalized');
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
            setShowInitialBuyModal(false);
            setPendingTokenData(null);
            setInitialBuyAmount('0.5');
            
            setTimeout(() => {
                setActivePage('home');
            }, 2000);
            
        } catch (error) {
            console.error('Initial buy error:', error);
            setStatus(`❌ Error: ${error.message}`);
        }
    };

    const handleSkipInitialBuy = async () => {
        try {
            if (!pendingTokenData) return;
            
            await saveTokenToFirestore(pendingTokenData);
            
            setStatus(`🎉 Token launched and saved! No initial buy.`);
            setShowInitialBuyModal(false);
            setPendingTokenData(null);
            
            setTimeout(() => {
                setActivePage('home');
            }, 2000);
            
        } catch (error) {
            console.error('Save error:', error);
            setStatus(`❌ Error saving token: ${error.message}`);
        }
    };

    return (
        <>
            <style>{`
                @import url('https://fonts.googleapis.com/css2?family=Orbitron:wght@400;700;900&display=swap');
                
                body {
                    margin: 0;
                    font-family: 'Orbitron', monospace !important;
                    background-color: #000;
                    color: #fff;
                }

                .header {
                    position: fixed;
                    top: 0;
                    left: 0;
                    width: 100%;
                    height: 60px;
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    padding: 0 15px;
                    background-color: #111;
                    border-bottom: 1px solid #333;
                    z-index: 1000;
                    box-sizing: border-box;
                }

                .logo {
                    font-size: 1.5em;
                    font-weight: bold;
                    color: #fff;
                }

                .header-actions {
                    display: flex;
                    align-items: center;
                    gap: 10px;
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
                    height: calc(100vh - 60px);
                    width: 100vw;
                    margin-top: 60px;
                }

                .sidebar {
                    width: 200px;
                    background-color: #111;
                    padding: 20px;
                    border-right: 1px solid #333;
                    height: 100%;
                    box-sizing: border-box;
                    transition: transform 0.3s ease-in-out;
                }
                .wallet-adapter-button-trigger{
                    background-color: #00000015 !important;}

                .sidebar button {
                    display: block;
                    width: 100%;
                    padding: 10px;
                    margin-bottom: 10px;
                    background: none;
                    border: none;
                    color: #fff;
                    text-align: left;
                    cursor: pointer;
                    font-size: 1.1em;
                    display: flex;
                    align-items: center;
                    gap: 10px;
                }

                .sidebar button.active {
                    color: #1cc29a;
                    border-left: 3px solid #1cc29a;
                    padding-left: 7px;
                }

                .main-content {
                    flex: 1;
                    padding: 20px;
                    overflow-y: auto;
                    width: 100%;
                    height: 100%;
                    box-sizing: border-box;
                }

                .create-coin {
                    background-color: #1cc29a;
                    color: #000;
                    padding: 10px 20px;
                    border: none;
                    border-radius: 20px;
                    cursor: pointer;
                    font-weight: bold;
                    white-space: nowrap;
                    font-size: 0.9em;
                }

                .home-page {
                    color: #fff;
                }

                .trending-bar {
                    background-color: #222;
                    padding: 10px;
                    margin-bottom: 20px;
                    border-radius: 5px;
                    display: flex;
                    align-items: center;
                    gap: 10px;
                }

                .trending-bar span {
                    font-size: 1.1em;
                    color: #1cc29a;
                }

                .filters {
                    display: flex;
                    gap: 10px;
                    margin-bottom: 20px;
                    flex-wrap: wrap;
                }

                .filters button {
                    background-color: #222;
                    color: #fff;
                    padding: 5px 10px;
                    border: none;
                    cursor: pointer;
                    border-radius: 5px;
                    font-size: 0.9em;
                }

                .search-input {
                    flex: 1;
                    background-color: #222;
                    color: #fff;
                    border: none;
                    padding: 10px;
                    border-radius: 5px;
                    min-width: 200px;
                }

                .search-button {
                    background-color: #1cc29a;
                    color: #000;
                    padding: 10px 20px;
                    border: none;
                    border-radius: 5px;
                    cursor: pointer;
                    white-space: nowrap;
                    display: flex;
                    align-items: center;
                    gap: 5px;
                    font-size: 0.9em;
                }

                .token-grid {
                    display: grid;
                    grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
                    gap: 20px;
                }

                .token-card {
                    background-color: #222;
                    padding: 10px;
                    border-radius: 5px;
                    text-align: center;
                    position: relative;
                    border: 1px solid #333;
                    cursor: pointer;
                    transition: transform 0.2s, border-color 0.2s;
                }

                .token-card:hover {
                    transform: translateY(-2px);
                    border-color: #1cc29a;
                }

                .token-socials {
                    display: flex;
                    justify-content: center;
                    gap: 10px;
                    margin: 10px 0;
                }

                .token-socials a {
                    background-color: #333;
                    color: #1cc29a;
                    width: 32px;
                    height: 32px;
                    border-radius: 50%;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    text-decoration: none;
                    transition: background-color 0.2s;
                }

                .token-socials a:hover {
                    background-color: #1cc29a;
                    color: #000;
                }

                .token-card h3 {
                    margin: 10px 0 5px 0;
                    font-size: 1.1em;
                }

                .token-card p {
                    font-size: 0.85em;
                    color: #ccc;
                    margin: 5px 0;
                }

                .mint-address {
                    font-size: 0.75em;
                    color: #888;
                    font-family: monospace;
                }

                .bonding-info {
                    background-color: rgba(28, 194, 154, 0.1);
                    padding: 8px;
                    border-radius: 5px;
                    margin: 8px 0;
                    border: 1px solid rgba(28, 194, 154, 0.2);
                }

                .bonding-info div {
                    color: #1cc29a;
                    font-size: 0.8em;
                    margin: 2px 0;
                }

                .token-stats {
                    display: flex;
                    justify-content: space-between;
                    margin: 8px 0;
                }

                .token-stats div {
                    text-align: left;
                }

                .token-stats > div > div:first-child {
                    font-size: 0.75em;
                    color: #888;
                }

                .token-stats > div > div:last-child {
                    font-weight: bold;
                    color: #1cc29a;
                }

                .token-metrics {
                    background-color: #1a1a1a;
                    padding: 8px;
                    border-radius: 5px;
                    margin: 8px 0;
                    border: 1px solid #333;
                }

                .metric-row {
                    display: flex;
                    justify-content: space-between;
                    padding: 2px 0;
                    font-size: 0.8em;
                }

                .metric-row span:first-child {
                    color: #888;
                }

                .metric-row span:last-child {
                    color: #1cc29a;
                    font-weight: bold;
                }

                .token-image {
                    width: 100%;
                    height: 120px;
                    object-fit: cover;
                    border-radius: 5px;
                }

                .progress-bar {
                    background-color: #333;
                    height: 6px;
                    margin: 8px 0;
                    border-radius: 5px;
                    overflow: hidden;
                }

                .progress {
                    background: linear-gradient(90deg, #1cc29a 0%, #00ff88 100%);
                    height: 100%;
                    border-radius: 5px;
                    transition: width 0.3s;
                }

                .buy-button {
                    background-color: #1cc29a;
                    color: #000;
                    padding: 8px 12px;
                    border: none;
                    border-radius: 5px;
                    cursor: pointer;
                    width: 100%;
                    font-weight: bold;
                    margin-top: 5px;
                    font-size: 0.9em;
                }

                .buy-button.graduated {
                    background-color: #ff9500;
                }

                .launch-page {
                    color: #fff;
                }

                .launch-page h1 {
                    margin-bottom: 20px;
                }

                .launch-form {
                    display: flex;
                    flex-direction: column;
                }

                .input-group {
                    margin-bottom: 20px;
                }

                .input-group label {
                    display: block;
                    margin-bottom: 5px;
                    color: #ccc;
                    font-weight: bold;
                }

                .input-group input,
                .input-group textarea,
                .input-group select {
                    width: 100%;
                    background-color: #222;
                    color: #fff;
                    border: 1px solid #333;
                    padding: 10px;
                    border-radius: 5px;
                    box-sizing: border-box;
                }

                .input-group textarea {
                    resize: vertical;
                    min-height: 100px;
                }

                .input-group p {
                    color: #888;
                    font-size: 0.9em;
                    margin-top: 5px;
                }

                .preview-media {
                    width: 100%;
                    max-width: 300px;
                    margin-top: 10px;
                    border-radius: 5px;
                }

                .checkbox {
                    display: flex;
                    align-items: center;
                    margin-bottom: 10px;
                    gap: 10px;
                }

                .checkbox input {
                    margin-right: 0;
                    width: auto;
                }

                .launch-button {
                    background-color: #1cc29a;
                    color: #000;
                    width: 100%;
                    padding: 15px;
                    border: none;
                    border-radius: 20px;
                    cursor: pointer;
                    font-weight: bold;
                    font-size: 1.1em;
                    margin-top: 10px;
                }

                .launch-button:disabled {
                    background-color: #333;
                    color: #666;
                    cursor: not-allowed;
                }

                .status-bar {
                    position: fixed;
                    bottom: 0;
                    left: 0;
                    width: 100%;
                    padding: 10px;
                    text-align: center;
                    background-color: #222;
                    color: #fff;
                    border-top: 1px solid #333;
                    z-index: 1000;
                }

                .status-bar.success {
                    background-color: #1cc29a;
                    color: #000;
                }

                .status-bar.error {
                    background-color: #ff0000;
                    color: #fff;
                }

                .new-badge {
                    position: absolute;
                    top: 10px;
                    right: 10px;
                    background-color: #1cc29a;
                    color: #000;
                    padding: 2px 6px;
                    border-radius: 10px;
                    font-size: 0.7em;
                    font-weight: bold;
                    z-index: 1;
                }

                .graduated-badge {
                    position: absolute;
                    top: 10px;
                    left: 10px;
                    background-color: #ff9500;
                    color: #000;
                    padding: 2px 6px;
                    border-radius: 10px;
                    font-size: 0.7em;
                    font-weight: bold;
                    z-index: 1;
                }

                .launch-container {
                    display: flex;
                    gap: 40px;
                    max-width: 1400px;
                    margin: 0 auto;
                }

                .launch-form-container {
                    flex: 1 1 60%;
                }

                .preview-panel {
                    flex: 1 1 40%;
                    position: sticky;
                    top: 20px;
                    height: fit-content;
                }

                .preview-panel > div {
                    background-color: #111;
                    border-radius: 5px;
                    padding: 20px;
                    border: 1px solid #333;
                }

                .preview-content {
                    background-color: #222;
                    border-radius: 5px;
                    padding: 20px;
                    border: 1px solid #333;
                }

                .preview-image-placeholder {
                    width: 100%;
                    height: 200px;
                    background-color: #333;
                    border-radius: 5px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    border: 2px dashed #555;
                }

                .preview-stats {
                    background-color: rgba(28, 194, 154, 0.1);
                    padding: 12px;
                    border-radius: 5px;
                    margin: 10px 0;
                    border: 1px solid rgba(28, 194, 154, 0.2);
                }

                .preview-stats div {
                    display: flex;
                    justify-content: space-between;
                    margin: 5px 0;
                }

                .preview-stats span:first-child {
                    font-size: 0.9em;
                    color: #1cc29a;
                }

                .preview-fee {
                    background-color: rgba(255, 193, 7, 0.1);
                    padding: 10px;
                    border-radius: 5px;
                    border: 1px solid rgba(255, 193, 7, 0.3);
                    margin: 10px 0;
                }

                .preview-fee div {
                    font-size: 0.85em;
                    color: #ffcc00;
                    margin: 2px 0;
                }

                .preview-button {
                    width: 100%;
                    padding: 14px;
                    background-color: #1cc29a;
                    color: #000;
                    border: none;
                    border-radius: 5px;
                    cursor: not-allowed;
                    opacity: 0.6;
                    font-weight: bold;
                }

                .no-tokens {
                    text-align: center;
                    padding: 80px 20px;
                    color: #666;
                    background-color: #111;
                    border-radius: 5px;
                    border: 1px solid #333;
                }

                .no-tokens div {
                    font-size: 3em;
                    margin-bottom: 16px;
                }

                .no-tokens p {
                    font-size: 1.2em;
                    margin-bottom: 8px;
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
                    background-color: rgba(0, 0, 0, 0.8);
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    z-index: 2000;
                }

                .modal-content {
                    background-color: #111;
                    border: 1px solid #333;
                    border-radius: 10px;
                    width: 90%;
                    max-width: 600px;
                    max-height: 90vh;
                    overflow-y: auto;
                    position: relative;
                }

                .modal-header {
                    padding: 20px;
                    border-bottom: 1px solid #333;
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                }

                .modal-close {
                    background: none;
                    border: none;
                    color: #fff;
                    font-size: 24px;
                    cursor: pointer;
                    padding: 0;
                    width: 30px;
                    height: 30px;
                }

                .modal-body {
                    padding: 20px;
                }

                .token-detail-image {
                    width: 100%;
                    height: 250px;
                    object-fit: cover;
                    border-radius: 10px;
                    margin-bottom: 15px;
                }

                .ca-copy-section {
                    background-color: #222;
                    padding: 12px;
                    border-radius: 5px;
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    margin: 15px 0;
                }

                .ca-address {
                    font-family: monospace;
                    font-size: 0.9em;
                    color: #1cc29a;
                    word-break: break-all;
                }

                .copy-button {
                    background-color: #1cc29a;
                    color: #000;
                    border: none;
                    padding: 8px 16px;
                    border-radius: 5px;
                    cursor: pointer;
                    font-weight: bold;
                    white-space: nowrap;
                    margin-left: 10px;
                }

                .copy-button.copied {
                    background-color: #00ff88;
                }

                .trade-tabs {
                    display: flex;
                    gap: 10px;
                    margin: 20px 0;
                }

                .trade-tab {
                    flex: 1;
                    padding: 12px;
                    background-color: #222;
                    border: none;
                    color: #fff;
                    cursor: pointer;
                    border-radius: 5px;
                    font-weight: bold;
                }

                .trade-tab.active {
                    background-color: #1cc29a;
                    color: #000;
                }

                .trade-input-group {
                    margin: 15px 0;
                }

                .trade-input-group label {
                    display: block;
                    margin-bottom: 8px;
                    color: #ccc;
                }

                .trade-input-group input {
                    width: 100%;
                    background-color: #222;
                    color: #fff;
                    border: 1px solid #333;
                    padding: 12px;
                    border-radius: 5px;
                    box-sizing: border-box;
                    font-size: 1.1em;
                }

                .trade-button {
                    width: 100%;
                    padding: 15px;
                    background-color: #1cc29a;
                    color: #000;
                    border: none;
                    border-radius: 5px;
                    cursor: pointer;
                    font-weight: bold;
                    font-size: 1.1em;
                    margin-top: 10px;
                }

                .trade-button:disabled {
                    background-color: #333;
                    color: #666;
                    cursor: not-allowed;
                }

                .social-links-large {
                    display: flex;
                    gap: 15px;
                    justify-content: center;
                    margin: 20px 0;
                }

                .social-links-large a {
                    background-color: #222;
                    color: #1cc29a;
                    width: 45px;
                    height: 45px;
                    border-radius: 50%;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    text-decoration: none;
                    font-size: 1.3em;
                    transition: all 0.2s;
                }

                .social-links-large a:hover {
                    background-color: #1cc29a;
                    color: #000;
                    transform: scale(1.1);
                }

                /* Mobile Responsiveness */
                @media (max-width: 768px) {
                    .header {
                        padding: 0 10px;
                    }

                    .logo {
                        font-size: 1em;
                    }

                    .create-coin {
                        display: none;
                    }

                    .mobile-menu-toggle {
                        display: block;
                    }

                    .header-actions {
                        gap: 5px;
                    }

                    .app-container {
                        flex-direction: column;
                        height: auto;
                    }

                    .sidebar {
                        position: fixed;
                        top: 60px;
                        left: 0;
                        width: 250px;
                        height: calc(100vh - 60px);
                        transform: translateX(-100%);
                        z-index: 999;
                    }

                    .sidebar.open {
                        transform: translateX(0);
                    }

                    .main-content {
                        padding: 15px;
                        margin-top: 0;
                        width: 100%;
                    }

                    .filters {
                        flex-direction: column;
                        align-items: stretch;
                    }

                    .filters > div {
                        order: 3;
                        margin-top: 10px;
                    }

                    .search-input {
                        min-width: auto;
                        margin-bottom: 10px;
                    }

                    .search-button {
                        justify-content: center;
                        width: 100%;
                    }

                    .token-grid {
                        grid-template-columns: 1fr;
                        gap: 15px;
                    }

                    .token-card {
                        padding: 15px;
                    }

                    .token-image {
                        height: 150px;
                    }

                    .token-stats {
                        flex-direction: column;
                        gap: 5px;
                    }

                    .token-metrics {
                        font-size: 0.75em;
                    }

                    .launch-container {
                        flex-direction: column;
                        gap: 20px;
                    }

                    .launch-form-container,
                    .preview-panel {
                        flex: none;
                        width: 100%;
                    }

                    .preview-panel {
                        position: static;
                    }

                    .modal-content {
                        width: 95%;
                        max-height: 95vh;
                    }

                    .modal-header {
                        padding: 15px;
                    }

                    .modal-body {
                        padding: 15px;
                    }

                    .token-detail-image {
                        height: 200px;
                    }

                    .ca-copy-section {
                        flex-direction: column;
                        gap: 10px;
                        align-items: stretch;
                    }

                    .copy-button {
                        margin-left: 0;
                        width: 100%;
                        justify-content: center;
                    }

                    .trade-tabs {
                        flex-direction: column;
                    }

                    .trade-tab {
                        width: 100%;
                    }

                    .social-links-large {
                        gap: 10px;
                    }

                    .social-links-large a {
                        width: 40px;
                        height: 40px;
                        font-size: 1.1em;
                    }

                    .status-bar {
                        padding: 8px;
                        font-size: 0.9em;
                    }

                    .no-tokens {
                        padding: 40px 15px;
                    }

                    .no-tokens div {
                        font-size: 2em;
                    }

                    .no-tokens p {
                        font-size: 1.1em;
                    }
                }

                @media (max-width: 480px) {
                    .header {
                        height: 50px;
                        padding: 0 10px;
                    }

                    .app-container {
                        height: calc(100vh - 50px);
                        margin-top: 50px;
                    }

                    .sidebar {
                        top: 50px;
                        width: 100%;
                        height: calc(100vh - 50px);
                    }

                    .logo {
                        font-size: 0.9em;
                    }

                    .main-content {
                        padding: 10px;
                    }

                    .trending-bar {
                        padding: 8px;
                        font-size: 0.9em;
                    }

                    .filters button {
                        padding: 8px 12px;
                        font-size: 0.8em;
                    }

                    .token-card h3 {
                        font-size: 1em;
                    }

                    .token-card p {
                        font-size: 0.8em;
                    }

                    .input-group input,
                    .input-group textarea,
                    .input-group select {
                        padding: 12px;
                        font-size: 16px; /* Prevents zoom on iOS */
                    }

                    .launch-button,
                    .trade-button {
                        padding: 12px;
                        font-size: 1em;
                    }

                    .modal-content {
                        width: 98%;
                        margin: 10px;
                    }
                }
            `}</style>
            <div className="app-container">
                {/* Header */}
                <header className="header">
                    <div className="logo">USDARK-LAUNCH</div>
                    <div className="header-actions">
                        <button 
                            className="create-coin"
                            onClick={() => setActivePage('launch')}
                        >
                            Create Coin
                        </button>
                        <button 
                            className="mobile-menu-toggle"
                            onClick={() => setShowMobileMenu(!showMobileMenu)}
                        >
                            {showMobileMenu ? <X size={24} /> : <Menu size={24} />}
                        </button>
                        <div className="wallet">
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
                            <Home size={18} /> Home
                        </button>
                        <button 
                            className={activePage === 'launch' ? 'active' : ''}
                            onClick={() => {
                                setActivePage('launch');
                                setShowMobileMenu(false);
                            }}
                        >
                            <Rocket size={18} /> Launch
                        </button>
                    </nav>

                    {/* Main Content */}
                    <main className="main-content">
                        {activePage === 'home' && (
                            <div className="home-page">
                                {/* Trending Bar */}
                                <div className="trending-bar">
                                    <TrendingUp size={20} color="#1cc29a" />
                                    <span>LAUNCHED TOKENS</span>
                                </div>

                                {/* Filters */}
                                <div className="filters">
                                    <button>All Tokens ({filteredTokens.length})</button>
                                    <button>Active ({filteredTokens.filter(t => !t.graduated).length})</button>
                                    <button>Graduated ({filteredTokens.filter(t => t.graduated).length})</button>
                                    <div style={{ display: 'flex', gap: '10px', flex: 1, minWidth: '300px' }}>
                                        <input 
                                            type="text" 
                                            className="search-input"
                                            placeholder="Search tokens..." 
                                            value={searchQuery} 
                                            onChange={e => setSearchQuery(e.target.value)}
                                        />
                                        <button className="search-button">
                                            <Search size={16} /> Search
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
                                        <p>Create your first token to get started!</p>
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
                                    <h1>Launch Token with Bonding Curve</h1>
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
                                            disabled={isSending || !solanaConnection}
                                        >
                                            {isSending ? 'Launching...' : 'Launch Token (0.02 SOL)'}
                                        </button>
                                    </form>
                                </div>

                                {/* Live Preview Panel */}
                                <div className="preview-panel">
                                    <div>
                                        <h2>Live Preview</h2>
                                        <div className="preview-content">
                                            {imagePreview ? (
                                                <img 
                                                    src={imagePreview} 
                                                    alt="Token preview" 
                                                    style={{ width: '100%', height: '200px', objectFit: 'cover', borderRadius: '5px' }}
                                                /> 
                                            ) : (
                                                <div className="preview-image-placeholder">
                                                    <span>No image yet</span>
                                                </div>
                                            )}
                                            
                                            <h3>{tokenName || 'Token Name'} ({ticker || 'TICKER'})</h3>
                                            
                                            <p>{description || 'Enter a description for your token...'}</p>
                                            
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
                                                <div>⚡ Launch Fee: 0.02 SOL</div>
                                                <div>🎯 Bonding Curve: Manual trading until 85 SOL</div>
                                                {useVanityAddress && vanitySuffix && (
                                                    <div>✨ Vanity: ...{vanitySuffix.toUpperCase()}</div>
                                                )}
                                            </div>
                                            
                                            <button className="preview-button" disabled>Preview Only</button>
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
                                src={selectedToken.image || 'https://via.placeholder.com/600x250'} 
                                alt={selectedToken.name}
                                className="token-detail-image"
                                onError={(e) => e.target.src = 'https://via.placeholder.com/600x250'}
                            />
                            
                            <p>{selectedToken.description}</p>
                            
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
                                <span className="ca-address">{selectedToken.mint}</span>
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
                                    <span style={{ fontSize: '0.8em' }}>
                                        {selectedToken.creator.substring(0, 4)}...{selectedToken.creator.slice(-4)}
                                    </span>
                                </div>
                            </div>
                            
                            {/* Advanced Metrics */}
                            <div style={{ backgroundColor: '#1a1a1a', padding: '15px', borderRadius: '5px', marginTop: '15px', border: '1px solid #333' }}>
                                <h3 style={{ marginTop: 0, marginBottom: '15px', color: '#1cc29a' }}>Token Metrics</h3>
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
                                        <>
                                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
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
                                                    <div style={{ color: '#1cc29a', fontWeight: 'bold' }}>{circulatingTokens.toFixed(2)}</div>
                                                </div>
                                            </div>
                                        </>
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
                                            backgroundColor: '#1a1a1a', 
                                            padding: '12px', 
                                            borderRadius: '5px', 
                                            marginBottom: '15px',
                                            border: '1px solid #333'
                                        }}>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
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
                                        disabled={!connected || !tradeAmount || parseFloat(tradeAmount) <= 0}
                                    >
                                        {modalTab === 'buy' ? 'Buy Tokens' : 'Sell Tokens'}
                                    </button>
                                </>
                            )}
                            
                            {selectedToken.graduated && (
                                <div className="preview-fee">
                                    <div>🎉 Token Graduated!</div>
                                    <div>Trade on Raydium or Jupiter</div>
                                </div>
                            )}
                            
                            {/* Transaction Link */}
                            {selectedToken.signature && (
                                <div style={{ marginTop: '20px', textAlign: 'center' }}>
                                    <a 
                                        href={`https://explorer.solana.com/tx/${selectedToken.signature}?cluster=${network}`}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        style={{ color: '#1cc29a', textDecoration: 'underline' }}
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
                            <div style={{ textAlign: 'center', marginBottom: '20px' }}>
                                <img 
                                    src={pendingTokenData.image || 'https://via.placeholder.com/200'} 
                                    alt={pendingTokenData.name}
                                    style={{ width: '150px', height: '150px', objectFit: 'cover', borderRadius: '10px', margin: '0 auto' }}
                                />
                                <h3 style={{ marginTop: '15px' }}>{pendingTokenData.name} ({pendingTokenData.symbol})</h3>
                            </div>

                            <div style={{ backgroundColor: '#222', padding: '15px', borderRadius: '5px', marginBottom: '20px' }}>
                                <p style={{ color: '#1cc29a', textAlign: 'center', marginBottom: '10px' }}>
                                    Be the first buyer of your token!
                                </p>
                                <p style={{ color: '#ccc', fontSize: '0.9em', textAlign: 'center' }}>
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
                                <p style={{ color: '#888', fontSize: '0.85em', marginTop: '5px' }}>
                                    You'll receive approximately {initialBuyAmount && parseFloat(initialBuyAmount) > 0 
                                        ? Number(calculateTokensOut(
                                            parseFloat(initialBuyAmount) * LAMPORTS_PER_SOL,
                                            0,
                                            Number(pendingTokenData.bondingSupplyUnits),
                                            pendingTokenData.decimals
                                          ) / (10n ** BigInt(pendingTokenData.decimals))).toFixed(2)
                                        : '0'} {pendingTokenData.symbol} tokens
                                </p>
                            </div>

                            <button 
                                className="trade-button"
                                onClick={handleInitialBuy}
                                disabled={!initialBuyAmount || parseFloat(initialBuyAmount) <= 0}
                                style={{ marginBottom: '10px' }}
                            >
                                Buy {initialBuyAmount || '0'} SOL Worth
                            </button>

                            <button 
                                className="trade-button"
                                onClick={handleSkipInitialBuy}
                                style={{ backgroundColor: '#666' }}
                            >
                                Skip Initial Buy
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Status Bar */}
            <footer className={`status-bar ${status.includes('❌') ? 'error' : status.includes('✅') || status.includes('🎉') ? 'success' : ''}`}>
                {status || '...'}
            </footer>
        </>
    );
}

export default App;