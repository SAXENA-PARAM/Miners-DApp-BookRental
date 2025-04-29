import { useState, useEffect } from 'react';
import './Web3ConnectButton.css';

const Web3ConnectButton = () => {
  const [account, setAccount] = useState('');
  const [isConnecting, setIsConnecting] = useState(false);
  
  const checkIfWalletIsConnected = async () => {
    try {
      if (!window.ethereum) {
        console.log('Make sure you have MetaMask installed!');
        return;
      }
      
      const accounts = await window.ethereum.request({ method: 'eth_accounts' });
      
      if (accounts.length !== 0) {
        const account = accounts[0];
        console.log('Found an authorized account:', account);
        setAccount(account);
      } else {
        console.log('No authorized account found');
      }
    } catch (error) {
      console.error('Error checking if wallet is connected:', error);
    }
  };
  
  const connectWallet = async () => {
    try {
      setIsConnecting(true);
      
      if (!window.ethereum) {
        alert('Please install MetaMask or another Web3 wallet.');
        setIsConnecting(false);
        return;
      }
      
      const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
      const account = accounts[0];
      console.log('Connected to account:', account);
      setAccount(account);
    } catch (error) {
      console.error('Error connecting wallet:', error);
    } finally {
      setIsConnecting(false);
    }
  };
  
  // Note: MetaMask doesn't actually provide a method to disconnect
  // The best practice is to just clear the account state in your app
  const disconnectWallet = () => {
    console.log('Disconnecting wallet (clearing application state)');
    setAccount('');
  };
  
  useEffect(() => {
    // Check if wallet is connected on component mount
    checkIfWalletIsConnected();
    
    // Set up listeners for account changes and disconnects
    if (window.ethereum) {
      // Handle account changes
      const handleAccountsChanged = (accounts) => {
        console.log('Accounts changed:', accounts);
        if (accounts.length === 0) {
          // MetaMask is locked or the user has not connected any accounts
          console.log('Please connect to MetaMask.');
          setAccount('');
        } else {
          setAccount(accounts[0]);
        }
      };
      
      // Handle chain changes
      const handleChainChanged = () => {
        // Reload the page when they change networks
        window.location.reload();
      };
      
      // Subscribe to events
      window.ethereum.on('accountsChanged', handleAccountsChanged);
      window.ethereum.on('chainChanged', handleChainChanged);
      
      // Clean up listeners when component unmounts
      return () => {
        if (window.ethereum.removeListener) {
          window.ethereum.removeListener('accountsChanged', handleAccountsChanged);
          window.ethereum.removeListener('chainChanged', handleChainChanged);
        }
      };
    }
  }, []);
  
  const formatAddress = (address) => {
    return `${address.substring(0, 6)}...${address.substring(address.length - 4)}`;
  };
  
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
          <span className="connected-indicator"></span>
          <span className="account-address">{formatAddress(account)}</span>
          <button 
            className="disconnect-button"
            onClick={disconnectWallet}
          >
            Disconnect
          </button>
        </div>
      )}
    </div>
  );
};

export default Web3ConnectButton;