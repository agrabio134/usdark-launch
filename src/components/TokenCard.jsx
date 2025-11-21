// components/TokenCard.js
import React from 'react';
import { timeAgo } from '../utils';
import { MIGRATION_TARGET_SOL, BONDING_SUPPLY_TOKENS, TOTAL_SUPPLY_TOKENS } from '../constants';

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

export default TokenCard;