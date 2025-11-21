// pages/ProfilePage.js
import React from 'react';
import { User, Loader2, DollarSign } from 'lucide-react';

const ProfilePage = ({ userTokens, claimableFees, isSending, handleClaim, setActivePage }) => {
    return (
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
    );
};

export default ProfilePage;