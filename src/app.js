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

    if (!participants)
      return res
        .status(404)
        .send("Nao foram encontrados participantes cadastrados");

    return res.status(200).send(participants);
  } catch (error) {
    res.send("Deu zica no servidor");
  }
});

app.post("/participants", async (req, res) => {
  const { name } = req.body;

  const participantsScheme = joi.object({
    name: joi.string().min(1).required(),
  });

  const validation = participantsScheme.validate(
    { name },
    { abortEarly: false }
  );

  if (validation.error) return res.status(422).send(validation.error.details);

  try {
    const nameInUse = await db.collection("participants").findOne({ name });

    if (nameInUse) return res.sendStatus(409);

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

    res.status(201).send("OK");
  } catch (error) {
    console.log(error.message);
    res.status(500).send("Deu algo errado no servidor");
  }
});

app.post("/messages", async (req, res) => {
  const { to, text, type } = req.body;
  const { user } = req.headers;

  if (!to || !text || !type)
    return res.status(422).send("All fields (to, text and type) are required");

  if (!user) return res.status(422).send("You must type an User");

  const messageScheme = joi.object({
    from: joi.string().min(1).required(),
    to: joi.string().min(1).required(),
    text: joi.string().min(1).required(),
    type: joi.string().valid("message", "private_message").required(),
  });

  const { error, value: newMessage } = messageScheme.validate(
    { to, text, type, from: user },
    { abortEarly: false }
  );

  if (error) {
    const err = error.details.map((e) => e.message);
    return res.status(422).send(err);
  }

  try {
    const nameInUse = await db
      .collection("participants")
      .findOne({ name: user });

    if (!nameInUse) return res.status(422).send("User not registered");

    await db
      .collection("messages")
      .insertOne({ ...newMessage, time: dayjs().format("HH:mm:ss") });

    res.status(201).send("Sucess: Message sent!");
  } catch (error) {
    console.log(error.message);
    res.status(422).send("Error: Message not sent");
  }
});

app.get("/messages", async (req, res) => {
  const { limit } = req.query;
  const { user } = req.headers;
  
  if ( isNaN(limit) && limit || parseInt(limit) <= 0) return res.sendStatus(422);

  if (!user) return res.status(422).send("User is required");

  try {

    // const nameInUse = await db.collection("participants").findOne({ name: user });

  // if (!nameInUse) return res.status(422).send("User not found");

    const mensagens = await db
      .collection("messages")
      .find({
        $or: [
          { to: { $in: [user, "Todos"] } },
          { from: user },
          { type: "message" },
          { type: "status" },
        ],
      })
      .toArray();
      console.log(limit)
    if (limit) {
      return res.send(mensagens.slice(-Number(limit)).reverse());
    } else {
      res.send(mensagens.reverse());
    }
  } catch (error) {
    console.log(error.message);
    res.status(422).send("Message not found");
  }
});

app.post("/status", async (req, res) => {
  const { user } = req.headers;

  if (!user) return res.status(404).send("User is required");

  try {
    
    const nameInUse = await db.collection("participants").findOne({ name: user });
  
    if (!nameInUse) return res.sendStatus(404);

    await db
      .collection("participants")
      .updateOne(
        { name: user },
        { $set: { lastStatus: Date.now() } }
      );

    return res.status(200).send("OK");

  } catch (error) {
    console.log(error.message);
    res.status(500).send("LastStatus not updated");
  }

});

//Remoçao Automatica dos Inativos
setInterval(async () => {
  let hora = dayjs().format("HH:mm:ss");
  const inactiveTime = Date.now() - 10000;
  
  try {

    const inactiveUsers = await db
      .collection("participants")
      .find({lastStatus: {$lte: inactiveTime }})
      .toArray();

    if(inactiveUsers.length>0) {
      const inactiveMessage = inactiveUsers.map((user)=>{
        return{
          from:user.name,
          to:"Todos",
          text:"sai da sala...",
          type:"status",
          time: dayjs().format("HH:mm:ss")
        }
      })
      await db.collection("messages").insertMany(inactiveMessage)
      await db.collection("participants").deleteMany({lastStatus: {$lte: inactiveTime }})
    }
   
  } catch (error) {
    console.log(error.message);
    res.status(500).send("LeaveRoom Message not updated");
  }
}, 15000);

app.listen(5000, () => console.log("API funfou suave"));
