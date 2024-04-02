import express from "express";
import TransactionCtrl from "../controllers/transaction.controller";

const router = express.Router();

// Get All users that didn't claim yet.
router.get("/", TransactionCtrl.getAllUsersData);

// Get the user info
router.get("/:walletAddr", TransactionCtrl.getUserForAddr);

// Claim the token
router.post("/claim", TransactionCtrl.claimToken);

export default router;
