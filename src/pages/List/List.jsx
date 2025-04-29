import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import Web3 from "web3";
import { PinataSDK } from "pinata";
import {
  SMART_CONTRACT_ABI,
  SMART_CONTRACT_ADDRESS,
} from "../../constants.js";
import "./List.css";

/* helpers --------------------------------------------------------- */
const getWeb3 = () => new Web3(window.ethereum);
const getContract = (w3) =>
  new w3.eth.Contract(SMART_CONTRACT_ABI, SMART_CONTRACT_ADDRESS);

// Initialize Pinata SDK
const pinata = new PinataSDK({
  pinataJwt: "", // leave empty if your server handles auth
  pinataGateway: import.meta.env.VITE_GATEWAY_URL, // set this in your Vite env
});

export default function List() {
  const nav = useNavigate();

  /* wallet state */
  const [account, setAccount] = useState(null);
  const [checking, setChecking] = useState(true);
  const [connectionError, setConnectionError] = useState("");

  /* form fields */
  const [title, setTitle] = useState("");
  const [author, setAuthor] = useState("");
  const [rentEth, setRentEth] = useState("");
  const [imgFile, setImgFile] = useState(null);
  const [uploadStatus, setUploadStatus] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);


  /* connect wallet ------------------------------ */
  useEffect(() => {
    if (!window.ethereum) {
      setConnectionError("Please install MetaMask.");
      setChecking(false);
      return;
    }
    
    const connectWallet = async () => {
      try {
        // Request accounts
        const accounts = await window.ethereum.request({ method: "eth_requestAccounts" });
        
        if (accounts.length === 0) {
          setConnectionError("No accounts found. Please unlock MetaMask.");
          setChecking(false);
          return;
        }
        
        // Set the account
        setAccount(accounts[0]);
        console.log("Connected to account:", accounts[0]);
        
        // Connection process complete
        setChecking(false);
      } catch (error) {
        console.error("Wallet connection error:", error);
        setConnectionError(error.message || "Failed to connect wallet");
        setChecking(false);
      }
    };
    
    // Add event listeners for account changes
    const handleAccountsChanged = (accounts) => {
      console.log("Accounts changed:", accounts);
      if (accounts.length === 0) {
        setAccount(null);
        setConnectionError("Wallet disconnected");
      } else {
        setAccount(accounts[0]);
        setConnectionError("");
      }
    };
    
    // Set up listeners
    window.ethereum.on('accountsChanged', handleAccountsChanged);
    
    // Connect wallet
    connectWallet();
    
    // Cleanup
    return () => {
      if (window.ethereum.removeListener) {
        window.ethereum.removeListener('accountsChanged', handleAccountsChanged);
      }
    };
  }, []);

  /* utils --------------------------------------------------------- */
  const ethToWei = (eth) => {
    const w3 = getWeb3();
    return w3.utils?.toWei
      ? w3.utils.toWei(eth || "0", "ether")
      : (BigInt(Math.floor(parseFloat(eth || "0") * 1e18))).toString();
  };

 /* ───────── pinata helpers ─────────────────────────────────────── */
 const uploadImageToPinata = async (file) => {
  try {
    setUploadStatus("Getting presigned URL…");

    // 1️⃣  ask backend for presigned upload url
    const presignedRes = await fetch(
      `${import.meta.env.VITE_SERVER_URL}/presigned_url`,
      { method: "GET" }
    );
    const data= await presignedRes.json();

    setUploadStatus("Uploading file to Pinata…");

    // 2️⃣  upload file directly to Pinata
    const upload = await pinata.upload.public.file(file).url(data.url);

    if (!upload.cid) throw new Error("Failed to get CID after upload.");

    setUploadStatus("Image uploaded successfully!");
    return upload.cid; // <-- ✅ access `data.cid`
  } catch (error) {
    console.error(error);
    throw new Error(
      error instanceof Error ? error.message : String(error)
    );
  }
};


const uploadMetadataToPinata = async (metadata) => {
  try {
    setUploadStatus("Getting presigned URL…");

    // 1️⃣  ask backend for presigned upload url
    const presignedRes = await fetch(
      `${import.meta.env.VITE_SERVER_URL}/presigned_url`,
      { method: "GET" }
    );
    const data= await presignedRes.json();

    setUploadStatus("Uploading metadata to Pinata…");


    const upload = await pinata.upload.public.json(metadata, { url: data.url });

    
    if (!upload.cid) throw new Error("Failed to upload metadata.");

    setUploadStatus("Metadata uploaded successfully!");
    return upload.cid; // <-- ✅ correct way
  } catch (error) {
    console.error(error);
    throw new Error(
      error instanceof Error ? error.message : String(error)
    );
  }
};


/* ───────── submit handler ─────────────────────────────────────── */
const handleSubmit = async (e) => {
  e.preventDefault();
  if (isSubmitting) return;
  setIsSubmitting(true);
  try {
    if (!imgFile) return alert("Please select an image file.");

    const imageCid = await uploadImageToPinata(imgFile);
    const metadata = { title, author, imageCid };
    const metadataCid = await uploadMetadataToPinata(metadata);

    const w3 = getWeb3();
    const c = getContract(w3);

    await c.methods
      .listBook(metadataCid, ethToWei(rentEth))
      .send({ from: account });

    alert("📚 Book listed successfully!");
    nav("/");
  } catch (err) {
    console.error(err);
    alert(err?.reason || err?.message || "Listing failed.");
  } finally {
    setIsSubmitting(false);
  }
};



  /* UI ------------------------------------------------------------ */
  if (!window.ethereum) return <p>Please install MetaMask.</p>;
  if (checking) return <p>Connecting to wallet...</p>;
  if (connectionError) return <p>Error: {connectionError}</p>;
  if (!account) return <p>Please connect your wallet.</p>;

  return (
    <div className="list-page">
      <h1 className="page-title">List a New Book</h1>
      <p className="wallet-info">Connected wallet: {account}</p>

      <form className="list-form" onSubmit={handleSubmit}>
        <label>
          Title
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
          />
        </label>

        <label>
          Author
          <input
            value={author}
            onChange={(e) => setAuthor(e.target.value)}
            required
          />
        </label>

        <label>
          Daily&nbsp;rent&nbsp;(ETH)
          <input
            type="number"
            step="0.0001"
            min="0"
            value={rentEth}
            onChange={(e) => setRentEth(e.target.value)}
            required
          />
        </label>

        <label>
          Image&nbsp;File
          <input
            type="file"
            accept="image/*"
            onChange={(e) => setImgFile(e.target.files[0])}
            required
          />
        </label>

        {uploadStatus && <p>{uploadStatus}</p>}

        <button type="submit" className="list-btn" disabled={isSubmitting}>
  {isSubmitting ? "Listing…" : "List Book"}
</button>

      </form>
    </div>
  );
}