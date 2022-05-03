import express from "express";
import cors from "cors";
import chalk from "chalk";
import dotenv from "dotenv";
import dayjs from "dayjs";
import { MongoClient } from "mongodb";
import joi from 'joi';

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
	const participantSchema = joi.object({
		name: joi.string().required(),
	  });
  const validation = participantSchema.validate(req.body);
  if (validation.error) {
    res.status(422).send("Preencha os campos corretamente.");
  }
    try {
      await mongoclient.connect();
      database = mongoclient.db(process.env.DATABASE);
      console.log(chalk.bold.green("Connected to database"));

      const { name } = req.body;

      await database
        .collection("participants")
        .findOne({
          name: req.body.name,
        })
        .then((participant) => {
          if (participant) {
            res.status(409).send("Nome de usuário em uso. Escolha outro!");
            return;
          }
        });

      const participant = await database
        .collection("participants")
        .insertOne({ name, lastStatus: Date.now() });
      res.sendStatus(201);
      const userMessage = database
        .collection("messages")
        .insertOne({
          from: { name },
          to: "Todos",
          text: "entra na sala...",
          type: "status",
          time: dayjs().format("HH:mm:ss"),
        })
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

app.post("/messages", async (req,res) => {
	const messageSchema = joi.object({
		to: joi.string().required(),
		text: joi.string().required(),
		type: joi.string().valid("message", "private_message").required(),
		from: joi.string().required()
	});
    const {to,text,type} = req.body;    
    const {user: from} = req.headers;
    const validation = messageSchema.validate(req.body)

    if(validation.error){
        res.sendStatus(422)
		return
    }
	try {
    await mongoclient.connect();
    database = mongoclient.db(process.env.DATABASE);
    console.log(chalk.bold.green("Connected to database"));

    const users = await database
	.collection("participants")
	.find()
	.toArray();
    const usersArr = users.find((user) => user.name === from);
    if (!usersArr) {
      res.sendStatus(422);
      return;
    }

    await database
	.collection("messages")
	.insertOne({
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
})

app.get("/messages", async (req, res) => {
  const { user } = req.headers;
  let { limit } = req.query;
  try {
    await mongoclient.connect();
    database = mongoclient.db(process.env.DATABASE);
    console.log(chalk.bold.green("Connected to database"));

    const messages = await database
	.collection("messages")
	.find({})
	.toArray();
    const userMessages = [];
    for (let i = 0; i < messages.length; i++) {
      if (
        messages[i].to === user ||
        messages[i].type !== "private_message" ||
        messages[i].type === "status" ||
        messages[i].from === user
      ) {
        userMessages.push(messages[i]);
      }
    }
    if (!limit) {
      limit = messages.length;
    }
    res.send(userMessages.splice(0, parseInt(limit)));
  } catch (err) {
    res.status(500).send("erro");
  } finally {
    mongoclient.close();
    console.log(chalk.bold.red("Disconnected to database."));
  }
});