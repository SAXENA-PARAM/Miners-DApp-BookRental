import { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import Web3ConnectButton from '../Web3ConnectButton/Web3ConnectButton';
import './Header.css';

const Header = () => {
  const [isScrolled, setIsScrolled] = useState(false);
  const location = useLocation();
  
  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 10);
    };
    
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);
  
  return (
    <header className={`header ${isScrolled ? 'header-scrolled' : ''}`}>
      <div className="container header-container">
        <Link to="/" className="logo">
          <span className="logo-text"><img src="./icon.png" style={{
  width: "30px",
  height: "30px",
  position: "relative",
  top: "5px",
  marginRight: "7px",
  filter: "invert(25%) sepia(100%) saturate(5000%) hue-rotate(205deg) brightness(95%) contrast(85%)",
  
}}

          />BookChain</span>
        </Link>
        
        <nav className="main-nav">
          <ul className="nav-list">
            <li className="nav-item">
              <Link 
                to="/explore" 
                className={`nav-link ${location.pathname === '/explore' ? 'active' : ''}`}
              >
                Explore
              </Link>
            </li>
            <li className="nav-item">
              <Link 
                to="/my-books" 
                className={`nav-link ${location.pathname === '/my-books' ? 'active' : ''}`}
              >
                My Books
              </Link>
            </li>
            <li className="nav-item">
              <Link 
                to="/list" 
                className={`nav-link ${location.pathname === '/list' ? 'active' : ''}`}
              >
                List Your Book
              </Link>
            </li>
          </ul>
        </nav>
        
        <div className="header-actions">
          <Web3ConnectButton />
        </div>
      </div>
    </header>
  );
};

export default Header;