import React from 'react';
import { createRoot } from 'react-dom/client';
import { WalletProvider } from '@solana/wallet-adapter-react';
import { WalletModalProvider } from '@solana/wallet-adapter-react-ui';
import { PhantomWalletAdapter } from '@solana/wallet-adapter-phantom';
import App from './App';
import './index.css'; // Global CSS (we'll create this next)

const wallets = [new PhantomWalletAdapter()];

const container = document.getElementById('root');
const root = createRoot(container);

root.render(
  <WalletProvider wallets={wallets} autoConnect>
    <WalletModalProvider>
      <App />
    </WalletModalProvider>
  </WalletProvider>
);