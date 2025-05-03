// src/pages/Explore.jsx
import { useState, useEffect, useCallback } from "react";
import { Link } from "react-router-dom";
import Web3 from "web3";
import {
  SMART_CONTRACT_ABI,
  SMART_CONTRACT_ADDRESS,
} from "../../constants.js";
import "./Explore.css";

/* ─── helpers ─────────────────────────────────────────────── */
const getWeb3 = () => new Web3(window.ethereum);
const getContract = (w3) =>
  new w3.eth.Contract(SMART_CONTRACT_ABI, SMART_CONTRACT_ADDRESS);
const weiToEth = (w) => Number(w) / 1e18;
const ipfsGateway =
  "https://silver-total-swallow-275.mypinata.cloud/ipfs/";

// constants that mirror the solidity contract
const MAX_PENALTY_DAYS = 5n;
const PENALTY_PER_DAY_WEI = 100000000000000n; // 1e14

/* ─── component ───────────────────────────────────────────── */
const Explore = () => {
  const [account, setAccount] = useState(null);
  const [books, setBooks] = useState([]);
  const [loading, setLoading] = useState(true);

  /* load the whole catalogue + per-book status for current user */
  const loadBooks = useCallback(async (userAddress) => {
    setLoading(true);
    try {
      const c = getContract(getWeb3());
      const nextId = await c.methods.nextBookId().call();
      const maxId = Number(nextId) - 1;
      const bookIds = Array.from({ length: maxId }, (_, i) => i + 1);
  
      // 1. Fetch all book details in parallel
      const bookDetails = await Promise.all(
        bookIds.map((id) => c.methods.getBookDetails(id).call())
      );
  
      // 2. Fetch all metadata in parallel
      const metadataResponses = await Promise.all(
        bookDetails.map((b) =>
          fetch(`${ipfsGateway}${b.metadataCid}`)
            .then((res) => res.json())
            .catch(() => ({})) // handle bad or missing JSON gracefully
        )
      );
  
      // 3. Conditionally fetch rental statuses (only for user-rented books)
      const statusPromises = bookDetails.map((b, i) => {
        if (
          userAddress &&
          b.currentRenter &&
          b.currentRenter.toLowerCase() === userAddress.toLowerCase()
        ) {
          return c.methods.getRentalStatus(bookIds[i], userAddress).call();
        } else {
          return null;
        }
      });
  
      const statuses = await Promise.all(statusPromises);
  
      const list = bookDetails.map((b, i) => {
        const metadata = metadataResponses[i];
        const status = statuses[i];
        const isRentedByMe =
          status != null && b.currentRenter.toLowerCase() === userAddress.toLowerCase();
  
        return {
          id: bookIds[i],
          owner: b.owner,
          currentRenter: b.currentRenter,
          title: metadata.title ?? "Untitled",
          author: metadata.author ?? "Unknown",
          dailyRentWei: b.dailyRentWei,
          isAvailable: b.isAvailable,
          imageUri: metadata.imageCid
            ? `${ipfsGateway}${metadata.imageCid}`
            : "/default-image.jpg",
          timeRemaining: status ? Number(status.timeRemaining) : 0,
          isPenalty: status ? status.isPenalty : false,
          isRentedByMe,
        };
      });
  
      setBooks(list);
    } catch (err) {
      console.error("Failed to load books:", err);
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
      loadBooks(addr);
    })();
  }, [loadBooks]);

  /* rent handler (prompts for days first) */
  const handleRent = async (book) => {
    const daysStr = prompt(
      `For how many days do you want to rent “${book.title}”?`,
      "1"
    );
    const days = Number(daysStr);
    if (!days || days < 1) return; // cancelled / invalid

    try {
      const w3 = getWeb3();
      const c = getContract(w3);

      // deposit = days * dailyRent + MAX_PENALTY_DAYS * PENALTY_PER_DAY
      const deposit =
        BigInt(days) * BigInt(book.dailyRentWei) +
        MAX_PENALTY_DAYS * PENALTY_PER_DAY_WEI;

      await c.methods
        .rentBook(book.id, days)
        .send({ from: account, value: deposit.toString() });

      alert("Rented successfully!");
      loadBooks(account); // refresh UI
    } catch (err) {
      alert(err?.reason || err?.message || "Rent failed.");
    }
  };

  /* ─── UI ─────────────────────────────────────────────────── */
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
          {books.map((b) => {
            const isOwner =
              account &&
              account.toLowerCase() === b.owner.toLowerCase();

            return (
              <Link
                to={`/book/${b.id}`}
                key={b.id}
                className="book-card link-wrapper"
              >
                {b.imageUri && (
                  <img
                    src={b.imageUri}
                    alt={b.title}
                    className="cover"
                    loading="lazy"
                  />
                )}

                <h2>{b.title}</h2>
                <p className="author">by {b.author}</p>
                <p>Daily&nbsp;{weiToEth(b.dailyRentWei)} ETH</p>

                

                {!b.isAvailable && (
                  b.isRentedByMe ? (
                    <p
                      className="time"
                      style={{
                        background: b.isPenalty 
                          ? "rgba(186, 9, 20, 0.93)"
                          : "rgba(9, 96, 186, 0.8)",
                      }}
                    >
                      {b.timeRemaining} day{b.timeRemaining === 1 ? " left" : "s left"}
                    </p>
                  ) : (
                    <p className="unavailable">Currently rented out</p>
                  )
                )}

                {!b.isAvailable && (
                  <span className="badge rented-badge">Rented</span>
                )}

                {/* Rent button states */}
                {b.isAvailable && (
                  <button
                    className={`rent-button ${
                      isOwner ? "disabled" : "active"
                    }`}
                    disabled={isOwner}
                    onClick={(e) => {
                      e.preventDefault(); // keep card clickable
                      if (!isOwner) handleRent(b);
                    }}
                  >
                    {isOwner ? "Your book" : "Rent"}
                  </button>
                )}
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default Explore;
