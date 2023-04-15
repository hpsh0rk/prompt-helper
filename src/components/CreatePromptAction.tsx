import { Action, ActionPanel, Form, Icon, popToRoot, useNavigation } from "@raycast/api";
import { nanoid } from "nanoid";
import { useCallback, useState } from "react";
import { ALL_CATEGORIZE, Prompt, ReactSetState, State } from "../types";
import { handleCreate } from "../util";

function CreatePromptForm(props: { defaultTitle?: string; defaultPrompt?: string; defaultCategorize?: string; state: State, setState: ReactSetState<State> }) {
    const { state, setState, defaultTitle = "", defaultPrompt = "", defaultCategorize = "" } = props;
    const { pop } = useNavigation();

    const handleSubmit = (values: { title: string, prompt: string, categorize: string }) => {
        const prompt: Prompt = {
            id: nanoid(),
            title: values.title,
            categorize: values.categorize,
            context: values.prompt,
        };
        handleCreate(prompt, state, setState)
        pop();
    }

    const [nameError, setNameError] = useState<string | undefined>();

    return (
        <Form
            actions={
                <ActionPanel>
                    <Action.SubmitForm title="Create Prompt" onSubmit={handleSubmit} />
                </ActionPanel>
            }
        >
            <Form.TextField id="title" defaultValue={defaultTitle} title="Title" placeholder="Input Title" />
            <Form.TextArea id="prompt" title="Prompt" defaultValue={defaultPrompt} placeholder="Input Prompt. use {{}} as a variable。eg：{{name}}" />
            <Form.TextField id="categorize" title="Categorize" placeholder="Input Categorize" defaultValue={defaultCategorize} error={nameError}
                onChange={(newValue) => {
                    if (newValue === ALL_CATEGORIZE) {
                        setNameError(`The field should't be ${ALL_CATEGORIZE}!`);
                    } else {
                        if (nameError && nameError.length > 0) {
                            setNameError(undefined);
                        }
                    }
                }}
            />
        </Form>
    );
}

function CreatePromptAction(props: { defaultTitle?: string; defaultPrompt?: string; defaultCategorize?: string; state: State, setState: ReactSetState<State> }) {
    return (
        <Action.Push
            icon={Icon.Plus}
            title="Create Prompt"
            shortcut={{ modifiers: ["cmd"], key: "n" }}
            target={
                <CreatePromptForm
                    defaultTitle={props.defaultTitle}
                    defaultPrompt={props.defaultPrompt}
                    defaultCategorize={props.defaultCategorize}
                    state={props.state}
                    setState={props.setState}
                />
            }
        />
    );
}

export default CreatePromptAction;
