// public/vanityWorker.js
self.onmessage = async function (e) {
  const { suffix, maxAttempts = 2000000, timeoutMs = 30000 } = e.data;
  const upperSuffix = suffix.toUpperCase();
  let attempts = 0;
  const startTime = Date.now();

  const sendProgress = (found = false) => {
    self.postMessage({
      type: 'progress',
      attempts,
      percent: Math.min((attempts / maxAttempts) * 100, 100).toFixed(1),
      found,
    });
  };

  while (attempts < maxAttempts && Date.now() - startTime < timeoutMs) {
    const { Keypair } = await import('@solana/web3.js');
    const keypair = Keypair.generate();
    const address = keypair.publicKey.toBase58();

    attempts++;

    if (address.endsWith(upperSuffix)) {
      sendProgress(true);
      self.postMessage({
        type: 'result',
        secretKey: Array.from(keypair.secretKey),
        address,
      });
      return;
    }

    if (attempts % 5000 === 0) {
      sendProgress();
    }
  }

  sendProgress();
  self.postMessage({ type: 'timeout' });
};