import OpenAI from "openai";
import axios from "axios";
import { NextResponse } from "next/server.js";

//TODO LO DE OPENAI AQUI
const client = new OpenAI();
//TODO LO DE OPENAI AQUI

async function getUsers() {
  const response = await axios.get("http://localhost:3000/api/user");
  const users = response.data.users;
  const usersJSON = JSON.stringify(users);
  return usersJSON;
}

async function addUser(user) {
  const response = await axios.post("http://localhost:3000/api/user", user);
  const newUser = response.data.user;
  const newUserJSON = JSON.stringify(newUser);
  return newUserJSON;
}

async function deleteUser(id) {
  const response = await axios.delete("http://localhost:3000/api/user", {
    data: id,
  });
  const deletedUser = response.data.user;
  const deletedUserJSON = JSON.stringify(deletedUser);
  return deletedUserJSON;
}

export async function POST(req) {
  const { msg } = await req.json();
  //Importar mi assistente
  const myAssistant = await client.beta.assistants.retrieve(
    "asst_N3wrqlPoVtLrsRZuPz3oOrom"
  );
  //Crear thread
  const thread = await client.beta.threads.create();
  //Mandar mensaje
  const message = await client.beta.threads.messages.create(thread.id, {
    role: "user",
    content: msg,
  });
  //correrlo
  const run = await client.beta.threads.runs.create(thread.id, {
    assistant_id: myAssistant.id,
  });
  //esperar a que se complete
  let runer = {};
  while (true) {
    console.log(runer.status);

    runer = await client.beta.threads.runs.retrieve(thread.id, run.id);
    switch (runer.status) {
      case "queued":
      case "in_progress":
        // No hagas nada y espera
        break;
      case "requires_action":
        //En caso de que se requiera una accion
        //primero vamos a agarrar la id y la funcion
        const id = runer.required_action.submit_tool_outputs.tool_calls[0].id;
        const name =
          runer.required_action.submit_tool_outputs.tool_calls[0].function.name;
        //handle
        const run = await client.beta.threads.runs.submitToolOutputs(
          thread.id,
          runer.id,
          {
            tool_outputs: [
              {
                tool_call_id: id,
                output: "He is on the moon :0",
              },
            ],
          }
        );

        break;
      case "completed":
        const threadMessages = await client.beta.threads.messages.list(
          thread.id
        );
        return NextResponse.json(
          {
            message: threadMessages.data[0].content[0].text.value,
            test: threadMessages.data,
            id: thread.id,
          },
          { status: 201 }
        );
    }
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
}