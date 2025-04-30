// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/security/ReentrancyGuard.sol";

/**
 *  BookRental v5 - P2P Edition
 *  ──────────────────────────────────────────────────────────────
 *  • Anyone can list books for rent
 *  • Rental payments go directly to book owners without platform fee
 *  • The renter chooses the intended rental length (`rentingDays`)
 *    when calling `rentBook`.
 *  • Deposit collected at rent time:
 *        deposit = rentingDays * dailyRentWei
 *                + MAX_PENALTY_DAYS * PENALTY_PER_DAY_WEI
 *  • When the renter returns the book (returnBook):
 *        fee = actualDays * dailyRentWei
 *            + overdueDays(capped) * PENALTY_PER_DAY_WEI
 *        refund = deposit – fee (≥ 0)
 *  • If overdueDays > MAX_PENALTY_DAYS anyone may call
 *    `autoReturn` to reclaim the book for the book owner; the
 *    entire deposit is kept by the book owner.
 */
contract BookRental is ReentrancyGuard {
    /* ───── constants ───── */
    uint256 public constant MAX_PENALTY_DAYS = 5;
    uint256 public constant PENALTY_PER_DAY_WEI = 1e14; // 0.00001 ether

    /* ───── errors ───── */
    error BookDoesNotExist();
    error BookNotAvailable();
    error InsufficientPayment(uint256 required, uint256 provided);
    error NotRenter();
    error TransferFailed();
    error RentalActive();
    error NotBookOwner();
    error RentalNotOverdue();

    /* ───── data ───── */
    struct Book {
        uint256 id;
        uint256 dailyRentWei;
        address owner;
        bool isAvailable;
        address currentRenter;
        string metadataCid; // ↰ single IPFS CID (JSON)
    }

    uint256 public nextBookId = 1;

    mapping(uint256 => Book) public books;

    // renter -> bookIds[]
    mapping(address => uint256[]) private _rented;
    // book owner -> bookIds[]
    mapping(address => uint256[]) private _ownerBooks;
    // renter -> bookId -> timestamp rental started
    mapping(address => mapping(uint256 => uint256)) public rentalStartTimes;
    // renter -> bookId -> intended renting days
    mapping(address => mapping(uint256 => uint256)) public intendedDays;
    // renter -> bookId -> deposit paid
    mapping(address => mapping(uint256 => uint256)) public depositPaid;

    /* ───── events ───── */
    event BookListed(
        uint256 indexed id,
        address indexed owner,
        string metadataCid,
        uint256 rentWei
    );
    event BookRemoved(uint256 indexed id, address indexed owner);
    event BookRented(
        uint256 indexed id,
        address indexed renter,
        address indexed owner,
        uint256 rentingDays,
        uint256 deposit
    );
    event BookReturned(
        uint256 indexed id,
        address indexed renter,
        address indexed owner,
        uint256 daysRented,
        uint256 fee,
        uint256 refund
    );
    event AutoReturned(
        uint256 indexed id,
        address indexed renter,
        address indexed owner,
        uint256 daysRented,
        uint256 fee
    );
    event PaymentReceived(address indexed from, uint256 amount);

    receive() external payable {
        emit PaymentReceived(msg.sender, msg.value);
    }

    modifier bookExists(uint256 id) {
        if (id == 0 || id >= nextBookId) revert BookDoesNotExist();
        _;
    }

    modifier onlyBookOwner(uint256 id) {
        if (books[id].owner != msg.sender) revert NotBookOwner();
        _;
    }

    /* ───── list / remove ───── */
    /// List a book for rent.
    /// @param metadataCid IPFS CID of metadata JSON
    /// @param dailyRentWei Rent per day in wei
    function listBook(
        string memory metadataCid,
        uint256 dailyRentWei
    ) external {
        uint256 bookId = nextBookId;
        books[bookId] = Book({
            id: bookId,
            dailyRentWei: dailyRentWei,
            owner: msg.sender,
            isAvailable: true,
            currentRenter: address(0),
            metadataCid: metadataCid
        });
        
        _ownerBooks[msg.sender].push(bookId);
        emit BookListed(bookId, msg.sender, metadataCid, dailyRentWei);
        nextBookId++;
    }

    /// Remove a book from the listings
    /// @param id Book ID to remove
    function removeBook(uint256 id) 
        external 
        bookExists(id)
        onlyBookOwner(id)
    {
        Book storage b = books[id];
        if (!b.isAvailable) revert RentalActive();
        
        // Remove from owner's books
        _removeOwnerBook(msg.sender, id);
        
        // Remove the book
        delete books[id];
        
        emit BookRemoved(id, msg.sender);
    }

    /* ───── rent ───── */
    /// Renter chooses rentingDays; contract calculates required deposit.
    function rentBook(uint256 id, uint256 rentingDays)
        external
        payable
        nonReentrant
        bookExists(id)
    {
        if (rentingDays == 0) revert(); // choose at least 1 day

        Book storage b = books[id];
        if (!b.isAvailable) revert BookNotAvailable();
        
        // Prevent owner from renting their own book
        if (msg.sender == b.owner) revert();

        uint256 deposit = rentingDays * b.dailyRentWei + MAX_PENALTY_DAYS * PENALTY_PER_DAY_WEI;

        if (msg.value < deposit) revert InsufficientPayment(deposit, msg.value);

        // update state
        b.isAvailable = false;
        b.currentRenter = msg.sender;

        _rented[msg.sender].push(id);
        rentalStartTimes[msg.sender][id] = block.timestamp;
        intendedDays[msg.sender][id] = rentingDays;
        depositPaid[msg.sender][id] = deposit;

        // refund excess (rare, but possible)
        uint256 extra = msg.value - deposit;
        if (extra > 0) {
            (bool ok, ) = msg.sender.call{value: extra}("");
            if (!ok) revert TransferFailed();
        }

        emit BookRented(id, msg.sender, b.owner, rentingDays, deposit);
    }

    /* ───── return (by renter) ───── */
    function returnBook(uint256 id)
        external
        nonReentrant
        bookExists(id)
    {
        _handleReturn(id, msg.sender, false);
    }

    /* ───── auto-return (anyone) ───── */
    /// Anyone may call this if renter is overdue > MAX_PENALTY_DAYS.
    function autoReturn(uint256 id, address renter)
        external
        nonReentrant
        bookExists(id)
    {
        uint256 start = rentalStartTimes[renter][id];
        if (start == 0) revert NotRenter(); // never rented

        uint256 elapsedDays = (block.timestamp - start) / 1 days;
        uint256 rentDays = intendedDays[renter][id];

        if (elapsedDays <= rentDays + MAX_PENALTY_DAYS) revert RentalNotOverdue();

        _handleReturn(id, renter, true);
    }

    /* ───── internal return logic ───── */
    function _handleReturn(
        uint256 id,
        address renter,
        bool forceKeepDeposit // true when auto-return steals deposit
    ) private {
        Book storage b = books[id];
        if (b.currentRenter != renter) revert NotRenter();

        address bookOwner = b.owner;
        uint256 deposit = depositPaid[renter][id];
        uint256 start = rentalStartTimes[renter][id];
        uint256 rentDays = intendedDays[renter][id];

        uint256 elapsedDays = (block.timestamp - start) / 1 days;
        if (elapsedDays == 0) elapsedDays = 1; // floor → 1 day

        uint256 fee;
        if (elapsedDays <= rentDays) {
            // Returned on time (or early): pay for actual days used
            fee = elapsedDays * b.dailyRentWei;
        } else {
            uint256 overdue = elapsedDays - rentDays;
            // Cap the overdue penalty at MAX_PENALTY_DAYS
            uint256 penaltyDays = overdue > MAX_PENALTY_DAYS ? MAX_PENALTY_DAYS : overdue;
            fee = rentDays * b.dailyRentWei + penaltyDays * PENALTY_PER_DAY_WEI;
        }

        uint256 refund = 0;
        if (!forceKeepDeposit) {
            refund = fee >= deposit ? 0 : deposit - fee;
        }

        // reset state
        b.isAvailable = true;
        b.currentRenter = address(0);
        _removeRented(renter, id);

        delete rentalStartTimes[renter][id];
        delete intendedDays[renter][id];
        delete depositPaid[renter][id];

        // money moves directly to the book owner
        if (refund > 0) {
            (bool ok1, ) = renter.call{value: refund}("");
            if (!ok1) revert TransferFailed();
        }
        
        uint256 toOwner = deposit - refund;
        if (toOwner > 0) {
            (bool ok2, ) = bookOwner.call{value: toOwner}("");
            if (!ok2) revert TransferFailed();
        }

        if (forceKeepDeposit) {
            emit AutoReturned(id, renter, bookOwner, elapsedDays, deposit);
        } else {
            emit BookReturned(id, renter, bookOwner, elapsedDays, fee, refund);
        }
    }

    /* ───── views ───── */
    function getRentalStatus(uint256 id, address renter)
        external
        view
        bookExists(id)
        returns (uint256 timeRemaining, bool isPenalty)
    {
        uint256 start = rentalStartTimes[renter][id];
        if (start == 0) return (0, false); // never rented
        
        Book storage b = books[id];
        if (b.currentRenter != renter) return (0, false); // not the current renter
        
        uint256 rentDays = intendedDays[renter][id];
        uint256 elapsedDays = (block.timestamp - start) / 1 days;
        // if (elapsedDays == 0) elapsedDays = 1; // minimum 1 day
        
        if (elapsedDays < rentDays) {
            // Within rental period
            timeRemaining = rentDays - elapsedDays;
            isPenalty = false;
        } else {
            // In penalty period
            uint256 overdueDays = elapsedDays - rentDays;
            if (overdueDays >= MAX_PENALTY_DAYS) {
                // No time remaining, max penalty reached
                timeRemaining = 0;
            } else {
                // Time remaining in penalty period
                timeRemaining = MAX_PENALTY_DAYS - overdueDays;
            }
            isPenalty = true;
        }
        
        return (timeRemaining, isPenalty);
    }

    function getUserRentedBooks(address user)
        external
        view
        returns (uint256[] memory)
    {
        return _rented[user];
    }
    
    function getOwnerBooks(address owner)
        external
        view
        returns (uint256[] memory)
    {
        return _ownerBooks[owner];
    }

    function getBookDetails(uint256 id)
        external
        view
        bookExists(id)
        returns (
            uint256 dailyRentWei,
            address owner,
            bool isAvailable,
            address currentRenter,
            string memory metadataCid
        )
    {
        Book storage b = books[id];
        return (b.dailyRentWei, b.owner, b.isAvailable, b.currentRenter, b.metadataCid);
    }

    /* ───── helpers ───── */
    function _removeRented(address renter, uint256 id) private {
        uint256[] storage arr = _rented[renter];
        for (uint256 i; i < arr.length; ++i) {
            if (arr[i] == id) {
                if (i != arr.length - 1) arr[i] = arr[arr.length - 1];
                arr.pop();
                break;
            }
        }
    }
    
    function _removeOwnerBook(address owner, uint256 id) private {
        uint256[] storage arr = _ownerBooks[owner];
        for (uint256 i; i < arr.length; ++i) {
            if (arr[i] == id) {
                if (i != arr.length - 1) arr[i] = arr[arr.length - 1];
                arr.pop();
                break;
            }
        }
    }
}