// constants.js
import { PublicKey, LAMPORTS_PER_SOL } from '@solana/web3.js';
import { TOKEN_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID, NATIVE_MINT } from '@solana/spl-token';

export const NETWORKS = {
    'devnet': [
        'https://api.devnet.solana.com',
        'https://devnet.solana.com',
        'https://dawn-devnet.solana.com'
    ],
    'mainnet': [
        'https://mainnet.helius-rpc.com/?api-key=a736e60e-52b8-469a-9f57-298d73076f3a',
        'https://solana.drpc.org/',
        'https://solana-rpc.publicnode.com',
        'https://api.mainnet-beta.solana.com',
        'https://solana.lavenderfive.com/',
        'https://solana.api.onfinality.io/public'
    ]
};

export const DEFAULT_NETWORK = 'mainnet';

export const firebaseConfig = {
    apiKey: "AIzaSyBmF3F8CgYQfpqN6xSpeL0rkJvpshFLmwk",
    authDomain: "usdark-launchpad.firebaseapp.com",
    projectId: "usdark-launchpad",
    storageBucket: "usdark-launchpad.firebasestorage.app",
    messagingSenderId: "54701943971",
    appId: "1:54701943971:web:295fa5465d713d28502316"
};

export let FEE_WALLET;
try {
    FEE_WALLET = new PublicKey('9t2R1ZF27tnp811RevvUSS8vEy3EcPNSJG3CjfbFJC46');
} catch (error) {
    console.error('Invalid FEE_WALLET address:', error);
    FEE_WALLET = new PublicKey('11111111111111111111111111111111');
}

export const BASE_FEE = 0.02 * LAMPORTS_PER_SOL;
export const PINATA_JWT = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySW5mb3JtYXRpb24iOnsiaWQiOiJhMTNlMDlhMy1hYmJjLTQwOWYtOTdmMi1mNGY0N2Y2ODUzZDYiLCJlbWFpbCI6ImFncmFiaW9oYXJ2ZXlAZ21haWwuY29tIiwiZW1haWxfdmVyaWZpZWQiOnRydWUsInBpbl9wb2xpY3kiOnsicmVnaW9ucyI6W3siZGVzaXJlZFJlcGxpY2F0aW9uQ291bnQiOjEsImlkIjoiRlJBMSJ9LHsiZGVzaXJlZFJlcGxpY2F0aW9uQ291bnQiOjEsImlkIjoiTllDMSJ9XSwidmVyc2lvbiI6MX0sIm1mYV9lbmFibGVkIjpmYWxzZSwic3RhdHVzIjoiQUNUSVZFIn0sImF1dGhlbnRpY2F0aW9uVHlwZSI6InNjb3BlZEtleSIsInNjb3BlZEtleUtleSI6IjE2MTc1YTM5NTE5NWFmMWVjNjk5Iiwic2NvcGVkS2V5U2VjcmV0IjoiY2FjNWI4NmRjYjkxMzBlYWQ5NWM4MTZmMzk3ZWZiMWUyZTIwMzQxZjM1OGMxMzk5YTE0ZWYzYjczNjNkYmE0MSIsImV4cCI6MTc5MTg5MjU4NH0.ZRvRz1xkIvI0VN-Xd44ZdXSUEMhVyK-TaNFPk4BOZYs';
export const TOTAL_SUPPLY_TOKENS = 1000000000;
export const BONDING_SUPPLY_TOKENS = 800000000;
export const DEX_SUPPLY_TOKENS = 200000000;
export const MIGRATION_TARGET_SOL = 40;
export const VIRTUAL_SOL_LAMPORTS = BigInt(30 * LAMPORTS_PER_SOL);
export const VIRTUAL_TOKENS_BASE = 200000000n;
export const DBC_PROGRAM_ID = new PublicKey('dbcij3LWUppWqq96dh6gJWwBifmcGfLSB5D4DuSMaqN');
export const USDARK_MINT = new PublicKey('4EKDKWJDrqrCQtAD6j9sM5diTeZiKBepkEB8GLP9Dark');
export const USDARK_DECIMALS = 6;
export const LAUNCH_FEE_USDARK = 2000;
export const USDARK_BYPASS = 1;

export { LAMPORTS_PER_SOL, TOKEN_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID, NATIVE_MINT };