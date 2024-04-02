import mongoose from "mongoose";

const receivedTXSchema = new mongoose.Schema(
  {
    signature: { type: String, require: true },
    walletAddr: { type: String, require: true },
    amount: { type: Number, require: true },
    claimedStatus: { type: Boolean, require: true },
  },
  {
    timestamps: {
      createdAt: "created_at",
      updatedAt: "updated_at",
    },
  }
);

export const receivedTXModal = mongoose.model("transactions", receivedTXSchema);
