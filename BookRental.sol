// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/security/ReentrancyGuard.sol";

contract BookRental is ReentrancyGuard {
    /* ───── errors ───── */
    error BookDoesNotExist();
    error BookNotAvailable();
    error InsufficientPayment(uint256 required, uint256 provided);
    error NotRenter();
    error TransferFailed();

    /* ───── data ───── */
    struct Book {
        uint256 id;
        string  title;
        string  author;
        uint256 dailyRentWei;
        address owner;
        bool    isAvailable;
        address currentRenter;
        uint256 depositAmountWei;
        string  imageUri;
    }

    address public immutable rentalStoreOwner;
    uint256 public nextBookId = 1;

    mapping(uint256 => Book)  public books;
    mapping(address => uint256[])            private _rented;      // private!
    mapping(address => mapping(uint256 => uint256)) public rentalStartTimes;

    /* ───── events ───── */
    event BookListed   (uint256 indexed id, string title, uint256 rentWei, uint256 depositWei);
    event BookRented   (uint256 indexed id, address indexed renter, uint256 time);
    event BookReturned (uint256 indexed id, address indexed renter, uint256 daysRented, uint256 rentPaid);
    event PaymentReceived(address indexed from, uint256 amount);

    constructor() { rentalStoreOwner = msg.sender; }
    receive() external payable { emit PaymentReceived(msg.sender, msg.value); }

    /* ───── modifiers ───── */
    modifier bookExists(uint256 id) {
        if (id == 0 || id >= nextBookId) revert BookDoesNotExist();
        _;
    }

    /* ───── owner-less listing ───── */
    function listBook(
        string memory title,
        string memory author,
        uint256 dailyRentWei,
        uint256 depositWei,
        string memory imageUri
    ) external {
        books[nextBookId] = Book({
            id: nextBookId,
            title: title,
            author: author,
            dailyRentWei: dailyRentWei,
            owner: msg.sender,
            isAvailable: true,
            currentRenter: address(0),
            depositAmountWei: depositWei,
            imageUri: imageUri
        });
        emit BookListed(nextBookId, title, dailyRentWei, depositWei);
        nextBookId++;
    }

    /* ───── rent / return (non-reentrant) ───── */
    function rentBook(uint256 id)
        external
        payable
        nonReentrant
        bookExists(id)
    {
        Book storage b = books[id];
        if (!b.isAvailable) revert BookNotAvailable();

        uint256 total = b.dailyRentWei + b.depositAmountWei;
        if (msg.value < total) revert InsufficientPayment(total, msg.value);

        b.isAvailable   = false;
        b.currentRenter = msg.sender;
        _rented[msg.sender].push(id);
        rentalStartTimes[msg.sender][id] = block.timestamp;

        uint256 excess = msg.value - total;
        if (excess > 0) {
            (bool ok, ) = msg.sender.call{ value: excess }("");
            if (!ok) revert TransferFailed();
        }
        emit BookRented(id, msg.sender, block.timestamp);
    }

    function returnBook(uint256 id)
        external
        nonReentrant
        bookExists(id)
    {
        Book storage b = books[id];
        if (b.currentRenter != msg.sender) revert NotRenter();

        uint256 secondsRented = block.timestamp - rentalStartTimes[msg.sender][id];
        uint256 daysRented    = secondsRented / 1 days;
        if (daysRented == 0) daysRented = 1;

        uint256 fee    = daysRented * b.dailyRentWei;
        uint256 refund = b.depositAmountWei > fee ? b.depositAmountWei - fee : 0;

        b.isAvailable   = true;
        b.currentRenter = address(0);
        _removeRented(msg.sender, id);
        delete rentalStartTimes[msg.sender][id];

        if (refund > 0) {
            (bool ok1, ) = msg.sender.call{ value: refund }("");
            if (!ok1) revert TransferFailed();
        }
        uint256 toOwner = b.depositAmountWei - refund;
        if (toOwner > 0) {
            (bool ok2, ) = rentalStoreOwner.call{ value: toOwner }("");
            if (!ok2) revert TransferFailed();
        }
        emit BookReturned(id, msg.sender, daysRented, fee);
    }

    /* ───── public views ───── */
    function getUserRentedBooks(address user) external view returns (uint256[] memory) {
        return _rented[user];
    }

    function getBookDetails(uint256 id)
        external
        view
        bookExists(id)
        returns (
            string memory title,
            string memory author,
            uint256 dailyRentWei,
            bool isAvailable,
            address currentRenter,
            uint256 depositAmountWei,
            string memory imageUri
        )
    {
        Book storage b = books[id];
        return (b.title, b.author, b.dailyRentWei, b.isAvailable, b.currentRenter, b.depositAmountWei, b.imageUri);
    }

    /* ───── internal helper ───── */
    function _removeRented(address renter, uint256 id) private {
        uint256[] storage arr = _rented[renter];
        for (uint256 i; i < arr.length; i++) {
            if (arr[i] == id) {
                if (i != arr.length - 1) arr[i] = arr[arr.length - 1];
                arr.pop();
                break;
            }
        }
    }
}
