interface Prompt {
    id: string;
    title: string;
    categorize: string;
    context: string;
}

function getPromptVar(prompt: string): Set<string> {
    const regex = /{{(.*?)}}/g;
    const promptVars = new Set<string>();
    let promptVar;
    while ((promptVar = regex.exec(prompt)) !== null) {
        promptVars.add(promptVar[1]);
    }
    return promptVars;
}

function getAllCategorize(prompts: Prompt[]): Set<string> {
    const result = new Set<string>();
    prompts.forEach((prompt) => {
        if (prompt.categorize) {
            result.add(prompt.categorize)
        }
    })
    return result;
}


const ALL_CATEGORIZE = "All"

export { getPromptVar, ALL_CATEGORIZE, getAllCategorize }

export type { Prompt };

export type State = {
    categorize: string;
    isLoading: boolean;
    searchText: string;
    prompts: Prompt[];
    visiblePrompts: Prompt[];
};


export type ReactSetState<T> = React.Dispatch<React.SetStateAction<T>>;
