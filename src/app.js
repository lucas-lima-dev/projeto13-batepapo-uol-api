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

  if(!to || !text || !type) return res.status(422).send("All fields (to, text and type) are required")

  if (!user) return res.status(422).send("You must type an User");

  const nameInUse = await db.collection("participants").findOne({ name: user });

  if (!nameInUse) return res.sendStatus(422);

  const messageScheme = joi.object({
    to: joi.string().min(1).required(),
    text: joi.string().min(1).required(),
    type: joi.string().valid("message", "private_message").required()
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

    res.status(201).send("Sucess: Message sent!")
  } catch (error) {
    console.log(error.message);
    res.status(422).send("Error: Message not sent");
  }
});

app.get("/messages", async (req, res) => {
  const { limit } = req.query;
  const { user } = req.headers;

  if(limit < 1 || isNaN(limit)) return res.status(422).send("Please type a valid limit positive number")

  if(!user) return res.status(422).send("User is required")

  const nameInUse = await db.collection("participants").findOne({ name: user });

  if (!nameInUse) return res.sendStatus(422);

  const limitScheme = joi.object({
    limit: joi.number().positive()
  })

  const validadeLimit = limitScheme.validate({limit})

  if(validadeLimit.error) return res.status(422).send(validadeLimit.error.details);

//   try {
//     const messages = await db
//       .collection("messages")
//       .find({ 
//         $or: [
//             { to: user,
//               type: "private_message"  
//             },
//             { from: user,
//               type: "private_message"
//             },
//             {type:"message"},
//             {type:"status"}
//         ] })
//       .toArray();

try {
    const messages = await db.collection("messages")
      .find({
        $or: [
          { to: user },
          { from: user },
          { to: "Todos" },
          { type: "message" },
        ],
      })
      .toArray();

    if (limit) return res.status(200).send(messages.slice(-limit).reverse());

    return res.status(200).send(messages.reverse());
  } catch (error) {
    console.log(error.message);
    res.status(422).send("Message not found");
  }
});

app.post("/status", async (req, res) => {
  const { user } = req.headers;

  if(!user) return res.status(422).send("User is required")

  const nameInUse = await db.collection("participants").findOne({ name: user });

  if (!nameInUse) return res.sendStatus(404);

  try {
    await db
      .collection("participants")
      .updateOne({ name: user }, { $set: { lastStatus: Date.now() } });
    return res.status(200).send("OK")
  } catch (error) {
    console.log(error.message);
    res.status(500).send("LastStatus not updated");
  }
});

setInterval(async()=>{
    const users = await db.collection("participants").find().toArray()
    const timeNow = Date.now()
    const kickRoomLimit = 10000
    
    users.forEach(async (user)=>{
        if((timeNow - user.lastStatus) > kickRoomLimit  ){
            await db.collection("participants").deleteOne({name:user.name})

            await db.collection("messages").insertOne({
                from:user.name,
                to:"Todos",
                text:"sai da sala...",
                type:"status",
                time: dayjs().format("HH:mm:ss")
            })
        }
    })
},15000)

app.listen(5000, () => console.log("API funfou suave"));
