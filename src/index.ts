import express from "express"
import cors from "cors"
import { fetchOffersData } from "./offers"

const app = express()

app.use(express.json())
app.use(cors())

app.get("/", (req, res) => {
  res.end("OK")
})

app.post("/fetch", fetchOffersData)

app.listen(process.env.PORT)
