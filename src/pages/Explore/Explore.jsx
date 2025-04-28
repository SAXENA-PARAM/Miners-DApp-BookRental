// src/pages/Explore.jsx
import { useState, useEffect, useCallback } from "react";
import { Link } from "react-router-dom";
import Web3 from "web3";
import { SMART_CONTRACT_ABI, SMART_CONTRACT_ADDRESS } from "../../constants.js";
import "./Explore.css";

/* helpers */
const getWeb3     = () => new Web3(window.ethereum);
const getContract = (w3) =>
  new w3.eth.Contract(SMART_CONTRACT_ABI, SMART_CONTRACT_ADDRESS);
const weiToEth    = (w) => Number(w) / 1e18;
const ipfsGateway = "https://silver-total-swallow-275.mypinata.cloud/ipfs/";  // Pinata gateway URL

/* component */
const Explore = () => {
  const [account, setAccount] = useState(null);
  const [books, setBooks] = useState([]);
  const [loading, setLoading] = useState(true);

  /* load catalogue */
  const loadBooks = useCallback(async () => {
    setLoading(true);
    try {
      const c = getContract(getWeb3());
      const nextId = await c.methods.nextBookId().call();
      const maxId = Number(nextId) - 1;
      const list = [];

      for (let id = 1; id <= maxId; id++) {
        const b = await c.methods.getBookDetails(id).call();
        
        // Fetch metadata from IPFS using metadataCid
        const metadataUrl = `${ipfsGateway}${b.metadataCid}`;
        const metadataRes = await fetch(metadataUrl);
        const metadata = await metadataRes.json();

        // Extract imageCid from metadata and construct the image URL
        let imageUrl = "/default-image.jpg"; // Fallback image if not available
        if (metadata.imageCid) {
          imageUrl = `${ipfsGateway}${metadata.imageCid}`;  // Construct image URL using Pinata's IPFS gateway
        }

        // Construct the book details
        list.push({
          id,
          title: metadata.title ?? b.title,
          author: metadata.author ?? b.author,
          dailyRentWei: b.dailyRentWei ?? b.dailyRentWei,
          isAvailable: b.isAvailable ?? b.isAvailable,
          depositWei: b.depositAmountWei ?? b.depositAmountWei,
          imageUri: imageUrl,  // Use constructed image URL
        });
      }
      setBooks(list);
    } finally {
      setLoading(false);
    }
  }, []);

  /* connect wallet once */
  useEffect(() => {
    if (!window.ethereum) return;
    (async () => {
      await window.ethereum.request({ method: "eth_requestAccounts" });
      const [addr] = await getWeb3().eth.getAccounts();
      setAccount(addr);
      loadBooks();
    })();
  }, [loadBooks]);

  /* rent handler (BigInt math) */
  const handleRent = async (book) => {
    try {
      const w3 = getWeb3();
      const c  = getContract(w3);

      const totalWei = (
        BigInt(book.dailyRentWei.toString()) +
        BigInt(book.depositWei.toString())
      ).toString();

      await c.methods.rentBook(book.id).send({ from: account, value: totalWei });
      alert("Rented!");
      loadBooks();
    } catch (err) {
      alert(err?.reason || err?.message || "Rent failed.");
    }
  };

  /* UI */
  if (!window.ethereum) return <p>Please install MetaMask.</p>;

  return (
    <div className="explore-page">
      <h1 className="page-title">Explore Books</h1>

      {loading ? (
        <p className="explore-msg">Loading catalogue…</p>
      ) : books.length === 0 ? (
        <p className="explore-msg">No books listed yet.</p>
      ) : (
        <div className="books-list">
          {books.map((b) => (
            <Link
              to={`/book/${b.id}`}
              key={b.id}
              className="book-card link-wrapper"
            >
              {b.imageUri && <img src={b.imageUri} alt={b.title} className="cover" />}
              <h2>{b.title}</h2>
              <p className="author">by {b.author}</p>
              <p>Daily&nbsp;{weiToEth(b.dailyRentWei)} ETH</p>

              {!b.isAvailable && <span className="badge">Rented</span>}

              {b.isAvailable && (
                <button
                  className="rent-button"
                  onClick={(e) => {
                    e.preventDefault(); // keep card clickable
                    handleRent(b);
                  }}
                >
                  Rent
                </button>
              )}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
};

export default Explore;
