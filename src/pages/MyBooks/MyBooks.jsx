import { useState, useEffect, useCallback } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import Web3 from "web3";
import "./MyBooks.css";
import { SMART_CONTRACT_ABI, SMART_CONTRACT_ADDRESS } from "../../constants.js";

/* helpers */
const getWeb3     = () => new Web3(window.ethereum);
const getContract = (w3) => new w3.eth.Contract(SMART_CONTRACT_ABI, SMART_CONTRACT_ADDRESS);
const weiToEth    = (w) => Number(w) / 1e18;
const ipfsGateway = "https://silver-total-swallow-275.mypinata.cloud/ipfs/";  // Pinata gateway URL

const MyBooks = () => {
  const [account, setAccount] = useState(null);
  const [books,   setBooks]   = useState([]);
  const [loading, setLoading] = useState(true);

  /* fetch list */
  const loadMyBooks = useCallback(async () => {
    if (!account) return;
    setLoading(true);
    try {
      const c = getContract(getWeb3());
      const raw = await c.methods.getUserRentedBooks(account).call();
  
      /* handle v1 (array) & v4 (array-like with BigInt) */
      const ids = Array.isArray(raw)
        ? raw.map(String)
        : Object.values(raw)
            .filter((v) => typeof v === "bigint" || /^\d+$/.test(v))
            .map((v) => v.toString());
  
      const list = await Promise.all(
        ids.map(async (id) => {
          const b = await c.methods.getBookDetails(id).call();
          
          const metadataCid = b.metadataCid ?? b[4];
          let metadata = {};
          try {
            const metadataUrl = `${ipfsGateway}${metadataCid}`;
            const metadataRes = await fetch(metadataUrl);
            metadata = await metadataRes.json();
          } catch (err) {
            console.error("Failed to fetch metadata for book", id, err);
          }
  
          // Default fallback image
          let imageUrl = "/default-image.jpg";
          if (metadata.imageCid) {
            imageUrl = `${ipfsGateway}${metadata.imageCid}`;
          }
  
          return {
            id,
            title: metadata.title ?? "Unknown Title",
            author: metadata.author ?? "Unknown Author",
            dailyRentWei: b.dailyRentWei ?? b[0],
            isAvailable:  b.isAvailable  ?? b[1],
            imageUri: imageUrl,
          };
        })
      );
      setBooks(list);
    } finally {
      setLoading(false);
    }
  }, [account]);
  

  /* wallet connect */
  useEffect(() => {
    if (!window.ethereum) return;
    (async () => {
      await window.ethereum.request({ method: "eth_requestAccounts" });
      const [addr] = await getWeb3().eth.getAccounts();
      setAccount(addr);
    })();
  }, []);

  useEffect(() => { loadMyBooks(); }, [loadMyBooks]);

  /* return */
  const handleReturn = async (id, e) => {
    e.preventDefault();
    const c = getContract(getWeb3());
    await c.methods.returnBook(id).send({ from: account });
    loadMyBooks();
  };

  /* UI */
  if (!window.ethereum) return <p>Please install MetaMask.</p>;

  return (
    <div className="my-books-page">
      <h1 className="page-title">My Books</h1>

      {!account ? (
        <p>Connecting wallet…</p>
      ) : loading ? (
        <p>Loading your books…</p>
      ) : books.length === 0 ? (
        <motion.div
          className="empty-library"
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
        >
          <div className="empty-content">
            <h2>Your Library is Empty</h2>
            <button onClick={() => (window.location.href = "/")}>Explore Books</button>
          </div>
        </motion.div>
      ) : (
        <div className="books-list">
          {books.map((b) => (
            <Link to={`/book/${b.id}`} key={b.id} className="book-card link-wrapper">
              {b.imageUri && <img src={b.imageUri} alt={b.title} className="cover" />}
              <h3>{b.title}</h3>
              <p className="author">by {b.author}</p>
              <button className="return-button" onClick={(e) => handleReturn(b.id, e)}>
                Return
              </button>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
};

export default MyBooks;
