import mongoose from "mongoose";
import { type } from "os";

const WalletSchema = new mongoose.Schema({
  walletId: {type: String, required: true, unique: true}, // Unique identifier for the wallet
  userName: {type: String, required: false}, // Name of the wallet owner
  discordID: {type: String}, // Discord ID associated with the wallet
  createdAt: {type: Date, default: Date.now}, // Timestamp of wallet creation
  updatedAt: {type: Date, default: Date.now} // Timestamp of last update
});

const Wallet = mongoose.model("Wallet", WalletSchema);
export default Wallet;