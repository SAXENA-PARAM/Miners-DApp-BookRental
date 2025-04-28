// src/pages/BookDetails.jsx
import { useParams, useNavigate } from "react-router-dom";
import { useState, useEffect, useCallback } from "react";
import Web3 from "web3";
import {
  SMART_CONTRACT_ABI,
  SMART_CONTRACT_ADDRESS,
} from "../../constants.js";
import "./BookDetails.css";

/* helpers --------------------------------------------------------- */
const getWeb3     = () => new Web3(window.ethereum);
const getContract = (w3) =>
  new w3.eth.Contract(SMART_CONTRACT_ABI, SMART_CONTRACT_ADDRESS);
const weiToEth    = (wei) => Number(wei) / 1e18;
const ipfsGateway = "https://silver-total-swallow-275.mypinata.cloud/ipfs/"; // Pinata gateway

/* component ------------------------------------------------------- */
export default function BookDetails() {
  const { id }  = useParams();
  const nav     = useNavigate();

  const [account, setAccount] = useState(null);
  const [book,    setBook]    = useState(null);
  const [rental,  setRental]  = useState(null);   // {days, fee, refund}
  const [loading, setLoading] = useState(true);

  /* fetch book details + viewer-specific rental metrics ----------- */
  const loadData = useCallback(async () => {
    setLoading(true);
    const w3 = getWeb3();
    const c  = getContract(w3);

    /* 1 — on-chain struct ---------------------------------------- */
    const raw = await c.methods.getBookDetails(id).call();

    const dailyRentWei   = raw.dailyRentWei      ?? raw[0];
    const isAvailable    = raw.isAvailable       ?? raw[1];
    const depositWei     = raw.depositAmountWei  ?? raw[2];
    const currentRenter  = raw.currentRenter     ?? raw[3];
    const metadataCid    = raw.metadataCid       ?? raw[4];

    /* 2 — fetch off-chain JSON ----------------------------------- */
    let metadata = {};
    try {
      const metaRes = await fetch(`${ipfsGateway}${metadataCid}`);
      metadata      = await metaRes.json();
    } catch (err) {
      console.error("Failed to fetch metadata for book", id, err);
    }

    /* 3 — derive fields ------------------------------------------ */
    const imageUri = metadata.imageCid
      ? `${ipfsGateway}${metadata.imageCid}`
      : "/default-image.jpg";

    setBook({
      id: Number(id),
      title:  metadata.title  ?? "Unknown Title",
      author: metadata.author ?? "Unknown Author",
      dailyRentWei,
      depositWei,
      isAvailable,
      currentRenter,
      imageUri,
    });
    setLoading(false);

    /* 4 — viewer-specific section -------------------------------- */
    if (
      account &&
      currentRenter &&
      currentRenter.toLowerCase() === account.toLowerCase()
    ) {
      try {
        const [days, fee, refund] =
          await c.methods.calculateCurrentRental(id, account).call();
        setRental({ days, fee, refund });
      } catch { setRental(null); }
    } else {
      setRental(null);
    }
  }, [id, account]);

  /* wallet connect once ------------------------------------------ */
  useEffect(() => {
    if (!window.ethereum) return;
    (async () => {
      await window.ethereum.request({ method: "eth_requestAccounts" });
      const [addr] = await getWeb3().eth.getAccounts();
      setAccount(addr);
    })();
  }, []);

  /* refetch when id/account change --------------------------------*/
  useEffect(() => { loadData(); }, [loadData]);

  /* actions ------------------------------------------------------- */
  const rentNow = async () => {
    if (!book?.isAvailable) { alert("Book already rented."); return; }
    try {
      const w3 = getWeb3();
      const c  = getContract(w3);
      const total = (
        BigInt(book.dailyRentWei) + BigInt(book.depositWei)
      ).toString();
      await c.methods.rentBook(id).send({ from: account, value: total });
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

  /* UI ----------------------------------------------------------- */
  if (!window.ethereum) return <p>Please install MetaMask.</p>;
  if (loading)          return <p>Loading…</p>;
  if (!book)            return <p>Book not found.</p>;

  const isRenter =
    book.currentRenter &&
    book.currentRenter.toLowerCase() === account?.toLowerCase();

  return (
    <div className="details-page">
      <button className="back" onClick={() => nav(-1)}>← Back</button>

      {book.imageUri && (
        <img src={book.imageUri} alt={book.title} className="cover-lg" />
      )}

      <h1>{book.title}</h1>
      <h3>by {book.author}</h3>

      <p>
        Daily rent:&nbsp;<strong>{weiToEth(book.dailyRentWei)} ETH</strong>
      </p>
      <p>
        Deposit:&nbsp;<strong>{weiToEth(book.depositWei)} ETH</strong>
      </p>

      {isRenter && rental && (
        <p className="rental-metrics">
          {rental.days} day{rental.days > 1 && "s"} rented&nbsp;– fee&nbsp;
          {weiToEth(rental.fee)} ETH&nbsp;– refund&nbsp;
          {weiToEth(rental.refund)} ETH*
        </p>
      )}

      {book.isAvailable ? (
        <button className="rent-big" onClick={rentNow}>
          Rent now
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
