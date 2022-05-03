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

const participantSchema = joi.object({
  name: joi.string().required(),
});

app.post("/participants", async (req, res) => {
  const validation = participantSchema.validate(req.body);
  if (validation.error) {
    res.status(422).send("Preencha os campos corretamente.");
  } else {
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
        .then(res.sendStatus(201));
    } catch (err) {
      res.status(500).send("erro");
    } finally {
      mongoclient.close();
      console.log(chalk.bold.red("Disconnected to database."));
    }
  }
});

app.get("/participants", async (req, res) => {
  try {
    await mongoclient.connect();
    database = mongoclient.db("bate-papo-uol");
    console.log(chalk.bold.blue("Connected to database"));

    const participantsList = await database
      .collection("participants")
      .find({})
      .toArray();
    res.send(participantsList);
  } catch (err) {
    res.status(500).send("erro");
  } finally {
    mongoclient.close();
    console.log(chalk.bold.red("Disconnected to database."));
  }
});
