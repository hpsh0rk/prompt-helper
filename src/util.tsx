import { showToast, Toast } from "@raycast/api";
import { nanoid } from "nanoid";
import { ALL_CATEGORIZE, Prompt, ReactSetState, State } from "./types";


export const successToast = async (title: string, message: string) => {
    await showToast({
        style: Toast.Style.Success,
        title: title,
        message: message,
    });
}

export const failedToast = async (title: string, message: string) => {
    await showToast({
        style: Toast.Style.Failure,
        title: title,
        message: message,
    });
}

export const handleCreate = (prompt: Prompt, state: State, setState: ReactSetState<State>) => {
    console.log("Handler Create....")
    console.log(`before:${state.prompts}`)

    const newPrompts = [prompt, ...state.prompts];
    setState((previous) => { return { ...previous, prompts: newPrompts, categorize: ALL_CATEGORIZE, searchText: "" } });
    successToast("Create Prompt", prompt.title)
}


export const handleCreateHelper = (title: string, context: string, categorize: string, state: State, setState: ReactSetState<State>) => {
    const prompt: Prompt = {
        id: nanoid(),
        title: title,
        categorize: categorize,
        context: context,
    };
    handleCreate(prompt, state, setState)
}

