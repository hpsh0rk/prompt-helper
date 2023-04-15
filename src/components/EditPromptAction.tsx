import { Action, ActionPanel, Form, Icon, useNavigation } from "@raycast/api";
import { useCallback, useState } from "react";
import { ALL_CATEGORIZE, Prompt } from "../types";

function EditPromptForm(props: { prompt: Prompt; onEdit: (id: string, title: string, prompt: string, categorize: string) => void }) {
    const { prompt, onEdit } = props;
    const { pop } = useNavigation();

    const handleSubmit = useCallback(
        (values: { title: string, prompt: string, categorize: string }) => {
            onEdit(prompt.id, values.title, values.prompt, values.categorize);
            pop();
        },
        [onEdit, pop, prompt]
    );

    const [nameError, setNameError] = useState<string | undefined>();

    return (
        <Form
            actions={
                <ActionPanel>
                    <Action.SubmitForm title="Edit Prompt" onSubmit={handleSubmit} />
                </ActionPanel>
            }
        >
            <Form.TextField id="title" title="Title" placeholder="Input Title" defaultValue={prompt.title} />
            <Form.TextArea id="prompt" title="Prompt" placeholder="Input Prompt. use {{}} as a variable。eg：{{name}}" defaultValue={prompt.context} />
            <Form.TextField id="categorize" title="Categorize" placeholder="Input Categorize" error={nameError}
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
function EditPromptAction(props: { prompt: Prompt; onEdit: (id: string, title: string, prompt: string, categorize: string) => void }) {
    return (
        <Action.Push
            icon={Icon.Pencil}
            title="Edit Prompt"
            shortcut={{ modifiers: ["cmd"], key: "e" }}
            target={<EditPromptForm prompt={props.prompt} onEdit={props.onEdit} />}
        />
    );
}

export default EditPromptAction;
