import express from "express";
import cors from "cors";
import chalk from "chalk";
import dotenv from "dotenv";
import dayjs from "dayjs";
import { MongoClient } from "mongodb";
import joi from "joi";

dotenv.config();
const app = express();
app.use(cors());
app.use(express.json());

app.listen(5000, () => {
  console.log(chalk.bold.green("Server is running on: http://localhost:5000"));
});

let database = null;
const mongoclient = new MongoClient(process.env.MONGO_URL);

app.post("/participants", async (req, res) => {
  const { name } = req.body;
  const participantSchema = joi.object({
    name: joi.string().required(),
    lastStatus: joi.number(),
  });
  const validation = participantSchema.validate(req.body);
  if (validation.error) {
    res.status(422).send("Preencha os campos corretamente.");
    return;
  }
  try {
    await mongoclient.connect();
    database = mongoclient.db(process.env.DATABASE);
    console.log(chalk.bold.green("Connected to database"));

    const userCreated = await database
      .collection("participants")
      .findOne({ name });
    if (userCreated) {
      res.status(409).send("Nome de usuário em uso. Escolha outro!");
      return;
    }

    await database
      .collection("participants")
      .insertOne({ name, lastStatus: Date.now() });
    res.sendStatus(201);
    await database.collection("messages").insertOne({
      from: { name },
      to: "Todos",
      text: "entra na sala...",
      type: "status",
      time: dayjs().format("HH:mm:ss"),
    });
    res.sendStatus(201);
  } catch (err) {
    res.status(500).send("erro");
  } finally {
    mongoclient.close();
    console.log(chalk.bold.red("Disconnected to database."));
  }
});

app.get("/participants", async (req, res) => {
  try {
    await mongoclient.connect();
    database = mongoclient.db(process.env.DATABASE);
    console.log(chalk.bold.green("Connected to database"));

    const participantsArr = await database
      .collection("participants")
      .find({})
      .toArray();
    res.send(participantsArr);
  } catch (err) {
    res.status(500).send("erro");
  } finally {
    mongoclient.close();
    console.log(chalk.bold.red("Disconnected to database."));
  }
});

app.post("/messages", async (req, res) => {
  const messageSchema = joi.object({
    to: joi.string().required(),
    text: joi.string().required(),
    type: joi.string().valid("message", "private_message").required(),
    from: joi.string().required(),
  });
  const from = req.headers.user;
  const { to, text, type } = req.body;

  const validation = messageSchema.validate(req.body);
  if (validation.error) {
    res.sendStatus(422);
    return;
  }
  try {
    await mongoclient.connect();
    database = mongoclient.db(process.env.DATABASE);
    console.log(chalk.bold.green("Connected to database"));

    const participant = await database
      .collection("participants")
      .find({ name: from })
      .toArray();
    if (participant.length === 0) {
      res.sendStatus(422);
      mongoclient.close();
      return;
    }
    await messages.collection("messages").insertOne({
      to,
      text,
      type,
      from,
      time: dayjs().format("HH:mm:ss"),
    });
    res.sendStatus(201);
  } catch (err) {
    res.status(500).send("erro");
  } finally {
    mongoclient.close();
    console.log(chalk.bold.red("Disconnected to database."));
  }
});

app.get("/messages", async (req, res) => {
  const { user } = req.headers;
  let { limit } = req.query;
  try {
    await mongoclient.connect();
    database = mongoclient.db(process.env.DATABASE);
    console.log(chalk.bold.green("Connected to database"));

    const messages = await database.collection("messages").find({}).toArray();
    const participantMessages = [];
    for (let i = 0; i < messages.length; i++) {
      if (
        messages[i].to === user ||
        messages[i].type !== "private_message" ||
        messages[i].type === "status" ||
        messages[i].from === user
      ) {
        participantMessages.push(messages[i]);
      }
    }
    if (!limit) {
      limit = messages.length;
    }
    res.send(participantMessages.splice(0, parseInt(limit)));
  } catch (err) {
    res.status(500).send("erro");
  } finally {
    mongoclient.close();
    console.log(chalk.bold.red("Disconnected to database."));
  }
});

app.post("/status", async (req, res) => {
  const { user } = req.headers;
  try {
    await mongoclient.connect();
    database = mongoclient.db(process.env.DATABASE);
    console.log(chalk.bold.green("Connected to database"));

    const findUser = await database
      .collection("participants")
      .findOne({ name: user });
    if (!findUser) {
      res.sendStatus(404);
      return;
    }
    const updateTime = await database
      .collection("participants")
      .updateOne({ name: user }, { $set: { lastStatus: Date.now() } });
    res.send(200);
  } catch (err) {
    res.status(500).send("erro");
  } finally {
    mongoclient.close();
    console.log(chalk.bold.red("Disconnected to database."));
  }
});
setInterval(async () => {
  try {
    await mongoclient.connect();
    database = mongoclient.db(process.env.DATABASE);
    console.log(chalk.bold.green("Connected to database"));

    const participant = await database
      .collection("participants")
      .find({})
      .toArray();
    mongoclient.close();
    participant.forEach(async (user) => {
      let now = Date.now();
      let time = now - user.lastStatus;
      if (time > 15000) {
        try {
          await mongoclient.connect();
          database = mongoclient.db(process.env.DATABASE);
          console.log(chalk.bold.green("Connected to database"));

          await database
            .collection("participants")
            .deleteOne({ _id: user._id });
          await database.collection("messages").insertOne({
            from: user.name,
            to: "Todos",
            text: "sai da sala...",
            type: "status",
            time: dayjs().format("HH:MM:ss"),
          });
        } catch (e) {
          mongoclient.close();
        }
      }
    });
  } catch (err) {
    res.status(500).send("erro");
  } finally {
    mongoclient.close();
    console.log(chalk.bold.red("Disconnected to database."));
  }
}, 15000);

app.delete("/messages/:MessageId", async (req, res) => {
  const { user } = req.headers;
  const { MessageId } = req.params;
  try {
    await mongoclient.connect();
    database = mongoclient.db(process.env.DATABASE);
    console.log(chalk.bold.green("Connected to database"));

    const participant = await database
      .collection("messages")
      .findOne({ _id: new ObjectId(MessageId) });
    //console.log(MessageId);
    //console.log(user);
    if (participant.from === user) {
      await database
        .collection("messages")
        .deleteOne({ _id: new ObjectId(MessageId) });
      res.sendStatus(200);
    } else {
      res.sendStatus(401);
    }
  } catch (err) {
    console.log(err);
    res.sendStatus(404);
    mongoclient.close();
  }
});
