import express, { json } from "express";
import cors from "cors";
import { MongoClient, ObjectId } from "mongodb";
import joi from "joi";
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
    const participants = await db
      .collection("participants")
      .findOne()
      .toArray();

    res.send(participants);
  } catch (error) {
    res.send("Deu zica no servidor");
  }
});

app.post("/participants", async (req, res) => {
  const { name } = req.body;

  const participantsScheme = joi.object({
    name: joi.string().required(),
  });

  const validation = participantsScheme.validate(name, { abortEarly: false });

  if (validation.error) return res.status(422).send(validation.error.details);

  try {
    const nameInUse = await db.collection("participants").findOne({ name });

    if (nameInUse) return res.sendStatus(409);

    await db.collection("participants").insertOne({ name, lastStatus: Date.now() });

    await db.collection("message").insertOne({
      from: name,
      to: "Todos",
      text: "entra na sala...",
      type: "status",
      time: dayjs().format("HH:mm:ss"),
    });

    res.sendStatus(201)
  } catch (error) {
    console.log(error.message);
    res.status(500).send("Deu algo errado no servidor");
  }
});



app.listen(5000, () => console.log("API funfou suave"));
