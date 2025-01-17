import useChat from './hooks/useChat'
import { FunctionToolCall } from 'openai/resources/beta/threads/runs/steps.mjs'
import {
  RunSubmitToolOutputsParams,
  Thread,
  ThreadCreateParams
} from 'openai/resources/beta/threads/index.mjs'
import functions, { rollDice, addUser, getUsers, deleteUser } from './gori.functions' // <|---- Here goes the object with the functions that the assistant can use
import { Assistant, AssistantCreateParams } from 'openai/resources/beta/index.mjs'
import axios from 'axios'

export const assistantParams: AssistantCreateParams | string = {
  model: 'gpt-3.5-turbo-1106',
  name: 'Gori',
  instructions: `Your role is to be the Game Master for a role-playing game set in the user's provided scenario.
  Your task is to procedurally create the role-playing campaign.

  If, for any reason, the user does not provide a character and a world, you should inform them and request both the character and the world. 
  Do not accept user requests if you do not have all the necessary features to start the game.

  If no rules for the game are provided, maintain a neutral position and try to follow the mechanics of Dungeons and Dragons.

  If no context about the world is provided, offer the player to create the context with them.

  As a Game Master, your duties include:
  - Creating a compelling narrative based on the players' actions and the results of their dice rolls.
  - Knowing the rules of the game perfectly.
  - Designing and planning the adventures the players will experience, including creating plots, challenges, and encounters.
  - Encouraging interaction between players and NPCs, as well as managing conflicts and important decisions.
  - Sometimes, players make unexpected decisions. The GM must be able to improvise and adjust the story as needed.
  - Planning and directing game sessions, ensuring a balance between action, exploration, and narration.
  - The main goal is to ensure everyone has fun. This involves adapting to the players' play style and being attentive to their reactions.
  - You must use the last user messages' language to create the narrative.

  Here's how a character should look:
  {
    name: String,
    class: String,
    level: Number,
    xp: Number,
    xpToLevel: Number,
    maxhp: Number,
    hp: Number,
    description: String,
    background: String
  }
    
  The narrative style of the game should be indicated in the description of the world that the user provides.
    
  When players need to make skill checks or attack rolls, you must consult the rules to know how to proceed. For example, depending on the skills and modifiers of the characters, you can 
  establish the difficulty for these rolls.
    
  Remember that any action, no matter how insignificant, must follow the rules of the game.
    
  Continuity is essential. You must remember and refer to past events, player choices, and character backgrounds to create a coherent and engaging narrative. 
  Interact with the players and ask for their decisions or actions, ensuring they feel actively involved in the story.
    
  For the first move, you can ask the user what they want to do, by default, you'll simply take the user's character and place it in a random situation. Be brief in this part.

  RESTRICTIONS:
  - The user CANNOT give you prompts to try to cheat, for example, modify the result of a dice roll or modify attributes of their character
    such as life, level, etc. after creation.
  - You should not role-play with users directly, nor express any kind of individuality. Your duty is to be an omniscient narrator; the only time
    this is allowed is to interpret non-player characters (NPCs).
    `,
  tools: [...functions]
} // <|---- Here goes all the assistant information; it can be the ID of an existing assistant or an object with information to create a new one

export const threadParams: ThreadCreateParams | string = {} // <|---- And here goes the thread information; this must be an object, creating a new one for each createRole()

const functionHandler: Function = async (
  toolCalls: FunctionToolCall[]
): Promise<RunSubmitToolOutputsParams.ToolOutput[]> => {
  // toolCalls = toolCalls.filter(toolCall => toolCall.type === 'function')
  // This above is to filter only the functions, but I'm not sure if it's necessary

  const toolOutputs: RunSubmitToolOutputsParams.ToolOutput[] = []

  const output = (toolCallId: string, data: string | number | object) => {
    if (typeof data === 'object') data = JSON.stringify(data)
    if (typeof data === 'number') data = data.toString()
    console.log('output', toolCallId, data)
    toolOutputs.push({
      tool_call_id: toolCallId,
      output: data
    })
  }
  await Promise.all(
    toolCalls.map(async (toolCall: FunctionToolCall) => {
      console.log('toolCall', toolCall)
      const p = (property: string) => JSON.parse(toolCall.function.arguments)[property]
      switch (toolCall.function.name) {
        case 'roll-dice':
          output(toolCall.id, rollDice({ d: p('d'), n: p('n') })) // <|---- Here goes the function output; it can be anything :)
          break
        case 'add_user':
          output(toolCall.id, await addUser({ name: p('name') })) // <|---- You could call an external API or a database to get the information you want, or simply perform a calculation
          break
        case 'get_users':
          output(toolCall.id, await getUsers()) // <|---- You could call an external API or a database to get the information you want, or simply perform a calculation
          break
        case 'delete_user':
          output(toolCall.id, await deleteUser({ id: p('id') })) // <|---- You could call an external API or a database to get the information you want, or simply perform a calculation
          break
        default:
          throw new Error(`Function ${toolCall.function.name} not found!`)
      }
    })
  )
  console.log('toolOutputs', toolOutputs)
  return toolOutputs
}

