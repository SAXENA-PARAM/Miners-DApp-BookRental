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

  /* wallet / owner state */
  const [account, setAccount] = useState(null);
  const [owner, setOwner] = useState(null);
  const [checking, setChecking] = useState(true);

  /* form fields */
  const [title, setTitle] = useState("");
  const [author, setAuthor] = useState("");
  const [rentEth, setRentEth] = useState("");
  const [depEth, setDepEth] = useState("");
  const [imgFile, setImgFile] = useState(null);
  const [uploadStatus, setUploadStatus] = useState("");

  /* connect wallet & get store owner ------------------------------ */
  useEffect(() => {
    if (!window.ethereum) return;
    (async () => {
      await window.ethereum.request({ method: "eth_requestAccounts" });
      const w3 = getWeb3();
      const [a] = await w3.eth.getAccounts();
      setAccount(a);

      const c = getContract(w3);
      const own = await c.methods.rentalStoreOwner().call();
      setOwner(own);
      setChecking(false);
    })();
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
  try {
    if (!imgFile) return alert("Please select an image file.");

    /* 1. upload image and get raw CID */
    const imageCid = await uploadImageToPinata(imgFile);

    /* 2. build + upload metadata (stores raw imageCid) */
    const metadata = { title, author, imageCid };
    const metadataCid = await uploadMetadataToPinata(metadata);

    /* 3. list book on-chain, sending only the metadata CID */
    const w3 = getWeb3();
    const c  = getContract(w3);

    await c.methods
      .listBook(
        metadataCid,           // raw CID (no ipfs://, no gateway URL)
        ethToWei(rentEth),
        ethToWei(depEth)
      )
      .send({ from: account });

    alert("📚 Book listed successfully!");
    nav("/");
  } catch (err) {
    console.error(err);
    alert(err?.reason || err?.message || "Listing failed.");
  }
};


  /* UI ------------------------------------------------------------ */
  if (!window.ethereum) return <p>Please install MetaMask.</p>;
  if (checking) return <p>Connecting wallet…</p>;
  if (account?.toLowerCase() !== owner?.toLowerCase())
    return <p>You are not the rental-store owner.</p>;

  return (
    <div className="list-page">
      <h1 className="page-title">List a New Book</h1>

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
          Deposit&nbsp;(ETH)
          <input
            type="number"
            step="0.0001"
            min="0"
            value={depEth}
            onChange={(e) => setDepEth(e.target.value)}
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

        <button type="submit" className="list-btn" disabled={uploadStatus.includes("Uploading")}>
          {uploadStatus.includes("Uploading") ? "Uploading..." : "List Book"}
        </button>
      </form>
    </div>
  );
}
