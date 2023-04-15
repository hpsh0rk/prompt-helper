import { Action, ActionPanel, Clipboard, Form, Icon, showHUD, useNavigation } from "@raycast/api";
import { useCallback } from "react";
import { getPromptVar, Prompt } from "../types";

function PastePromptForm(props: { prompt: Prompt }) {
    const { prompt } = props;
    const { pop } = useNavigation();

    const handleSubmit = useCallback(
        (values: any) => {
            let result = prompt.context;
            getPromptVar(prompt.context).forEach((key) => {
                const value = values[key];
                if (value) {
                    result = result.replaceAll(`{{${key}}}`, value)
                } else {
                    showHUD("can't find key:" + key);
                }
            });
            Clipboard.paste(result);
            pop();
        },
        [pop]
    );

    return (
        <Form
            actions={
                <ActionPanel>
                    <Action.SubmitForm title="Paste Prompt in Active App" onSubmit={handleSubmit} />
                </ActionPanel>
            }
        >
            <>
                {
                    Array.from(getPromptVar(prompt.context)).map((v) => {
                        return <Form.TextField key={v} id={v} title={v} placeholder={v} />
                    })
                }
            </>
        </Form>
    );
}

function PastePromptHelper(props: { prompt: Prompt }) {
    return (
        <Action.Push
            icon={Icon.Plus}
            title="Input Prompt Variable"
            target={<PastePromptForm prompt={props.prompt} />}
        />
    );
}

function PastePromptAction(props: { prompt: Prompt }) {
    const { prompt } = props
    return (
        <ActionPanel.Section>
            {getPromptVar(prompt.context).size > 0 ? <PastePromptHelper prompt={prompt} /> : <Action.Paste title="Paste Prompt in Active App" content={prompt.context} />}
        </ActionPanel.Section>
    );
}
export default PastePromptAction;
