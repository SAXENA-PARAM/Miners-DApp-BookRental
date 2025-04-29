// src/pages/BookDetails.jsx
import { useParams, useNavigate } from "react-router-dom";
import { useState, useEffect, useCallback } from "react";
import Web3 from "web3";
import {
  SMART_CONTRACT_ABI,
  SMART_CONTRACT_ADDRESS,
} from "../../constants.js";
import "./BookDetails.css";

/* helpers --------------------------------------------------- */
const getWeb3 = () => new Web3(window.ethereum);
const getContract = (w3) =>
  new w3.eth.Contract(SMART_CONTRACT_ABI, SMART_CONTRACT_ADDRESS);
const weiToEth = (wei) => Number(wei) / 1e18;
const ipfsGateway =
  "https://silver-total-swallow-275.mypinata.cloud/ipfs/";

/* must mirror solidity */
const MAX_PENALTY_DAYS = 5n;
const PENALTY_PER_DAY_WEI = 100000000000000n;

/* component ------------------------------------------------- */
export default function BookDetails() {
  const { id } = useParams();          // URL param
  const nav   = useNavigate();

  const [account, setAccount] = useState(null);
  const [book,    setBook]    = useState(null);
  const [status,  setStatus]  = useState(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState(null);

  /* connect wallet (once) ---------------------------------- */
  useEffect(() => {
    if (!window.ethereum) return;
    (async () => {
      await window.ethereum.request({ method: "eth_requestAccounts" });
      const [addr] = await getWeb3().eth.getAccounts();
      setAccount(addr);
    })();
  }, []);

  /* fetch book + status ------------------------------------ */
  const loadData = useCallback(async () => {
    if (!account) return;                // wait for wallet
    setLoading(true);
    setError(null);

    try {
      const w3 = getWeb3();
      const c  = getContract(w3);

      /* 1 — on-chain tuple */
      const result = await c.methods.getBookDetails(id).call();
      const dailyRentWei  = result[0];
      const owner         = result[1];
      const isAvailable   = result[2];
      const currentRenter = result[3];
      const metadataCid   = result[4];

      /* 2 — off-chain JSON */
      let metadata = {};
      try {
        const res = await fetch(`${ipfsGateway}${metadataCid}`);
        metadata  = await res.json();
      } catch { /* ignore bad metadata */ }

      /* 3 — assemble */
      setBook({
        id: Number(id),
        owner,
        currentRenter,
        isAvailable,
        dailyRentWei,
        title:  metadata.title  ?? "Untitled",
        author: metadata.author ?? "Unknown",
        imageUri: metadata.imageCid
          ? `${ipfsGateway}${metadata.imageCid}`
          : "/default-image.jpg",
      });

      /* 4 — rental status (only for current renter) */
      if (currentRenter?.toLowerCase() === account.toLowerCase()) {
        const struc = await c.methods
          .getRentalStatus(id, account)
          .call();
        setStatus({
          timeRemaining: Number(struc.timeRemaining),
          isPenalty: struc.isPenalty,
        });
      } else {
        setStatus(null);
      }
    } catch (err) {
      console.error(err);
      setError("Couldn’t load this book. It may not exist on this network.");
      setBook(null);
      setStatus(null);
    } finally {
      setLoading(false);
    }
  }, [id, account]);

  /* re-run whenever id or wallet changes */
  useEffect(() => { loadData(); }, [loadData]);

  /* actions ------------------------------------------------- */
  const rentNow = async () => {
    if (!book?.isAvailable) { alert("Book already rented."); return; }

    const days = Number(prompt("How many days do you want to rent?", "1"));
    if (!days || days < 1) return;

    try {
      const w3 = getWeb3();
      const c  = getContract(w3);

      const deposit =
        BigInt(days) * BigInt(book.dailyRentWei) +
        MAX_PENALTY_DAYS * PENALTY_PER_DAY_WEI;

      await c.methods
        .rentBook(id, days)
        .send({ from: account, value: deposit.toString() });

      alert("✅ Rent successful!");
      nav("/");
    } catch (e) {
      alert(e?.reason || e?.message || "Rent failed.");
    }
  };

  const returnNow = async () => {
    try {
      const w3 = getWeb3();
      const c  = getContract(w3);
      await c.methods.returnBook(id).send({ from: account });
      alert("✅ Returned & settled!");
      nav("/");
    } catch (e) {
      alert(e?.reason || e?.message || "Return failed.");
    }
  };

  /* ---------- UI ----------------------------------------- */
  if (!window.ethereum) return <p>Please install MetaMask.</p>;
  if (loading)          return <p>Loading…</p>;
  if (error)            return <p>{error}</p>;
  if (!book)            return <p>Book not found.</p>;

  const isOwner  = account.toLowerCase() === book.owner.toLowerCase();
  const isRenter = account.toLowerCase() === book.currentRenter?.toLowerCase();

  return (
    <div className="details-page">
      <button className="back" onClick={() => nav(-1)}>← Back</button>

      <img src={book.imageUri} alt={book.title} className="cover-lg" />

      <h1>{book.title}</h1>
      <h3>by {book.author}</h3>

      <p>
        Daily rent:&nbsp;<strong>{weiToEth(book.dailyRentWei)} ETH</strong>
      </p>

      {status && isRenter && (
        <p
          className="rental-metrics"
          style={{
            background: status.isPenalty
              ? "rgba(186, 9, 20, 0.93)"
              : "rgba(9, 96, 186, 0.8)",
            width: "max-content",
            padding:"4px 10px",
            color: "white",
            borderRadius: "10px"

          }}
        >
          {status.timeRemaining} day
          {status.timeRemaining === 1 ? "" : "s"}{" "}
          {status.isPenalty ? "in penalty" : "remaining"}
        </p>
      )}

      {book.isAvailable ? (
        <button
          className={`rent-big ${isOwner ? "disabled" : "active"}`}
          disabled={isOwner}
          onClick={!isOwner ? rentNow : undefined}
        >
          {isOwner ? "Your book" : "Rent now"}
        </button>
      ) : isRenter ? (
        <button className="return-big" onClick={returnNow}>
          Return &amp; settle
        </button>
      ) : (
        <p className="unavailable">Currently rented out</p>
      )}
    </div>
  );
}
