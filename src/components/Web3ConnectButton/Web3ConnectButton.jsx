import { useState, useEffect } from 'react';
import './Web3ConnectButton.css';

const Web3ConnectButton = () => {
  const [account, setAccount] = useState('');
  const [isConnecting, setIsConnecting] = useState(false);

  const formatAddress = (addr) => `${addr.slice(0, 6)}...${addr.slice(-4)}`;

  const connectWallet = async () => {
    try {
      setIsConnecting(true);

      if (!window.ethereum) {
        alert('Please install MetaMask!');
        return;
      }

      // Trigger MetaMask permission popup to choose an account
      await window.ethereum.request({
        method: 'wallet_requestPermissions',
        params: [{ eth_accounts: {} }],
      });

      const accounts = await window.ethereum.request({ method: 'eth_accounts' });
      if (accounts.length > 0) {
        setAccount(accounts[0]);
        console.log('Connected to:', accounts[0]);
      } else {
        setAccount('');
      }
    } catch (error) {
      console.error('Error connecting wallet:', error);
    } finally {
      setIsConnecting(false);
    }
  };

  const checkIfWalletIsConnected = async () => {
    if (!window.ethereum) return;

    try {
      const accounts = await window.ethereum.request({ method: 'eth_accounts' });
      if (accounts.length > 0) {
        setAccount(accounts[0]);
      }
    } catch (error) {
      console.error('Error checking wallet connection:', error);
    }
  };

  useEffect(() => {
    checkIfWalletIsConnected();
  
    const handleAccountsChanged = (accounts) => {
      console.log('Accounts changed:', accounts);
      if (accounts.length === 0) {
        setAccount('');
      } else {
        setAccount(accounts[0]);
        // 🔄 Reload the page when account changes
        window.location.reload();
      }
    };
  
    const handleChainChanged = () => {
      // 🔄 Reload the page when network changes
      window.location.reload();
    };
  
    if (window.ethereum) {
      window.ethereum.on('accountsChanged', handleAccountsChanged);
      window.ethereum.on('chainChanged', handleChainChanged);
    }
  
    return () => {
      if (window.ethereum?.removeListener) {
        window.ethereum.removeListener('accountsChanged', handleAccountsChanged);
        window.ethereum.removeListener('chainChanged', handleChainChanged);
      }
    };
  }, []);
  

  return (
    <div className="web3-connect-wrapper">
      {!account ? (
        <button
          className="connect-button"
          onClick={connectWallet}
          disabled={isConnecting}
        >
          {isConnecting ? 'Connecting...' : 'Connect Wallet'}
        </button>
      ) : (
        <div className="account-info">
          <span className="connected-indicator" />
          <span className="account-address">{formatAddress(account)}</span>
          <button
            className="disconnect-button"
            onClick={connectWallet}
          >
            Switch Wallet
          </button>
        </div>
      )}
    </div>
  );
};

export default Web3ConnectButton;
