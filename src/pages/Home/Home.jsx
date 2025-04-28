import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import './Home.css';

const Home = () => {
  return (
    <div className="home-page">
      <div className="container">
        <div className="hero-section">
          <motion.div 
            className="hero-content"
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
          >
            <h1 className="hero-title">
              Decentralized Book Rental
              <span className="highlight"> on the Blockchain</span>
            </h1>
            <p className="hero-subtitle">
              Rent your favorite books using cryptocurrency, with secure blockchain verification and decentralized storage.
            </p>
            <div className="hero-actions">
              <Link to="/explore" className="primary-button">
                Explore Books
              </Link>
              <Link to="/my-books" className="secondary-button">
                My Collection
              </Link>
            </div>
          </motion.div>
          
          <motion.div 
            className="hero-image-container"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.6, delay: 0.2 }}
          >
            <img 
              src="https://images.pexels.com/photos/159711/books-bookstore-book-reading-159711.jpeg?auto=compress&cs=tinysrgb&w=1260&h=750&dpr=2" 
              alt="BookChain Library" 
              className="hero-image" 
            />
          </motion.div>
        </div>
        
        <motion.div 
          className="features-section"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.5, delay: 0.4 }}
        >
          <h2 className="section-title">Why BookChain?</h2>
          
          <div className="features-grid">
            <div className="feature-card">
              <div className="feature-icon">🔒</div>
              <h3 className="feature-title">Secure & Transparent</h3>
              <p className="feature-description">
                All transactions are recorded on the blockchain, ensuring complete transparency and security.
              </p>
            </div>
            
            <div className="feature-card">
              <div className="feature-icon">💰</div>
              <h3 className="feature-title">Low Fees</h3>
              <p className="feature-description">
                Pay only for what you read with our crypto-based rental system. No hidden charges.
              </p>
            </div>
            
            <div className="feature-card">
              <div className="feature-icon">📚</div>
              <h3 className="feature-title">Vast Library</h3>
              <p className="feature-description">
                Access thousands of books across all genres, from classics to contemporary bestsellers.
              </p>
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
};

export default Home;