import express, { json } from "express";
import cors from "cors";
import { MongoClient, ObjectId } from "mongodb";
import Joi from "joi";
import dayjs from "dayjs";
import dotenv from "dotenv";
dotenv.config();

const app = express();
app.use(cors());
app.use(json());

const mongoClient = new MongoClient(process.env.DATABASE_URL);
let db;

try {
  await mongoClient.connect();
  db = mongoClient.db();
  console.log("MongoDB Conectado!");
} catch (err) {
  console.log(err.message);
}

app.get("/participants", async (req, res) => {
  try {
    const participants = await db.collection("participants").findOne().toArray();
    res.send(participants);
  } catch (error) {
    res.send("Deu zica no servidor");
  }
});

// app.post("/participants", async (req,res)=>{
//   const { name } = req.body


// });

// app.delete()

app.listen(5000, () => console.log("API funfou suave"));
