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
    const participants = await db.collection("participants").find().toArray();

    return res.status(200).send(participants);
  } catch (error) {
    res.send("Deu zica no servidor");
  }
});

app.post("/participants", async (req, res) => {
  const { name } = req.body;

  const nameInUse = await db.collection("participants").findOne({ name });

  if (nameInUse) return res.sendStatus(409);

  const participantsScheme = joi.object({
    name: joi.string().min(1).required(),
  });

  const validation = participantsScheme.validate(
    { name },
    { abortEarly: false }
  );

  if (validation.error) return res.status(422).send(validation.error.details);

  try {
    await db
      .collection("participants")
      .insertOne({ name, lastStatus: Date.now() });

    await db.collection("messages").insertOne({
      from: name,
      to: "Todos",
      text: "entra na sala...",
      type: "status",
      time: dayjs().format("HH:mm:ss"),
    });

    res.sendStatus(201);
  } catch (error) {
    console.log(error.message);
    res.status(500).send("Deu algo errado no servidor");
  }
});

app.post("/messages", async (req, res) => {
  const { to, text, type } = req.body;
  const { user } = req.headers;

  if (!user) return res.status(422).send("You must type an User");

  const nameInUse = await db.collection("participants").findOne({ name: user });

  if (!nameInUse) return res.sendStatus(422);

  const messageScheme = joi.object({
    to: joi.string().min(1).required(),
    text: joi.string().min(1).required(),
    type: joi.string().valid("message", "private_message").required(),
    user: joi.string().min(1).required(),
  });

  const validation = messageScheme.validate(
    { to, text, type },
    { abortEarly: false }
  );

  if (validation.error) return res.status(422).send(validation.error.details);

  try {
    await db.collection("messages").insertOne({
      from: user,
      to,
      text,
      type,
      time: dayjs().format("HH:mm:ss"),
    });

    res.sendStatus(201);
  } catch (error) {
    console.log(error.message);
    res.status(500).send("Message not sent");
  }
});

app.get("/messages", async (req, res) => {
  const { limit } = req.query;
  const { user } = req.headers;

  try {
    const messages = await db
      .collection("messages")
      .find({ $or: [{ from: user }, { to: { in: ["Todos", user] } }] })
      .toArray();

    if (limit) return res.send(messages.slice(-limit).reverse());

    res.send(messages.reverse());
  } catch (error) {
    console.log(error.message);
    res.status(500).send("Message not found");
  }
});

// app.post("/status", async (req, res) => {
//   const { user } = req.headers;

//   const nameInUse = await db.collection("participants").findOne({ name: user });

//   if (!nameInUse) return res.sendStatus(404);

//   try {
//     await db
//       .collection("participants")
//       .updateOne({ name: user }, { $set: { lastStatus: Date.now() } });
//     return res.status(200).send()
//   } catch (error) {
//     console.log(error.message);
//     res.status(500).send("LastStatus not updated");
//   }
// });

app.listen(5000, () => console.log("API funfou suave"));
