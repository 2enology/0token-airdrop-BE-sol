import { Request, Response } from "express";
import {
  Connection,
  Keypair,
  Transaction,
  ParsedAccountData,
  TransactionInstruction,
} from "@solana/web3.js";
import { transferCheckedInstructionData } from "@solana/spl-token";
import { bs58 } from "@project-serum/anchor/dist/cjs/utils/bytes";
import { receivedTXModal } from "../models/transaction.model";
import { config } from "../config";
import NodeWallet from "@project-serum/anchor/dist/cjs/nodewallet";

const devnetEndpoint = config.SOLANA_RPC_URL;
const solConnection = new Connection(devnetEndpoint, {
  commitment: "finalized",
  confirmTransactionInitialTimeout: 60000,
});

const getValueFromInstruction = async (instruction: TransactionInstruction) => {
  const tokenValue = transferCheckedInstructionData.decode(instruction.data);

  const account = await solConnection.getParsedAccountInfo(
    instruction.keys[2].pubkey
  );

  const receiver = (account.value?.data as ParsedAccountData).parsed.info.owner;

  return { tokenValue, receiver };
};

// Fetch the Signature
async function fetchSignature(tx: Transaction) {
  const availableInstructions = tx.instructions.filter(
    (instruction) => instruction.keys.length !== 0
  );
  if (
    availableInstructions.length === 1 ||
    availableInstructions.length === 2
  ) {
    if (availableInstructions.length === 1) {
      const needBEAddr = availableInstructions[0].keys.find(
        (key) => key.pubkey.toBase58() === config.SOL_VAULT_WALLET
      );

      const tokenInfo = await getValueFromInstruction(availableInstructions[0]);
      const recevieTokenDecimal = Number(tokenInfo.tokenValue.decimals);
      const recevierTokenAmount = Number(tokenInfo.tokenValue.amount);
      const recevier = tokenInfo.receiver;

      if (
        needBEAddr &&
        recevieTokenDecimal === config.SOL_TOKEN_DECIMAL &&
        recevierTokenAmount === config.AIRDROP_AMOUNT
      ) {
        const result = await receivedTXModal.findOne({
          walletAddr: recevier,
          claimedStatus: false,
        });
        if (result) {
          await receivedTXModal.updateOne(
            { walletAddr: recevier },
            {
              claimedStatus: true,
            }
          );
          const state = true;
          return { recevier, recevierTokenAmount, state };
        } else {
          const state = false;
          return { recevier: "", recevierTokenAmount: "", state };
        }
      }
    } else {
      const isExistedBEAddr = availableInstructions[0].keys.some(
        (key) => key.pubkey.toBase58() === config.SOL_VAULT_WALLET
      );

      const needBEAddr = availableInstructions[1].keys.find(
        (key) => key.pubkey.toBase58() === config.SOL_VAULT_WALLET
      );

      const tokenInfo = await getValueFromInstruction(availableInstructions[0]);
      const recevieTokenDecimal = Number(tokenInfo.tokenValue.decimals);
      const recevierTokenAmount = Number(tokenInfo.tokenValue.amount);
      const recevier = tokenInfo.receiver;

      if (
        !isExistedBEAddr &&
        needBEAddr &&
        recevieTokenDecimal === config.SOL_TOKEN_DECIMAL &&
        recevierTokenAmount === config.AIRDROP_AMOUNT
      ) {
        const result = await receivedTXModal.findOne({
          walletAddr: recevier,
          claimedStatus: false,
        });
        if (result) {
          await receivedTXModal.updateOne(
            { walletAddr: recevier },
            {
              claimedStatus: true,
            }
          );
          const state = true;
          return { recevier, recevierTokenAmount, state };
        } else {
          const state = false;
          return { recevier: "", recevierTokenAmount: "", state };
        }
      }
    }
  } else {
    const state = false;
    return { recevier: "", recevierTokenAmount: "", state };
  }
}

// Save the confirm data to database
class TransactionController {
  public claimToken = async (req: Request, res: Response) => {
    const backendKp = Keypair.fromSecretKey(
      Buffer.from(bs58.decode(config.SOLANA_PRIVATE as string))
    );
    const wallet = new NodeWallet(backendKp);

    const { encodedTx } = req.body;

    const tx = Transaction.from(Buffer.from(encodedTx, "base64"));
    const signedTx = await wallet.signTransaction(tx);
    const claimStatus = await fetchSignature(tx);

    if (
      claimStatus &&
      claimStatus.state &&
      claimStatus?.recevier &&
      claimStatus.recevierTokenAmount
    ) {
      for (let i = 0; i < 5; i++) {
        try {
          const signature = await solConnection.sendRawTransaction(
            signedTx.serialize()
          );

          const confirmed = await solConnection.confirmTransaction(signature);
          console.log("confirmed: ", confirmed);
          await receivedTXModal.updateOne(
            { walletAddr: claimStatus.recevier },
            {
              signature: signature,
              claimedStatus: true,
              amount: claimStatus.recevierTokenAmount,
            }
          );
          console.log("signature", signature);
          res.status(200).send({
            msg: "success",
          });
          return;
        } catch (error) {
          console.log("error", error);
          await receivedTXModal.updateOne(
            { walletAddr: claimStatus.recevier },
            {
              signature: "",
              claimedStatus: false,
              amount: 0,
            }
          );
          res.status(500).send({
            message: error,
          });
        }
      }
    } else {
      res.status(500).send({
        message: "not registered or claimed or invalied TX",
      });
    }
  };

  // Find all users with claimable status.
  public getAllUsersData = async (res: Response) => {
    try {
      const data = await receivedTXModal.find({
        claimedStatus: false,
      });
      res.send(data);
    } catch (err) {
      res.status(500).send({
        message: err,
      });
    }
  };

  // Find user with claimable status and same addr
  public getUserForAddr = async (req: Request, res: Response) => {
    const { walletAddr } = req.params;
    try {
      const data = await receivedTXModal.findOne({
        walletAddr: walletAddr,
        claimedStatus: false,
      });
      res.send(data);
    } catch (err) {
      res.status(500).send({
        message: err,
      });
    }
  };
}

export default new TransactionController();
