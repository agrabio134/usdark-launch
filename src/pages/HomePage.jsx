// pages/HomePage.js
import React from 'react';
import TokenCard from '../components/TokenCard';
import { Home, TrendingUp, Search, Loader2, Rocket } from 'lucide-react';

const HomePage = ({ searchQuery, setSearchQuery, isLoadingTokens, filteredTokens, solPrice, tokenMetrics, handleTokenAction }) => {
    return (
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
    );
};

export default HomePage;