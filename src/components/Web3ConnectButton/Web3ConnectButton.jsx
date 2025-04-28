import { useState, useEffect } from 'react';
import { ethers } from 'ethers';
import { motion } from 'framer-motion';
import './Web3ConnectButton.css';

const Web3ConnectButton = () => {
  const [account, setAccount] = useState('');
  const [isConnecting, setIsConnecting] = useState(false);
  
  const checkIfWalletIsConnected = async () => {
    try {
      const { ethereum } = window;
      
      if (!ethereum) {
        return;
      }
      
      const accounts = await ethereum.request({ method: 'eth_accounts' });
      
      if (accounts.length !== 0) {
        setAccount(accounts[0]);
      }
    } catch (error) {
      console.error('Error checking if wallet is connected:', error);
    }
  };
  
  const connectWallet = async () => {
    try {
      setIsConnecting(true);
      const { ethereum } = window;
      
      if (!ethereum) {
        alert('Please install MetaMask or another Web3 wallet.');
        setIsConnecting(false);
        return;
      }
      
      const accounts = await ethereum.request({ method: 'eth_requestAccounts' });
      setAccount(accounts[0]);
      setIsConnecting(false);
    } catch (error) {
      console.error('Error connecting wallet:', error);
      setIsConnecting(false);
    }
  };
  
  const disconnectWallet = () => {
    setAccount('');
  };
  
  useEffect(() => {
    checkIfWalletIsConnected();
    
    // Listen for account changes
    if (window.ethereum) {
      window.ethereum.on('accountsChanged', (accounts) => {
        if (accounts.length === 0) {
          setAccount('');
        } else {
          setAccount(accounts[0]);
        }
      });
    }
    
    return () => {
      if (window.ethereum) {
        window.ethereum.removeListener('accountsChanged', () => {});
      }
    };
  }, []);
  
  const formatAddress = (address) => {
    return `${address.substring(0, 6)}...${address.substring(address.length - 4)}`;
  };
  
  return (
    <div className="web3-connect-wrapper">
      {!account ? (
        <motion.button 
          className="connect-button"
          onClick={connectWallet}
          disabled={isConnecting}
          whileTap={{ scale: 0.95 }}
        >
          {isConnecting ? 'Connecting...' : 'Connect Wallet'}
        </motion.button>
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