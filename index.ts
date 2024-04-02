import express from "express";
import cors from "cors";
import mongoose from "mongoose";
import { config } from "./config";
import transactionRoute from "./routes/transaction.routes";
const app = express();
const port = config.PORT;

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use("/token", transactionRoute);

// MongoDB Connection
mongoose.set("strictQuery", true);
mongoose
  .connect("mongodb://127.0.0.1:27017/token_airdrop")
  .then(async () => {
    console.log("==========> Server is running! ⏲  <==========");
    app.listen(port, () => {
      console.log(`==========> Connected MongoDB 👌  <==========`);
    });
  })
  .catch((err) => {
    console.log("Cannot connect to the bot! 😩", err);
    process.exit();
  });

// Routes
app.get("/", () => {
  console.log("server is running!");
  return 0;
});