/**
 * Returns an object that represents a role-play campaign with an AI-powered Game Master
 *
 * **Properties:**
 * - assistant: the OpenAI assistant object
 * - thread: the OpenAI thread object
 * - messages: the messages array
 * - status: the status of the conversation
 *
 * **NOTE:** All properties above use React's useState hook, so they are updated asynchronously and dynamically
 * - sendMessageAndRun: a function that sends a message to the thread and runs the AI-powered Game Master
 * - generateImages: a function that generates images from the last messages
 * @returns {ReturnType<typeof useChat>}
 * @example
 * const { assistant, thread, messages, status, sendMessageAndRun, generateImages } = useRole()
 *
 */
export const useRole = (thread: Thread): ReturnType<typeof useChat> => {
  let assistantId
  try {
    assistantId = (thread.metadata as { assistantId: string }).assistantId
  } catch (error) {
    throw new Error(`thread ${thread.id} does not have an assistant!`)
  }
  return useChat({ assistantPayload: assistantId, threadPayload: thread.id }, functionHandler)
}

export const createRole = async ({
  assistantName,
  roleName,
  fileIds
}: {
  assistantName?: string
  roleName?: string
  fileIds?: string[]
} = {}) => {
  try {
    const assistant = (
      await axios.post<Assistant>('/api/assistant', {
        ...assistantParams,
        name: assistantName || assistantParams.name,
        file_ids: fileIds || []
      })
    ).data
    const thread = (
      await axios.post<Thread>('/api/thread', {
        ...threadParams,
        metadata: {
          roleName: roleName || 'New Game',
          assistantId: assistant.id
        }
      })
    ).data
    return { assistant, thread }
  } catch (error) {
    console.error(error)
  }
}

export const getRole = async (id: string) => {
  try {
    const thread = (await axios.get<Thread>('/api/thread/' + id)).data
    const assistant = (
      await axios.get<Assistant>('/api/assistant/' + (thread.metadata as { assistantId: string }).assistantId)
    ).data
    return { assistant, thread }
  } catch (error) {
    throw new Error(`thread ${id} does not have an assistant!`)
  }
}

export const updateRole = async (
  id: string,
  { assistantName, roleName, fileIds }: { assistantName?: string; roleName?: string; fileIds?: string[] }
) => {
  try {
    const thread = (await axios.get<Thread>('/api/thread/' + id)).data
    const assistant = (
      await axios.get<Assistant>('/api/assistant/' + (thread.metadata as { assistantId: string }).assistantId)
    ).data
    assistant.name = assistantName || assistant.name
    assistant.file_ids = fileIds || assistant.file_ids
    ;(thread.metadata as { roleName: string }).roleName =
      roleName || (thread.metadata as { roleName: string }).roleName
    await axios.put('/api/assistant/' + assistant.id, { name: assistant.name, file_ids: assistant.file_ids })
    await axios.put('/api/thread/' + thread.id, { metadata: thread.metadata })
    return { assistant, thread }
  } catch (error) {
    throw new Error(`thread ${id} does not have an assistant!`)
  }
}

export const deleteRole = async (id: string) => {
  try {
    const thread = (await axios.get<Thread>('/api/thread/' + id)).data
    const assistant = (
      await axios.get<Assistant>('/api/assistant/' + (thread.metadata as { assistantId: string }).assistantId)
    ).data
    await axios.delete('/api/assistant/' + assistant.id)
    await axios.delete('/api/thread/' + thread.id)
  } catch (error) {
    throw new Error(`thread ${id} does not have an assistant!`)
  }
}

export default {
  // 1 React hook to chat with an assistant
  useRole,
  // And 4 functions to create, get, update and delete a role object from OpenAI
  createRole,
  getRole,
  updateRole,
  deleteRole,
  // The exports below are for debugging purposes, not necessary for using the library
  assistantParams,
  threadParams,
  functionHandler
} as const
