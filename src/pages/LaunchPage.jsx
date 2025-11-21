// pages/LaunchPage.js
import React from 'react';
import { Rocket, Info, DollarSign } from 'lucide-react';
import { MIGRATION_TARGET_SOL, USDARK_BYPASS, TOTAL_SUPPLY_TOKENS, BONDING_SUPPLY_TOKENS } from '../constants';

const LaunchPage = ({
    tokenName, setTokenName,
    ticker, setTicker,
    description, setDescription,
    imageFile, setImageFile,
    imagePreview, setImagePreview,
    decimals, setDecimals,
    useVanityAddress, setUseVanityAddress,
    vanityStatus, vanityProgress,
    twitterUrl, setTwitterUrl,
    telegramUrl, setTelegramUrl,
    websiteUrl, setWebsiteUrl,
    isSending, handleLaunchToken, handleImageChange,
    userSolBalance, userUsdarkBalance,
    formComplete, enoughSol, enoughUsdark,
    setShowLaunchInfoModal
}) => {
    const requireUsdark = USDARK_BYPASS === 1;
    return (
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
                    <button
                        type="button"
                        className="launch-button"
                        onClick={handleLaunchToken}
                        disabled={isSending || !formComplete || !enoughSol || !enoughUsdark}
                    >
                        {isSending ? 'Launching...' : USDARK_BYPASS === 1 ? 'Launch Token (0.02 SOL + 2000 USDARK)' : 'Launch Token (0.02 SOL)'}
                    </button>
                    {!enoughSol && <p style={{ color: 'red' }}>Insufficient SOL balance (need at least 0.05 SOL for fees and rent)</p>}
                    {requireUsdark && !enoughUsdark && <p style={{ color: 'red' }}>Insufficient USDARK balance (need at least 2000 USDARK)</p>}
                    {!formComplete && <p style={{ color: 'red' }}>Please complete all required fields</p>}
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
                        </div>
                        <button className="preview-button" onClick={() => setShowLaunchInfoModal(true)}>View Launch Details</button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default LaunchPage;